import { test } from '@playwright/test';
import { Login } from '../Login';
import { Payment } from '../Payment';

// Invoice Number will be passed from command line or environment variable
// Run with: INVOICE_NUMBER=5105600001 npx playwright test src/flows/PaymentFlow.spec.ts

test('Process Payment for existing Invoice', async ({ page }) => {
    // Get Invoice Number from environment variable
    const invoiceDocNumber = process.env.INVOICE_NUMBER;

    if (!invoiceDocNumber) {
        throw new Error('INVOICE_NUMBER is required. Run with: INVOICE_NUMBER=5105600001 npx playwright test src/flows/PaymentFlow.spec.ts');
    }

    console.log('Using Invoice Number:', invoiceDocNumber);

    // Step 1: Login
    await Login(page);

    // Step 2: Process Payment using the provided Invoice Number
    await Payment(page, invoiceDocNumber);
    console.log('Payment Completed for Invoice:', invoiceDocNumber);
});
