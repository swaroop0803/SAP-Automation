import { Page } from "@playwright/test";
import { openFioriApp } from "../../utils/Searching";
import { fillSapTextbox, fillTextboxInSapFrame, getActiveSapFrame, getSapToday } from "../../utils/sapUtils";

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
    await page.waitForTimeout(1000); // Wait for page to fully load

    // Try to fill Purchasing Document with fallback
    try {
        await fillTextboxInSapFrame(crapp, "Purchasing Document", poNumber);
    } catch {
        // Fallback: try clicking and typing
        console.log('Fallback: Using click + type for Purchasing Document');
        const purchDocField = crapp.getByRole('textbox', { name: 'Purchasing Document' }).first();
        await purchDocField.click();
        await page.keyboard.press('Control+A');
        await page.keyboard.type(poNumber);
    }
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);

    // Check if Supplier Invoice has already been created (Balance = 0)
    try {
        const balanceField = crapp.getByRole('textbox', { name: 'Balance' });
        await balanceField.waitFor({ state: 'visible', timeout: 3000 });

        const balanceValue = await balanceField.inputValue();
        console.log('Balance field value:', balanceValue);

        // Check if balance is zero using regex (matches "0,00", "0.00", "0,00 ", etc.)
        const isZeroBalance = /^[\s]*0[,.]?0{0,2}[\s]*$/.test(balanceValue.trim());

        if (isZeroBalance) {
            throw new Error(`SUPPLIER_INVOICE_ALREADY_EXISTS: The Supplier Invoice has already been created for this PO (${poNumber}). Balance is zero. Please retry with a different Purchase Order.`);
        }
    } catch (error: any) {
        // Re-throw if it's our custom error
        if (error.message?.includes('SUPPLIER_INVOICE_ALREADY_EXISTS')) {
            throw error;
        }
        // Otherwise, balance field wasn't found or had issues - continue normally
        console.log('Balance check skipped or passed:', error.message);
    }

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

    // OLD APPROACH 1 - Capture Invoice Document Number from success message
    // let invoiceDocNumber = '';
    // try {
    //     // Find the element containing "Document no. X created"
    //     const invoiceDocElement = crapp.locator('text=/Document no\\.\\s*\\d+\\s*created/i').first();
    //     await invoiceDocElement.waitFor({ state: 'visible', timeout: 30000 });
    //
    //     const elementText = await invoiceDocElement.textContent();
    //     console.log('Found Invoice Document text:', elementText);
    //
    //     // Extract document number using regex
    //     const match = elementText?.match(/Document no\.\s*(\d+)\s*created/i);
    //     if (match && match[1]) {
    //         invoiceDocNumber = match[1];
    //         console.log('Invoice Document Number:', invoiceDocNumber);
    //     } else {
    //         console.log('Could not extract Invoice Document Number from:', elementText);
    //     }
    // } catch (error) {
    //     console.log('Error capturing Invoice Document Number:', error);
    // }

    // OLD APPROACH 2 - Click Other Invoice Document button and read from textbox
    // await crapp.getByRole('button', { name: "Other Invoice Document" }).click();
    // await page.waitForTimeout(1000);
    // const invoiceDocField = crapp.getByRole('textbox', {
    //     name: 'Invoice Document No. Required',
    // });
    // await invoiceDocField.waitFor({ state: 'visible', timeout: 30000 });
    // const invoiceDocNumber = await invoiceDocField.inputValue();
    // console.log('Invoice Document Number:', invoiceDocNumber);
    // await page.keyboard.press('Enter');
    // await page.waitForTimeout(1000);

    // NEW APPROACH - Navigate to Follow-On Documents to get the correct Invoice Number
    let invoiceDocNumber = '';
    const maxRetries = 3;

    // Step 1: Click "Other Invoice Document" button (with retry)
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const otherInvoiceBtn = crapp.getByRole('button', { name: 'Other Invoice Document' });
            await otherInvoiceBtn.waitFor({ state: 'visible', timeout: 10000 });
            await otherInvoiceBtn.click();
            console.log('Clicked Other Invoice Document button');
            await page.waitForTimeout(1000);
            break;
        } catch (error) {
            console.log(`Attempt ${attempt}/${maxRetries} failed for Other Invoice Document button`);
            if (attempt === maxRetries) throw error;
            await page.waitForTimeout(1000);
        }
    }

    // Step 2: Click "Continue" button (with retry)
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const continueBtn = crapp.getByRole('button', { name: 'Continue' });
            await continueBtn.waitFor({ state: 'visible', timeout: 10000 });
            await continueBtn.click();
            console.log('Clicked Continue button');
            await page.waitForTimeout(1000);
            break;
        } catch (error) {
            console.log(`Attempt ${attempt}/${maxRetries} failed for Continue button`);
            if (attempt === maxRetries) throw error;
            await page.waitForTimeout(1000);
        }
    }

    // Step 3: Click "Follow-On Documents" button (with retry)
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const followOnDocsBtn = crapp.getByRole('button', { name: 'Follow-On Documents' });
            await followOnDocsBtn.waitFor({ state: 'visible', timeout: 10000 });
            await followOnDocsBtn.click();
            console.log('Clicked Follow-On Documents button');
            await page.waitForTimeout(1000);
            break;
        } catch (error) {
            console.log(`Attempt ${attempt}/${maxRetries} failed for Follow-On Documents button`);
            if (attempt === maxRetries) throw error;
            await page.waitForTimeout(1000);
        }
    }

    // Step 4: Get the Document Number from the textbox (with retry)
    const docNumberField = crapp.getByRole('textbox', { name: 'Document Number' });
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await docNumberField.waitFor({ state: 'visible', timeout: 10000 });
            break;
        } catch (error) {
            console.log(`Attempt ${attempt}/${maxRetries} failed for Document Number field`);
            if (attempt === maxRetries) throw error;
            await page.waitForTimeout(1000);
        }
    }

    // Wait for value to be populated
    for (let i = 0; i < 10; i++) {
        invoiceDocNumber = await docNumberField.inputValue();
        if (invoiceDocNumber && invoiceDocNumber.trim() !== '') {
            break;
        }
        await page.waitForTimeout(500);
    }

    console.log('Invoice Document Number:', invoiceDocNumber);

    // Close the dialog
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    return invoiceDocNumber;
}
