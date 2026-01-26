
import { Page } from "@playwright/test";
import { openFioriApp } from "../utils/Searching";
import { fillTextboxInSapFrame, getSapToday } from "../utils/sapUtils";

// import { test } from '@playwright/test';
// import { Login } from './Login';
// import { PurchaseOrderPage } from '../pages/PurchaseOrderPage';

// test('Create Purchase Order - SAP', async ({ page }) => {
//   await Login(page);

//   const poPage = new PurchaseOrderPage(page);

//   await poPage.searchAndOpenApp();
//   await poPage.fillHeaderData();
//   await poPage.fillItemOverview();
//   await poPage.fillAccountAssignment();
//   await poPage.saveAndValidate();
// });




// Parameters interface for Purchase Order
export interface POParams {
    material?: string;
    quantity?: string;
    price?: string;
}

export async function Purchaseordercreation(page: Page, params?: POParams): Promise<string> {
    // Use provided params or defaults
    const material = params?.material || 'P-A2026-3';
    const quantity = params?.quantity || '1';
    const price = params?.price || '1000';

    console.log(`Creating PO with: Material=${material}, Quantity=${quantity}, Price=${price}`);
// navigating to purchase order
await openFioriApp(page,"create purchase order advanced","Create Purchase Order Advanced Tile")

// cattching the purchase oroder frame
  const app = page.frameLocator(
  'iframe[name="application-PurchaseOrder-create-iframe"]'
);

// filling the supplier field in purchase order
  const supplier = app.getByRole('textbox', { name: 'Supplier', exact: true });

await supplier.waitFor({ state: 'visible', timeout: 30000 });
await supplier.focus();

// Open value help (SAP-correct)
await page.keyboard.press('F4');


//filling the company code  in  supplier
await  fillTextboxInSapFrame(app,"Company Code","acs")


await page.keyboard.press('Enter');

// Click OK Emphasized button if visible
try {
    const okButton = app.getByRole('button', { name: 'OK  Emphasized' });
    await okButton.waitFor({ state: 'visible', timeout: 2000 });
    await okButton.click();
    console.log('OK Emphasized button clicked');
} catch {
    // Button not visible, continue
    await page.keyboard.press('Enter');
}

// Fill Document Date with today's date
const Today = getSapToday();
const docDateField = app.getByRole('textbox', { name: 'Doc. Date' });
await docDateField.waitFor({ state: 'visible', timeout: 30000 });
await docDateField.focus();
await docDateField.clear();
await docDateField.fill(Today);
console.log('Doc. Date filled with:', Today);

await page.keyboard.press('Control+F2'); // to open header part
 
await app.getByRole('tab', { name: 'Org. Data', exact: true }).click(); // to open the org data tab if nott opened


await  fillTextboxInSapFrame(app,"Purch. Org.","acs")
await page.keyboard.press('Enter'); 


await fillTextboxInSapFrame(app,"Purch. Group","acs")
await page.keyboard.press('Enter');

await fillTextboxInSapFrame(app,"Company Code","acs")
await page.keyboard.press('Enter');

await page.keyboard.press('Control+F5'); // to close header part




await page.keyboard.press('Control+F3'); // to open the item overview



 const acol = await app.getByRole('textbox', { name: 'A' }).nth(2).click();
// A = K
await page.keyboard.type('K');


// Material
const materialcol = await app.getByRole('textbox', { name: 'Material' }).first()
await materialcol.focus()
await materialcol.fill(material);


// PO Quantity
const POQantity = await app.getByRole('textbox', { name: 'PO Quantity' }).first()
await POQantity.focus()
await POQantity.fill(quantity);


// OUn = EA
const OUhcol = await app.getByRole('textbox', { name: 'OUn' }).first()
await OUhcol.focus()
await OUhcol.fill('EA');

// Delivery Date - not needed, automatically set to today's date
// const DDcol = await app.getByRole('textbox', { name: 'Deliv. Date' }).first()
// await DDcol.focus()
// await DDcol.fill(Today);


// Net Price
const NPcol = await app.getByRole('textbox', { name: 'Net Price' }).first()
await NPcol.focus()
await NPcol.fill(price);


// Plant = acs
const plantcol = await app.getByRole('textbox', { name: 'Plant' }).first()
await plantcol.focus()
await plantcol.fill('acs');
await page.keyboard.press('Enter');
// await page.keyboard.press('Enter');

// in thte item overview
await app.getByRole('tab', { name: 'Account Assignment', exact: true }).click();

//  G/L  account in item detail
const GLaccount = app.getByRole('textbox', { name: 'G/L Account' });
await GLaccount.waitFor({ state: 'visible', timeout: 30000 });
await GLaccount.focus();
await page.keyboard.press('F4');

const chartOfAccounts = app.getByRole('textbox', { name: 'Chart of Accounts' });
await chartOfAccounts.waitFor({ state: 'visible', timeout: 30000 });
await chartOfAccounts.focus();
await chartOfAccounts.fill("acs");
await page.keyboard.press('Enter');

const findInput = app.getByRole('textbox', { name: 'Find expression' });
await findInput.waitFor({ state: 'visible', timeout: 30000 });
await findInput.fill('610010');
await page.keyboard.press('Enter');

// Click OK Emphasized button after G/L Account search
try {
    const okButtonGL = app.getByRole('button', { name: 'OK  Emphasized' });
    await okButtonGL.waitFor({ state: 'visible', timeout: 2000 });
    await okButtonGL.click();
    console.log('OK Emphasized button clicked for G/L Account');
} catch {
    await page.keyboard.press('Enter');
}

// cost center in item Detail
const costCenter = app.getByRole('textbox', { name: 'Cost Center' });
await costCenter.waitFor({ state: 'visible', timeout: 30000 });
await costCenter.focus();
await page.keyboard.press('F4');

// filling company code in cost center f4 menu
await fillTextboxInSapFrame(app,"Company Code","acs")

await page.keyboard.press('Enter');

// Click OK Emphasized button in cost center F4 menu
try {
    const okButton = app.getByRole('button', { name: 'OK  Emphasized' });
    await okButton.waitFor({ state: 'visible', timeout: 2000 });
    await okButton.click();
    console.log('OK Emphasized button clicked in cost center');
} catch {
    await page.keyboard.press('Enter');
}

await page.keyboard.press('Enter');
await page.keyboard.press('Enter');

// Re-enter Net Price (SAP may show it as span, so click and use keyboard)
try {
    const NPcol1 = app.getByRole('textbox', { name: 'Net Price' }).first();
    await NPcol1.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type(price);
    console.log('Net Price re-entered:', price);
} catch {
    console.log('Net Price field not editable, skipping re-entry');
}
await page.keyboard.press('Enter');

// saving
await page.waitForTimeout(1000);
await page.keyboard.press('Control+S');
console.log('Control+S pressed for save');

// Click Save button in dialog
const saveDialogBtn = app.getByRole('button', { name: 'Save', exact: true });
await saveDialogBtn.waitFor({ state: 'visible', timeout: 30000 });
await saveDialogBtn.click();
console.log('Save dialog button clicked');

await page.waitForTimeout(1000);

// clicking on other Purchase Order button to get the PO number
const otherpurchaseorder = app.getByRole('button', { name: 'Other Purchase Order' });
await otherpurchaseorder.waitFor({ state: 'visible', timeout: 30000 });
await otherpurchaseorder.click();

// getting the purchase order number
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

console.log('PO Number:', poNumber);
await page.keyboard.press('Enter');

return poNumber;
}