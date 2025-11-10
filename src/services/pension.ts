import { DummyEmployee } from '../data/dummy.js'

export type PensionContribution = {
  employeeId: string
  employeeContribution: number
  employerContribution: number
  totalContribution: number
  provider: string
}

export type PensionCalculation = {
  employee: DummyEmployee
  grossSalary: number
  employeeRate: number
  employerRate: number
  employeeContribution: number
  employerContribution: number
  totalContribution: number
}

// Default pension rates (configurable per employee/provider)
const DEFAULT_EMPLOYEE_RATE = 0.04 // 4%
const DEFAULT_EMPLOYER_RATE = 0.04 // 4%

export function calculatePensionContribution(
  employee: DummyEmployee,
  grossSalary: number,
  employeeRate: number = DEFAULT_EMPLOYEE_RATE,
  employerRate: number = DEFAULT_EMPLOYER_RATE
): PensionCalculation {
  // Contractors typically don't have pension contributions
  if (employee.contractType === 'contractor') {
    return {
      employee,
      grossSalary,
      employeeRate: 0,
      employerRate: 0,
      employeeContribution: 0,
      employerContribution: 0,
      totalContribution: 0
    }
  }

  const employeeContribution = Math.round(grossSalary * employeeRate)
  const employerContribution = Math.round(grossSalary * employerRate)
  const totalContribution = employeeContribution + employerContribution

  return {
    employee,
    grossSalary,
    employeeRate,
    employerRate,
    employeeContribution,
    employerContribution,
    totalContribution
  }
}

export function calculateMonthlyPensionContributions(
  employees: DummyEmployee[],
  month: string,
  employeeRate: number = DEFAULT_EMPLOYEE_RATE,
  employerRate: number = DEFAULT_EMPLOYER_RATE
): PensionCalculation[] {
  // Calculate gross salary for the month (simplified - in reality would use payroll calculation)
  return employees
    .filter(emp => emp.contractType !== 'contractor' && !emp.endDate)
    .map(employee => {
      const grossMonthly = employee.annualSalaryCents / 12
      return calculatePensionContribution(employee, grossMonthly, employeeRate, employerRate)
    })
}

export function getPensionProvider(employee: DummyEmployee): string {
  // Mock provider selection based on department or employee
  const providers = ['PGGM', 'ABP', 'PME', 'BpfBouw']
  const hash = employee.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return providers[hash % providers.length]
}

