export type AuditEventType = 
  | 'payroll_run_created'
  | 'payroll_run_approved'
  | 'payroll_run_rejected'
  | 'payroll_run_completed'
  | 'payroll_run_scheduled'
  | 'payroll_run_error'
  | 'employee_created'
  | 'employee_updated'
  | 'employee_deleted'
  | 'sepa_file_generated'
  | 'tax_filing_submitted'
  | 'jaaropgave_generated'
  | 'pension_submission'
  | 'payment_submitted'
  | 'user_action'
  | 'system_event'

export type AuditLog = {
  id: string
  eventType: AuditEventType
  userId?: string
  data: Record<string, any>
  timestamp: Date
  ipAddress?: string
}

const auditLogs: AuditLog[] = []

export function logAuditEvent(
  eventType: AuditEventType,
  data: Record<string, any>,
  userId?: string,
  ipAddress?: string
): void {
  const log: AuditLog = {
    id: `AUDIT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    eventType,
    userId,
    data,
    timestamp: new Date(),
    ipAddress
  }

  auditLogs.push(log)
  console.log(`[AUDIT] ${eventType}:`, JSON.stringify(data))
}

export function getAuditLogs(
  filters?: {
    eventType?: AuditEventType
    userId?: string
    startDate?: Date
    endDate?: Date
    limit?: number
  }
): AuditLog[] {
  let logs = [...auditLogs]

  if (filters?.eventType) {
    logs = logs.filter(log => log.eventType === filters.eventType)
  }

  if (filters?.userId) {
    logs = logs.filter(log => log.userId === filters.userId)
  }

  if (filters?.startDate) {
    logs = logs.filter(log => log.timestamp >= filters.startDate!)
  }

  if (filters?.endDate) {
    logs = logs.filter(log => log.timestamp <= filters.endDate!)
  }

  // Sort by timestamp descending
  logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

  if (filters?.limit) {
    logs = logs.slice(0, filters.limit)
  }

  return logs
}

export function getAuditLog(id: string): AuditLog | undefined {
  return auditLogs.find(log => log.id === id)
}

export function getAuditLogsByEventType(eventType: AuditEventType, limit: number = 100): AuditLog[] {
  return getAuditLogs({ eventType, limit })
}

export function getRecentAuditLogs(limit: number = 50): AuditLog[] {
  return getAuditLogs({ limit })
}

