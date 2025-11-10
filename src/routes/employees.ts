import { Router } from 'express'
import { addEmployee, getEmployeeById, listEmployees } from '../services/employeeRegistry.js'
import type { ContractType } from '../data/dummy.js'

const requiredFields = [
  'firstName',
  'lastName',
  'email',
  'startDate',
  'annualSalaryEuros',
  'hoursPerWeek',
  'workingDaysPerWeek',
  'department',
  'role',
  'location',
  'contractType'
] as const

export const employeesRouter = Router()

employeesRouter.get('/', (_req, res) => {
  const payload = listEmployees().map(e => ({
    id: e.id,
    firstName: e.firstName,
    lastName: e.lastName,
    email: e.email,
    startDate: e.startDate,
    endDate: e.endDate ?? null,
    department: e.department,
    role: e.role,
    contractType: e.contractType,
    location: e.location,
    hoursPerWeek: e.hoursPerWeek,
    workingDaysPerWeek: e.workingDaysPerWeek,
    holidayDaysPerYear: e.holidayDaysPerYear,
    isThirtyPercentRuling: e.isThirtyPercentRuling
  }))
  res.json(payload)
})

employeesRouter.get('/:id', (req, res) => {
  const e = getEmployeeById(req.params.id)
  if (!e) return res.status(404).json({ error: 'Not found' })
  res.json(e)
})

employeesRouter.post('/', (req, res) => {
  const payload = (req.body ?? {}) as Record<string, any>
  const missing = requiredFields.filter(field => !(field in payload) || payload[field] === '' || payload[field] === undefined)
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` })
  }

  const annualSalaryEuros = Number(payload.annualSalaryEuros)
  const hoursPerWeek = Number(payload.hoursPerWeek)
  const workingDaysPerWeek = Number(payload.workingDaysPerWeek)
  const holidayDaysPerYear = payload.holidayDaysPerYear !== undefined ? Number(payload.holidayDaysPerYear) : 25
  const contractTypeInput = String(payload.contractType)

  if (!['permanent', 'fixed-term', 'contractor'].includes(contractTypeInput)) {
    return res.status(400).json({ error: 'contractType must be permanent, fixed-term or contractor' })
  }

  const contractType = contractTypeInput as ContractType

  if (!Number.isFinite(annualSalaryEuros) || annualSalaryEuros <= 0) {
    return res.status(400).json({ error: 'annualSalaryEuros must be a positive number' })
  }
  if (!Number.isFinite(hoursPerWeek) || hoursPerWeek <= 0) {
    return res.status(400).json({ error: 'hoursPerWeek must be a positive number' })
  }
  if (!Number.isFinite(workingDaysPerWeek) || workingDaysPerWeek <= 0) {
    return res.status(400).json({ error: 'workingDaysPerWeek must be a positive number' })
  }
  if (!Number.isFinite(holidayDaysPerYear) || holidayDaysPerYear <= 0) {
    return res.status(400).json({ error: 'holidayDaysPerYear must be a positive number' })
  }

  const record = addEmployee({
    id: payload.id,
    firstName: String(payload.firstName),
    lastName: String(payload.lastName),
    email: String(payload.email),
    startDate: String(payload.startDate),
    endDate: payload.endDate ? String(payload.endDate) : null,
    iban: String(payload.iban ?? ''),
    bic: payload.bic ? String(payload.bic) : null,
    annualSalaryCents: Math.round(annualSalaryEuros * 100),
    hoursPerWeek,
    workingDaysPerWeek,
    role: String(payload.role),
    department: String(payload.department),
    location: String(payload.location),
    contractType,
    isThirtyPercentRuling: Boolean(payload.isThirtyPercentRuling),
    holidayAllowanceEligible: payload.holidayAllowanceEligible !== undefined ? Boolean(payload.holidayAllowanceEligible) : true,
    holidayDaysPerYear,
    carriedOverHolidayDays: Number(payload.carriedOverHolidayDays ?? 0),
    usedHolidayDaysYtd: Number(payload.usedHolidayDaysYtd ?? 0),
    unpaidLeaveDaysCurrentMonth: Number(payload.unpaidLeaveDaysCurrentMonth ?? 0),
    holidayAllowanceAccruedCentsYtd: Number(payload.holidayAllowanceAccruedCentsYtd ?? 0),
    holidayAllowancePaidCentsYtd: Number(payload.holidayAllowancePaidCentsYtd ?? 0),
    pendingExpenseClaimsCents: Number(payload.pendingExpenseClaimsCents ?? 0)
  })

  res.status(201).json(record)
})
