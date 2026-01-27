# SAP Procure-to-Pay Automation with AI-Powered Natural Language Interface

A full-stack web application that automates SAP Fiori testing using natural language commands. Built with React, Node.js, Playwright, and OpenAI.

---

## Overview

This application automates the complete SAP Procure-to-Pay (P2P) process:
- **Purchase Order Creation** - Create POs with custom material, quantity, and price
- **Goods Receipt** - Post goods receipt for existing POs
- **Supplier Invoice** - Create invoices with auto-calculated amounts

Users can execute tests using simple natural language commands like:
```
"create a po with price 3000"
"goods receipt for 4500000123"
"supplier invoice 4500000123"
```

---

## Features

### 1. Natural Language Command Interface
- Type commands in plain English
- AI parses intent and extracts parameters
- Pattern matching + OpenAI fallback for complex commands

**Example Commands:**
```
"create a po"                              → Creates PO with default values
"create po with price 3000 quantity 5"     → Creates PO with custom values
"gr 4500000123"                            → Goods receipt for PO
"invoice for po 4500000123"                → Supplier invoice (amount auto-calculated)
```

### 2. Real-Time Execution Progress
- Live step-by-step progress tracking
- Visual indicators (checkmarks for success, X for errors)
- Detailed error messages when tests fail

### 3. Bulk Upload
- Upload Excel (.xlsx), CSV, or JSON files
- Process multiple POs in a single session
- Real-time progress for each item
- Results exported to CSV

### 4. Auto-Calculated Invoice Amounts
- PO details (quantity, price) stored in `poDetails.csv`
- When creating invoice: `Amount = Quantity × Price`
- No need to manually specify amount

### 5. Dashboard & History
- Total tests executed
- Success/failure counts
- Detailed error logs for failed tests

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite |
| Backend | Node.js, Express, TypeScript |
| Automation | Playwright |
| AI | Groq API (LLaMA 3) |
| File Parsing | xlsx, multer |

---

## Project Structure

```
playwright-automation-testing/
├── frontend/                    # React application
│   ├── src/
│   │   ├── App.tsx             # Main app with all views
│   │   ├── App.css             # Styling
│   │   └── components/         # UI components
│   └── package.json
│
├── backend/                     # Express server
│   ├── src/
│   │   └── server.ts           # Main server (API + command parsing)
│   └── package.json
│
├── tests/                       # Playwright test files
│   ├── Login.ts                # SAP login automation
│   ├── purchaseOrder.ts        # PO creation logic
│   ├── BulkPurchaseOrder.ts    # Bulk PO creation
│   ├── Goodsreceipt.ts         # Goods receipt logic
│   ├── SupplierInvoice.ts      # Supplier invoice logic
│   └── flows/                  # Test flow specs
│       ├── PurchaseOrderFlow.spec.ts
│       ├── GoodsReceiptFlow.spec.ts
│       ├── SupplierInvoiceFlow.spec.ts
│       └── BulkPOFlow.spec.ts
│
├── utils/                       # Utilities
│   ├── Searching.ts            # Fiori app navigation
│   ├── sapUtils.ts             # SAP field helpers
│   ├── poDetails.csv           # Stores PO details for invoice calc
│   └── purchaseorderno.csv     # List of created POs
│
├── playwright.config.ts         # Playwright configuration
├── BACKEND_EXPLAINED.md         # Backend documentation
└── README.md                    # This file
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- SAP Fiori access credentials
- Groq API key (optional, for AI parsing)

### Installation

```bash
# 1. Clone repository
git clone <repository-url>
cd playwright-automation-testing

# 2. Install root dependencies (Playwright)
npm install

# 3. Install backend dependencies
cd backend
npm install

# 4. Install frontend dependencies
cd ../frontend
npm install
```

### Configuration

Create `backend/.env` file:
```env
GROQ_API_KEY=gsk_your-api-key-here
PORT=3001
```

Update SAP credentials in `tests/Login.ts`:
```typescript
const SAP_URL = 'your-sap-fiori-url';
const USERNAME = 'your-username';
const PASSWORD = 'your-password';
```

### Running the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
Backend runs on http://localhost:3001

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Frontend runs on http://localhost:5173

---

## Usage Guide

### Execute Single Command

1. Go to **Execute Test** page
2. Enter command: `create a po with price 2000`
3. Click **Execute** or press `Ctrl+Enter`
4. Watch real-time progress
5. View results (PO number, duration)

### Bulk Upload

1. Go to **Bulk Upload** page
2. Download sample CSV template
3. Fill in your data:
   ```csv
   Material,Quantity,Price
   P-A2026-3,5,1000
   P-A2026-2,10,500
   ```
4. Upload file
5. Click **Start Bulk Execution**
6. Monitor progress for each item

### View History

1. Go to **History** page
2. See all past executions
3. Click row to expand error details

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/execute` | Execute single command |
| POST | `/api/cancel` | Cancel running test |
| POST | `/api/bulk-upload` | Upload bulk file |
| GET | `/api/bulk-status/:id` | Get bulk job progress |
| POST | `/api/bulk-cancel/:id` | Cancel bulk job |
| GET | `/api/po-details/:po` | Get PO details |

---

## Command Parsing

### How It Works

1. **Pattern Matching** (Fast) - Regex patterns for common commands
2. **AI Fallback** (Smart) - Groq API parses complex/ambiguous commands

### Supported Patterns

| Command Type | Example | Extracted |
|--------------|---------|-----------|
| Create PO | `create po price 3000` | PRICE=3000 |
| Create PO | `po with qty 5 material P-A2026-3` | QUANTITY=5, MATERIAL=P-A2026-3 |
| Goods Receipt | `gr 4500000123` | PO_NUMBER=4500000123 |
| Supplier Invoice | `invoice 4500000123` | PO_NUMBER=4500000123, AMOUNT=auto |

---

## SAP Automation Details

### Purchase Order Flow
1. Open "Create Purchase Order Advanced" tile
2. Fill supplier (F4 value help)
3. Fill org data (Purch. Org, Purch. Group, Company Code)
4. Fill item overview (Material, Quantity, Price, Plant)
5. Fill account assignment (G/L Account, Cost Center)
6. Save and capture PO number

### Goods Receipt Flow
1. Open "Post Goods Movement" tile
2. Enter PO number
3. Click Execute
4. Mark items OK
5. Post and capture Material Document number

### Supplier Invoice Flow
1. Open "Create Supplier Invoice Advanced" tile
2. Enter Company Code, PO number
3. Fill Amount (auto-calculated from PO details)
4. Fill Baseline Date
5. Post and capture Invoice Document number

---

## Error Handling

### Retry Logic
- Tile navigation retries up to 3 times
- Alternative selectors if primary fails

### Error Display
- Detailed Playwright errors extracted from stdout
- TimeoutError, locator errors shown in UI
- Full error visible in execution progress

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| Tile not found | SAP slow to load | Retry mechanism handles this |
| Invoice posting failed | PO already invoiced | Use fresh PO |
| Field not visible | SAP UI change | Update selector |

---

## Files Generated

| File | Purpose |
|------|---------|
| `utils/poDetails.csv` | Stores PO details (qty, price) for invoice calculation |
| `utils/purchaseorderno.csv` | List of all created PO numbers |
| `utils/pOnumbergoods.csv` | POs with goods receipt completed |
| `utils/pOnumberinvoice.csv` | POs with invoice completed |
| `uploads/` | Temporary bulk upload files (auto-cleaned) |

---

## Running Tests Directly

```bash
# Run specific flow
npx playwright test tests/flows/PurchaseOrderFlow.spec.ts --headed

# With parameters
$env:PRICE="3000"; $env:QUANTITY="5"; npx playwright test tests/flows/PurchaseOrderFlow.spec.ts --headed

# Debug mode
npx playwright test --debug
```

---

## Troubleshooting

### Backend won't start
```bash
cd backend
rm -rf node_modules
npm install
npm run dev
```

### Frontend won't connect
- Ensure backend is running on port 3001
- Check CORS is enabled in server.ts

### Test timeout
- SAP may be slow - retry usually works
- Increase timeout in playwright.config.ts

### Invoice amount wrong
- Check `poDetails.csv` has correct PO entry
- Verify quantity and price are correct

---

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

---

## License

MIT License

---

**Version:** 2.0.0
**Last Updated:** 2026-01-26
**Status:** Fully Functional (Frontend + Backend + Automation)
