import { Page } from "@playwright/test";
import { openFioriApp } from "../utils/Searching";
import { fillSapTextbox, fillTextboxInSapFrame, getActiveSapFrame, getSapToday } from "../utils/sapUtils";

export async function SupplierInvoiceCreation(page: Page, poNumber: string): Promise<string> {

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

    // fill amount
    await fillSapTextbox(crapp, page, "Amount", "1000");
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
