import { DummyEmployee, employees } from '../data/dummy.js'

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

export function addEmployee (input: NewEmployeeInput): DummyEmployee {
  const id = input.id ?? generateEmployeeId()
  const record: DummyEmployee = { ...input, id }
  employees.push(record)
  return record
}

export function updateEmployee (id: string, updates: Partial<DummyEmployee>): DummyEmployee | undefined {
  const employee = getEmployeeById(id)
  if (!employee) return undefined
  Object.assign(employee, updates)
  return employee
}
