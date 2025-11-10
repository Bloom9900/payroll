// Tabs
document.querySelectorAll('nav.tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('nav.tabs button').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    document.querySelectorAll('.tab').forEach(s => s.classList.remove('active'))
    document.getElementById(btn.dataset.tab).classList.add('active')
  })
})

const euro = n => new Intl.NumberFormat('nl-NL',{ style:'currency', currency:'EUR'}).format(n)

// Dashboard snapshot
async function loadSnapshot(){
  const month = new Date().toISOString().slice(0,7)
  const res = await fetch(`/api/payroll/preview/${month}`)
  const data = await res.json()
  const totalNet = data.employees.reduce((a,b)=>a+b.net,0)
  document.getElementById('snapshot').textContent = `Employees: ${data.employees.length} • Period: ${data.period} • Projected net: ${euro(totalNet)}`
}
loadSnapshot()

// Runs tab
document.getElementById('btnPreview').addEventListener('click', previewRuns)
document.getElementById('btnSepa').addEventListener('click', sepaDownload)
document.getElementById('qaPreview').addEventListener('click', ()=>{
  document.querySelector('button[data-tab="runs"]').click()
  previewRuns()
})
document.getElementById('qaSepa').addEventListener('click', ()=>{
  document.querySelector('button[data-tab="runs"]').click()
  sepaDownload()
})

async function previewRuns(){
  const monthEl = document.getElementById('month')
  const month = monthEl.value || new Date().toISOString().slice(0,7)
  const status = document.getElementById('status')
  status.textContent = 'Loading...'
  const res = await fetch(`/api/payroll/preview/${month}`)
  const data = await res.json()
  const tbody = document.querySelector('#employeesTable tbody')
  tbody.innerHTML=''
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

// SEPA download
async function sepaDownload(){
  const monthEl = document.getElementById('month')
  const month = monthEl.value || new Date().toISOString().slice(0,7)
  const res = await fetch(`/api/payroll/sepa/${month}`, { method:'POST' })
  const xml = await res.text()
  const blob = new Blob([xml], { type:'application/xml;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `sepa-${month}.xml`
  a.click()
  URL.revokeObjectURL(a.href)
}

// Employees list + detail
async function loadEmployees(){
  const res = await fetch('/api/employees')
  const list = await res.json()
  const tbody = document.querySelector('#empTable tbody')
  tbody.innerHTML=''
  list.forEach(e => {
    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td>${e.id}</td>
      <td><a href="#" data-emp="${e.id}">${e.firstName} ${e.lastName}</a></td>
      <td>${e.email}</td>
      <td>${e.startDate}</td>
      <td>${euro(e.annualSalaryCents/100)}</td>
      <td>${e.hoursPerWeek}</td>
    `
    tbody.appendChild(tr)
  })
  tbody.querySelectorAll('a[data-emp]').forEach(a => {
    a.addEventListener('click', async (ev) => {
      ev.preventDefault()
      await showEmployee(a.dataset.emp)
    })
  })
  // search
  const search = document.getElementById('search')
  search.addEventListener('input', () => {
    const q = search.value.toLowerCase()
    Array.from(tbody.children).forEach(tr => {
      tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none'
    })
  })
}
loadEmployees()

async function showEmployee(id){
  const e = await fetch('/api/employees/' + id).then(r=>r.json())
  const div = document.getElementById('empFields')
  const annual = e.annualSalaryCents/100
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
  document.getElementById('empMonth').value = new Date().toISOString().slice(0,7)
  document.getElementById('empPreviewBtn').onclick = async () => {
    const m = document.getElementById('empMonth').value || new Date().toISOString().slice(0,7)
    const run = await fetch('/api/payroll/preview/' + m).then(r=>r.json())
    const row = run.employees.find(x => x.employeeId === e.id)
    const tbody = document.querySelector('#empPreviewTable tbody')
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

// Calculators
async function loadCalcDefaults(){
  const sel = document.getElementById('termEmployee')
  const list = await fetch('/api/employees').then(r=>r.json())
  sel.innerHTML = ''
  list.forEach(e => {
    const opt = document.createElement('option')
    opt.value = e.id
    opt.textContent = `${e.firstName} ${e.lastName} (${e.id})`
    sel.appendChild(opt)
  })
  document.getElementById('termDate').valueAsDate = new Date()
  document.getElementById('termDaysPerYear').value = list[0]?.holidayDaysPerYear || 25
  document.getElementById('termUsedDays').value = list[0]?.usedHolidayDaysYtd || 0
}
loadCalcDefaults()

document.getElementById('termEmployee').addEventListener('change', async () => {
  const id = document.getElementById('termEmployee').value
  const e = await fetch('/api/employees/' + id).then(r=>r.json())
  document.getElementById('termDaysPerYear').value = e.holidayDaysPerYear
  document.getElementById('termUsedDays').value = e.usedHolidayDaysYtd
})

document.getElementById('calcTermBtn').addEventListener('click', async () => {
  const id = document.getElementById('termEmployee').value
  const terminationDate = document.getElementById('termDate').value
  const daysPerYear = parseFloat(document.getElementById('termDaysPerYear').value)
  const usedDaysYtd = parseFloat(document.getElementById('termUsedDays').value)
  const params = new URLSearchParams({ employeeId: id, terminationDate: terminationDate, daysPerYear: String(daysPerYear), usedDaysYtd: String(usedDaysYtd) })
  const r = await fetch('/api/calculators/termination?' + params.toString()).then(r=>r.json())
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

// Settings
function loadSettings(){
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
