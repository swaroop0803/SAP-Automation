import { test } from '@playwright/test';
import { Login } from '../helpers/Login';
import { Purchaseordercreation } from '../helpers/purchaseOrder';
import { Logout } from '../helpers/Logout';
import * as fs from 'fs';
import * as path from 'path';

// Run with custom params: $env:MATERIAL="P-A2026-3"; $env:QUANTITY="5"; $env:PRICE="3400"; npx playwright test tests/flows/PurchaseOrderFlow.spec.ts --headed

// Ensure SAP session is closed even if test fails
test.afterEach(async ({ page }) => {
    try { await Logout(page); } catch { console.log('Logout skipped (session may already be closed)'); }
});

test('Create Purchase Order and Save PO Number', async ({ page }) => {
    // Get parameters from environment variables (optional)
    const material = process.env.MATERIAL;
    const quantity = process.env.QUANTITY;
    const price = process.env.PRICE;

    console.log('PO Parameters:', { material: material || 'default', quantity: quantity || 'default', price: price || 'default' });

    // Step 1: Login
    await Login(page);

    // Step 2: Create Purchase Order with params
    const poNumber = await Purchaseordercreation(page, { material, quantity, price });
    console.log('Purchase Order Created:', poNumber);

    // Step 3: Save PO Number to CSV
    const csvPath = path.join(__dirname, '../../utils/purchaseorderno.csv');
    const timestamp = new Date().toISOString();
    const csvLine = `${poNumber},${timestamp}\n`;

    // Append to CSV file (creates if doesn't exist)
    fs.appendFileSync(csvPath, csvLine);
    console.log(`PO Number ${poNumber} saved to CSV`);

    // Step 4: Save PO Details to poDetails.csv for supplier invoice calculation
    const poDetailsPath = path.join(__dirname, '../../utils/poDetails.csv');
    const actualMaterial = material || 'P-A2026-3';
    const actualQuantity = quantity || '1';
    const actualPrice = price || '1000';
    const poDetailsLine = `${poNumber},${actualMaterial},${actualQuantity},${actualPrice},${timestamp}\n`;
    fs.appendFileSync(poDetailsPath, poDetailsLine);
    console.log(`PO Details saved: Material=${actualMaterial}, Qty=${actualQuantity}, Price=${actualPrice}`);

});
