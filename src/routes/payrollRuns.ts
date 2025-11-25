import { Router } from 'express'
import { 
  createPayrollRun, 
  getPayrollRun, 
  listPayrollRuns, 
  approvePayrollRun, 
  rejectPayrollRun,
  completePayrollRun,
  getPayrollRunSummary,
  markSepaGenerated
} from '../services/payrollRun.js'
import { logAuditEvent } from '../services/audit.js'
import { buildPain001 } from '../services/sepa.js'
import { config } from '../config.js'
import { listEmployees } from '../services/employeeRegistry.js'
import { calculateMonthlyPayroll } from '../services/netherlandsPayroll.js'
import { centsToEuro } from '../utils/currency.js'

export const payrollRunsRouter = Router()

// List all payroll runs
payrollRunsRouter.get('/', (req, res) => {
  try {
    const runs = listPayrollRuns()
    const summaries = runs.map(run => getPayrollRunSummary(run))
    res.json({ runs: summaries })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Get specific payroll run
payrollRunsRouter.get('/:id', (req, res) => {
  try {
    const run = getPayrollRun(req.params.id)
    if (!run) {
      return res.status(404).json({ error: 'Payroll run not found' })
    }

    const employees = run.calculations.map(r => ({
      employeeId: r.employee.id,
      name: `${r.employee.firstName} ${r.employee.lastName}`,
      email: r.employee.email,
      department: r.employee.department,
      role: r.employee.role,
      contractType: r.employee.contractType,
      startDate: r.employee.startDate,
      endDate: r.employee.endDate ?? null,
      location: r.employee.location,
      employment: r.employment,
      amounts: {
        gross: centsToEuro(r.amounts.grossCents),
        taxable: centsToEuro(r.amounts.taxableCents),
        net: centsToEuro(r.amounts.netCents),
        allowances: {
          ruling30: centsToEuro(r.amounts.allowances.ruling30Cents),
          holidayAccrual: centsToEuro(r.amounts.allowances.holidayAccrualCents),
          holidayAllowancePayment: centsToEuro(r.amounts.allowances.holidayAllowancePaymentCents),
          holidayAllowanceDue: centsToEuro(r.amounts.allowances.holidayAllowanceDueCents)
        },
        deductions: {
          wageTax: centsToEuro(r.amounts.deductions.wageTaxCents),
          socialSecurity: centsToEuro(r.amounts.deductions.socialSecurityCents)
        },
        adjustments: {
          outstandingHolidayPayout: centsToEuro(r.amounts.adjustments.outstandingHolidayPayoutCents),
          latePaymentFee: centsToEuro(r.amounts.adjustments.latePaymentFeeCents)
        }
      },
      metadata: r.metadata
    }))

    res.json({
      ...getPayrollRunSummary(run),
      employees
    })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Create new payroll run
payrollRunsRouter.post('/', (req, res) => {
  try {
    const { month } = req.body
    if (!month) {
      return res.status(400).json({ error: 'Month is required (format: YYYY-MM)' })
    }

    const run = createPayrollRun(month)
    logAuditEvent('payroll_run_created', {
      payrollRunId: run.id,
      month: run.month,
      employeeCount: run.calculations.length
    })

    res.status(201).json(getPayrollRunSummary(run))
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Approve payroll run
payrollRunsRouter.post('/:id/approve', (req, res) => {
  try {
    const { approvedBy } = req.body
    const run = approvePayrollRun(req.params.id, approvedBy || 'system')
    
    if (!run) {
      return res.status(404).json({ error: 'Payroll run not found or cannot be approved' })
    }

    logAuditEvent('payroll_run_approved', {
      payrollRunId: run.id,
      month: run.month,
      approvedBy: run.approvedBy
    })

    res.json(getPayrollRunSummary(run))
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Reject payroll run
payrollRunsRouter.post('/:id/reject', (req, res) => {
  try {
    const { rejectedBy } = req.body
    const run = rejectPayrollRun(req.params.id, rejectedBy || 'system')
    
    if (!run) {
      return res.status(404).json({ error: 'Payroll run not found or cannot be rejected' })
    }

    logAuditEvent('payroll_run_rejected', {
      payrollRunId: run.id,
      month: run.month,
      rejectedBy: run.approvedBy
    })

    res.json(getPayrollRunSummary(run))
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Complete payroll run
payrollRunsRouter.post('/:id/complete', (req, res) => {
  try {
    const run = completePayrollRun(req.params.id)
    
    if (!run) {
      return res.status(404).json({ error: 'Payroll run not found or cannot be completed' })
    }

    logAuditEvent('payroll_run_completed', {
      payrollRunId: run.id,
      month: run.month
    })

    res.json(getPayrollRunSummary(run))
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Generate SEPA file for payroll run
payrollRunsRouter.post('/:id/sepa', (req, res) => {
  try {
    const run = getPayrollRun(req.params.id)
    if (!run) {
      return res.status(404).json({ error: 'Payroll run not found' })
    }

    const payments = run.calculations
      .filter(r => r.amounts.netCents > 0)
      .map(r => ({
        endToEndId: `SAL-${r.employee.id}-${run.month}`,
        name: `${r.employee.firstName} ${r.employee.lastName}`,
        iban: r.employee.iban,
        bic: r.employee.bic ?? undefined,
        amount: centsToEuro(r.amounts.netCents),
        remittance: r.employment.isLeaver ? `Salary & final payout ${run.month}` : `Salary ${run.month}`
      }))

    const xml = buildPain001(
      { name: config.company.name, iban: config.company.iban, bic: config.company.bic },
      payments
    )

    const fileName = `sepa-${run.month}.xml`
    markSepaGenerated(run.id, fileName)

    logAuditEvent('sepa_file_generated', {
      payrollRunId: run.id,
      fileName,
      paymentCount: payments.length
    })

    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.send(xml)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

