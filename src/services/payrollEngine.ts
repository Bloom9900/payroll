/**
 * Deterministic Gross-to-Net Payroll Calculation Engine
 * Pure function that calculates payroll given Period + Employee + Contract
 */

import type {
  Employee,
  Contract,
  RecurringItem,
  TaxTable,
  SocialSecurity,
  MinimumWage,
  PensionScheme,
  YTDLedger,
  DetailedPayrollResult,
  TableType
} from '../models/payroll.js'
import { getTaxConfiguration } from './taxConfiguration.js'
import { calculatePensionContribution } from './pension.js'
import { calculateHealthInsurance } from './healthInsurance.js'

export type PayrollEngineInput = {
  period: string // YYYY-MM
  employee: Employee
  contract: Contract
  recurringItems: RecurringItem[]
  taxTables: TaxTable[]
  socialSecurity: SocialSecurity
  minimumWage: MinimumWage
  pensionScheme?: PensionScheme | null
  previousYTD?: YTDLedger | null
  paymentDate?: string
  dueDate?: string
}

/**
 * Deterministic payroll calculation pipeline
 * Given Period + Employee + Contract, calculates all components
 */
export function calculatePayroll(input: PayrollEngineInput): DetailedPayrollResult {
  const {
    period,
    employee,
    contract,
    recurringItems,
    taxTables,
    socialSecurity,
    minimumWage,
    pensionScheme,
    previousYTD,
    paymentDate,
    dueDate
  } = input

  // Parse period
  const [year, month] = period.split('-').map(Number)
  const periodStart = new Date(Date.UTC(year, month - 1, 1))
  const periodEnd = new Date(Date.UTC(year, month, 0))
  const daysInPeriod = periodEnd.getDate()

  // Calculate proration for mid-period entry/exit
  const contractStart = new Date(contract.start + 'T00:00:00Z')
  const contractEnd = contract.end ? new Date(contract.end + 'T00:00:00Z') : null
  
  const effectiveStart = contractStart > periodStart ? contractStart : periodStart
  const effectiveEnd = contractEnd && contractEnd < periodEnd ? contractEnd : periodEnd
  
  const workedDays = Math.max(0, Math.floor((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1)
  const prorationFactor = daysInPeriod > 0 ? Math.max(0, Math.min(1, workedDays / daysInPeriod)) : 0

  // Calculate part-time factor
  const fullTimeHours = 40 // Standard full-time hours
  const partTimeFactor = contract.hoursPerWeek / fullTimeHours

  // Base salary for period
  const annualSalary = contract.salaryBasis
  const monthlyBaseSalary = Math.round(annualSalary / 12)
  const baseSalary = Math.round(monthlyBaseSalary * prorationFactor)

  // Calculate recurring allowances (active in this period)
  const activeAllowances = recurringItems.filter(item => 
    item.type === 'allowance' &&
    item.start <= periodEnd.toISOString().slice(0, 10) &&
    (!item.end || item.end >= periodStart.toISOString().slice(0, 10))
  )
  
  const recurringAllowances = activeAllowances.reduce((sum, item) => {
    const amount = item.isRate 
      ? Math.round(baseSalary * item.amountOrRate)
      : Math.round(item.amountOrRate * prorationFactor)
    return sum + amount
  }, 0)

  // Holiday allowance (8% accrual)
  const holidayAllowanceAccrual = Math.round(annualSalary * 0.08 / 12 * prorationFactor)
  const holidayAllowancePayout = 0 // Will be calculated separately for leavers

  // Total gross
  const totalGross = baseSalary + recurringAllowances + holidayAllowanceAccrual

  // 30% Ruling calculation
  const ruling30Valid = check30PercentRuling(employee, periodStart, periodEnd)
  const ruling30Reduction = ruling30Valid 
    ? Math.round(annualSalary * 0.3 / 12 * prorationFactor)
    : 0

  // Taxable wage
  const taxableWage = Math.max(0, totalGross - ruling30Reduction)

  // Calculate wage tax using tax tables
  const applicableTaxTables = taxTables.filter(table =>
    table.periodStart <= periodEnd.toISOString().slice(0, 10) &&
    table.periodEnd >= periodStart.toISOString().slice(0, 10) &&
    table.tableType === contract.tableType
  ).sort((a, b) => a.bracketLow - b.bracketLow)

  const annualTaxable = Math.round(taxableWage * 12 / prorationFactor) // Annualize for tax calculation
  const wageTax = calculateWageTax(annualTaxable, applicableTaxTables)
  const monthlyWageTax = Math.round(wageTax / 12 * prorationFactor)

  // Wage tax credit (heffingskorting)
  const wageTaxCredit = employee.heffingskorting && applicableTaxTables.length > 0
    ? calculateWageTaxCredit(annualTaxable, applicableTaxTables[0])
    : 0
  const monthlyWageTaxCredit = Math.round(wageTaxCredit / 12 * prorationFactor)

  // Social security contributions
  const socialSecurityCaps = JSON.parse(socialSecurity.capsJson || '{"annual": 3714900, "monthly": 309575}')
  const socialSecurityBase = Math.min(annualTaxable, socialSecurityCaps.annual)
  const monthlySocialSecurityBase = Math.round(socialSecurityBase / 12 * prorationFactor)

  const socialSecurityBreakdown = {
    aow: Math.round(monthlySocialSecurityBase * socialSecurity.aow),
    anw: Math.round(monthlySocialSecurityBase * socialSecurity.anw),
    wlz: Math.round(monthlySocialSecurityBase * socialSecurity.wlz),
    ww: Math.round(monthlySocialSecurityBase * socialSecurity.ww),
    wia: Math.round(monthlySocialSecurityBase * socialSecurity.wia),
    total: Math.round(monthlySocialSecurityBase * (
      socialSecurity.aow + socialSecurity.anw + socialSecurity.wlz + 
      socialSecurity.ww + socialSecurity.wia
    ))
  }

  // Pension contributions
  let pensionEmployee = 0
  let pensionEmployer = 0
  if (pensionScheme && employee.pensionSchemeId === pensionScheme.id) {
    const pensionBase = baseSalary
    pensionEmployee = Math.round(pensionBase * pensionScheme.employeeRate)
    pensionEmployer = Math.round(pensionBase * pensionScheme.employerRate)
  }

  // Health insurance (simplified - using existing service)
  const healthInsurance = calculateHealthInsurance({
    id: employee.id,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    startDate: contract.start,
    endDate: contract.end,
    iban: employee.iban,
    bic: employee.bic,
    annualSalaryCents: contract.salaryBasis,
    hoursPerWeek: contract.hoursPerWeek,
    workingDaysPerWeek: 5, // Default
    role: '',
    department: '',
    location: '',
    contractType: contract.fte >= 1.0 ? 'permanent' : 'fixed-term',
    isThirtyPercentRuling: ruling30Valid,
    holidayAllowanceEligible: true,
    holidayDaysPerYear: 25,
    carriedOverHolidayDays: 0,
    usedHolidayDaysYtd: 0,
    unpaidLeaveDaysCurrentMonth: 0,
    holidayAllowanceAccruedCentsYtd: 0,
    holidayAllowancePaidCentsYtd: 0,
    pendingExpenseClaimsCents: 0
  })
  
  const healthInsuranceEmployee = healthInsurance.employeePremium
  const healthInsuranceEmployer = healthInsurance.employerContribution

  // Recurring deductions
  const activeDeductions = recurringItems.filter(item =>
    item.type === 'deduction' &&
    item.start <= periodEnd.toISOString().slice(0, 10) &&
    (!item.end || item.end >= periodStart.toISOString().slice(0, 10))
  )
  
  const recurringDeductions = activeDeductions.reduce((sum, item) => {
    const amount = item.isRate
      ? Math.round(baseSalary * item.amountOrRate)
      : Math.round(item.amountOrRate * prorationFactor)
    return sum + amount
  }, 0)

  // Garnishments
  const activeGarnishments = recurringItems.filter(item =>
    item.type === 'garnishment' &&
    item.start <= periodEnd.toISOString().slice(0, 10) &&
    (!item.end || item.end >= periodStart.toISOString().slice(0, 10))
  )
  
  const garnishments = activeGarnishments.reduce((sum, item) => {
    const amount = item.isRate
      ? Math.round(baseSalary * item.amountOrRate)
      : Math.round(item.amountOrRate * prorationFactor)
    return sum + amount
  }, 0)

  // ZVW employer contribution
  const zvwEmployer = Math.round(totalGross * socialSecurity.zvwEmployer)

  // Net pay calculation
  const netPay = totalGross
    - monthlyWageTax
    + monthlyWageTaxCredit
    - socialSecurityBreakdown.total
    - pensionEmployee
    - healthInsuranceEmployee
    - recurringDeductions
    - garnishments

  // Employer costs
  const employerCosts = {
    pensionEmployer,
    healthInsuranceEmployer,
    zvwEmployer,
    holidayAllowanceAccrual,
    total: pensionEmployer + healthInsuranceEmployer + zvwEmployer + holidayAllowanceAccrual
  }

  // Minimum wage compliance check
  const requiredMinimumWage = Math.round(minimumWage.monthlyAmount * partTimeFactor * prorationFactor)
  const minimumWageCheck = {
    compliant: baseSalary >= requiredMinimumWage,
    required: requiredMinimumWage,
    actual: baseSalary,
    shortfall: Math.max(0, requiredMinimumWage - baseSalary)
  }

  // YTD calculations
  const ytd = {
    gross: (previousYTD?.gross || 0) + totalGross,
    net: (previousYTD?.net || 0) + netPay,
    tax: (previousYTD?.tax || 0) + monthlyWageTax - monthlyWageTaxCredit,
    social: (previousYTD?.social || 0) + socialSecurityBreakdown.total,
    pension: (previousYTD?.pension || 0) + pensionEmployee,
    taxable: (previousYTD?.taxable || 0) + taxableWage
  }

  // Line codes for reporting (Dutch payroll line codes)
  const lineCodes: { [key: string]: number } = {
    '001': totalGross, // Total gross
    '002': baseSalary, // Base salary
    '003': recurringAllowances, // Allowances
    '004': holidayAllowanceAccrual, // Holiday allowance
    '101': taxableWage, // Taxable wage
    '201': monthlyWageTax, // Wage tax
    '202': monthlyWageTaxCredit, // Wage tax credit
    '301': socialSecurityBreakdown.total, // Total social security
    '302': socialSecurityBreakdown.aow, // AOW
    '303': socialSecurityBreakdown.anw, // ANW
    '304': socialSecurityBreakdown.wlz, // WLZ
    '305': socialSecurityBreakdown.ww, // WW
    '306': socialSecurityBreakdown.wia, // WIA
    '401': pensionEmployee, // Pension employee
    '402': pensionEmployer, // Pension employer
    '501': healthInsuranceEmployee, // Health insurance employee
    '502': healthInsuranceEmployer, // Health insurance employer
    '503': zvwEmployer, // ZVW employer
    '601': netPay, // Net pay
    '701': ruling30Reduction // 30% ruling reduction
  }

  return {
    period,
    employeeId: employee.id,
    contractId: contract.id,
    baseSalary,
    prorationFactor,
    partTimeFactor,
    recurringAllowances,
    holidayAllowanceAccrual,
    holidayAllowancePayout,
    totalGross,
    ruling30Reduction,
    ruling30Valid,
    taxableWage,
    wageTax: monthlyWageTax,
    wageTaxCredit: monthlyWageTaxCredit,
    socialSecurity: socialSecurityBreakdown,
    pensionEmployee,
    healthInsuranceEmployee,
    recurringDeductions,
    garnishments,
    netPay,
    employerCosts,
    minimumWage: minimumWageCheck,
    ytd,
    lineCodes,
    metadata: {
      tableType: contract.tableType,
      taxYear: year,
      calculationDate: new Date(),
      version: '1.0.0'
    }
  }
}

/**
 * Check if 30% ruling is valid for the period
 */
function check30PercentRuling(employee: Employee, periodStart: Date, periodEnd: Date): boolean {
  if (!employee.rulingStart || !employee.rulingEnd) return false
  
  const rulingStart = new Date(employee.rulingStart + 'T00:00:00Z')
  const rulingEnd = new Date(employee.rulingEnd + 'T00:00:00Z')
  
  // Check if period overlaps with ruling validity window
  return rulingStart <= periodEnd && rulingEnd >= periodStart
}

/**
 * Calculate wage tax using progressive brackets
 */
function calculateWageTax(annualTaxable: number, taxTables: TaxTable[]): number {
  if (taxTables.length === 0) return 0
  
  let remaining = Math.max(0, annualTaxable)
  let totalTax = 0
  
  for (const table of taxTables) {
    if (remaining <= 0) break
    
    const bracketSize = Math.min(remaining, table.bracketHigh - table.bracketLow)
    if (bracketSize > 0) {
      totalTax += bracketSize * table.rate
      remaining -= bracketSize
    }
  }
  
  return Math.round(totalTax)
}

/**
 * Calculate wage tax credit
 */
function calculateWageTaxCredit(annualTaxable: number, taxTable: TaxTable): number {
  if (!taxTable.creditAmount || !taxTable.creditType) return 0
  
  // Simplified credit calculation
  // In reality, this is more complex and depends on credit type
  return Math.round(taxTable.creditAmount)
}

