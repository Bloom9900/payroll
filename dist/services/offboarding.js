import { getEmployeeById } from './employeeRegistry.js';
export function calculateOffboardingSummary(input) {
    const employee = getEmployeeById(input.employeeId);
    if (!employee)
        return undefined;
    const exitDate = new Date(input.exitDate + 'T00:00:00Z');
    const startDate = new Date(employee.startDate + 'T00:00:00Z');
    if (Number.isNaN(exitDate.getTime())) {
        throw new Error('Invalid exit date');
    }
    if (exitDate.getTime() < startDate.getTime()) {
        throw new Error('Exit date must be on or after the start date');
    }
    const baseMonthlySalary = round2((employee.annualSalaryCents / 100) / 12);
    const tenureMonths = monthsBetween(startDate, exitDate);
    const tenureYears = round2(tenureMonths / 12);
    const noticePay = calculateNoticePay(employee.contractType, baseMonthlySalary, tenureMonths);
    const transitionAllowance = calculateTransitionAllowance(baseMonthlySalary, tenureMonths, input.reason);
    const { unusedVacationPayout, holidayAllowanceTopUp } = calculateVacationPayout(employee, exitDate, input.includeHolidayPayout !== false);
    const totalGrossPayout = round2(noticePay + transitionAllowance + unusedVacationPayout + holidayAllowanceTopUp);
    const annotations = [];
    annotations.push(`Tenure ${tenureMonths} months (${tenureYears} years)`);
    if (transitionAllowance > 0) {
        annotations.push('Includes Dutch statutory transition allowance (1/3 monthly salary per year served).');
    }
    else {
        annotations.push('No transition allowance due to voluntary resignation or insufficient tenure.');
    }
    if (unusedVacationPayout > 0) {
        annotations.push('Includes payout of unused statutory vacation days at last known hourly rate.');
    }
    else {
        annotations.push('No unused vacation days remaining.');
    }
    if (employee.isThirtyPercentRuling) {
        annotations.push('Employee currently under 30% ruling—ensure to deregister with tax authorities.');
    }
    return {
        employeeId: employee.id,
        name: `${employee.firstName} ${employee.lastName}`,
        reason: input.reason,
        exitDate: input.exitDate,
        startDate: employee.startDate,
        tenureMonths,
        tenureYears,
        baseMonthlySalary,
        noticePay,
        transitionAllowance,
        unusedVacationPayout,
        holidayAllowanceTopUp,
        totalGrossPayout,
        annotations
    };
}
function calculateNoticePay(contractType, baseMonthlySalary, tenureMonths) {
    if (contractType === 'contractor')
        return 0;
    if (tenureMonths < 12)
        return round2(baseMonthlySalary / 2);
    if (tenureMonths < 36)
        return round2(baseMonthlySalary);
    return round2(baseMonthlySalary * 2);
}
function calculateTransitionAllowance(baseMonthlySalary, tenureMonths, reason) {
    if (reason === 'resignation')
        return 0;
    if (tenureMonths < 1)
        return 0;
    const monthlyPortion = baseMonthlySalary / 3;
    return round2(monthlyPortion * (tenureMonths / 12));
}
function calculateVacationPayout(employee, exitDate, include) {
    if (!employee || !include) {
        return { unusedVacationPayout: 0, holidayAllowanceTopUp: 0 };
    }
    const yearStart = new Date(Date.UTC(exitDate.getUTCFullYear(), 0, 1));
    const daysElapsed = (exitDate.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24) + 1;
    const yearLength = isLeapYear(exitDate.getUTCFullYear()) ? 366 : 365;
    const accruedDays = (employee.holidayDaysPerYear ?? 0) * (daysElapsed / yearLength) + (employee.carriedOverHolidayDays ?? 0);
    const remainingDays = Math.max(0, accruedDays - (employee.usedHolidayDaysYtd ?? 0));
    if (remainingDays <= 0)
        return { unusedVacationPayout: 0, holidayAllowanceTopUp: 0 };
    const hourly = (employee.annualSalaryCents / 100) / (employee.hoursPerWeek * 52);
    const hoursPerDay = employee.hoursPerWeek / employee.workingDaysPerWeek;
    const payout = remainingDays * hoursPerDay * hourly;
    const allowance = employee.holidayAllowanceEligible ? payout * 0.08 : 0;
    return { unusedVacationPayout: round2(payout), holidayAllowanceTopUp: round2(allowance) };
}
function monthsBetween(start, end) {
    const years = end.getUTCFullYear() - start.getUTCFullYear();
    const months = end.getUTCMonth() - start.getUTCMonth();
    const totalMonths = years * 12 + months;
    const dayAdjustment = (end.getUTCDate() - start.getUTCDate()) / 30;
    return Math.max(0, Math.round((totalMonths + dayAdjustment) * 100) / 100);
}
function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}
function round2(value) {
    return Math.round(value * 100) / 100;
}
