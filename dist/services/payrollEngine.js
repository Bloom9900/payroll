const HOLIDAY_ALLOWANCE_RATE = 0.08;
export function runMonthly(i) {
    const grossMonthly = Math.round(i.annualSalaryCents / 12);
    const holiday = i.holidayAllowanceEligible ? Math.round(grossMonthly * HOLIDAY_ALLOWANCE_RATE) : 0;
    const ruling30 = i.isThirtyPercentRuling ? Math.round(grossMonthly * 0.3) : 0;
    const taxable = grossMonthly - ruling30 + holiday;
    const taxes = Math.round(taxable * 0.25);
    const net = grossMonthly - taxes + holiday;
    return { grossCents: grossMonthly, holidayAllowanceCents: holiday, ruling30Cents: ruling30, taxableCents: taxable, netCents: net };
}
