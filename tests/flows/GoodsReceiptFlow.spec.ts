import { test } from '@playwright/test';
import { Login } from '../Login';
import { GoodsReceiptCreation } from '../Goodsreceipt';
import * as fs from 'fs';
import * as path from 'path';

// PO Number will be passed from command line or environment variable
// Run with: PO_NUMBER=4500001075 npx playwright test tests/flows/GoodsReceiptFlow.spec.ts

test('Create Goods Receipt for existing PO', async ({ page }) => {
    // Get PO Number from environment variable
    const poNumber = process.env.PO_NUMBER;

    if (!poNumber) {
        throw new Error('PO_NUMBER is required. Run with: PO_NUMBER=4500001075 npx playwright test tests/flows/GoodsReceiptFlow.spec.ts');
    }

    console.log('Using PO Number:', poNumber);

    // Step 1: Login
    await Login(page);

    // Step 2: Create Goods Receipt using the provided PO Number
    await GoodsReceiptCreation(page, poNumber);
    console.log('Goods Receipt Created for PO:', poNumber);

    // Step 3: Append PO to pOnumbergoods.csv after successful Goods Receipt
    const csvPath = path.join(__dirname, '../../utils/pOnumbergoods.csv');
    const timestamp = new Date().toISOString();
    const csvLine = `${poNumber},${timestamp}\n`;
    fs.appendFileSync(csvPath, csvLine);
    console.log(`PO ${poNumber} appended to pOnumbergoods.csv`);
});
