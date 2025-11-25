import { DummyEmployee } from '../data/dummy.js'
import {
  getTaxConfiguration,
  calculateProgressiveTax,
  calculateWageTaxCredit,
  checkMinimumWageCompliance,
  type TaxConfiguration
} from './taxConfiguration.js'
import { calculatePensionContribution, getPensionProvider } from './pension.js'
import { calculateHealthInsurance, getHealthInsuranceProvider } from './healthInsurance.js'

export const HOLIDAY_ALLOWANCE_RATE = 0.08
export const STATUTORY_INTEREST_RATE = 0.08

export type PayrollCalculationInput = {
  employee: DummyEmployee
  month: string
  paymentDate?: string
  dueDate?: string
}

export type PayrollCalculationResult = {
  employee: DummyEmployee
  month: string
  employment: {
    proRatedFactor: number
    workedDays: number
    totalDaysInMonth: number
    unpaidLeaveDays: number
    isActive: boolean
    isLeaver: boolean
  }
  amounts: {
    grossCents: number
    taxableCents: number
    allowances: {
      ruling30Cents: number
      holidayAccrualCents: number
      holidayAllowancePaymentCents: number
      holidayAllowanceDueCents: number
    }
    deductions: {
      wageTaxCents: number
      wageTaxCreditCents: number
      socialSecurityCents: number
      socialSecurityBreakdown: {
        aowCents: number
        anwCents: number
        wlzCents: number
        wwCents: number
        wiaCents: number
      }
      pensionEmployeeCents: number
      healthInsuranceEmployeeCents: number
    }
    employerCosts: {
      pensionEmployerCents: number
      healthInsuranceEmployerCents: number
      zvwEmployerCents: number
      totalEmployerCostsCents: number
    }
    adjustments: {
      outstandingHolidayPayoutCents: number
      latePaymentFeeCents: number
    }
    netCents: number
  }
  compliance: {
    minimumWage: {
      compliant: boolean
      requiredCents: number
      actualCents: number
      shortfallCents: number
    }
  }
  metadata: {
    paymentDueDate: string
    paymentDate: string
    statutoryInterestRate: number
    terminationDate?: string | null
    taxConfigurationPeriod: string
    pensionProvider?: string
    healthInsuranceProvider?: string
  }
}

type MonthWindow = { start: Date, end: Date }

function monthWindow (month: string): MonthWindow {
  const [yearStr, monthStr] = month.split('-')
  const year = parseInt(yearStr, 10)
  const m = parseInt(monthStr, 10) - 1
  if (!Number.isFinite(year) || !Number.isFinite(m) || m < 0 || m > 11) {
    throw new Error(`Invalid month format. Expected YYYY-MM received ${month}`)
  }
  const start = new Date(Date.UTC(year, m, 1))
  const end = new Date(Date.UTC(year, m + 1, 0))
  return { start, end }
}

function toDate (value: string | null | undefined): Date | undefined {
  if (!value) return undefined
  return new Date(value + 'T00:00:00Z')
}

function diffDaysInclusive (start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1
}

// Removed - now using calculateProgressiveTax from taxConfiguration

function calculateLatePaymentFee (baseAmountCents: number, due: Date, paid: Date): number {
  const daysLate = Math.max(0, Math.floor((paid.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)))
  if (daysLate <= 0) return 0
  const dailyRate = STATUTORY_INTEREST_RATE / 365
  return Math.round(baseAmountCents * dailyRate * daysLate)
}

function calculateOutstandingHolidayPayout (employee: DummyEmployee, terminationDate: Date) {
  const yearStart = new Date(Date.UTC(terminationDate.getUTCFullYear(), 0, 1))
  const daysElapsed = diffDaysInclusive(yearStart, terminationDate)
  const yearLength = terminationDate.getUTCFullYear() % 4 === 0 && (terminationDate.getUTCFullYear() % 100 !== 0 || terminationDate.getUTCFullYear() % 400 === 0) ? 366 : 365
  const accruedDays = employee.holidayDaysPerYear * (daysElapsed / yearLength) + (employee.carriedOverHolidayDays ?? 0)
  const remainingDays = Math.max(0, accruedDays - employee.usedHolidayDaysYtd)
  const hourlyRateCents = employee.annualSalaryCents / (employee.hoursPerWeek * 52)
  const hoursPerDay = employee.hoursPerWeek / employee.workingDaysPerWeek
  const payoutCents = Math.round(remainingDays * hoursPerDay * hourlyRateCents)
  return { remainingDays, payoutCents }
}

function defaultPaymentDueDate (window: MonthWindow): Date {
  return window.end
}

export function calculateMonthlyPayroll (input: PayrollCalculationInput): PayrollCalculationResult {
  const { employee, month } = input
  const window = monthWindow(month)
  const employmentStart = toDate(employee.startDate)
  const employmentEnd = toDate(employee.endDate ?? undefined)

  // Get tax configuration for the period
  const taxConfig = getTaxConfiguration(month)

  const monthStart = window.start
  const monthEnd = window.end

  const activeStart = employmentStart && employmentStart > monthStart ? employmentStart : monthStart
  const activeEnd = employmentEnd && employmentEnd < monthEnd ? employmentEnd : monthEnd

  let workedDays = 0
  let isActive = false
  if (employmentStart && activeStart <= monthEnd && (!employmentEnd || employmentEnd >= monthStart)) {
    if (activeStart <= activeEnd) {
      workedDays = diffDaysInclusive(activeStart, activeEnd)
      isActive = true
    }
  }

  const unpaidLeaveDays = Math.min(employee.unpaidLeaveDaysCurrentMonth, workedDays)
  const effectiveWorkedDays = Math.max(0, workedDays - unpaidLeaveDays)
  const totalDaysInMonth = diffDaysInclusive(monthStart, monthEnd)
  const proRatedFactor = totalDaysInMonth > 0 ? Math.max(0, Math.min(1, effectiveWorkedDays / totalDaysInMonth)) : 0

  // Calculate gross salary
  const grossCents = Math.round(employee.annualSalaryCents * proRatedFactor / 12)

  // Check minimum wage compliance
  const minimumWageCheck = checkMinimumWageCompliance(grossCents, employee.hoursPerWeek, taxConfig)

  // 30% ruling calculation
  const ruling30AnnualCents = employee.isThirtyPercentRuling ? Math.round(employee.annualSalaryCents * 0.3) : 0
  const ruling30Cents = Math.round(ruling30AnnualCents / 12 * proRatedFactor)

  // Holiday allowance (8% accrual)
  const annualHolidayAccrualCents = employee.holidayAllowanceEligible ? Math.round(employee.annualSalaryCents * HOLIDAY_ALLOWANCE_RATE) : 0
  const holidayAccrualCents = employee.holidayAllowanceEligible ? Math.round(annualHolidayAccrualCents / 12 * proRatedFactor) : 0

  // Calculate taxable base (gross + holiday allowance - 30% ruling)
  const annualTaxableBaseCents = employee.annualSalaryCents + annualHolidayAccrualCents - ruling30AnnualCents
  const monthlyTaxableBaseCents = Math.round(annualTaxableBaseCents / 12 * proRatedFactor)

  // Calculate wage tax using progressive tax brackets
  const annualTaxCents = calculateProgressiveTax(annualTaxableBaseCents, taxConfig.taxBrackets)
  const wageTaxCents = Math.round(annualTaxCents / 12 * proRatedFactor)

  // Calculate wage tax credit (heffingskorting)
  const annualWageTaxCreditCents = calculateWageTaxCredit(annualTaxableBaseCents, taxConfig)
  const wageTaxCreditCents = Math.round(annualWageTaxCreditCents / 12 * proRatedFactor)

  // Calculate social security contributions with detailed breakdown
  const annualSocialSecurityBase = Math.min(annualTaxableBaseCents, taxConfig.socialSecurityCeilingCents)
  const monthlySocialSecurityBase = Math.round(annualSocialSecurityBase / 12 * proRatedFactor)
  
  const socialSecurityBreakdown = {
    aowCents: Math.round(monthlySocialSecurityBase * taxConfig.socialSecurityRates.aow),
    anwCents: Math.round(monthlySocialSecurityBase * taxConfig.socialSecurityRates.anw),
    wlzCents: Math.round(monthlySocialSecurityBase * taxConfig.socialSecurityRates.wlz),
    wwCents: Math.round(monthlySocialSecurityBase * taxConfig.socialSecurityRates.ww),
    wiaCents: Math.round(monthlySocialSecurityBase * taxConfig.socialSecurityRates.wia)
  }
  const socialSecurityCents = Math.round(monthlySocialSecurityBase * taxConfig.socialSecurityRates.total)

  // Calculate pension contributions
  const pensionCalculation = calculatePensionContribution(
    employee,
    grossCents,
    taxConfig.pensionBaseRate,
    taxConfig.pensionBaseRate
  )
  const pensionEmployeeCents = pensionCalculation.employeeContribution
  const pensionEmployerCents = pensionCalculation.employerContribution

  // Calculate health insurance
  const healthInsuranceCalculation = calculateHealthInsurance(employee)
  const healthInsuranceEmployeeCents = healthInsuranceCalculation.employeePremium
  const healthInsuranceEmployerCents = healthInsuranceCalculation.employerContribution

  // Calculate ZVW (health insurance employer contribution) - separate from health insurance premium
  // ZVW is calculated on gross salary
  const zvwEmployerCents = Math.round(grossCents * taxConfig.healthInsuranceEmployerRate)

  // Calculate net salary
  const baseNetCents = grossCents 
    - wageTaxCents 
    + wageTaxCreditCents 
    - socialSecurityCents 
    - pensionEmployeeCents 
    - healthInsuranceEmployeeCents

  // Holiday allowance calculations
  const holidayAllowanceDueCents = Math.max(0, employee.holidayAllowanceAccruedCentsYtd + holidayAccrualCents - employee.holidayAllowancePaidCentsYtd)

  const isLeaver = Boolean(employmentEnd && employmentEnd.getUTCFullYear() === monthEnd.getUTCFullYear() && employmentEnd.getUTCMonth() === monthEnd.getUTCMonth())
  const holidayAllowancePaymentCents = isLeaver ? holidayAllowanceDueCents : 0

  let outstandingHolidayPayoutCents = 0
  if (isLeaver && employmentEnd) {
    const { payoutCents } = calculateOutstandingHolidayPayout(employee, employmentEnd)
    outstandingHolidayPayoutCents = payoutCents
  }

  const netBeforeFeeCents = baseNetCents + holidayAllowancePaymentCents + outstandingHolidayPayoutCents

  const dueDateStr = input.dueDate ?? monthEnd.toISOString().slice(0, 10)
  const paymentDateStr = input.paymentDate ?? dueDateStr
  const dueDate = toDate(dueDateStr) ?? defaultPaymentDueDate(window)
  const paymentDate = toDate(paymentDateStr) ?? dueDate

  const latePaymentFeeCents = calculateLatePaymentFee(netBeforeFeeCents, dueDate, paymentDate)
  const netCents = netBeforeFeeCents + latePaymentFeeCents

  // Calculate total taxable amount
  const taxableCents = Math.max(0, grossCents + holidayAllowancePaymentCents + outstandingHolidayPayoutCents + holidayAccrualCents - ruling30Cents)

  // Calculate total employer costs
  const totalEmployerCostsCents = grossCents 
    + pensionEmployerCents 
    + healthInsuranceEmployerCents 
    + zvwEmployerCents 
    + holidayAccrualCents

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
        wageTaxCreditCents,
        socialSecurityCents,
        socialSecurityBreakdown,
        pensionEmployeeCents,
        healthInsuranceEmployeeCents
      },
      employerCosts: {
        pensionEmployerCents,
        healthInsuranceEmployerCents,
        zvwEmployerCents,
        totalEmployerCostsCents
      },
      adjustments: {
        outstandingHolidayPayoutCents,
        latePaymentFeeCents
      },
      netCents
    },
    compliance: {
      minimumWage: minimumWageCheck
    },
    metadata: {
      paymentDueDate: dueDate.toISOString().slice(0, 10),
      paymentDate: paymentDate.toISOString().slice(0, 10),
      statutoryInterestRate: STATUTORY_INTEREST_RATE,
      terminationDate: employee.endDate ?? null,
      taxConfigurationPeriod: month,
      pensionProvider: pensionCalculation.employeeContribution > 0 ? getPensionProvider(employee) : undefined,
      healthInsuranceProvider: getHealthInsuranceProvider(employee)
    }
  }
}
