import { Router } from 'express';
import { config } from '../config.js';
import { buildPain001 } from '../services/sepa.js';
import { calculateMonthlyPayroll, HOLIDAY_ALLOWANCE_RATE, SOCIAL_SECURITY_RATE, STATUTORY_INTEREST_RATE } from '../services/netherlandsPayroll.js';
import { listEmployees } from '../services/employeeRegistry.js';
import { listAdjustmentsForMonth } from '../services/adjustmentsLedger.js';
import { createPayrollRun, listPayrollRuns, updatePayrollRunStatus } from '../services/payrollRunLedger.js';
export const payroll = Router();
function centsToEuro(value) {
    return Math.round(value) / 100;
}
function centsToEuroString(value) {
    return centsToEuro(value).toFixed(2);
}
function escapeCsv(value) {
    if (value.includes('"') || value.includes(',') || value.includes('\n')) {
        return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
}
function calculationsForPeriod(month, paymentDate, dueDate) {
    return listEmployees().map(employee => calculateMonthlyPayroll({ employee, month, paymentDate, dueDate }))
        .filter(r => r.employment.proRatedFactor > 0 || r.amounts.allowances.holidayAllowancePaymentCents > 0 || r.amounts.adjustments.outstandingHolidayPayoutCents > 0 || r.amounts.adjustments.manualAdjustmentsCents !== 0);
}
function formatRun(run) {
    return {
        id: run.id,
        period: run.period,
        status: run.status,
        createdAt: run.createdAt,
        createdBy: run.createdBy,
        paymentDate: run.paymentDate ?? null,
        dueDate: run.dueDate ?? null,
        note: run.note ?? null,
        totals: {
            gross: centsToEuro(run.totals.grossCents),
            net: centsToEuro(run.totals.netCents),
            wageTax: centsToEuro(run.totals.wageTaxCents),
            socialSecurity: centsToEuro(run.totals.socialSecurityCents),
            manualAdjustments: centsToEuro(run.totals.manualAdjustmentsCents)
        },
        employees: run.employees.map(e => ({
            employeeId: e.employeeId,
            name: e.name,
            department: e.department,
            net: centsToEuro(e.netCents),
            gross: centsToEuro(e.grossCents),
            manualAdjustments: centsToEuro(e.manualAdjustmentsCents)
        })),
        history: run.history.map(entry => ({
            status: entry.status,
            changedAt: entry.changedAt,
            changedBy: entry.changedBy,
            note: entry.note ?? null
        }))
    };
}
payroll.get('/preview/:month', (req, res) => {
    try {
        const month = req.params.month;
        const paymentDate = typeof req.query.paymentDate === 'string' ? req.query.paymentDate : undefined;
        const dueDate = typeof req.query.dueDate === 'string' ? req.query.dueDate : undefined;
        const calculations = calculationsForPeriod(month, paymentDate, dueDate);
        const totals = calculations.reduce((acc, r) => {
            acc.gross += r.amounts.grossCents;
            acc.net += r.amounts.netCents;
            acc.wageTax += r.amounts.deductions.wageTaxCents;
            acc.socialSecurity += r.amounts.deductions.socialSecurityCents;
            acc.holidayAllowancePayments += r.amounts.allowances.holidayAllowancePaymentCents;
            acc.holidayAccrual += r.amounts.allowances.holidayAccrualCents;
            acc.lateFees += r.amounts.adjustments.latePaymentFeeCents;
            acc.outstandingHoliday += r.amounts.adjustments.outstandingHolidayPayoutCents;
            acc.manualAdjustments += r.amounts.adjustments.manualAdjustmentsCents;
            acc.manualAdjustmentsTaxable += r.amounts.adjustments.manualAdjustmentsTaxableCents;
            return acc;
        }, { gross: 0, net: 0, wageTax: 0, socialSecurity: 0, holidayAllowancePayments: 0, holidayAccrual: 0, lateFees: 0, outstandingHoliday: 0, manualAdjustments: 0, manualAdjustmentsTaxable: 0 });
        const employees = calculations.map(r => ({
            employeeId: r.employee.id,
            name: `${r.employee.firstName} ${r.employee.lastName}`,
            email: r.employee.email,
            department: r.employee.department,
            role: r.employee.role,
            contractType: r.employee.contractType,
            startDate: r.employee.startDate,
            endDate: r.employee.endDate ?? null,
            location: r.employee.location,
            employment: r.employment,
            amounts: {
                gross: centsToEuro(r.amounts.grossCents),
                taxable: centsToEuro(r.amounts.taxableCents),
                net: centsToEuro(r.amounts.netCents),
                allowances: {
                    ruling30: centsToEuro(r.amounts.allowances.ruling30Cents),
                    holidayAccrual: centsToEuro(r.amounts.allowances.holidayAccrualCents),
                    holidayAllowancePayment: centsToEuro(r.amounts.allowances.holidayAllowancePaymentCents),
                    holidayAllowanceDue: centsToEuro(r.amounts.allowances.holidayAllowanceDueCents)
                },
                deductions: {
                    wageTax: centsToEuro(r.amounts.deductions.wageTaxCents),
                    socialSecurity: centsToEuro(r.amounts.deductions.socialSecurityCents)
                },
                adjustments: {
                    outstandingHolidayPayout: centsToEuro(r.amounts.adjustments.outstandingHolidayPayoutCents),
                    latePaymentFee: centsToEuro(r.amounts.adjustments.latePaymentFeeCents),
                    manualAdjustments: centsToEuro(r.amounts.adjustments.manualAdjustmentsCents),
                    manualAdjustmentsBreakdown: {
                        allowances: centsToEuro(r.amounts.adjustments.manualAdjustmentsBreakdown.allowancesCents),
                        deductions: centsToEuro(r.amounts.adjustments.manualAdjustmentsBreakdown.deductionsCents),
                        reimbursements: centsToEuro(r.amounts.adjustments.manualAdjustmentsBreakdown.reimbursementsCents),
                        retro: centsToEuro(r.amounts.adjustments.manualAdjustmentsBreakdown.retroCents)
                    },
                    manualAdjustmentsTaxable: centsToEuro(r.amounts.adjustments.manualAdjustmentsTaxableCents),
                    manualAdjustmentItems: r.amounts.adjustments.manualAdjustmentItems.map(item => ({
                        id: item.id,
                        description: item.description,
                        type: item.type,
                        amount: centsToEuro(item.amountCents),
                        taxable: item.taxable,
                        recurring: item.recurring,
                        effectiveMonth: item.effectiveMonth,
                        endMonth: item.endMonth ?? null,
                        createdAt: item.createdAt,
                        createdBy: item.createdBy
                    }))
                }
            },
            summary: {
                gross: centsToEuro(r.amounts.grossCents),
                holiday: centsToEuro(r.amounts.allowances.holidayAllowancePaymentCents),
                ruling30: centsToEuro(r.amounts.allowances.ruling30Cents),
                taxable: centsToEuro(r.amounts.taxableCents),
                net: centsToEuro(r.amounts.netCents),
                manualAdjustments: centsToEuro(r.amounts.adjustments.manualAdjustmentsCents)
            },
            metadata: r.metadata
        }));
        res.json({
            period: month,
            currency: config.locale.currency,
            statutoryInterestRate: calculations[0]?.metadata.statutoryInterestRate ?? 0.08,
            totals: {
                gross: centsToEuro(totals.gross),
                net: centsToEuro(totals.net),
                wageTax: centsToEuro(totals.wageTax),
                socialSecurity: centsToEuro(totals.socialSecurity),
                holidayAllowancePayments: centsToEuro(totals.holidayAllowancePayments),
                holidayAccrual: centsToEuro(totals.holidayAccrual),
                outstandingHoliday: centsToEuro(totals.outstandingHoliday),
                lateFees: centsToEuro(totals.lateFees),
                manualAdjustments: centsToEuro(totals.manualAdjustments),
                manualAdjustmentsTaxable: centsToEuro(totals.manualAdjustmentsTaxable)
            },
            employees,
            assumptions: {
                holidayAllowanceRate: HOLIDAY_ALLOWANCE_RATE,
                taxYear: 2024,
                socialSecurityRate: SOCIAL_SECURITY_RATE,
                latePaymentInterestRate: calculations[0]?.metadata.statutoryInterestRate ?? STATUTORY_INTEREST_RATE
            },
            adjustments: {
                month,
                items: listAdjustmentsForMonth(month).map(item => ({
                    id: item.id,
                    employeeId: item.employeeId,
                    description: item.description,
                    type: item.type,
                    amount: centsToEuro(item.amountCents),
                    taxable: item.taxable,
                    recurring: item.recurring,
                    effectiveMonth: item.effectiveMonth,
                    endMonth: item.endMonth ?? null
                }))
            }
        });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
payroll.get('/reports/:month.csv', (req, res) => {
    try {
        const month = req.params.month;
        const paymentDate = typeof req.query.paymentDate === 'string' ? req.query.paymentDate : undefined;
        const dueDate = typeof req.query.dueDate === 'string' ? req.query.dueDate : undefined;
        const calculations = calculationsForPeriod(month, paymentDate, dueDate);
        const headers = [
            'Employee ID',
            'Name',
            'Department',
            'Role',
            'Gross EUR',
            'Wage tax EUR',
            'Social security EUR',
            'Holiday allowance EUR',
            'Manual adjustments EUR',
            'Net EUR'
        ];
        const rows = calculations.map(record => [
            record.employee.id,
            `${record.employee.firstName} ${record.employee.lastName}`,
            record.employee.department,
            record.employee.role,
            centsToEuroString(record.amounts.grossCents),
            centsToEuroString(record.amounts.deductions.wageTaxCents),
            centsToEuroString(record.amounts.deductions.socialSecurityCents),
            centsToEuroString(record.amounts.allowances.holidayAllowancePaymentCents),
            centsToEuroString(record.amounts.adjustments.manualAdjustmentsCents),
            centsToEuroString(record.amounts.netCents)
        ].map(value => escapeCsv(String(value))).join(','));
        const csv = [headers.map(h => escapeCsv(h)).join(','), ...rows].join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="payroll-${month}.csv"`);
        res.send(csv);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
payroll.get('/payslip/:month/:employeeId', (req, res) => {
    try {
        const month = req.params.month;
        const employeeId = req.params.employeeId;
        const paymentDate = typeof req.query.paymentDate === 'string' ? req.query.paymentDate : undefined;
        const dueDate = typeof req.query.dueDate === 'string' ? req.query.dueDate : undefined;
        const calculations = calculationsForPeriod(month, paymentDate, dueDate);
        const record = calculations.find(r => r.employee.id === employeeId);
        if (!record) {
            return res.status(404).json({ error: 'Payslip not available for requested employee/month' });
        }
        res.json({
            period: month,
            employee: {
                id: record.employee.id,
                name: `${record.employee.firstName} ${record.employee.lastName}`,
                department: record.employee.department,
                role: record.employee.role,
                iban: record.employee.iban,
                bic: record.employee.bic ?? null
            },
            paymentDate: record.metadata.paymentDate,
            dueDate: record.metadata.paymentDueDate,
            gross: centsToEuro(record.amounts.grossCents),
            taxable: centsToEuro(record.amounts.taxableCents),
            allowances: {
                ruling30: centsToEuro(record.amounts.allowances.ruling30Cents),
                holidayAccrual: centsToEuro(record.amounts.allowances.holidayAccrualCents),
                holidayAllowancePayment: centsToEuro(record.amounts.allowances.holidayAllowancePaymentCents)
            },
            deductions: {
                wageTax: centsToEuro(record.amounts.deductions.wageTaxCents),
                socialSecurity: centsToEuro(record.amounts.deductions.socialSecurityCents)
            },
            adjustments: {
                outstandingHolidayPayout: centsToEuro(record.amounts.adjustments.outstandingHolidayPayoutCents),
                latePaymentFee: centsToEuro(record.amounts.adjustments.latePaymentFeeCents),
                manualAdjustments: centsToEuro(record.amounts.adjustments.manualAdjustmentsCents),
                manualAdjustmentsBreakdown: {
                    allowances: centsToEuro(record.amounts.adjustments.manualAdjustmentsBreakdown.allowancesCents),
                    deductions: centsToEuro(record.amounts.adjustments.manualAdjustmentsBreakdown.deductionsCents),
                    reimbursements: centsToEuro(record.amounts.adjustments.manualAdjustmentsBreakdown.reimbursementsCents),
                    retro: centsToEuro(record.amounts.adjustments.manualAdjustmentsBreakdown.retroCents)
                },
                manualAdjustmentsTaxable: centsToEuro(record.amounts.adjustments.manualAdjustmentsTaxableCents)
            },
            net: centsToEuro(record.amounts.netCents),
            notes: record.metadata.manualAdjustmentsTaxableCents !== 0
                ? `Manual adjustments change taxable base by €${centsToEuroString(record.metadata.manualAdjustmentsTaxableCents)}.`
                : null
        });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
payroll.get('/runs', (_req, res) => {
    const runs = listPayrollRuns().map(formatRun);
    res.json(runs);
});
payroll.post('/runs', (req, res) => {
    const payload = (req.body ?? {});
    const period = typeof payload.period === 'string' ? payload.period : undefined;
    if (!period) {
        return res.status(400).json({ error: 'period is required (YYYY-MM)' });
    }
    const paymentDate = typeof payload.paymentDate === 'string' ? payload.paymentDate : undefined;
    const dueDate = typeof payload.dueDate === 'string' ? payload.dueDate : undefined;
    const note = typeof payload.note === 'string' && payload.note.length > 0 ? payload.note : undefined;
    const actorHeader = req.headers['x-actor'];
    const createdBy = Array.isArray(actorHeader) ? actorHeader[0] : typeof actorHeader === 'string' ? actorHeader : 'system';
    try {
        const run = createPayrollRun({ period, paymentDate, dueDate, note }, { createdBy });
        res.status(201).json(formatRun(run));
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
payroll.patch('/runs/:id/status', (req, res) => {
    const id = req.params.id;
    const payload = (req.body ?? {});
    const status = typeof payload.status === 'string' ? payload.status : undefined;
    if (!status || !['draft', 'reviewed', 'approved'].includes(status)) {
        return res.status(400).json({ error: 'status must be one of draft, reviewed or approved' });
    }
    const note = typeof payload.note === 'string' && payload.note.length > 0 ? payload.note : undefined;
    const actorHeader = req.headers['x-actor'];
    const changedBy = Array.isArray(actorHeader) ? actorHeader[0] : typeof actorHeader === 'string' ? actorHeader : 'system';
    const updated = updatePayrollRunStatus(id, status, { changedBy, note });
    if (!updated) {
        return res.status(404).json({ error: 'Run not found' });
    }
    res.json(formatRun(updated));
});
payroll.post('/sepa/:month', (req, res) => {
    try {
        const month = req.params.month;
        const paymentDate = typeof req.body?.paymentDate === 'string' ? req.body.paymentDate : undefined;
        const dueDate = typeof req.body?.dueDate === 'string' ? req.body.dueDate : undefined;
        const calculations = calculationsForPeriod(month, paymentDate, dueDate)
            .filter(r => r.amounts.netCents > 0);
        const payments = calculations.map(r => ({
            endToEndId: `SAL-${r.employee.id}-${month}`,
            name: `${r.employee.firstName} ${r.employee.lastName}`,
            iban: r.employee.iban,
            bic: r.employee.bic ?? undefined,
            amount: centsToEuro(r.amounts.netCents),
            remittance: r.employment.isLeaver ? `Salary & final payout ${month}` : `Salary ${month}`
        }));
        const xml = buildPain001({ name: config.company.name, iban: config.company.iban, bic: config.company.bic }, payments);
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.send(xml);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
