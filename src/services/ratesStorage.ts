/**
 * Versioned Rates and Rules Storage
 * Local storage with validity windows and period coverage checks
 */

import type {
  TaxTable,
  SocialSecurity,
  MinimumWage,
  PensionScheme
} from '../models/payroll.js'

// In-memory storage (in production, this would be a database)
const taxTables: TaxTable[] = []
const socialSecurityRates: SocialSecurity[] = []
const minimumWages: MinimumWage[] = []
const pensionSchemes: PensionScheme[] = []

/**
 * Tax Tables Management
 */
export function addTaxTable(table: Omit<TaxTable, 'id' | 'createdAt'>): TaxTable {
  const id = `TT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const newTable: TaxTable = {
    ...table,
    id,
    createdAt: new Date()
  }
  taxTables.push(newTable)
  return newTable
}

export function getTaxTablesForPeriod(periodStart: string, periodEnd: string, tableType?: string): TaxTable[] {
  return taxTables.filter(table =>
    table.periodStart <= periodEnd &&
    table.periodEnd >= periodStart &&
    (!tableType || table.tableType === tableType)
  )
}

export function listTaxTables(): TaxTable[] {
  return [...taxTables].sort((a, b) => 
    a.periodStart.localeCompare(b.periodStart)
  )
}

export function validateTaxTablePeriods(): { valid: boolean; overlaps: Array<{ table1: string; table2: string }> } {
  const overlaps: Array<{ table1: string; table2: string }> = []
  
  for (let i = 0; i < taxTables.length; i++) {
    for (let j = i + 1; j < taxTables.length; j++) {
      const t1 = taxTables[i]
      const t2 = taxTables[j]
      
      // Check if same table type and overlapping periods
      if (t1.tableType === t2.tableType &&
          t1.periodStart <= t2.periodEnd &&
          t1.periodEnd >= t2.periodStart) {
        overlaps.push({ table1: t1.id, table2: t2.id })
      }
    }
  }
  
  return { valid: overlaps.length === 0, overlaps }
}

/**
 * Social Security Rates Management
 */
export function addSocialSecurityRate(rate: Omit<SocialSecurity, 'id' | 'createdAt'>): SocialSecurity {
  const id = `SS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const newRate: SocialSecurity = {
    ...rate,
    id,
    createdAt: new Date()
  }
  socialSecurityRates.push(newRate)
  return newRate
}

export function getSocialSecurityForPeriod(periodStart: string, periodEnd: string): SocialSecurity | null {
  const rates = socialSecurityRates.filter(rate =>
    rate.periodStart <= periodEnd &&
    rate.periodEnd >= periodStart
  )
  
  if (rates.length === 0) return null
  if (rates.length > 1) {
    // If multiple rates, use the most recent one
    rates.sort((a, b) => a.periodStart.localeCompare(b.periodStart))
  }
  
  return rates[rates.length - 1]
}

export function listSocialSecurityRates(): SocialSecurity[] {
  return [...socialSecurityRates].sort((a, b) =>
    a.periodStart.localeCompare(b.periodStart)
  )
}

/**
 * Minimum Wage Management
 */
export function addMinimumWage(wage: Omit<MinimumWage, 'id' | 'createdAt'>): MinimumWage {
  const id = `MW-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const newWage: MinimumWage = {
    ...wage,
    id,
    createdAt: new Date()
  }
  minimumWages.push(newWage)
  return newWage
}

export function getMinimumWageForPeriod(periodStart: string, periodEnd: string, age: number = 21): MinimumWage | null {
  const wages = minimumWages.filter(wage =>
    wage.periodStart <= periodEnd &&
    wage.periodEnd >= periodStart &&
    wage.age <= age
  )
  
  if (wages.length === 0) return null
  
  // Get the most appropriate wage (highest age threshold that applies)
  wages.sort((a, b) => b.age - a.age)
  return wages[0]
}

export function listMinimumWages(): MinimumWage[] {
  return [...minimumWages].sort((a, b) =>
    a.periodStart.localeCompare(b.periodStart)
  )
}

/**
 * Pension Schemes Management
 */
export function addPensionScheme(scheme: Omit<PensionScheme, 'id' | 'createdAt'>): PensionScheme {
  const id = `PS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const newScheme: PensionScheme = {
    ...scheme,
    id,
    createdAt: new Date()
  }
  pensionSchemes.push(newScheme)
  return newScheme
}

export function getPensionScheme(id: string): PensionScheme | null {
  return pensionSchemes.find(s => s.id === id) || null
}

export function getPensionSchemeForPeriod(id: string, periodStart: string, periodEnd: string): PensionScheme | null {
  const scheme = getPensionScheme(id)
  if (!scheme) return null
  
  if (scheme.periodStart <= periodEnd && scheme.periodEnd >= periodStart) {
    return scheme
  }
  
  return null
}

export function listPensionSchemes(): PensionScheme[] {
  return [...pensionSchemes].sort((a, b) =>
    a.periodStart.localeCompare(b.periodStart)
  )
}

/**
 * Period Coverage Check
 * Check if all required rates are available for a period range
 */
export function checkPeriodCoverage(periodStart: string, periodEnd: string): {
  covered: boolean
  missing: string[]
  warnings: string[]
} {
  const missing: string[] = []
  const warnings: string[] = []
  
  // Check tax tables
  const taxTableTypes: string[] = ['loonheffing', 'loonheffing_korting', 'loonheffing_arbeidskorting']
  for (const tableType of taxTableTypes) {
    const tables = getTaxTablesForPeriod(periodStart, periodEnd, tableType)
    if (tables.length === 0) {
      missing.push(`Tax table: ${tableType}`)
    } else if (tables.length > 1) {
      warnings.push(`Multiple tax tables for ${tableType} - may cause conflicts`)
    }
  }
  
  // Check social security
  const socialSecurity = getSocialSecurityForPeriod(periodStart, periodEnd)
  if (!socialSecurity) {
    missing.push('Social security rates')
  }
  
  // Check minimum wage
  const minimumWage = getMinimumWageForPeriod(periodStart, periodEnd)
  if (!minimumWage) {
    missing.push('Minimum wage')
  }
  
  return {
    covered: missing.length === 0,
    missing,
    warnings
  }
}

/**
 * Import rates from JSON
 */
export function importRatesFromJson(data: {
  taxTables?: Array<Omit<TaxTable, 'id' | 'createdAt'>>
  socialSecurity?: Array<Omit<SocialSecurity, 'id' | 'createdAt'>>
  minimumWages?: Array<Omit<MinimumWage, 'id' | 'createdAt'>>
  pensionSchemes?: Array<Omit<PensionScheme, 'id' | 'createdAt'>>
}): {
  taxTables: number
  socialSecurity: number
  minimumWages: number
  pensionSchemes: number
} {
  let taxTablesCount = 0
  let socialSecurityCount = 0
  let minimumWagesCount = 0
  let pensionSchemesCount = 0
  
  if (data.taxTables) {
    data.taxTables.forEach(table => {
      addTaxTable(table)
      taxTablesCount++
    })
  }
  
  if (data.socialSecurity) {
    data.socialSecurity.forEach(rate => {
      addSocialSecurityRate(rate)
      socialSecurityCount++
    })
  }
  
  if (data.minimumWages) {
    data.minimumWages.forEach(wage => {
      addMinimumWage(wage)
      minimumWagesCount++
    })
  }
  
  if (data.pensionSchemes) {
    data.pensionSchemes.forEach(scheme => {
      addPensionScheme(scheme)
      pensionSchemesCount++
    })
  }
  
  return {
    taxTables: taxTablesCount,
    socialSecurity: socialSecurityCount,
    minimumWages: minimumWagesCount,
    pensionSchemes: pensionSchemesCount
  }
}

