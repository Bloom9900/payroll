import { employees } from '../data/dummy.js';
let sequence = employees.reduce((max, e) => {
    const numeric = parseInt(e.id.replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
}, 0);
function generateEmployeeId() {
    sequence += 1;
    return `E-${sequence.toString().padStart(5, '0')}`;
}
export function listEmployees() {
    return employees;
}
export function getEmployeeById(id) {
    return employees.find(e => e.id === id);
}
export function addEmployee(input) {
    const id = input.id ?? generateEmployeeId();
    const record = { ...input, id };
    employees.push(record);
    return record;
}
export function updateEmployee(id, updates) {
    const employee = getEmployeeById(id);
    if (!employee)
        return undefined;
    Object.assign(employee, updates);
    return employee;
}
