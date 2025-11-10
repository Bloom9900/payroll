import { Router } from 'express'
import { 
  calculatePensionContribution, 
  calculateMonthlyPensionContributions,
  getPensionProvider
} from '../services/pension.js'
import { listEmployees, getEmployeeById } from '../services/employeeRegistry.js'

export const pensionRouter = Router()

// Calculate pension for employee
pensionRouter.get('/employee/:employeeId', (req, res) => {
  try {
    const employee = getEmployeeById(req.params.employeeId)
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' })
    }

    const grossMonthly = employee.annualSalaryCents / 12
    const employeeRate = req.query.employeeRate ? parseFloat(req.query.employeeRate as string) : 0.04
    const employerRate = req.query.employerRate ? parseFloat(req.query.employerRate as string) : 0.04

    const calculation = calculatePensionContribution(employee, grossMonthly, employeeRate, employerRate)
    const provider = getPensionProvider(employee)

    res.json({
      employee: {
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName}`
      },
      provider,
      calculation: {
        grossSalary: calculation.grossSalary / 100,
        employeeRate: calculation.employeeRate,
        employerRate: calculation.employerRate,
        employeeContribution: calculation.employeeContribution / 100,
        employerContribution: calculation.employerContribution / 100,
        totalContribution: calculation.totalContribution / 100
      }
    })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Calculate monthly pension contributions for all employees
pensionRouter.get('/monthly/:month', (req, res) => {
  try {
    const employees = listEmployees()
    const employeeRate = req.query.employeeRate ? parseFloat(req.query.employeeRate as string) : 0.04
    const employerRate = req.query.employerRate ? parseFloat(req.query.employerRate as string) : 0.04

    const calculations = calculateMonthlyPensionContributions(employees, req.params.month, employeeRate, employerRate)

    const totalEmployee = calculations.reduce((sum, c) => sum + c.employeeContribution, 0)
    const totalEmployer = calculations.reduce((sum, c) => sum + c.employerContribution, 0)
    const total = calculations.reduce((sum, c) => sum + c.totalContribution, 0)

    res.json({
      month: req.params.month,
      calculations: calculations.map(c => ({
        employee: {
          id: c.employee.id,
          name: `${c.employee.firstName} ${c.employee.lastName}`
        },
        provider: getPensionProvider(c.employee),
        grossSalary: c.grossSalary / 100,
        employeeRate: c.employeeRate,
        employerRate: c.employerRate,
        employeeContribution: c.employeeContribution / 100,
        employerContribution: c.employerContribution / 100,
        totalContribution: c.totalContribution / 100
      })),
      totals: {
        totalEmployee: totalEmployee / 100,
        totalEmployer: totalEmployer / 100,
        total: total / 100
      }
    })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

