import { DummyEmployee } from '../data/dummy.js'

export type EmployeeChange = {
  id: string
  employeeId: string
  changeType: 'created' | 'updated' | 'deleted'
  field?: string
  oldValue?: any
  newValue?: any
  changes: Record<string, { old: any; new: any }>
  changedBy?: string
  changedAt: Date
}

const employeeHistory: EmployeeChange[] = []

export function logEmployeeChange(
  employeeId: string,
  changeType: 'created' | 'updated' | 'deleted',
  changes: Record<string, { old: any; new: any }>,
  changedBy?: string
): void {
  const change: EmployeeChange = {
    id: `CHG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    employeeId,
    changeType,
    changes,
    changedBy,
    changedAt: new Date()
  }

  employeeHistory.push(change)
}

export function getEmployeeHistory(employeeId: string): EmployeeChange[] {
  return employeeHistory
    .filter(change => change.employeeId === employeeId)
    .sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime())
}

export function getAllEmployeeHistory(limit: number = 100): EmployeeChange[] {
  return [...employeeHistory]
    .sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime())
    .slice(0, limit)
}

export function getRecentEmployeeChanges(limit: number = 50): EmployeeChange[] {
  return getAllEmployeeHistory(limit)
}

export function compareEmployees(oldEmployee: DummyEmployee, newEmployee: DummyEmployee): Record<string, { old: any; new: any }> {
  const changes: Record<string, { old: any; new: any }> = {}

  const fields: (keyof DummyEmployee)[] = [
    'firstName', 'lastName', 'email', 'startDate', 'endDate',
    'iban', 'bic', 'annualSalaryCents', 'hoursPerWeek', 'workingDaysPerWeek',
    'role', 'department', 'location', 'contractType',
    'isThirtyPercentRuling', 'holidayAllowanceEligible',
    'holidayDaysPerYear', 'carriedOverHolidayDays', 'usedHolidayDaysYtd',
    'unpaidLeaveDaysCurrentMonth', 'holidayAllowanceAccruedCentsYtd',
    'holidayAllowancePaidCentsYtd', 'pendingExpenseClaimsCents'
  ]

  for (const field of fields) {
    if (oldEmployee[field] !== newEmployee[field]) {
      changes[field] = {
        old: oldEmployee[field],
        new: newEmployee[field]
      }
    }
  }

  return changes
}

