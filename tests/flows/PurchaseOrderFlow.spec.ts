import { test } from '@playwright/test';
import { Login } from '../Login';
import { Purchaseordercreation } from '../purchaseOrder';
import * as fs from 'fs';
import * as path from 'path';

test('Create Purchase Order and Save PO Number', async ({ page }) => {
    // Step 1: Login
    await Login(page);

    // Step 2: Create Purchase Order
    const poNumber = await Purchaseordercreation(page);
    console.log('Purchase Order Created:', poNumber);

    // Step 3: Save PO Number to CSV
    const csvPath = path.join(__dirname, '../../utils/purchaseorderno.csv');
    const timestamp = new Date().toISOString();
    const csvLine = `${poNumber},${timestamp}\n`;

    // Append to CSV file (creates if doesn't exist)
    fs.appendFileSync(csvPath, csvLine);
    console.log(`PO Number ${poNumber} saved to CSV`);
});
