# UI Features Guide - Where to Find Everything

This document explains where to find all the new payroll system features in the web interface.

## 🎯 Main Navigation Tabs

### 1. **Payroll Runs Tab** (`/runs`)
**Location:** Click "Payroll Runs" in the top navigation

**What You'll See:**
- **Payroll Preview Table** - Enhanced with detailed gross-to-net breakdown:
  - Employee ID, Name
  - Gross Salary
  - Taxable Wage
  - Wage Tax
  - Wage Tax Credit (heffingskorting)
  - Social Security
  - Pension (Employee)
  - Net Pay
  - **"Details" button** - Click to see full breakdown

- **Employee Breakdown Card** - Appears when you click "Details":
  - **Earnings Section:** Gross Salary, Holiday Allowance, 30% Ruling Reduction, Taxable Wage
  - **Deductions Section:** Wage Tax, Wage Tax Credit, Social Security, Pension, Health Insurance, Net Pay
  - **Social Security Breakdown:** AOW, ANW, WLZ, WW, WIA (individual components)
  - **Employer Costs:** Pension (Employer), Health Insurance (Employer), ZVW (Employer), Total
  - **Minimum Wage Compliance:** Shows if compliant or non-compliant with shortfall amount

**How to Use:**
1. Select a month using the month picker
2. Click "Preview" button
3. View the detailed table
4. Click "Details" on any employee row to see full breakdown

---

### 2. **Settings Tab** (`/settings`)
**Location:** Click "Settings" in the top navigation

**What You'll See:**

#### **Rates Management Section**
- **Tax Tables:**
  - "View Tax Tables" - Shows all tax tables with periods, brackets, and rates
  - "Add Tax Table" - Add new tax table (button ready for form)

- **Social Security Rates:**
  - "View Rates" - Shows all social security rate configurations
  - "Add Rates" - Add new social security rates

- **Minimum Wage:**
  - "View Minimum Wages" - Shows all minimum wage configurations
  - "Add Minimum Wage" - Add new minimum wage rates

- **Pension Schemes:**
  - "View Schemes" - Shows all pension scheme configurations
  - "Add Scheme" - Add new pension scheme

#### **Period Coverage Check**
- Enter start and end dates
- Click "Check Coverage" to verify all required rates are available
- Shows:
  - ✓ Complete or ✗ Incomplete status
  - Missing rates list
  - Warnings about overlapping periods

#### **Import Rates**
- Upload JSON file with rates
- Import tax tables, social security, minimum wages, and pension schemes

**How to Use:**
1. Go to Settings tab
2. Use "View" buttons to see existing rates
3. Use "Check Coverage" to validate period coverage
4. Import rates from JSON files

---

### 3. **Compliance Tab** (`/compliance`)
**Location:** Click "Compliance" in the top navigation

**What You'll See:**

#### **Loonaangifte (Offline) Section**
- **Create Batch:**
  - Select month using month picker
  - Click "Create Batch" to create a new Loonaangifte batch
  - Shows batch ID, period, and status

- **Loonaangifte Batches Table:**
  - Lists all batches with:
    - Period
    - Status (draft, validated, error, ready)
    - Created date
    - "View" button to see details

- **Batch Details:**
  - When viewing a batch, shows:
    - Period and status
    - Number of documents
    - Validation status (✓ Valid or ✗ Invalid)
    - Errors list (if any)
    - Warnings list (if any)

**How to Use:**
1. Go to Compliance tab
2. Scroll to "Loonaangifte (Offline)" section
3. Select month and click "Create Batch"
4. Click "View" on any batch to see validation report

---

## 🔍 Detailed Feature Locations

### **Gross-to-Net Calculation Engine**
**Where:** Payroll Runs tab → Payroll Preview table
- All calculations are visible in the table columns
- Full breakdown available via "Details" button
- Shows: taxable wage, wage tax, social security breakdown, pension, health insurance, ZVW, net pay

### **30% Ruling Logic**
**Where:** 
- Payroll Runs tab → Employee Breakdown → Earnings section
- Shows "30% Ruling Reduction" amount
- Automatically reduces taxable base when applicable

### **Social Security Breakdown (AOW, ANW, WLZ, WW, WIA)**
**Where:** Payroll Runs tab → Employee Breakdown → Social Security Breakdown section
- Shows individual components:
  - AOW (Old Age Pension)
  - ANW (Survivor's Benefits)
  - WLZ (Long-term Care)
  - WW (Unemployment)
  - WIA (Disability)

### **Pension Contributions**
**Where:** 
- Payroll Runs tab → Payroll Preview table (Pension column)
- Employee Breakdown → Deductions section (Pension Employee)
- Employee Breakdown → Employer Costs section (Pension Employer)

### **Health Insurance (ZVW)**
**Where:** 
- Employee Breakdown → Deductions section (Health Insurance Employee)
- Employee Breakdown → Employer Costs section (Health Insurance Employer, ZVW Employer)

### **Wage Tax Credits (Heffingskorting)**
**Where:** 
- Payroll Runs tab → Payroll Preview table (Tax Credit column)
- Employee Breakdown → Deductions section (Wage Tax Credit)

### **Minimum Wage Compliance**
**Where:** Employee Breakdown → Bottom section
- Shows compliance status (✓ Compliant or ✗ Non-compliant)
- Displays shortfall amount if non-compliant
- Color-coded background (green for compliant, red for non-compliant)

### **Holiday Allowance (8%)**
**Where:** 
- Payroll Runs tab → Payroll Preview (included in Gross)
- Employee Breakdown → Earnings section (Holiday Allowance)

### **Versioned Rates & Rules**
**Where:** Settings tab → Rates Management section
- View all tax tables, social security rates, minimum wages, pension schemes
- Check period coverage for any date range
- Import rates from JSON files

### **Loonaangifte Generator**
**Where:** Compliance tab → Loonaangifte (Offline) section
- Create batches for any month
- View validation reports
- See errors and warnings
- Fully offline - no Digipoort submission

---

## 📊 API Endpoints (For Direct Access)

All features are also available via API:

- **Payroll Preview:** `GET /api/payroll/preview/:month`
- **Tax Configuration:** `GET /api/tax-configuration/:period`
- **Rates Management:** 
  - `GET /api/rates/tax-tables`
  - `GET /api/rates/social-security`
  - `GET /api/rates/minimum-wage`
  - `GET /api/rates/pension-schemes`
  - `GET /api/rates/coverage/:start/:end`
- **Loonaangifte:**
  - `GET /api/loonaangifte/batches`
  - `POST /api/loonaangifte/batches`
  - `GET /api/loonaangifte/batches/:id`

---

## 🎨 Visual Indicators

- **✓ Green checkmark:** Compliant, valid, complete
- **✗ Red X:** Non-compliant, invalid, incomplete
- **Status badges:** Color-coded status indicators (draft, calculated, reviewed, approved, locked)
- **Success/Warning/Error backgrounds:** Color-coded sections for quick status identification

---

## 💡 Quick Start Guide

1. **View Payroll Calculations:**
   - Go to "Payroll Runs" tab
   - Select a month
   - Click "Preview"
   - Click "Details" on any employee for full breakdown

2. **Manage Rates:**
   - Go to "Settings" tab
   - Scroll to "Rates Management"
   - Click "View" buttons to see existing rates
   - Use "Check Coverage" to validate periods

3. **Generate Loonaangifte:**
   - Go to "Compliance" tab
   - Scroll to "Loonaangifte (Offline)"
   - Select month and click "Create Batch"
   - View validation report

---

## 🔄 Workflow States

Payroll runs now support enhanced workflow:
- **Draft** → **Calculated** → **Reviewed** → **Approved** → **Locked**

(Note: Full workflow UI integration is in progress - currently using existing payroll runs interface)

---

All features are now visible and accessible through the web interface!

