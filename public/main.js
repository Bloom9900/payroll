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
  const month = new Date().toISOString().slice(0, 7)
  const res = await fetch(`/api/payroll/preview/${month}`)
  const data = await res.json()
  const totalNet = data.employees.reduce((a, b) => a + b.net, 0)
  document.getElementById('snapshot').textContent = `Employees: ${data.employees.length} • Period: ${data.period} • Projected net: ${euro(totalNet)}`
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

async function previewRuns () {
  const monthEl = document.getElementById('month')
  const month = monthEl.value || new Date().toISOString().slice(0, 7)
  const status = document.getElementById('status')
  status.textContent = 'Loading...'
  const res = await fetch(`/api/payroll/preview/${month}`)
  const data = await res.json()
  const tbody = document.querySelector('#employeesTable tbody')
  tbody.innerHTML = ''
  data.employees.forEach(r => {
    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td>${r.employeeId}</td>
      <td>${r.name}</td>
      <td>${r.email}</td>
      <td>${euro(r.gross)}</td>
      <td>${euro(r.holiday)}</td>
      <td>${euro(r.ruling30)}</td>
      <td>${euro(r.taxable)}</td>
      <td>${euro(r.net)}</td>
    `
    tbody.appendChild(tr)
  })
  document.getElementById('btnSepa').disabled = false
  status.textContent = `Showing ${data.period}`
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
  renderCommandCenter()
}
loadEmployees()

function renderEmployeesTable (list) {
  const tbody = document.querySelector('#empTable tbody')
  tbody.innerHTML = ''
  list.forEach(e => {
    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td>${e.id}</td>
      <td><a href="#" data-emp="${e.id}">${e.firstName} ${e.lastName}</a></td>
      <td>${e.email}</td>
      <td>${e.startDate}</td>
      <td>${euro(e.annualSalaryCents / 100)}</td>
      <td>${e.hoursPerWeek}</td>
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
  search.oninput = () => {
    const q = search.value.toLowerCase()
    Array.from(tbody.children).forEach(tr => {
      tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none'
    })
  }
}

async function showEmployee (id) {
  const e = await fetch('/api/employees/' + id).then(r => r.json())
  const div = document.getElementById('empFields')
  const annual = e.annualSalaryCents / 100
  const hourly = annual / (e.hoursPerWeek * 52)
  div.innerHTML = `
    <div class="grid two">
      <div><strong>Employee ID</strong><br>${e.id}</div>
      <div><strong>Name</strong><br>${e.firstName} ${e.lastName}</div>
      <div><strong>Email</strong><br>${e.email}</div>
      <div><strong>Start date</strong><br>${e.startDate}</div>
      <div><strong>Annual salary</strong><br>${euro(annual)}</div>
      <div><strong>Hours per week</strong><br>${e.hoursPerWeek}</div>
      <div><strong>Hourly rate</strong><br>${euro(hourly)}</div>
      <div><strong>Holiday days per year</strong><br>${e.holidayDaysPerYear}</div>
      <div><strong>Used holiday days YTD</strong><br>${e.usedHolidayDaysYtd}</div>
      <div><strong>30 percent ruling</strong><br>${e.isThirtyPercentRuling ? 'Yes' : 'No'}</div>
    </div>
  `
  document.getElementById('empDetail').hidden = false
  document.getElementById('empMonth').value = new Date().toISOString().slice(0, 7)
  document.getElementById('empPreviewBtn').onclick = async () => {
    const m = document.getElementById('empMonth').value || new Date().toISOString().slice(0, 7)
    const run = await fetch('/api/payroll/preview/' + m).then(r => r.json())
    const row = run.employees.find(x => x.employeeId === e.id)
    const tbody = document.querySelector('#empPreviewTable tbody')
    if (!row) {
      tbody.innerHTML = '<tr><td colspan="5">No preview available for selected month.</td></tr>'
      return
    }
    tbody.innerHTML = `
      <tr>
        <td>${euro(row.gross)}</td>
        <td>${euro(row.holiday)}</td>
        <td>${euro(row.ruling30)}</td>
        <td>${euro(row.taxable)}</td>
        <td>${euro(row.net)}</td>
      </tr>
    `
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

document.getElementById('offCalculate')?.addEventListener('click', async () => {
  const employeeId = document.getElementById('offEmployee').value
  const exitDate = document.getElementById('offExitDate').value
  const reason = document.getElementById('offReason').value
  const summaryDiv = document.getElementById('offSummary')
  summaryDiv.innerHTML = '<p class="muted">Calculating offboarding package...</p>'
  const params = new URLSearchParams({ employeeId, exitDate, reason })
  try {
    const res = await fetch('/api/offboarding/summary?' + params.toString())
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Unable to calculate offboarding summary')
    }
    const data = await res.json()
    summaryDiv.innerHTML = `
      <h3>${data.name}</h3>
      <div class="grid two">
        <div><strong>Exit date</strong><br>${data.exitDate}</div>
        <div><strong>Reason</strong><br>${data.reason.replace(/-/g, ' ')}</div>
        <div><strong>Tenure</strong><br>${data.tenureMonths} months (${data.tenureYears} years)</div>
        <div><strong>Base monthly salary</strong><br>${euro(data.baseMonthlySalary)}</div>
        <div><strong>Notice pay</strong><br>${euro(data.noticePay)}</div>
        <div><strong>Transition allowance</strong><br>${euro(data.transitionAllowance)}</div>
        <div><strong>Unused vacation payout</strong><br>${euro(data.unusedVacationPayout)}</div>
        <div><strong>Holiday allowance top-up</strong><br>${euro(data.holidayAllowanceTopUp)}</div>
        <div><strong>Total gross payout</strong><br>${euro(data.totalGrossPayout)}</div>
      </div>
      <h4>Operational notes</h4>
      <ul>${data.annotations.map(a => `<li>${a}</li>`).join('')}</ul>
    `
  } catch (err) {
    summaryDiv.innerHTML = `<p class="muted">${err instanceof Error ? err.message : 'Unable to calculate offboarding summary'}</p>`
  }
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
