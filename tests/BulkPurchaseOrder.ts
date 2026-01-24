import { Page } from "@playwright/test";
import { openFioriApp } from "../utils/Searching";
import { fillTextboxInSapFrame, getSapToday } from "../utils/sapUtils";

// PO Parameters interface for bulk creation
export interface POParameters {
    supplier?: string;          // Supplier number
    documentDate?: string;      // Default: today (DD.MM.YYYY format)
    purchaseOrg?: string;       // Default: ACS
    purchaseGroup?: string;     // Default: ACS
    companyCode?: string;       // Default: ACS
    accountAssignment?: string; // Default: K
    material?: string;          // Default: P-A2026-3
    quantity?: string;          // Default: 1
    unit?: string;              // Default: EA
    price?: string;             // Default: 1000
    plant?: string;             // Default: ACS
    glAccount?: string;         // Default: 610010
    costCenter?: string;        // Default: ACSC110
}

// Default parameters
const defaultParams: POParameters = {
    supplier: '', // Will use F4 value help if empty
    documentDate: '', // Will use getSapToday() if empty
    purchaseOrg: 'ACS',
    purchaseGroup: 'ACS',
    companyCode: 'ACS',
    accountAssignment: 'K',
    material: 'P-A2026-3',
    quantity: '1',
    unit: 'EA',
    price: '1000',
    plant: 'ACS',
    glAccount: '610010',
    costCenter: 'ACSC110'
};

export async function BulkPurchaseOrderCreation(page: Page, params?: POParameters): Promise<string> {
    // Merge provided params with defaults
    const p = { ...defaultParams, ...params };

    console.log('Creating PO with parameters:', p);

    // Navigate to purchase order app
    await openFioriApp(page, "create purchase order advanced", "Create Purchase Order Advanced Tile");

    // catching the purchase order frame
    const app = page.frameLocator(
        'iframe[name="application-PurchaseOrder-create-iframe"]'
    );

    // filling the supplier field in purchase order
    console.log('Step 1: Waiting for Supplier field...');
    const supplier = app.getByRole('textbox', { name: 'Supplier', exact: true });
    await supplier.waitFor({ state: 'visible', timeout: 30000 });
    await supplier.focus();
    console.log('Step 1: Supplier field focused');

    // If supplier number is provided, fill it directly; otherwise use F4 value help
    if (p.supplier && p.supplier.trim() !== '') {
        console.log('Step 2: Filling Supplier directly with:', p.supplier);
        await supplier.fill(p.supplier);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        console.log('Step 2: Supplier filled directly');
    } else {
        // Open value help (SAP-correct)
        console.log('Step 2: Opening supplier value help (F4)...');
        await page.keyboard.press('F4');

        // Wait for value help popup to open
        await page.waitForTimeout(500);
        console.log('Step 2: Value help popup should be open');

        // filling the company code in supplier
        console.log('Step 3: Filling Company Code in supplier popup...');
        await fillTextboxInSapFrame(app, "Company Code", p.companyCode!);
        await page.keyboard.press('Enter');
        console.log('Step 3: Company Code filled');

        // Click OK Emphasized button if visible
        console.log('Step 4: Looking for OK button...');
        try {
            const okButton = app.getByRole('button', { name: 'OK  Emphasized' });
            await okButton.waitFor({ state: 'visible', timeout: 2000 });
            await okButton.click();
            console.log('Step 4: OK Emphasized button clicked');
        } catch {
            console.log('Step 4: OK button not found, pressing Enter');
            await page.keyboard.press('Enter');
        }
    }

    // Fill Document Date with provided date or today
    console.log('Step 5: Filling Document Date...');
    const docDate = p.documentDate || getSapToday();
    const docDateField = app.getByRole('textbox', { name: 'Doc. Date' });
    await docDateField.waitFor({ state: 'visible', timeout: 30000 });
    await docDateField.focus();
    await docDateField.clear();
    await docDateField.fill(docDate);
    console.log('Step 5: Doc. Date filled with:', docDate);

    console.log('Step 6: Opening header part (Ctrl+F2)...');
    await page.keyboard.press('Control+F2'); // to open header part
    await page.waitForTimeout(300);

    console.log('Step 6: Clicking Org. Data tab...');
    await app.getByRole('tab', { name: 'Org. Data', exact: true }).click();

    console.log('Step 7: Filling Purch. Org...');
    await fillTextboxInSapFrame(app, "Purch. Org.", p.purchaseOrg!);
    await page.keyboard.press('Enter');

    console.log('Step 7: Filling Purch. Group...');
    await fillTextboxInSapFrame(app, "Purch. Group", p.purchaseGroup!);
    await page.keyboard.press('Enter');

    console.log('Step 7: Filling Company Code in header...');
    await fillTextboxInSapFrame(app, "Company Code", p.companyCode!);
    await page.keyboard.press('Enter');
    console.log('Step 7: Header Org Data filled');

    console.log('Step 8: Closing header part (Ctrl+F5)...');
    await page.keyboard.press('Control+F5'); // to close header part
    await page.waitForTimeout(300);

    console.log('Step 9: Opening item overview (Ctrl+F3)...');
    await page.keyboard.press('Control+F3'); // to open the item overview
    await page.waitForTimeout(300);

    // Account Assignment (A column) = K or provided value
    console.log('Step 10: Filling item data - Account Assignment:', p.accountAssignment);
    const acol = app.getByRole('textbox', { name: 'A' }).nth(2);
    await acol.click();
    await page.keyboard.type(p.accountAssignment!);

    // Material
    console.log('Step 10: Filling Material:', p.material);
    const materialcol = app.getByRole('textbox', { name: 'Material' }).first();
    await materialcol.focus();
    await materialcol.fill(p.material!);

    // PO Quantity
    console.log('Step 10: Filling PO Quantity:', p.quantity);
    const POQantity = app.getByRole('textbox', { name: 'PO Quantity' }).first();
    await POQantity.focus();
    await POQantity.fill(p.quantity!);

    // Unit of measure (OUn)
    console.log('Step 10: Filling Unit:', p.unit);
    const OUhcol = app.getByRole('textbox', { name: 'OUn' }).first();
    await OUhcol.focus();
    await OUhcol.fill(p.unit!);

    // Delivery Date - use today's date
    const deliveryDate = getSapToday();
    console.log('Step 10: Filling Delivery Date:', deliveryDate);
    const DDcol = app.getByRole('textbox', { name: 'Deliv. Date' }).first();
    await DDcol.focus();
    await DDcol.fill(deliveryDate);

    // Net Price
    console.log('Step 10: Filling Net Price:', p.price);
    const NPcol = app.getByRole('textbox', { name: 'Net Price' }).first();
    await NPcol.focus();
    await NPcol.fill(p.price!);

    // Plant
    console.log('Step 10: Filling Plant:', p.plant);
    const plantcol = app.getByRole('textbox', { name: 'Plant' }).first();
    await plantcol.focus();
    await plantcol.fill(p.plant!);
    await page.keyboard.press('Enter');
    console.log('Step 10: Item overview data filled');

    // in the item overview
    console.log('Step 11: Clicking Account Assignment tab...');
    await app.getByRole('tab', { name: 'Account Assignment', exact: true }).click();

    // G/L account in item detail
    console.log('Step 12: Opening G/L Account value help (F4)...');
    const GLaccount = app.getByRole('textbox', { name: 'G/L Account' });
    await GLaccount.waitFor({ state: 'visible', timeout: 30000 });
    await GLaccount.focus();
    await page.keyboard.press('F4');

    // Wait for G/L Account value help popup to open
    await page.waitForTimeout(500);
    console.log('Step 12: G/L Account value help should be open');

    console.log('Step 13: Filling Chart of Accounts...');
    const chartOfAccounts = app.getByRole('textbox', { name: 'Chart of Accounts' });
    await chartOfAccounts.waitFor({ state: 'visible', timeout: 30000 });
    await chartOfAccounts.focus();
    await chartOfAccounts.fill(p.companyCode!);
    await page.keyboard.press('Enter');

    console.log('Step 13: Searching for G/L Account:', p.glAccount);
    const findInput = app.getByRole('textbox', { name: 'Find expression' });
    await findInput.waitFor({ state: 'visible', timeout: 30000 });
    await findInput.fill(p.glAccount!);
    await page.keyboard.press('Enter');

    // Click OK Emphasized button after G/L Account search
    console.log('Step 14: Looking for OK button after G/L Account search...');
    try {
        const okButtonGL = app.getByRole('button', { name: 'OK  Emphasized' });
        await okButtonGL.waitFor({ state: 'visible', timeout: 2000 });
        await okButtonGL.click();
        console.log('Step 14: OK Emphasized button clicked for G/L Account');
    } catch {
        console.log('Step 14: OK button not found, pressing Enter');
        await page.keyboard.press('Enter');
    }

    // Cost Center in item Detail - use F4 like working code
    console.log('Step 15: Opening Cost Center value help (F4)...');
    const costCenterField = app.getByRole('textbox', { name: 'Cost Center' });
    await costCenterField.waitFor({ state: 'visible', timeout: 30000 });
    await costCenterField.focus();
    await page.keyboard.press('F4');

    // Wait for Cost Center value help popup to open
    await page.waitForTimeout(500);

    // Fill Company Code in cost center F4 menu
    console.log('Step 15: Filling Company Code in Cost Center popup...');
    await fillTextboxInSapFrame(app, "Company Code", p.companyCode!);
    await page.keyboard.press('Enter');

    // Click OK Emphasized button in cost center F4 menu
    console.log('Step 16: Looking for OK button after Cost Center search...');
    try {
        const okButtonCC = app.getByRole('button', { name: 'OK  Emphasized' });
        await okButtonCC.waitFor({ state: 'visible', timeout: 2000 });
        await okButtonCC.click();
        console.log('Step 16: OK Emphasized button clicked for Cost Center');
    } catch {
        console.log('Step 16: OK button not found, pressing Enter');
        await page.keyboard.press('Enter');
    }

    console.log('Step 17: Pressing Enter to confirm...');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');

    // saving
    console.log('Step 18: Saving PO (Ctrl+S)...');
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+S');
    console.log('Step 18: Control+S pressed for save');

    // Click Save button in dialog
    console.log('Step 19: Waiting for Save dialog button...');
    const saveDialogBtn = app.getByRole('button', { name: 'Save', exact: true });
    await saveDialogBtn.waitFor({ state: 'visible', timeout: 30000 });
    await saveDialogBtn.click();
    console.log('Step 19: Save dialog button clicked');

    await page.waitForTimeout(500);

    // clicking on other Purchase Order button to get the PO number
    console.log('Step 20: Clicking Other Purchase Order button...');
    const otherpurchaseorder = app.getByRole('button', { name: 'Other Purchase Order' });
    await otherpurchaseorder.waitFor({ state: 'visible', timeout: 30000 });
    await otherpurchaseorder.click();

    // getting the purchase order number
    console.log('Step 21: Getting PO number...');
    const poField = app.getByRole('textbox', { name: 'Pur. Order' });
    await poField.waitFor({ state: 'visible', timeout: 30000 });

    // Wait for PO number to be populated (retry until value exists)
    let poNumber = '';
    for (let i = 0; i < 30; i++) {
        poNumber = await poField.inputValue();
        if (poNumber && poNumber.trim() !== '') {
            break;
        }
        await page.waitForTimeout(500);
    }

    if (!poNumber || poNumber.trim() === '') {
        throw new Error('PO Number was not generated');
    }

    console.log('Step 21: SUCCESS! PO Number:', poNumber);
    await page.keyboard.press('Enter');

    return poNumber;
}
