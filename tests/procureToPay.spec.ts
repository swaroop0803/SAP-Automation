import { test } from '@playwright/test';
import { Login } from './Login';
import { Purchaseordercreation } from './purchaseOrder';
import { GoodsReceiptCreation } from './Goodsreceipt';
import { SupplierInvoiceCreation } from './SupplierInvoice';
import { Payment } from './Payment';

test('Complete Procure-to-Pay Flow', async ({ page }) => {
    // Step 1: Login
    await Login(page);

    // Step 2: Create Purchase Order → returns PO Number
    const poNumber = await Purchaseordercreation(page);
    console.log('✅ Purchase Order Created:', poNumber);

    // Step 3: Create Goods Receipt → uses PO Number
    await GoodsReceiptCreation(page, poNumber);
    console.log('✅ Goods Receipt Created');

    // Step 4: Create Supplier Invoice → uses PO Number, returns Invoice Number
    const invoiceDocNumber = await SupplierInvoiceCreation(page, poNumber);
    console.log('✅ Supplier Invoice Created:', invoiceDocNumber);

    // Step 5: Process Payment → uses Invoice Number
    await Payment(page, invoiceDocNumber);
    console.log('✅ Payment Completed');
});
