import { DummyEmployee, employees } from '../data/dummy.js'
import { logEmployeeChange, compareEmployees } from './employeeHistory.js'
import { logAuditEvent } from './audit.js'

let sequence = employees.reduce((max, e) => {
  const numeric = parseInt(e.id.replace(/[^0-9]/g, ''), 10)
  return Number.isFinite(numeric) ? Math.max(max, numeric) : max
}, 0)

function generateEmployeeId (): string {
  sequence += 1
  return `E-${sequence.toString().padStart(5, '0')}`
}

export function listEmployees (): DummyEmployee[] {
  return employees
}

export function getEmployeeById (id: string): DummyEmployee | undefined {
  return employees.find(e => e.id === id)
}

export type NewEmployeeInput = Omit<DummyEmployee, 'id'> & { id?: string }

export function addEmployee (input: NewEmployeeInput, userId?: string): DummyEmployee {
  const id = input.id ?? generateEmployeeId()
  const record: DummyEmployee = { ...input, id }
  employees.push(record)
  
  // Log employee creation
  logEmployeeChange(id, 'created', {}, userId)
  logAuditEvent('employee_created', {
    employeeId: id,
    name: `${record.firstName} ${record.lastName}`,
    email: record.email
  }, userId)
  
  return record
}

export function updateEmployee (id: string, updates: Partial<DummyEmployee>, userId?: string): DummyEmployee | undefined {
  const employee = getEmployeeById(id)
  if (!employee) return undefined
  
  // Create a copy to compare
  const oldEmployee = { ...employee }
  
  // Apply updates
  Object.assign(employee, updates)
  
  // Log changes
  const changes = compareEmployees(oldEmployee, employee)
  if (Object.keys(changes).length > 0) {
    logEmployeeChange(id, 'updated', changes, userId)
    logAuditEvent('employee_updated', {
      employeeId: id,
      changes: Object.keys(changes)
    }, userId)
  }
  
  return employee
}

export function deleteEmployee (id: string, userId?: string): boolean {
  const index = employees.findIndex(e => e.id === id)
  if (index === -1) return false
  
  const employee = employees[index]
  employees.splice(index, 1)
  
  // Log employee deletion
  logEmployeeChange(id, 'deleted', {}, userId)
  logAuditEvent('employee_deleted', {
    employeeId: id,
    name: `${employee.firstName} ${employee.lastName}`
  }, userId)
  
  return true
}
