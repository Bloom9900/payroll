import { Router } from 'express'
import { config } from '../config.js'
import { buildPain001 } from '../services/sepa.js'
import { calculateMonthlyPayroll, HOLIDAY_ALLOWANCE_RATE, SOCIAL_SECURITY_RATE, STATUTORY_INTEREST_RATE } from '../services/netherlandsPayroll.js'
import { listEmployees } from '../services/employeeRegistry.js'

export const payroll = Router()

function centsToEuro (value: number): number {
  return Math.round(value) / 100
}

payroll.get('/preview/:month', (req, res) => {
  try {
    const month = req.params.month
    const paymentDate = typeof req.query.paymentDate === 'string' ? req.query.paymentDate : undefined
    const dueDate = typeof req.query.dueDate === 'string' ? req.query.dueDate : undefined

    const calculations = listEmployees().map(employee => calculateMonthlyPayroll({ employee, month, paymentDate, dueDate }))
      .filter(r => r.employment.proRatedFactor > 0 || r.amounts.allowances.holidayAllowancePaymentCents > 0 || r.amounts.adjustments.outstandingHolidayPayoutCents > 0)

    const totals = calculations.reduce((acc, r) => {
      acc.gross += r.amounts.grossCents
      acc.net += r.amounts.netCents
      acc.wageTax += r.amounts.deductions.wageTaxCents
      acc.socialSecurity += r.amounts.deductions.socialSecurityCents
      acc.holidayAllowancePayments += r.amounts.allowances.holidayAllowancePaymentCents
      acc.holidayAccrual += r.amounts.allowances.holidayAccrualCents
      acc.lateFees += r.amounts.adjustments.latePaymentFeeCents
      acc.outstandingHoliday += r.amounts.adjustments.outstandingHolidayPayoutCents
      return acc
    }, { gross: 0, net: 0, wageTax: 0, socialSecurity: 0, holidayAllowancePayments: 0, holidayAccrual: 0, lateFees: 0, outstandingHoliday: 0 })

    const employees = calculations.map(r => ({
      employeeId: r.employee.id,
      name: `${r.employee.firstName} ${r.employee.lastName}`,
      email: r.employee.email,
      department: r.employee.department,
      role: r.employee.role,
      contractType: r.employee.contractType,
      startDate: r.employee.startDate,
      endDate: r.employee.endDate ?? null,
      location: r.employee.location,
      employment: r.employment,
      amounts: {
        gross: centsToEuro(r.amounts.grossCents),
        taxable: centsToEuro(r.amounts.taxableCents),
        net: centsToEuro(r.amounts.netCents),
        allowances: {
          ruling30: centsToEuro(r.amounts.allowances.ruling30Cents),
          holidayAccrual: centsToEuro(r.amounts.allowances.holidayAccrualCents),
          holidayAllowancePayment: centsToEuro(r.amounts.allowances.holidayAllowancePaymentCents),
          holidayAllowanceDue: centsToEuro(r.amounts.allowances.holidayAllowanceDueCents)
        },
        deductions: {
          wageTax: centsToEuro(r.amounts.deductions.wageTaxCents),
          socialSecurity: centsToEuro(r.amounts.deductions.socialSecurityCents)
        },
        adjustments: {
          outstandingHolidayPayout: centsToEuro(r.amounts.adjustments.outstandingHolidayPayoutCents),
          latePaymentFee: centsToEuro(r.amounts.adjustments.latePaymentFeeCents)
        }
      },
      metadata: r.metadata
    }))

    res.json({
      period: month,
      currency: config.locale.currency,
      statutoryInterestRate: calculations[0]?.metadata.statutoryInterestRate ?? 0.08,
      totals: {
        gross: centsToEuro(totals.gross),
        net: centsToEuro(totals.net),
        wageTax: centsToEuro(totals.wageTax),
        socialSecurity: centsToEuro(totals.socialSecurity),
        holidayAllowancePayments: centsToEuro(totals.holidayAllowancePayments),
        holidayAccrual: centsToEuro(totals.holidayAccrual),
        outstandingHoliday: centsToEuro(totals.outstandingHoliday),
        lateFees: centsToEuro(totals.lateFees)
      },
      employees,
      assumptions: {
        holidayAllowanceRate: HOLIDAY_ALLOWANCE_RATE,
        taxYear: 2024,
        socialSecurityRate: SOCIAL_SECURITY_RATE,
        latePaymentInterestRate: calculations[0]?.metadata.statutoryInterestRate ?? STATUTORY_INTEREST_RATE
      }
    })
  } catch (err) {
    res.status(400).json({ error: (err as Error).message })
  }
})

payroll.post('/sepa/:month', (req, res) => {
  try {
    const month = req.params.month
    const paymentDate = typeof req.body?.paymentDate === 'string' ? req.body.paymentDate : undefined
    const dueDate = typeof req.body?.dueDate === 'string' ? req.body.dueDate : undefined

    const calculations = listEmployees().map(employee => calculateMonthlyPayroll({ employee, month, paymentDate, dueDate }))
      .filter(r => r.amounts.netCents > 0)

    const payments = calculations.map(r => ({
      endToEndId: `SAL-${r.employee.id}-${month}`,
      name: `${r.employee.firstName} ${r.employee.lastName}`,
      iban: r.employee.iban,
      bic: r.employee.bic ?? undefined,
      amount: centsToEuro(r.amounts.netCents),
      remittance: r.employment.isLeaver ? `Salary & final payout ${month}` : `Salary ${month}`
    }))

    const xml = buildPain001({ name: config.company.name, iban: config.company.iban, bic: config.company.bic }, payments)
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.send(xml)
  } catch (err) {
    res.status(400).json({ error: (err as Error).message })
  }
})
