import { Router } from 'express'
import {
  submitToBank,
  listBankSubmissions,
  getBankSubmission,
  confirmBankPayment,
  submitPensionContribution,
  listPensionSubmissions,
  submitHealthInsurance,
  listHealthInsuranceSubmissions,
  submitTaxFiling as mockSubmitTaxFiling,
  listTaxFilings as mockListTaxFilings,
  sendEmail,
  listEmails,
  syncHrSystem,
  listHrSyncs
} from '../services/mockServices.js'
import { logAuditEvent } from '../services/audit.js'

export const mockServicesRouter = Router()

// Bank submissions
mockServicesRouter.get('/bank/submissions', (req, res) => {
  try {
    const submissions = listBankSubmissions()
    res.json({ submissions })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

mockServicesRouter.get('/bank/submissions/:id', (req, res) => {
  try {
    const submission = getBankSubmission(req.params.id)
    if (!submission) {
      return res.status(404).json({ error: 'Bank submission not found' })
    }
    res.json({ submission })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

mockServicesRouter.post('/bank/submit', (req, res) => {
  try {
    const { payrollRunId, sepaFileName, transactionCount, totalAmount } = req.body
    const submission = submitToBank(payrollRunId, sepaFileName, transactionCount, totalAmount)
    logAuditEvent('payment_submitted', {
      submissionId: submission.id,
      payrollRunId,
      totalAmount
    })
    res.status(201).json({ submission })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

mockServicesRouter.post('/bank/confirm/:id', (req, res) => {
  try {
    const submission = confirmBankPayment(req.params.id)
    if (!submission) {
      return res.status(404).json({ error: 'Bank submission not found' })
    }
    res.json({ submission })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Pension submissions
mockServicesRouter.get('/pension/submissions', (req, res) => {
  try {
    const submissions = listPensionSubmissions()
    res.json({ submissions })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

mockServicesRouter.post('/pension/submit', (req, res) => {
  try {
    const { month, employeeId, employeeContribution, employerContribution, provider } = req.body
    const submission = submitPensionContribution(month, employeeId, employeeContribution, employerContribution, provider)
    logAuditEvent('pension_submission', {
      submissionId: submission.id,
      employeeId,
      month
    })
    res.status(201).json({ submission })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Health insurance submissions
mockServicesRouter.get('/insurance/submissions', (req, res) => {
  try {
    const submissions = listHealthInsuranceSubmissions()
    res.json({ submissions })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

mockServicesRouter.post('/insurance/submit', (req, res) => {
  try {
    const { month, employeeId, premium, employerContribution, provider } = req.body
    const submission = submitHealthInsurance(month, employeeId, premium, employerContribution, provider)
    res.status(201).json({ submission })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Tax filings
mockServicesRouter.get('/tax/filings', (req, res) => {
  try {
    const filings = mockListTaxFilings()
    res.json({ filings })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

mockServicesRouter.post('/tax/submit', (req, res) => {
  try {
    const { month, employeeCount, totalGross, totalTax } = req.body
    const filing = mockSubmitTaxFiling(month, employeeCount, totalGross, totalTax)
    logAuditEvent('tax_filing_submitted', {
      filingId: filing.id,
      month,
      employeeCount
    })
    res.status(201).json({ filing })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Email service
mockServicesRouter.get('/emails', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50
    const emails = listEmails(limit)
    res.json({ emails })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

mockServicesRouter.post('/emails/send', (req, res) => {
  try {
    const { to, subject, body } = req.body
    const email = sendEmail(to, subject, body)
    res.status(201).json({ email })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// HR system sync
mockServicesRouter.get('/hr/syncs', (req, res) => {
  try {
    const syncs = listHrSyncs()
    res.json({ syncs })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

mockServicesRouter.post('/hr/sync', (req, res) => {
  try {
    const sync = syncHrSystem()
    logAuditEvent('user_action', {
      action: 'hr_sync',
      syncId: sync.id
    })
    res.status(201).json({ sync })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

