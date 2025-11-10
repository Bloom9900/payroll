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

const app = express()
app.use(helmet({ contentSecurityPolicy: false })) // allow our inline script to run
app.use(express.json())

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const publicDir = path.join(__dirname, '..', 'public')
app.use(express.static(publicDir))

app.get('/health', (_req,res)=>res.json({ ok:true }))

app.use('/api/payroll', payroll)
app.use('/api/employees', employeesRouter)
app.use('/api/calculators', calculators)
app.use('/api/joiners', joinersRouter)
app.use('/api/offboarding', offboardingRouter)

app.get('*', (_req,res)=>res.sendFile(path.join(publicDir,'index.html')))

app.listen(config.port, ()=> console.log('Server on port ' + config.port))
