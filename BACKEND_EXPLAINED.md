# Backend Server Explained (server.ts)

This document explains every part of the backend server for your SAP automation project.

---

## 1. Overview

The backend is a **Node.js Express server** that:
- Receives commands from the React frontend
- Parses natural language commands (using regex + AI)
- Executes Playwright tests
- Returns results to the frontend

**File Location:** `backend/src/server.ts`

---

## 2. Key Imports & Setup

```typescript
import express from 'express';           // Web framework
import cors from 'cors';                  // Allow frontend to call backend
import { exec } from 'child_process';     // Run Playwright commands
import multer from 'multer';              // Handle file uploads (bulk CSV)
import Groq from 'groq-sdk';              // AI command parsing (Groq API)
import * as fs from 'fs';                 // File system operations
import * as path from 'path';             // Path utilities
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
| `/api/bulk-upload` | POST | Upload bulk CSV/Excel file |
| `/api/bulk-status/:jobId` | GET | Get bulk job progress |
| `/api/bulk-cancel/:jobId` | POST | Cancel bulk job |
| `/api/po-details/:poNumber` | GET | Get PO details for invoice calculation |

---

## 4. Command Parsing Flow

When user enters a command like `"create a po with price 3000"`:

### Step 1: Pattern Matching (Fast)
```typescript
// Check if it's a PO creation command
const isPOCreation = lowerCommand.includes('create') &&
                     lowerCommand.includes('po');

// Extract parameters using regex
const priceMatch = command.match(/(?:price|cost)\s*(\d+)/i);
const quantityMatch = command.match(/(?:quantity|qty)\s*(\d+)/i);
const materialMatch = command.match(/(P-[A-Z0-9-]+)/i);
```

### Step 2: AI Fallback (If pattern matching fails)
```typescript
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const response = await groq.chat.completions.create({
  model: 'llama3-8b-8192',  // LLaMA 3 model via Groq
  messages: [
    { role: 'system', content: 'Parse SAP commands...' },
    { role: 'user', content: userCommand }
  ]
});
```

**AI returns structured JSON:**
```json
{
  "action": "purchase_order",
  "poNumber": null,
  "material": "P-A2026-3",
  "quantity": "5",
  "price": "3000"
}
```

---

## 5. Command Types Supported

### Purchase Order (No PO number needed)
```
"create a po"
"create po with price 3000"
"make a purchase order with material P-A2026-3"
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
"create invoice for po 4500000123"
"invoice 4500000123"
```
**Test File:** `tests/flows/SupplierInvoiceFlow.spec.ts`

---

## 6. Environment Variables

Parameters are passed to Playwright tests via environment variables:

```typescript
const envVars = {
  PO_NUMBER: '4500000123',    // For GR and Invoice
  MATERIAL: 'P-A2026-3',      // For PO creation
  QUANTITY: '5',              // For PO creation
  PRICE: '3000',              // For PO creation
  AMOUNT: '15000'             // For Invoice (auto-calculated)
};

// Execute Playwright with these env vars
exec(testCommand, {
  env: { ...process.env, ...envVars }
});
```

**Clean Environment Function:**
```typescript
function getCleanEnv(): NodeJS.ProcessEnv {
  const cleanEnv = { ...process.env };
  // Remove old SAP variables to prevent interference
  const sapEnvVars = ['AMOUNT', 'PO_NUMBER', 'PRICE', 'QUANTITY', 'MATERIAL'];
  sapEnvVars.forEach(varName => delete cleanEnv[varName]);
  return cleanEnv;
}
```

---

## 7. Test Execution

```typescript
async function executeTest(command: string) {
  // 1. Parse the command
  const parsed = await parseCommandWithAIFallback(command);

  // 2. Build the Playwright command
  const testCommand = `npx playwright test ${parsed.testFile}`;

  // 3. Execute with environment variables
  const { stdout, stderr } = await exec(testCommand, {
    cwd: projectRoot,
    timeout: 600000,  // 10 minutes max
    env: { ...getCleanEnv(), ...parsed.envVars }
  });

  // 4. Parse output for document numbers
  const poMatch = stdout.match(/PO Number[:\s]+(\d+)/i);
  const invoiceMatch = stdout.match(/(5105\d{6})/);

  // 5. Return result
  return {
    success: true,
    poNumber: poMatch?.[1],
    invoiceNumber: invoiceMatch?.[1]
  };
}
```

---

## 8. Invoice Amount Calculation

When creating a supplier invoice, the amount is auto-calculated:

```typescript
// Read PO details from CSV
function getAmountForPO(poNumber: string): string {
  const csvPath = 'utils/poDetails.csv';
  const content = fs.readFileSync(csvPath, 'utf-8');

  // Find the PO in CSV
  // CSV format: PO_Number,Material,Quantity,Price,Timestamp
  const lines = content.split('\n');
  for (const line of lines) {
    const parts = line.split(',');
    if (parts[0] === poNumber) {
      const quantity = parseFloat(parts[2]);
      const price = parseFloat(parts[3]);
      return String(quantity * price);  // Amount = Qty × Price
    }
  }
  return '1000';  // Default if not found
}
```

**Example:**
- PO 4500000123 has: Quantity=5, Price=3000
- Invoice Amount = 5 × 3000 = 15000

---

## 9. Bulk Upload System

### File Upload Handler
```typescript
const upload = multer({ dest: 'uploads/' });

app.post('/api/bulk-upload', upload.single('file'), async (req, res) => {
  const file = req.file;

  // Parse file based on extension
  if (file.originalname.endsWith('.xlsx')) {
    records = parseExcel(file.path);
  } else if (file.originalname.endsWith('.csv')) {
    records = parseCSV(file.path);
  } else if (file.originalname.endsWith('.json')) {
    records = parseJSON(file.path);
  }

  // Create job and start processing
  const jobId = generateJobId();
  startBulkJob(jobId, records);

  return res.json({ jobId });
});
```

### Bulk Job Processing
```typescript
async function processBulkJob(jobId: string, records: any[]) {
  for (let i = 0; i < records.length; i++) {
    // Update progress
    bulkJobs[jobId].completedItems = i;
    bulkJobs[jobId].progress = (i / records.length) * 100;

    // Execute PO creation for each record
    const result = await executeBulkPO(records[i]);

    bulkJobs[jobId].results.push(result);
  }
}
```

---

## 10. Error Handling

```typescript
catch (error: any) {
  // Extract meaningful error from Playwright output
  const stdout = error.stdout || '';
  const stderr = error.stderr || '';

  // Look for specific error patterns
  const timeoutMatch = stdout.match(/TimeoutError:.*?(?=\n)/);
  const locatorMatch = stdout.match(/Error:.*?locator.*?(?=\n)/);

  let errorMessage = 'Test execution failed';
  if (timeoutMatch) {
    errorMessage = timeoutMatch[0];  // e.g., "TimeoutError: waiting for..."
  }

  // Clean ANSI color codes
  errorMessage = errorMessage.replace(/\x1b\[[0-9;]*m/g, '');

  return {
    success: false,
    errors: [errorMessage]
  };
}
```

---

## 11. Key Regex Patterns

| Pattern | Matches | Example |
|---------|---------|---------|
| `/(?:price\|cost)\s*(\d+)/i` | Price/cost values | "price 3000" → 3000 |
| `/(?:quantity\|qty)\s*(\d+)/i` | Quantity values | "qty 5" → 5 |
| `/(P-[A-Z0-9-]+)/i` | Material codes | "P-A2026-3" |
| `/(4500\d{6})/` | PO numbers | "4500000123" |
| `/(5105\d{6})/` | Invoice numbers | "5105600001" |
| `/(5000\d{6})/` | Material doc numbers | "5000000001" |

---

## 12. Data Flow Diagram

```
┌─────────────┐     POST /api/execute     ┌─────────────┐
│   Frontend  │ ──────────────────────────▶│   Backend   │
│   (React)   │     { command: "..." }    │  (Express)  │
└─────────────┘                            └──────┬──────┘
                                                  │
                                                  ▼
                                     ┌────────────────────────┐
                                     │   Parse Command        │
                                     │   (Regex + AI)         │
                                     └───────────┬────────────┘
                                                 │
                                                 ▼
                                     ┌────────────────────────┐
                                     │   Execute Playwright   │
                                     │   npx playwright test  │
                                     └───────────┬────────────┘
                                                 │
                                                 ▼
                                     ┌────────────────────────┐
                                     │   Parse Output         │
                                     │   Extract PO/Invoice   │
                                     └───────────┬────────────┘
                                                 │
                                                 ▼
┌─────────────┐     JSON Response     ┌──────────────────────┐
│   Frontend  │ ◀─────────────────────│   Return Result      │
│   (React)   │    { success, poNumber }   │                │
└─────────────┘                        └──────────────────────┘
```

---

## 13. File Structure

```
backend/
├── src/
│   └── server.ts          # Main server file (all logic here)
├── uploads/               # Temporary bulk upload files
├── package.json           # Dependencies
└── tsconfig.json          # TypeScript config

utils/
├── poDetails.csv          # Stores PO details (for invoice calc)
├── purchaseorderno.csv    # List of created PO numbers
├── pOnumbergoods.csv      # POs with goods receipt done
└── pOnumberinvoice.csv    # POs with invoice done
```

---

## 14. Common Interview Questions

**Q: How do you handle concurrent requests?**
> Each request creates a new Playwright process. The `exec` function runs asynchronously, so multiple requests can be processed (though SAP session may have limitations).

**Q: Why use environment variables instead of command-line arguments?**
> Environment variables are cleaner and more secure. They don't appear in process lists and are easier to manage for multiple parameters.

**Q: How does the AI parsing work?**
> We send the user's command to Groq with a system prompt explaining SAP actions. The AI returns structured JSON with the action type and parameters. This allows natural language like "make a purchase order for steel with quantity five" to work.

**Q: What happens if the AI is unavailable?**
> The system first tries regex pattern matching. AI is only used as a fallback for complex commands. So basic commands work even without AI.

**Q: How do you prevent old environment variables from affecting new tests?**
> The `getCleanEnv()` function removes all SAP-related variables before each test execution, ensuring a clean state.

---

## 15. Key Code Locations

| Feature | Lines (approx) |
|---------|----------------|
| Express setup | 1-50 |
| Groq setup | 60-80 |
| `parseCommandWithAIFallback()` | 100-350 |
| Pattern matching (PO) | 420-452 |
| Pattern matching (Invoice) | 455-550 |
| Pattern matching (Goods Receipt) | 560-630 |
| `executeTest()` | 765-945 |
| Error handling | 894-945 |
| Bulk upload endpoint | 1200-1350 |
| Bulk job processing | 1350-1450 |
| PO details endpoint | 1146-1175 |

---

Good luck with your demo! You now understand the complete backend flow.
