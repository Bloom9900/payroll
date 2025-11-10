import { Router } from 'express';
import { addAdjustment, listAdjustments, listAdjustmentsForEmployee, listAdjustmentsForMonth, removeAdjustment } from '../services/adjustmentsLedger.js';
import { recordEmployeeAudit } from '../services/employeeRegistry.js';
export const adjustmentsRouter = Router();
adjustmentsRouter.get('/', (req, res) => {
    const employeeId = typeof req.query.employeeId === 'string' ? req.query.employeeId : undefined;
    const month = typeof req.query.month === 'string' ? req.query.month : undefined;
    if (employeeId && month) {
        return res.json(listAdjustmentsForMonth(month).filter(adj => adj.employeeId === employeeId));
    }
    if (employeeId) {
        return res.json(listAdjustmentsForEmployee(employeeId));
    }
    if (month) {
        return res.json(listAdjustmentsForMonth(month));
    }
    res.json(listAdjustments());
});
adjustmentsRouter.post('/', (req, res) => {
    const payload = (req.body ?? {});
    const required = ['employeeId', 'description', 'type', 'amountEuros', 'effectiveMonth'];
    const missing = required.filter(field => !(field in payload) || payload[field] === '' || payload[field] === undefined);
    if (missing.length > 0) {
        return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }
    const amountEuros = Number(payload.amountEuros);
    if (!Number.isFinite(amountEuros)) {
        return res.status(400).json({ error: 'amountEuros must be numeric' });
    }
    const amountCents = Math.round(amountEuros * 100);
    if (amountCents <= 0) {
        return res.status(400).json({ error: 'amountEuros must be greater than zero' });
    }
    const typeInput = String(payload.type);
    const validTypes = ['allowance', 'deduction', 'reimbursement', 'retro'];
    if (!validTypes.includes(typeInput)) {
        return res.status(400).json({ error: `type must be one of ${validTypes.join(', ')}` });
    }
    const recurring = Boolean(payload.recurring);
    const taxable = Boolean(payload.taxable);
    const effectiveMonth = String(payload.effectiveMonth);
    const endMonth = payload.endMonth ? String(payload.endMonth) : null;
    const actorHeader = req.headers['x-actor'];
    const createdBy = Array.isArray(actorHeader) ? actorHeader[0] : typeof actorHeader === 'string' ? actorHeader : 'system';
    const record = addAdjustment({
        employeeId: String(payload.employeeId),
        description: String(payload.description),
        type: typeInput,
        amountCents,
        taxable,
        recurring,
        effectiveMonth,
        endMonth
    }, { createdBy });
    recordEmployeeAudit({
        employeeId: record.employeeId,
        action: 'manual-adjustment-created',
        note: `${record.description} (${record.type})`,
        performedBy: createdBy,
        changes: {
            amountCents: { from: null, to: record.amountCents },
            taxable: { from: null, to: record.taxable },
            recurring: { from: null, to: record.recurring },
            effectiveMonth: { from: null, to: record.effectiveMonth },
            endMonth: { from: null, to: record.endMonth ?? null }
        }
    });
    res.status(201).json(record);
});
adjustmentsRouter.delete('/:id', (req, res) => {
    const id = req.params.id;
    const actorHeader = req.headers['x-actor'];
    const removedBy = Array.isArray(actorHeader) ? actorHeader[0] : typeof actorHeader === 'string' ? actorHeader : 'system';
    const listing = listAdjustments().find(adj => adj.id === id);
    const ok = removeAdjustment(id);
    if (!ok) {
        return res.status(404).json({ error: 'Adjustment not found' });
    }
    if (listing) {
        recordEmployeeAudit({
            employeeId: listing.employeeId,
            action: 'manual-adjustment-removed',
            performedBy: removedBy,
            note: `Removed ${listing.description}`
        });
    }
    res.status(204).send();
});
