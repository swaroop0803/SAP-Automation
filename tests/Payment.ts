import { Page, expect } from "@playwright/test";
import { clickSapButton, clickSapTab, fillSapTextbox, fillTextboxInSapFrame, getActiveSapFrame, getSapToday, getSapTomorrow } from "../utils/sapUtils";
import { openFioriApp } from "../utils/Searching";

// Generate unique 4-character identification for payment run
function generateUniquePaymentId(): string {
    const timestamp = Date.now().toString(36).toUpperCase(); // Convert to base36
    // Take last 4 characters for uniqueness
    return timestamp.slice(-4).padStart(4, 'A');
}

export async function Payment(page: Page, invoiceDocNumber: string): Promise<void> {

    const Today = getSapToday();
    const Tomorrow = getSapTomorrow();
    const paymentId = generateUniquePaymentId();

    // schedule Automatic Payments
    await openFioriApp(page, "Schedule Automatic Payments", "Schedule Automatic Payments Tile");

    const crapp = await getActiveSapFrame(page);

    // fill run date
    await fillTextboxInSapFrame(crapp, "Run Date Required", Today);

    // fill identification (unique for each run)
    await fillTextboxInSapFrame(crapp, "Identification Required", paymentId);
    console.log('Payment Identification:', paymentId);

    // parameter tab
    const parameterTab = crapp
        .getByRole('tablist')
        .getByText('Parameter', { exact: true });

    await parameterTab.waitFor({ state: 'visible', timeout: 30000 });
    await parameterTab.click();

    // company code
    await fillSapTextbox(crapp, page, "Company Codes", "Acs", 0);

    // PMT Methods
    await fillSapTextbox(crapp, page, "Pmt Meths", "D", 0);

    // Next PstDate (tomorrow)
    await fillSapTextbox(crapp, page, "Next PstDate", Tomorrow, 0);

    // suppliers (from)
    await fillTextboxInSapFrame(crapp, "Supplier", "1");

    // suppliers (to)
    const textbox = crapp.getByRole('textbox', { name: "to" }).nth(2);
    await textbox.waitFor({ state: 'visible', timeout: 3000 });
    await textbox.fill("1");

    // free selection tab
    const FreeSelectionTab = crapp
        .getByRole('tablist')
        .getByText('Free selection', { exact: true });

    await FreeSelectionTab.waitFor({ state: 'visible', timeout: 30000 });
    await FreeSelectionTab.click();

    // Field Name
    const fieldName = crapp
        .getByRole('textbox', { name: 'Field Name' })
        .first();

    await fieldName.waitFor({ state: 'visible' });
    await fieldName.click();
    await page.keyboard.press('F4');

    // Click OK Emphasized or press Enter to accept default
    try {
        const okButtonF4 = crapp.getByRole('button', { name: 'OK  Emphasized' });
        await okButtonF4.waitFor({ state: 'visible', timeout: 2000 });
        await okButtonF4.click();
        console.log('OK Emphasized button clicked in F4 value help');
    } catch {
        await page.keyboard.press('Enter');
        console.log('Enter pressed to accept default');
    }

    // paste invoice document number here
    const valuesField = crapp
        .getByRole('textbox', { name: 'Values' })
        .first();

    await valuesField.waitFor({ state: 'visible' });
    await valuesField.click();
    await page.keyboard.type(invoiceDocNumber);

    // Additional log tab
    await clickSapTab(crapp, "Additional Log");

    // due date checkbox
    const dueDateCheckbox = crapp.getByRole('checkbox', {
        name: 'Due Date Check',
        exact: true,
    });

    await dueDateCheckbox.waitFor({ state: 'visible', timeout: 30000 });
    await dueDateCheckbox.check();

    // payment method selection checkbox
    const paymentMethodCheckbox = crapp.getByRole('checkbox', {
        name: 'Payment Method Selection in',
    });

    await paymentMethodCheckbox.waitFor({ state: 'visible', timeout: 30000 });
    await paymentMethodCheckbox.check();

    // vendors from
    await fillSapTextbox(crapp, page, "Vendors From", "1", 0);

    // vendors to
    await fillSapTextbox(crapp, page, "Vendors To", "1", 0);

    // save parameters button
    const saveParametersBtn = crapp.getByRole('button', {
        name: /Save Parameters/,
    });

    await saveParametersBtn.waitFor({ state: 'visible', timeout: 30000 });
    await saveParametersBtn.click();

    await clickSapTab(crapp, "Status");

    // Proposal
    await clickSapButton(crapp, "Proposal");

    const proposalstartImmediatelyCheckbox = crapp.getByRole('checkbox', {
        name: 'Start Immediately',
        exact: true,
    });

    await proposalstartImmediatelyCheckbox.waitFor({
        state: 'visible',
        timeout: 30000,
    });

    if (!(await proposalstartImmediatelyCheckbox.isChecked())) {
        await proposalstartImmediatelyCheckbox.check();
    }

    await clickSapButton(crapp, "Schedule");

    await clickSapButton(crapp, "Status");

    // Check if "Payment run" button is visible after clicking Status
    const paymentRunButton = crapp.getByRole('button', { name: /Payment run/i });

    try {
        await paymentRunButton.waitFor({ state: 'visible', timeout: 2000 });
        console.log('Payment run button is visible');
    } catch {
        console.log('Payment run button not visible, clicking Status again');
        await clickSapButton(crapp, "Status");
        await paymentRunButton.waitFor({ state: 'visible', timeout: 30000 });
    }

    // Click Payment run button
    await clickSapButton(crapp, "Payment run");

    const paymentRunstartImmediatelyCheckbox = crapp.getByRole('checkbox', {
        name: 'Start Immediately',
        exact: true,
    });

    await paymentRunstartImmediatelyCheckbox.waitFor({
        state: 'visible',
        timeout: 30000,
    });

    if (!(await paymentRunstartImmediatelyCheckbox.isChecked())) {
        await paymentRunstartImmediatelyCheckbox.check();
    }

    await clickSapButton(crapp, "Schedule");

    await clickSapButton(crapp, "Status");

    // Wait for payment run to complete - keep clicking Status while "Payment run is running" is visible
    for (let i = 0; i < 30; i++) {
        const runningText = crapp.getByText('Payment run is running');
        try {
            await runningText.waitFor({ state: 'visible', timeout: 2000 });
            console.log('Payment run is still running, clicking Status again...');
            await page.waitForTimeout(3000);
            await clickSapButton(crapp, "Status");
        } catch {
            // Text not visible means payment run is complete
            console.log('Payment run completed');
            break;
        }
    }

    // Verify expected messages
    const expectedMessages = [
        /Parameters have been entered/i,
        /Payment proposal has been/i,
        /Payment run has been carried/i,
    ];

    for (const message of expectedMessages) {
        await expect(
            crapp.getByText(message)
        ).toBeVisible({ timeout: 30000 });
    }
}
