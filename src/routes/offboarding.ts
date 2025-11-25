import { Router } from 'express'
import { calculateOffboardingSummary, OffboardingPrimaryReason, OffboardingSecondaryReason } from '../services/offboarding.js'

export const offboardingRouter = Router()

offboardingRouter.get('/summary', (req, res) => {
  const { employeeId, exitDate, primaryReason, secondaryReason } = req.query as Record<string, string | undefined>
  if (!employeeId || !exitDate || !primaryReason) {
    return res.status(400).json({ error: 'employeeId, exitDate and primaryReason are required' })
  }

  const normalisedPrimary = normalisePrimaryReason(primaryReason)
  if (!normalisedPrimary) {
    return res.status(400).json({ error: 'primaryReason must be termination or resignation' })
  }

  const normalisedSecondary = secondaryReason ? normaliseSecondaryReason(secondaryReason) : undefined

  try {
    const summary = calculateOffboardingSummary({ 
      employeeId, 
      exitDate, 
      primaryReason: normalisedPrimary,
      secondaryReason: normalisedSecondary
    })
    if (!summary) return res.status(404).json({ error: 'Employee not found' })
    res.json(summary)
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to calculate offboarding summary' })
  }
})

function normalisePrimaryReason (value: string): OffboardingPrimaryReason | undefined {
  const lower = value.toLowerCase()
  if (lower === 'termination') return 'termination'
  if (lower === 'resignation') return 'resignation'
  return undefined
}

function normaliseSecondaryReason (value: string): OffboardingSecondaryReason | undefined {
  const lower = value.toLowerCase()
  if (lower === 'misconduct') return 'misconduct'
  if (lower === 'end-of-contract' || lower === 'end_of_contract' || lower === 'endofcontract') return 'end-of-contract'
  if (lower === 'mutual-agreement' || lower === 'mutual_agreement') return 'mutual-agreement'
  if (lower === 'redundancy') return 'redundancy'
  if (lower === 'retirement') return 'retirement'
  if (lower === 'other') return 'other'
  return undefined
}
