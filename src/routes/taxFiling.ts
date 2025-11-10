import { Router } from 'express'
import { 
  generateTaxFiling, 
  submitTaxFiling, 
  getTaxFiling, 
  getTaxFilingByMonth, 
  listTaxFilings
} from '../services/taxFiling.js'
import { logAuditEvent } from '../services/audit.js'

export const taxFilingRouter = Router()

// Generate tax filing for month
taxFilingRouter.post('/generate', (req, res) => {
  try {
    const { month } = req.body
    if (!month) {
      return res.status(400).json({ error: 'month is required (format: YYYY-MM)' })
    }

    const filing = generateTaxFiling(month)
    logAuditEvent('tax_filing_submitted', {
      filingId: filing.id,
      month
    })

    res.status(201).json({
      id: filing.id,
      month: filing.month,
      status: filing.status,
      data: filing.data
    })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Submit tax filing
taxFilingRouter.post('/:id/submit', (req, res) => {
  try {
    const filing = submitTaxFiling(req.params.id)
    if (!filing) {
      return res.status(404).json({ error: 'Tax filing not found' })
    }

    logAuditEvent('tax_filing_submitted', {
      filingId: filing.id,
      month: filing.month
    })

    res.json({
      id: filing.id,
      month: filing.month,
      status: filing.status,
      submittedAt: filing.submittedAt?.toISOString(),
      confirmationNumber: filing.confirmationNumber,
      data: filing.data
    })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Get tax filing
taxFilingRouter.get('/:id', (req, res) => {
  try {
    const filing = getTaxFiling(req.params.id)
    if (!filing) {
      return res.status(404).json({ error: 'Tax filing not found' })
    }

    res.json({
      id: filing.id,
      month: filing.month,
      status: filing.status,
      submittedAt: filing.submittedAt?.toISOString(),
      confirmedAt: filing.confirmedAt?.toISOString(),
      confirmationNumber: filing.confirmationNumber,
      data: filing.data
    })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Get tax filing by month
taxFilingRouter.get('/month/:month', (req, res) => {
  try {
    const filing = getTaxFilingByMonth(req.params.month)
    if (!filing) {
      return res.status(404).json({ error: 'Tax filing not found for this month' })
    }

    res.json({
      id: filing.id,
      month: filing.month,
      status: filing.status,
      submittedAt: filing.submittedAt?.toISOString(),
      confirmedAt: filing.confirmedAt?.toISOString(),
      confirmationNumber: filing.confirmationNumber,
      data: filing.data
    })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// List tax filings
taxFilingRouter.get('/', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50
    const filings = listTaxFilings(limit)
    res.json({
      filings: filings.map(f => ({
        id: f.id,
        month: f.month,
        status: f.status,
        submittedAt: f.submittedAt?.toISOString(),
        confirmedAt: f.confirmedAt?.toISOString(),
        confirmationNumber: f.confirmationNumber,
        employeeCount: f.data.employeeCount,
        totalGross: f.data.totalGross,
        totalTax: f.data.totalTax
      }))
    })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

