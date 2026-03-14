# Tally Backend API Documentation

Complete reference for all Tally integration API endpoints.

**Base URL:** `http://localhost:5000`

**Authentication:** Most endpoints require a Bearer token.
```
Authorization: Bearer <JWT_TOKEN>
```

To get a token, register and login via `/api/auth/register` and `/api/auth/login`.

---

## Table of Contents

| # | Endpoint | Description |
|---|----------|-------------|
| 1 | [GET /api/tally/test-public](#1-test-connection-public) | Test Tally connection (public) |
| 2 | [GET /api/tally/diagnostics](#2-diagnostics) | Run connection diagnostics |
| 3 | [GET /api/tally/companies](#3-companies) | List companies in Tally |
| 4 | [GET /api/tally/trial-balance](#4-trial-balance) | Enhanced Trial Balance |
| 5 | [GET /api/tally/ledgers](#5-ledgers) | List all ledgers |
| 6 | [GET /api/tally/ledger-groups](#6-ledger-groups) | List all ledger groups |
| 7 | [GET /api/tally/day-book](#7-day-book) | Day Book report |
| 8 | [GET /api/tally/stock-items](#8-stock-items) | Stock items |
| 9 | [GET /api/tally/stock-groups](#9-stock-groups) | Stock groups |
| 10 | [GET /api/tally/vouchers/:type](#10-vouchers-by-type) | Vouchers by type |
| 11 | [GET /api/tally/receivables](#11-receivables) | Accounts receivable with ageing |
| 12 | [GET /api/tally/payables](#12-payables) | Accounts payable with TDS |
| 13 | [GET /api/tally/profit-loss](#13-profit--loss) | P&L with comparisons |
| 14 | [GET /api/tally/gst-summary](#14-gst-summary) | GST with filing dates |
| 15 | [GET /api/tally/client-billing](#15-client-billing) | Client billing & realisation |
| 16 | [GET /api/tally/bank-position](#16-bank-position) | Bank & cash position |
| 17 | [GET /api/tally/invoice-register](#17-invoice-register) | Invoice register with tax |
| 18 | [GET /api/tally/balance-sheet](#18-balance-sheet) | Balance sheet with categories |
| 19 | [GET /api/tally/reports/summary](#19-reports-summary) | Available reports for role |

---

## Authentication Endpoints

### Register
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin User","email":"admin@test.com","password":"password123","role":"admin"}'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"password123"}'
```
Response contains `token` — use it as `Bearer <token>` in all protected routes.

---

## Tally Endpoints

### 1. Test Connection (Public)

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/tally/test-public` |
| **Auth** | None (public) |
| **Description** | Quick test to verify Tally server is reachable |

```bash
curl http://localhost:5000/api/tally/test-public
```

**Sample Response:**
```json
{
  "success": true,
  "message": "Successfully connected to Tally",
  "tallyHost": "http://103.171.134.4:16937"
}
```

---

### 2. Diagnostics

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/tally/diagnostics` |
| **Auth** | None (public) |
| **Description** | Run comprehensive network diagnostics (DNS, TCP, HTTP, Ping, XML request) |

```bash
curl http://localhost:5000/api/tally/diagnostics
```

---

### 3. Companies

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/tally/companies` |
| **Auth** | Bearer Token (any role) |
| **Description** | Get list of all companies loaded in Tally |

```bash
curl http://localhost:5000/api/tally/companies \
  -H "Authorization: Bearer <TOKEN>"
```

**Sample Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    { "name": "Artifae Corporate Services Providers Co." },
    { "name": "ATG Contracting L.L.C 2025" }
  ]
}
```

---

### 4. Trial Balance

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/tally/trial-balance` |
| **Auth** | Bearer Token (admin, manager) |
| **Description** | Enhanced trial balance with last entry dates and dormancy detection |

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `fromDate` | string | No | Start date (YYYYMMDD). Default: `20240401` |
| `toDate` | string | No | End date (YYYYMMDD). Default: `20250331` |
| `ledgerGroup` | string | No | Filter by parent group name |
| `status` | string | No | Filter: `active` or `dormant` |

```bash
curl "http://localhost:5000/api/tally/trial-balance?fromDate=20240401&toDate=20250331&status=active" \
  -H "Authorization: Bearer <TOKEN>"
```

**Sample Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "data": {},
    "ledgersWithDates": [
      {
        "name": "Cash",
        "parent": "Cash-in-Hand",
        "openingBalance": "50000",
        "closingBalance": "45000",
        "lastEntryDate": "20250310",
        "daysSinceLastEntry": 4,
        "isDormant": false,
        "lastEntryDateFormatted": "2025-03-10"
      }
    ],
    "derived": {
      "totalLedgers": 45,
      "activeLedgers": 32,
      "dormantLedgers": 13
    }
  }
}
```

**Derived Fields:**
- `daysSinceLastEntry` — Computed from `lastEntryDate` vs today
- `isDormant` — `true` if no activity in the current month
- `derived.activeLedgers` / `derived.dormantLedgers` — Counts

---

### 5. Ledgers

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/tally/ledgers` |
| **Auth** | Bearer Token (admin, manager) |

```bash
curl http://localhost:5000/api/tally/ledgers \
  -H "Authorization: Bearer <TOKEN>"
```

**Sample Response:**
```json
{
  "success": true,
  "count": 85,
  "data": [
    {
      "name": "Cash",
      "parent": "Cash-in-Hand",
      "openingBalance": "50000",
      "closingBalance": "45000"
    }
  ]
}
```

---

### 6. Ledger Groups

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/tally/ledger-groups` |
| **Auth** | Bearer Token (admin, manager) |

```bash
curl http://localhost:5000/api/tally/ledger-groups \
  -H "Authorization: Bearer <TOKEN>"
```

---

### 7. Day Book

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/tally/day-book` |
| **Auth** | Bearer Token (admin, manager) |

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `fromDate` | string | No | YYYYMMDD |
| `toDate` | string | No | YYYYMMDD |

```bash
curl "http://localhost:5000/api/tally/day-book?fromDate=20250301&toDate=20250314" \
  -H "Authorization: Bearer <TOKEN>"
```

---

### 8. Stock Items

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/tally/stock-items` |
| **Auth** | Bearer Token (admin, manager) |

```bash
curl http://localhost:5000/api/tally/stock-items \
  -H "Authorization: Bearer <TOKEN>"
```

---

### 9. Stock Groups

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/tally/stock-groups` |
| **Auth** | Bearer Token (admin, manager) |

```bash
curl http://localhost:5000/api/tally/stock-groups \
  -H "Authorization: Bearer <TOKEN>"
```

---

### 10. Vouchers by Type

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/tally/vouchers/:type` |
| **Auth** | Bearer Token (admin, manager) |
| **Description** | Fetch vouchers filtered by type |

**URL Parameter:**

| Param | Type | Values |
|-------|------|--------|
| `type` | string | `Sales`, `Purchase`, `Receipt`, `Payment`, `Journal`, `Contra`, `Credit Note`, `Debit Note` |

**Query Parameters:**

| Param | Type | Required |
|-------|------|----------|
| `fromDate` | string | No |
| `toDate` | string | No |

```bash
curl "http://localhost:5000/api/tally/vouchers/Sales?fromDate=20250301&toDate=20250314" \
  -H "Authorization: Bearer <TOKEN>"
```

**Sample Response:**
```json
{
  "success": true,
  "voucherType": "Sales",
  "count": 12,
  "data": [
    {
      "date": "20250305",
      "voucherType": "Sales",
      "voucherNumber": "INV-001",
      "partyLedger": "ABC Corp",
      "amount": "-118000",
      "narration": "Consulting services for March 2025"
    }
  ]
}
```

---

### 11. Receivables

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/tally/receivables` |
| **Auth** | Bearer Token (admin, manager) |
| **Description** | Accounts receivable with ageing buckets, overdue flags, and MTD collections |

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `fromDate` | string | No | YYYYMMDD |
| `toDate` | string | No | YYYYMMDD |

```bash
curl "http://localhost:5000/api/tally/receivables?fromDate=20240401&toDate=20250331" \
  -H "Authorization: Bearer <TOKEN>"
```

**Sample Response:**
```json
{
  "success": true,
  "count": 15,
  "data": {
    "bills": [
      {
        "clientName": "ABC Corp",
        "billRef": "INV-001",
        "billDate": "20250105",
        "dueDate": "20250205",
        "billAmount": "118000",
        "pendingAmount": "118000",
        "daysOverdue": 37,
        "isOverdue": true,
        "ageingBucket": "31-60",
        "dueDateFormatted": "2025-02-05"
      }
    ],
    "summary": {
      "totalOutstanding": 1250000,
      "totalOverdue": 850000,
      "totalBills": 15,
      "overdueBills": 8,
      "ageingBuckets": {
        "0-30": { "count": 5, "total": 400000 },
        "31-60": { "count": 4, "total": 350000 },
        "61-90": { "count": 3, "total": 300000 },
        "90+": { "count": 3, "total": 200000 }
      },
      "mtdCollections": 175000
    }
  }
}
```

**Derived Fields:**
- `daysOverdue` — Today minus due date (0 if not overdue)
- `isOverdue` — `true` if due date has passed
- `ageingBucket` — `0-30`, `31-60`, `61-90`, or `90+`
- `summary.mtdCollections` — Sum of Receipt vouchers in current month

---

### 12. Payables

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/tally/payables` |
| **Auth** | Bearer Token (admin, manager) |
| **Description** | Accounts payable with TDS due dates and upcoming payment flags |

**Query Parameters:**

| Param | Type | Required |
|-------|------|----------|
| `fromDate` | string | No |
| `toDate` | string | No |

```bash
curl "http://localhost:5000/api/tally/payables" \
  -H "Authorization: Bearer <TOKEN>"
```

**Sample Response:**
```json
{
  "success": true,
  "data": {
    "payables": [
      {
        "vendorName": "XYZ Supplies",
        "billRef": "PO-2025-034",
        "billDate": "20250301",
        "dueDate": "20250320",
        "billAmount": "45000",
        "pendingAmount": "45000",
        "isDueThisWeek": true,
        "dueDateFormatted": "2025-03-20"
      }
    ],
    "tdsPayable": [
      { "name": "TDS on Professional Fees", "closingBalance": "12500" }
    ],
    "advancePayments": [
      { "name": "Vendor Advance - ABC", "parent": "Loans & Advances", "closingBalance": "25000" }
    ],
    "summary": {
      "totalPayables": 22,
      "dueThisWeek": 5,
      "tdsChallanDueDate": "2025-04-07",
      "daysUntilTdsDue": 24
    }
  }
}
```

**Derived Fields:**
- `isDueThisWeek` — `true` if due date is within the next 7 days
- `summary.tdsChallanDueDate` — Hardcoded as 7th of next month
- `summary.daysUntilTdsDue` — Days from today to TDS challan due date

---

### 13. Profit & Loss

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/tally/profit-loss` |
| **Auth** | Bearer Token (admin, manager) |
| **Description** | Enhanced P&L with revenue/expense breakup, major expense heads, net profit, and month-over-month comparisons |

**Query Parameters:**

| Param | Type | Required |
|-------|------|----------|
| `fromDate` | string | No |
| `toDate` | string | No |

```bash
curl "http://localhost:5000/api/tally/profit-loss?fromDate=20250301&toDate=20250314" \
  -H "Authorization: Bearer <TOKEN>"
```

**Sample Response:**
```json
{
  "success": true,
  "data": {
    "data": {},
    "revenueLedgers": [
      { "name": "Sales Account", "parent": "Revenue", "amount": "-500000" }
    ],
    "expenseLedgers": [
      { "name": "Salary", "parent": "Expenses", "amount": "200000" }
    ],
    "majorExpenseHeads": {
      "staffCost": 200000,
      "rent": 50000,
      "travel": 15000,
      "professionalFees": 35000
    },
    "derived": {
      "totalRevenue": 500000,
      "totalExpenses": 350000,
      "netProfit": 150000,
      "netProfitMarginPercent": 30,
      "revenueVsLastMonth": {
        "currentMonthRevenue": 500000,
        "lastMonthRevenue": 450000,
        "changeAmount": 50000,
        "changePercent": 11.11,
        "lastMonthNetProfit": 130000
      },
      "revenueVsSameMonthLastYear": {
        "currentMonthRevenue": 500000,
        "sameMonthLastYearRevenue": 380000,
        "changeAmount": 120000,
        "changePercent": 31.58,
        "sameMonthLastYearNetProfit": 95000
      }
    }
  }
}
```

**Derived Fields:**
- `derived.netProfit` — Total revenue minus total expenses
- `derived.netProfitMarginPercent` — (Net profit / revenue) × 100
- `derived.revenueVsLastMonth` — Automatic comparison with previous month (fetched internally)
- `derived.revenueVsSameMonthLastYear` — Automatic comparison with same month last year (fetched internally)

---

### 14. GST Summary

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/tally/gst-summary` |
| **Auth** | Bearer Token (admin, manager) |
| **Description** | GST summary with output/input tax, TDS, RCM, net payable, and filing due date countdowns |

**Query Parameters:**

| Param | Type | Required |
|-------|------|----------|
| `fromDate` | string | No |
| `toDate` | string | No |

```bash
curl "http://localhost:5000/api/tally/gst-summary?fromDate=20250301&toDate=20250331" \
  -H "Authorization: Bearer <TOKEN>"
```

**Sample Response:**
```json
{
  "success": true,
  "data": {
    "outputGST": {
      "cgst": { "ledgers": [...], "total": 45000 },
      "sgst": { "ledgers": [...], "total": 45000 },
      "igst": { "ledgers": [...], "total": 12000 }
    },
    "inputTaxCredit": {
      "cgst": { "ledgers": [...], "total": 30000 },
      "sgst": { "ledgers": [...], "total": 30000 },
      "igst": { "ledgers": [...], "total": 8000 },
      "totalITC": 68000
    },
    "tdsDeducted": { "ledgers": [...], "total": 12500 },
    "rcmLiability": { "ledgers": [], "total": 0 },
    "derived": {
      "outputGSTTotal": 102000,
      "itcTotal": 68000,
      "netGSTPayable": 34000,
      "filingDueDates": {
        "gstr1": { "dueDate": "2025-04-11", "daysRemaining": 28 },
        "gstr3b": { "dueDate": "2025-04-20", "daysRemaining": 37 },
        "tdsChallan": { "dueDate": "2025-04-07", "daysRemaining": 24 }
      }
    }
  }
}
```

**Derived Fields:**
- `derived.netGSTPayable` — Output GST minus Input Tax Credit
- `derived.filingDueDates.gstr1` — Hardcoded 11th of next month
- `derived.filingDueDates.gstr3b` — Hardcoded 20th of next month
- `derived.filingDueDates.tdsChallan` — Hardcoded 7th of next month
- `daysRemaining` — Each due date minus today

**Note:** RCM liability is handled gracefully — returns `total: 0` and empty ledgers if no RCM ledger exists in Tally.

---

### 15. Client Billing

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/tally/client-billing` |
| **Auth** | Bearer Token (admin, manager) |
| **Description** | Sales invoices with payment status and fee realisation rate per client |

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `clientName` | string | No | Filter by specific client/party name |
| `fromDate` | string | No | YYYYMMDD |
| `toDate` | string | No | YYYYMMDD |

```bash
curl "http://localhost:5000/api/tally/client-billing?clientName=ABC%20Corp" \
  -H "Authorization: Bearer <TOKEN>"
```

**Sample Response:**
```json
{
  "success": true,
  "count": 8,
  "data": {
    "invoices": [
      {
        "voucherNumber": "INV-001",
        "date": "20250105",
        "clientName": "ABC Corp",
        "narration": "Consulting services",
        "grossAmount": "118000",
        "outstandingAmount": "0",
        "paymentStatus": "Paid",
        "amountCollected": 118000
      },
      {
        "voucherNumber": "INV-005",
        "date": "20250215",
        "clientName": "ABC Corp",
        "narration": "Advisory retainer",
        "grossAmount": "50000",
        "outstandingAmount": "25000",
        "paymentStatus": "Partial",
        "amountCollected": 25000
      }
    ],
    "clientRealisationRates": [
      {
        "clientName": "ABC Corp",
        "totalBilled": 168000,
        "totalCollected": 143000,
        "feeRealisationRatePercent": 85.12
      }
    ],
    "summary": {
      "totalInvoices": 8,
      "paidCount": 5,
      "partialCount": 2,
      "unpaidCount": 1
    }
  }
}
```

**Derived Fields:**
- `paymentStatus` — `Paid` (outstanding = 0), `Partial` (0 < outstanding < gross), `Unpaid` (outstanding = gross)
- `amountCollected` — Gross minus outstanding
- `clientRealisationRates[].feeRealisationRatePercent` — (Collected / Billed) × 100

---

### 16. Bank Position

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/tally/bank-position` |
| **Auth** | Bearer Token (admin, manager) |
| **Description** | Bank & cash balances, uncleared cheques, total liquid funds |

**Query Parameters:**

| Param | Type | Required |
|-------|------|----------|
| `fromDate` | string | No |
| `toDate` | string | No |

```bash
curl "http://localhost:5000/api/tally/bank-position" \
  -H "Authorization: Bearer <TOKEN>"
```

**Sample Response:**
```json
{
  "success": true,
  "data": {
    "bankAccounts": [
      { "name": "HDFC Bank - Current A/c", "openingBalance": "500000", "closingBalance": "750000" },
      { "name": "ICICI Bank - Savings", "openingBalance": "200000", "closingBalance": "180000" }
    ],
    "cashAccounts": [
      { "name": "Cash", "closingBalance": "25000" }
    ],
    "totalBankBalance": 930000,
    "totalCashBalance": 25000,
    "unclearedCheques": [],
    "unclearedCount": 0,
    "receiptsInPeriod": 45,
    "paymentsInPeriod": 38,
    "derived": {
      "totalLiquidFunds": 955000
    }
  }
}
```

**Derived Fields:**
- `derived.totalLiquidFunds` — Sum of all bank balances + cash in hand

---

### 17. Invoice Register

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/tally/invoice-register` |
| **Auth** | Bearer Token (admin, manager) |
| **Description** | Detailed invoice register with tax breakup (CGST/SGST/IGST), GSTIN, place of supply, and payment status filtering |

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `fromDate` | string | No | YYYYMMDD |
| `toDate` | string | No | YYYYMMDD |
| `clientName` | string | No | Filter by client/party |
| `paymentStatus` | string | No | Filter: `Paid`, `Partial`, `Unpaid`, `Overdue` |

```bash
curl "http://localhost:5000/api/tally/invoice-register?paymentStatus=Overdue" \
  -H "Authorization: Bearer <TOKEN>"
```

**Sample Response:**
```json
{
  "success": true,
  "count": 3,
  "data": {
    "invoices": [
      {
        "voucherNumber": "INV-003",
        "date": "20250110",
        "clientName": "XYZ Ltd",
        "narration": "Annual audit services",
        "grossAmount": 118000,
        "taxableValue": 100000,
        "cgst": 9000,
        "sgst": 9000,
        "igst": 0,
        "billRef": "INV-003",
        "dueDate": "20250209",
        "amountReceived": 0,
        "outstandingBalance": 118000,
        "clientGSTIN": "27AABCU9603R1ZM",
        "placeOfSupply": "Maharashtra",
        "paymentStatus": "Overdue",
        "isOverdue": true,
        "dueDateFormatted": "2025-02-09"
      }
    ],
    "summary": {
      "totalInvoices": 3,
      "paidCount": 0,
      "partialCount": 0,
      "unpaidCount": 0,
      "overdueCount": 3
    }
  }
}
```

**Derived Fields:**
- `paymentStatus` — `Paid`, `Partial`, `Unpaid`, or `Overdue` (unpaid/partial + past due date)
- `isOverdue` — `true` if due date has passed
- Filterable via `paymentStatus` query param

---

### 18. Balance Sheet

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/tally/balance-sheet` |
| **Auth** | Bearer Token (admin, manager) |
| **Description** | Enhanced balance sheet with categorized ledgers, comparative period, and balance check |

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `fromDate` | string | No | YYYYMMDD |
| `toDate` | string | No | YYYYMMDD |
| `compareDate` | string | No | YYYYMMDD — Returns two balance sheets side by side |

```bash
curl "http://localhost:5000/api/tally/balance-sheet?compareDate=20240331" \
  -H "Authorization: Bearer <TOKEN>"
```

**Sample Response:**
```json
{
  "success": true,
  "data": {
    "data": {},
    "categories": {
      "fixedAssets": [
        { "name": "Computer Equipment", "closingBalance": "150000" }
      ],
      "currentAssets": {
        "debtors": [...],
        "advances": [...],
        "cashAndBank": [...],
        "others": [...]
      },
      "investments": [],
      "capitalAndReserves": [...],
      "longTermLiabilities": [...],
      "currentLiabilities": {
        "creditors": [...],
        "gstPayable": [...],
        "tdsPayable": [...],
        "others": [...]
      }
    },
    "comparativeData": {},
    "derived": {
      "totalAssets": 2500000,
      "totalFixedAssets": 150000,
      "totalCurrentAssets": 2300000,
      "totalInvestments": 50000,
      "totalLiabilities": 2500000,
      "totalCapitalReserves": 1000000,
      "totalLongTermLiabilities": 500000,
      "totalCurrentLiabilities": 1000000,
      "isBalanced": true,
      "balanceDifference": 0
    }
  }
}
```

**Derived Fields:**
- `derived.isBalanced` — `true` if total assets = total liabilities (within ₹1 tolerance)
- `derived.balanceDifference` — Assets minus liabilities (should be 0)
- `comparativeData` — Present only when `compareDate` is provided

---

### 19. Reports Summary

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/tally/reports/summary` |
| **Auth** | Bearer Token (any role) |
| **Description** | Returns list of available reports based on user's role |

```bash
curl http://localhost:5000/api/tally/reports/summary \
  -H "Authorization: Bearer <TOKEN>"
```

---

## Notes

### Date Format
All date parameters use **YYYYMMDD** format (e.g., `20250314`).

### Default Date Range
When `fromDate` and `toDate` are not provided, defaults are:
- **From:** April 1, 2024 (`20240401`)
- **To:** March 31, 2025 (`20250331`)

### Tally Connection
- The backend connects to Tally via the `TALLY_HOST` environment variable
- Tally must be running with XML Server enabled
- Use `/api/tally/diagnostics` to troubleshoot connection issues

### Derived Fields Summary
All derived fields are **computed server-side** on top of raw Tally data:

| Field | Source | Logic |
|-------|--------|-------|
| `daysOverdue` | Receivables | `today - dueDate` |
| `ageingBucket` | Receivables | Categorized by days overdue |
| `mtdCollections` | Receivables | Sum of Receipt vouchers in current month |
| `isDueThisWeek` | Payables | Due date within next 7 days |
| `tdsChallanDueDate` | Payables, GST | Hardcoded: 7th of next month |
| `netProfit` | P&L | `totalRevenue - totalExpenses` |
| `netProfitMarginPercent` | P&L | `(netProfit / revenue) × 100` |
| `revenueVsLastMonth` | P&L | Additional Tally request for previous month |
| `revenueVsSameMonthLastYear` | P&L | Additional Tally request for same month last year |
| `netGSTPayable` | GST | `outputGST - ITC` |
| `gstr1_due_date` | GST | Hardcoded: 11th of next month |
| `gstr3b_due_date` | GST | Hardcoded: 20th of next month |
| `paymentStatus` | Billing, Invoice | Based on outstanding vs gross amount |
| `feeRealisationRatePercent` | Billing | `(collected / billed) × 100` per client |
| `totalLiquidFunds` | Bank | `bankBalance + cashBalance` |
| `isBalanced` | Balance Sheet | `totalAssets === totalLiabilities` |
| `isDormant` | Trial Balance | No activity in current month |
