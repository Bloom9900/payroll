/**
 * Core Payroll Data Models
 * Following the minimal data structures specification
 */

export type TableType = 'loonheffing' | 'loonheffing_korting' | 'loonheffing_arbeidskorting'

export type PayFrequency = 'monthly' | 'weekly' | 'biweekly' | 'four_weekly'

export type RecurringItemType = 'allowance' | 'deduction' | 'garnishment'

export type PayrollRunStatus = 'draft' | 'calculated' | 'reviewed' | 'approved' | 'locked'

export type FilingBatchStatus = 'draft' | 'validated' | 'error' | 'ready'

// Employee model
export type Employee = {
  id: string
  bsn: string
  name: string
  firstName: string
  lastName: string
  email: string
  address: {
    street: string
    city: string
    postalCode: string
    country: string
  }
  tableType: TableType
  heffingskorting: boolean // Wage tax credit flag
  rulingStart?: string | null // 30% ruling start date (YYYY-MM-DD)
  rulingEnd?: string | null // 30% ruling end date (YYYY-MM-DD)
  pensionSchemeId?: string | null
  iban: string
  bic?: string | null
  createdAt: Date
  updatedAt: Date
}

// Contract model
export type Contract = {
  id: string
  employeeId: string
  start: string // YYYY-MM-DD
  end?: string | null // YYYY-MM-DD
  fte: number // Full-time equivalent (0.0 - 1.0)
  hoursPerWeek: number
  salaryBasis: number // Annual salary in cents
  payFrequency: PayFrequency
  tableType: TableType
  caoId?: string | null // CAO identifier
  createdAt: Date
  updatedAt: Date
}

// Recurring items (allowances, deductions, garnishments)
export type RecurringItem = {
  id: string
  employeeId: string
  type: RecurringItemType
  amountOrRate: number // Amount in cents or rate (0-1)
  isRate: boolean // If true, amountOrRate is a rate; if false, it's a fixed amount
  start: string // YYYY-MM-DD
  end?: string | null // YYYY-MM-DD
  taxableFlag: boolean // Whether this item is taxable
  description: string
  createdAt: Date
  updatedAt: Date
}

// Tax tables with brackets
export type TaxTable = {
  id: string
  periodStart: string // YYYY-MM-DD
  periodEnd: string // YYYY-MM-DD
  bracketLow: number // Lower bound in cents
  bracketHigh: number // Upper bound in cents (can be Infinity)
  rate: number // Tax rate (0-1)
  creditType?: string | null // Credit type identifier
  creditAmount?: number | null // Credit amount in cents
  tableType: TableType
  taxYear: number
  createdAt: Date
}

// Social security rates
export type SocialSecurity = {
  id: string
  periodStart: string // YYYY-MM-DD
  periodEnd: string // YYYY-MM-DD
  aow: number // AOW rate (0-1)
  anw: number // ANW rate (0-1)
  wlz: number // WLZ rate (0-1)
  ww: number // WW rate (0-1)
  wia: number // WIA rate (0-1)
  zvwEmployer: number // ZVW employer rate (0-1)
  capsJson: string // JSON string with caps: { annual: number, monthly: number }
  createdAt: Date
}

// Minimum wage
export type MinimumWage = {
  id: string
  periodStart: string // YYYY-MM-DD
  periodEnd: string // YYYY-MM-DD
  age: number // Age threshold
  fullTimeHoursPerWeek: number // Full-time hours (typically 40)
  monthlyAmount: number // Monthly minimum wage in cents
  createdAt: Date
}

// Pension schemes
export type PensionScheme = {
  id: string
  name: string
  periodStart: string // YYYY-MM-DD
  periodEnd: string // YYYY-MM-DD
  employeeRate: number // Employee contribution rate (0-1)
  employerRate: number // Employer contribution rate (0-1)
  baseRule: string // Base calculation rule (e.g., 'gross', 'taxable')
  capRule: string // Cap rule (e.g., 'none', 'social_security_ceiling')
  providerName: string
  createdAt: Date
}

// YTD Ledger for cumulative tracking
export type YTDLedger = {
  id: string
  employeeId: string
  period: string // YYYY-MM
  gross: number // Cumulative gross in cents
  net: number // Cumulative net in cents
  tax: number // Cumulative tax in cents
  social: number // Cumulative social security in cents
  pension: number // Cumulative pension in cents
  taxable: number // Cumulative taxable in cents
  createdAt: Date
  updatedAt: Date
}

// Audit log
export type AuditLog = {
  id: string
  tsUtc: Date
  actor: string // User ID or system identifier
  event: string // Event type (e.g., 'payroll_run_created', 'employee_updated')
  entityType: string // Entity type (e.g., 'employee', 'payroll_run')
  entityId: string // Entity ID
  payloadJson: string // JSON payload
  ip?: string | null
}

// Filing batches
export type FilingBatch = {
  id: string
  period: string // YYYY-MM
  status: FilingBatchStatus
  createdAt: Date
  createdBy: string
  validationReportJson: string // JSON validation report
}

// Filing documents
export type FilingDocument = {
  id: string
  batchId: string
  employeeId: string
  xmlPath: string // Path to XML file
  checksum: string // File checksum
  createdAt: Date
}

// Payroll run with enhanced workflow
export type PayrollRun = {
  id: string
  period: string // YYYY-MM
  status: PayrollRunStatus
  calculations: PayrollCalculation[]
  warnings: PayrollWarning[]
  changeLog: PayrollChangeLog[]
  createdAt: Date
  createdBy: string
  calculatedAt?: Date | null
  reviewedAt?: Date | null
  reviewedBy?: string | null
  approvedAt?: Date | null
  approvedBy?: string | null
  lockedAt?: Date | null
  lockedBy?: string | null
}

export type PayrollCalculation = {
  employeeId: string
  contractId: string
  period: string
  calculation: DetailedPayrollResult
  diffFromPrevious?: PayrollDiff | null
}

export type PayrollWarning = {
  employeeId: string
  type: 'minimum_wage' | 'wkr_exceeded' | 'pension_cap' | 'tax_bracket' | 'other'
  message: string
  severity: 'error' | 'warning' | 'info'
}

export type PayrollChangeLog = {
  employeeId: string
  field: string
  oldValue: any
  newValue: any
  timestamp: Date
}

export type PayrollDiff = {
  field: string
  oldValue: number
  newValue: number
  difference: number
}

// Detailed payroll calculation result
export type DetailedPayrollResult = {
  period: string
  employeeId: string
  contractId: string
  
  // Base calculations
  baseSalary: number // Base salary for period in cents
  prorationFactor: number // Proration factor (0-1)
  partTimeFactor: number // Part-time factor (0-1)
  
  // Earnings
  recurringAllowances: number // Recurring allowances in cents
  holidayAllowanceAccrual: number // 8% holiday allowance accrual in cents
  holidayAllowancePayout: number // Holiday allowance payout in cents
  totalGross: number // Total gross in cents
  
  // 30% Ruling
  ruling30Reduction: number // 30% ruling reduction in cents
  ruling30Valid: boolean // Whether 30% ruling is valid for this period
  
  // Taxable base
  taxableWage: number // Taxable wage in cents
  
  // Deductions
  wageTax: number // Wage tax in cents
  wageTaxCredit: number // Wage tax credit (heffingskorting) in cents
  socialSecurity: {
    total: number
    aow: number
    anw: number
    wlz: number
    ww: number
    wia: number
  }
  pensionEmployee: number // Employee pension contribution in cents
  healthInsuranceEmployee: number // Employee health insurance in cents
  recurringDeductions: number // Recurring deductions in cents
  garnishments: number // Garnishments in cents
  
  // Net pay
  netPay: number // Net pay in cents
  
  // Employer costs
  employerCosts: {
    pensionEmployer: number
    healthInsuranceEmployer: number
    zvwEmployer: number
    holidayAllowanceAccrual: number
    total: number
  }
  
  // Compliance
  minimumWage: {
    compliant: boolean
    required: number
    actual: number
    shortfall: number
  }
  
  // YTD
  ytd: {
    gross: number
    net: number
    tax: number
    social: number
    pension: number
    taxable: number
  }
  
  // Line codes for reporting
  lineCodes: {
    [key: string]: number // Line code -> amount in cents
  }
  
  // Metadata
  metadata: {
    tableType: TableType
    taxYear: number
    calculationDate: Date
    version: string // Calculation engine version
  }
}

