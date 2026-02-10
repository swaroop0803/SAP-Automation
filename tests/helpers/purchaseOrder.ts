
import { Page } from "@playwright/test";
import { openFioriApp } from "../../utils/Searching";
import { fillTextboxInSapFrame, getSapToday } from "../../utils/sapUtils";

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




// ============================================================
// DEFAULT VALUES - Change these values as needed
// ============================================================
const DEFAULTS = {
    SUPPLIER: '1',              // Supplier number
    MATERIAL: 'P-A2026-3',      // Material code
    QUANTITY: '1',              // PO Quantity
    PRICE: '1000',              // Net Price
    COMPANY_CODE: 'acs',        // Company Code
    PURCH_ORG: 'acs',           // Purchasing Organization
    PURCH_GROUP: 'acs',         // Purchasing Group
    PLANT: 'acs',               // Plant
    ACCOUNT_ASSIGNMENT: 'K',    // Account Assignment Category (K = Cost Center)
    ORDER_UNIT: 'EA',           // Order Unit
    GL_ACCOUNT: '610010',       // G/L Account
    CHART_OF_ACCOUNTS: 'acs',   // Chart of Accounts
};
// ============================================================

// Parameters interface for Purchase Order
export interface POParams {
    supplier?: string;
    material?: string;
    quantity?: string;
    price?: string;
    companyCode?: string;
    purchOrg?: string;
    purchGroup?: string;
    plant?: string;
    accountAssignment?: string;
    orderUnit?: string;
    glAccount?: string;
    chartOfAccounts?: string;
}

export async function Purchaseordercreation(page: Page, params?: POParams): Promise<string> {
    // Use provided params or defaults
    const supplier = params?.supplier || DEFAULTS.SUPPLIER;
    const material = params?.material || DEFAULTS.MATERIAL;
    const quantity = params?.quantity || DEFAULTS.QUANTITY;
    const price = params?.price || DEFAULTS.PRICE;
    const companyCode = params?.companyCode || DEFAULTS.COMPANY_CODE;
    const purchOrg = params?.purchOrg || DEFAULTS.PURCH_ORG;
    const purchGroup = params?.purchGroup || DEFAULTS.PURCH_GROUP;
    const plant = params?.plant || DEFAULTS.PLANT;
    const accountAssignment = params?.accountAssignment || DEFAULTS.ACCOUNT_ASSIGNMENT;
    const orderUnit = params?.orderUnit || DEFAULTS.ORDER_UNIT;
    const glAccount = params?.glAccount || DEFAULTS.GL_ACCOUNT;
    const chartOfAccounts = params?.chartOfAccounts || DEFAULTS.CHART_OF_ACCOUNTS;

    console.log(`Creating PO with: Supplier=${supplier}, Material=${material}, Quantity=${quantity}, Price=${price}`);
// navigating to purchase order
await openFioriApp(page,"create purchase order advanced","Create Purchase Order Advanced Tile")

// cattching the purchase oroder frame
  const app = page.frameLocator(
  'iframe[name="application-PurchaseOrder-create-iframe"]'
);

// filling the supplier field in purchase order
const supplierField = app.getByRole('textbox', { name: 'Supplier', exact: true });

await supplierField.waitFor({ state: 'visible', timeout: 30000 });
await supplierField.focus();

// Fill supplier directly with provided value (default: '1')
console.log('Filling Supplier directly with:', supplier);
await supplierField.fill(supplier);
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
console.log('Supplier filled directly');

// F4 value help logic - COMMENTED OUT (using direct fill instead)
// await page.keyboard.press('F4');
// await fillTextboxInSapFrame(app,"Company Code","acs")
// await page.keyboard.press('Enter');
// try {
//     const okButton = app.getByRole('button', { name: 'OK  Emphasized' });
//     await okButton.waitFor({ state: 'visible', timeout: 2000 });
//     await okButton.click();
//     console.log('OK Emphasized button clicked');
// } catch {
//     await page.keyboard.press('Enter');
// }

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


await  fillTextboxInSapFrame(app,"Purch. Org.", purchOrg)
await page.keyboard.press('Enter');


await fillTextboxInSapFrame(app,"Purch. Group", purchGroup)
await page.keyboard.press('Enter');

await fillTextboxInSapFrame(app,"Company Code", companyCode)
await page.keyboard.press('Enter');

await page.keyboard.press('Control+F5'); // to close header part




await page.keyboard.press('Control+F3'); // to open the item overview



 const acol = await app.getByRole('textbox', { name: 'A' }).nth(2)
// Account Assignment Category
await acol.focus()

await page.keyboard.type(accountAssignment);


// Material
const materialcol = await app.getByRole('textbox', { name: 'Material' }).first()
await materialcol.focus()
await materialcol.fill(material);


// PO Quantity
const POQantity = await app.getByRole('textbox', { name: 'PO Quantity' }).first()
await POQantity.focus()
await POQantity.fill(quantity);


// Order Unit
const OUhcol = await app.getByRole('textbox', { name: 'OUn' }).first()
await OUhcol.focus()
await OUhcol.fill(orderUnit);

// Delivery Date - not needed, automatically set to today's date
// const DDcol = await app.getByRole('textbox', { name: 'Deliv. Date' }).first()
// await DDcol.focus()
// await DDcol.fill(Today);


// Net Price
const NPcol = await app.getByRole('textbox', { name: 'Net Price' }).first()
await NPcol.focus()
await NPcol.fill(price);


// Plant
const plantcol = await app.getByRole('textbox', { name: 'Plant' }).first()
await plantcol.focus()
await plantcol.fill(plant);
await page.keyboard.press('Enter');
// await page.keyboard.press('Enter');

// in thte item overview
await app.getByRole('tab', { name: 'Account Assignment', exact: true }).click();

//  G/L  account in item detail
const GLaccount = app.getByRole('textbox', { name: 'G/L Account' });
await GLaccount.waitFor({ state: 'visible', timeout: 30000 });
await GLaccount.focus();
await page.keyboard.press('F4');

const chartOfAccountsField = app.getByRole('textbox', { name: 'Chart of Accounts' });
await chartOfAccountsField.waitFor({ state: 'visible', timeout: 30000 });
await chartOfAccountsField.focus();
await chartOfAccountsField.fill(chartOfAccounts);
await page.keyboard.press('Enter');

const findInput = app.getByRole('textbox', { name: 'Find expression' });
await findInput.waitFor({ state: 'visible', timeout: 30000 });
await findInput.fill(glAccount);
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
await fillTextboxInSapFrame(app,"Company Code", companyCode)

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

// Re-enter Net Price (OLD approach - commented out due to flaky span/input issue)
// const NPcol1 = app.getByRole('textbox', { name: 'Net Price' }).first();
// await NPcol1.focus();
// await NPcol1.fill(price);
// console.log('Net Price re-entered:', price);
// await page.keyboard.press('Enter');

// Re-enter Net Price (NEW approach - with fallback for SAP span elements)
const NPcol1 = app.getByRole('textbox', { name: 'Net Price' }).first();
try {
    await NPcol1.focus();
    await NPcol1.fill(price);
} catch {
    // Fallback: click + keyboard for span elements
    await NPcol1.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type(price);
}
console.log('Net Price re-entered:', price);
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

// Wait for success message to confirm PO is saved
console.log('Waiting for PO creation success message...');
const successMsg = app.locator('text=/Standard PO created under the number \\d+/').first();
await successMsg.waitFor({ state: 'visible', timeout: 30000 });
console.log('Success message visible - PO saved successfully');

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