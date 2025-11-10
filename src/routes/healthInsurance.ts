import { Router } from 'express'
import { 
  calculateHealthInsurance, 
  calculateMonthlyHealthInsurance,
  getHealthInsuranceProvider
} from '../services/healthInsurance.js'
import { listEmployees, getEmployeeById } from '../services/employeeRegistry.js'

export const healthInsuranceRouter = Router()

// Calculate health insurance for employee
healthInsuranceRouter.get('/employee/:employeeId', (req, res) => {
  try {
    const employee = getEmployeeById(req.params.employeeId)
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' })
    }

    const monthlyPremium = req.query.monthlyPremium ? parseFloat(req.query.monthlyPremium as string) : 120
    const employerContributionRate = req.query.employerContributionRate ? parseFloat(req.query.employerContributionRate as string) : 0.5

    const calculation = calculateHealthInsurance(employee, monthlyPremium, employerContributionRate)
    const provider = getHealthInsuranceProvider(employee)

    res.json({
      employee: {
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName}`
      },
      provider,
      calculation: {
        employeePremium: calculation.employeePremium / 100,
        employerContribution: calculation.employerContribution / 100,
        totalPremium: calculation.totalPremium / 100
      }
    })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Calculate monthly health insurance for all employees
healthInsuranceRouter.get('/monthly', (req, res) => {
  try {
    const employees = listEmployees()
    const monthlyPremium = req.query.monthlyPremium ? parseFloat(req.query.monthlyPremium as string) : 120
    const employerContributionRate = req.query.employerContributionRate ? parseFloat(req.query.employerContributionRate as string) : 0.5

    const calculations = calculateMonthlyHealthInsurance(employees, monthlyPremium, employerContributionRate)

    const totalEmployee = calculations.reduce((sum, c) => sum + c.employeePremium, 0)
    const totalEmployer = calculations.reduce((sum, c) => sum + c.employerContribution, 0)
    const total = calculations.reduce((sum, c) => sum + c.totalPremium, 0)

    res.json({
      calculations: calculations.map(c => ({
        employee: {
          id: c.employee.id,
          name: `${c.employee.firstName} ${c.employee.lastName}`
        },
        provider: c.provider,
        employeePremium: c.employeePremium / 100,
        employerContribution: c.employerContribution / 100,
        totalPremium: c.totalPremium / 100
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

