
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




export async function Purchaseordercreation(page:Page): Promise<string> {
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
await page.keyboard.press('Enter');

await page.keyboard.press('Control+F2'); // to open header part
 
await app.getByRole('tab', { name: 'Org. Data', exact: true }).click(); // to open the org data tab if nott opened


await  fillTextboxInSapFrame(app,"Purch. Org.","acs")
await page.keyboard.press('Enter'); 


await fillTextboxInSapFrame(app,"Purch. Group","acs")
await page.keyboard.press('Enter');

// const companyCode1 = app.getByRole('textbox', { name: 'Company Code', exact: true });
// await companyCode1.focus();
// await page.keyboard.type('acs');
// await page.keyboard.press('Enter');

await page.keyboard.press('Control+F5'); // to close header part




await page.keyboard.press('Control+F3'); // to open the item overview



 const acol = await app.getByRole('textbox', { name: 'A' }).nth(2).click();
// A = K
await page.keyboard.type('K');


// Material = P-A2026-3
const materialcol = await app.getByRole('textbox', { name: 'Material' }).first()
await materialcol.focus()
await materialcol.fill('P-A2026-3');


// PO Quantity = 1
const POQantity = await app.getByRole('textbox', { name: 'PO Quantity' }).first()
await POQantity.focus()
await POQantity.fill('1');


// OUn = EA
const OUhcol = await app.getByRole('textbox', { name: 'OUn' }).first()
await OUhcol.focus()
await OUhcol.fill('EA');

const Today = getSapToday();
// Delivery Date = Today
const DDcol = await app.getByRole('textbox', { name: 'Deliv. Date' }).first()
await DDcol.focus()
await DDcol.fill(Today);


// Net Price = 1000
const NPcol = await app.getByRole('textbox', { name: 'Net Price' }).first()
await NPcol.focus()
await NPcol.fill('1000');


// Plant = acs
const plantcol = await app.getByRole('textbox', { name: 'Plant' }).first()
await plantcol.focus()
await plantcol.fill('acs');
await page.keyboard.press('Enter');
// await page.keyboard.press('Enter');

// in thte item overview
await app.getByRole('tab', { name: 'Account Assignment', exact: true }).click();

//  G/L  account in item detail
const GLaccount = await app.getByRole('textbox', { name: 'G/L Account' }).first()
await GLaccount.focus()
await GLaccount.waitFor({ state: 'visible', timeout: 30000 });
await GLaccount.fill("610010")
// await page.keyboard.press('F4');
await page.keyboard.press('Enter');
// await page.keyboard.press('Enter');
// await page.keyboard.press('Enter');

// const companycode2 = await app.getByRole('textbox', { name: 'Company Code' })
// await companycode2.focus()
// await companycode2.fill("acs")
// await page.keyboard.press('Enter');
// await page.keyboard.press('Enter');


// const findInput = app.locator('#txtFINDEXPR1');
// await findInput.waitFor({ state: 'visible' });
// await findInput.fill('');
// await page.keyboard.press('Enter');


// const costcenter = await app.getByRole('textbox', { name: 'Cost CenterCost CenterCO' }).first()
// await costcenter.focus()
// await costcenter.waitFor({ state: 'visible', timeout: 30000 });


// cost center in item Detail
await page.keyboard.press('F4');

// filling company code in cost center f4 menu
await fillTextboxInSapFrame(app,"Company Code","acs")

await page.keyboard.press('Enter');
await page.keyboard.press('Enter');
await page.keyboard.press('Enter')
await page.keyboard.press('Enter')

// saving
await page.keyboard.press('Control+S');
await page.keyboard.press('Enter');
await page.waitForTimeout(2000);

// clicking on other Purchase Order button to get the PO number
const otherpurchaseorder = app.getByRole('button', { name: 'Other Purchase Order' });
await otherpurchaseorder.click();

// getting the purchase order number
const poField = app.getByRole('textbox', { name: 'Pur. Order' });
await poField.waitFor({ state: 'visible', timeout: 30000 });
const poNumber = await poField.inputValue();

console.log('PO Number:', poNumber);
await page.keyboard.press('Enter');

await page.waitForTimeout(1000);

return poNumber;
}