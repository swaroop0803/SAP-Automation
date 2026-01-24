import { Page } from '@playwright/test';

// ============ DATE UTILITIES ============

// SAP Timezone (IST - India Standard Time)
const SAP_TIMEZONE = 'Asia/Kolkata';

// Get date in specific timezone
function getDateInTimezone(timezone: string, daysOffset: number = 0): Date {
    const now = new Date();
    // Get the date string in the target timezone
    const dateStr = now.toLocaleString('en-US', { timeZone: timezone });
    const localDate = new Date(dateStr);
    // Add days offset
    localDate.setDate(localDate.getDate() + daysOffset);
    return localDate;
}

// Get today's date in SAP format (DD.MM.YYYY)
export function getSapToday(): string {
    const today = getDateInTimezone(SAP_TIMEZONE, 0);
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const result = `${day}.${month}.${year}`;
    console.log(`getSapToday() returning: ${result}`);
    return result;
}

// Get tomorrow's date in SAP format (DD.MM.YYYY)
export function getSapTomorrow(): string {
    const tomorrow = getDateInTimezone(SAP_TIMEZONE, 1);
    const day = String(tomorrow.getDate()).padStart(2, '0');
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const year = tomorrow.getFullYear();
    const result = `${day}.${month}.${year}`;
    console.log(`getSapTomorrow() returning: ${result}`);
    return result;
}

// Get date X days from today in SAP format (DD.MM.YYYY)
export function getSapDateFromToday(daysFromToday: number): string {
    const date = getDateInTimezone(SAP_TIMEZONE, daysFromToday);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

// ============ SAP UTILITIES ============

export async function waitForSAPIdle(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800); // UI5 render buffer
}





import { FrameLocator } from '@playwright/test';

export async function fillTextboxInSapFrame(
  frame: FrameLocator,
  fieldName: string,
  value: string,
  timeout = 30000
) {
  const textbox = frame.getByRole('textbox', {
    name: fieldName,
    exact: true,
  });
  await textbox.waitFor({ state: 'visible', timeout });
  await textbox.fill(value);

  console.log(`✅ Filled "${fieldName}"`);
}


export async function checkSapCheckbox(
  app: FrameLocator,
  label: string,
  timeout = 30000
) {
  const checkbox = app.getByRole('checkbox', {
    name: label,
    exact: true,
  });

  await checkbox.waitFor({ state: 'visible', timeout });
  await checkbox.check();
}
 
//it's usage
// await checkSapCheckbox(crapp, 'Due Date Check');
// await checkSapCheckbox(crapp, 'Payment Method Selection in');


// export async function fillSapTextbox(
//   app: FrameLocator,
//   label: string,
//   value: string,
//   index = 0,
//   timeout = 30000
// ) {
//   const textbox = app
//     .getByRole('textbox', { name: label })
//     .nth(index);

//   await textbox.waitFor({ state: 'visible', timeout });
//   await textbox.fill(value);
// }
export async function fillSapTextbox(
  app: FrameLocator,
  page: Page,
  label: string,
  value: string,
  index = 0,
  timeout = 30000
) {
  const field = app
    .getByRole('textbox', { name: label })
    .nth(index);

  await field.waitFor({ state: 'visible', timeout });
  await field.click();

  // SAP-safe clear
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');

  // Type value (SAP listens to keyboard events)
  await page.keyboard.type(value, { delay: 50 });
}

// it's usage
// await fillSapTextbox(crapp, 'Vendors From', '100000', 0);
// await fillSapTextbox(crapp, 'Vendors From', '200000', 1);


export async function clickSapButton(
  app: FrameLocator,
  buttonName: string,
  timeout = 30000
) {
  const button = app.getByRole('button', { name: new RegExp(buttonName) });
  await button.waitFor({ state: 'visible', timeout });
  await button.click();
}


// it's usage
// await clickSapButton(crapp, 'Save Parameters');



// export async function clickSapTab(
//   app: FrameLocator,
//   tabName: string,
//   timeout = 30000
// ) {
//   const tab = app
//     .getByRole('tablist')
//     .getByText(tabName, { exact: true });

//   await tab.waitFor({ state: 'visible', timeout });
//   await tab.click();

//   console.log(`✅ Clicked SAP tab: ${tabName}`);
// }


export async function clickSapTab(
  app: FrameLocator,
  tabName: string,
  timeout = 30000
) {
  const tab = app
    .getByRole('tab', { name: tabName, exact: true });

  await tab.waitFor({ state: 'visible', timeout });
  await tab.click();
}





// import { Page, FrameLocator } from '@playwright/test';

const SAP_IFRAMES = [
  'iframe[name="application-PurchaseOrder-create-iframe"]',
  'iframe[name="application-Material-postGoodsMovementInWebGUI-iframe"]',
  'iframe[name="application-SupplierInvoice-createAdvanced-iframe"]',
  'iframe[name="application-AutomaticPayment-schedule-iframe"]',
];

export async function getActiveSapFrame(
  page: Page,
  timeout = 30000
): Promise<FrameLocator> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    for (const frameSelector of SAP_IFRAMES) {
      if (await page.locator(frameSelector).count() > 0) {
        console.log(`Using SAP frame: ${frameSelector}`);
        return page.frameLocator(frameSelector);
      }
    }

    // small wait before retrying
    await page.waitForTimeout(500);
  }

  throw new Error('No known SAP application iframe is active');
}
