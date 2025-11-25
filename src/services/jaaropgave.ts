import { DummyEmployee } from '../data/dummy.js'
import { calculateMonthlyPayroll } from './netherlandsPayroll.js'
import { centsToEuro } from '../utils/currency.js'

export type JaaropgaveData = {
  employee: DummyEmployee
  year: number
  annualGross: number
  annualNet: number
  annualTax: number
  annualSocialSecurity: number
  annualHolidayAllowance: number
  ruling30Amount: number
  monthlyBreakdown: Array<{
    month: string
    gross: number
    net: number
    tax: number
    socialSecurity: number
    holidayAllowance: number
  }>
}

export type Jaaropgave = {
  id: string
  employeeId: string
  year: number
  generatedAt: Date
  data: JaaropgaveData
}

const jaaropgaves: Jaaropgave[] = []

export function generateJaaropgave(employee: DummyEmployee, year: number): Jaaropgave {
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = (i + 1).toString().padStart(2, '0')
    return `${year}-${month}`
  })

  let annualGross = 0
  let annualNet = 0
  let annualTax = 0
  let annualSocialSecurity = 0
  let annualHolidayAllowance = 0
  let ruling30Amount = 0

  const monthlyBreakdown = months.map(month => {
    const payroll = calculateMonthlyPayroll({ employee, month })
    
    annualGross += payroll.amounts.grossCents
    annualNet += payroll.amounts.netCents
    annualTax += payroll.amounts.deductions.wageTaxCents
    annualSocialSecurity += payroll.amounts.deductions.socialSecurityCents
    annualHolidayAllowance += payroll.amounts.allowances.holidayAccrualCents
    ruling30Amount += payroll.amounts.allowances.ruling30Cents

    return {
      month,
      gross: centsToEuro(payroll.amounts.grossCents),
      net: centsToEuro(payroll.amounts.netCents),
      tax: centsToEuro(payroll.amounts.deductions.wageTaxCents),
      socialSecurity: centsToEuro(payroll.amounts.deductions.socialSecurityCents),
      holidayAllowance: centsToEuro(payroll.amounts.allowances.holidayAccrualCents)
    }
  })

  const data: JaaropgaveData = {
    employee,
    year,
    annualGross: centsToEuro(annualGross),
    annualNet: centsToEuro(annualNet),
    annualTax: centsToEuro(annualTax),
    annualSocialSecurity: centsToEuro(annualSocialSecurity),
    annualHolidayAllowance: centsToEuro(annualHolidayAllowance),
    ruling30Amount: centsToEuro(ruling30Amount),
    monthlyBreakdown
  }

  const jaaropgave: Jaaropgave = {
    id: `JAAR-${employee.id}-${year}`,
    employeeId: employee.id,
    year,
    generatedAt: new Date(),
    data
  }

  jaaropgaves.push(jaaropgave)
  return jaaropgave
}

export function getJaaropgave(id: string): Jaaropgave | undefined {
  return jaaropgaves.find(j => j.id === id)
}

export function getJaaropgaveByEmployee(employeeId: string, year: number): Jaaropgave | undefined {
  return jaaropgaves.find(j => j.employeeId === employeeId && j.year === year)
}

export function listJaaropgaves(employeeId?: string, year?: number): Jaaropgave[] {
  let result = [...jaaropgaves]

  if (employeeId) {
    result = result.filter(j => j.employeeId === employeeId)
  }

  if (year) {
    result = result.filter(j => j.year === year)
  }

  return result.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())
}

export function generateAllJaaropgaves(year: number, employees: DummyEmployee[]): Jaaropgave[] {
  return employees
    .filter(emp => {
      const startYear = new Date(emp.startDate).getFullYear()
      const endYear = emp.endDate ? new Date(emp.endDate).getFullYear() : year
      return year >= startYear && year <= endYear
    })
    .map(employee => generateJaaropgave(employee, year))
}

