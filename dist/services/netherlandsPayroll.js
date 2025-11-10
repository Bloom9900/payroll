import { summarizeAdjustmentsForEmployeeMonth } from './adjustmentsLedger.js';
export const HOLIDAY_ALLOWANCE_RATE = 0.08;
export const STATUTORY_INTEREST_RATE = 0.08;
export const SOCIAL_SECURITY_RATE = 0.2775;
const SOCIAL_SECURITY_CEILING_CENTS = 3714900;
const TAX_BRACKETS_2024 = [
    { limit: 3714900, rate: 0.3697 },
    { limit: 7551800, rate: 0.495 },
    { limit: Number.POSITIVE_INFINITY, rate: 0.495 }
];
function monthWindow(month) {
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10) - 1;
    if (!Number.isFinite(year) || !Number.isFinite(m) || m < 0 || m > 11) {
        throw new Error(`Invalid month format. Expected YYYY-MM received ${month}`);
    }
    const start = new Date(Date.UTC(year, m, 1));
    const end = new Date(Date.UTC(year, m + 1, 0));
    return { start, end };
}
function toDate(value) {
    if (!value)
        return undefined;
    return new Date(value + 'T00:00:00Z');
}
function diffDaysInclusive(start, end) {
    const ms = end.getTime() - start.getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}
function progressiveTax(amountCents) {
    let remaining = Math.max(0, amountCents);
    let taxed = 0;
    let floor = 0;
    for (const bracket of TAX_BRACKETS_2024) {
        if (remaining <= 0)
            break;
        const span = Math.min(remaining, bracket.limit - floor);
        if (span > 0) {
            taxed += span * bracket.rate;
            remaining -= span;
        }
        floor = bracket.limit;
    }
    return Math.round(taxed);
}
function calculateLatePaymentFee(baseAmountCents, due, paid) {
    const daysLate = Math.max(0, Math.floor((paid.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
    if (daysLate <= 0)
        return 0;
    const dailyRate = STATUTORY_INTEREST_RATE / 365;
    return Math.round(baseAmountCents * dailyRate * daysLate);
}
function calculateOutstandingHolidayPayout(employee, terminationDate) {
    const yearStart = new Date(Date.UTC(terminationDate.getUTCFullYear(), 0, 1));
    const daysElapsed = diffDaysInclusive(yearStart, terminationDate);
    const yearLength = terminationDate.getUTCFullYear() % 4 === 0 && (terminationDate.getUTCFullYear() % 100 !== 0 || terminationDate.getUTCFullYear() % 400 === 0) ? 366 : 365;
    const accruedDays = employee.holidayDaysPerYear * (daysElapsed / yearLength) + (employee.carriedOverHolidayDays ?? 0);
    const remainingDays = Math.max(0, accruedDays - employee.usedHolidayDaysYtd);
    const hourlyRateCents = employee.annualSalaryCents / (employee.hoursPerWeek * 52);
    const hoursPerDay = employee.hoursPerWeek / employee.workingDaysPerWeek;
    const payoutCents = Math.round(remainingDays * hoursPerDay * hourlyRateCents);
    return { remainingDays, payoutCents };
}
function defaultPaymentDueDate(window) {
    return window.end;
}
export function calculateMonthlyPayroll(input) {
    const { employee, month } = input;
    const window = monthWindow(month);
    const employmentStart = toDate(employee.startDate);
    const employmentEnd = toDate(employee.endDate ?? undefined);
    const monthStart = window.start;
    const monthEnd = window.end;
    const activeStart = employmentStart && employmentStart > monthStart ? employmentStart : monthStart;
    const activeEnd = employmentEnd && employmentEnd < monthEnd ? employmentEnd : monthEnd;
    let workedDays = 0;
    let isActive = false;
    if (employmentStart && activeStart <= monthEnd && (!employmentEnd || employmentEnd >= monthStart)) {
        if (activeStart <= activeEnd) {
            workedDays = diffDaysInclusive(activeStart, activeEnd);
            isActive = true;
        }
    }
    const unpaidLeaveDays = Math.min(employee.unpaidLeaveDaysCurrentMonth, workedDays);
    const effectiveWorkedDays = Math.max(0, workedDays - unpaidLeaveDays);
    const totalDaysInMonth = diffDaysInclusive(monthStart, monthEnd);
    const proRatedFactor = totalDaysInMonth > 0 ? Math.max(0, Math.min(1, effectiveWorkedDays / totalDaysInMonth)) : 0;
    const grossCents = Math.round(employee.annualSalaryCents * proRatedFactor / 12);
    const ruling30AnnualCents = employee.isThirtyPercentRuling ? Math.round(employee.annualSalaryCents * 0.3) : 0;
    const ruling30Cents = Math.round(ruling30AnnualCents / 12 * proRatedFactor);
    const annualHolidayAccrualCents = employee.holidayAllowanceEligible ? Math.round(employee.annualSalaryCents * HOLIDAY_ALLOWANCE_RATE) : 0;
    const holidayAccrualCents = employee.holidayAllowanceEligible ? Math.round(annualHolidayAccrualCents / 12 * proRatedFactor) : 0;
    const annualTaxableBaseCents = employee.annualSalaryCents + annualHolidayAccrualCents - ruling30AnnualCents;
    const annualTaxCents = progressiveTax(annualTaxableBaseCents);
    const wageTaxCents = Math.round(annualTaxCents / 12 * proRatedFactor);
    const annualSocialSecurityBase = Math.min(annualTaxableBaseCents, SOCIAL_SECURITY_CEILING_CENTS);
    const annualSocialSecurityCents = Math.round(annualSocialSecurityBase * SOCIAL_SECURITY_RATE);
    const socialSecurityCents = Math.round(annualSocialSecurityCents / 12 * proRatedFactor);
    const baseNetCents = grossCents - wageTaxCents - socialSecurityCents;
    const holidayAllowanceDueCents = Math.max(0, employee.holidayAllowanceAccruedCentsYtd + holidayAccrualCents - employee.holidayAllowancePaidCentsYtd);
    const isLeaver = Boolean(employmentEnd && employmentEnd.getUTCFullYear() === monthEnd.getUTCFullYear() && employmentEnd.getUTCMonth() === monthEnd.getUTCMonth());
    const holidayAllowancePaymentCents = isLeaver ? holidayAllowanceDueCents : 0;
    let outstandingHolidayPayoutCents = 0;
    if (isLeaver && employmentEnd) {
        const { payoutCents } = calculateOutstandingHolidayPayout(employee, employmentEnd);
        outstandingHolidayPayoutCents = payoutCents;
    }
    const netBeforeFeeCents = baseNetCents + holidayAllowancePaymentCents + outstandingHolidayPayoutCents;
    const dueDateStr = input.dueDate ?? monthEnd.toISOString().slice(0, 10);
    const paymentDateStr = input.paymentDate ?? dueDateStr;
    const dueDate = toDate(dueDateStr) ?? defaultPaymentDueDate(window);
    const paymentDate = toDate(paymentDateStr) ?? dueDate;
    const latePaymentFeeCents = calculateLatePaymentFee(netBeforeFeeCents, dueDate, paymentDate);
    const manualAdjustments = summarizeAdjustmentsForEmployeeMonth(employee.id, month);
    const netCents = netBeforeFeeCents + latePaymentFeeCents + manualAdjustments.netCents;
    const taxableCents = Math.max(0, grossCents + holidayAllowancePaymentCents + outstandingHolidayPayoutCents + holidayAccrualCents - ruling30Cents);
    return {
        employee,
        month,
        employment: {
            proRatedFactor,
            workedDays,
            totalDaysInMonth,
            unpaidLeaveDays,
            isActive,
            isLeaver
        },
        amounts: {
            grossCents,
            taxableCents,
            allowances: {
                ruling30Cents,
                holidayAccrualCents,
                holidayAllowancePaymentCents,
                holidayAllowanceDueCents
            },
            deductions: {
                wageTaxCents,
                socialSecurityCents
            },
            adjustments: {
                outstandingHolidayPayoutCents,
                latePaymentFeeCents,
                manualAdjustmentsCents: manualAdjustments.netCents,
                manualAdjustmentsTaxableCents: manualAdjustments.taxableCents,
                manualAdjustmentsBreakdown: manualAdjustments.breakdown,
                manualAdjustmentItems: manualAdjustments.items
            },
            netCents
        },
        metadata: {
            paymentDueDate: dueDate.toISOString().slice(0, 10),
            paymentDate: paymentDate.toISOString().slice(0, 10),
            statutoryInterestRate: STATUTORY_INTEREST_RATE,
            terminationDate: employee.endDate ?? null,
            manualAdjustmentsTaxableCents: manualAdjustments.taxableCents
        }
    };
}
