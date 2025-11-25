/**
 * Excel Tax Table Parser
 * Parses Dutch tax table Excel files (wit_mnd_nl_std format) into TaxTable format
 */

import * as XLSX from 'xlsx'
import type { TaxTable, TableType } from '../models/payroll.js'

export interface ExcelParseResult {
  taxTables: Array<Omit<TaxTable, 'id' | 'createdAt'>>
  errors: string[]
  warnings: string[]
}

/**
 * Parse Excel file and convert to TaxTable format
 * Supports Dutch tax table format (wit_mnd_nl_std)
 */
export function parseExcelTaxTable(
  fileBuffer: Buffer,
  periodStart: string,
  periodEnd: string,
  tableType: TableType = 'loonheffing',
  taxYear?: number
): ExcelParseResult {
  const errors: string[] = []
  const warnings: string[] = []
  const taxTables: Array<Omit<TaxTable, 'id' | 'createdAt'>> = []

  try {
    // Parse Excel file
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
    
    // Try to find the first sheet with data
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      errors.push('No sheets found in Excel file')
      return { taxTables, errors, warnings }
    }

    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][]

    // Extract tax year from filename or use provided year or current year
    let extractedTaxYear = taxYear
    if (!extractedTaxYear) {
      const currentDate = new Date()
      extractedTaxYear = currentDate.getFullYear()
      warnings.push(`Tax year not specified, using ${extractedTaxYear}`)
    }

    // Find header row (usually row 0 or 1)
    let headerRowIndex = -1
    let bracketLowCol = -1
    let bracketHighCol = -1
    let rateCol = -1
    let creditAmountCol = -1
    let creditTypeCol = -1

    // Common column names in Dutch tax tables
    const possibleHeaders = [
      ['van', 'tot', 'percentage', 'korting', 'type'],
      ['from', 'to', 'rate', 'credit', 'creditType'],
      ['bracketLow', 'bracketHigh', 'rate', 'creditAmount', 'creditType'],
      ['lower', 'upper', 'rate', 'credit', 'type']
    ]

    // Try to find header row
    for (let i = 0; i < Math.min(5, data.length); i++) {
      const row = data[i]
      if (!row || row.length === 0) continue

      // Check if this looks like a header row
      const rowLower = row.map((cell: any) => 
        cell ? String(cell).toLowerCase().trim() : ''
      )

      // Try to match known header patterns
      for (const headers of possibleHeaders) {
        const matches = headers.every(header => 
          rowLower.some(cell => cell.includes(header))
        )
        
        if (matches) {
          headerRowIndex = i
          // Find column indices
          bracketLowCol = rowLower.findIndex(cell => 
            cell.includes('van') || cell.includes('from') || cell.includes('lower') || cell.includes('bracketlow')
          )
          bracketHighCol = rowLower.findIndex(cell => 
            cell.includes('tot') || cell.includes('to') || cell.includes('upper') || cell.includes('brackethigh')
          )
          rateCol = rowLower.findIndex(cell => 
            cell.includes('percentage') || cell.includes('rate')
          )
          creditAmountCol = rowLower.findIndex(cell => 
            cell.includes('korting') || cell.includes('credit')
          )
          creditTypeCol = rowLower.findIndex(cell => 
            cell.includes('type')
          )
          break
        }
      }

      if (headerRowIndex !== -1) break
    }

    // If no header found, assume first row is header and use positional columns
    if (headerRowIndex === -1) {
      headerRowIndex = 0
      bracketLowCol = 0
      bracketHighCol = 1
      rateCol = 2
      creditAmountCol = 3
      creditTypeCol = 4
      warnings.push('Header row not found, using positional columns')
    }

    // Parse data rows
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i]
      if (!row || row.length === 0) continue

      // Skip empty rows
      if (row.every((cell: any) => cell === null || cell === undefined || cell === '')) {
        continue
      }

      try {
        // Extract values
        const bracketLowRaw = row[bracketLowCol]
        const bracketHighRaw = row[bracketHighCol]
        const rateRaw = row[rateCol]
        const creditAmountRaw = creditAmountCol >= 0 ? row[creditAmountCol] : null
        const creditTypeRaw = creditTypeCol >= 0 ? row[creditTypeCol] : null

        // Skip if essential values are missing
        if (bracketLowRaw === null || bracketLowRaw === undefined || 
            bracketHighRaw === null || bracketHighRaw === undefined ||
            rateRaw === null || rateRaw === undefined) {
          continue
        }

        // Convert to numbers
        // Handle different formats (euros, cents, percentages)
        let bracketLow = parseValue(bracketLowRaw)
        let bracketHigh = parseValue(bracketHighRaw)
        let rate = parseValue(rateRaw)
        const creditAmount = creditAmountRaw !== null && creditAmountRaw !== undefined 
          ? parseValue(creditAmountRaw) 
          : null
        const creditType = creditTypeRaw !== null && creditTypeRaw !== undefined 
          ? String(creditTypeRaw).trim() || null
          : null

        // If values are in euros, convert to cents
        // Assume if bracketLow < 100000, it's probably in euros (annual income)
        if (bracketLow < 100000 && bracketLow > 0) {
          bracketLow = Math.round(bracketLow * 100)
          warnings.push('Converted bracket values from euros to cents')
        }
        if (bracketHigh < 100000 && bracketHigh > 0 && bracketHigh !== Infinity) {
          bracketHigh = Math.round(bracketHigh * 100)
        }

        // If rate is > 1, assume it's a percentage (e.g., 36.93 instead of 0.3693)
        if (rate > 1) {
          rate = rate / 100
          warnings.push('Converted rate from percentage to decimal')
        }

        // If creditAmount is provided and < 1000, assume it's in euros
        if (creditAmount !== null && creditAmount < 1000 && creditAmount > 0) {
          const creditInCents = Math.round(creditAmount * 100)
          taxTables.push({
            periodStart,
            periodEnd,
            bracketLow,
            bracketHigh: bracketHigh === Infinity || bracketHigh === null ? Infinity : bracketHigh,
            rate,
            creditType,
            creditAmount: creditInCents,
            tableType,
            taxYear: extractedTaxYear
          })
        } else {
          taxTables.push({
            periodStart,
            periodEnd,
            bracketLow,
            bracketHigh: bracketHigh === Infinity || bracketHigh === null ? Infinity : bracketHigh,
            rate,
            creditType,
            creditAmount: creditAmount !== null ? Math.round(creditAmount) : null,
            tableType,
            taxYear: extractedTaxYear
          })
        }
      } catch (err) {
        errors.push(`Error parsing row ${i + 1}: ${(err as Error).message}`)
      }
    }

    if (taxTables.length === 0) {
      errors.push('No valid tax table rows found in Excel file')
    }

  } catch (err) {
    errors.push(`Failed to parse Excel file: ${(err as Error).message}`)
  }

  return { taxTables, errors, warnings }
}

/**
 * Helper function to parse various value formats
 */
function parseValue(value: any): number {
  if (value === null || value === undefined) {
    return 0
  }

  // If it's already a number
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value
  }

  // If it's a string, try to parse it
  if (typeof value === 'string') {
    // Remove common formatting (spaces, currency symbols, etc.)
    const cleaned = value
      .replace(/[€$£,\s]/g, '')
      .replace(/\./g, '') // Remove thousand separators
      .replace(',', '.') // Replace decimal comma with dot
      .trim()

    const parsed = parseFloat(cleaned)
    return isNaN(parsed) ? 0 : parsed
  }

  return 0
}

