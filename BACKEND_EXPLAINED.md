# Backend Server Explained (server.ts)

This document explains every part of the backend server for your SAP automation project.

---

## 1. Overview

The backend is a **Node.js Express server** that:
- Receives commands from the React frontend
- Parses natural language commands using **AI (Groq LLaMA 3.3)** + regex fallback
- Validates document types before execution
- Executes Playwright tests
- Converts technical errors to user-friendly messages
- Supports bulk PO creation via CSV/Excel upload
- Returns results to the frontend

**File Location:** `backend/src/server.ts`
**Port:** 3001

---

## 2. Key Imports & Setup

```typescript
import express from 'express';           // Web framework
import cors from 'cors';                  // Allow frontend to call backend
import { exec, spawn, ChildProcess } from 'child_process';  // Run Playwright
import multer from 'multer';              // Handle file uploads (bulk CSV/Excel)
import Groq from 'groq-sdk';              // AI command parsing (LLaMA 3.3 via Groq)
import * as XLSX from 'xlsx';             // Parse Excel files
import * as fs from 'fs';                 // File system operations
import dotenv from 'dotenv';              // Environment variables
```

**Server Setup:**
```typescript
const app = express();
app.use(cors());                          // Allow cross-origin requests
app.use(express.json());                  // Parse JSON request bodies
const PORT = 3001;                        // Backend runs on port 3001
```

---

## 3. API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/execute` | POST | Execute a single command |
| `/api/cancel` | POST | Cancel running test |
| `/api/commands` | GET | Get list of available commands |
| `/api/health` | GET | Health check |
| `/api/po-status/:poNumber` | GET | Get PO workflow status |
| `/api/po-details/:poNumber` | GET | Get PO details for invoice calculation |
| `/api/po-list` | GET | Get list of all created POs |
| `/api/bulk-upload` | POST | Upload bulk CSV/Excel file |
| `/api/bulk-status/:jobId` | GET | Get bulk job progress |
| `/api/bulk-cancel` | POST | Cancel bulk job |
| `/api/bulk-jobs` | GET | Get all bulk job statuses |

---

## 4. Document Type Validation

Before executing commands, the backend validates document numbers:

```typescript
interface DocumentTypeResult {
  type: string;           // "purchaseOrder", "materialDocument", "supplierInvoice"
  label: string;          // "Purchase Order", "Material Document"
  shortLabel: string;     // "PO", "Mat Doc", "Invoice"
  isValid: boolean;       // true if matched, false if unknown
}

function identifyDocumentType(documentId: string): DocumentTypeResult {
  // Checks prefix: 45xx = PO, 50xx = Material Doc, 51xx = Invoice
  const config = loadDocumentConfig();  // From config/documentPrefixes.json

  for (const [type, prefixConfig] of Object.entries(config.prefixes)) {
    for (const code of prefixConfig.codes) {
      if (id.startsWith(code)) {
        return { type, label, shortLabel, isValid: true };
      }
    }
  }
  return { type: 'unknown', isValid: false };
}
```

**Validation Rules:**
| Operation | Required Document | Example |
|-----------|------------------|---------|
| Goods Receipt | Purchase Order (45xx) | 4500001075 |
| Supplier Invoice | Purchase Order (45xx) | 4500001075 |
| Payment | Supplier Invoice (51xx) | 5105600001 |

If wrong document type is provided, user gets a clear error:
> "This is a Material Document, not a Purchase Order. Please check the document number."

---

## 5. AI Command Parsing (Groq LLaMA 3.3)

Commands are parsed using AI for natural language understanding:

```typescript
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function parseCommandWithAI(command: string): Promise<AIParseResult> {
  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 256,
    temperature: 0.1,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Parse this command: "${command}"` }
    ]
  });

  return JSON.parse(response.choices[0].message.content);
}
```

**AI Returns:**
```json
{
  "action": "procure_to_pay",
  "poNumber": null,
  "invoiceNumber": null,
  "material": "P-A2026-3",
  "quantity": 5,
  "price": null,
  "amount": null,
  "confidence": 0.9,
  "reasoning": "User mentioned 'p to p flow' which is a keyword for procure_to_pay"
}
```

**Supported Actions:**
| Action | Keywords | Description |
|--------|----------|-------------|
| `purchase_order` | create po, make po | Create single PO |
| `goods_receipt` | gr, goods receipt | Post GR for a PO |
| `supplier_invoice` | invoice, supplier invoice | Create invoice for PO |
| `payment` | payment, pay | Process payment for invoice |
| `procure_to_pay` | p2p, p-p flow, full flow, end to end | Complete PO→GR→Invoice→Payment |

---

## 6. User-Friendly Error Messages

Technical Playwright errors are converted to readable messages:

```typescript
function getUserFriendlyError(technicalError: string): string {
  // Extract element info from error
  const elementNameMatch = error.match(/name:\s*['"]([^'"]+)['"]/i);
  const elementTypeMatch = error.match(/getByRole\(['"]([^'"]+)['"]/i);

  // Timeout errors
  if (errorLower.includes('timeout')) {
    return `The "${elementName}" ${elementType} is not visible. Please try again.`;
  }

  // Network errors
  if (errorLower.includes('net::') || errorLower.includes('econnrefused')) {
    return 'Network error. Please check your internet connection and SAP server.';
  }

  // Browser closed
  if (errorLower.includes('target closed') || errorLower.includes('browser closed')) {
    return 'The browser closed unexpectedly. Please try again.';
  }

  // ... more patterns
}
```

**Error Transformations:**
| Technical Error | User-Friendly Message |
|----------------|----------------------|
| `TimeoutError: locator.waitFor: getByRole('textbox', { name: 'Supplier' })` | The "Supplier" textbox is not visible. Please try again. |
| `net::ERR_CONNECTION_REFUSED` | Network error. Please check your internet connection and SAP server. |
| `Target closed` | The browser closed unexpectedly. Please try again. |

---

## 7. Command Types & Test Files

### Purchase Order (No PO number needed)
```
"create a po"
"create po with price 3000"
"make a purchase order with material P-A2026-3 quantity 5"
```
**Test File:** `tests/flows/PurchaseOrderFlow.spec.ts`

### Goods Receipt (Needs PO number)
```
"goods receipt for 4500000123"
"gr 4500000123"
"create goods receipt for po 4500000123"
```
**Test File:** `tests/flows/GoodsReceiptFlow.spec.ts`

### Supplier Invoice (Needs PO number)
```
"supplier invoice 4500000123"
"create invoice for po 4500000123 amount 5000"
```
**Test File:** `tests/flows/SupplierInvoiceFlow.spec.ts`

### Payment (Needs Invoice number)
```
"payment for 5105600001"
"process payment 5105600001"
```
**Test File:** `tests/flows/PaymentFlow.spec.ts`

### Procure-to-Pay (Full Flow)
```
"p2p flow"
"p-p flow with material P-A2026-3 quantity 5"
"complete procure to pay"
```
**Test File:** `tests/procureToPay.spec.ts`

---

## 8. Environment Variables

Parameters are passed to Playwright tests via environment variables:

```typescript
const envVars = {
  PO_NUMBER: '4500000123',    // For GR and Invoice
  INVOICE_NUMBER: '5105600001', // For Payment
  MATERIAL: 'P-A2026-3',      // For PO creation
  QUANTITY: '5',              // For PO creation
  PRICE: '3000',              // For PO creation
  AMOUNT: '15000'             // For Invoice (auto-calculated)
};

// Execute Playwright with these env vars
exec(testCommand, {
  env: { ...getCleanEnv(), ...envVars }
});
```

**Clean Environment Function:**
```typescript
function getCleanEnv(): NodeJS.ProcessEnv {
  const cleanEnv = { ...process.env };
  // Remove old SAP variables to prevent interference
  const sapEnvVars = [
    'AMOUNT', 'PO_NUMBER', 'INVOICE_NUMBER', 'PRICE',
    'QUANTITY', 'MATERIAL', 'SUPPLIER', 'BULK_CSV_PATH', 'BULK_JOB_ID'
  ];
  sapEnvVars.forEach(varName => delete cleanEnv[varName]);
  return cleanEnv;
}
```

---

## 9. Bulk Upload System

### File Upload Handler
```typescript
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Allow: xlsx, xls, csv, json
  }
});

app.post('/api/bulk-upload', upload.single('file'), async (req, res) => {
  // Parse file based on extension
  if (file.originalname.endsWith('.xlsx')) {
    records = XLSX.read(file.buffer);
  } else if (file.originalname.endsWith('.csv')) {
    records = parseCSV(file.buffer);
  }

  // Create job and start processing
  const jobId = `bulk-${Date.now()}`;
  startBulkJob(jobId, records);

  return res.json({ jobId, totalItems: records.length });
});
```

### Bulk Job Status Interface
```typescript
interface BulkJobStatus {
  id: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  totalItems: number;
  completedItems: number;
  results: Array<{
    index: number;
    material: string;
    quantity: string;
    price: string;
    status: 'success' | 'failed' | 'pending' | 'cancelled';
    poNumber?: string;
    error?: string;
    completedAt?: string;
  }>;
  startTime: Date;
  endTime?: Date;
}
```

---

## 10. PO Details & Invoice Calculation

```typescript
// Read PO details from CSV
function getPODetailsFromCSV(poNumber: string): PODetails | null {
  const csvPath = 'utils/poDetails.csv';
  const content = fs.readFileSync(csvPath, 'utf-8');

  // CSV format: PO_Number,Material,Quantity,Price,Timestamp
  const lines = content.split('\n');
  for (const line of lines) {
    const parts = line.split(',');
    if (parts[0] === poNumber) {
      return {
        poNumber: parts[0],
        material: parts[1],
        quantity: parts[2],
        price: parts[3],
        createdAt: parts[4]
      };
    }
  }
  return null;
}

// Calculate invoice amount
function calculateInvoiceAmount(poNumber: string): string | null {
  const poDetails = getPODetailsFromCSV(poNumber);
  if (!poDetails) return null;

  const quantity = parseFloat(poDetails.quantity) || 1;
  const price = parseFloat(poDetails.price) || 1000;
  return String(Math.round(quantity * price));
}
```

**Example:**
- PO 4500000123 has: Quantity=5, Price=3000
- Invoice Amount = 5 × 3000 = **15000**

---

## 11. Error Extraction from Playwright Output

```typescript
catch (error: any) {
  const stdout = error.stdout || '';
  const stderr = error.stderr || '';
  const fullOutput = stdout + '\n' + stderr;

  // Look for common Playwright error patterns
  const timeoutMatch = fullOutput.match(/TimeoutError:.*?(?=\n\s*at|\n\n|$)/s);
  const locatorMatch = fullOutput.match(/Error:.*?locator\.[^:]+:.*?(?=\n\s*at|\n\n|$)/is);
  const assertionMatch = fullOutput.match(/AssertionError:.*?(?=\n\s*at|\n\n|$)/s);
  const genericErrorMatch = fullOutput.match(/Error:.*?(?=\n\s*at|\n\n|$)/s);

  if (timeoutMatch) {
    errorMessage = timeoutMatch[0].trim();
  } else if (locatorMatch) {
    errorMessage = locatorMatch[0].trim();
  }
  // ... priority order

  // Clean ANSI color codes
  errorMessage = errorMessage.replace(/\x1b\[[0-9;]*m/g, '');

  // Convert to user-friendly message
  const userFriendlyError = getUserFriendlyError(errorMessage);
}
```

---

## 12. Key Regex Patterns

| Pattern | Matches | Example |
|---------|---------|---------|
| `/(?:price\|cost)\s*(\d+)/i` | Price/cost values | "price 3000" → 3000 |
| `/(?:quantity\|qty)\s*(\d+)/i` | Quantity values | "qty 5" → 5 |
| `/(P-[A-Z0-9-]+)/i` | Material codes | "P-A2026-3" |
| `/(4500\d{6})/` | PO numbers | "4500000123" |
| `/(5105\d{6})/` | Invoice numbers | "5105600001" |
| `/(5000\d{6})/` | Material doc numbers | "5000000001" |

---

## 13. Data Flow Diagram

### SUCCESS Flow (Test Passes)
```
┌─────────────┐     POST /api/execute     ┌─────────────┐
│   Frontend  │ ──────────────────────────▶│   Backend   │
│   (React)   │  { command: "create po" } │  (Express)  │
└─────────────┘                            └──────┬──────┘
                                                  │
                                    ┌─────────────▼─────────────┐
                                    │  1. Validate Document Type │
                                    │     ✓ Valid or N/A        │
                                    └─────────────┬─────────────┘
                                                  │
                                    ┌─────────────▼─────────────┐
                                    │  2. Parse Command with AI  │
                                    │     action: "purchase_order"│
                                    │     material: "P-A2026-3"  │
                                    └─────────────┬─────────────┘
                                                  │
                                    ┌─────────────▼─────────────┐
                                    │  3. Execute Playwright     │
                                    │     npx playwright test    │
                                    │     ✓ Test PASSES         │
                                    └─────────────┬─────────────┘
                                                  │
                                    ┌─────────────▼─────────────┐
                                    │  4. Parse Output           │
                                    │     Extract: PO 4500000385 │
                                    └─────────────┬─────────────┘
                                                  │
                                    ┌─────────────▼─────────────┐
                                    │  5. Save to CSV            │
                                    │     poDetails.csv updated  │
                                    └─────────────┬─────────────┘
                                                  │
┌─────────────┐     JSON Response     ┌──────────▼───────────┐
│   Frontend  │ ◀─────────────────────│   Return SUCCESS     │
│   (React)   │                       │                      │
└──────┬──────┘                        └──────────────────────┘
       │
       │  {
       │    success: true,
       │    message: "✓ Purchase Order 4500000385 created",
       │    poNumber: "4500000385",
       │    duration: 45000
       │  }
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Display                         │
├─────────────────────────────────────────────────────────────┤
│  ✅ Test Completed Successfully!                            │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  📋 Result: Purchase Order 4500000385 created               │
│  ⏱️ Duration: 45 seconds                                    │
└─────────────────────────────────────────────────────────────┘
```

### FAILURE Flow (Test Fails)
```
┌─────────────┐     POST /api/execute     ┌─────────────┐
│   Frontend  │ ──────────────────────────▶│   Backend   │
│   (React)   │  { command: "gr 51056..." }│  (Express)  │
└─────────────┘                            └──────┬──────┘
                                                  │
                                    ┌─────────────▼─────────────┐
                                    │  1. Validate Document Type │
                                    │     ✗ WRONG TYPE!         │
                                    │     Expected: PO (45xx)    │
                                    │     Got: Invoice (51xx)    │
                                    └─────────────┬─────────────┘
                                                  │
                                    ┌─────────────▼─────────────┐
                                    │  EARLY RETURN - No test   │
                                    │  execution needed         │
                                    └─────────────┬─────────────┘
                                                  │
┌─────────────┐     JSON Response     ┌──────────▼───────────┐
│   Frontend  │ ◀─────────────────────│   Return FAILURE     │
│   (React)   │                       │                      │
└──────┬──────┘                        └──────────────────────┘
       │
       │  {
       │    success: false,
       │    message: "✗ This is a Supplier Invoice, not a Purchase Order",
       │    duration: 50
       │  }
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Display                         │
├─────────────────────────────────────────────────────────────┤
│  ❌ Test Failed                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  ✗ This is a Supplier Invoice, not a Purchase Order.       │
│    Please check the document number and try again.         │
└─────────────────────────────────────────────────────────────┘
```

### FAILURE Flow (Playwright Error)
```
┌─────────────┐     POST /api/execute     ┌─────────────┐
│   Frontend  │ ──────────────────────────▶│   Backend   │
│   (React)   │  { command: "create po" } │  (Express)  │
└─────────────┘                            └──────┬──────┘
                                                  │
                                    ┌─────────────▼─────────────┐
                                    │  1. Validate Document Type │
                                    │     ✓ Valid               │
                                    └─────────────┬─────────────┘
                                                  │
                                    ┌─────────────▼─────────────┐
                                    │  2. Parse Command with AI  │
                                    │     action: "purchase_order"│
                                    └─────────────┬─────────────┘
                                                  │
                                    ┌─────────────▼─────────────┐
                                    │  3. Execute Playwright     │
                                    │     npx playwright test    │
                                    │     ✗ Test FAILS          │
                                    │     TimeoutError: Supplier │
                                    │     textbox not visible    │
                                    └─────────────┬─────────────┘
                                                  │
                                    ┌─────────────▼─────────────┐
                                    │  4. Extract Error          │
                                    │     from stdout/stderr     │
                                    └─────────────┬─────────────┘
                                                  │
                                    ┌─────────────▼─────────────┐
                                    │  5. getUserFriendlyError() │
                                    │     Convert technical error│
                                    │     to readable message    │
                                    └─────────────┬─────────────┘
                                                  │
┌─────────────┐     JSON Response     ┌──────────▼───────────┐
│   Frontend  │ ◀─────────────────────│   Return FAILURE     │
│   (React)   │                       │                      │
└──────┬──────┘                        └──────────────────────┘
       │
       │  {
       │    success: false,
       │    message: "The 'Supplier' textbox is not visible. Please try again.",
       │    errors: ["TimeoutError: locator.waitFor..."],
       │    duration: 30000
       │  }
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Display                         │
├─────────────────────────────────────────────────────────────┤
│  ❌ Test Failed                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  The "Supplier" textbox is not visible. Please try again.  │
│  ⏱️ Duration: 30 seconds                                    │
└─────────────────────────────────────────────────────────────┘
```

### Data Storage & Retrieval Flow (CSV)
```
═══════════════════════════════════════════════════════════════════════════════
                         PURCHASE ORDER CREATION
═══════════════════════════════════════════════════════════════════════════════

  ┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
  │  Playwright Test │         │   SAP System     │         │  poDetails.csv   │
  │  (purchaseOrder) │         │                  │         │                  │
  └────────┬─────────┘         └────────┬─────────┘         └────────┬─────────┘
           │                            │                            │
           │  1. Create PO with         │                            │
           │     Material, Qty, Price   │                            │
           │ ──────────────────────────▶│                            │
           │                            │                            │
           │  2. Returns PO Number      │                            │
           │     (e.g., 4500000385)     │                            │
           │ ◀──────────────────────────│                            │
           │                            │                            │
           │  3. Save PO Details to CSV │                            │
           │ ─────────────────────────────────────────────────────────▶
           │     PO_Number,Material,Quantity,Price,Timestamp         │
           │     4500000385,P-A2026-3,5,1000,2026-01-29T...          │
           │                            │                            │

═══════════════════════════════════════════════════════════════════════════════
                         SUPPLIER INVOICE CREATION
═══════════════════════════════════════════════════════════════════════════════

  ┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
  │     Backend      │         │  poDetails.csv   │         │  Playwright Test │
  │    (server.ts)   │         │                  │         │ (SupplierInvoice)│
  └────────┬─────────┘         └────────┬─────────┘         └────────┬─────────┘
           │                            │                            │
           │  1. Read PO Details        │                            │
           │     for PO 4500000385      │                            │
           │ ──────────────────────────▶│                            │
           │                            │                            │
           │  2. Returns: Qty=5,        │                            │
           │     Price=1000             │                            │
           │ ◀──────────────────────────│                            │
           │                            │                            │
           │  3. Calculate Amount       │                            │
           │     5 × 1000 = 5000        │                            │
           │                            │                            │
           │  4. Pass AMOUNT=5000       │                            │
           │     to Playwright          │                            │
           │ ─────────────────────────────────────────────────────────▶
           │                            │                            │

═══════════════════════════════════════════════════════════════════════════════
                              CSV FILES SUMMARY
═══════════════════════════════════════════════════════════════════════════════

  ┌─────────────────────────────────────────────────────────────────────────┐
  │                         utils/poDetails.csv                             │
  ├─────────────────────────────────────────────────────────────────────────┤
  │  PO_Number    │ Material    │ Quantity │ Price │ Timestamp              │
  ├───────────────┼─────────────┼──────────┼───────┼────────────────────────┤
  │  4500000385   │ P-A2026-3   │ 5        │ 1000  │ 2026-01-29T10:30:00Z   │
  │  4500000386   │ P-A2026-3   │ 10       │ 2000  │ 2026-01-29T11:00:00Z   │
  └─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Used for:
                                    │ • Invoice amount calculation
                                    │ • PO status tracking
                                    │ • Test history display
                                    ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                      Frontend Test History Tab                          │
  ├─────────────────────────────────────────────────────────────────────────┤
  │  📋 Recent POs:                                                         │
  │  • PO 4500000385 - Material: P-A2026-3, Qty: 5, Price: 1000            │
  │  • PO 4500000386 - Material: P-A2026-3, Qty: 10, Price: 2000           │
  └─────────────────────────────────────────────────────────────────────────┘
```

---

## 14. File Structure

```
backend/
├── src/
│   └── server.ts          # Main server file (all logic here)
├── package.json           # Dependencies
└── tsconfig.json          # TypeScript config

config/
└── documentPrefixes.json  # Document type prefix configuration

utils/
├── poDetails.csv          # Stores PO details (for invoice calc)
├── purchaseorderno.csv    # List of created PO numbers
├── pOnumbergoods.csv      # POs with goods receipt done
└── pOnumberinvoice.csv    # POs with invoice done
```

---

## 15. Key Code Locations

| Feature | Lines (approx) |
|---------|----------------|
| Document Type Validation | 15-160 |
| User-Friendly Error Mapper | 237-415 |
| AI Command Parsing (Groq) | 417-500 |
| Clean Environment | 175-185 |
| Execute Test Function | 1137-1370 |
| `/api/execute` Endpoint | 1375-1398 |
| `/api/cancel` Endpoint | 1400-1428 |
| `/api/po-details` Endpoint | 1573-1600 |
| Bulk Upload | 1726-1930 |
| Bulk Status | 1933-1957 |

---

## 16. Common Interview Questions

**Q: How do you handle concurrent requests?**
> Each request creates a new Playwright process via `exec()`. The `currentTestProcess` variable tracks the running test for cancellation support.

**Q: Why use environment variables instead of command-line arguments?**
> Environment variables are cleaner, more secure (don't appear in process lists), and easier to manage for multiple parameters.

**Q: How does the AI parsing work?**
> We send the user's command to Groq's LLaMA 3.3 model with a system prompt explaining SAP actions. The AI returns structured JSON with action type and parameters. This allows natural language like "make a purchase order for steel with quantity five" to work.

**Q: What happens if AI parsing fails?**
> The system uses regex pattern matching as a fallback. Basic commands work even without AI.

**Q: How do you prevent wrong document types?**
> The `validateDocumentTypeForOperation()` function checks if the provided document ID matches the required type (e.g., Goods Receipt requires a PO, not an Invoice).

**Q: How are technical errors made user-friendly?**
> The `getUserFriendlyError()` function parses Playwright error messages, extracts element names and action types, then generates readable messages like "The Supplier textbox is not visible" instead of technical stack traces.

---

Good luck with your demo! You now understand the complete backend flow.
