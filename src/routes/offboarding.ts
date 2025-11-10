import { Router } from 'express'
import { calculateOffboardingSummary, OffboardingReason } from '../services/offboarding.js'

export const offboardingRouter = Router()

offboardingRouter.get('/summary', (req, res) => {
  const { employeeId, exitDate, reason } = req.query as Record<string, string | undefined>
  if (!employeeId || !exitDate || !reason) {
    return res.status(400).json({ error: 'employeeId, exitDate and reason are required' })
  }

  const normalisedReason = normaliseReason(reason)
  if (!normalisedReason) {
    return res.status(400).json({ error: 'reason must be termination, resignation or end-of-contract' })
  }

  try {
    const summary = calculateOffboardingSummary({ employeeId, exitDate, reason: normalisedReason })
    if (!summary) return res.status(404).json({ error: 'Employee not found' })
    res.json(summary)
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to calculate offboarding summary' })
  }
})

function normaliseReason (value: string): OffboardingReason | undefined {
  const lower = value.toLowerCase()
  if (lower === 'termination') return 'termination'
  if (lower === 'resignation') return 'resignation'
  if (lower === 'end-of-contract' || lower === 'end_of_contract' || lower === 'endofcontract') return 'end-of-contract'
  return undefined
}
