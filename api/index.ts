import express from 'express'
import helmet from 'helmet'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { payroll } from '../src/routes/payroll.js'
import { employeesRouter } from '../src/routes/employees.js'
import { calculators } from '../src/routes/calculators.js'
import { joinersRouter } from '../src/routes/joiners.js'
import { offboardingRouter } from '../src/routes/offboarding.js'
import { payrollRunsRouter } from '../src/routes/payrollRuns.js'
import { auditRouter } from '../src/routes/audit.js'
import { mockServicesRouter } from '../src/routes/mockServices.js'
import { pensionRouter } from '../src/routes/pension.js'
import { healthInsuranceRouter } from '../src/routes/healthInsurance.js'
import { jaaropgaveRouter } from '../src/routes/jaaropgave.js'
import { taxFilingRouter } from '../src/routes/taxFiling.js'
import { employeeHistoryRouter } from '../src/routes/employeeHistory.js'
import { taxConfigurationRouter } from '../src/routes/taxConfiguration.js'
import { ratesRouter } from '../src/routes/rates.js'
import { loonaangifteRouter } from '../src/routes/loonaangifte.js'
import { triggerScheduledPayroll } from '../src/services/scheduler.js'

const app = express()
app.use(helmet({ contentSecurityPolicy: false })) // allow our inline script to run
app.use(express.json())

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const publicDir = path.join(__dirname, '..', 'public')
app.use(express.static(publicDir))

app.get('/health', (_req, res) => res.json({ ok: true }))

// Existing routes
app.use('/api/payroll', payroll)
app.use('/api/employees', employeesRouter)
app.use('/api/calculators', calculators)
app.use('/api/joiners', joinersRouter)
app.use('/api/offboarding', offboardingRouter)

// New routes
app.use('/api/payroll-runs', payrollRunsRouter)
app.use('/api/audit', auditRouter)
app.use('/api/mock-services', mockServicesRouter)
app.use('/api/pension', pensionRouter)
app.use('/api/health-insurance', healthInsuranceRouter)
app.use('/api/jaaropgave', jaaropgaveRouter)
app.use('/api/tax-filing', taxFilingRouter)
app.use('/api/employee-history', employeeHistoryRouter)
app.use('/api/tax-configuration', taxConfigurationRouter)
app.use('/api/rates', ratesRouter)
app.use('/api/loonaangifte', loonaangifteRouter)

// Vercel Cron endpoint for scheduled payroll
// Accepts both GET (from Vercel cron) and POST (for manual triggers)
app.all('/api/cron/payroll', async (_req, res) => {
  try {
    await triggerScheduledPayroll()
    res.json({ success: true, message: 'Scheduled payroll triggered' })
  } catch (error) {
    console.error('Error in cron payroll:', error)
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
  }
})

app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')))

// Export the app for Vercel serverless functions
export default app

