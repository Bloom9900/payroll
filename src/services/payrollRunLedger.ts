import crypto from 'node:crypto'
import { calculateMonthlyPayroll } from './netherlandsPayroll.js'
import { listEmployees } from './employeeRegistry.js'
import { resolveDataPath, readJsonFile, writeJsonFile } from './fileStore.js'

export type PayrollRunStatus = 'draft' | 'reviewed' | 'approved'

export type PayrollRunHistoryEntry = {
  status: PayrollRunStatus
  changedAt: string
  changedBy: string
  note?: string
}

export type PayrollRunEmployeeSnapshot = {
  employeeId: string
  name: string
  department: string
  netCents: number
  grossCents: number
  manualAdjustmentsCents: number
}

export type PayrollRunRecord = {
  id: string
  period: string
  status: PayrollRunStatus
  createdAt: string
  createdBy: string
  paymentDate?: string
  dueDate?: string
  note?: string
  totals: {
    grossCents: number
    netCents: number
    wageTaxCents: number
    socialSecurityCents: number
    manualAdjustmentsCents: number
  }
  employees: PayrollRunEmployeeSnapshot[]
  history: PayrollRunHistoryEntry[]
}

const runsPath = resolveDataPath('payroll-runs.json')

let runStore = readJsonFile<PayrollRunRecord[]>(runsPath, [])
if (!Array.isArray(runStore)) runStore = []

function persist (): void {
  writeJsonFile(runsPath, runStore)
}

function nowIso (): string {
  return new Date().toISOString()
}

function buildCalculations (period: string, paymentDate?: string, dueDate?: string) {
  return listEmployees()
    .map(employee => calculateMonthlyPayroll({ employee, month: period, paymentDate, dueDate }))
    .filter(record => record.employment.proRatedFactor > 0 || record.amounts.allowances.holidayAllowancePaymentCents > 0 || record.amounts.adjustments.outstandingHolidayPayoutCents > 0 || record.amounts.adjustments.manualAdjustmentsCents !== 0)
}

export function listPayrollRuns (): PayrollRunRecord[] {
  return runStore.slice().sort((a, b) => {
    if (a.period === b.period) {
      return b.createdAt.localeCompare(a.createdAt)
    }
    return b.period.localeCompare(a.period)
  })
}

export function getPayrollRun (id: string): PayrollRunRecord | undefined {
  return runStore.find(run => run.id === id)
}

export function createPayrollRun (input: { period: string; paymentDate?: string; dueDate?: string; note?: string }, options?: { createdBy?: string }): PayrollRunRecord {
  const calculations = buildCalculations(input.period, input.paymentDate, input.dueDate)
  const totals = calculations.reduce((acc, record) => {
    acc.grossCents += record.amounts.grossCents
    acc.netCents += record.amounts.netCents
    acc.wageTaxCents += record.amounts.deductions.wageTaxCents
    acc.socialSecurityCents += record.amounts.deductions.socialSecurityCents
    acc.manualAdjustmentsCents += record.amounts.adjustments.manualAdjustmentsCents
    return acc
  }, { grossCents: 0, netCents: 0, wageTaxCents: 0, socialSecurityCents: 0, manualAdjustmentsCents: 0 })

  const employees = calculations.map(record => ({
    employeeId: record.employee.id,
    name: `${record.employee.firstName} ${record.employee.lastName}`,
    department: record.employee.department,
    netCents: record.amounts.netCents,
    grossCents: record.amounts.grossCents,
    manualAdjustmentsCents: record.amounts.adjustments.manualAdjustmentsCents
  }))

  const createdAt = nowIso()
  const run: PayrollRunRecord = {
    id: `RUN-${crypto.randomUUID()}`,
    period: input.period,
    status: 'draft',
    createdAt,
    createdBy: options?.createdBy ?? 'system',
    paymentDate: input.paymentDate,
    dueDate: input.dueDate,
    note: input.note,
    totals,
    employees,
    history: [
      {
        status: 'draft',
        changedAt: createdAt,
        changedBy: options?.createdBy ?? 'system',
        note: input.note
      }
    ]
  }

  runStore.push(run)
  persist()
  return run
}

export function updatePayrollRunStatus (id: string, status: PayrollRunStatus, options?: { changedBy?: string; note?: string }): PayrollRunRecord | undefined {
  const run = getPayrollRun(id)
  if (!run) return undefined
  run.status = status
  if (options?.note) {
    run.note = options.note
  }
  run.history.push({
    status,
    changedAt: nowIso(),
    changedBy: options?.changedBy ?? 'system',
    note: options?.note
  })
  persist()
  return run
}
