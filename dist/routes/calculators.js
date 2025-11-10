import { Router } from 'express';
import { getEmployeeById } from '../services/employeeRegistry.js';
export const calculators = Router();
calculators.get('/termination', (req, res) => {
    const { employeeId, terminationDate, daysPerYear, usedDaysYtd } = req.query;
    if (!employeeId || !terminationDate) {
        return res.status(400).json({ error: 'employeeId and terminationDate required' });
    }
    const emp = getEmployeeById(employeeId);
    if (!emp)
        return res.status(404).json({ error: 'Employee not found' });
    const dpy = daysPerYear ? parseFloat(daysPerYear) : emp.holidayDaysPerYear;
    const used = usedDaysYtd ? parseFloat(usedDaysYtd) : emp.usedHolidayDaysYtd;
    const term = new Date(terminationDate + 'T00:00:00Z');
    const yearStart = new Date(Date.UTC(term.getUTCFullYear(), 0, 1));
    const daysElapsed = (term.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24) + 1;
    const yearLength = term.getUTCFullYear() % 4 === 0 && (term.getUTCFullYear() % 100 !== 0 || term.getUTCFullYear() % 400 === 0) ? 366 : 365;
    const accruedDays = dpy * (daysElapsed / yearLength) + (emp.carriedOverHolidayDays ?? 0);
    const remainingDays = Math.max(0, accruedDays - used);
    const hourly = (emp.annualSalaryCents / 100) / (emp.hoursPerWeek * 52);
    const hoursPerDay = emp.hoursPerWeek / emp.workingDaysPerWeek;
    const payoutGross = remainingDays * hoursPerDay * hourly;
    const allowance = payoutGross * 0.08;
    res.json({
        employeeId: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        inputs: { terminationDate, daysPerYear: dpy, usedDaysYtd: used },
        accruedDays: round2(accruedDays),
        remainingDays: round2(remainingDays),
        carriedOverDays: round2(emp.carriedOverHolidayDays ?? 0),
        hoursPerDay: round2(hoursPerDay),
        hourlyRate: round2(hourly),
        payoutGross: round2(payoutGross),
        holidayAllowance8pct: round2(allowance),
        totalGross: round2(payoutGross + allowance)
    });
});
function round2(n) { return Math.round(n * 100) / 100; }
