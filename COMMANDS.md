# SAP Automation - Command Reference Guide

This document lists all supported commands for the SAP Playwright automation system.

---

## Quick Start

1. Start the backend server:
   ```bash
   cd backend
   npm run dev
   ```

2. Start the frontend:
   ```bash
   cd frontend
   npm run dev
   ```

3. Open http://localhost:5173 and type any command below.

---

## 1. Create Purchase Order

Creates a new Purchase Order in SAP. **No additional input required.**

### Basic Commands
```
Create a purchase order
Create PO
Create a PO
Create new PO
Generate a purchase order
Generate PO
Start a purchase order
New purchase order
Make a PO
Make purchase order
```

### Action Commands
```
Run PO
Run PO creation
Run purchase order
Run purchase order creation
Run purchase order flow
Execute PO
Execute purchase order
Execute PO creation
Start PO
Start PO creation
Start purchase order
```

### Conversational Style
```
Can you create a purchase order?
Could you create a PO?
Would you create a purchase order?
Please create a purchase order
Please create a PO
Pls create PO
I want to create a purchase order
I want a PO
I need a purchase order
I need a PO
I'd like to create a PO
Let's create a purchase order
Let us create a PO
Help me create a purchase order
We need a purchase order
We want a PO
```

### With Parameters
```
PO with company ACS
PO for vendor
PO with default values
Purchase order with vendor
Purchase order for company
```

---

## 2. Create Goods Receipt

Creates a Goods Receipt for an existing Purchase Order. **Requires PO Number (10 digits starting with 45).**

### Basic Commands
```
Create goods receipt for PO 4500000130
Create goods for PO 4500000130
Create GR for PO 4500000130
Post goods receipt for 4500000130
Post goods for PO 4500000130
Post GR for 4500000130
Generate goods receipt for PO 4500000130
New goods receipt for 4500000130
```

### Action Commands
```
Run goods receipt for PO 4500000130
Run GR for 4500000130
Run goods for PO 4500000130
Execute goods receipt for PO 4500000130
Execute GR for 4500000130
Start goods receipt for PO 4500000130
Start GR for 4500000130
```

### Conversational Style
```
Can you create goods receipt for this PO 4500000130?
Could you post goods for PO 4500000130?
Please create goods receipt for PO 4500000130
Please post GR for 4500000130
I want to create goods receipt for PO 4500000130
I need goods receipt for 4500000130
I'd like to post goods for PO 4500000130
Help me create GR for PO 4500000130
Let's create goods receipt for 4500000130
```

### Reference Variations
```
Goods receipt for this PO 4500000130
Goods receipt with PO 4500000130
Goods receipt using PO 4500000130
Goods receipt against PO 4500000130
Goods for purchase order 4500000130
GR for purchase order 4500000130
GR with PO number 4500000130
```

### SAP Terminology
```
MIGO for PO 4500000130
Material receipt for PO 4500000130
Material document for 4500000130
Goods movement for PO 4500000130
GRN for PO 4500000130
Receive goods for PO 4500000130
```

---

## 3. Create Supplier Invoice

Creates a Supplier Invoice for an existing Purchase Order. **Requires PO Number (10 digits starting with 45).**

### Basic Commands
```
Create invoice for PO 4500000130
Create supplier invoice for 4500000130
Create vendor invoice for PO 4500000130
Generate invoice for PO 4500000130
Post invoice for 4500000130
New invoice for PO 4500000130
Make invoice for 4500000130
```

### Action Commands
```
Run invoice for PO 4500000130
Run invoice creation for 4500000130
Run supplier invoice for PO 4500000130
Execute invoice for PO 4500000130
Execute supplier invoice for 4500000130
Start invoice for PO 4500000130
Start invoice creation for 4500000130
```

### Conversational Style
```
Can you create an invoice for this PO 4500000130?
Could you create supplier invoice for PO 4500000130?
Please create invoice for PO 4500000130
Please generate invoice for 4500000130
I want to create an invoice for PO 4500000130
I need an invoice for 4500000130
I'd like to create invoice for PO 4500000130
Help me create invoice for 4500000130
Let's create an invoice for PO 4500000130
```

### Reference Variations
```
Invoice for this PO 4500000130
Invoice with PO 4500000130
Invoice using PO 4500000130
Invoice against PO 4500000130
Invoice linked to PO 4500000130
Supplier invoice for purchase order 4500000130
Vendor invoice with PO number 4500000130
```

---

## 4. Process Payment

Processes payment for an existing Supplier Invoice. **Requires Invoice Number (10 digits starting with 51).**

### Basic Commands
```
Create payment for invoice 5105600813
Make payment for invoice 5105600813
Process payment for 5105600813
Execute payment for invoice 5105600813
Pay invoice 5105600813
Pay for invoice 5105600813
Schedule payment for 5105600813
```

### Action Commands
```
Run payment for invoice 5105600813
Run payment process for 5105600813
Run payment flow for invoice 5105600813
Execute payment for 5105600813
Execute payment process for invoice 5105600813
Start payment for invoice 5105600813
Start payment process for 5105600813
```

### Conversational Style
```
Can you make payment for this invoice 5105600813?
Could you process payment for invoice 5105600813?
Please create payment for invoice 5105600813
Please process payment for 5105600813
I want to pay invoice 5105600813
I need to process payment for 5105600813
I'd like to make payment for invoice 5105600813
Help me pay invoice 5105600813
Let's process payment for 5105600813
```

### Reference Variations
```
Payment for this invoice 5105600813
Payment with invoice 5105600813
Payment using invoice 5105600813
Payment against invoice 5105600813
```

### SAP Terminology
```
Automatic payment for invoice 5105600813
Auto payment for 5105600813
F110 for invoice 5105600813
Vendor payment for 5105600813
Supplier payment for invoice 5105600813
```

---

## 5. Procure to Pay (End-to-End Flow)

Runs the complete procurement flow: PO -> Goods Receipt -> Invoice -> Payment. **No additional input required.**

### Direct Commands
```
P2P
P-P
P to P
Procure to pay
Procure-to-pay
Procedure to pay
Purchase to pay
Purchase-to-pay
Purchase to payment
```

### Flow/Process Commands
```
Full flow
Complete flow
Entire flow
Whole flow
Full process
Complete process
Entire process
Whole process
End to end
End-to-end
E2E
Full SAP flow
Complete SAP process
```

### Action Commands
```
Run P2P
Run procedure to pay
Run procure to pay
Run full flow
Run complete flow
Run entire flow
Run all
Run full
Execute P2P
Execute procure to pay
Execute full flow
Execute complete flow
Execute all
Execute full
Start P2P
Start full flow
Start complete process
```

### SAP Specific
```
Full SAP
Complete SAP
SAP flow
SAP automation
SAP process
Run SAP
Execute SAP
Procurement flow
Procurement process
Full P2P
Complete P2P
```

### Conversational Style
```
Can you run the full procedure to pay?
Could you execute P2P?
Please run procure to pay
Please execute the full flow
I want to run P2P
I need to run the complete flow
I'd like to execute procure to pay
Help me run the full SAP process
Let's run P2P
Let's execute the entire flow
```

---

## Supported Misspellings

The system handles common typos and misspellings:

### Purchase Order
```
purshase order, purchse order, puchase order
purchas order, purchese order, purhcase order
pruchase order, purchasing order, purchasng order
creat po, crate po, craete po
```

### Goods Receipt
```
goods reciept, goods recept, goods recipt
good receipt, good reciept, good recept
goods reciet, goods recipet, godds receipt
creat goods, crate goods, creat gr, crate gr
```

### Invoice
```
invocie, invioce, invoce, invice, inoice, incoice
suppliar invoice, suplier invoice, suppiler invoice
suppllier invoice, supplyer invoice, supp invoice
creat invoice, crate invoice, craete invoice
invoic for, invice for, invocie for
```

### Payment
```
payemnt, paymnt, paymet, paymnet, payement
payemnt for, paymnet for, paymet for, payement for
creat payment, crate payment, craete payment
```

---

## Data Flow Between Commands

```
Purchase Order ──────> Goods Receipt ──────> Supplier Invoice ──────> Payment
     │                      │                       │                    │
     ▼                      ▼                       ▼                    ▼
  PO Number          pOnumbergoods.csv        pOnumberinvoice.csv     Complete
  (4500xxxxxx)           logged               + invoiceno.csv
                                                  logged
```

---

## CSV Tracking Files

| File | Location | Columns | Purpose |
|------|----------|---------|---------|
| `pOnumbergoods.csv` | utils/ | PO_Number, Timestamp | Tracks Goods Receipts |
| `pOnumberinvoice.csv` | utils/ | PO_Number, Invoice_Number, Timestamp | Tracks Invoices |
| `invoiceno.csv` | utils/ | Invoice_Number, PO_Number, Timestamp | Invoice reference for payments |

---

## Running Tests via CLI

```bash
# Purchase Order (no env var needed)
npx playwright test tests/flows/PurchaseOrderFlow.spec.ts

# Goods Receipt (requires PO_NUMBER)
PO_NUMBER=4500000130 npx playwright test tests/flows/GoodsReceiptFlow.spec.ts

# Supplier Invoice (requires PO_NUMBER)
PO_NUMBER=4500000130 npx playwright test tests/flows/SupplierInvoiceFlow.spec.ts

# Payment (requires INVOICE_NUMBER)
INVOICE_NUMBER=5105600813 npx playwright test tests/flows/PaymentFlow.spec.ts

# Full P2P Flow (no env var needed)
npx playwright test tests/procureToPay.spec.ts
```

---

## API Usage

### Execute Command
```bash
# Purchase Order
curl -X POST http://localhost:3001/api/execute \
  -H "Content-Type: application/json" \
  -d '{"command": "Create a purchase order"}'

# Goods Receipt
curl -X POST http://localhost:3001/api/execute \
  -H "Content-Type: application/json" \
  -d '{"command": "Create goods receipt for PO 4500000130"}'

# Supplier Invoice
curl -X POST http://localhost:3001/api/execute \
  -H "Content-Type: application/json" \
  -d '{"command": "Create invoice for PO 4500000130"}'

# Payment
curl -X POST http://localhost:3001/api/execute \
  -H "Content-Type: application/json" \
  -d '{"command": "Process payment for invoice 5105600813"}'

# Full P2P
curl -X POST http://localhost:3001/api/execute \
  -H "Content-Type: application/json" \
  -d '{"command": "Run P2P"}'
```

### Get Available Commands
```bash
curl http://localhost:3001/api/commands
```

### Health Check
```bash
curl http://localhost:3001/api/health
```

---

## Error Messages

### Missing PO Number
```
ERROR: PO Number is required. Example: "Create goods for PO 4500001075"
ERROR: PO Number is required. Example: "Create invoice for PO 4500001075"
```

### Missing Invoice Number
```
ERROR: Invoice Number is required. Example: "Process payment for invoice 5105600001"
```

### Unknown Command
```
Unknown command. Try:
• "Create PO" or "Create purchase order"
• "Create goods for PO 4500001075" or "Post GR for PO 4500001075"
• "Create invoice for PO 4500001075"
• "Process payment for invoice 5105600001"
• "Run P2P" or "Procedure to pay"
```

---

## Recent Numbers Reference

Check CSV files for recently created PO and Invoice numbers:

```bash
# View recent Goods Receipts
type utils\pOnumbergoods.csv

# View recent Invoices
type utils\pOnumberinvoice.csv

# View Invoice numbers for payments
type utils\invoiceno.csv
```

---

**Last Updated**: 2026-01-23
