import { Router } from 'express'
import { 
  generateJaaropgave, 
  getJaaropgave, 
  getJaaropgaveByEmployee, 
  listJaaropgaves,
  generateAllJaaropgaves
} from '../services/jaaropgave.js'
import { listEmployees, getEmployeeById } from '../services/employeeRegistry.js'
import { logAuditEvent } from '../services/audit.js'

export const jaaropgaveRouter = Router()

// Generate jaaropgave for employee
jaaropgaveRouter.post('/generate', (req, res) => {
  try {
    const { employeeId, year } = req.body
    if (!employeeId || !year) {
      return res.status(400).json({ error: 'employeeId and year are required' })
    }

    const employee = getEmployeeById(employeeId)
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' })
    }

    const jaaropgave = generateJaaropgave(employee, year)
    logAuditEvent('jaaropgave_generated', {
      jaaropgaveId: jaaropgave.id,
      employeeId,
      year
    })

    res.status(201).json({
      id: jaaropgave.id,
      employeeId: jaaropgave.employeeId,
      year: jaaropgave.year,
      generatedAt: jaaropgave.generatedAt.toISOString(),
      data: {
        employee: {
          id: jaaropgave.data.employee.id,
          name: `${jaaropgave.data.employee.firstName} ${jaaropgave.data.employee.lastName}`
        },
        year: jaaropgave.data.year,
        annualGross: jaaropgave.data.annualGross,
        annualNet: jaaropgave.data.annualNet,
        annualTax: jaaropgave.data.annualTax,
        annualSocialSecurity: jaaropgave.data.annualSocialSecurity,
        annualHolidayAllowance: jaaropgave.data.annualHolidayAllowance,
        ruling30Amount: jaaropgave.data.ruling30Amount,
        monthlyBreakdown: jaaropgave.data.monthlyBreakdown
      }
    })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Generate jaaropgaves for all employees
jaaropgaveRouter.post('/generate-all', (req, res) => {
  try {
    const { year } = req.body
    if (!year) {
      return res.status(400).json({ error: 'year is required' })
    }

    const employees = listEmployees()
    const jaaropgaves = generateAllJaaropgaves(year, employees)

    logAuditEvent('jaaropgave_generated', {
      count: jaaropgaves.length,
      year
    })

    res.status(201).json({
      count: jaaropgaves.length,
      jaaropgaves: jaaropgaves.map(j => ({
        id: j.id,
        employeeId: j.employeeId,
        year: j.year,
        generatedAt: j.generatedAt.toISOString()
      }))
    })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Get jaaropgave
jaaropgaveRouter.get('/:id', (req, res) => {
  try {
    const jaaropgave = getJaaropgave(req.params.id)
    if (!jaaropgave) {
      return res.status(404).json({ error: 'Jaaropgave not found' })
    }

    res.json({
      id: jaaropgave.id,
      employeeId: jaaropgave.employeeId,
      year: jaaropgave.year,
      generatedAt: jaaropgave.generatedAt.toISOString(),
      data: jaaropgave.data
    })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// List jaaropgaves
jaaropgaveRouter.get('/', (req, res) => {
  try {
    const employeeId = req.query.employeeId as string | undefined
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined

    const jaaropgaves = listJaaropgaves(employeeId, year)
    res.json({
      jaaropgaves: jaaropgaves.map(j => ({
        id: j.id,
        employeeId: j.employeeId,
        year: j.year,
        generatedAt: j.generatedAt.toISOString(),
        annualGross: j.data.annualGross,
        annualNet: j.data.annualNet
      }))
    })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

