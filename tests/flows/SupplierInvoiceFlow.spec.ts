import { test } from '@playwright/test';
import { Login } from '../Login';
import { SupplierInvoiceCreation } from '../SupplierInvoice';
import * as fs from 'fs';
import * as path from 'path';

// PO Number will be passed from command line or environment variable
// Run with: PO_NUMBER=4500001075 npx playwright test tests/flows/SupplierInvoiceFlow.spec.ts

test('Create Supplier Invoice for existing PO', async ({ page }) => {
    // Get PO Number from environment variable
    const poNumber = process.env.PO_NUMBER;

    if (!poNumber) {
        throw new Error('PO_NUMBER is required. Run with: PO_NUMBER=4500001075 npx playwright test tests/flows/SupplierInvoiceFlow.spec.ts');
    }

    console.log('Using PO Number:', poNumber);

    // Step 1: Login
    await Login(page);

    // Step 2: Create Supplier Invoice using the provided PO Number
    const invoiceDocNumber = await SupplierInvoiceCreation(page, poNumber);
    console.log('Supplier Invoice Created:', invoiceDocNumber);

    // Step 3: Save Invoice Number to invoiceno.csv for payment reference
    const invoiceCsvPath = path.join(__dirname, '../../utils/invoiceno.csv');
    const timestamp = new Date().toISOString();
    const invoiceCsvLine = `${invoiceDocNumber},${poNumber},${timestamp}\n`;
    fs.appendFileSync(invoiceCsvPath, invoiceCsvLine);
    console.log(`Invoice Number ${invoiceDocNumber} saved to invoiceno.csv`);

    // Step 4: Append PO to pOnumberinvoice.csv after successful Supplier Invoice
    const poCsvPath = path.join(__dirname, '../../utils/pOnumberinvoice.csv');
    const poCsvLine = `${poNumber},${invoiceDocNumber},${timestamp}\n`;
    fs.appendFileSync(poCsvPath, poCsvLine);
    console.log(`PO ${poNumber} appended to pOnumberinvoice.csv`);
});
