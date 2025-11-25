import express from 'express'
import helmet from 'helmet'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from './config.js'
import { payroll } from './routes/payroll.js'
import { employeesRouter } from './routes/employees.js'
import { calculators } from './routes/calculators.js'
import { joinersRouter } from './routes/joiners.js'
import { offboardingRouter } from './routes/offboarding.js'
import { payrollRunsRouter } from './routes/payrollRuns.js'
import { auditRouter } from './routes/audit.js'
import { mockServicesRouter } from './routes/mockServices.js'
import { pensionRouter } from './routes/pension.js'
import { healthInsuranceRouter } from './routes/healthInsurance.js'
import { jaaropgaveRouter } from './routes/jaaropgave.js'
import { taxFilingRouter } from './routes/taxFiling.js'
import { employeeHistoryRouter } from './routes/employeeHistory.js'
import { taxConfigurationRouter } from './routes/taxConfiguration.js'
import { ratesRouter } from './routes/rates.js'
import { loonaangifteRouter } from './routes/loonaangifte.js'
import { startScheduler } from './services/scheduler.js'

const app = express()
app.use(helmet({ contentSecurityPolicy: false })) // allow our inline script to run
app.use(express.json())

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const publicDir = path.join(__dirname, '..', 'public')
app.use(express.static(publicDir))

app.get('/health', (_req,res)=>res.json({ ok:true }))

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

app.get('*', (_req,res)=>res.sendFile(path.join(publicDir,'index.html')))

// Start scheduler only if not in serverless environment (Vercel)
// On Vercel, use cron jobs instead (see vercel.json and api/index.ts)
if (!process.env.VERCEL) {
  startScheduler()
}

// Only start listening if not in serverless environment
if (!process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log('Server on port ' + config.port)
    if (!process.env.VERCEL) {
      console.log('Payroll scheduler started')
    } else {
      console.log('Running on Vercel - scheduler uses cron jobs')
    }
  })
}

// Export app for potential serverless use
export default app
