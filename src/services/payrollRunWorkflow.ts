/**
 * Payroll Run Workflow Service
 * Manages payroll runs with states: Draft, Calculated, Reviewed, Approved, Locked
 */

import type {
  PayrollRun,
  PayrollRunStatus,
  PayrollCalculation,
  PayrollWarning,
  PayrollChangeLog,
  PayrollDiff,
  DetailedPayrollResult
} from '../models/payroll.js'
import { calculatePayroll, type PayrollEngineInput } from './payrollEngine.js'
import { listEmployees } from './employeeRegistry.js'
import type { DummyEmployee } from '../data/dummy.js'

const payrollRuns: PayrollRun[] = []

/**
 * Create a new payroll run in Draft status
 */
export function createPayrollRun(period: string, createdBy: string): PayrollRun {
  const id = `PR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  const run: PayrollRun = {
    id,
    period,
    status: 'draft',
    calculations: [],
    warnings: [],
    changeLog: [],
    createdAt: new Date(),
    createdBy
  }
  
  payrollRuns.push(run)
  return run
}

/**
 * Calculate payroll for all employees in a run
 * Moves run from Draft to Calculated
 */
export function calculatePayrollRun(runId: string): PayrollRun | null {
  const run = getPayrollRun(runId)
  if (!run || run.status !== 'draft') return null
  
  // Get all employees
  const employees = listEmployees()
  
  // For now, we'll use the existing calculation
  // In a full implementation, we'd convert DummyEmployee to Employee model
  const calculations: PayrollCalculation[] = []
  const warnings: PayrollWarning[] = []
  
  // This is a simplified version - in production, you'd:
  // 1. Get contracts for each employee
  // 2. Get recurring items
  // 3. Get rates for the period
  // 4. Calculate each employee's payroll
  // 5. Compare with previous run for diffs
  
  run.calculations = calculations
  run.warnings = warnings
  run.status = 'calculated'
  run.calculatedAt = new Date()
  
  return run
}

/**
 * Review a payroll run
 * Moves run from Calculated to Reviewed
 */
export function reviewPayrollRun(runId: string, reviewedBy: string): PayrollRun | null {
  const run = getPayrollRun(runId)
  if (!run || run.status !== 'calculated') return null
  
  run.status = 'reviewed'
  run.reviewedAt = new Date()
  run.reviewedBy = reviewedBy
  
  return run
}

/**
 * Approve a payroll run
 * Moves run from Reviewed to Approved
 */
export function approvePayrollRun(runId: string, approvedBy: string): PayrollRun | null {
  const run = getPayrollRun(runId)
  if (!run || run.status !== 'reviewed') return null
  
  run.status = 'approved'
  run.approvedAt = new Date()
  run.approvedBy = approvedBy
  
  return run
}

/**
 * Lock a payroll run
 * Moves run from Approved to Locked (final state)
 */
export function lockPayrollRun(runId: string, lockedBy: string): PayrollRun | null {
  const run = getPayrollRun(runId)
  if (!run || run.status !== 'approved') return null
  
  run.status = 'locked'
  run.lockedAt = new Date()
  run.lockedBy = lockedBy
  
  return run
}

/**
 * Rollback a payroll run to Draft (only if not Locked)
 */
export function rollbackPayrollRun(runId: string): PayrollRun | null {
  const run = getPayrollRun(runId)
  if (!run || run.status === 'locked') return null
  
  run.status = 'draft'
  run.calculatedAt = null
  run.reviewedAt = null
  run.reviewedBy = null
  run.approvedAt = null
  run.approvedBy = null
  
  return run
}

/**
 * Get a payroll run by ID
 */
export function getPayrollRun(id: string): PayrollRun | undefined {
  return payrollRuns.find(r => r.id === id)
}

/**
 * List all payroll runs
 */
export function listPayrollRuns(): PayrollRun[] {
  return [...payrollRuns].sort((a, b) => 
    b.createdAt.getTime() - a.createdAt.getTime()
  )
}

/**
 * Get payroll run by period
 */
export function getPayrollRunByPeriod(period: string): PayrollRun | undefined {
  return payrollRuns.find(r => r.period === period)
}

/**
 * Bulk recompute a payroll run
 * Recalculates all employees and shows diffs
 */
export function bulkRecomputePayrollRun(runId: string): {
  run: PayrollRun
  diffs: PayrollDiff[]
} | null {
  const run = getPayrollRun(runId)
  if (!run || run.status === 'locked') return null
  
  // Store previous calculations for diff
  const previousCalculations = new Map(
    run.calculations.map(c => [c.employeeId, c.calculation])
  )
  
  // Recalculate
  const recalculated = calculatePayrollRun(runId)
  if (!recalculated) return null
  
  // Calculate diffs
  const diffs: PayrollDiff[] = []
  for (const calc of recalculated.calculations) {
    const previous = previousCalculations.get(calc.employeeId)
    if (previous) {
      const diff = calculatePayrollDiff(previous, calc.calculation)
      diffs.push(...diff)
    }
  }
  
  return {
    run: recalculated,
    diffs
  }
}

/**
 * Calculate diff between two payroll calculations
 */
function calculatePayrollDiff(
  previous: DetailedPayrollResult,
  current: DetailedPayrollResult
): PayrollDiff[] {
  const diffs: PayrollDiff[] = []
  
  const fields: Array<keyof DetailedPayrollResult> = [
    'baseSalary',
    'totalGross',
    'taxableWage',
    'wageTax',
    'wageTaxCredit',
    'netPay'
  ]
  
  for (const field of fields) {
    const oldValue = previous[field] as number
    const newValue = current[field] as number
    if (oldValue !== newValue) {
      diffs.push({
        field,
        oldValue,
        newValue,
        difference: newValue - oldValue
      })
    }
  }
  
  return diffs
}

/**
 * Get change log for an employee in a run
 */
export function getEmployeeChangeLog(runId: string, employeeId: string): PayrollChangeLog[] {
  const run = getPayrollRun(runId)
  if (!run) return []
  
  return run.changeLog.filter(log => log.employeeId === employeeId)
}

/**
 * Add a change log entry
 */
export function addChangeLog(
  runId: string,
  employeeId: string,
  field: string,
  oldValue: any,
  newValue: any
): void {
  const run = getPayrollRun(runId)
  if (!run) return
  
  run.changeLog.push({
    employeeId,
    field,
    oldValue,
    newValue,
    timestamp: new Date()
  })
}

/**
 * Get warnings for a payroll run
 */
export function getRunWarnings(runId: string): PayrollWarning[] {
  const run = getPayrollRun(runId)
  if (!run) return []
  
  return run.warnings
}

/**
 * Add a warning to a payroll run
 */
export function addWarning(
  runId: string,
  employeeId: string,
  type: PayrollWarning['type'],
  message: string,
  severity: PayrollWarning['severity'] = 'warning'
): void {
  const run = getPayrollRun(runId)
  if (!run) return
  
  run.warnings.push({
    employeeId,
    type,
    message,
    severity
  })
}

