// Imports
import { getPayslipsForEmployee, getPayslipById, summarizePayslip, generatePayslipPdfHtml, generatePayslipPdfBlob } from './modules/payslip.js'
import { listEmployees } from './modules/employees.js'

// Tabs
const tabButtons = document.querySelectorAll('nav.tabs button')
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    document.querySelectorAll('.tab').forEach(s => s.classList.remove('active'))
    document.getElementById(btn.dataset.tab).classList.add('active')
  })
})

const euro = n => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)
let employeeCache = []

// Dashboard snapshot
async function loadSnapshot () {
  try {
    const month = new Date().toISOString().slice(0, 7)
    const res = await fetch(`/api/payroll/preview/${month}`)
    if (!res.ok) throw new Error('Failed to load snapshot')
    const data = await res.json()
    const employeeCount = data.employees?.length ?? 0
    const totalNet = data.totals?.net ?? (data.employees?.reduce((a, b) => a + (b.amounts?.net ?? 0), 0) ?? 0)
    document.getElementById('snapshot').textContent = `Employees: ${employeeCount} • Period: ${data.period || month} • Projected net: ${euro(totalNet)}`
  } catch (err) {
    document.getElementById('snapshot').textContent = `Error loading snapshot: ${err.message}`
  }
}
loadSnapshot()

// Runs tab
document.getElementById('btnPreview').addEventListener('click', previewRuns)
document.getElementById('btnSepa').addEventListener('click', sepaDownload)
document.getElementById('qaPreview').addEventListener('click', () => {
  document.querySelector('button[data-tab="runs"]').click()
  previewRuns()
})
document.getElementById('qaSepa').addEventListener('click', () => {
  document.querySelector('button[data-tab="runs"]').click()
  sepaDownload()
})

document.getElementById('qaCreateRun')?.addEventListener('click', async () => {
  const month = new Date().toISOString().slice(0, 7)
  try {
    const res = await fetch('/api/payroll-runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month })
    })
    if (!res.ok) throw new Error('Failed to create payroll run')
    await loadPayrollRuns()
    document.getElementById('qaStatus').textContent = `Payroll run created for ${month}`
    setTimeout(() => { document.getElementById('qaStatus').textContent = '' }, 3000)
  } catch (err) {
    document.getElementById('qaStatus').textContent = err.message
  }
})

async function previewRuns () {
  const monthEl = document.getElementById('month')
  const month = monthEl.value || new Date().toISOString().slice(0, 7)
  const status = document.getElementById('status')
  status.textContent = 'Loading...'
  try {
    const res = await fetch(`/api/payroll/preview/${month}`)
    if (!res.ok) throw new Error('Failed to load payroll preview')
    const data = await res.json()
    const tbody = document.querySelector('#employeesTable tbody')
    tbody.innerHTML = ''
    
    if (!data.employees || data.employees.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="muted">No employees found for this period</td></tr>'
      status.textContent = `No data for ${data.period}`
      return
    }
    
    data.employees.forEach(r => {
      const tr = document.createElement('tr')
      const gross = r.amounts?.gross ?? 0
      const taxable = r.amounts?.taxable ?? 0
      const wageTax = r.amounts?.deductions?.wageTax ?? 0
      const wageTaxCredit = r.amounts?.deductions?.wageTaxCredit ?? 0
      const socialSecurity = r.amounts?.deductions?.socialSecurity ?? 0
      const pension = r.amounts?.deductions?.pensionEmployee ?? 0
      const net = r.amounts?.net ?? 0
      
      tr.innerHTML = `
        <td>${r.employeeId || ''}</td>
        <td>${r.name || ''}</td>
        <td>${euro(gross)}</td>
        <td>${euro(taxable)}</td>
        <td>${euro(wageTax)}</td>
        <td>${euro(wageTaxCredit)}</td>
        <td>${euro(socialSecurity)}</td>
        <td>${euro(pension)}</td>
        <td><strong>${euro(net)}</strong></td>
        <td>
          <button class="secondary" style="padding:4px 8px;font-size:12px;" onclick="showEmployeeBreakdown('${r.employeeId}', '${month}')">Details</button>
        </td>
      `
      tbody.appendChild(tr)
    })
    document.getElementById('btnSepa').disabled = false
    status.textContent = `Showing ${data.period} • ${data.employees.length} employees • Total: ${euro(data.totals?.net ?? 0)}`
  } catch (err) {
    status.textContent = err.message || 'Error loading payroll preview'
    const tbody = document.querySelector('#employeesTable tbody')
    tbody.innerHTML = '<tr><td colspan="10" class="error">Error loading data</td></tr>'
  }
}

async function sepaDownload () {
  const monthEl = document.getElementById('month')
  const month = monthEl.value || new Date().toISOString().slice(0, 7)
  const res = await fetch(`/api/payroll/sepa/${month}`, { method: 'POST' })
  const xml = await res.text()
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `sepa-${month}.xml`
  a.click()
  URL.revokeObjectURL(a.href)
}

// Employee registry
const empForm = document.getElementById('empCreateForm')
if (empForm) {
  empForm.addEventListener('submit', async ev => {
    ev.preventDefault()
    const status = document.getElementById('empCreateStatus')
    status.textContent = 'Saving new record...'
    const formData = new FormData(empForm)
    const payload = Object.fromEntries(formData.entries())
    payload.isThirtyPercentRuling = formData.get('isThirtyPercentRuling') === 'on'
    payload.hoursPerWeek = Number(payload.hoursPerWeek)
    payload.workingDaysPerWeek = Number(payload.workingDaysPerWeek)
    payload.annualSalaryEuros = Number(payload.annualSalaryEuros)
    payload.holidayDaysPerYear = payload.holidayDaysPerYear ? Number(payload.holidayDaysPerYear) : undefined

    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Unable to create employee')
      }
      empForm.reset()
      status.textContent = 'Employee created. Refreshing roster...'
      await loadEmployees()
      status.textContent = 'Employee onboarded successfully.'
      setTimeout(() => { status.textContent = '' }, 4000)
    } catch (err) {
      status.textContent = err instanceof Error ? err.message : 'Unable to create employee'
    }
  })
}

async function loadEmployees () {
  const res = await fetch('/api/employees')
  employeeCache = await res.json()
  renderEmployeesTable(employeeCache)
  updateHeadcountPulse()
  populateOffboardingEmployees()
  hydrateTerminationCalculator()
  populateJaaropgaveEmployees()
  renderCommandCenter()
}
loadEmployees()

function renderEmployeesTable (list) {
  const tbody = document.querySelector('#empTable tbody')
  tbody.innerHTML = ''
  list.forEach(e => {
    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td><code style="font-size:12px;background:rgba(138,180,255,0.1);padding:2px 6px;border-radius:4px;">${e.id}</code></td>
      <td><a href="#" data-emp="${e.id}" class="employee-link">${e.firstName} ${e.lastName}</a></td>
      <td>${e.email}</td>
      <td>${e.startDate}</td>
      <td><strong>${euro((e.annualSalaryCents ?? 0) / 100)}</strong></td>
      <td>${e.hoursPerWeek ?? 0}</td>
    `
    tbody.appendChild(tr)
  })
  tbody.querySelectorAll('a[data-emp]').forEach(a => {
    a.addEventListener('click', async ev => {
      ev.preventDefault()
      await showEmployee(a.dataset.emp)
    })
  })
  const search = document.getElementById('search')
  if (search) {
    search.oninput = () => {
      const q = search.value.toLowerCase()
      Array.from(tbody.children).forEach(tr => {
        tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none'
      })
    }
  }
}

async function showEmployee (id) {
  try {
    const e = await fetch('/api/employees/' + id).then(r => r.json())
    const modal = document.getElementById('employeeModal')
    const modalName = document.getElementById('modalEmployeeName')
    const div = document.getElementById('empFields')
    
    if (!modal || !div) return
    
    // Set modal title
    modalName.textContent = `${e.firstName || ''} ${e.lastName || ''} (${e.id || ''})`
    
    const annual = (e.annualSalaryCents ?? 0) / 100
    const hourly = annual / ((e.hoursPerWeek ?? 40) * 52)
    const monthly = annual / 12
    
    // Create better formatted employee details
    const contractTypeClass = (e.contractType || 'permanent').replace(/-/g, '')
    const remainingDays = Math.max(0, (e.holidayDaysPerYear ?? 0) - (e.usedHolidayDaysYtd ?? 0) + (e.carriedOverHolidayDays ?? 0))
    
    div.innerHTML = `
      <div class="grid two" style="gap:20px;">
        <div class="employee-detail-section">
          <h4 style="margin-top:0;color:var(--accent);border-bottom:2px solid rgba(138,180,255,0.2);padding-bottom:8px;margin-bottom:16px;">Personal Information</h4>
          <div style="display:flex;flex-direction:column;gap:14px;">
            <div>
              <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">Employee ID</div>
              <code style="background:rgba(138,180,255,0.1);padding:6px 10px;border-radius:6px;font-size:13px;">${e.id || ''}</code>
            </div>
            <div>
              <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">Full Name</div>
              <div style="font-size:16px;font-weight:600;">${e.firstName || ''} ${e.lastName || ''}</div>
            </div>
            <div>
              <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">Email</div>
              <a href="mailto:${e.email || ''}" style="color:var(--accent);text-decoration:none;">${e.email || ''}</a>
            </div>
            <div>
              <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">Start Date</div>
              <div>${e.startDate || ''}</div>
            </div>
            ${e.endDate ? `
            <div>
              <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">End Date</div>
              <div><span class="warning" style="font-weight:600;">${e.endDate}</span></div>
            </div>` : ''}
          </div>
        </div>
        <div class="employee-detail-section">
          <h4 style="margin-top:0;color:var(--accent);border-bottom:2px solid rgba(138,180,255,0.2);padding-bottom:8px;margin-bottom:16px;">Employment Details</h4>
          <div style="display:flex;flex-direction:column;gap:14px;">
            <div>
              <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">Department</div>
              <div>${e.department || ''}</div>
            </div>
            <div>
              <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">Role</div>
              <div>${e.role || ''}</div>
            </div>
            <div>
              <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">Location</div>
              <div>${e.location || ''}</div>
            </div>
            <div>
              <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">Contract Type</div>
              <span class="status-badge ${contractTypeClass}">${(e.contractType || 'permanent').toUpperCase().replace(/-/g, ' ')}</span>
            </div>
            <div>
              <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">30% Ruling</div>
              ${e.isThirtyPercentRuling ? '<span class="success">✓ Eligible</span>' : '<span class="muted">Not eligible</span>'}
            </div>
          </div>
        </div>
        <div class="employee-detail-section">
          <h4 style="margin-top:0;color:var(--accent);border-bottom:2px solid rgba(138,180,255,0.2);padding-bottom:8px;margin-bottom:16px;">Compensation</h4>
          <div style="display:flex;flex-direction:column;gap:14px;">
            <div>
              <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">Annual Salary</div>
              <div style="font-size:22px;font-weight:700;color:var(--success);">${euro(annual)}</div>
            </div>
            <div>
              <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">Monthly Salary</div>
              <div style="font-size:16px;font-weight:600;">${euro(monthly)}</div>
            </div>
            <div>
              <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">Hourly Rate</div>
              <div>${euro(hourly)}</div>
            </div>
            <div>
              <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">Hours per Week</div>
              <div>${e.hoursPerWeek ?? 0}</div>
            </div>
            <div>
              <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">Working Days per Week</div>
              <div>${e.workingDaysPerWeek ?? 0}</div>
            </div>
          </div>
        </div>
        <div class="employee-detail-section">
          <h4 style="margin-top:0;color:var(--accent);border-bottom:2px solid rgba(138,180,255,0.2);padding-bottom:8px;margin-bottom:16px;">Holiday & Leave</h4>
          <div style="display:flex;flex-direction:column;gap:14px;">
            <div>
              <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">Holiday Days per Year</div>
              <div>${e.holidayDaysPerYear ?? 0}</div>
            </div>
            <div>
              <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">Used Holiday Days YTD</div>
              <div>${e.usedHolidayDaysYtd ?? 0}</div>
            </div>
            <div>
              <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">Carried Over Days</div>
              <div>${e.carriedOverHolidayDays ?? 0}</div>
            </div>
            <div>
              <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">Remaining Days</div>
              <div style="font-size:18px;font-weight:700;color:var(--success);">${remainingDays}</div>
            </div>
            <div>
              <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">Holiday Allowance Eligible</div>
              ${e.holidayAllowanceEligible ? '<span class="success">✓ Yes</span>' : '<span class="muted">No</span>'}
            </div>
          </div>
        </div>
      </div>
    `
    
    // Set default month
    const empMonthInput = document.getElementById('empMonth')
    const currentMonth = new Date().toISOString().slice(0, 7)
    if (empMonthInput) {
      empMonthInput.value = currentMonth
    }
    
    // Setup preview function
    const loadPayrollPreview = async () => {
      const m = empMonthInput ? empMonthInput.value || currentMonth : currentMonth
      const tbody = document.querySelector('#empPreviewTable tbody')
      if (!tbody) return
      tbody.innerHTML = '<tr><td colspan="5" class="muted">Loading...</td></tr>'
      try {
        const run = await fetch('/api/payroll/preview/' + m).then(r => r.json())
        const row = run.employees?.find(x => x.employeeId === e.id)
        if (!row || !row.amounts) {
          tbody.innerHTML = '<tr><td colspan="5" class="muted">No preview available for selected month.</td></tr>'
          return
        }
        const gross = row.amounts.gross ?? 0
        const holiday = row.amounts.allowances?.holidayAccrual ?? 0
        const ruling30 = row.amounts.allowances?.ruling30 ?? 0
        const taxable = row.amounts.taxable ?? 0
        const net = row.amounts.net ?? 0
        tbody.innerHTML = `
          <tr>
            <td><strong>${euro(gross)}</strong></td>
            <td>${euro(holiday)}</td>
            <td>${euro(ruling30)}</td>
            <td>${euro(taxable)}</td>
            <td><strong style="color:var(--success);font-size:16px;">${euro(net)}</strong></td>
          </tr>
        `
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" class="error">Error loading preview</td></tr>'
      }
    }
    
    // Setup preview button
    const previewBtn = document.getElementById('empPreviewBtn')
    if (previewBtn) {
      previewBtn.onclick = loadPayrollPreview
    }
    
    // Show modal
    modal.hidden = false
    document.body.style.overflow = 'hidden'
    
    // Auto-load current month preview, payslips, and history
    loadPayrollPreview()
    loadEmployeePayslips(id)
    loadEmployeeHistory(id)
  } catch (err) {
    console.error('Error loading employee:', err)
    alert('Failed to load employee details')
  }
}

// Close modal handlers
document.getElementById('closeEmployeeModal')?.addEventListener('click', closeEmployeeModal)
document.getElementById('modalOverlay')?.addEventListener('click', closeEmployeeModal)

// Close on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('employeeModal')
    if (modal && !modal.hidden) {
      closeEmployeeModal()
    }
  }
})

function closeEmployeeModal() {
  const modal = document.getElementById('employeeModal')
  if (modal) {
    modal.hidden = true
    document.body.style.overflow = ''
  }
}

async function loadEmployeePayslips(employeeId) {
  try {
    const payslips = getPayslipsForEmployee(employeeId, 20)
    const div = document.getElementById('employeePayslips')
    if (!div) return
    
    if (payslips.length === 0) {
      div.innerHTML = '<p class="muted small">No payslips found for this employee</p>'
      return
    }
    
    div.innerHTML = `
      <div style="max-height:400px;overflow-y:auto;">
        <table style="font-size:13px;width:100%;">
          <thead>
            <tr style="border-bottom:2px solid rgba(138,180,255,0.2);">
              <th style="text-align:left;padding:8px 0;">Month</th>
              <th style="text-align:left;padding:8px 0;">Gross</th>
              <th style="text-align:left;padding:8px 0;">Net</th>
              <th style="text-align:left;padding:8px 0;">Payment Date</th>
              <th style="text-align:center;padding:8px 0;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${payslips.map(p => {
              const summary = summarizePayslip(p)
              return `<tr style="border-bottom:1px solid rgba(138,180,255,0.1);">
              <td style="padding:8px 0;"><strong>${summary.month}</strong></td>
              <td style="padding:8px 0;">${euro(summary.amounts.gross)}</td>
              <td style="padding:8px 0;"><strong>${euro(summary.amounts.net)}</strong></td>
              <td style="padding:8px 0;">${summary.paymentDate}</td>
              <td style="padding:8px 0;text-align:center;">
                <button class="secondary" style="padding:4px 12px;font-size:12px;" onclick="showPayslipDetail('${p.id}')">View</button>
              </td>
            </tr>`
            }).join('')}
          </tbody>
        </table>
      </div>
    `
  } catch (err) {
    console.error('Error loading employee payslips:', err)
    const div = document.getElementById('employeePayslips')
    if (div) {
      div.innerHTML = '<p class="error small">Error loading payslips</p>'
    }
  }
}

async function loadEmployeeHistory(employeeId) {
  try {
    const res = await fetch(`/api/employee-history/employee/${employeeId}`)
    if (!res.ok) return
    const data = await res.json()
    const div = document.getElementById('employeeHistory')
    if (!div) return
    if (!data.history || data.history.length === 0) {
      div.innerHTML = '<p class="muted small">No change history for this employee</p>'
      return
    }
    div.innerHTML = `
      <div style="max-height:300px;overflow-y:auto;">
        <table style="font-size:13px;">
          <thead><tr><th>Date</th><th>Change Type</th><th>Fields Changed</th></tr></thead>
          <tbody>
            ${data.history.slice(0, 20).map(h => {
              const changeCount = Object.keys(h.changes || {}).length
              const fields = Object.keys(h.changes || {}).slice(0, 3).join(', ')
              const moreFields = changeCount > 3 ? ` +${changeCount - 3} more` : ''
              const changeTypeClass = (h.changeType || 'updated').replace(/-/g, '')
              return `<tr>
              <td>${h.changedAt ? new Date(h.changedAt).toLocaleString('nl-NL') : '-'}</td>
              <td><span class="status-badge ${changeTypeClass}">${(h.changeType || 'updated').toUpperCase()}</span></td>
              <td>${changeCount > 0 ? `${fields}${moreFields}` : 'No fields changed'}</td>
            </tr>`
            }).join('')}
          </tbody>
        </table>
      </div>
    `
  } catch (err) {
    console.error('Error loading employee history:', err)
    const div = document.getElementById('employeeHistory')
    if (div) {
      div.innerHTML = '<p class="error small">Error loading history</p>'
    }
  }
}

function updateHeadcountPulse () {
  const total = employeeCache.length
  const byDepartment = name => employeeCache.filter(e => e.department.toLowerCase().includes(name)).length
  const setValue = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value }
  setValue('pulseTotal', total)
  setValue('pulseFinance', byDepartment('finance'))
  setValue('pulseTech', byDepartment('tech'))
  setValue('pulseHr', byDepartment('hr') + byDepartment('people'))
}

// Offboarding designer
const offExit = document.getElementById('offExitDate')
if (offExit) offExit.valueAsDate = new Date()

let currentOffboardingSummary = null

document.getElementById('offCalculate')?.addEventListener('click', async () => {
  const employeeId = document.getElementById('offEmployee').value
  const exitDate = document.getElementById('offExitDate').value
  const primaryReason = document.getElementById('offPrimaryReason').value
  const secondaryReason = document.getElementById('offSecondaryReason').value
  const summaryDiv = document.getElementById('offSummary')
  
  if (!primaryReason) {
    summaryDiv.innerHTML = '<p class="error">Please select a primary reason</p>'
    return
  }
  
  summaryDiv.innerHTML = '<p class="muted">Calculating offboarding package...</p>'
  const params = new URLSearchParams({ employeeId, exitDate, primaryReason })
  if (secondaryReason) {
    params.append('secondaryReason', secondaryReason)
  }
  try {
    const res = await fetch('/api/offboarding/summary?' + params.toString())
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Unable to calculate offboarding summary')
    }
    const data = await res.json()
    currentOffboardingSummary = data
    summaryDiv.innerHTML = `
      <h3>${data.name}</h3>
      <div class="grid two">
        <div><strong>Hire date</strong><br>${data.startDate}</div>
        <div><strong>Exit date</strong><br>${data.exitDate}</div>
        <div><strong>Primary reason</strong><br>${data.primaryReason}</div>
        <div><strong>Secondary reason</strong><br>${data.secondaryReason || 'N/A'}</div>
        <div><strong>Looncode</strong><br><code>${data.looncode}</code> - ${data.looncodeDescription}</div>
        <div><strong>Tenure</strong><br>${data.tenureMonths} months (${data.tenureYears} years)</div>
        <div><strong>Base monthly salary</strong><br>${euro(data.baseMonthlySalary)}</div>
        <div><strong>Notice pay</strong><br>${euro(data.noticePay)}<br><small class="muted">${data.noticePayExplanation}</small></div>
        <div><strong>Transition allowance</strong><br>${euro(data.transitionAllowance)}</div>
        <div><strong>Unused vacation payout</strong><br>${euro(data.unusedVacationPayout)}</div>
        <div><strong>Holiday allowance top-up</strong><br>${euro(data.holidayAllowanceTopUp)}</div>
        <div style="grid-column:1/-1;"><strong>Total gross payout</strong><br><span style="font-size:24px;color:var(--success);">${euro(data.totalGrossPayout)}</span></div>
      </div>
      <h4>Operational notes</h4>
      <ul>${data.annotations.map(a => `<li>${a}</li>`).join('')}</ul>
    `
  } catch (err) {
    summaryDiv.innerHTML = `<p class="error">${err instanceof Error ? err.message : 'Unable to calculate offboarding summary'}</p>`
    currentOffboardingSummary = null
  }
})

// Excel export functionality
document.getElementById('offExportExcel')?.addEventListener('click', async () => {
  if (!currentOffboardingSummary) {
    alert('Please calculate an offboarding summary first')
    return
  }
  
  // Create Excel content using a simple CSV-like format that Excel can open
  const data = currentOffboardingSummary
  const rows = [
    ['Offboarding Payout Calculation', ''],
    ['Employee', data.name],
    ['Employee ID', data.employeeId],
    ['Hire Date', data.startDate],
    ['Exit Date', data.exitDate],
    ['Primary Reason', data.primaryReason],
    ['Secondary Reason', data.secondaryReason || 'N/A'],
    ['Looncode', data.looncode],
    ['Looncode Description', data.looncodeDescription],
    [''],
    ['Calculation Details', 'Amount (EUR)'],
    ['Tenure (Months)', data.tenureMonths],
    ['Tenure (Years)', data.tenureYears],
    ['Base Monthly Salary', data.baseMonthlySalary.toFixed(2)],
    [''],
    ['Payout Components', 'Amount (EUR)'],
    ['Notice Pay', data.noticePay.toFixed(2)],
    ['Notice Pay Explanation', data.noticePayExplanation],
    ['Transition Allowance', data.transitionAllowance.toFixed(2)],
    ['Unused Vacation Payout', data.unusedVacationPayout.toFixed(2)],
    ['Holiday Allowance Top-up', data.holidayAllowanceTopUp.toFixed(2)],
    ['Total Gross Payout', data.totalGrossPayout.toFixed(2)],
    [''],
    ['Explanations', ''],
    ...data.annotations.map(a => ['', a])
  ]
  
  // Convert to CSV format
  const csv = rows.map(row => 
    row.map(cell => {
      const str = String(cell || '')
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }).join(',')
  ).join('\n')
  
  // Add BOM for UTF-8 Excel compatibility
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `offboarding-${data.employeeId}-${data.exitDate}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
})

function populateOffboardingEmployees () {
  const sel = document.getElementById('offEmployee')
  if (!sel) return
  const current = sel.value
  sel.innerHTML = ''
  employeeCache.forEach(e => {
    const opt = document.createElement('option')
    opt.value = e.id
    opt.textContent = `${e.firstName} ${e.lastName} (${e.id})`
    sel.appendChild(opt)
  })
  if (current) sel.value = current
}

// Termination calculator hydration
function hydrateTerminationCalculator () {
  const sel = document.getElementById('termEmployee')
  if (!sel) return
  const current = sel.value
  sel.innerHTML = ''
  employeeCache.forEach(e => {
    const opt = document.createElement('option')
    opt.value = e.id
    opt.textContent = `${e.firstName} ${e.lastName} (${e.id})`
    sel.appendChild(opt)
  })
  const active = employeeCache[0]
  if (!current && active) sel.value = active.id
  const selected = employeeCache.find(e => e.id === sel.value)
  document.getElementById('termDate').valueAsDate = new Date()
  if (selected) {
    document.getElementById('termDaysPerYear').value = selected.holidayDaysPerYear
    document.getElementById('termUsedDays').value = selected.usedHolidayDaysYtd
  }
}

document.getElementById('termEmployee').addEventListener('change', () => {
  const id = document.getElementById('termEmployee').value
  const e = employeeCache.find(emp => emp.id === id)
  if (!e) return
  document.getElementById('termDaysPerYear').value = e.holidayDaysPerYear
  document.getElementById('termUsedDays').value = e.usedHolidayDaysYtd
})

document.getElementById('calcTermBtn').addEventListener('click', async () => {
  const id = document.getElementById('termEmployee').value
  const terminationDate = document.getElementById('termDate').value
  const daysPerYear = parseFloat(document.getElementById('termDaysPerYear').value)
  const usedDaysYtd = parseFloat(document.getElementById('termUsedDays').value)
  const params = new URLSearchParams({ employeeId: id, terminationDate: terminationDate, daysPerYear: String(daysPerYear), usedDaysYtd: String(usedDaysYtd) })
  const r = await fetch('/api/calculators/termination?' + params.toString()).then(r => r.json())
  const div = document.getElementById('termResult')
  div.innerHTML = `
    <div class="grid two">
      <div><strong>Accrued days</strong><br>${r.accruedDays}</div>
      <div><strong>Remaining days</strong><br>${r.remainingDays}</div>
      <div><strong>Hours per day</strong><br>${r.hoursPerDay}</div>
      <div><strong>Hourly rate</strong><br>${euro(r.hourlyRate)}</div>
      <div><strong>Payout gross</strong><br>${euro(r.payoutGross)}</div>
      <div><strong>Holiday allowance 8%</strong><br>${euro(r.holidayAllowance8pct)}</div>
      <div><strong>Total gross</strong><br>${euro(r.totalGross)}</div>
    </div>
  `
})

// Command center visuals
function renderCommandCenter () {
  const mixContainer = document.getElementById('commandMix')
  if (!mixContainer) return
  if (!employeeCache.length) {
    mixContainer.innerHTML = '<p class="muted">Load employees to populate command center.</p>'
    return
  }

  const activeEmployees = employeeCache.filter(e => {
    if (!e.endDate) return true
    const exit = new Date(e.endDate)
    return exit >= new Date()
  })

  renderForecast(activeEmployees)
  renderContractMix(activeEmployees)
  renderAttrition(activeEmployees)
  renderUpcomingExits(activeEmployees)
  renderActions(activeEmployees)
}

function renderForecast (activeEmployees) {
  const canvas = document.getElementById('commandForecast')
  if (!canvas || !canvas.getContext) return
  const ctx = canvas.getContext('2d')
  const today = new Date()
  const baseCount = activeEmployees.length
  const hiresLastQuarter = employeeCache.filter(e => new Date(e.startDate) >= addMonths(today, -3)).length
  const exitsNextQuarter = employeeCache.filter(e => e.endDate && new Date(e.endDate) >= today && new Date(e.endDate) <= addMonths(today, 3)).length
  const monthlyDelta = (hiresLastQuarter - exitsNextQuarter) / 3
  const dataPoints = []
  for (let i = 0; i < 6; i++) {
    dataPoints.push(Math.round(baseCount + monthlyDelta * i))
  }
  const labels = Array.from({ length: 6 }, (_, i) => {
    const d = addMonths(today, i)
    return d.toLocaleString('default', { month: 'short' })
  })
  drawLineChart(ctx, labels, dataPoints)
}

function drawLineChart (ctx, labels, values) {
  const width = ctx.canvas.width
  const height = ctx.canvas.height
  ctx.clearRect(0, 0, width, height)
  const padding = 32
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1

  ctx.strokeStyle = 'rgba(138,180,255,0.3)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(padding, padding)
  ctx.lineTo(padding, height - padding)
  ctx.lineTo(width - padding, height - padding)
  ctx.stroke()

  ctx.strokeStyle = '#8ab4ff'
  ctx.fillStyle = 'rgba(138,180,255,0.2)'
  ctx.lineWidth = 3
  ctx.beginPath()
  values.forEach((value, index) => {
    const x = padding + (index / (values.length - 1)) * (width - padding * 2)
    const y = height - padding - ((value - min) / range) * (height - padding * 2)
    if (index === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.stroke()

  ctx.lineTo(width - padding, height - padding)
  ctx.lineTo(padding, height - padding)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#8ab4ff'
  ctx.font = '12px sans-serif'
  labels.forEach((label, index) => {
    const x = padding + (index / (labels.length - 1)) * (width - padding * 2)
    ctx.fillText(label, x - 12, height - padding + 16)
  })
}

function renderContractMix (activeEmployees) {
  const container = document.getElementById('commandMix')
  container.innerHTML = ''
  const counts = activeEmployees.reduce((acc, e) => {
    acc[e.contractType] = (acc[e.contractType] || 0) + 1
    return acc
  }, {})
  const total = activeEmployees.length || 1
  Object.entries(counts).forEach(([type, count]) => {
    const percent = Math.round((count / total) * 100)
    const bar = document.createElement('div')
    bar.className = 'mix-bar'
    bar.innerHTML = `<span>${type} • ${percent}%</span><div class="mix-bar-fill" style="width:${percent}%"></div>`
    container.appendChild(bar)
  })
}

function renderAttrition (activeEmployees) {
  const list = document.getElementById('commandAttrition')
  list.innerHTML = ''
  const today = new Date()
  const risks = activeEmployees.map(e => {
    const tenureMonths = monthsBetween(new Date(e.startDate), today)
    let score = 0
    if (e.contractType !== 'permanent') score += 2
    if (e.endDate && new Date(e.endDate) <= addMonths(today, 6)) score += 3
    if (tenureMonths < 6) score += 1
    if (e.isThirtyPercentRuling) score += 0.5
    return { employee: e, score, tenureMonths }
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 5)

  if (!risks.length) {
    list.innerHTML = '<li class="muted">No immediate attrition risks flagged.</li>'
    return
  }

  risks.forEach(r => {
    const li = document.createElement('li')
    li.textContent = `${r.employee.firstName} ${r.employee.lastName} • score ${r.score.toFixed(1)} • tenure ${r.tenureMonths} months`
    list.appendChild(li)
  })
}

function renderUpcomingExits (activeEmployees) {
  const list = document.getElementById('commandExits')
  list.innerHTML = ''
  const today = new Date()
  const exits = employeeCache.filter(e => e.endDate && new Date(e.endDate) >= today).sort((a, b) => new Date(a.endDate) - new Date(b.endDate)).slice(0, 5)
  if (!exits.length) {
    list.innerHTML = '<li class="muted">No planned departures.</li>'
    return
  }
  exits.forEach(e => {
    const li = document.createElement('li')
    li.textContent = `${e.firstName} ${e.lastName} • ${e.endDate}`
    list.appendChild(li)
  })
}

function renderActions (activeEmployees) {
  const list = document.getElementById('commandActions')
  list.innerHTML = ''
  const today = new Date()
  const exitsSoon = employeeCache.filter(e => e.endDate && new Date(e.endDate) <= addMonths(today, 1))
  exitsSoon.forEach(e => {
    const li = document.createElement('li')
    li.textContent = `Launch handover plan for ${e.firstName} ${e.lastName} (leaves ${e.endDate}).`
    list.appendChild(li)
  })
  const contractorsShare = activeEmployees.filter(e => e.contractType === 'contractor').length / (activeEmployees.length || 1)
  if (contractorsShare > 0.3) {
    const li = document.createElement('li')
    li.textContent = 'Contractors exceed 30% of workforce—review conversion opportunities.'
    list.appendChild(li)
  }
  const rulingCount = activeEmployees.filter(e => e.isThirtyPercentRuling).length
  if (rulingCount > 0) {
    const li = document.createElement('li')
    li.textContent = `${rulingCount} employee(s) under 30% ruling—verify tax reimbursement budgets.`
    list.appendChild(li)
  }
  if (!list.children.length) {
    const li = document.createElement('li')
    li.textContent = 'No urgent actions detected. Keep monitoring payroll health.'
    list.appendChild(li)
  }
}

// Settings
function loadSettings () {
  const div = document.getElementById('company')
  div.innerHTML = `
    <div class="grid two">
      <div><strong>IBAN</strong><br>Loaded from .env at server start</div>
      <div><strong>BIC</strong><br>Loaded from .env</div>
      <div><strong>Currency</strong><br>EUR</div>
    </div>
  `
}
loadSettings()

// Payroll Runs
document.getElementById('btnCreateRun')?.addEventListener('click', async () => {
  const month = document.getElementById('month').value || new Date().toISOString().slice(0, 7)
  try {
    const res = await fetch('/api/payroll-runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month })
    })
    if (!res.ok) throw new Error('Failed to create payroll run')
    await loadPayrollRuns()
    document.getElementById('status').textContent = `Payroll run created for ${month}`
  } catch (err) {
    document.getElementById('status').textContent = err.message
  }
})

async function loadPayrollRuns() {
  try {
    const res = await fetch('/api/payroll-runs')
    if (!res.ok) throw new Error('Failed to load payroll runs')
    const data = await res.json()
    const tbody = document.querySelector('#payrollRunsTable tbody')
    if (!tbody) return
    tbody.innerHTML = ''
    
    if (!data.runs || data.runs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="muted">No payroll runs found. Create one to get started.</td></tr>'
      return
    }
    
    data.runs.forEach(run => {
      const tr = document.createElement('tr')
      const netTotal = run.totals?.net ?? 0
      const employeeCount = run.employeeCount ?? 0
      const grossTotal = run.totals?.gross ?? 0
      tr.innerHTML = `
        <td><strong>${run.month || ''}</strong></td>
        <td><span class="status-badge ${run.status || 'pending'}">${(run.status || 'pending').toUpperCase()}</span></td>
        <td>${employeeCount}</td>
        <td>${euro(grossTotal)}</td>
        <td><strong>${euro(netTotal)}</strong></td>
        <td>${run.createdAt ? new Date(run.createdAt).toLocaleDateString('nl-NL') : ''}</td>
        <td>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${run.status === 'pending' ? `<button class="success" style="padding:6px 12px;font-size:12px;" onclick="approvePayrollRun('${run.id}')">Approve</button>` : ''}
          ${run.status === 'approved' ? `<button class="secondary" style="padding:6px 12px;font-size:12px;" onclick="completePayrollRun('${run.id}')">Complete</button>` : ''}
          ${run.sepaFileGenerated ? `<button class="secondary" style="padding:6px 12px;font-size:12px;" onclick="downloadSepa('${run.id}')">Download SEPA</button>` : ''}
          </div>
        </td>
      `
      tbody.appendChild(tr)
    })
  } catch (err) {
    console.error('Error loading payroll runs:', err)
    const tbody = document.querySelector('#payrollRunsTable tbody')
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" class="error">Error loading payroll runs</td></tr>'
    }
  }
}

async function approvePayrollRun(id) {
  try {
    await fetch(`/api/payroll-runs/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvedBy: 'user' })
    })
    await loadPayrollRuns()
  } catch (err) {
    alert(err.message)
  }
}

async function completePayrollRun(id) {
  try {
    await fetch(`/api/payroll-runs/${id}/complete`, { method: 'POST' })
    await loadPayrollRuns()
  } catch (err) {
    alert(err.message)
  }
}

async function downloadSepa(id) {
  try {
    const res = await fetch(`/api/payroll-runs/${id}/sepa`, { method: 'POST' })
    const xml = await res.text()
    const blob = new Blob([xml], { type: 'application/xml' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `sepa-${id}.xml`
    a.click()
  } catch (err) {
    alert(err.message)
  }
}

// Load payroll runs on page load
loadPayrollRuns()

// Compliance - Pension
document.getElementById('btnPensionMonthly')?.addEventListener('click', async () => {
  const month = new Date().toISOString().slice(0, 7)
  const div = document.getElementById('pensionResults')
  if (!div) return
  div.innerHTML = '<p class="muted">Loading...</p>'
  try {
    const res = await fetch(`/api/pension/monthly/${month}`)
    if (!res.ok) throw new Error('Failed to load pension data')
    const data = await res.json()
    if (!data.calculations || data.calculations.length === 0) {
      div.innerHTML = '<p class="muted">No pension contributions for this month</p>'
      return
    }
    const totalEmployee = data.totals?.totalEmployee ?? 0
    const totalEmployer = data.totals?.totalEmployer ?? 0
    const total = data.totals?.total ?? 0
    div.innerHTML = `
      <h4>Monthly Pension Contributions (${month})</h4>
      <div class="grid two" style="margin:16px 0;">
        <div><strong>Total Employee:</strong> ${euro(totalEmployee)}</div>
        <div><strong>Total Employer:</strong> ${euro(totalEmployer)}</div>
        <div style="grid-column:1/-1;"><strong>Total:</strong> ${euro(total)}</div>
      </div>
      <table>
        <thead><tr><th>Employee</th><th>Provider</th><th>Employee</th><th>Employer</th><th>Total</th></tr></thead>
        <tbody>
          ${data.calculations.map(c => `<tr>
            <td>${c.employee?.name || ''}</td>
            <td>${c.provider || ''}</td>
            <td>${euro(c.employeeContribution ?? 0)}</td>
            <td>${euro(c.employerContribution ?? 0)}</td>
            <td><strong>${euro(c.totalContribution ?? 0)}</strong></td>
          </tr>`).join('')}
        </tbody>
      </table>
    `
  } catch (err) {
    div.innerHTML = `<p class="error">${err.message || 'Error loading pension data'}</p>`
  }
})

// Compliance - Health Insurance
document.getElementById('btnHealthInsurance')?.addEventListener('click', async () => {
  const div = document.getElementById('healthInsuranceResults')
  if (!div) return
  div.innerHTML = '<p class="muted">Loading...</p>'
  try {
    const res = await fetch('/api/health-insurance/monthly')
    if (!res.ok) throw new Error('Failed to load health insurance data')
    const data = await res.json()
    if (!data.calculations || data.calculations.length === 0) {
      div.innerHTML = '<p class="muted">No health insurance data for this month</p>'
      return
    }
    const totalEmployee = data.totals?.totalEmployee ?? 0
    const totalEmployer = data.totals?.totalEmployer ?? 0
    const total = data.totals?.total ?? 0
    div.innerHTML = `
      <h4>Monthly Health Insurance</h4>
      <div class="grid two" style="margin:16px 0;">
        <div><strong>Total Employee:</strong> ${euro(totalEmployee)}</div>
        <div><strong>Total Employer:</strong> ${euro(totalEmployer)}</div>
        <div style="grid-column:1/-1;"><strong>Total:</strong> ${euro(total)}</div>
      </div>
      <table>
        <thead><tr><th>Employee</th><th>Provider</th><th>Employee</th><th>Employer</th><th>Total</th></tr></thead>
        <tbody>
          ${data.calculations.map(c => `<tr>
            <td>${c.employee?.name || ''}</td>
            <td>${c.provider || ''}</td>
            <td>${euro(c.employeePremium ?? 0)}</td>
            <td>${euro(c.employerContribution ?? 0)}</td>
            <td><strong>${euro(c.totalPremium ?? 0)}</strong></td>
          </tr>`).join('')}
        </tbody>
      </table>
    `
  } catch (err) {
    div.innerHTML = `<p class="error">${err.message || 'Error loading health insurance data'}</p>`
  }
})

// Populate jaaropgave employee dropdown
function populateJaaropgaveEmployees() {
  const sel = document.getElementById('jaaropgaveEmployee')
  if (!sel) return
  sel.innerHTML = ''
  employeeCache.forEach(e => {
    const opt = document.createElement('option')
    opt.value = e.id
    opt.textContent = `${e.firstName} ${e.lastName} (${e.id})`
    sel.appendChild(opt)
  })
  if (employeeCache.length > 0 && !sel.value) {
    sel.value = employeeCache[0].id
  }
}

// Compliance - Jaaropgave
document.getElementById('btnGenerateJaaropgave')?.addEventListener('click', async () => {
  const yearEl = document.getElementById('jaaropgaveYear')
  const employeeSel = document.getElementById('jaaropgaveEmployee')
  const year = yearEl ? parseInt(yearEl.value) || new Date().getFullYear() : new Date().getFullYear()
  const employeeId = employeeSel ? employeeSel.value : employeeCache[0]?.id
  const div = document.getElementById('jaaropgaveResults')
  if (!div) return
  if (!employeeId) {
    div.innerHTML = '<p class="warning">Please select an employee</p>'
    return
  }
  div.innerHTML = '<p class="muted">Generating jaaropgave...</p>'
  try {
    const res = await fetch('/api/jaaropgave/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, year })
    })
    if (!res.ok) throw new Error('Failed to generate jaaropgave')
    const data = await res.json()
    if (!data.data) throw new Error('Invalid response data')
    const annualGross = data.data.annualGross ?? 0
    const annualNet = data.data.annualNet ?? 0
    const annualTax = data.data.annualTax ?? 0
    const annualSocialSecurity = data.data.annualSocialSecurity ?? 0
    const annualHolidayAllowance = data.data.annualHolidayAllowance ?? 0
    div.innerHTML = `
      <h4>Jaaropgave Generated</h4>
      <div class="grid two" style="margin:16px 0;">
        <div><strong>Employee:</strong> ${data.data.employee?.name || ''}</div>
        <div><strong>Year:</strong> ${data.data.year || year}</div>
        <div><strong>Annual Gross:</strong> ${euro(annualGross)}</div>
        <div><strong>Annual Net:</strong> ${euro(annualNet)}</div>
        <div><strong>Annual Tax:</strong> ${euro(annualTax)}</div>
        <div><strong>Social Security:</strong> ${euro(annualSocialSecurity)}</div>
        <div><strong>Holiday Allowance:</strong> ${euro(annualHolidayAllowance)}</div>
      </div>
      <p class="muted small">Jaaropgave ID: ${data.id}</p>
    `
  } catch (err) {
    div.innerHTML = `<p class="error">${err.message || 'Error generating jaaropgave'}</p>`
  }
})

document.getElementById('btnGenerateAllJaaropgave')?.addEventListener('click', async () => {
  const yearEl = document.getElementById('jaaropgaveYear')
  const year = yearEl ? parseInt(yearEl.value) || new Date().getFullYear() : new Date().getFullYear()
  const div = document.getElementById('jaaropgaveResults')
  if (!div) return
  div.innerHTML = '<p class="muted">Generating jaaropgaves for all employees...</p>'
  try {
    const res = await fetch('/api/jaaropgave/generate-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year })
    })
    if (!res.ok) throw new Error('Failed to generate jaaropgaves')
    const data = await res.json()
    const count = data.count ?? 0
    div.innerHTML = `
      <h4>Success!</h4>
      <p class="success">Generated ${count} jaaropgaves for ${year}</p>
    `
  } catch (err) {
    div.innerHTML = `<p class="error">${err.message || 'Error generating jaaropgaves'}</p>`
  }
})

// Compliance - Tax Filing
document.getElementById('btnGenerateTaxFiling')?.addEventListener('click', async () => {
  const monthEl = document.getElementById('taxFilingMonth')
  const month = monthEl ? monthEl.value || new Date().toISOString().slice(0, 7) : new Date().toISOString().slice(0, 7)
  const div = document.getElementById('taxFilingResults')
  if (!div) return
  div.innerHTML = '<p class="muted">Generating tax filing...</p>'
  try {
    const res = await fetch('/api/tax-filing/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month })
    })
    if (!res.ok) throw new Error('Failed to generate tax filing')
    const data = await res.json()
    if (!data.data) throw new Error('Invalid response data')
    const employeeCount = data.data.employeeCount ?? 0
    const totalGross = data.data.totalGross ?? 0
    const totalTax = data.data.totalTax ?? 0
    div.innerHTML = `
      <h4>Tax Filing Generated</h4>
      <div class="grid two" style="margin:16px 0;">
        <div><strong>Month:</strong> ${data.month || month}</div>
        <div><strong>Status:</strong> <span class="status-badge ${data.status || 'draft'}">${(data.status || 'draft').toUpperCase()}</span></div>
        <div><strong>Employees:</strong> ${employeeCount}</div>
        <div><strong>Total Gross:</strong> ${euro(totalGross)}</div>
        <div><strong>Total Tax:</strong> ${euro(totalTax)}</div>
      </div>
    `
  } catch (err) {
    div.innerHTML = `<p class="error">${err.message || 'Error generating tax filing'}</p>`
  }
})

// Mock Services
document.getElementById('btnViewBankSubmissions')?.addEventListener('click', async () => {
  const div = document.getElementById('bankSubmissions')
  if (!div) return
  div.innerHTML = '<p class="muted">Loading...</p>'
  try {
    const res = await fetch('/api/mock-services/bank/submissions')
    if (!res.ok) throw new Error('Failed to load bank submissions')
    const data = await res.json()
    const submissions = data.submissions || []
    if (submissions.length === 0) {
      div.innerHTML = '<p class="muted">No bank submissions found</p>'
      return
    }
    div.innerHTML = `
      <h4>Bank Submissions (${submissions.length})</h4>
      <table>
        <thead><tr><th>ID</th><th>Status</th><th>Amount</th><th>Transactions</th><th>Submitted</th></tr></thead>
        <tbody>
          ${submissions.slice(0, 10).map(s => `<tr>
            <td><code style="font-size:11px;">${s.id || ''}</code></td>
            <td><span class="status-badge ${s.status || 'pending'}">${(s.status || 'pending').toUpperCase()}</span></td>
            <td><strong>${euro(s.totalAmount ?? 0)}</strong></td>
            <td>${s.transactionCount ?? 0}</td>
            <td>${s.submittedAt ? new Date(s.submittedAt).toLocaleDateString('nl-NL') : '-'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      ${submissions.length > 10 ? `<p class="muted small">Showing 10 of ${submissions.length} submissions</p>` : ''}
    `
  } catch (err) {
    div.innerHTML = `<p class="error">${err.message || 'Error loading bank submissions'}</p>`
  }
})

document.getElementById('btnViewPensionSubmissions')?.addEventListener('click', async () => {
  const div = document.getElementById('pensionSubmissions')
  if (!div) return
  div.innerHTML = '<p class="muted">Loading...</p>'
  try {
    const res = await fetch('/api/mock-services/pension/submissions')
    if (!res.ok) throw new Error('Failed to load pension submissions')
    const data = await res.json()
    const submissions = data.submissions || []
    if (submissions.length === 0) {
      div.innerHTML = '<p class="muted">No pension submissions found</p>'
      return
    }
    div.innerHTML = `
      <h4>Pension Submissions (${submissions.length})</h4>
      <table>
        <thead><tr><th>Month</th><th>Employee</th><th>Provider</th><th>Employee Contrib.</th><th>Employer Contrib.</th><th>Status</th></tr></thead>
        <tbody>
          ${submissions.slice(0, 10).map(s => `<tr>
            <td>${s.month || ''}</td>
            <td>${s.employeeId || ''}</td>
            <td>${s.provider || ''}</td>
            <td>${euro(s.employeeContribution ?? 0)}</td>
            <td>${euro(s.employerContribution ?? 0)}</td>
            <td><span class="status-badge ${s.status || 'pending'}">${(s.status || 'pending').toUpperCase()}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>
    `
  } catch (err) {
    div.innerHTML = `<p class="error">${err.message || 'Error loading pension submissions'}</p>`
  }
})

document.getElementById('btnViewInsuranceSubmissions')?.addEventListener('click', async () => {
  const div = document.getElementById('insuranceSubmissions')
  if (!div) return
  div.innerHTML = '<p class="muted">Loading...</p>'
  try {
    const res = await fetch('/api/mock-services/insurance/submissions')
    if (!res.ok) throw new Error('Failed to load insurance submissions')
    const data = await res.json()
    const submissions = data.submissions || []
    if (submissions.length === 0) {
      div.innerHTML = '<p class="muted">No insurance submissions found</p>'
      return
    }
    div.innerHTML = `
      <h4>Health Insurance Submissions (${submissions.length})</h4>
      <table>
        <thead><tr><th>Month</th><th>Employee</th><th>Provider</th><th>Premium</th><th>Employer Contrib.</th><th>Status</th></tr></thead>
        <tbody>
          ${submissions.slice(0, 10).map(s => `<tr>
            <td>${s.month || ''}</td>
            <td>${s.employeeId || ''}</td>
            <td>${s.provider || ''}</td>
            <td>${euro(s.premium ?? 0)}</td>
            <td>${euro(s.employerContribution ?? 0)}</td>
            <td><span class="status-badge ${s.status || 'pending'}">${(s.status || 'pending').toUpperCase()}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>
    `
  } catch (err) {
    div.innerHTML = `<p class="error">${err.message || 'Error loading insurance submissions'}</p>`
  }
})

document.getElementById('btnViewTaxFilings')?.addEventListener('click', async () => {
  const div = document.getElementById('taxFilings')
  if (!div) return
  div.innerHTML = '<p class="muted">Loading...</p>'
  try {
    const res = await fetch('/api/tax-filing?limit=20')
    if (!res.ok) throw new Error('Failed to load tax filings')
    const data = await res.json()
    const filings = data.filings || []
    if (filings.length === 0) {
      div.innerHTML = '<p class="muted">No tax filings found</p>'
      return
    }
    div.innerHTML = `
      <h4>Tax Filings (${filings.length})</h4>
      <table>
        <thead><tr><th>Month</th><th>Status</th><th>Employees</th><th>Total Gross</th><th>Total Tax</th><th>Submitted</th></tr></thead>
        <tbody>
          ${filings.map(f => `<tr>
            <td><strong>${f.month || ''}</strong></td>
            <td><span class="status-badge ${f.status || 'draft'}">${(f.status || 'draft').toUpperCase()}</span></td>
            <td>${f.employeeCount ?? 0}</td>
            <td>${euro(f.totalGross ?? 0)}</td>
            <td>${euro(f.totalTax ?? 0)}</td>
            <td>${f.submittedAt ? new Date(f.submittedAt).toLocaleDateString('nl-NL') : '-'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    `
  } catch (err) {
    div.innerHTML = `<p class="error">${err.message || 'Error loading tax filings'}</p>`
  }
})

document.getElementById('btnViewEmails')?.addEventListener('click', async () => {
  const div = document.getElementById('emails')
  if (!div) return
  div.innerHTML = '<p class="muted">Loading...</p>'
  try {
    const res = await fetch('/api/mock-services/emails?limit=20')
    if (!res.ok) throw new Error('Failed to load emails')
    const data = await res.json()
    const emails = data.emails || []
    if (emails.length === 0) {
      div.innerHTML = '<p class="muted">No emails found</p>'
      return
    }
    div.innerHTML = `
      <h4>Email Notifications (${emails.length})</h4>
      <table>
        <thead><tr><th>To</th><th>Subject</th><th>Status</th><th>Sent</th></tr></thead>
        <tbody>
          ${emails.map(e => `<tr>
            <td>${e.to || ''}</td>
            <td>${e.subject || ''}</td>
            <td><span class="status-badge ${e.status || 'sent'}">${(e.status || 'sent').toUpperCase()}</span></td>
            <td>${e.sentAt ? new Date(e.sentAt).toLocaleString('nl-NL') : '-'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    `
  } catch (err) {
    div.innerHTML = `<p class="error">${err.message || 'Error loading emails'}</p>`
  }
})

document.getElementById('btnSyncHr')?.addEventListener('click', async () => {
  const div = document.getElementById('hrSyncs')
  if (!div) return
  div.innerHTML = '<p class="muted">Syncing HR system...</p>'
  try {
    const res = await fetch('/api/mock-services/hr/sync', { method: 'POST' })
    if (!res.ok) throw new Error('Failed to sync HR system')
    const data = await res.json()
    const sync = data.sync || {}
    div.innerHTML = `
      <h4>HR Sync Completed</h4>
      <div class="grid two" style="margin:12px 0;">
        <div><strong>Status:</strong> <span class="status-badge ${sync.status || 'success'}">${(sync.status || 'success').toUpperCase()}</span></div>
        <div><strong>Sync Date:</strong> ${sync.syncDate ? new Date(sync.syncDate).toLocaleString('nl-NL') : '-'}</div>
        <div><strong>Employees Added:</strong> ${sync.employeesAdded ?? 0}</div>
        <div><strong>Employees Updated:</strong> ${sync.employeesUpdated ?? 0}</div>
        <div><strong>Employees Removed:</strong> ${sync.employeesRemoved ?? 0}</div>
      </div>
    `
    // Refresh employee list after sync
    setTimeout(() => loadEmployees(), 1000)
  } catch (err) {
    div.innerHTML = `<p class="error">${err.message || 'Error syncing HR system'}</p>`
  }
})

document.getElementById('btnViewHrSyncs')?.addEventListener('click', async () => {
  const div = document.getElementById('hrSyncs')
  if (!div) return
  div.innerHTML = '<p class="muted">Loading...</p>'
  try {
    const res = await fetch('/api/mock-services/hr/syncs')
    if (!res.ok) throw new Error('Failed to load HR syncs')
    const data = await res.json()
    const syncs = data.syncs || []
    if (syncs.length === 0) {
      div.innerHTML = '<p class="muted">No HR syncs found</p>'
      return
    }
    div.innerHTML = `
      <h4>HR Sync History (${syncs.length})</h4>
      <table>
        <thead><tr><th>Date</th><th>Status</th><th>Added</th><th>Updated</th><th>Removed</th></tr></thead>
        <tbody>
          ${syncs.slice(0, 10).map(s => `<tr>
            <td>${s.syncDate ? new Date(s.syncDate).toLocaleDateString('nl-NL') : '-'}</td>
            <td><span class="status-badge ${s.status || 'success'}">${(s.status || 'success').toUpperCase()}</span></td>
            <td>${s.employeesAdded ?? 0}</td>
            <td>${s.employeesUpdated ?? 0}</td>
            <td>${s.employeesRemoved ?? 0}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    `
  } catch (err) {
    div.innerHTML = `<p class="error">${err.message || 'Error loading HR syncs'}</p>`
  }
})

// Audit Log
async function loadAuditLogs() {
  try {
    const eventType = document.getElementById('auditEventType')?.value
    const url = eventType 
      ? `/api/audit/event-type/${eventType}?limit=50`
      : '/api/audit/recent?limit=50'
    const res = await fetch(url)
    if (!res.ok) throw new Error('Failed to load audit logs')
    const data = await res.json()
    const tbody = document.querySelector('#auditLogTable tbody')
    if (!tbody) return
    tbody.innerHTML = ''
    
    if (!data.logs || data.logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="muted">No audit logs found</td></tr>'
      return
    }
    
    data.logs.forEach(log => {
      const tr = document.createElement('tr')
      const timestamp = log.timestamp ? new Date(log.timestamp).toLocaleString('nl-NL') : '-'
      const eventType = log.eventType || '-'
      const userId = log.userId || '-'
      const dataStr = log.data ? JSON.stringify(log.data).substring(0, 80) : '-'
      tr.innerHTML = `
        <td>${timestamp}</td>
        <td><code style="font-size:11px;background:rgba(138,180,255,0.1);padding:2px 6px;border-radius:4px;">${eventType}</code></td>
        <td>${userId}</td>
        <td style="font-size:12px;color:var(--muted);max-width:400px;overflow:hidden;text-overflow:ellipsis;">${dataStr}${dataStr.length >= 80 ? '...' : ''}</td>
      `
      tbody.appendChild(tr)
    })
  } catch (err) {
    console.error('Error loading audit logs:', err)
    const tbody = document.querySelector('#auditLogTable tbody')
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="4" class="error">Error loading audit logs</td></tr>'
    }
  }
}

document.getElementById('auditEventType')?.addEventListener('input', (e) => {
  const value = e.target.value
  if (value === '') {
    loadAuditLogs()
  }
})

document.getElementById('btnRefreshAudit')?.addEventListener('click', loadAuditLogs)
document.getElementById('btnRecentAudit')?.addEventListener('click', loadAuditLogs)
loadAuditLogs()

// Payslips - using frontend module
let currentPayslipId = null

window.showPayslipDetail = function(payslipId) {
  const modal = document.getElementById('payslipModal')
  const modalTitle = document.getElementById('payslipModalTitle')
  const pdfViewer = document.getElementById('payslipPdfViewer')
  
  if (!modal || !pdfViewer) return
  
  const payslip = getPayslipById(payslipId)
  if (!payslip) {
    pdfViewer.innerHTML = '<p class="error">Payslip not found</p>'
    modal.hidden = false
    return
  }
  
  currentPayslipId = payslipId
  
  if (modalTitle) {
    modalTitle.textContent = `Payslip - ${payslip.employeeName} - ${payslip.month}`
  }
  
  const pdfHtml = generatePayslipPdfHtml(payslipId)
  if (pdfHtml) {
    pdfViewer.innerHTML = pdfHtml
  } else {
    pdfViewer.innerHTML = '<p class="error">Unable to generate payslip</p>'
  }
  
  modal.hidden = false
  document.body.style.overflow = 'hidden'
}

function closePayslipModal() {
  const modal = document.getElementById('payslipModal')
  if (modal) {
    modal.hidden = true
    document.body.style.overflow = ''
    currentPayslipId = null
  }
}

function downloadPayslip() {
  if (!currentPayslipId) return
  
  const blob = generatePayslipPdfBlob(currentPayslipId)
  if (!blob) {
    alert('Unable to generate payslip for download')
    return
  }
  
  const payslip = getPayslipById(currentPayslipId)
  const fileName = `payslip-${payslip ? payslip.month : 'unknown'}.html`
  
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function printPayslip() {
  if (!currentPayslipId) return
  
  const pdfHtml = generatePayslipPdfHtml(currentPayslipId)
  if (!pdfHtml) {
    alert('Unable to generate payslip for printing')
    return
  }
  
  const printWindow = window.open('', '_blank')
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Payslip - Print</title>
      <style>
        @media print {
          body { margin: 0; }
          @page { margin: 20mm; }
        }
      </style>
    </head>
    <body>
      ${pdfHtml}
    </body>
    </html>
  `)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => {
    printWindow.print()
  }, 250)
}

// Close modal handlers
document.getElementById('closePayslipModal')?.addEventListener('click', closePayslipModal)
document.getElementById('payslipModalOverlay')?.addEventListener('click', closePayslipModal)
document.getElementById('btnDownloadPayslip')?.addEventListener('click', downloadPayslip)
document.getElementById('btnPrintPayslip')?.addEventListener('click', printPayslip)

// Close on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('payslipModal')
    if (modal && !modal.hidden) {
      closePayslipModal()
    }
  }
})


// Helpers
function addMonths (date, delta) {
  const d = new Date(date.getTime())
  d.setMonth(d.getMonth() + delta)
  return d
}

function monthsBetween (start, end) {
  const years = end.getFullYear() - start.getFullYear()
  const months = end.getMonth() - start.getMonth()
  const total = years * 12 + months
  const dayAdjust = (end.getDate() - start.getDate()) / 30
  return Math.max(0, Math.round((total + dayAdjust) * 10) / 10)
}

// Rates Management UI
document.getElementById('btnViewTaxTables')?.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/rates/tax-tables')
    const data = await res.json()
    const div = document.getElementById('taxTablesList')
    if (!div) return
    
    if (!data.taxTables || data.taxTables.length === 0) {
      div.innerHTML = '<p class="muted">No tax tables found</p>'
      return
    }
    
    div.innerHTML = `
      <h4>Tax Tables (${data.taxTables.length})</h4>
      <table style="font-size:13px;">
        <thead><tr><th>Period</th><th>Table Type</th><th>Bracket Low</th><th>Bracket High</th><th>Rate</th></tr></thead>
        <tbody>
          ${data.taxTables.slice(0, 10).map(t => `
            <tr>
              <td>${t.periodStart} to ${t.periodEnd}</td>
              <td>${t.tableType}</td>
              <td>${euro(t.bracketLow)}</td>
              <td>${t.bracketHigh === Number.POSITIVE_INFINITY ? '∞' : euro(t.bracketHigh)}</td>
              <td>${(t.rate * 100).toFixed(2)}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
  } catch (err) {
    console.error('Error loading tax tables:', err)
  }
})

document.getElementById('btnCheckCoverage')?.addEventListener('click', async () => {
  const start = document.getElementById('coverageStart')?.value
  const end = document.getElementById('coverageEnd')?.value
  const div = document.getElementById('coverageResult')
  if (!div || !start || !end) return
  
  try {
    const res = await fetch(`/api/rates/coverage/${start}/${end}`)
    const data = await res.json()
    
    div.innerHTML = `
      <div class="${data.covered ? 'success' : 'warning'}" style="padding:12px;border-radius:6px;">
        <strong>Coverage Status:</strong> ${data.covered ? '✓ Complete' : '✗ Incomplete'}
      </div>
      ${data.missing.length > 0 ? `
        <h4 style="margin-top:16px;">Missing Rates:</h4>
        <ul>
          ${data.missing.map(m => `<li>${m}</li>`).join('')}
        </ul>
      ` : ''}
      ${data.warnings.length > 0 ? `
        <h4 style="margin-top:16px;">Warnings:</h4>
        <ul>
          ${data.warnings.map(w => `<li>${w}</li>`).join('')}
        </ul>
      ` : ''}
    `
  } catch (err) {
    div.innerHTML = `<p class="error">Error checking coverage: ${err.message}</p>`
  }
})

// Import Tax Table from Excel
document.getElementById('btnImportTaxTable')?.addEventListener('click', async () => {
  const fileInput = document.getElementById('taxTableFileInput')
  const periodStartInput = document.getElementById('taxTablePeriodStart')
  const periodEndInput = document.getElementById('taxTablePeriodEnd')
  const tableTypeInput = document.getElementById('taxTableType')
  const taxYearInput = document.getElementById('taxTableYear')
  const resultDiv = document.getElementById('taxTableImportResult')
  
  if (!fileInput || !periodStartInput || !periodEndInput || !tableTypeInput || !resultDiv) return
  
  const file = fileInput.files?.[0]
  if (!file) {
    resultDiv.innerHTML = '<p class="error">Please select an Excel file</p>'
    return
  }
  
  const periodStart = periodStartInput.value
  const periodEnd = periodEndInput.value
  if (!periodStart || !periodEnd) {
    resultDiv.innerHTML = '<p class="error">Please provide period start and end dates</p>'
    return
  }
  
  // Format dates as YYYY-MM-DD
  const startDate = new Date(periodStart)
  const endDate = new Date(periodEnd)
  const formattedStart = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
  const formattedEnd = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
  
  const tableType = tableTypeInput.value
  const taxYear = taxYearInput.value ? parseInt(taxYearInput.value) : undefined
  
  try {
    resultDiv.innerHTML = '<p>Uploading and parsing Excel file...</p>'
    
    const formData = new FormData()
    formData.append('file', file)
    formData.append('periodStart', formattedStart)
    formData.append('periodEnd', formattedEnd)
    formData.append('tableType', tableType)
    if (taxYear) {
      formData.append('taxYear', taxYear.toString())
    }
    
    const res = await fetch('/api/rates/tax-tables/import-excel', {
      method: 'POST',
      body: formData
    })
    
    const data = await res.json()
    
    if (!res.ok) {
      resultDiv.innerHTML = `
        <div class="error" style="padding:12px;border-radius:6px;">
          <strong>Import Failed:</strong> ${data.error || 'Unknown error'}
          ${data.errors && data.errors.length > 0 ? `
            <h4 style="margin-top:12px;">Errors:</h4>
            <ul>
              ${data.errors.map(e => `<li>${e}</li>`).join('')}
            </ul>
          ` : ''}
          ${data.warnings && data.warnings.length > 0 ? `
            <h4 style="margin-top:12px;">Warnings:</h4>
            <ul>
              ${data.warnings.map(w => `<li>${w}</li>`).join('')}
            </ul>
          ` : ''}
        </div>
      `
      return
    }
    
    resultDiv.innerHTML = `
      <div class="success" style="padding:12px;border-radius:6px;">
        <strong>Import Successful!</strong>
        <p>Imported ${data.imported} of ${data.total} tax table entries</p>
        ${data.warnings && data.warnings.length > 0 ? `
          <h4 style="margin-top:12px;">Warnings:</h4>
          <ul>
            ${data.warnings.map(w => `<li>${w}</li>`).join('')}
          </ul>
        ` : ''}
        ${data.errors && data.errors.length > 0 ? `
          <h4 style="margin-top:12px;">Errors:</h4>
          <ul>
            ${data.errors.map(e => `<li>${e}</li>`).join('')}
          </ul>
        ` : ''}
      </div>
    `
    
    // Clear file input
    fileInput.value = ''
  } catch (err) {
    resultDiv.innerHTML = `<p class="error">Error importing tax table: ${err.message}</p>`
  }
})

// Loonaangifte UI
document.getElementById('btnCreateLoonaangifteBatch')?.addEventListener('click', async () => {
  const month = document.getElementById('loonaangifteMonth')?.value
  const div = document.getElementById('loonaangifteResults')
  if (!div || !month) return
  
  try {
    const res = await fetch('/api/loonaangifte/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period: month, createdBy: 'user' })
    })
    
    if (!res.ok) throw new Error('Failed to create batch')
    const data = await res.json()
    
    div.innerHTML = `
      <div class="success" style="padding:12px;border-radius:6px;">
        <strong>Batch Created:</strong> ${data.batch.id}<br>
        <strong>Period:</strong> ${data.batch.period}<br>
        <strong>Status:</strong> ${data.batch.status}
      </div>
    `
    
    await loadLoonaangifteBatches()
  } catch (err) {
    div.innerHTML = `<p class="error">Error: ${err.message}</p>`
  }
})

async function loadLoonaangifteBatches() {
  try {
    const res = await fetch('/api/loonaangifte/batches')
    const data = await res.json()
    const div = document.getElementById('loonaangifteBatches')
    if (!div) return
    
    if (!data.batches || data.batches.length === 0) {
      div.innerHTML = '<p class="muted">No Loonaangifte batches found</p>'
      return
    }
    
    div.innerHTML = `
      <h4>Loonaangifte Batches</h4>
      <table style="font-size:13px;">
        <thead><tr><th>Period</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>
          ${data.batches.map(b => `
            <tr>
              <td>${b.period}</td>
              <td><span class="status-badge ${b.status}">${b.status.toUpperCase()}</span></td>
              <td>${new Date(b.createdAt).toLocaleDateString('nl-NL')}</td>
              <td>
                <button class="secondary" style="padding:4px 8px;font-size:12px;" onclick="viewLoonaangifteBatch('${b.id}')">View</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
  } catch (err) {
    console.error('Error loading batches:', err)
  }
}

window.viewLoonaangifteBatch = async function(batchId) {
  try {
    const res = await fetch(`/api/loonaangifte/batches/${batchId}`)
    const data = await res.json()
    const div = document.getElementById('loonaangifteResults')
    if (!div) return
    
    const validation = data.validationReport
    div.innerHTML = `
      <h4>Batch Details: ${data.batch.id}</h4>
      <div class="grid two" style="margin:16px 0;">
        <div><strong>Period:</strong> ${data.batch.period}</div>
        <div><strong>Status:</strong> <span class="status-badge ${data.batch.status}">${data.batch.status.toUpperCase()}</span></div>
        <div><strong>Documents:</strong> ${data.documents.length}</div>
        <div><strong>Valid:</strong> ${validation.valid ? '✓ Yes' : '✗ No'}</div>
      </div>
      ${validation.errors.length > 0 ? `
        <h5>Errors:</h5>
        <ul>
          ${validation.errors.map(e => `<li class="error">${e}</li>`).join('')}
        </ul>
      ` : ''}
      ${validation.warnings.length > 0 ? `
        <h5>Warnings:</h5>
        <ul>
          ${validation.warnings.map(w => `<li class="warning">${w}</li>`).join('')}
        </ul>
      ` : ''}
    `
  } catch (err) {
    console.error('Error viewing batch:', err)
  }
}

// Enhanced payroll preview with detailed breakdown

window.showEmployeeBreakdown = async function(employeeId, month) {
  try {
    const res = await fetch(`/api/payroll/preview/${month}`)
    const data = await res.json()
    const employee = data.employees.find(e => e.employeeId === employeeId)
    if (!employee) return
    
    const modal = document.getElementById('payrollDetailModal')
    const modalTitle = document.getElementById('payrollDetailModalTitle')
    const modalContent = document.getElementById('payrollDetailModalContent')
    if (!modal || !modalContent) return
    
    if (modalTitle) {
      modalTitle.textContent = `${employee.name} - ${month}`
    }
    
    modalContent.innerHTML = `
      <div class="grid two" style="margin:16px 0;">
        <div>
          <h5>Earnings</h5>
          <table style="font-size:13px;">
            <tr><td>Gross Salary:</td><td><strong>${euro(employee.amounts.gross)}</strong></td></tr>
            <tr><td>Holiday Allowance:</td><td>${euro(employee.amounts.allowances.holidayAccrual)}</td></tr>
            <tr><td>30% Ruling Reduction:</td><td>${euro(employee.amounts.allowances.ruling30)}</td></tr>
            <tr><td>Taxable Wage:</td><td><strong>${euro(employee.amounts.taxable)}</strong></td></tr>
          </table>
        </div>
        <div>
          <h5>Deductions</h5>
          <table style="font-size:13px;">
            <tr><td>Wage Tax:</td><td>${euro(employee.amounts.deductions.wageTax)}</td></tr>
            <tr><td>Wage Tax Credit:</td><td>-${euro(employee.amounts.deductions.wageTaxCredit)}</td></tr>
            <tr><td>Social Security:</td><td>${euro(employee.amounts.deductions.socialSecurity)}</td></tr>
            <tr><td>Pension (Employee):</td><td>${euro(employee.amounts.deductions.pensionEmployee)}</td></tr>
            <tr><td>Health Insurance:</td><td>${euro(employee.amounts.deductions.healthInsuranceEmployee)}</td></tr>
            <tr><td><strong>Net Pay:</strong></td><td><strong style="color:var(--success);font-size:16px;">${euro(employee.amounts.net)}</strong></td></tr>
          </table>
        </div>
        <div>
          <h5>Social Security Breakdown</h5>
          <table style="font-size:13px;">
            <tr><td>AOW:</td><td>${euro(employee.amounts.deductions.socialSecurityBreakdown?.aow || 0)}</td></tr>
            <tr><td>ANW:</td><td>${euro(employee.amounts.deductions.socialSecurityBreakdown?.anw || 0)}</td></tr>
            <tr><td>WLZ:</td><td>${euro(employee.amounts.deductions.socialSecurityBreakdown?.wlz || 0)}</td></tr>
            <tr><td>WW:</td><td>${euro(employee.amounts.deductions.socialSecurityBreakdown?.ww || 0)}</td></tr>
            <tr><td>WIA:</td><td>${euro(employee.amounts.deductions.socialSecurityBreakdown?.wia || 0)}</td></tr>
          </table>
        </div>
        <div>
          <h5>Employer Costs</h5>
          <table style="font-size:13px;">
            <tr><td>Pension (Employer):</td><td>${euro(employee.amounts.employerCosts?.pensionEmployer || 0)}</td></tr>
            <tr><td>Health Insurance (Employer):</td><td>${euro(employee.amounts.employerCosts?.healthInsuranceEmployer || 0)}</td></tr>
            <tr><td>ZVW (Employer):</td><td>${euro(employee.amounts.employerCosts?.zvwEmployer || 0)}</td></tr>
            <tr><td><strong>Total Employer Costs:</strong></td><td><strong>${euro(employee.amounts.employerCosts?.totalEmployerCosts || 0)}</strong></td></tr>
          </table>
        </div>
      </div>
      ${employee.compliance ? `
        <div style="margin-top:16px;padding:12px;background:${employee.compliance.minimumWage.compliant ? 'rgba(0,255,0,0.1)' : 'rgba(255,0,0,0.1)'};border-radius:6px;">
          <strong>Minimum Wage Compliance:</strong> ${employee.compliance.minimumWage.compliant ? '✓ Compliant' : '✗ Non-compliant'}
          ${!employee.compliance.minimumWage.compliant ? `<br>Shortfall: ${euro(employee.compliance.minimumWage.shortfall)}` : ''}
        </div>
      ` : ''}
    `
    
    modal.hidden = false
    document.body.style.overflow = 'hidden'
  } catch (err) {
    console.error('Error loading breakdown:', err)
    if (modalContent) {
      modalContent.innerHTML = '<p class="error">Error loading payroll detail</p>'
    }
  }
}

// Close payroll detail modal handlers
document.getElementById('closePayrollDetailModal')?.addEventListener('click', closePayrollDetailModal)
document.getElementById('payrollDetailModalOverlay')?.addEventListener('click', closePayrollDetailModal)

function closePayrollDetailModal() {
  const modal = document.getElementById('payrollDetailModal')
  if (modal) {
    modal.hidden = true
    document.body.style.overflow = ''
  }
}

// Close on Escape key for payroll detail modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('payrollDetailModal')
    if (modal && !modal.hidden) {
      closePayrollDetailModal()
    }
  }
})

// Load Loonaangifte batches on page load
loadLoonaangifteBatches()