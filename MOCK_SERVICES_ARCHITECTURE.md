# Mock Services Architecture Guide

## Overview
This document outlines the architecture for mock services that replace external integrations. All mock services store data in the database and provide UI interfaces for viewing and managing the data.

---

## Mock Service Pattern

### Core Principles
1. **Database Storage:** All mock data stored in database tables
2. **UI Interface:** All mock services have UI interfaces
3. **Realistic Behavior:** Mock services simulate real system behavior
4. **Replaceable:** Easy to replace with real integrations later
5. **Testable:** Mock services are fully testable

### Implementation Pattern
```typescript
// Mock service structure
export class MockService {
  // Store data in database
  async storeData(data: any): Promise<void> {
    // Store in database
  }
  
  // Retrieve data from database
  async getData(id: string): Promise<any> {
    // Retrieve from database
  }
  
  // Simulate external API call
  async simulateExternalCall(data: any): Promise<MockResponse> {
    // Store in database
    // Generate realistic response
    // Return mock response
  }
  
  // Generate status updates
  async updateStatus(id: string, status: string): Promise<void> {
    // Update status in database
  }
}
```

---

## Mock Services to Implement

### 1. Mock HR System
**Purpose:** Simulate HR system integration for employee data sync

**Database Tables:**
- `mock_hr_sync_log` - Sync history
- `mock_hr_employee_changes` - Employee changes from HR system
- `mock_hr_sync_status` - Sync status tracking

**Features:**
- Generate dummy employee changes (salary, department, etc.)
- Store sync history
- Track sync status
- Simulate webhook events
- Generate employee change notifications

**UI Components:**
- HR Sync dashboard
- Employee change log
- Sync status display
- Manual sync trigger button
- Employee change preview

**API Endpoints:**
- `POST /api/mock-hr/sync` - Trigger manual sync
- `GET /api/mock-hr/changes` - Get employee changes
- `POST /api/mock-hr/webhook` - Simulate webhook event
- `GET /api/mock-hr/status` - Get sync status

**Implementation:**
```typescript
// src/services/mockHrSystem.ts
export class MockHrSystem {
  async syncEmployees(): Promise<EmployeeChange[]> {
    // Generate dummy employee changes
    // Store in database
    // Return changes
  }
  
  async simulateWebhook(event: string, data: any): Promise<void> {
    // Store webhook event in database
    // Process employee changes
    // Update employee data
  }
}
```

---

### 2. Mock Bank Service
**Purpose:** Simulate bank integration for payment submission

**Database Tables:**
- `mock_bank_submissions` - Payment submissions
- `mock_bank_payment_status` - Payment status tracking
- `mock_bank_transactions` - Bank transactions

**Features:**
- Store SEPA file submissions
- Track payment status (pending, submitted, processed, failed)
- Generate payment confirmations
- Simulate payment processing delays
- Generate payment failure scenarios
- Store payment reconciliation data

**UI Components:**
- Bank submission dashboard
- Payment status tracking
- Payment confirmation display
- Payment failure handling
- Payment reconciliation interface

**API Endpoints:**
- `POST /api/mock-bank/submit` - Submit payment
- `GET /api/mock-bank/status/:id` - Get payment status
- `POST /api/mock-bank/confirm` - Confirm payment
- `GET /api/mock-bank/transactions` - Get transactions

**Implementation:**
```typescript
// src/services/mockBank.ts
export class MockBank {
  async submitPayment(sepaFile: string): Promise<PaymentSubmission> {
    // Store submission in database
    // Generate submission ID
    // Return submission record
  }
  
  async getPaymentStatus(submissionId: string): Promise<PaymentStatus> {
    // Retrieve status from database
    // Simulate processing delay
    // Return status
  }
  
  async confirmPayment(submissionId: string): Promise<void> {
    // Update status to confirmed
    // Generate confirmation record
    // Store in database
  }
}
```

---

### 3. Mock Pension Provider
**Purpose:** Simulate pension provider integration

**Database Tables:**
- `mock_pension_providers` - Pension provider configuration
- `mock_pension_submissions` - Pension contribution submissions
- `mock_pension_contributions` - Pension contribution records
- `mock_pension_status` - Submission status tracking

**Features:**
- Store pension provider configuration (PGGM, ABP, etc.)
- Store pension contribution submissions
- Track submission status
- Generate pension contribution reports
- Simulate pension provider responses

**UI Components:**
- Pension provider configuration
- Pension contribution dashboard
- Pension submission status
- Pension contribution reports
- Pension provider selection

**API Endpoints:**
- `POST /api/mock-pension/submit` - Submit contributions
- `GET /api/mock-pension/status/:id` - Get submission status
- `GET /api/mock-pension/providers` - Get providers
- `GET /api/mock-pension/contributions` - Get contributions

**Implementation:**
```typescript
// src/services/mockPensionProvider.ts
export class MockPensionProvider {
  async submitContributions(contributions: PensionContribution[]): Promise<SubmissionRecord> {
    // Store contributions in database
    // Generate submission record
    // Return submission record
  }
  
  async getSubmissionStatus(submissionId: string): Promise<SubmissionStatus> {
    // Retrieve status from database
    // Return status
  }
}
```

---

### 4. Mock Health Insurance Provider
**Purpose:** Simulate health insurance provider integration

**Database Tables:**
- `mock_health_insurance_providers` - Insurance provider configuration
- `mock_health_insurance_premiums` - Insurance premium records
- `mock_health_insurance_submissions` - Premium submissions
- `mock_health_insurance_status` - Submission status tracking

**Features:**
- Store insurance provider configuration
- Store insurance premium records
- Track premium submissions
- Generate insurance reports
- Simulate insurance provider responses

**UI Components:**
- Insurance provider configuration
- Insurance premium dashboard
- Insurance submission status
- Insurance reports
- Insurance provider selection

**API Endpoints:**
- `POST /api/mock-insurance/submit` - Submit premiums
- `GET /api/mock-insurance/status/:id` - Get submission status
- `GET /api/mock-insurance/providers` - Get providers
- `GET /api/mock-insurance/premiums` - Get premiums

**Implementation:**
```typescript
// src/services/mockHealthInsurance.ts
export class MockHealthInsurance {
  async submitPremiums(premiums: InsurancePremium[]): Promise<SubmissionRecord> {
    // Store premiums in database
    // Generate submission record
    // Return submission record
  }
  
  async getSubmissionStatus(submissionId: string): Promise<SubmissionStatus> {
    // Retrieve status from database
    // Return status
  }
}
```

---

### 5. Mock Belastingdienst (Tax Authority)
**Purpose:** Simulate tax authority integration

**Database Tables:**
- `mock_tax_submissions` - Tax filing submissions
- `mock_tax_filing_status` - Filing status tracking
- `mock_tax_confirmations` - Tax filing confirmations
- `mock_tax_corrections` - Tax filing corrections

**Features:**
- Store tax filing submissions
- Track filing status
- Generate tax filing confirmations
- Handle tax filing corrections
- Simulate tax authority responses

**UI Components:**
- Tax filing dashboard
- Tax submission status
- Tax confirmation display
- Tax correction interface
- Tax filing reports

**API Endpoints:**
- `POST /api/mock-tax/submit` - Submit tax filing
- `GET /api/mock-tax/status/:id` - Get filing status
- `POST /api/mock-tax/confirm` - Confirm filing
- `POST /api/mock-tax/correct` - Submit correction

**Implementation:**
```typescript
// src/services/mockBelastingdienst.ts
export class MockBelastingdienst {
  async submitTaxFiling(filing: TaxFiling): Promise<SubmissionRecord> {
    // Store filing in database
    // Generate submission record
    // Return submission record
  }
  
  async getFilingStatus(submissionId: string): Promise<FilingStatus> {
    // Retrieve status from database
    // Return status
  }
  
  async confirmFiling(submissionId: string): Promise<ConfirmationRecord> {
    // Generate confirmation
    // Store in database
    // Return confirmation
  }
}
```

---

### 6. Mock Email Service
**Purpose:** Simulate email notification service

**Database Tables:**
- `mock_emails` - Email notifications
- `mock_email_templates` - Email templates
- `mock_email_status` - Email status tracking
- `mock_email_preferences` - Email preferences

**Features:**
- Store email notifications in database
- Generate email templates
- Track email status (sent, delivered, read)
- Store email preferences
- Display emails in UI

**UI Components:**
- Email inbox
- Email sent folder
- Email templates
- Email preferences
- Email notification center

**API Endpoints:**
- `POST /api/mock-email/send` - Send email
- `GET /api/mock-email/inbox` - Get inbox
- `GET /api/mock-email/sent` - Get sent emails
- `GET /api/mock-email/templates` - Get templates
- `POST /api/mock-email/preferences` - Update preferences

**Implementation:**
```typescript
// src/services/mockEmail.ts
export class MockEmail {
  async sendEmail(to: string, subject: string, body: string): Promise<EmailRecord> {
    // Store email in database
    // Generate email record
    // Return email record
  }
  
  async getInbox(userId: string): Promise<EmailRecord[]> {
    // Retrieve emails from database
    // Return emails
  }
  
  async getSentEmails(userId: string): Promise<EmailRecord[]> {
    // Retrieve sent emails from database
    // Return emails
  }
}
```

---

### 7. Mock Accounting System
**Purpose:** Simulate accounting system integration

**Database Tables:**
- `mock_accounting_entries` - Accounting journal entries
- `mock_accounting_accounts` - Accounting accounts
- `mock_accounting_transactions` - Accounting transactions
- `mock_accounting_reports` - Accounting reports

**Features:**
- Store accounting journal entries
- Generate accounting reports
- Track accounting transactions
- Simulate accounting system sync
- Generate accounting exports

**UI Components:**
- Accounting dashboard
- Journal entries display
- Accounting reports
- Accounting export interface
- Accounting sync status

**API Endpoints:**
- `POST /api/mock-accounting/entry` - Create journal entry
- `GET /api/mock-accounting/entries` - Get journal entries
- `GET /api/mock-accounting/reports` - Get reports
- `POST /api/mock-accounting/sync` - Sync with accounting

**Implementation:**
```typescript
// src/services/mockAccounting.ts
export class MockAccounting {
  async createJournalEntry(entry: JournalEntry): Promise<JournalEntryRecord> {
    // Store entry in database
    // Generate entry record
    // Return entry record
  }
  
  async getJournalEntries(period: string): Promise<JournalEntryRecord[]> {
    // Retrieve entries from database
    // Return entries
  }
  
  async generateReport(reportType: string, period: string): Promise<Report> {
    // Generate report from database
    // Return report
  }
}
```

---

## Database Schema

### Common Patterns
All mock services follow similar database patterns:
- `mock_{service}_submissions` - Store submissions
- `mock_{service}_status` - Track status
- `mock_{service}_confirmations` - Store confirmations
- `mock_{service}_history` - Store history

### Example Schema
```sql
-- Mock service submission table
CREATE TABLE mock_{service}_submissions (
  id UUID PRIMARY KEY,
  submission_id VARCHAR(255) UNIQUE,
  data JSONB,
  status VARCHAR(50),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Mock service status table
CREATE TABLE mock_{service}_status (
  id UUID PRIMARY KEY,
  submission_id VARCHAR(255),
  status VARCHAR(50),
  message TEXT,
  created_at TIMESTAMP
);
```

---

## UI Components

### Common UI Patterns
All mock services have similar UI components:
- Dashboard - Overview of service status
- Submission List - List of submissions
- Submission Detail - Detail view of submission
- Status Display - Current status
- Action Buttons - Trigger actions
- Reports - Generate reports

### Example UI Component
```typescript
// Mock service dashboard component
export function MockServiceDashboard() {
  const [submissions, setSubmissions] = useState([]);
  const [status, setStatus] = useState('idle');
  
  return (
    <div>
      <h2>Mock Service Dashboard</h2>
      <button onClick={handleSync}>Sync</button>
      <SubmissionList submissions={submissions} />
      <StatusDisplay status={status} />
    </div>
  );
}
```

---

## Integration Points

### Replaceable Interfaces
All mock services implement replaceable interfaces:
```typescript
// Service interface
export interface IService {
  submit(data: any): Promise<SubmissionRecord>;
  getStatus(id: string): Promise<Status>;
  confirm(id: string): Promise<ConfirmationRecord>;
}

// Mock implementation
export class MockService implements IService {
  // Mock implementation
}

// Real implementation (future)
export class RealService implements IService {
  // Real API implementation
}
```

### Service Factory
Use factory pattern to switch between mock and real services:
```typescript
export class ServiceFactory {
  static createService(type: 'mock' | 'real'): IService {
    if (type === 'mock') {
      return new MockService();
    } else {
      return new RealService();
    }
  }
}
```

---

## Testing

### Mock Service Tests
All mock services have comprehensive tests:
```typescript
describe('MockService', () => {
  it('should submit data', async () => {
    const service = new MockService();
    const result = await service.submit({ data: 'test' });
    expect(result).toBeDefined();
  });
  
  it('should get status', async () => {
    const service = new MockService();
    const status = await service.getStatus('id');
    expect(status).toBeDefined();
  });
});
```

---

## Migration Path

### From Mock to Real
When ready to integrate real services:
1. Implement real service interface
2. Update service factory
3. Update configuration
4. Test real integration
5. Deploy real service
6. Remove mock service (optional)

### Configuration
Use environment variables to switch between mock and real:
```typescript
const useMockServices = process.env.USE_MOCK_SERVICES === 'true';
const service = ServiceFactory.createService(useMockServices ? 'mock' : 'real');
```

---

## Benefits

### Development Benefits
- ✅ No external dependencies
- ✅ Fast development
- ✅ Easy testing
- ✅ Full control over data
- ✅ Realistic behavior simulation

### Business Benefits
- ✅ All features available
- ✅ Complete UI
- ✅ Ready for real integrations
- ✅ Lower development costs
- ✅ Faster time to market

---

## Conclusion

Mock services provide a complete internal implementation of all external integrations, allowing the system to be fully functional without external dependencies. When real integrations become available, mock services can be easily replaced with real implementations.

---

*Last Updated: 2025-01-XX*
*Version: 1.0*

