import { test } from '@playwright/test';
import { Login } from '../helpers/Login';
import { Purchaseordercreation } from '../helpers/purchaseOrder';
import { GoodsReceiptCreation } from '../helpers/Goodsreceipt';
import { SupplierInvoiceCreation } from '../helpers/SupplierInvoice';
import { Payment } from '../helpers/Payment';
import { Logout } from '../helpers/Logout';
import * as fs from 'fs';
import * as path from 'path';

// Run with custom params: $env:PRICE="3000"; $env:QUANTITY="5"; $env:MATERIAL="P-A2026-3"; npx playwright test tests/procureToPay.spec.ts --headed

// Ensure SAP session is closed even if test fails
test.afterEach(async ({ page }) => {
    try { await Logout(page); } catch { console.log('Logout skipped (session may already be closed)'); }
});

test('Complete Procure-to-Pay Flow', async ({ page }) => {
    // Get parameters from environment variables (optional - uses defaults if not provided)
    const material = process.env.MATERIAL;
    const quantity = process.env.QUANTITY || '1';
    const price = process.env.PRICE || '1000';

    console.log('\n════════════════════════════════════════════════════════════');
    console.log('🚀 STARTING PROCEDURE-TO-PAY FLOW');
    console.log('════════════════════════════════════════════════════════════');
    console.log('📋 Parameters:');
    console.log(`   Material: ${material || 'P-A2026-3 (default)'}`);
    console.log(`   Quantity: ${quantity}`);
    console.log(`   Price: ${price}`);
    console.log('════════════════════════════════════════════════════════════\n');

    // Step 1: Login
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 STEP 1/7: LOGIN');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await Login(page);
    console.log('✅ STEP 1 COMPLETE: Login successful\n');

    // Step 2: Create Purchase Order with params → returns PO Number
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 STEP 2/7: CREATE PURCHASE ORDER');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const poNumber = await Purchaseordercreation(page, { material, quantity, price });
    console.log(`✅ STEP 2 COMPLETE: Purchase Order Created → PO Number: ${poNumber}\n`);

    // Step 3: Save PO Details to poDetails.csv for tracking
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 STEP 3/7: SAVE PO DETAILS TO CSV');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const poDetailsPath = path.join(__dirname, '../utils/poDetails.csv');
    const timestamp = new Date().toISOString();
    const actualMaterial = material || 'P-A2026-3';
    const poDetailsLine = `${poNumber},${actualMaterial},${quantity},${price},${timestamp}\n`;

    // Ensure header exists
    if (!fs.existsSync(poDetailsPath)) {
        fs.writeFileSync(poDetailsPath, 'PO_Number,Material,Quantity,Price,Timestamp\n');
    }
    fs.appendFileSync(poDetailsPath, poDetailsLine);
    console.log(`   Saved to: ${poDetailsPath}`);
    console.log(`   Data: PO=${poNumber}, Material=${actualMaterial}, Qty=${quantity}, Price=${price}`);
    console.log('✅ STEP 3 COMPLETE: PO Details saved\n');

    // Step 4: Create Goods Receipt → uses PO Number
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 STEP 4/7: CREATE GOODS RECEIPT');
    console.log(`   Using PO Number: ${poNumber}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const materialDocNumber = await GoodsReceiptCreation(page, poNumber);
    console.log(`✅ STEP 4 COMPLETE: Goods Receipt Created → Material Doc: ${materialDocNumber || 'N/A'}\n`);

    // Step 5: Calculate Invoice Amount = Price × Quantity
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 STEP 5/7: CALCULATE INVOICE AMOUNT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const invoiceAmount = (parseFloat(price) * parseFloat(quantity)).toString();
    console.log(`   Calculation: ${price} × ${quantity} = ${invoiceAmount}`);
    console.log(`✅ STEP 5 COMPLETE: Invoice Amount = ${invoiceAmount}\n`);

    // Step 6: Create Supplier Invoice → uses PO Number and calculated Amount
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 STEP 6/7: CREATE SUPPLIER INVOICE');
    console.log(`   Using PO Number: ${poNumber}`);
    console.log(`   Using Amount: ${invoiceAmount}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const invoiceDocNumber = await SupplierInvoiceCreation(page, poNumber, invoiceAmount);
    console.log(`✅ STEP 6 COMPLETE: Supplier Invoice Created → Invoice: ${invoiceDocNumber}\n`);

    // Step 7: Process Payment → uses Invoice Number
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 STEP 7/7: PROCESS PAYMENT');
    console.log(`   Using Invoice Number: ${invoiceDocNumber}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await Payment(page, invoiceDocNumber);
    console.log('✅ STEP 7 COMPLETE: Payment Processed\n');

    console.log('════════════════════════════════════════════════════════════');
    console.log('🎉 PROCURE-TO-PAY FLOW COMPLETED SUCCESSFULLY!');
    console.log('════════════════════════════════════════════════════════════');
    console.log('📋 Summary:');
    console.log(`   PO Number: ${poNumber}`);
    console.log(`   Material Doc: ${materialDocNumber || 'N/A'}`);
    console.log(`   Invoice: ${invoiceDocNumber}`);
    console.log(`   Total Amount: ${invoiceAmount}`);
    console.log('════════════════════════════════════════════════════════════\n');

});
