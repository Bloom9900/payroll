import { Router } from 'express'
import multer from 'multer'
import {
  addTaxTable,
  listTaxTables,
  getTaxTablesForPeriod,
  validateTaxTablePeriods,
  addSocialSecurityRate,
  listSocialSecurityRates,
  getSocialSecurityForPeriod,
  addMinimumWage,
  listMinimumWages,
  getMinimumWageForPeriod,
  addPensionScheme,
  listPensionSchemes,
  getPensionScheme,
  checkPeriodCoverage,
  importRatesFromJson
} from '../services/ratesStorage.js'
import { parseExcelTaxTable } from '../services/excelTaxTableParser.js'
import { centsToEuro } from '../utils/currency.js'
import type { TableType } from '../models/payroll.js'

const upload = multer({ storage: multer.memoryStorage() })

export const ratesRouter = Router()

// Tax Tables
ratesRouter.get('/tax-tables', (req, res) => {
  try {
    const tables = listTaxTables()
    res.json({ taxTables: tables })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

ratesRouter.get('/tax-tables/period/:start/:end', (req, res) => {
  try {
    const { start, end } = req.params
    const tableType = req.query.tableType as string | undefined
    const tables = getTaxTablesForPeriod(start, end, tableType)
    res.json({ taxTables: tables })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

ratesRouter.post('/tax-tables', (req, res) => {
  try {
    const table = addTaxTable(req.body)
    res.json({ taxTable: table })
  } catch (err) {
    res.status(400).json({ error: (err as Error).message })
  }
})

ratesRouter.get('/tax-tables/validate', (req, res) => {
  try {
    const validation = validateTaxTablePeriods()
    res.json(validation)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Social Security
ratesRouter.get('/social-security', (req, res) => {
  try {
    const rates = listSocialSecurityRates()
    res.json({ socialSecurity: rates })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

ratesRouter.get('/social-security/period/:start/:end', (req, res) => {
  try {
    const { start, end } = req.params
    const rate = getSocialSecurityForPeriod(start, end)
    if (!rate) {
      return res.status(404).json({ error: 'No social security rate found for period' })
    }
    res.json({ socialSecurity: rate })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

ratesRouter.post('/social-security', (req, res) => {
  try {
    const rate = addSocialSecurityRate(req.body)
    res.json({ socialSecurity: rate })
  } catch (err) {
    res.status(400).json({ error: (err as Error).message })
  }
})

// Minimum Wage
ratesRouter.get('/minimum-wage', (req, res) => {
  try {
    const wages = listMinimumWages()
    res.json({ minimumWages: wages })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

ratesRouter.get('/minimum-wage/period/:start/:end', (req, res) => {
  try {
    const { start, end } = req.params
    const age = req.query.age ? parseInt(req.query.age as string) : 21
    const wage = getMinimumWageForPeriod(start, end, age)
    if (!wage) {
      return res.status(404).json({ error: 'No minimum wage found for period' })
    }
    res.json({ minimumWage: wage })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

ratesRouter.post('/minimum-wage', (req, res) => {
  try {
    const wage = addMinimumWage(req.body)
    res.json({ minimumWage: wage })
  } catch (err) {
    res.status(400).json({ error: (err as Error).message })
  }
})

// Pension Schemes
ratesRouter.get('/pension-schemes', (req, res) => {
  try {
    const schemes = listPensionSchemes()
    res.json({ pensionSchemes: schemes })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

ratesRouter.get('/pension-schemes/:id', (req, res) => {
  try {
    const scheme = getPensionScheme(req.params.id)
    if (!scheme) {
      return res.status(404).json({ error: 'Pension scheme not found' })
    }
    res.json({ pensionScheme: scheme })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

ratesRouter.post('/pension-schemes', (req, res) => {
  try {
    const scheme = addPensionScheme(req.body)
    res.json({ pensionScheme: scheme })
  } catch (err) {
    res.status(400).json({ error: (err as Error).message })
  }
})

// Period Coverage Check
ratesRouter.get('/coverage/:start/:end', (req, res) => {
  try {
    const { start, end } = req.params
    const coverage = checkPeriodCoverage(start, end)
    res.json(coverage)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Import Rates
ratesRouter.post('/import', (req, res) => {
  try {
    const result = importRatesFromJson(req.body)
    res.json({
      message: 'Rates imported successfully',
      ...result
    })
  } catch (err) {
    res.status(400).json({ error: (err as Error).message })
  }
})

// Import Tax Tables from Excel
ratesRouter.post('/tax-tables/import-excel', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    // Get parameters from query or body
    const periodStart = (req.body.periodStart || req.query.periodStart) as string
    const periodEnd = (req.body.periodEnd || req.query.periodEnd) as string
    const tableType = (req.body.tableType || req.query.tableType || 'loonheffing') as TableType
    const taxYear = req.body.taxYear || req.query.taxYear 
      ? parseInt(req.body.taxYear || req.query.taxYear as string) 
      : undefined

    if (!periodStart || !periodEnd) {
      return res.status(400).json({ 
        error: 'periodStart and periodEnd are required (format: YYYY-MM-DD)' 
      })
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(periodStart) || !dateRegex.test(periodEnd)) {
      return res.status(400).json({ 
        error: 'Invalid date format. Use YYYY-MM-DD' 
      })
    }

    // Parse Excel file
    const parseResult = parseExcelTaxTable(
      req.file.buffer,
      periodStart,
      periodEnd,
      tableType,
      taxYear
    )

    if (parseResult.errors.length > 0 && parseResult.taxTables.length === 0) {
      return res.status(400).json({
        error: 'Failed to parse Excel file',
        errors: parseResult.errors,
        warnings: parseResult.warnings
      })
    }

    // Import tax tables
    let importedCount = 0
    for (const table of parseResult.taxTables) {
      try {
        addTaxTable(table)
        importedCount++
      } catch (err) {
        parseResult.errors.push(`Failed to import table: ${(err as Error).message}`)
      }
    }

    res.json({
      message: `Successfully imported ${importedCount} tax table entries`,
      imported: importedCount,
      total: parseResult.taxTables.length,
      errors: parseResult.errors,
      warnings: parseResult.warnings
    })
  } catch (err) {
    res.status(400).json({ error: (err as Error).message })
  }
})

