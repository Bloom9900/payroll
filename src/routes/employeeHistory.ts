import { Router } from 'express'
import { getEmployeeHistory, getAllEmployeeHistory, getRecentEmployeeChanges } from '../services/employeeHistory.js'

export const employeeHistoryRouter = Router()

// Get employee history
employeeHistoryRouter.get('/employee/:employeeId', (req, res) => {
  try {
    const history = getEmployeeHistory(req.params.employeeId)
    res.json({
      employeeId: req.params.employeeId,
      history: history.map(change => ({
        id: change.id,
        changeType: change.changeType,
        changes: change.changes,
        changedBy: change.changedBy,
        changedAt: change.changedAt.toISOString()
      }))
    })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Get all employee history
employeeHistoryRouter.get('/', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100
    const history = getAllEmployeeHistory(limit)
    res.json({
      history: history.map(change => ({
        id: change.id,
        employeeId: change.employeeId,
        changeType: change.changeType,
        changes: change.changes,
        changedBy: change.changedBy,
        changedAt: change.changedAt.toISOString()
      }))
    })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Get recent employee changes
employeeHistoryRouter.get('/recent', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50
    const changes = getRecentEmployeeChanges(limit)
    res.json({
      changes: changes.map(change => ({
        id: change.id,
        employeeId: change.employeeId,
        changeType: change.changeType,
        changes: change.changes,
        changedBy: change.changedBy,
        changedAt: change.changedAt.toISOString()
      }))
    })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

