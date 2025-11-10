import { DummyEmployee, employees as seedEmployees } from '../data/dummy.js'
import { resolveDataPath, readJsonFile, writeJsonFile } from './fileStore.js'

export type PersistedEmployee = DummyEmployee & {
  createdAt: string
  updatedAt: string
}

export type EmployeeAuditEntry = {
  id: string
  employeeId: string
  action: string
  changes?: Record<string, { from: any, to: any }>
  note?: string
  performedBy: string
  timestamp: string
}

const employeesPath = resolveDataPath('employees.json')
const auditPath = resolveDataPath('employee-audit-log.json')

function nowIso (): string {
  return new Date().toISOString()
}

function toPersisted (employee: DummyEmployee): PersistedEmployee {
  const timestamp = nowIso()
  return { ...employee, createdAt: timestamp, updatedAt: timestamp }
}

let employeesStore = readJsonFile<PersistedEmployee[]>(employeesPath, [])
if (employeesStore.length === 0) {
  employeesStore = seedEmployees.map(toPersisted)
  writeJsonFile(employeesPath, employeesStore)
}

let auditStore = readJsonFile<EmployeeAuditEntry[]>(auditPath, [])
if (!Array.isArray(auditStore)) auditStore = []

let sequence = employeesStore.reduce((max, e) => {
  const numeric = parseInt(e.id.replace(/[^0-9]/g, ''), 10)
  return Number.isFinite(numeric) ? Math.max(max, numeric) : max
}, 0)

function generateEmployeeId (): string {
  sequence += 1
  return `E-${sequence.toString().padStart(5, '0')}`
}

function persistEmployees (): void {
  writeJsonFile(employeesPath, employeesStore)
}

function persistAudit (): void {
  writeJsonFile(auditPath, auditStore)
}

export function listEmployees (): PersistedEmployee[] {
  return employeesStore.slice()
}

export function getEmployeeById (id: string): PersistedEmployee | undefined {
  return employeesStore.find(e => e.id === id)
}

export type NewEmployeeInput = Omit<DummyEmployee, 'id'> & { id?: string }

export function addEmployee (input: NewEmployeeInput, options?: { performedBy?: string }): PersistedEmployee {
  const id = input.id ?? generateEmployeeId()
  const timestamp = nowIso()
  const record: PersistedEmployee = { ...input, id, createdAt: timestamp, updatedAt: timestamp }
  employeesStore.push(record)
  persistEmployees()
  recordEmployeeAudit({
    employeeId: record.id,
    action: 'create',
    changes: Object.fromEntries(Object.entries(record).map(([key, value]) => [key, { from: null, to: value }])),
    performedBy: options?.performedBy ?? 'system'
  })
  return record
}

export function updateEmployee (id: string, updates: Partial<DummyEmployee>, options?: { performedBy?: string; note?: string }): PersistedEmployee | undefined {
  const employee = getEmployeeById(id)
  if (!employee) return undefined
  const before = { ...employee }
  Object.assign(employee, updates)
  employee.updatedAt = nowIso()
  persistEmployees()

  const deltaEntries = Object.entries(employee).reduce<Record<string, { from: any, to: any }>>((acc, [key, value]) => {
    const previous = (before as any)[key]
    if (previous !== value) {
      acc[key] = { from: previous, to: value }
    }
    return acc
  }, {})

  if (Object.keys(deltaEntries).length > 0 || options?.note) {
    recordEmployeeAudit({
      employeeId: employee.id,
      action: 'update',
      changes: Object.keys(deltaEntries).length > 0 ? deltaEntries : undefined,
      note: options?.note,
      performedBy: options?.performedBy ?? 'system'
    })
  }

  return employee
}

export function recordEmployeeAudit (entry: {
  employeeId: string
  action: string
  changes?: Record<string, { from: any, to: any }>
  note?: string
  performedBy?: string
}): void {
  const auditEntry: EmployeeAuditEntry = {
    id: `AUD-${(auditStore.length + 1).toString().padStart(5, '0')}`,
    employeeId: entry.employeeId,
    action: entry.action,
    changes: entry.changes,
    note: entry.note,
    performedBy: entry.performedBy ?? 'system',
    timestamp: nowIso()
  }
  auditStore.push(auditEntry)
  persistAudit()
}

export function listEmployeeAudit (employeeId: string): EmployeeAuditEntry[] {
  return auditStore.filter(entry => entry.employeeId === employeeId).sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}
