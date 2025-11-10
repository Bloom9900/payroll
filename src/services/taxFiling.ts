import { listEmployees } from './employeeRegistry.js'
import { calculateMonthlyPayroll } from './netherlandsPayroll.js'

export type TaxFilingData = {
  month: string
  employeeCount: number
  totalGross: number
  totalNet: number
  totalTax: number
  totalSocialSecurity: number
  totalHolidayAllowance: number
  employees: Array<{
    employeeId: string
    name: string
    gross: number
    net: number
    tax: number
    socialSecurity: number
    ruling30: number
  }>
}

export type TaxFiling = {
  id: string
  month: string
  status: 'draft' | 'submitted' | 'confirmed'
  submittedAt?: Date
  confirmedAt?: Date
  confirmationNumber?: string
  data: TaxFilingData
}

const taxFilings: TaxFiling[] = []

function centsToEuro(value: number): number {
  return Math.round(value) / 100
}

export function generateTaxFiling(month: string): TaxFiling {
  const employees = listEmployees()
  const calculations = employees
    .map(employee => calculateMonthlyPayroll({ employee, month }))
    .filter(r => r.employment.proRatedFactor > 0 || 
                 r.amounts.allowances.holidayAllowancePaymentCents > 0 || 
                 r.amounts.adjustments.outstandingHolidayPayoutCents > 0)

  let totalGross = 0
  let totalNet = 0
  let totalTax = 0
  let totalSocialSecurity = 0
  let totalHolidayAllowance = 0

  const employeeData = calculations.map(r => {
    totalGross += r.amounts.grossCents
    totalNet += r.amounts.netCents
    totalTax += r.amounts.deductions.wageTaxCents
    totalSocialSecurity += r.amounts.deductions.socialSecurityCents
    totalHolidayAllowance += r.amounts.allowances.holidayAccrualCents

    return {
      employeeId: r.employee.id,
      name: `${r.employee.firstName} ${r.employee.lastName}`,
      gross: centsToEuro(r.amounts.grossCents),
      net: centsToEuro(r.amounts.netCents),
      tax: centsToEuro(r.amounts.deductions.wageTaxCents),
      socialSecurity: centsToEuro(r.amounts.deductions.socialSecurityCents),
      ruling30: centsToEuro(r.amounts.allowances.ruling30Cents)
    }
  })

  const data: TaxFilingData = {
    month,
    employeeCount: employeeData.length,
    totalGross: centsToEuro(totalGross),
    totalNet: centsToEuro(totalNet),
    totalTax: centsToEuro(totalTax),
    totalSocialSecurity: centsToEuro(totalSocialSecurity),
    totalHolidayAllowance: centsToEuro(totalHolidayAllowance),
    employees: employeeData
  }

  const filing: TaxFiling = {
    id: `TAX-${month}-${Date.now()}`,
    month,
    status: 'draft',
    data
  }

  taxFilings.push(filing)
  return filing
}

export function submitTaxFiling(id: string): TaxFiling | undefined {
  const filing = getTaxFiling(id)
  if (!filing) return undefined

  filing.status = 'submitted'
  filing.submittedAt = new Date()
  filing.confirmationNumber = `TAX-CONF-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

  // Simulate confirmation after delay
  setTimeout(() => {
    if (filing) {
      filing.status = 'confirmed'
      filing.confirmedAt = new Date()
    }
  }, 3000)

  return filing
}

export function getTaxFiling(id: string): TaxFiling | undefined {
  return taxFilings.find(f => f.id === id)
}

export function getTaxFilingByMonth(month: string): TaxFiling | undefined {
  return taxFilings.find(f => f.month === month)
}

export function listTaxFilings(limit: number = 50): TaxFiling[] {
  return [...taxFilings]
    .sort((a, b) => {
      const aMonth = a.month
      const bMonth = b.month
      return bMonth.localeCompare(aMonth)
    })
    .slice(0, limit)
}

