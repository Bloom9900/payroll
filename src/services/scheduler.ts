import { createPayrollRun } from './payrollRun.js'
import { logAuditEvent } from './audit.js'

let schedulerRunning = false
let scheduledJob: NodeJS.Timeout | null = null

export function startScheduler(): void {
  if (schedulerRunning) {
    console.log('Scheduler is already running')
    return
  }

  console.log('Starting payroll scheduler...')
  schedulerRunning = true

  // Check every hour if it's the 25th of the month at 9 AM
  scheduledJob = setInterval(() => {
    const now = new Date()
    const day = now.getDate()
    const hour = now.getHours()

    // Run on the 25th at 9 AM
    if (day === 25 && hour === 9) {
      runScheduledPayroll()
    }
  }, 60 * 60 * 1000) // Check every hour

  console.log('Payroll scheduler started - will run on 25th of each month at 9 AM')
}

export function stopScheduler(): void {
  if (scheduledJob) {
    clearInterval(scheduledJob)
    scheduledJob = null
  }
  schedulerRunning = false
  console.log('Scheduler stopped')
}

export function isSchedulerRunning(): boolean {
  return schedulerRunning
}

async function runScheduledPayroll(): Promise<void> {
  try {
    const month = new Date().toISOString().slice(0, 7) // YYYY-MM format
    
    console.log(`Running scheduled payroll for ${month}...`)
    
    // Check if payroll run already exists for this month
    const { getPayrollRunByMonth } = await import('./payrollRun.js')
    const existingRun = getPayrollRunByMonth(month)
    
    if (existingRun) {
      console.log(`Payroll run for ${month} already exists`)
      return
    }

    // Create payroll run
    const run = createPayrollRun(month)
    
    logAuditEvent('payroll_run_scheduled', {
      payrollRunId: run.id,
      month,
      employeeCount: run.calculations.length,
      totalGross: run.totals.grossCents / 100,
      totalNet: run.totals.netCents / 100
    })

    console.log(`Payroll run created: ${run.id} for ${month}`)
    console.log(`Employees: ${run.calculations.length}, Total Net: €${(run.totals.netCents / 100).toFixed(2)}`)
  } catch (error) {
    console.error('Error running scheduled payroll:', error)
    logAuditEvent('payroll_run_error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      month: new Date().toISOString().slice(0, 7)
    })
  }
}

// Manual trigger for testing
export function triggerScheduledPayroll(): Promise<void> {
  return runScheduledPayroll()
}

