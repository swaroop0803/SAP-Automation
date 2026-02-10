import { test } from '@playwright/test';
import { Login } from '../helpers/Login';
import { SupplierInvoiceCreation } from '../helpers/SupplierInvoice';
import { Logout } from '../helpers/Logout';
import * as fs from 'fs';
import * as path from 'path';

// Auto-calculate amount from poDetails.csv
function calculateAmountFromCSV(poNumber: string): string | null {
    const poDetailsPath = path.join(__dirname, '../../utils/poDetails.csv');

    if (!fs.existsSync(poDetailsPath)) {
        console.log('poDetails.csv not found');
        return null;
    }

    const csvData = fs.readFileSync(poDetailsPath, 'utf-8');
    const lines = csvData.split('\n').filter(line => line.trim());

    // Skip header, find PO
    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts[0]?.trim() === poNumber) {
            const quantity = parseFloat(parts[2]?.trim()) || 1;
            const price = parseFloat(parts[3]?.trim()) || 1000;
            const amount = Math.round(quantity * price);
            console.log(`📊 Auto-calculated: ${quantity} × ${price} = ${amount}`);
            return String(amount);
        }
    }

    console.log(`PO ${poNumber} not found in poDetails.csv`);
    return null;
}

// PO Number will be passed from command line - Amount is auto-calculated from poDetails.csv
// Run with: PO_NUMBER=4500001075 npx playwright test tests/flows/SupplierInvoiceFlow.spec.ts

// Ensure SAP session is closed even if test fails
test.afterEach(async ({ page }) => {
    try { await Logout(page); } catch { console.log('Logout skipped (session may already be closed)'); }
});

test('Create Supplier Invoice for existing PO', async ({ page }) => {
    // Get PO Number from environment variable
    const poNumber = process.env.PO_NUMBER;

    // Auto-calculate amount from poDetails.csv if not provided
    let amount = process.env.AMOUNT;
    if (!amount && poNumber) {
        amount = calculateAmountFromCSV(poNumber) || undefined;
    }

    if (!poNumber) {
        throw new Error('PO_NUMBER is required. Run with: PO_NUMBER=4500001075 npx playwright test tests/flows/SupplierInvoiceFlow.spec.ts');
    }

    console.log('Using PO Number:', poNumber);
    console.log('Using Amount:', amount || 'default (1000)');

    // Step 1: Login
    await Login(page);

    // Step 2: Create Supplier Invoice using the provided PO Number and Amount
    const invoiceDocNumber = await SupplierInvoiceCreation(page, poNumber, amount);
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
