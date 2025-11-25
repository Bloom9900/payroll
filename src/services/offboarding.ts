import { getEmployeeById } from './employeeRegistry.js'
import { round2 } from '../utils/currency.js'

export type OffboardingReason = 'termination' | 'resignation' | 'end-of-contract'

export type OffboardingPrimaryReason = 'termination' | 'resignation'
export type OffboardingSecondaryReason = 'misconduct' | 'end-of-contract' | 'mutual-agreement' | 'redundancy' | 'retirement' | 'other'

// Looncode mapping for Dutch payroll reporting
export const LOONCODE_MAP: Record<string, { code: string, description: string }> = {
  'termination-misconduct': { code: '011', description: 'Ontslag op staande voet (Dismissal for cause)' },
  'termination-redundancy': { code: '012', description: 'Ontslag wegens bedrijfseconomische redenen (Redundancy)' },
  'termination-mutual-agreement': { code: '013', description: 'Ontslag in onderling overleg (Mutual agreement)' },
  'termination-other': { code: '014', description: 'Ontslag anders (Other dismissal)' },
  'resignation-end-of-contract': { code: '021', description: 'Einde contract (End of contract)' },
  'resignation-retirement': { code: '022', description: 'Pensioen (Retirement)' },
  'resignation-other': { code: '023', description: 'Eigen opzegging anders (Other resignation)' }
}

export interface OffboardingInput {
  employeeId: string
  exitDate: string
  primaryReason: OffboardingPrimaryReason
  secondaryReason?: OffboardingSecondaryReason
  includeHolidayPayout?: boolean
}

export interface OffboardingSummary {
  employeeId: string
  name: string
  primaryReason: OffboardingPrimaryReason
  secondaryReason?: OffboardingSecondaryReason
  looncode: string
  looncodeDescription: string
  exitDate: string
  startDate: string
  tenureMonths: number
  tenureYears: number
  baseMonthlySalary: number
  noticePay: number
  noticePayExplanation: string
  transitionAllowance: number
  unusedVacationPayout: number
  holidayAllowanceTopUp: number
  totalGrossPayout: number
  annotations: string[]
}

export function calculateOffboardingSummary (input: OffboardingInput): OffboardingSummary | undefined {
  const employee = getEmployeeById(input.employeeId)
  if (!employee) return undefined

  const exitDate = new Date(input.exitDate + 'T00:00:00Z')
  const startDate = new Date(employee.startDate + 'T00:00:00Z')
  if (Number.isNaN(exitDate.getTime())) {
    throw new Error('Invalid exit date')
  }
  if (exitDate.getTime() < startDate.getTime()) {
    throw new Error('Exit date must be on or after the start date')
  }

  const baseMonthlySalary = round2((employee.annualSalaryCents / 100) / 12)

  const tenureMonths = monthsBetween(startDate, exitDate)
  const tenureYears = round2(tenureMonths / 12)

  const noticePay = calculateNoticePay(employee.contractType, baseMonthlySalary, tenureMonths)
  const transitionAllowance = calculateTransitionAllowance(baseMonthlySalary, tenureMonths, input.primaryReason)

  const { unusedVacationPayout, holidayAllowanceTopUp } = calculateVacationPayout(employee, exitDate, input.includeHolidayPayout !== false)

  const totalGrossPayout = round2(noticePay + transitionAllowance + unusedVacationPayout + holidayAllowanceTopUp)

  // Determine looncode based on primary and secondary reasons
  const reasonKey = `${input.primaryReason}-${input.secondaryReason || 'other'}`
  const looncodeInfo = LOONCODE_MAP[reasonKey] || LOONCODE_MAP[`${input.primaryReason}-other`] || { code: '000', description: 'Onbekend (Unknown)' }

  // Notice pay explanation
  const noticePayExplanation = noticePay > 0
    ? `Notice pay is compensation for the notice period. Based on tenure: ${tenureMonths < 12 ? '0.5 months' : tenureMonths < 36 ? '1 month' : '2 months'} notice period applies.`
    : 'No notice pay applicable (contractor or insufficient tenure).'

  const annotations: string[] = []
  annotations.push(`Tenure ${tenureMonths} months (${tenureYears} years)`)
  annotations.push(`Hire date: ${employee.startDate}`)
  if (transitionAllowance > 0) {
    annotations.push('Includes Dutch statutory transition allowance (1/3 monthly salary per year served).')
  } else {
    annotations.push('No transition allowance due to voluntary resignation or insufficient tenure.')
  }
  if (unusedVacationPayout > 0) {
    annotations.push('Includes payout of unused statutory vacation days at last known hourly rate.')
  } else {
    annotations.push('No unused vacation days remaining.')
  }
  if (employee.isThirtyPercentRuling) {
    annotations.push('Employee currently under 30% ruling—ensure to deregister with tax authorities.')
  }
  annotations.push(`Looncode: ${looncodeInfo.code} - ${looncodeInfo.description}`)

  return {
    employeeId: employee.id,
    name: `${employee.firstName} ${employee.lastName}`,
    primaryReason: input.primaryReason,
    secondaryReason: input.secondaryReason,
    looncode: looncodeInfo.code,
    looncodeDescription: looncodeInfo.description,
    exitDate: input.exitDate,
    startDate: employee.startDate,
    tenureMonths,
    tenureYears,
    baseMonthlySalary,
    noticePay,
    noticePayExplanation,
    transitionAllowance,
    unusedVacationPayout,
    holidayAllowanceTopUp,
    totalGrossPayout,
    annotations
  }
}

function calculateNoticePay (contractType: string, baseMonthlySalary: number, tenureMonths: number): number {
  if (contractType === 'contractor') return 0
  if (tenureMonths < 12) return round2(baseMonthlySalary / 2)
  if (tenureMonths < 36) return round2(baseMonthlySalary)
  return round2(baseMonthlySalary * 2)
}

function calculateTransitionAllowance (baseMonthlySalary: number, tenureMonths: number, reason: OffboardingPrimaryReason): number {
  if (reason === 'resignation') return 0
  if (tenureMonths < 1) return 0
  const monthlyPortion = baseMonthlySalary / 3
  return round2(monthlyPortion * (tenureMonths / 12))
}

function calculateVacationPayout (employee: ReturnType<typeof getEmployeeById>, exitDate: Date, include: boolean): { unusedVacationPayout: number, holidayAllowanceTopUp: number } {
  if (!employee || !include) {
    return { unusedVacationPayout: 0, holidayAllowanceTopUp: 0 }
  }
  const yearStart = new Date(Date.UTC(exitDate.getUTCFullYear(), 0, 1))
  const daysElapsed = (exitDate.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24) + 1
  const yearLength = isLeapYear(exitDate.getUTCFullYear()) ? 366 : 365
  const accruedDays = (employee.holidayDaysPerYear ?? 0) * (daysElapsed / yearLength) + (employee.carriedOverHolidayDays ?? 0)
  const remainingDays = Math.max(0, accruedDays - (employee.usedHolidayDaysYtd ?? 0))
  if (remainingDays <= 0) return { unusedVacationPayout: 0, holidayAllowanceTopUp: 0 }
  const hourly = (employee.annualSalaryCents / 100) / (employee.hoursPerWeek * 52)
  const hoursPerDay = employee.hoursPerWeek / employee.workingDaysPerWeek
  const payout = remainingDays * hoursPerDay * hourly
  const allowance = employee.holidayAllowanceEligible ? payout * 0.08 : 0
  return { unusedVacationPayout: round2(payout), holidayAllowanceTopUp: round2(allowance) }
}

function monthsBetween (start: Date, end: Date): number {
  const years = end.getUTCFullYear() - start.getUTCFullYear()
  const months = end.getUTCMonth() - start.getUTCMonth()
  const totalMonths = years * 12 + months
  const dayAdjustment = (end.getUTCDate() - start.getUTCDate()) / 30
  return Math.max(0, Math.round((totalMonths + dayAdjustment) * 100) / 100)
}

function isLeapYear (year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

