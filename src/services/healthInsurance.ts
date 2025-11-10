import { DummyEmployee } from '../data/dummy.js'

export type HealthInsurancePremium = {
  employeeId: string
  employeePremium: number
  employerContribution: number
  totalPremium: number
  provider: string
}

export type HealthInsuranceCalculation = {
  employee: DummyEmployee
  employeePremium: number
  employerContribution: number
  totalPremium: number
  provider: string
}

// Default health insurance premium (monthly, in euros)
// In reality, this varies by provider and plan
const DEFAULT_MONTHLY_PREMIUM = 120 // €120 per month
const DEFAULT_EMPLOYER_CONTRIBUTION_RATE = 0.5 // 50% employer contribution

export function calculateHealthInsurance(
  employee: DummyEmployee,
  monthlyPremium: number = DEFAULT_MONTHLY_PREMIUM,
  employerContributionRate: number = DEFAULT_EMPLOYER_CONTRIBUTION_RATE
): HealthInsuranceCalculation {
  const employeePremium = Math.round(monthlyPremium * (1 - employerContributionRate) * 100) // Convert to cents
  const employerContribution = Math.round(monthlyPremium * employerContributionRate * 100)
  const totalPremium = employeePremium + employerContribution

  return {
    employee,
    employeePremium,
    employerContribution,
    totalPremium,
    provider: getHealthInsuranceProvider(employee)
  }
}

export function calculateMonthlyHealthInsurance(
  employees: DummyEmployee[],
  monthlyPremium: number = DEFAULT_MONTHLY_PREMIUM,
  employerContributionRate: number = DEFAULT_EMPLOYER_CONTRIBUTION_RATE
): HealthInsuranceCalculation[] {
  return employees
    .filter(emp => !emp.endDate) // Only active employees
    .map(employee => calculateHealthInsurance(employee, monthlyPremium, employerContributionRate))
}

export function getHealthInsuranceProvider(employee: DummyEmployee): string {
  // Mock provider selection
  const providers = ['Zilveren Kruis', 'VGZ', 'CZ', 'Menzis', 'DSW']
  const hash = employee.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return providers[hash % providers.length]
}

