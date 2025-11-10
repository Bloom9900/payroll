import { getEmployeeById } from './employees.js'

function toDate (value) {
  if (!value) throw new Error('Termination date is required')
  return new Date(value + 'T00:00:00Z')
}

function round2 (n) {
  return Math.round(n * 100) / 100
}

export function calculateTerminationPayout ({ employeeId, employee, terminationDate, daysPerYear, usedDaysYtd }) {
  const record = employee ?? getEmployeeById(employeeId)
  if (!record) throw new Error('Employee not found')
  const term = toDate(terminationDate)

  const dpy = Number.isFinite(daysPerYear) ? Number(daysPerYear) : record.holidayDaysPerYear
  const used = Number.isFinite(usedDaysYtd) ? Number(usedDaysYtd) : record.usedHolidayDaysYtd

  const yearStart = new Date(Date.UTC(term.getUTCFullYear(), 0, 1))
  const daysElapsed = (term.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24) + 1
  const yearLength = term.getUTCFullYear() % 4 === 0 && (term.getUTCFullYear() % 100 !== 0 || term.getUTCFullYear() % 400 === 0) ? 366 : 365

  const accruedDays = dpy * (daysElapsed / yearLength) + (record.carriedOverHolidayDays ?? 0)
  const remainingDays = Math.max(0, accruedDays - used)

  const hourly = (record.annualSalaryCents / 100) / (record.hoursPerWeek * 52)
  const hoursPerDay = record.hoursPerWeek / record.workingDaysPerWeek
  const payoutGross = remainingDays * hoursPerDay * hourly
  const allowance = payoutGross * 0.08

  return {
    employeeId: record.id,
    name: `${record.firstName} ${record.lastName}`,
    inputs: {
      terminationDate,
      daysPerYear: dpy,
      usedDaysYtd: used
    },
    accruedDays: round2(accruedDays),
    remainingDays: round2(remainingDays),
    carriedOverDays: round2(record.carriedOverHolidayDays ?? 0),
    hoursPerDay: round2(hoursPerDay),
    hourlyRate: round2(hourly),
    payoutGross: round2(payoutGross),
    holidayAllowance8pct: round2(allowance),
    totalGross: round2(payoutGross + allowance)
  }
}
