import { Page } from "@playwright/test";
import { openFioriApp } from "../utils/Searching";
import { fillSapTextbox, fillTextboxInSapFrame, getActiveSapFrame, getSapToday } from "../utils/sapUtils";

// Parameters interface for Supplier Invoice
export interface SupplierInvoiceParams {
    poNumber: string;
    amount?: string; // Optional - defaults to 1000 if not provided
}

export async function SupplierInvoiceCreation(page: Page, poNumber: string, amount?: string): Promise<string> {
    // Use provided amount or default to 1000
    const invoiceAmount = amount || '1000';
    console.log(`Creating Supplier Invoice for PO ${poNumber} with Amount: ${invoiceAmount}`);

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
    // await page.waitForTimeout(500);  // Wait for SAP to load PO details
    // await page.keyboard.press('Enter');
    // await page.waitForTimeout(500);  // Wait for SAP to load PO details
    // await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);  // Wait for SAP to load PO details

    // fill amount (uses provided amount or defaults to 1000) - same as trail.spec.ts
    console.log(`📊 Filling Amount field with: ${invoiceAmount}`);
    await fillSapTextbox(crapp, page, "Amount", invoiceAmount);
    await page.waitForTimeout(1000);
    await page.keyboard.press('Enter');

    await page.waitForTimeout(1000);

    // clicking on payments tab
    const paymentTab = crapp.getByRole('tab', { name: 'Payment' });
    await paymentTab.waitFor({ state: 'visible', timeout: 30000 });
    await paymentTab.click();

    await page.waitForTimeout(1000);

    // fill baseline date
    const Today = getSapToday();
    await fillTextboxInSapFrame(crapp, "BaselineDt", Today);
    await page.waitForTimeout(1000);
    await page.keyboard.press('Enter');

    await page.waitForTimeout(500);

    // click post button
    await crapp.getByRole('button', { name: 'Post  Emphasized' }).click();

    // Click Yes button after Post if dialog appears
    try {
        const yesButtonExact = crapp.getByRole('button', { name: 'Yes', exact: true });
        await yesButtonExact.waitFor({ state: 'visible', timeout: 3000 });
        await yesButtonExact.click();
        console.log('Yes button clicked after Post');
    } catch {
        // Yes button not found, press Enter
        await page.keyboard.press('Enter');
        console.log('Enter pressed after Post (Yes button not found)');
    }

    await page.waitForTimeout(2000);

    // Capture Invoice Document Number from success message (same approach as Goods Receipt)
    let invoiceDocNumber = '';
    try {
        // Find the element containing "Document no. X created"
        const invoiceDocElement = crapp.locator('text=/Document no\\.\\s*\\d+\\s*created/i').first();
        await invoiceDocElement.waitFor({ state: 'visible', timeout: 30000 });

        const elementText = await invoiceDocElement.textContent();
        console.log('Found Invoice Document text:', elementText);

        // Extract document number using regex
        const match = elementText?.match(/Document no\.\s*(\d+)\s*created/i);
        if (match && match[1]) {
            invoiceDocNumber = match[1];
            console.log('Invoice Document Number:', invoiceDocNumber);
        } else {
            console.log('Could not extract Invoice Document Number from:', elementText);
        }
    } catch (error) {
        console.log('Error capturing Invoice Document Number:', error);
    }

    // OLD APPROACH - Click Other Invoice Document button and read from textbox
    // // Click Other Invoice Document button
    // await crapp.getByRole('button', { name: "Other Invoice Document" }).click();
    // await page.waitForTimeout(1000);
    //
    // // get invoice document number
    // const invoiceDocField = crapp.getByRole('textbox', {
    //     name: 'Invoice Document No. Required',
    // });
    //
    // await invoiceDocField.waitFor({ state: 'visible', timeout: 30000 });
    //
    // const invoiceDocNumber = await invoiceDocField.inputValue();
    //
    // console.log('Invoice Document Number:', invoiceDocNumber);
    //
    // await page.keyboard.press('Enter');
    // await page.waitForTimeout(1000);

    return invoiceDocNumber;
}
