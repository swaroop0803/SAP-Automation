import { test } from '@playwright/test';
import { Login } from './Login';
import { Purchaseordercreation } from './purchaseOrder';
import { GoodsReceiptCreation } from './Goodsreceipt';
import { SupplierInvoiceCreation } from './SupplierInvoice';
import { Payment } from './Payment';
import * as fs from 'fs';
import * as path from 'path';

// Run with custom params: $env:PRICE="3000"; $env:QUANTITY="5"; $env:MATERIAL="P-A2026-3"; npx playwright test tests/procureToPay.spec.ts --headed

test('Complete Procure-to-Pay Flow', async ({ page }) => {
    // Get parameters from environment variables (optional - uses defaults if not provided)
    const material = process.env.MATERIAL;
    const quantity = process.env.QUANTITY || '1';
    const price = process.env.PRICE || '1000';

    console.log('P2P Parameters:', {
        material: material || 'default',
        quantity: quantity,
        price: price
    });

    // Step 1: Login
    await Login(page);

    // Step 2: Create Purchase Order with params → returns PO Number
    const poNumber = await Purchaseordercreation(page, { material, quantity, price });
    console.log('✅ Purchase Order Created:', poNumber);

    // Step 3: Save PO Details to poDetails.csv for tracking
    const poDetailsPath = path.join(__dirname, '../utils/poDetails.csv');
    const timestamp = new Date().toISOString();
    const actualMaterial = material || 'P-A2026-3';
    const poDetailsLine = `${poNumber},${actualMaterial},${quantity},${price},${timestamp}\n`;

    // Ensure header exists
    if (!fs.existsSync(poDetailsPath)) {
        fs.writeFileSync(poDetailsPath, 'PO_Number,Material,Quantity,Price,Timestamp\n');
    }
    fs.appendFileSync(poDetailsPath, poDetailsLine);
    console.log(`📊 PO Details saved: Material=${actualMaterial}, Qty=${quantity}, Price=${price}`);

    // Step 4: Create Goods Receipt → uses PO Number
    await GoodsReceiptCreation(page, poNumber);
    console.log('✅ Goods Receipt Created');

    // Step 5: Calculate Invoice Amount = Price × Quantity
    const invoiceAmount = (parseFloat(price) * parseFloat(quantity)).toString();
    console.log(`📊 Invoice Amount calculated: ${price} × ${quantity} = ${invoiceAmount}`);

    // Step 6: Create Supplier Invoice → uses PO Number and calculated Amount
    const invoiceDocNumber = await SupplierInvoiceCreation(page, poNumber, invoiceAmount);
    console.log('✅ Supplier Invoice Created:', invoiceDocNumber);

    // Step 7: Process Payment → uses Invoice Number
    await Payment(page, invoiceDocNumber);
    console.log('✅ Payment Completed');
});
