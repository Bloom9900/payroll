/**
 * Tax Configuration Service
 * Manages tax tables (Loonheffingen) from Belastingdienst with period-based configuration
 * Supports monthly updates and API sync capabilities
 */

export type TaxBracket = {
  limit: number // Annual limit in cents
  rate: number // Tax rate (0-1)
}

export type SocialSecurityRates = {
  aow: number // Old Age Pension (AOW)
  anw: number // Survivor's Benefits (ANW)
  wlz: number // Long-term Care (WLZ)
  ww: number // Unemployment (WW)
  wia: number // Disability (WIA)
  total: number // Total rate
}

export type TaxConfiguration = {
  period: string // Format: YYYY-MM
  year: number
  month: number
  taxBrackets: TaxBracket[]
  socialSecurityRates: SocialSecurityRates
  socialSecurityCeilingCents: number // Annual ceiling for social security
  wageTaxCreditBaseCents: number // Base wage tax credit (heffingskorting)
  wageTaxCreditRate: number // Rate for wage tax credit calculation
  wageTaxCreditMaxCents: number // Maximum wage tax credit
  minimumWageFullTimeCents: number // Monthly minimum wage for full-time (40h/week)
  healthInsuranceEmployerRate: number // ZVW employer contribution rate
  pensionBaseRate: number // Base pension contribution rate (can be overridden per employee)
  lastUpdated: Date
  source: 'manual' | 'api' | 'import'
}

// Default 2024 tax configuration (Dutch tax system)
const DEFAULT_TAX_BRACKETS_2024: TaxBracket[] = [
  { limit: 3714900, rate: 0.3697 }, // First bracket: up to €37,149
  { limit: 7551800, rate: 0.495 }, // Second bracket: €37,149 - €75,518
  { limit: Number.POSITIVE_INFINITY, rate: 0.495 } // Third bracket: above €75,518
]

// Default 2024 social security rates (combined)
const DEFAULT_SOCIAL_SECURITY_2024: SocialSecurityRates = {
  aow: 0.175, // 17.5% AOW
  anw: 0.001, // 0.1% ANW
  wlz: 0.095, // 9.5% WLZ
  ww: 0.004, // 0.4% WW
  wia: 0.0025, // 0.25% WIA
  total: 0.2775 // Total: 27.75%
}

// Default 2024 wage tax credit (heffingskorting)
const DEFAULT_WAGE_TAX_CREDIT_2024 = {
  baseCents: 3070000, // €30,700 base
  rate: 0.07307, // 7.307% rate
  maxCents: 3070000 // Maximum credit
}

// Default 2024 minimum wage (monthly for full-time 40h/week)
const DEFAULT_MINIMUM_WAGE_2024_CENTS = 2070000 // €2,070 per month

// Default health insurance employer contribution (ZVW)
const DEFAULT_HEALTH_INSURANCE_EMPLOYER_RATE = 0.0682 // 6.82%

// Default pension base rate
const DEFAULT_PENSION_BASE_RATE = 0.04 // 4%

const taxConfigurations: Map<string, TaxConfiguration> = new Map()

/**
 * Get or create tax configuration for a specific period
 */
export function getTaxConfiguration(period: string): TaxConfiguration {
  const existing = taxConfigurations.get(period)
  if (existing) return existing

  // Parse period
  const [yearStr, monthStr] = period.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)

  // Create default configuration based on year
  const config: TaxConfiguration = {
    period,
    year,
    month,
    taxBrackets: getDefaultTaxBrackets(year),
    socialSecurityRates: getDefaultSocialSecurity(year),
    socialSecurityCeilingCents: getDefaultSocialSecurityCeiling(year),
    wageTaxCreditBaseCents: DEFAULT_WAGE_TAX_CREDIT_2024.baseCents,
    wageTaxCreditRate: DEFAULT_WAGE_TAX_CREDIT_2024.rate,
    wageTaxCreditMaxCents: DEFAULT_WAGE_TAX_CREDIT_2024.maxCents,
    minimumWageFullTimeCents: getDefaultMinimumWage(year),
    healthInsuranceEmployerRate: DEFAULT_HEALTH_INSURANCE_EMPLOYER_RATE,
    pensionBaseRate: DEFAULT_PENSION_BASE_RATE,
    lastUpdated: new Date(),
    source: 'manual'
  }

  taxConfigurations.set(period, config)
  return config
}

/**
 * Update tax configuration for a period
 */
export function updateTaxConfiguration(
  period: string,
  updates: Partial<Omit<TaxConfiguration, 'period' | 'year' | 'month' | 'lastUpdated'>>
): TaxConfiguration {
  const existing = getTaxConfiguration(period)
  const updated: TaxConfiguration = {
    ...existing,
    ...updates,
    lastUpdated: new Date()
  }
  taxConfigurations.set(period, updated)
  return updated
}

/**
 * Import tax configuration from external source (e.g., Belastingdienst API)
 */
export function importTaxConfiguration(
  period: string,
  data: {
    taxBrackets?: TaxBracket[]
    socialSecurityRates?: Partial<SocialSecurityRates>
    socialSecurityCeilingCents?: number
    wageTaxCreditBaseCents?: number
    wageTaxCreditRate?: number
    wageTaxCreditMaxCents?: number
    minimumWageFullTimeCents?: number
    healthInsuranceEmployerRate?: number
  }
): TaxConfiguration {
  const existing = getTaxConfiguration(period)
  const updated: TaxConfiguration = {
    ...existing,
    ...(data.taxBrackets && { taxBrackets: data.taxBrackets }),
    ...(data.socialSecurityRates && {
      socialSecurityRates: {
        ...existing.socialSecurityRates,
        ...data.socialSecurityRates,
        total: data.socialSecurityRates.total ?? calculateTotalSocialSecurityRate(data.socialSecurityRates)
      }
    }),
    ...(data.socialSecurityCeilingCents && { socialSecurityCeilingCents: data.socialSecurityCeilingCents }),
    ...(data.wageTaxCreditBaseCents && { wageTaxCreditBaseCents: data.wageTaxCreditBaseCents }),
    ...(data.wageTaxCreditRate && { wageTaxCreditRate: data.wageTaxCreditRate }),
    ...(data.wageTaxCreditMaxCents && { wageTaxCreditMaxCents: data.wageTaxCreditMaxCents }),
    ...(data.minimumWageFullTimeCents && { minimumWageFullTimeCents: data.minimumWageFullTimeCents }),
    ...(data.healthInsuranceEmployerRate && { healthInsuranceEmployerRate: data.healthInsuranceEmployerRate }),
    lastUpdated: new Date(),
    source: 'import'
  }
  taxConfigurations.set(period, updated)
  return updated
}

/**
 * List all tax configurations
 */
export function listTaxConfigurations(): TaxConfiguration[] {
  return Array.from(taxConfigurations.values()).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year
    return b.month - a.month
  })
}

/**
 * Get default tax brackets for a year
 */
function getDefaultTaxBrackets(year: number): TaxBracket[] {
  // For now, use 2024 brackets. In production, this would fetch from Belastingdienst API
  if (year >= 2024) {
    return JSON.parse(JSON.stringify(DEFAULT_TAX_BRACKETS_2024))
  }
  // Add historical brackets as needed
  return JSON.parse(JSON.stringify(DEFAULT_TAX_BRACKETS_2024))
}

/**
 * Get default social security rates for a year
 */
function getDefaultSocialSecurity(year: number): SocialSecurityRates {
  if (year >= 2024) {
    return { ...DEFAULT_SOCIAL_SECURITY_2024 }
  }
  return { ...DEFAULT_SOCIAL_SECURITY_2024 }
}

/**
 * Get default social security ceiling for a year
 */
function getDefaultSocialSecurityCeiling(year: number): number {
  if (year >= 2024) {
    return 3714900 // €37,149 annual ceiling for 2024
  }
  return 3714900
}

/**
 * Get default minimum wage for a year
 */
function getDefaultMinimumWage(year: number): number {
  if (year >= 2024) {
    return DEFAULT_MINIMUM_WAGE_2024_CENTS
  }
  return DEFAULT_MINIMUM_WAGE_2024_CENTS
}

/**
 * Calculate total social security rate from individual rates
 */
function calculateTotalSocialSecurityRate(rates: Partial<SocialSecurityRates>): number {
  return (rates.aow ?? 0) + (rates.anw ?? 0) + (rates.wlz ?? 0) + (rates.ww ?? 0) + (rates.wia ?? 0)
}

/**
 * Calculate progressive tax using tax brackets
 */
export function calculateProgressiveTax(amountCents: number, taxBrackets: TaxBracket[]): number {
  let remaining = Math.max(0, amountCents)
  let taxed = 0
  let floor = 0
  for (const bracket of taxBrackets) {
    if (remaining <= 0) break
    const span = Math.min(remaining, bracket.limit - floor)
    if (span > 0) {
      taxed += span * bracket.rate
      remaining -= span
    }
    floor = bracket.limit
  }
  return Math.round(taxed)
}

/**
 * Calculate wage tax credit (heffingskorting)
 */
export function calculateWageTaxCredit(
  taxableIncomeCents: number,
  config: TaxConfiguration
): number {
  // Simplified calculation: base credit minus reduction for high income
  const { wageTaxCreditBaseCents, wageTaxCreditRate, wageTaxCreditMaxCents } = config
  
  // For incomes above the base, the credit is reduced
  if (taxableIncomeCents <= wageTaxCreditBaseCents) {
    return wageTaxCreditMaxCents
  }
  
  // Credit reduces as income increases
  const excess = taxableIncomeCents - wageTaxCreditBaseCents
  const reduction = Math.round(excess * wageTaxCreditRate)
  const credit = Math.max(0, wageTaxCreditMaxCents - reduction)
  
  return Math.min(credit, wageTaxCreditMaxCents)
}

/**
 * Calculate minimum wage for employee based on hours per week
 */
export function calculateMinimumWageForEmployee(
  hoursPerWeek: number,
  config: TaxConfiguration
): number {
  // Full-time is 40 hours per week
  const fullTimeHours = 40
  const proRatedFactor = hoursPerWeek / fullTimeHours
  return Math.round(config.minimumWageFullTimeCents * proRatedFactor)
}

/**
 * Check if salary meets minimum wage requirements
 */
export function checkMinimumWageCompliance(
  monthlySalaryCents: number,
  hoursPerWeek: number,
  config: TaxConfiguration
): { compliant: boolean; requiredCents: number; actualCents: number; shortfallCents: number } {
  const requiredCents = calculateMinimumWageForEmployee(hoursPerWeek, config)
  const shortfallCents = Math.max(0, requiredCents - monthlySalaryCents)
  return {
    compliant: shortfallCents === 0,
    requiredCents,
    actualCents: monthlySalaryCents,
    shortfallCents
  }
}

