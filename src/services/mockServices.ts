// Mock services for external integrations
// All data stored in-memory, can be viewed/managed in UI

export type MockSubmissionStatus = 'pending' | 'submitted' | 'processed' | 'failed' | 'confirmed'

export type MockBankSubmission = {
  id: string
  payrollRunId: string
  sepaFileName: string
  status: MockSubmissionStatus
  submittedAt?: Date
  processedAt?: Date
  confirmedAt?: Date
  errorMessage?: string
  transactionCount: number
  totalAmount: number
}

export type MockPensionSubmission = {
  id: string
  month: string
  employeeId: string
  employeeContribution: number
  employerContribution: number
  status: MockSubmissionStatus
  submittedAt?: Date
  confirmedAt?: Date
  provider: string
}

export type MockHealthInsuranceSubmission = {
  id: string
  month: string
  employeeId: string
  premium: number
  employerContribution: number
  status: MockSubmissionStatus
  submittedAt?: Date
  confirmedAt?: Date
  provider: string
}

export type MockTaxFiling = {
  id: string
  month: string
  status: MockSubmissionStatus
  submittedAt?: Date
  confirmedAt?: Date
  confirmationNumber?: string
  employeeCount: number
  totalGross: number
  totalTax: number
}

export type MockEmail = {
  id: string
  to: string
  subject: string
  body: string
  status: 'sent' | 'delivered' | 'read'
  sentAt: Date
  deliveredAt?: Date
  readAt?: Date
}

export type MockHrSync = {
  id: string
  syncDate: Date
  status: 'success' | 'failed'
  employeesAdded: number
  employeesUpdated: number
  employeesRemoved: number
  changes: Array<{
    employeeId: string
    changeType: 'added' | 'updated' | 'removed'
    changes: Record<string, any>
  }>
}

// In-memory storage
const bankSubmissions: MockBankSubmission[] = []
const pensionSubmissions: MockPensionSubmission[] = []
const healthInsuranceSubmissions: MockHealthInsuranceSubmission[] = []
const taxFilings: MockTaxFiling[] = []
const emails: MockEmail[] = []
const hrSyncs: MockHrSync[] = []

// Mock Bank Service
export function submitToBank(payrollRunId: string, sepaFileName: string, transactionCount: number, totalAmount: number): MockBankSubmission {
  const submission: MockBankSubmission = {
    id: `BANK-${Date.now()}`,
    payrollRunId,
    sepaFileName,
    status: 'submitted',
    submittedAt: new Date(),
    transactionCount,
    totalAmount
  }

  bankSubmissions.push(submission)

  // Simulate processing delay
  setTimeout(() => {
    submission.status = 'processed'
    submission.processedAt = new Date()
  }, 2000)

  return submission
}

export function getBankSubmission(id: string): MockBankSubmission | undefined {
  return bankSubmissions.find(s => s.id === id)
}

export function listBankSubmissions(): MockBankSubmission[] {
  return [...bankSubmissions].sort((a, b) => (b.submittedAt?.getTime() || 0) - (a.submittedAt?.getTime() || 0))
}

export function confirmBankPayment(id: string): MockBankSubmission | undefined {
  const submission = getBankSubmission(id)
  if (!submission) return undefined

  submission.status = 'confirmed'
  submission.confirmedAt = new Date()
  return submission
}

// Mock Pension Provider Service
export function submitPensionContribution(
  month: string,
  employeeId: string,
  employeeContribution: number,
  employerContribution: number,
  provider: string = 'PGGM'
): MockPensionSubmission {
  const submission: MockPensionSubmission = {
    id: `PENSION-${Date.now()}`,
    month,
    employeeId,
    employeeContribution,
    employerContribution,
    status: 'submitted',
    submittedAt: new Date(),
    provider
  }

  pensionSubmissions.push(submission)
  return submission
}

export function getPensionSubmission(id: string): MockPensionSubmission | undefined {
  return pensionSubmissions.find(s => s.id === id)
}

export function listPensionSubmissions(): MockPensionSubmission[] {
  return [...pensionSubmissions].sort((a, b) => (b.submittedAt?.getTime() || 0) - (a.submittedAt?.getTime() || 0))
}

// Mock Health Insurance Service
export function submitHealthInsurance(
  month: string,
  employeeId: string,
  premium: number,
  employerContribution: number,
  provider: string = 'Zilveren Kruis'
): MockHealthInsuranceSubmission {
  const submission: MockHealthInsuranceSubmission = {
    id: `INSURANCE-${Date.now()}`,
    month,
    employeeId,
    premium,
    employerContribution,
    status: 'submitted',
    submittedAt: new Date(),
    provider
  }

  healthInsuranceSubmissions.push(submission)
  return submission
}

export function getHealthInsuranceSubmission(id: string): MockHealthInsuranceSubmission | undefined {
  return healthInsuranceSubmissions.find(s => s.id === id)
}

export function listHealthInsuranceSubmissions(): MockHealthInsuranceSubmission[] {
  return [...healthInsuranceSubmissions].sort((a, b) => (b.submittedAt?.getTime() || 0) - (a.submittedAt?.getTime() || 0))
}

// Mock Tax Authority (Belastingdienst) Service
export function submitTaxFiling(month: string, employeeCount: number, totalGross: number, totalTax: number): MockTaxFiling {
  const filing: MockTaxFiling = {
    id: `TAX-${Date.now()}`,
    month,
    status: 'submitted',
    submittedAt: new Date(),
    confirmationNumber: `TAX-CONF-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    employeeCount,
    totalGross,
    totalTax
  }

  taxFilings.push(filing)

  // Simulate confirmation after delay
  setTimeout(() => {
    filing.status = 'confirmed'
    filing.confirmedAt = new Date()
  }, 3000)

  return filing
}

export function getTaxFiling(id: string): MockTaxFiling | undefined {
  return taxFilings.find(f => f.id === id)
}

export function listTaxFilings(): MockTaxFiling[] {
  return [...taxFilings].sort((a, b) => (b.submittedAt?.getTime() || 0) - (a.submittedAt?.getTime() || 0))
}

// Mock Email Service
export function sendEmail(to: string, subject: string, body: string): MockEmail {
  const email: MockEmail = {
    id: `EMAIL-${Date.now()}`,
    to,
    subject,
    body,
    status: 'sent',
    sentAt: new Date()
  }

  emails.push(email)

  // Simulate delivery
  setTimeout(() => {
    email.status = 'delivered'
    email.deliveredAt = new Date()
  }, 1000)

  return email
}

export function getEmail(id: string): MockEmail | undefined {
  return emails.find(e => e.id === id)
}

export function listEmails(limit: number = 50): MockEmail[] {
  return [...emails].sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime()).slice(0, limit)
}

// Mock HR System Sync
export function syncHrSystem(): MockHrSync {
  // Simulate HR sync - in reality this would fetch from HR system
  const sync: MockHrSync = {
    id: `HR-SYNC-${Date.now()}`,
    syncDate: new Date(),
    status: 'success',
    employeesAdded: 0,
    employeesUpdated: Math.floor(Math.random() * 3), // 0-2 employees updated
    employeesRemoved: 0,
    changes: []
  }

  hrSyncs.push(sync)
  return sync
}

export function getHrSync(id: string): MockHrSync | undefined {
  return hrSyncs.find(s => s.id === id)
}

export function listHrSyncs(): MockHrSync[] {
  return [...hrSyncs].sort((a, b) => b.syncDate.getTime() - a.syncDate.getTime())
}

