import { Page } from "@playwright/test";
import { openFioriApp } from "../utils/Searching";
import { fillSapTextbox, fillTextboxInSapFrame, getActiveSapFrame, getSapToday } from "../utils/sapUtils";
import * as fs from 'fs';
import * as path from 'path';

// Helper function to get total amount (Price × Quantity) for a PO from bulk_po_results.csv
function getPOTotalAmountFromCSV(poNumber: string): string {
    try {
        const resultsPath = path.join(__dirname, '../utils/bulk_po_results.csv');

        if (!fs.existsSync(resultsPath)) {
            console.log('bulk_po_results.csv not found, using default price: 1000');
            return '1000';
        }

        const content = fs.readFileSync(resultsPath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());

        // Skip header, search for PO number
        // CSV format: PO_Number,Material,Quantity,Price,Timestamp
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const csvPONumber = values[0]; // PO_Number is first column
            const csvQuantity = values[2]; // Quantity is third column
            const csvPrice = values[3];     // Price is fourth column

            if (csvPONumber === poNumber) {
                const quantity = parseFloat(csvQuantity) || 1;
                const price = parseFloat(csvPrice) || 1000;
                const totalAmount = Math.round(quantity * price);
                console.log(`Found PO ${poNumber}: Quantity=${quantity}, Price=${price}, Total=${totalAmount}`);
                return totalAmount.toString();
            }
        }

        console.log(`PO ${poNumber} not found in CSV, using default price: 1000`);
        return '1000';
    } catch (error) {
        console.error('Error reading PO data:', error);
        return '1000';
    }
}

export async function SupplierInvoiceCreation(page: Page, poNumber: string, amount?: string): Promise<string> {
    // If amount not provided, calculate total from bulk_po_results.csv (Price × Quantity)
    const invoiceAmount = amount || getPOTotalAmountFromCSV(poNumber);
    console.log(`Using amount for PO ${poNumber}: ${invoiceAmount}`);

    // opening the supplier invoice
    await openFioriApp(
        page,
        'create supplier invoice advanced',
        'Create Supplier Invoice Advanced Tile'
    );

    const crapp = await getActiveSapFrame(page);

    // getting the company code
    const companycoderequired = crapp.getByRole('textbox', {
        name: 'Company Code Required',
        exact: true,
    });

    try {
        // wait up to 1 second for visibility
        await companycoderequired.waitFor({ state: 'visible', timeout: 1000 });

        // if visible, enter value
        await companycoderequired.fill('acs');
        await page.keyboard.press('Enter');

        console.log('Company code entered');
    } catch {
        // if not visible within 1 sec, skip
        console.log('The company code is already been entered');
    }

    // filling the po number in the supplier to get the details
    await fillTextboxInSapFrame(crapp, "Purchasing Document", poNumber);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // fill amount (from CSV lookup or provided parameter)
    await fillSapTextbox(crapp, page, "Amount", invoiceAmount);
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');

    await page.waitForTimeout(500);

    // clicking on payments tab
    const paymentTab = crapp.getByRole('tab', { name: 'Payment' });
    await paymentTab.waitFor({ state: 'visible', timeout: 30000 });
    await paymentTab.click();

    await page.waitForTimeout(500);

    // fill baseline date
    const Today = getSapToday();
    await fillTextboxInSapFrame(crapp, "BaselineDt", Today);
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // click post button - wait for it to be visible first
    console.log('Looking for Post button...');
    const postButton = crapp.getByRole('button', { name: 'Post  Emphasized' });
    await postButton.waitFor({ state: 'visible', timeout: 30000 });
    console.log('Post button found, clicking...');
    await postButton.click();
    console.log('Post button clicked');

    // Click Yes button after Post if dialog appears
    try {
        const yesButton = crapp.getByRole('button', { name: 'Yes', exact: true });
        await yesButton.waitFor({ state: 'visible', timeout: 3000 });
        await yesButton.click();
        console.log('Yes button clicked after Post');
    } catch {
        await page.keyboard.press('Enter');
        console.log('Enter pressed after Post (Yes button not found)');
    }

    // Match trail.spec.ts exactly - always click Other Invoice Document after Yes button
    console.log('Clicking Other Invoice Document button...');
    await crapp.getByRole('button', { name: "Other Invoice Document" }).click();

    const btn = crapp
        .locator('div[role="button"]')
        .filter({ hasText: 'Other Invoice Document' })
        .first();
    await btn.waitFor({ state: 'visible', timeout: 30000 });
    await btn.click();

    // Now get the invoice document number
    const invoiceDocField = crapp.getByRole('textbox', {
        name: 'Invoice Document No. Required',
    });

    await invoiceDocField.waitFor({ state: 'visible', timeout: 30000 });

    // Wait for invoice number to be populated (retry until value exists)
    let invoiceDocNumber = '';
    for (let i = 0; i < 30; i++) {
        invoiceDocNumber = await invoiceDocField.inputValue();
        if (invoiceDocNumber && invoiceDocNumber.trim() !== '') {
            break;
        }
        await page.waitForTimeout(500);
    }

    if (!invoiceDocNumber || invoiceDocNumber.trim() === '') {
        throw new Error('Invoice Document Number was not generated');
    }

    console.log('Invoice Document Number:', invoiceDocNumber);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    return invoiceDocNumber;
}
