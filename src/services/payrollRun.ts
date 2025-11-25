import { calculateMonthlyPayroll, type PayrollCalculationResult } from './netherlandsPayroll.js'
import { listEmployees } from './employeeRegistry.js'
import { centsToEuro } from '../utils/currency.js'

export type PayrollRunStatus = 'pending' | 'approved' | 'rejected' | 'completed'

export type PayrollRun = {
  id: string
  month: string
  status: PayrollRunStatus
  calculations: PayrollCalculationResult[]
  createdAt: Date
  approvedAt?: Date
  approvedBy?: string
  completedAt?: Date
  sepaFileGenerated: boolean
  sepaFileName?: string
  totals: {
    grossCents: number
    netCents: number
    wageTaxCents: number
    wageTaxCreditCents: number
    socialSecurityCents: number
    pensionEmployeeCents: number
    healthInsuranceEmployeeCents: number
    pensionEmployerCents: number
    healthInsuranceEmployerCents: number
    zvwEmployerCents: number
    totalEmployerCostsCents: number
    holidayAllowancePaymentsCents: number
    outstandingHolidayPayoutCents: number
  }
}

const payrollRuns: PayrollRun[] = []

export function createPayrollRun(month: string): PayrollRun {
  const employees = listEmployees()
  const calculations = employees
    .map(employee => calculateMonthlyPayroll({ employee, month }))
    .filter(r => r.employment.proRatedFactor > 0 || 
                 r.amounts.allowances.holidayAllowancePaymentCents > 0 || 
                 r.amounts.adjustments.outstandingHolidayPayoutCents > 0)

  const totals = calculations.reduce((acc, r) => {
    acc.grossCents += r.amounts.grossCents
    acc.netCents += r.amounts.netCents
    acc.wageTaxCents += r.amounts.deductions.wageTaxCents
    acc.wageTaxCreditCents += r.amounts.deductions.wageTaxCreditCents
    acc.socialSecurityCents += r.amounts.deductions.socialSecurityCents
    acc.pensionEmployeeCents += r.amounts.deductions.pensionEmployeeCents
    acc.healthInsuranceEmployeeCents += r.amounts.deductions.healthInsuranceEmployeeCents
    acc.pensionEmployerCents += r.amounts.employerCosts.pensionEmployerCents
    acc.healthInsuranceEmployerCents += r.amounts.employerCosts.healthInsuranceEmployerCents
    acc.zvwEmployerCents += r.amounts.employerCosts.zvwEmployerCents
    acc.totalEmployerCostsCents += r.amounts.employerCosts.totalEmployerCostsCents
    acc.holidayAllowancePaymentsCents += r.amounts.allowances.holidayAllowancePaymentCents
    acc.outstandingHolidayPayoutCents += r.amounts.adjustments.outstandingHolidayPayoutCents
    return acc
  }, {
    grossCents: 0,
    netCents: 0,
    wageTaxCents: 0,
    wageTaxCreditCents: 0,
    socialSecurityCents: 0,
    pensionEmployeeCents: 0,
    healthInsuranceEmployeeCents: 0,
    pensionEmployerCents: 0,
    healthInsuranceEmployerCents: 0,
    zvwEmployerCents: 0,
    totalEmployerCostsCents: 0,
    holidayAllowancePaymentsCents: 0,
    outstandingHolidayPayoutCents: 0
  })

  const run: PayrollRun = {
    id: `PR-${Date.now()}`,
    month,
    status: 'pending',
    calculations,
    createdAt: new Date(),
    sepaFileGenerated: false,
    totals
  }

  payrollRuns.push(run)
  return run
}

export function getPayrollRun(id: string): PayrollRun | undefined {
  return payrollRuns.find(r => r.id === id)
}

export function listPayrollRuns(): PayrollRun[] {
  return [...payrollRuns].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

export function getPayrollRunByMonth(month: string): PayrollRun | undefined {
  return payrollRuns.find(r => r.month === month)
}

export function approvePayrollRun(id: string, approvedBy: string): PayrollRun | undefined {
  const run = getPayrollRun(id)
  if (!run) return undefined
  if (run.status !== 'pending') return run

  run.status = 'approved'
  run.approvedAt = new Date()
  run.approvedBy = approvedBy
  return run
}

export function rejectPayrollRun(id: string, rejectedBy: string): PayrollRun | undefined {
  const run = getPayrollRun(id)
  if (!run) return undefined
  if (run.status !== 'pending') return run

  run.status = 'rejected'
  run.approvedAt = new Date()
  run.approvedBy = rejectedBy
  return run
}

export function completePayrollRun(id: string): PayrollRun | undefined {
  const run = getPayrollRun(id)
  if (!run) return undefined
  if (run.status !== 'approved') return undefined

  run.status = 'completed'
  run.completedAt = new Date()
  run.sepaFileGenerated = true
  run.sepaFileName = `sepa-${run.month}.xml`
  return run
}

export function markSepaGenerated(id: string, fileName: string): PayrollRun | undefined {
  const run = getPayrollRun(id)
  if (!run) return undefined

  run.sepaFileGenerated = true
  run.sepaFileName = fileName
  return run
}

export function getPayrollRunSummary(run: PayrollRun) {
  return {
    id: run.id,
    month: run.month,
    status: run.status,
    employeeCount: run.calculations.length,
    totals: {
      gross: centsToEuro(run.totals.grossCents),
      net: centsToEuro(run.totals.netCents),
      wageTax: centsToEuro(run.totals.wageTaxCents),
      wageTaxCredit: centsToEuro(run.totals.wageTaxCreditCents),
      socialSecurity: centsToEuro(run.totals.socialSecurityCents),
      pensionEmployee: centsToEuro(run.totals.pensionEmployeeCents),
      healthInsuranceEmployee: centsToEuro(run.totals.healthInsuranceEmployeeCents),
      pensionEmployer: centsToEuro(run.totals.pensionEmployerCents),
      healthInsuranceEmployer: centsToEuro(run.totals.healthInsuranceEmployerCents),
      zvwEmployer: centsToEuro(run.totals.zvwEmployerCents),
      totalEmployerCosts: centsToEuro(run.totals.totalEmployerCostsCents),
      holidayAllowancePayments: centsToEuro(run.totals.holidayAllowancePaymentsCents),
      outstandingHolidayPayout: centsToEuro(run.totals.outstandingHolidayPayoutCents)
    },
    createdAt: run.createdAt.toISOString(),
    approvedAt: run.approvedAt?.toISOString(),
    approvedBy: run.approvedBy,
    completedAt: run.completedAt?.toISOString(),
    sepaFileGenerated: run.sepaFileGenerated,
    sepaFileName: run.sepaFileName
  }
}

