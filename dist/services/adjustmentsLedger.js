import crypto from 'node:crypto';
import { resolveDataPath, readJsonFile, writeJsonFile } from './fileStore.js';
const adjustmentsPath = resolveDataPath('adjustments.json');
function nowIso() {
    return new Date().toISOString();
}
function createSeedAdjustments() {
    const timestamp = nowIso();
    return [
        {
            id: crypto.randomUUID(),
            employeeId: 'E-10001',
            description: 'Commuter allowance',
            type: 'allowance',
            amountCents: 15000,
            taxable: true,
            recurring: true,
            effectiveMonth: '2025-01',
            endMonth: null,
            createdAt: timestamp,
            createdBy: 'system'
        },
        {
            id: crypto.randomUUID(),
            employeeId: 'E-10004',
            description: 'One-off transition support',
            type: 'retro',
            amountCents: 450000,
            taxable: true,
            recurring: false,
            effectiveMonth: '2025-03',
            endMonth: '2025-03',
            createdAt: timestamp,
            createdBy: 'system'
        }
    ];
}
let adjustmentsStore = readJsonFile(adjustmentsPath, []);
if (!Array.isArray(adjustmentsStore) || adjustmentsStore.length === 0) {
    adjustmentsStore = createSeedAdjustments();
    writeJsonFile(adjustmentsPath, adjustmentsStore);
}
function persist() {
    writeJsonFile(adjustmentsPath, adjustmentsStore);
}
function monthKey(value) {
    const [year, month] = value.split('-').map(part => parseInt(part, 10));
    return year * 12 + (month - 1);
}
function isActiveForMonth(record, month) {
    try {
        const target = monthKey(month);
        const start = monthKey(record.effectiveMonth);
        const end = record.endMonth ? monthKey(record.endMonth) : undefined;
        if (target < start)
            return false;
        if (end !== undefined && target > end)
            return false;
        return true;
    }
    catch (err) {
        console.error('Unable to evaluate adjustment window', err);
        return false;
    }
}
export function listAdjustments() {
    return adjustmentsStore.slice().sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth));
}
export function listAdjustmentsForEmployee(employeeId) {
    return adjustmentsStore.filter(adj => adj.employeeId === employeeId);
}
export function listAdjustmentsForMonth(month) {
    return adjustmentsStore.filter(adj => isActiveForMonth(adj, month));
}
export function addAdjustment(input, options) {
    const record = {
        ...input,
        id: crypto.randomUUID(),
        createdAt: nowIso(),
        createdBy: options?.createdBy ?? 'system'
    };
    adjustmentsStore.push(record);
    persist();
    return record;
}
export function removeAdjustment(id) {
    const index = adjustmentsStore.findIndex(adj => adj.id === id);
    if (index === -1)
        return false;
    adjustmentsStore.splice(index, 1);
    persist();
    return true;
}
export function summarizeAdjustmentsForEmployeeMonth(employeeId, month) {
    const items = listAdjustmentsForMonth(month).filter(adj => adj.employeeId === employeeId);
    if (items.length === 0) {
        return {
            netCents: 0,
            taxableCents: 0,
            breakdown: {
                allowancesCents: 0,
                deductionsCents: 0,
                reimbursementsCents: 0,
                retroCents: 0
            },
            items: []
        };
    }
    let netCents = 0;
    let taxableCents = 0;
    const breakdown = {
        allowancesCents: 0,
        deductionsCents: 0,
        reimbursementsCents: 0,
        retroCents: 0
    };
    for (const item of items) {
        switch (item.type) {
            case 'allowance':
                breakdown.allowancesCents += item.amountCents;
                netCents += item.amountCents;
                if (item.taxable)
                    taxableCents += item.amountCents;
                break;
            case 'retro':
                breakdown.retroCents += item.amountCents;
                netCents += item.amountCents;
                if (item.taxable)
                    taxableCents += item.amountCents;
                break;
            case 'reimbursement':
                breakdown.reimbursementsCents += item.amountCents;
                netCents += item.amountCents;
                break;
            case 'deduction':
                breakdown.deductionsCents += item.amountCents;
                netCents -= item.amountCents;
                if (item.taxable)
                    taxableCents -= item.amountCents;
                break;
            default:
                break;
        }
    }
    return {
        netCents,
        taxableCents,
        breakdown,
        items
    };
}
