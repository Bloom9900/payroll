# Implementation Guide - Quick Start

## Getting Started

This guide provides step-by-step instructions for implementing the recommended improvements to the NL Payroll system.

---

## Phase 1: Core Automation (Weeks 1-8)

### Week 1-2: Database Integration

#### Step 1: Set up Database
```bash
# Install PostgreSQL or use SQLite for development
npm install pg sqlite3
npm install --save-dev @types/pg

# Install database ORM (Prisma recommended)
npm install prisma @prisma/client
npx prisma init
```

#### Step 2: Create Database Schema
```prisma
// prisma/schema.prisma
model Employee {
  id              String   @id @default(uuid())
  employeeId      String   @unique
  firstName       String
  lastName        String
  email           String
  startDate       DateTime
  endDate         DateTime?
  // ... other fields
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model PayrollRun {
  id              String   @id @default(uuid())
  month           String
  status          String
  calculatedAt    DateTime @default(now())
  approvedAt      DateTime?
  // ... other fields
}
```

#### Step 3: Migrate Existing Data
```typescript
// src/scripts/migrateData.ts
import { PrismaClient } from '@prisma/client';
import { employees } from '../data/dummy';

const prisma = new PrismaClient();

async function migrate() {
  for (const employee of employees) {
    await prisma.employee.create({
      data: {
        employeeId: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        // ... map all fields
      },
    });
  }
}
```

---

### Week 3-4: Scheduled Payroll Runs

#### Step 1: Install Scheduler
```bash
npm install node-cron
npm install --save-dev @types/node-cron
```

#### Step 2: Create Scheduler Service
```typescript
// src/services/scheduler.ts
import cron from 'node-cron';
import { calculateMonthlyPayroll } from './netherlandsPayroll';
import { listEmployees } from './employeeRegistry';
import { createPayrollRun } from './payrollRun';

export function startScheduler() {
  // Run payroll on 25th of each month
  cron.schedule('0 9 25 * *', async () => {
    console.log('Running scheduled payroll...');
    const month = new Date().toISOString().slice(0, 7);
    await runMonthlyPayroll(month);
  });
}

async function runMonthlyPayroll(month: string) {
  const employees = listEmployees();
  const calculations = employees.map(emp => 
    calculateMonthlyPayroll({ employee: emp, month })
  );
  
  const payrollRun = await createPayrollRun({
    month,
    status: 'pending',
    calculations,
  });
  
  console.log(`Payroll run created: ${payrollRun.id}`);
}
```

#### Step 3: Add Payroll Run API
```typescript
// src/routes/payrollRuns.ts
import { Router } from 'express';
import { getPayrollRuns, approvePayrollRun } from '../services/payrollRun';

export const payrollRunsRouter = Router();

payrollRunsRouter.get('/', async (req, res) => {
  const runs = await getPayrollRuns();
  res.json(runs);
});

payrollRunsRouter.post('/:id/approve', async (req, res) => {
  const run = await approvePayrollRun(req.params.id);
  res.json(run);
});
```

#### Step 4: Add UI Components
```html
<!-- public/payrollRuns.html -->
<div class="payroll-runs">
  <h2>Payroll Runs</h2>
  <table>
    <thead>
      <tr>
        <th>Month</th>
        <th>Status</th>
        <th>Created</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody id="payrollRunsTable">
      <!-- Populated by JavaScript -->
    </tbody>
  </table>
</div>
```

---

### Week 5-6: Enhanced Employee Management

#### Step 1: Enhance Employee Service
```typescript
// src/services/employeeRegistry.ts
export async function updateEmployee(
  id: string,
  updates: Partial<Employee>
): Promise<Employee> {
  // Validate updates
  validateEmployeeUpdates(updates);
  
  // Update in database
  const employee = await prisma.employee.update({
    where: { id },
    data: updates,
  });
  
  // Log change
  await logEmployeeChange(id, updates);
  
  return employee;
}
```

#### Step 2: Add Employee History Tracking
```typescript
// src/services/employeeHistory.ts
export async function logEmployeeChange(
  employeeId: string,
  changes: Partial<Employee>
): Promise<void> {
  await prisma.employeeHistory.create({
    data: {
      employeeId,
      changes: JSON.stringify(changes),
      changedAt: new Date(),
    },
  });
}
```

#### Step 3: Add UI Components
```html
<!-- public/employees.html -->
<div class="employee-management">
  <h2>Employee Management</h2>
  <button onclick="showEmployeeForm()">Add Employee</button>
  <table id="employeesTable">
    <!-- Employee list -->
  </table>
</div>
```

---

### Week 7-8: Audit Trail & Logging

#### Step 1: Create Audit Service
```typescript
// src/services/audit.ts
export async function logAuditEvent(
  event: string,
  data: any
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      event,
      data: JSON.stringify(data),
      timestamp: new Date(),
    },
  });
}
```

#### Step 2: Add Audit Middleware
```typescript
// src/middleware/audit.ts
export function auditMiddleware(req: Request, res: Response, next: NextFunction) {
  // Log request
  logAuditEvent('api_request', {
    method: req.method,
    path: req.path,
    userId: req.user?.id,
  });
  
  next();
}
```

---

## Phase 2: Dutch Law Compliance (Weeks 9-16)

### Week 9-10: Enhanced Transition Allowance

#### Step 1: Enhance Offboarding Service
```typescript
// src/services/offboarding.ts
export function calculateTransitionAllowance(
  baseMonthlySalary: number,
  tenureMonths: number,
  reason: OffboardingReason
): number {
  // Enhanced calculation with all edge cases
  if (reason === 'resignation') return 0;
  if (tenureMonths < 1) return 0;
  
  const monthlyPortion = baseMonthlySalary / 3;
  let allowance = monthlyPortion * (tenureMonths / 12);
  
  // Apply maximum cap (€89,000 in 2024)
  const maxCap = 8900000; // in cents
  allowance = Math.min(allowance, maxCap);
  
  return round2(allowance);
}
```

#### Step 2: Add UI Components
```html
<!-- public/offboarding.html -->
<div class="offboarding-calculator">
  <h2>Offboarding Calculator</h2>
  <form id="offboardingForm">
    <!-- Form fields -->
  </form>
  <div id="offboardingResult">
    <!-- Calculation results -->
  </div>
</div>
```

---

### Week 11-12: Pension Contributions (Mock)

#### Step 1: Create Pension Service
```typescript
// src/services/pension.ts
export function calculatePensionContribution(
  grossSalary: number,
  employeeRate: number = 0.04,
  employerRate: number = 0.04
): PensionContribution {
  const employeeContribution = grossSalary * employeeRate;
  const employerContribution = grossSalary * employerRate;
  
  return {
    employeeContribution,
    employerContribution,
    totalContribution: employeeContribution + employerContribution,
  };
}
```

#### Step 2: Create Mock Pension Provider
```typescript
// src/services/mockPensionProvider.ts
export class MockPensionProvider {
  async submitContributions(
    contributions: PensionContribution[]
  ): Promise<SubmissionRecord> {
    // Store in database
    const submission = await prisma.pensionSubmission.create({
      data: {
        contributions: JSON.stringify(contributions),
        status: 'submitted',
        submittedAt: new Date(),
      },
    });
    
    return submission;
  }
}
```

---

### Week 13-14: Year-End Statements (Jaaropgave)

#### Step 1: Install PDF Library
```bash
npm install pdfkit
npm install --save-dev @types/pdfkit
```

#### Step 2: Create Jaaropgave Service
```typescript
// src/services/jaaropgave.ts
import PDFDocument from 'pdfkit';

export async function generateJaaropgave(
  employeeId: string,
  year: number
): Promise<Buffer> {
  const employee = await getEmployeeById(employeeId);
  const payrollData = await getPayrollDataForYear(employeeId, year);
  
  const doc = new PDFDocument();
  // Generate PDF content
  doc.text(`Jaaropgave ${year}`);
  doc.text(`Employee: ${employee.firstName} ${employee.lastName}`);
  // ... add all payroll data
  
  return doc;
}
```

#### Step 3: Add UI Components
```html
<!-- public/jaaropgave.html -->
<div class="jaaropgave">
  <h2>Year-End Statements</h2>
  <button onclick="generateJaaropgave()">Generate Jaaropgave</button>
  <div id="jaaropgaveList">
    <!-- Statement list -->
  </div>
</div>
```

---

### Week 15-16: Tax Filing Automation (Mock)

#### Step 1: Create Tax Filing Service
```typescript
// src/services/taxFiling.ts
export async function generateTaxFiling(
  month: string
): Promise<TaxFiling> {
  const employees = await listEmployees();
  const payrollData = await getPayrollDataForMonth(month);
  
  const filing = {
    month,
    employees: payrollData.map(emp => ({
      employeeId: emp.id,
      grossSalary: emp.gross,
      taxes: emp.taxes,
      // ... other fields
    })),
  };
  
  return filing;
}
```

#### Step 2: Create Mock Belastingdienst
```typescript
// src/services/mockBelastingdienst.ts
export class MockBelastingdienst {
  async submitTaxFiling(filing: TaxFiling): Promise<SubmissionRecord> {
    // Store in database
    const submission = await prisma.taxSubmission.create({
      data: {
        filing: JSON.stringify(filing),
        status: 'submitted',
        submittedAt: new Date(),
      },
    });
    
    return submission;
  }
}
```

---

## Phase 3: Advanced Features (Weeks 17-24)

### Week 17-18: Vacation Tracking

#### Step 1: Create Vacation Service
```typescript
// src/services/vacation.ts
export function calculateAccruedVacationDays(
  employee: Employee,
  date: Date
): number {
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const daysElapsed = (date.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24);
  const yearLength = isLeapYear(date.getFullYear()) ? 366 : 365;
  
  const accruedDays = employee.holidayDaysPerYear * (daysElapsed / yearLength);
  return accruedDays + (employee.carriedOverHolidayDays || 0);
}
```

#### Step 2: Add Vacation API
```typescript
// src/routes/vacation.ts
export const vacationRouter = Router();

vacationRouter.post('/request', async (req, res) => {
  const request = await createVacationRequest(req.body);
  res.json(request);
});

vacationRouter.get('/balance/:employeeId', async (req, res) => {
  const balance = await getVacationBalance(req.params.employeeId);
  res.json(balance);
});
```

---

### Week 19-20: Expense Claim Processing

#### Step 1: Create Expense Service
```typescript
// src/services/expenses.ts
export async function createExpenseClaim(
  employeeId: string,
  expense: ExpenseClaim
): Promise<ExpenseClaim> {
  // Validate expense
  validateExpenseClaim(expense);
  
  // Calculate tax implications
  const taxImplications = calculateTaxImplications(expense);
  
  // Store in database
  const claim = await prisma.expenseClaim.create({
    data: {
      employeeId,
      amount: expense.amount,
      category: expense.category,
      taxImplications,
      status: 'pending',
    },
  });
  
  return claim;
}
```

---

### Week 21-22: Sick Leave Calculations

#### Step 1: Create Sick Leave Service
```typescript
// src/services/sickLeave.ts
export function calculateSickPay(
  employee: Employee,
  sickDays: number
): number {
  if (sickDays === 0) return 0;
  if (sickDays === 1) return 0; // No pay for first day
  if (sickDays === 2) return employee.grossSalary * 0.7; // 70% for day 2
  return employee.grossSalary; // 100% from day 3
}
```

---

### Week 23-24: Working Hours Tracking

#### Step 1: Create Working Hours Service
```typescript
// src/services/workingHours.ts
export async function trackWorkingHours(
  employeeId: string,
  hours: number,
  date: Date
): Promise<void> {
  await prisma.workingHours.create({
    data: {
      employeeId,
      hours,
      date,
    },
  });
  
  // Validate against contract
  await validateWorkingHours(employeeId, date);
}
```

---

## Phase 4: UX & Integration (Weeks 25-32)

### Week 25-26: Approval Workflows

#### Step 1: Create Approval Service
```typescript
// src/services/approvals.ts
export async function createApprovalRequest(
  type: string,
  data: any
): Promise<ApprovalRequest> {
  const request = await prisma.approvalRequest.create({
    data: {
      type,
      data: JSON.stringify(data),
      status: 'pending',
    },
  });
  
  return request;
}
```

---

### Week 27-28: Notification System (Mock)

#### Step 1: Create Mock Email Service
```typescript
// src/services/mockEmail.ts
export class MockEmail {
  async sendEmail(
    to: string,
    subject: string,
    body: string
  ): Promise<EmailRecord> {
    // Store in database
    const email = await prisma.email.create({
      data: {
        to,
        subject,
        body,
        status: 'sent',
        sentAt: new Date(),
      },
    });
    
    return email;
  }
}
```

---

### Week 29-30: Self-Service Portal

#### Step 1: Create Employee Portal API
```typescript
// src/routes/employeePortal.ts
export const employeePortalRouter = Router();

employeePortalRouter.get('/payslips/:employeeId', async (req, res) => {
  const payslips = await getPayslips(req.params.employeeId);
  res.json(payslips);
});

employeePortalRouter.get('/vacation-balance/:employeeId', async (req, res) => {
  const balance = await getVacationBalance(req.params.employeeId);
  res.json(balance);
});
```

---

### Week 31-32: Enhanced Dashboard

#### Step 1: Create Analytics Service
```typescript
// src/services/analytics.ts
export async function getPayrollMetrics(month: string): Promise<PayrollMetrics> {
  const payrollData = await getPayrollDataForMonth(month);
  
  return {
    totalEmployees: payrollData.length,
    totalGross: payrollData.reduce((sum, emp) => sum + emp.gross, 0),
    totalNet: payrollData.reduce((sum, emp) => sum + emp.net, 0),
    totalTaxes: payrollData.reduce((sum, emp) => sum + emp.taxes, 0),
  };
}
```

---

## Testing

### Unit Tests
```typescript
// src/services/__tests__/payroll.test.ts
describe('calculateMonthlyPayroll', () => {
  it('should calculate payroll correctly', () => {
    const employee = createTestEmployee();
    const result = calculateMonthlyPayroll({
      employee,
      month: '2025-01',
    });
    
    expect(result.amounts.netCents).toBeGreaterThan(0);
  });
});
```

### Integration Tests
```typescript
// src/routes/__tests__/payroll.test.ts
describe('POST /api/payroll/preview', () => {
  it('should return payroll preview', async () => {
    const response = await request(app)
      .post('/api/payroll/preview/2025-01')
      .expect(200);
    
    expect(response.body.employees).toHaveLength(10);
  });
});
```

---

## Deployment

### Environment Variables
```bash
# .env
DATABASE_URL="postgresql://user:password@localhost:5432/payroll"
PORT=3000
USE_MOCK_SERVICES=true
```

### Docker Setup
```dockerfile
# Dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

---

## Conclusion

This implementation guide provides a step-by-step approach to implementing all recommended improvements. Follow the phases in order, and adjust the timeline based on your resources and priorities.

---

*Last Updated: 2025-01-XX*
*Version: 1.0*

