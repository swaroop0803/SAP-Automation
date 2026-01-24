import { test, expect, Page } from '@playwright/test';
import { Login } from './Login';
import { openFioriApp } from '../utils/Searching';
import { clickSapButton, clickSapTab, fillSapTextbox, fillTextboxInSapFrame } from '../utils/sapUtils';

test('Purchase order', async ({ page }) => {
  await Login(page);





  
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

const Today = "23.01.2026"
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

// clicking on other Purchase Order button
const otherpurchaseorder = await app.getByRole('button', { name: 'Other Purchase Order' })
await otherpurchaseorder.click()

// getting the pur order number
const poField = app.getByRole('textbox', { name: 'Pur. Order' });

await poField.waitFor({ state: 'visible', timeout: 30000 });

const poNumber = await poField.inputValue();

console.log('PO Number:', poNumber);
await page.keyboard.press('Enter');






await page.waitForTimeout(1000)




// navigating to Post Goods Mobement 
await openFioriApp(page,'post goods movement','Post Goods Movement Tile')



const PO_IFRAME =
  'iframe[name="application-PurchaseOrder-create-iframe"]';

const GR_IFRAME =
  'iframe[name="application-Material-postGoodsMovementInWebGUI-iframe"]';

const SI_IFRAME = 
  'iframe[name="application-SupplierInvoice-createAdvanced-iframe"]'

const AP_IFRAME =
 'iframe[name="application-AutomaticPayment-schedule-iframe"]'

async function getActiveSapFrame(page: Page) {
  const frames = [
    PO_IFRAME,
    GR_IFRAME,
    SI_IFRAME,
    AP_IFRAME,
  ];

  for (const frameSelector of frames) {
    const count = await page.locator(frameSelector).count();

    if (count > 0) {
      console.log(`Using SAP frame: ${frameSelector}`);
      return page.frameLocator(frameSelector);
    }
  }

  throw new Error('No known SAP application iframe is active');
}

//  getting he ifram which is active
const crapp = await getActiveSapFrame(page);

// filling the poNumber copied from the purchase order into the field in goods receipt
await  fillTextboxInSapFrame(crapp,"Purchase Order",poNumber)


// Press Enter
await page.keyboard.press('Enter');


// clicking Item ok button
const itemOkCheckbox = crapp.getByRole('checkbox', {name: 'Item OK',});
await itemOkCheckbox.waitFor({ state: 'visible', timeout: 30000 });
// Click the checkbox
await itemOkCheckbox.check();

// clicking the post buttton
await crapp.getByRole('button', { name: /Post/i }).click()








await page.waitForTimeout(2000)







// opening the supplier invoice 
await openFioriApp(
  page,
  'create supplier invoice advanced',
  'Create Supplier Invoice Advanced Tile'
);

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

// filling the po number in the supplier tto get the details
await  fillTextboxInSapFrame(crapp,"Purchasing Document",poNumber)
await page.keyboard.press('Enter')
await page.waitForTimeout(2000)


// const balanceInput = crapp.getByRole('textbox', {
//   name: 'Balance',
//   exact: true,
// });

// await balanceInput.waitFor({ state: 'visible', timeout: 30000 });
// await expect(balanceInput).toHaveValue(/1000/i);

// locator('iframe[name="application-SupplierInvoice-createAdvanced-iframe"]').contentFrame().getByTitle('Amount in document currency', { exact: true })
// await fillTextboxInSapFrame(crapp,"Amount in document currency","1000")
// await page.locator('iframe[name="application-SupplierInvoice-createAdvanced-iframe"]').contentFrame().getByRole('textbox', { name: 'Amount', exact: true }).click();

// await page.locator('iframe[name="application-SupplierInvoice-createAdvanced-iframe"]').contentFrame().getByRole('textbox', { name: 'Amount', exact: true }).click();
// await page.locator('iframe[name="application-SupplierInvoice-createAdva?nced-iframe"]').contentFrame().getByRole('textbox', { name: 'Purchasing Document' }).click();
await fillSapTextbox(crapp,page,"Amount","1000")
await page.waitForTimeout(1000)
await page.keyboard.press('Enter')

await page.waitForTimeout(1000)
// clicking on payments tab
const paymentTab = crapp
  .getByRole('tab', { name: 'Payment' });

await paymentTab.waitFor({ state: 'visible', timeout: 30000 });
await paymentTab.click();

await page.waitForTimeout(1000)
// locator('iframe[name="application-SupplierInvoice-createAdvanced-iframe"]').contentFrame().getByRole('textbox', { name: 'BaselineDt' })
await fillTextboxInSapFrame(crapp,"BaselineDt",Today)
await page.waitForTimeout(1000)
await page.keyboard.press('Enter')

// locator('iframe[name="application-SupplierInvoice-createAdvanced-iframe"]').contentFrame().getByRole('button', { name: 'Post  Emphasized' })
await crapp.getByRole('button', { name: /Post/i }).click()


// locator('iframe[name="application-SupplierInvoice-createAdvanced-iframe"]').contentFrame().getByRole('button', { name: 'Other Invoice Document' })
await crapp.getByRole('button', { name: "Other Invoice Document" }).click()
const btn = crapp
  .locator('div[role="button"]')
  .filter({ hasText: 'Other Invoice Document' })
  .first();

await btn.waitFor({ state: 'visible', timeout: 30000 });
await btn.click();









// Fill invoice details first - the button might only work after posting
// const poNumber = "4500001069"; // Use a known PO number for testing

// filling the po number in the supplier to get the details
const invoiceDocField = crapp.getByRole('textbox', {
  name: 'Invoice Document No. Required',
});

await invoiceDocField.waitFor({ state: 'visible', timeout: 30000 });

const invoiceDocNumber = await invoiceDocField.inputValue();

console.log('Invoice Document Number:', invoiceDocNumber);

await page.keyboard.press('Enter')
await page.waitForTimeout(1000)
// await page.keyboard.press('Enter')


await page.waitForTimeout(1000)







// schedule Automatic Payements

await openFioriApp(page,"Schedule Automatic Payments","Schedule Automatic Payments Tile")
// locator('iframe[name="application-AutomaticPayment-schedule-iframe"]').contentFrame().getByRole('textbox', { name: 'Run Date Required' })

// await fillTextboxInSapFrame(crapp,"Run Date Required",Today)
await fillTextboxInSapFrame(crapp,"Run Date Required",Today)
// locator('iframe[name="application-AutomaticPayment-schedule-iframe"]').contentFrame().getByRole('textbox', { name: 'Identification Required' })
await fillTextboxInSapFrame(crapp,"Identification Required","AZD9")

// parameter tab
// locator('iframe[name="application-AutomaticPayment-schedule-iframe"]').contentFrame().getByRole('tablist').getByText('Parameter')
const parameterTab = crapp
  .getByRole('tablist')
  .getByText('Parameter', { exact: true });

await parameterTab.waitFor({ state: 'visible', timeout: 30000 });
await parameterTab.click();



//company code
// locator('iframe[name="application-AutomaticPayment-schedule-iframe"]').contentFrame().getByRole('textbox', { name: 'Company Codes' })
// await fillTextboxInSapFrame(crapp,"Company Codes","Acs")
await fillSapTextbox(crapp,page,"Company Codes","Acs",0)

// PMT Meters
// locator('iframe[name="application-AutomaticPayment-schedule-iframe"]').contentFrame().getByRole('textbox', { name: 'Pmt Meths' })
// await fillTextboxInSapFrame(crapp,"Pmt Meths","D")
await fillSapTextbox(crapp,page,"Pmt Meths","D",0)


// Next PstDate (tommorow)
// locator('iframe[name="application-AutomaticPayment-schedule-iframe"]').contentFrame().getByRole('textbox', { name: 'Next PstDate' })
// await fillTextboxInSapFrame(crapp,"Next PstDate","23.01.2026")
await fillSapTextbox(crapp,page,"Next PstDate","24.01.2026",0)

// suppliers (from)
// locator('iframe[name="application-AutomaticPayment-schedule-iframe"]').contentFrame().getByRole('textbox', { name: 'Supplier' })
await fillTextboxInSapFrame(crapp,"Supplier","1")

// supplies (to)
// locator('iframe[name="application-AutomaticPayment-schedule-iframe"]').contentFrame().getByRole('textbox', { name: 'to' }).nth(2)

  const textbox = crapp.getByRole('textbox', {
    name: "to",
  }).nth(2);
  await textbox.waitFor({ state: 'visible', timeout:3000 });
  await textbox.fill("1");


// free selection type
// locator('iframe[name="application-AutomaticPayment-schedule-iframe"]').contentFrame().getByRole('tablist').getByText('Free selection')
const FreeSelectionTab = crapp
  .getByRole('tablist')
  .getByText('Free selection', { exact: true });

await FreeSelectionTab.waitFor({ state: 'visible', timeout: 30000 });
await FreeSelectionTab.click();


//first field
// locator('iframe[name="application-AutomaticPayment-schedule-iframe"]').contentFrame().locator('#u90441').getByRole('textbox', { name: 'Field Name' })
// Field Name
const fieldName = crapp
  .getByRole('textbox', { name: 'Field Name' })
  .first();

await fieldName.waitFor({ state: 'visible' });
await fieldName.click();            // focus
await page.keyboard.press('F4');    // open value help
await page.keyboard.press('Enter'); // accept default

// copied ivoice id is pasted here
// locator('iframe[name="application-AutomaticPayment-schedule-iframe"]').contentFrame().locator('#u90444').getByRole('textbox', { name: 'Values' })
const valuesField = crapp
  .getByRole('textbox', { name: 'Values' })
  .first();

await valuesField.waitFor({ state: 'visible' });
await valuesField.click();
await page.keyboard.type(invoiceDocNumber);    // type value
// await ValuesTextbox.fill(invoiceDocNumber)

//Additional log tab
// locator('iframe[name="application-PurchaseOrder-create-iframe"]').contentFrame().getByRole('tablist').getByText('Status')
// locator('iframe[name="application-AutomaticPayment-schedule-iframe"]').contentFrame().getByRole('tablist').getByText('Additional Log')
await clickSapTab(crapp,"Additional Log")

//  due date check box
// locator('iframe[name="application-AutomaticPayment-schedule-iframe"]').contentFrame().getByRole('checkbox', { name: 'Due Date Check' })
const dueDateCheckbox = crapp.getByRole('checkbox', {
  name: 'Due Date Check',
  exact: true,
});

await dueDateCheckbox.waitFor({ state: 'visible', timeout: 30000 });
await dueDateCheckbox.check(); // or .click()

// payment method selection
// locator('iframe[name="application-AutomaticPayment-schedule-iframe"]').contentFrame().getByRole('checkbox', { name: 'Payment Method Selection in' })
const paymentMethodCheckbox = crapp.getByRole('checkbox', {
  name: 'Payment Method Selection in',
  // exact: true,
});

await paymentMethodCheckbox.waitFor({ state: 'visible', timeout: 30000 });
await paymentMethodCheckbox.check();

// vensor from
// locator('iframe[name="application-AutomaticPayment-schedule-iframe"]').contentFrame().getByRole('textbox', { name: 'Vendors From' }).first()
// const vendorsFrom = crapp
//   .getByRole('textbox', { name: 'Vendors From' })
//   .first();

// await vendorsFrom.waitFor({ state: 'visible', timeout: 30000 });
// await vendorsFrom.fill('1');
await fillSapTextbox(crapp,page,"Vendors From","1",0)


//vendor to
// locator('iframe[name="application-AutomaticPayment-schedule-iframe"]').contentFrame().getByRole('textbox', { name: 'Vendors To' }).first()
// const vendorsTo = crapp
//   .getByRole('textbox', { name: 'Vendors From' })
//   .nth(1);

// await vendorsTo.waitFor({ state: 'visible', timeout: 30000 });
// await vendorsTo.fill('1');
await fillSapTextbox(crapp,page,"Vendors To","1",0)


//save parameters button
// locator('iframe[name="application-AutomaticPayment-schedule-iframe"]').contentFrame().getByRole('button', { name: 'Save Parameters  Emphasized' })
const saveParametersBtn = crapp.getByRole('button', {
  name: /Save Parameters/,
});

await saveParametersBtn.waitFor({ state: 'visible', timeout: 30000 });
await saveParametersBtn.click();


await clickSapTab(crapp,"Status")



// locator('iframe[name="application-AutomaticPayment-schedule-iframe"]').contentFrame().getByRole('button', { name: 'Status' })
await clickSapButton(crapp,"Proposal");
// locator('iframe[name="application-PurchaseOrder-create-iframe"]').contentFrame().getByRole('button', { name: 'Proposal' })
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
await clickSapButton(crapp,"Schedule")

await clickSapButton(crapp,"Status")
// Check if "Payment run" button is visible after clicking Status
const paymentRunButton = crapp.getByRole('button', { name: /Payment run/i });

try {
  await paymentRunButton.waitFor({ state: 'visible', timeout: 2000 });
  console.log('Payment run button is visible');
} catch {
  console.log('Payment run button not visible, clicking Status again');
  await clickSapButton(crapp,"Status")
  await paymentRunButton.waitFor({ state: 'visible', timeout: 30000 });
}

// Click Payment run button
await clickSapButton(crapp,"Payment run")

const paymentRunstartImmediatelyCheckbox = crapp.getByRole('checkbox', {
  name: 'Start Immediately',
  exact: true,
});

await paymentRunstartImmediatelyCheckbox.waitFor({
  state: 'visible',
  timeout: 30000,
});

// ✅ Check only if NOT already checked
if (!(await paymentRunstartImmediatelyCheckbox.isChecked())) {
  await paymentRunstartImmediatelyCheckbox.check();
}

await clickSapButton(crapp,"Schedule")

await clickSapButton(crapp,"Status")

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

});



