import { employees as seedEmployees } from '../data/dummy.js';
import { resolveDataPath, readJsonFile, writeJsonFile } from './fileStore.js';
const employeesPath = resolveDataPath('employees.json');
const auditPath = resolveDataPath('employee-audit-log.json');
function nowIso() {
    return new Date().toISOString();
}
function toPersisted(employee) {
    const timestamp = nowIso();
    return { ...employee, createdAt: timestamp, updatedAt: timestamp };
}
let employeesStore = readJsonFile(employeesPath, []);
if (employeesStore.length === 0) {
    employeesStore = seedEmployees.map(toPersisted);
    writeJsonFile(employeesPath, employeesStore);
}
let auditStore = readJsonFile(auditPath, []);
if (!Array.isArray(auditStore))
    auditStore = [];
let sequence = employeesStore.reduce((max, e) => {
    const numeric = parseInt(e.id.replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
}, 0);
function generateEmployeeId() {
    sequence += 1;
    return `E-${sequence.toString().padStart(5, '0')}`;
}
function persistEmployees() {
    writeJsonFile(employeesPath, employeesStore);
}
function persistAudit() {
    writeJsonFile(auditPath, auditStore);
}
export function listEmployees() {
    return employeesStore.slice();
}
export function getEmployeeById(id) {
    return employeesStore.find(e => e.id === id);
}
export function addEmployee(input, options) {
    const id = input.id ?? generateEmployeeId();
    const timestamp = nowIso();
    const record = { ...input, id, createdAt: timestamp, updatedAt: timestamp };
    employeesStore.push(record);
    persistEmployees();
    recordEmployeeAudit({
        employeeId: record.id,
        action: 'create',
        changes: Object.fromEntries(Object.entries(record).map(([key, value]) => [key, { from: null, to: value }])),
        performedBy: options?.performedBy ?? 'system'
    });
    return record;
}
export function updateEmployee(id, updates, options) {
    const employee = getEmployeeById(id);
    if (!employee)
        return undefined;
    const before = { ...employee };
    Object.assign(employee, updates);
    employee.updatedAt = nowIso();
    persistEmployees();
    const deltaEntries = Object.entries(employee).reduce((acc, [key, value]) => {
        const previous = before[key];
        if (previous !== value) {
            acc[key] = { from: previous, to: value };
        }
        return acc;
    }, {});
    if (Object.keys(deltaEntries).length > 0 || options?.note) {
        recordEmployeeAudit({
            employeeId: employee.id,
            action: 'update',
            changes: Object.keys(deltaEntries).length > 0 ? deltaEntries : undefined,
            note: options?.note,
            performedBy: options?.performedBy ?? 'system'
        });
    }
    return employee;
}
export function recordEmployeeAudit(entry) {
    const auditEntry = {
        id: `AUD-${(auditStore.length + 1).toString().padStart(5, '0')}`,
        employeeId: entry.employeeId,
        action: entry.action,
        changes: entry.changes,
        note: entry.note,
        performedBy: entry.performedBy ?? 'system',
        timestamp: nowIso()
    };
    auditStore.push(auditEntry);
    persistAudit();
}
export function listEmployeeAudit(employeeId) {
    return auditStore.filter(entry => entry.employeeId === employeeId).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
