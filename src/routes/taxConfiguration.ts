import { Router } from 'express'
import {
  getTaxConfiguration,
  updateTaxConfiguration,
  importTaxConfiguration,
  listTaxConfigurations,
  type TaxBracket,
  type SocialSecurityRates
} from '../services/taxConfiguration.js'
import { centsToEuro } from '../utils/currency.js'

export const taxConfigurationRouter = Router()

/**
 * Get tax configuration for a specific period
 * GET /tax-configuration/:period
 */
taxConfigurationRouter.get('/:period', (req, res) => {
  try {
    const { period } = req.params
    const config = getTaxConfiguration(period)
    
    res.json({
      period: config.period,
      year: config.year,
      month: config.month,
      taxBrackets: config.taxBrackets.map(b => ({
        limit: centsToEuro(b.limit),
        rate: b.rate,
        ratePercent: (b.rate * 100).toFixed(2) + '%'
      })),
      socialSecurityRates: {
        aow: config.socialSecurityRates.aow,
        anw: config.socialSecurityRates.anw,
        wlz: config.socialSecurityRates.wlz,
        ww: config.socialSecurityRates.ww,
        wia: config.socialSecurityRates.wia,
        total: config.socialSecurityRates.total,
        aowPercent: (config.socialSecurityRates.aow * 100).toFixed(2) + '%',
        anwPercent: (config.socialSecurityRates.anw * 100).toFixed(2) + '%',
        wlzPercent: (config.socialSecurityRates.wlz * 100).toFixed(2) + '%',
        wwPercent: (config.socialSecurityRates.ww * 100).toFixed(2) + '%',
        wiaPercent: (config.socialSecurityRates.wia * 100).toFixed(2) + '%',
        totalPercent: (config.socialSecurityRates.total * 100).toFixed(2) + '%'
      },
      socialSecurityCeiling: centsToEuro(config.socialSecurityCeilingCents),
      wageTaxCredit: {
        base: centsToEuro(config.wageTaxCreditBaseCents),
        rate: config.wageTaxCreditRate,
        ratePercent: (config.wageTaxCreditRate * 100).toFixed(2) + '%',
        max: centsToEuro(config.wageTaxCreditMaxCents)
      },
      minimumWageFullTime: centsToEuro(config.minimumWageFullTimeCents),
      healthInsuranceEmployerRate: config.healthInsuranceEmployerRate,
      healthInsuranceEmployerRatePercent: (config.healthInsuranceEmployerRate * 100).toFixed(2) + '%',
      pensionBaseRate: config.pensionBaseRate,
      pensionBaseRatePercent: (config.pensionBaseRate * 100).toFixed(2) + '%',
      lastUpdated: config.lastUpdated.toISOString(),
      source: config.source
    })
  } catch (err) {
    res.status(400).json({ error: (err as Error).message })
  }
})

/**
 * List all tax configurations
 * GET /tax-configuration
 */
taxConfigurationRouter.get('/', (req, res) => {
  try {
    const configs = listTaxConfigurations()
    res.json({
      configurations: configs.map(config => ({
        period: config.period,
        year: config.year,
        month: config.month,
        lastUpdated: config.lastUpdated.toISOString(),
        source: config.source
      }))
    })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

/**
 * Update tax configuration for a period
 * PUT /tax-configuration/:period
 */
taxConfigurationRouter.put('/:period', (req, res) => {
  try {
    const { period } = req.params
    const body = req.body

    // Convert tax brackets from euros to cents if provided
    const taxBrackets = body.taxBrackets ? body.taxBrackets.map((b: { limit: number, rate: number }) => ({
      limit: Math.round(b.limit * 100), // Convert euros to cents
      rate: b.rate
    })) : undefined

    // Convert social security rates if provided
    const socialSecurityRates = body.socialSecurityRates ? {
      aow: body.socialSecurityRates.aow,
      anw: body.socialSecurityRates.anw,
      wlz: body.socialSecurityRates.wlz,
      ww: body.socialSecurityRates.ww,
      wia: body.socialSecurityRates.wia,
      total: body.socialSecurityRates.total
    } : undefined

    const updates: any = {}
    if (taxBrackets) updates.taxBrackets = taxBrackets
    if (socialSecurityRates) updates.socialSecurityRates = socialSecurityRates
    if (body.socialSecurityCeiling !== undefined) {
      updates.socialSecurityCeilingCents = Math.round(body.socialSecurityCeiling * 100)
    }
    if (body.wageTaxCreditBase !== undefined) {
      updates.wageTaxCreditBaseCents = Math.round(body.wageTaxCreditBase * 100)
    }
    if (body.wageTaxCreditRate !== undefined) updates.wageTaxCreditRate = body.wageTaxCreditRate
    if (body.wageTaxCreditMax !== undefined) {
      updates.wageTaxCreditMaxCents = Math.round(body.wageTaxCreditMax * 100)
    }
    if (body.minimumWageFullTime !== undefined) {
      updates.minimumWageFullTimeCents = Math.round(body.minimumWageFullTime * 100)
    }
    if (body.healthInsuranceEmployerRate !== undefined) {
      updates.healthInsuranceEmployerRate = body.healthInsuranceEmployerRate
    }
    if (body.pensionBaseRate !== undefined) updates.pensionBaseRate = body.pensionBaseRate

    const updated = updateTaxConfiguration(period, updates)
    
    res.json({
      period: updated.period,
      message: 'Tax configuration updated successfully',
      lastUpdated: updated.lastUpdated.toISOString()
    })
  } catch (err) {
    res.status(400).json({ error: (err as Error).message })
  }
})

/**
 * Import tax configuration from external source (e.g., Belastingdienst API)
 * POST /tax-configuration/:period/import
 */
taxConfigurationRouter.post('/:period/import', (req, res) => {
  try {
    const { period } = req.params
    const body = req.body

    // Convert from API format (euros) to internal format (cents)
    const importData: any = {}
    
    if (body.taxBrackets) {
      importData.taxBrackets = body.taxBrackets.map((b: { limit: number, rate: number }) => ({
        limit: Math.round(b.limit * 100),
        rate: b.rate
      }))
    }

    if (body.socialSecurityRates) {
      importData.socialSecurityRates = {
        aow: body.socialSecurityRates.aow,
        anw: body.socialSecurityRates.anw,
        wlz: body.socialSecurityRates.wlz,
        ww: body.socialSecurityRates.ww,
        wia: body.socialSecurityRates.wia
      }
    }

    if (body.socialSecurityCeiling !== undefined) {
      importData.socialSecurityCeilingCents = Math.round(body.socialSecurityCeiling * 100)
    }

    if (body.wageTaxCreditBase !== undefined) {
      importData.wageTaxCreditBaseCents = Math.round(body.wageTaxCreditBase * 100)
    }

    if (body.wageTaxCreditRate !== undefined) {
      importData.wageTaxCreditRate = body.wageTaxCreditRate
    }

    if (body.wageTaxCreditMax !== undefined) {
      importData.wageTaxCreditMaxCents = Math.round(body.wageTaxCreditMax * 100)
    }

    if (body.minimumWageFullTime !== undefined) {
      importData.minimumWageFullTimeCents = Math.round(body.minimumWageFullTime * 100)
    }

    if (body.healthInsuranceEmployerRate !== undefined) {
      importData.healthInsuranceEmployerRate = body.healthInsuranceEmployerRate
    }

    const imported = importTaxConfiguration(period, importData)
    
    res.json({
      period: imported.period,
      message: 'Tax configuration imported successfully',
      lastUpdated: imported.lastUpdated.toISOString(),
      source: imported.source
    })
  } catch (err) {
    res.status(400).json({ error: (err as Error).message })
  }
})

/**
 * Sync tax configuration from Belastingdienst API (mock implementation)
 * POST /tax-configuration/:period/sync
 */
taxConfigurationRouter.post('/:period/sync', async (req, res) => {
  try {
    const { period } = req.params
    
    // In a real implementation, this would call the Belastingdienst API
    // For now, this is a mock that simulates API sync
    // In production, you would:
    // 1. Call Belastingdienst API with the period
    // 2. Parse the response
    // 3. Import the configuration
    
    // Mock API response structure
    const mockApiResponse = {
      taxBrackets: [
        { limit: 37149, rate: 0.3697 },
        { limit: 75518, rate: 0.495 },
        { limit: Number.POSITIVE_INFINITY, rate: 0.495 }
      ],
      socialSecurityRates: {
        aow: 0.175,
        anw: 0.001,
        wlz: 0.095,
        ww: 0.004,
        wia: 0.0025
      },
      socialSecurityCeiling: 37149,
      wageTaxCreditBase: 30700,
      wageTaxCreditRate: 0.07307,
      wageTaxCreditMax: 30700,
      minimumWageFullTime: 2070,
      healthInsuranceEmployerRate: 0.0682
    }

    const importData: any = {
      taxBrackets: mockApiResponse.taxBrackets.map(b => ({
        limit: Math.round(b.limit * 100),
        rate: b.rate
      })),
      socialSecurityRates: mockApiResponse.socialSecurityRates,
      socialSecurityCeilingCents: Math.round(mockApiResponse.socialSecurityCeiling * 100),
      wageTaxCreditBaseCents: Math.round(mockApiResponse.wageTaxCreditBase * 100),
      wageTaxCreditRate: mockApiResponse.wageTaxCreditRate,
      wageTaxCreditMaxCents: Math.round(mockApiResponse.wageTaxCreditMax * 100),
      minimumWageFullTimeCents: Math.round(mockApiResponse.minimumWageFullTime * 100),
      healthInsuranceEmployerRate: mockApiResponse.healthInsuranceEmployerRate
    }

    const synced = importTaxConfiguration(period, importData)
    
    res.json({
      period: synced.period,
      message: 'Tax configuration synced from Belastingdienst API (mock)',
      lastUpdated: synced.lastUpdated.toISOString(),
      source: synced.source
    })
  } catch (err) {
    res.status(400).json({ error: (err as Error).message })
  }
})

