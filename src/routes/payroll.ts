import { Router } from 'express'
import { employees } from '../data/dummy.js'
import { runMonthly } from '../services/payrollEngine.js'
import { config } from '../config.js'
import { buildPain001 } from '../services/sepa.js'

export const payroll = Router()

payroll.get('/preview/:month', (req, res) => {
  const month = req.params.month
  const rows = employees.map(e => {
    const r = runMonthly({
      annualSalaryCents: e.annualSalaryCents,
      holidayAllowanceEligible: e.holidayAllowanceEligible,
      isThirtyPercentRuling: e.isThirtyPercentRuling,
      month
    })
    return {
      employeeId: e.id,
      name: e.firstName + ' ' + e.lastName,
      email: e.email,
      gross: r.grossCents/100,
      holiday: r.holidayAllowanceCents/100,
      ruling30: r.ruling30Cents/100,
      taxable: r.taxableCents/100,
      net: r.netCents/100
    }
  })
  res.json({ period: month, currency: config.locale.currency, employees: rows })
})

payroll.post('/sepa/:month', (req, res) => {
  const month = req.params.month
  const payments = employees.map(e => {
    const r = runMonthly({
      annualSalaryCents: e.annualSalaryCents,
      holidayAllowanceEligible: e.holidayAllowanceEligible,
      isThirtyPercentRuling: e.isThirtyPercentRuling,
      month
    })
    return {
      endToEndId: 'SAL-' + e.id + '-' + month,
      name: e.firstName + ' ' + e.lastName,
      iban: e.iban,
      bic: e.bic ?? undefined,
      amount: r.netCents/100,
      remittance: 'Salary ' + month
    }
  })
  const xml = buildPain001({ name: config.company.name, iban: config.company.iban, bic: config.company.bic }, payments)
  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.send(xml)
})
