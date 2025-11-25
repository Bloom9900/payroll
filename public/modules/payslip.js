// Dummy payslip dataset powering the standalone UI.
import { listEmployees, getEmployeeById, companyProfile } from './employees.js'
import { calculateMonthlyPayroll } from './payroll.js'

function centsToEuro(value) {
  return Math.round(value) / 100
}

function formatCurrency(value) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(value / 100)
}

// Generate dummy payslips for employees
function generateDummyPayslips() {
  const payslips = []
  const months = ['2024-11', '2024-12', '2025-01', '2025-02', '2025-03']
  const employees = listEmployees()

  months.forEach((month, monthIndex) => {
    employees.forEach((employee) => {
      // Skip if employee hasn't started yet
      if (employee.startDate && month < employee.startDate.slice(0, 7)) return
      // Skip if employee has ended
      if (employee.endDate && month > employee.endDate.slice(0, 7)) return

      const calculation = calculateMonthlyPayroll({ 
        employee, 
        month,
        paymentDate: `${month}-28`,
        dueDate: `${month}-28`
      })

      // Only create payslip if there's actual payment
      if (calculation.amounts.netCents <= 0 && !calculation.employment.isLeaver) return

      const payslipId = `PAYS-${month}-${employee.id}`
      const generatedAt = new Date(`${month}-15T10:00:00Z`)
      generatedAt.setDate(generatedAt.getDate() + monthIndex * 2) // Vary generation dates

      // Calculate worked hours for the period
      const workedHours = Math.round(calculation.employment.workedDays * (employee.hoursPerWeek / employee.workingDaysPerWeek))
      const totalHoursInMonth = Math.round(calculation.employment.totalDaysInMonth * (employee.hoursPerWeek / employee.workingDaysPerWeek))
      
      payslips.push({
        id: payslipId,
        payrollRunId: `RUN-${month}`,
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        month: month,
        generatedAt: generatedAt,
        generatedBy: 'system',
        metadata: {
          paymentDate: calculation.metadata.paymentDate,
          dueDate: calculation.metadata.paymentDueDate,
          statutoryInterestRate: calculation.metadata.statutoryInterestRate,
          terminationDate: calculation.metadata.terminationDate,
          isLeaver: calculation.employment.isLeaver,
          workedDays: calculation.employment.workedDays,
          totalDaysInMonth: calculation.employment.totalDaysInMonth,
          unpaidLeaveDays: calculation.employment.unpaidLeaveDays,
          workedHours: workedHours,
          totalHoursInMonth: totalHoursInMonth,
          proRatedFactor: calculation.employment.proRatedFactor
        },
        amounts: {
          grossCents: calculation.amounts.grossCents,
          taxableCents: calculation.amounts.taxableCents,
          netCents: calculation.amounts.netCents,
          allowances: {
            ruling30Cents: calculation.amounts.allowances.ruling30Cents,
            holidayAccrualCents: calculation.amounts.allowances.holidayAccrualCents,
            holidayAllowancePaymentCents: calculation.amounts.allowances.holidayAllowancePaymentCents,
            holidayAllowanceDueCents: calculation.amounts.allowances.holidayAllowanceDueCents
          },
          deductions: {
            wageTaxCents: calculation.amounts.deductions.wageTaxCents,
            socialSecurityCents: calculation.amounts.deductions.socialSecurityCents
          },
          adjustments: {
            outstandingHolidayPayoutCents: calculation.amounts.adjustments.outstandingHolidayPayoutCents,
            latePaymentFeeCents: calculation.amounts.adjustments.latePaymentFeeCents
          }
        }
      })
    })
  })

  return payslips.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())
}

const payslipStore = generateDummyPayslips()

export function getPayslipById(id) {
  return payslipStore.find(record => record.id === id) ?? null
}

export function getPayslipsForEmployee(employeeId, limit = 10) {
  return [...payslipStore]
    .filter(record => record.employeeId === employeeId)
    .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())
    .slice(0, limit)
}

export function getLatestPayslipForEmployee(employeeId) {
  const payslips = getPayslipsForEmployee(employeeId, 1)
  return payslips.length > 0 ? payslips[0] : null
}

export function listPayslipHistory(limit = 50) {
  return [...payslipStore]
    .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())
    .slice(0, limit)
}

export function summarizePayslip(record) {
  return {
    id: record.id,
    payrollRunId: record.payrollRunId,
    employeeId: record.employeeId,
    employeeName: record.employeeName,
    month: record.month,
    generatedAt: record.generatedAt.toISOString(),
    amounts: {
      gross: centsToEuro(record.amounts.grossCents),
      taxable: centsToEuro(record.amounts.taxableCents),
      net: centsToEuro(record.amounts.netCents),
      allowances: {
        ruling30: centsToEuro(record.amounts.allowances.ruling30Cents),
        holidayAccrual: centsToEuro(record.amounts.allowances.holidayAccrualCents),
        holidayAllowancePayment: centsToEuro(record.amounts.allowances.holidayAllowancePaymentCents),
        holidayAllowanceDue: centsToEuro(record.amounts.allowances.holidayAllowanceDueCents)
      },
      deductions: {
        wageTax: centsToEuro(record.amounts.deductions.wageTaxCents),
        socialSecurity: centsToEuro(record.amounts.deductions.socialSecurityCents)
      },
      adjustments: {
        outstandingHolidayPayout: centsToEuro(record.amounts.adjustments.outstandingHolidayPayoutCents),
        latePaymentFee: centsToEuro(record.amounts.adjustments.latePaymentFeeCents)
      }
    },
    paymentDate: record.metadata.paymentDate,
    dueDate: record.metadata.dueDate,
    statutoryInterestRate: record.metadata.statutoryInterestRate,
    terminationDate: record.metadata.terminationDate,
    isLeaver: record.metadata.isLeaver
  }
}

// Generate PDF content for payslip (returns HTML that can be converted to PDF)
export function generatePayslipPdfHtml(payslipId) {
  const payslip = getPayslipById(payslipId)
  if (!payslip) return null

  const employee = getEmployeeById(payslip.employeeId)
  if (!employee) return null

  const summary = summarizePayslip(payslip)
  const monthName = new Date(`${payslip.month}-01`).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
  
  // Calculate minimum wage (2024: €2,143.20/month full-time, or €12.50/hour)
  // For part-time, calculate based on hours
  const MINIMUM_WAGE_HOURLY_2024 = 12.50
  const MINIMUM_WAGE_MONTHLY_2024 = 2143.20
  const minimumWageForHours = (payslip.metadata.workedHours || 0) * MINIMUM_WAGE_HOURLY_2024
  const minimumWageForMonth = MINIMUM_WAGE_MONTHLY_2024 * (employee.hoursPerWeek / 40) * (payslip.metadata.proRatedFactor || 1)
  const applicableMinimumWage = Math.max(minimumWageForHours, minimumWageForMonth)
  
  // Calculate hourly rate
  const hourlyRate = employee.hoursPerWeek > 0 
    ? (employee.annualSalaryCents / 100) / (employee.hoursPerWeek * 52)
    : 0

  return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:900px;margin:0 auto;padding:30px;color:#1a1a1a;background:#ffffff;line-height:1.6;">
      <!-- Header with Company Info -->
      <div style="border-bottom:4px solid #2563eb;padding-bottom:20px;margin-bottom:30px;">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:15px;">
          <div>
            <div style="font-size:28px;font-weight:700;color:#2563eb;margin-bottom:5px;">${companyProfile.name}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:24px;font-weight:700;color:#1a1a1a;margin-bottom:5px;">LOONSTROOK</div>
            <div style="font-size:14px;color:#666;font-weight:500;">${monthName.toUpperCase()}</div>
          </div>
        </div>
      </div>

      <!-- Employee and Employer Information -->
      <div style="margin-bottom:25px;padding:20px;background:#f8f9fa;border-radius:6px;border-left:4px solid #2563eb;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
          <div>
            <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;font-weight:600;">Werkgever (Employer)</div>
            <div style="font-size:15px;font-weight:600;color:#1a1a1a;margin-bottom:3px;">${companyProfile.name}</div>
          </div>
          <div>
            <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;font-weight:600;">Werknemer (Employee)</div>
            <div style="font-size:15px;font-weight:600;color:#1a1a1a;margin-bottom:3px;">${payslip.employeeName}</div>
            <div style="font-size:12px;color:#666;">ID: ${employee.id}</div>
            <div style="font-size:12px;color:#666;">${employee.email}</div>
            ${employee.address ? `
            <div style="font-size:12px;color:#666;margin-top:4px;">
              ${employee.address.street || ''}<br>
              ${employee.address.postalCode || ''} ${employee.address.city || ''}<br>
              ${employee.address.country || 'Nederland'}
            </div>
            ` : ''}
            ${employee.dateOfBirth ? `
            <div style="font-size:12px;color:#666;margin-top:4px;">Geboortedatum: ${new Date(employee.dateOfBirth).toLocaleDateString('nl-NL')}</div>
            ` : ''}
            <div style="font-size:12px;color:#666;">BSN: [Niet beschikbaar]</div>
          </div>
        </div>
      </div>

      <!-- Employment Details (Mandatory) -->
      <div style="margin-bottom:25px;padding:20px;background:#f8f9fa;border-radius:6px;">
        <div style="font-size:14px;font-weight:700;color:#1a1a1a;margin-bottom:15px;text-transform:uppercase;letter-spacing:0.5px;">Werkgegevens (Employment Details)</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:15px;">
          <div>
            <div style="font-size:11px;color:#666;margin-bottom:4px;text-transform:uppercase;">Periode (Period)</div>
            <div style="font-size:14px;font-weight:600;">${payslip.month}</div>
          </div>
          <div>
            <div style="font-size:11px;color:#666;margin-bottom:4px;text-transform:uppercase;">Betaaldatum (Payment Date)</div>
            <div style="font-size:14px;font-weight:600;">${new Date(summary.paymentDate).toLocaleDateString('nl-NL')}</div>
          </div>
          <div>
            <div style="font-size:11px;color:#666;margin-bottom:4px;text-transform:uppercase;">Contracttype</div>
            <div style="font-size:14px;font-weight:600;">${employee.contractType === 'permanent' ? 'Vast' : employee.contractType === 'fixed-term' ? 'Bepaalde tijd' : 'ZZP'}</div>
          </div>
          <div>
            <div style="font-size:11px;color:#666;margin-bottom:4px;text-transform:uppercase;">Gewerkte uren (Hours Worked)</div>
            <div style="font-size:14px;font-weight:600;">${payslip.metadata.workedHours || 0} / ${payslip.metadata.totalHoursInMonth || 0}</div>
          </div>
          <div>
            <div style="font-size:11px;color:#666;margin-bottom:4px;text-transform:uppercase;">Gewerkte dagen (Days Worked)</div>
            <div style="font-size:14px;font-weight:600;">${payslip.metadata.workedDays || 0} / ${payslip.metadata.totalDaysInMonth || 0}</div>
          </div>
          <div>
            <div style="font-size:11px;color:#666;margin-bottom:4px;text-transform:uppercase;">Uurloon (Hourly Rate)</div>
            <div style="font-size:14px;font-weight:600;">${formatCurrency(Math.round(hourlyRate * 100))}</div>
          </div>
          <div>
            <div style="font-size:11px;color:#666;margin-bottom:4px;text-transform:uppercase;">Afdeling (Department)</div>
            <div style="font-size:14px;">${employee.department}</div>
          </div>
          <div>
            <div style="font-size:11px;color:#666;margin-bottom:4px;text-transform:uppercase;">Functie (Function)</div>
            <div style="font-size:14px;">${employee.role}</div>
          </div>
          <div>
            <div style="font-size:11px;color:#666;margin-bottom:4px;text-transform:uppercase;">Locatie (Location)</div>
            <div style="font-size:14px;">${employee.location}</div>
          </div>
          <div>
            <div style="font-size:11px;color:#666;margin-bottom:4px;text-transform:uppercase;">Ingangsdatum (Hire Date)</div>
            <div style="font-size:14px;font-weight:600;">${employee.startDate ? new Date(employee.startDate).toLocaleDateString('nl-NL') : 'N/A'}</div>
          </div>
          ${employee.endDate ? `
          <div>
            <div style="font-size:11px;color:#666;margin-bottom:4px;text-transform:uppercase;">Einddatum (Termination Date)</div>
            <div style="font-size:14px;font-weight:600;color:#dc3545;">${new Date(employee.endDate).toLocaleDateString('nl-NL')}</div>
          </div>
          ` : ''}
          ${employee.scale || employee.step ? `
          <div>
            <div style="font-size:11px;color:#666;margin-bottom:4px;text-transform:uppercase;">Schaal/Stap (Scale/Step)</div>
            <div style="font-size:14px;font-weight:600;">${employee.scale || 'N/A'}${employee.step ? ` / ${employee.step}` : ''}</div>
          </div>
          ` : ''}
        </div>
        ${payslip.metadata.unpaidLeaveDays > 0 ? `
        <div style="margin-top:15px;padding:10px;background:#fff3cd;border-left:3px solid #ffc107;border-radius:4px;">
          <div style="font-size:12px;color:#856404;font-weight:600;">Onbetaald verlof: ${payslip.metadata.unpaidLeaveDays} dag(en)</div>
        </div>
        ` : ''}
        ${summary.terminationDate ? `
        <div style="margin-top:15px;padding:10px;background:#f8d7da;border-left:3px solid #dc3545;border-radius:4px;">
          <div style="font-size:12px;color:#721c24;font-weight:600;">Einddatum dienstverband: ${new Date(summary.terminationDate).toLocaleDateString('nl-NL')}</div>
        </div>
        ` : ''}
      </div>

      <!-- Earnings Section -->
      <div style="margin-bottom:25px;">
        <div style="font-size:16px;font-weight:700;color:#1a1a1a;margin-bottom:15px;padding-bottom:8px;border-bottom:2px solid #2563eb;text-transform:uppercase;letter-spacing:0.5px;">Verdiensten (Earnings)</div>
        <table style="width:100%;border-collapse:collapse;background:#ffffff;">
          <thead>
            <tr style="background:#f8f9fa;">
              <th style="padding:10px 0;text-align:left;font-size:12px;font-weight:600;color:#666;text-transform:uppercase;border-bottom:2px solid #dee2e6;">Omschrijving</th>
              <th style="padding:10px 0;text-align:right;font-size:12px;font-weight:600;color:#666;text-transform:uppercase;border-bottom:2px solid #dee2e6;">Bedrag</th>
            </tr>
          </thead>
          <tbody>
          <tr style="background:#ffffff;">
            <td style="padding:10px 0;border-bottom:1px solid #e9ecef;color:#1a1a1a;background:#ffffff;font-size:14px;">Bruto salaris (Gross Salary)</td>
            <td style="text-align:right;padding:10px 0;border-bottom:1px solid #e9ecef;font-weight:600;color:#1a1a1a;background:#ffffff;font-size:14px;">${formatCurrency(payslip.amounts.grossCents)}</td>
          </tr>
          ${summary.amounts.allowances.ruling30 > 0 ? `
          <tr style="background:#ffffff;">
            <td style="padding:10px 0;border-bottom:1px solid #e9ecef;color:#1a1a1a;background:#ffffff;font-size:14px;">30% Regeling (30% Ruling)</td>
            <td style="text-align:right;padding:10px 0;border-bottom:1px solid #e9ecef;color:#1a1a1a;background:#ffffff;font-size:14px;">${formatCurrency(payslip.amounts.allowances.ruling30Cents)}</td>
          </tr>
          ` : ''}
          ${summary.amounts.allowances.holidayAccrual > 0 ? `
          <tr style="background:#ffffff;">
            <td style="padding:10px 0;border-bottom:1px solid #e9ecef;color:#1a1a1a;background:#ffffff;font-size:14px;">Vakantiegeld opbouw (Holiday Allowance Accrual)</td>
            <td style="text-align:right;padding:10px 0;border-bottom:1px solid #e9ecef;color:#1a1a1a;background:#ffffff;font-size:14px;">${formatCurrency(payslip.amounts.allowances.holidayAccrualCents)}</td>
          </tr>
          ` : ''}
          ${summary.amounts.allowances.holidayAllowancePayment > 0 ? `
          <tr style="background:#ffffff;">
            <td style="padding:10px 0;border-bottom:1px solid #e9ecef;color:#1a1a1a;background:#ffffff;font-size:14px;">Uitbetaling vakantiegeld (Holiday Allowance Payment)</td>
            <td style="text-align:right;padding:10px 0;border-bottom:1px solid #e9ecef;color:#1a1a1a;background:#ffffff;font-size:14px;">${formatCurrency(payslip.amounts.allowances.holidayAllowancePaymentCents)}</td>
          </tr>
          ` : ''}
          ${summary.amounts.adjustments.outstandingHolidayPayout > 0 ? `
          <tr style="background:#ffffff;">
            <td style="padding:10px 0;border-bottom:1px solid #e9ecef;color:#1a1a1a;background:#ffffff;font-size:14px;">Uitbetaling resterend vakantiegeld (Outstanding Holiday Payout)</td>
            <td style="text-align:right;padding:10px 0;border-bottom:1px solid #e9ecef;color:#1a1a1a;background:#ffffff;font-size:14px;">${formatCurrency(payslip.amounts.adjustments.outstandingHolidayPayoutCents)}</td>
          </tr>
          ` : ''}
          ${summary.amounts.adjustments.latePaymentFee > 0 ? `
          <tr style="background:#ffffff;">
            <td style="padding:10px 0;border-bottom:1px solid #e9ecef;color:#1a1a1a;background:#ffffff;font-size:14px;">Rentevergoeding (Late Payment Interest)</td>
            <td style="text-align:right;padding:10px 0;border-bottom:1px solid #e9ecef;color:#1a1a1a;background:#ffffff;font-size:14px;">${formatCurrency(payslip.amounts.adjustments.latePaymentFeeCents)}</td>
          </tr>
          ` : ''}
          ${employee.travelAllowanceCents && employee.travelAllowanceCents > 0 ? `
          <tr style="background:#ffffff;">
            <td style="padding:10px 0;border-bottom:1px solid #e9ecef;color:#1a1a1a;background:#ffffff;font-size:14px;">Reiskostenvergoeding (Travel Allowance)</td>
            <td style="text-align:right;padding:10px 0;border-bottom:1px solid #e9ecef;color:#1a1a1a;background:#ffffff;font-size:14px;">${formatCurrency(employee.travelAllowanceCents)}</td>
          </tr>
          ` : ''}
          </tbody>
        </table>
      </div>

      <!-- Deductions Section -->
      <div style="margin-bottom:25px;">
        <div style="font-size:16px;font-weight:700;color:#1a1a1a;margin-bottom:15px;padding-bottom:8px;border-bottom:2px solid #dc3545;text-transform:uppercase;letter-spacing:0.5px;">Inhoudingen (Deductions)</div>
        <table style="width:100%;border-collapse:collapse;background:#ffffff;">
          <thead>
            <tr style="background:#f8f9fa;">
              <th style="padding:10px 0;text-align:left;font-size:12px;font-weight:600;color:#666;text-transform:uppercase;border-bottom:2px solid #dee2e6;">Omschrijving</th>
              <th style="padding:10px 0;text-align:right;font-size:12px;font-weight:600;color:#666;text-transform:uppercase;border-bottom:2px solid #dee2e6;">Bedrag</th>
            </tr>
          </thead>
          <tbody>
          <tr style="background:#ffffff;">
            <td style="padding:10px 0;border-bottom:1px solid #e9ecef;color:#1a1a1a;background:#ffffff;font-size:14px;">Loonbelasting (Wage Tax)</td>
            <td style="text-align:right;padding:10px 0;border-bottom:1px solid #e9ecef;color:#1a1a1a;background:#ffffff;font-size:14px;">${formatCurrency(payslip.amounts.deductions.wageTaxCents)}</td>
          </tr>
          <tr style="background:#ffffff;">
            <td style="padding:10px 0;border-bottom:1px solid #e9ecef;color:#1a1a1a;background:#ffffff;font-size:14px;">Premies volksverzekeringen (Social Security)</td>
            <td style="text-align:right;padding:10px 0;border-bottom:1px solid #e9ecef;color:#1a1a1a;background:#ffffff;font-size:14px;">${formatCurrency(payslip.amounts.deductions.socialSecurityCents)}</td>
          </tr>
          </tbody>
        </table>
      </div>

      <!-- Accumulated Data (YTD) -->
      ${payslip.accumulatedData ? `
      <div style="margin-bottom:25px;">
        <div style="font-size:16px;font-weight:700;color:#1a1a1a;margin-bottom:15px;padding-bottom:8px;border-bottom:2px solid #28a745;text-transform:uppercase;letter-spacing:0.5px;">Opgebouwde gegevens (Accumulated Data)</div>
        <table style="width:100%;border-collapse:collapse;background:#ffffff;">
          <thead>
            <tr style="background:#f8f9fa;">
              <th style="padding:10px 0;text-align:left;font-size:12px;font-weight:600;color:#666;text-transform:uppercase;border-bottom:2px solid #dee2e6;">Omschrijving</th>
              <th style="padding:10px 0;text-align:right;font-size:12px;font-weight:600;color:#666;text-transform:uppercase;border-bottom:2px solid #dee2e6;">Bedrag</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background:#ffffff;">
              <td style="padding:10px 0;border-bottom:1px solid #e9ecef;color:#1a1a1a;background:#ffffff;font-size:14px;">Bruto jaar totaal (Gross YTD)</td>
              <td style="text-align:right;padding:10px 0;border-bottom:1px solid #e9ecef;font-weight:600;color:#1a1a1a;background:#ffffff;font-size:14px;">${formatCurrency(payslip.accumulatedData.grossCents || 0)}</td>
            </tr>
            <tr style="background:#ffffff;">
              <td style="padding:10px 0;border-bottom:1px solid #e9ecef;color:#1a1a1a;background:#ffffff;font-size:14px;">Netto jaar totaal (Net YTD)</td>
              <td style="text-align:right;padding:10px 0;border-bottom:1px solid #e9ecef;font-weight:600;color:#1a1a1a;background:#ffffff;font-size:14px;">${formatCurrency(payslip.accumulatedData.netCents || 0)}</td>
            </tr>
            <tr style="background:#ffffff;">
              <td style="padding:10px 0;border-bottom:1px solid #e9ecef;color:#1a1a1a;background:#ffffff;font-size:14px;">Loonbelasting jaar totaal (Tax YTD)</td>
              <td style="text-align:right;padding:10px 0;border-bottom:1px solid #e9ecef;color:#1a1a1a;background:#ffffff;font-size:14px;">${formatCurrency(payslip.accumulatedData.taxCents || 0)}</td>
            </tr>
            <tr style="background:#ffffff;">
              <td style="padding:10px 0;border-bottom:1px solid #e9ecef;color:#1a1a1a;background:#ffffff;font-size:14px;">Sociale premies jaar totaal (Social Security YTD)</td>
              <td style="text-align:right;padding:10px 0;border-bottom:1px solid #e9ecef;color:#1a1a1a;background:#ffffff;font-size:14px;">${formatCurrency(payslip.accumulatedData.socialSecurityCents || 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      ` : ''}

      <!-- Minimum Wage Compliance (Mandatory) -->
      <div style="margin-bottom:25px;padding:15px;background:#e7f3ff;border-left:4px solid #2563eb;border-radius:4px;">
        <div style="font-size:13px;font-weight:600;color:#1a1a1a;margin-bottom:8px;">Wettelijk minimumloon (Statutory Minimum Wage)</div>
        <div style="font-size:14px;color:#1a1a1a;">
          Toepasselijk minimumloon: ${formatCurrency(Math.round(applicableMinimumWage * 100))}<br>
          <span style="font-size:12px;color:#666;">Bruto salaris: ${formatCurrency(payslip.amounts.grossCents)}</span>
        </div>
      </div>

      <!-- Net Pay Summary -->
      <div style="margin-top:30px;padding:25px;background:linear-gradient(135deg,#2563eb 0%,#1e40af 100%);border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:14px;color:rgba(255,255,255,0.9);margin-bottom:5px;text-transform:uppercase;letter-spacing:0.5px;">Netto uit te betalen (Net Pay)</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.7);">Betaaldatum: ${new Date(summary.paymentDate).toLocaleDateString('nl-NL')}</div>
          </div>
          <div style="font-size:36px;font-weight:700;color:#ffffff;text-shadow:0 2px 4px rgba(0,0,0,0.2);">${formatCurrency(payslip.amounts.netCents)}</div>
        </div>
      </div>

      <!-- Payment Details -->
      <div style="margin-top:25px;padding:15px;background:#f8f9fa;border-radius:6px;border:1px solid #dee2e6;">
        <div style="font-size:13px;font-weight:600;color:#1a1a1a;margin-bottom:10px;">Betalingsgegevens (Payment Details)</div>
        <div style="font-size:12px;color:#666;line-height:1.8;">
          <div><strong>Rekeningnummer:</strong> ${employee.iban || 'Niet opgegeven'}</div>
          ${employee.bic ? `<div><strong>BIC:</strong> ${employee.bic}</div>` : ''}
          <div><strong>Referentie:</strong> ${payslip.id}</div>
        </div>
      </div>

      <!-- Footer with Legal Information -->
      <div style="margin-top:40px;padding-top:20px;border-top:2px solid #dee2e6;font-size:11px;color:#666;line-height:1.6;">
        <div style="text-align:center;margin-bottom:15px;">
          <p style="margin:5px 0;"><strong>Dit is een automatisch gegenereerde loonstrook</strong></p>
          <p style="margin:5px 0;">Gegenereerd op: ${new Date(payslip.generatedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          <p style="margin:5px 0;">Loonstrook ID: ${payslip.id} | Payroll Run: ${payslip.payrollRunId}</p>
        </div>
        <div style="padding:15px;background:#fff3cd;border-left:3px solid #ffc107;border-radius:4px;margin-top:15px;">
          <div style="font-size:11px;color:#856404;font-weight:600;margin-bottom:5px;">Belangrijke informatie:</div>
          <div style="font-size:10px;color:#856404;line-height:1.5;">
            • Deze loonstrook voldoet aan de Nederlandse wetgeving (Wet minimumloon en minimumvakantiebijslag).<br>
            • Bewaar deze loonstrook minimaal 7 jaar voor belastingdoeleinden.<br>
            • Bij vragen over deze loonstrook, neem contact op met de afdeling HR of Payroll.<br>
            • De gegevens op deze loonstrook zijn gebaseerd op de informatie zoals bekend bij de werkgever op het moment van generatie.
          </div>
        </div>
      </div>
    </div>
  `
}

// Generate PDF blob for download
export function generatePayslipPdfBlob(payslipId) {
  const html = generatePayslipPdfHtml(payslipId)
  if (!html) return null

  const blob = new Blob([`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Payslip - ${payslipId}</title>
      <style>
        body { margin: 0; background: #ffffff; }
        @media print {
          body { margin: 0; }
          @page { margin: 20mm; }
        }
      </style>
    </head>
    <body>
      ${html}
    </body>
    </html>
  `], { type: 'text/html' })
  
  return blob
}

