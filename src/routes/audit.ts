import { Router } from 'express'
import { getAuditLogs, getRecentAuditLogs, getAuditLogsByEventType } from '../services/audit.js'

export const auditRouter = Router()

// Get audit logs with optional filters
auditRouter.get('/', (req, res) => {
  try {
    const { eventType, userId, startDate, endDate, limit } = req.query

    const filters: any = {}
    if (eventType) filters.eventType = eventType as string
    if (userId) filters.userId = userId as string
    if (startDate) filters.startDate = new Date(startDate as string)
    if (endDate) filters.endDate = new Date(endDate as string)
    if (limit) filters.limit = parseInt(limit as string, 10)

    const logs = getAuditLogs(filters)
    res.json({ logs: logs.map(log => ({
      id: log.id,
      eventType: log.eventType,
      userId: log.userId,
      data: log.data,
      timestamp: log.timestamp.toISOString(),
      ipAddress: log.ipAddress
    })) })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Get recent audit logs
auditRouter.get('/recent', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50
    const logs = getRecentAuditLogs(limit)
    res.json({ logs: logs.map(log => ({
      id: log.id,
      eventType: log.eventType,
      userId: log.userId,
      data: log.data,
      timestamp: log.timestamp.toISOString(),
      ipAddress: log.ipAddress
    })) })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Get audit logs by event type
auditRouter.get('/event-type/:eventType', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100
    const logs = getAuditLogsByEventType(req.params.eventType as any, limit)
    res.json({ logs: logs.map(log => ({
      id: log.id,
      eventType: log.eventType,
      userId: log.userId,
      data: log.data,
      timestamp: log.timestamp.toISOString(),
      ipAddress: log.ipAddress
    })) })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

