import { Router } from 'express'
import { getEmployeeById, listEmployees } from '../services/employeeRegistry.js'

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
