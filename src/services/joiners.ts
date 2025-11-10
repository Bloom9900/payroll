import { addEmployee, listEmployees, NewEmployeeInput } from './employeeRegistry.js'
import { DummyEmployee } from '../data/dummy.js'

export type JoinerInput = {
  firstName: string
  lastName: string
  email: string
  startDate: string
  iban: string
  bic?: string | null
  annualSalaryEuros: number
  hoursPerWeek: number
  workingDaysPerWeek?: number
  department: string
  role: string
  location: string
  contractType?: 'permanent' | 'fixed-term' | 'contractor'
  holidayDaysPerYear?: number
  holidayAllowanceEligible?: boolean
  carriedOverHolidayDays?: number
  isThirtyPercentRuling?: boolean
}

export type OnboardingTask = {
  code: string
  description: string
  dueRelativeToStartDays: number
  mandatory: boolean
}

export type JoinerPlan = {
  employee: DummyEmployee
  onboardingTasks: OnboardingTask[]
  firstPayrollMonth: string
  firstPayrollCutoffDate: string
  notes: string[]
}

function eurosToCents (value: number): number {
  return Math.round(value * 100)
}

function determineFirstPayrollMonth (startDate: string): string {
  const start = new Date(startDate + 'T00:00:00Z')
  return `${start.getUTCFullYear()}-${(start.getUTCMonth() + 1).toString().padStart(2, '0')}`
}

function determinePayrollCutoff (startDate: string): string {
  const start = new Date(startDate + 'T00:00:00Z')
  const cutoff = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 25))
  return cutoff.toISOString().slice(0, 10)
}

function buildNewEmployeeRecord (input: JoinerInput): NewEmployeeInput {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    startDate: input.startDate,
    endDate: null,
    iban: input.iban,
    bic: input.bic ?? null,
    annualSalaryCents: eurosToCents(input.annualSalaryEuros),
    hoursPerWeek: input.hoursPerWeek,
    workingDaysPerWeek: input.workingDaysPerWeek ?? 5,
    department: input.department,
    role: input.role,
    location: input.location,
    contractType: input.contractType ?? 'permanent',
    isThirtyPercentRuling: Boolean(input.isThirtyPercentRuling),
    holidayAllowanceEligible: input.holidayAllowanceEligible ?? true,
    holidayDaysPerYear: input.holidayDaysPerYear ?? 25,
    carriedOverHolidayDays: input.carriedOverHolidayDays ?? 0,
    usedHolidayDaysYtd: 0,
    unpaidLeaveDaysCurrentMonth: 0,
    holidayAllowanceAccruedCentsYtd: 0,
    holidayAllowancePaidCentsYtd: 0,
    pendingExpenseClaimsCents: 0
  }
}

function defaultOnboardingTasks (input: JoinerInput): OnboardingTask[] {
  const tasks: OnboardingTask[] = [
    { code: 'collect-id', description: 'Collect valid ID (passport or EU ID card)', dueRelativeToStartDays: -5, mandatory: true },
    { code: 'sign-employment', description: 'Employment agreement signed and stored digitally', dueRelativeToStartDays: -3, mandatory: true },
    { code: 'register-payroll-tax', description: 'Register employee in payroll tax administration (loonheffingen)', dueRelativeToStartDays: 0, mandatory: true },
    { code: 'bank-validation', description: 'Validate IBAN ownership and SEPA direct credit readiness', dueRelativeToStartDays: 0, mandatory: true },
    { code: 'pension-enrolment', description: 'Submit pension enrolment to the Dutch pension provider', dueRelativeToStartDays: 5, mandatory: input.contractType !== 'contractor' },
    { code: 'occupational-health', description: 'Schedule working conditions (Arbo) intake', dueRelativeToStartDays: 10, mandatory: input.contractType !== 'contractor' },
    { code: 'workday-sync', description: 'Sync starter record to Workday once integration is available', dueRelativeToStartDays: 1, mandatory: false }
  ]

  if (input.isThirtyPercentRuling) {
    tasks.push({ code: 'thirty-percent-ruling', description: 'Prepare 30% ruling application with the Belastingdienst', dueRelativeToStartDays: 3, mandatory: true })
  }

  return tasks
}

export function createJoiner (input: JoinerInput): JoinerPlan {
  const required: (keyof JoinerInput)[] = ['firstName', 'lastName', 'email', 'startDate', 'iban', 'annualSalaryEuros', 'hoursPerWeek', 'department', 'role', 'location']
  for (const key of required) {
    if ((input as any)[key] === undefined || (input as any)[key] === null || (typeof (input as any)[key] === 'string' && (input as any)[key].trim() === '')) {
      throw new Error(`Missing required joiner field: ${key}`)
    }
  }

  const record = buildNewEmployeeRecord(input)
  const employee = addEmployee(record)
  const firstPayrollMonth = determineFirstPayrollMonth(employee.startDate)
  const firstPayrollCutoffDate = determinePayrollCutoff(employee.startDate)
  const onboardingTasks = defaultOnboardingTasks(input)

  const notes = [
    `Pending expense claims carried forward: €0.00`,
    `Statutory notice period defaults to one month for ${employee.contractType} contracts`,
    `First payroll run scheduled for ${firstPayrollMonth} (cut-off ${firstPayrollCutoffDate})`
  ]

  return {
    employee,
    onboardingTasks,
    firstPayrollMonth,
    firstPayrollCutoffDate,
    notes
  }
}

export function getUpcomingJoiners (month?: string): DummyEmployee[] {
  const all = listEmployees()
  if (!month) {
    const today = new Date()
    return all.filter(e => {
      const start = new Date(e.startDate + 'T00:00:00Z')
      return start >= today && start <= new Date(today.getTime() + 1000 * 60 * 60 * 24 * 90)
    })
  }
  const [yearStr, monthStr] = month.split('-')
  const year = parseInt(yearStr, 10)
  const m = parseInt(monthStr, 10) - 1
  if (!Number.isFinite(year) || !Number.isFinite(m) || m < 0 || m > 11) {
    throw new Error('Invalid month parameter. Expected YYYY-MM')
  }
  const start = new Date(Date.UTC(year, m, 1))
  const end = new Date(Date.UTC(year, m + 1, 0))
  return all.filter(e => {
    const s = new Date(e.startDate + 'T00:00:00Z')
    return s >= start && s <= end
  })
}

export function fetchWorkdayJoinerStub (workdayWorkerId: string): JoinerInput {
  return {
    firstName: 'Workday',
    lastName: `Worker-${workdayWorkerId}`,
    email: `workday.worker${workdayWorkerId}@example.com`,
    startDate: new Date().toISOString().slice(0, 10),
    iban: 'NL00BANK0123456789',
    bic: null,
    annualSalaryEuros: 52000,
    hoursPerWeek: 40,
    workingDaysPerWeek: 5,
    department: 'Operations',
    role: 'Generated Role',
    location: 'Amsterdam',
    contractType: 'permanent',
    holidayDaysPerYear: 25,
    holidayAllowanceEligible: true,
    carriedOverHolidayDays: 0,
    isThirtyPercentRuling: false
  }
}
