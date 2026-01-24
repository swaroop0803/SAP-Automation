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
    await page.waitForTimeout(2000);

    // fill amount
    await fillSapTextbox(crapp, page, "Amount", "1000");
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

    // click post button
    await crapp.getByRole('button', { name: /Post/i }).click();

    // click Other Invoice Document button
    await crapp.getByRole('button', { name: "Other Invoice Document" }).click();

    const btn = crapp
        .locator('div[role="button"]')
        .filter({ hasText: 'Other Invoice Document' })
        .first();

    await btn.waitFor({ state: 'visible', timeout: 30000 });
    await btn.click();

    // get invoice document number
    const invoiceDocField = crapp.getByRole('textbox', {
        name: 'Invoice Document No. Required',
    });

    await invoiceDocField.waitFor({ state: 'visible', timeout: 30000 });

    const invoiceDocNumber = await invoiceDocField.inputValue();

    console.log('Invoice Document Number:', invoiceDocNumber);

    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    return invoiceDocNumber;
}
