// import { test, expect, Page } from '@playwright/test';

// export async function Login (page:Page){
// //   await page.goto(
// //     'https://kps4hana:44304/sap/bc/ui2/flp?sap-client=001&sap-language=EN#Shell-home'
// //   );
// //  await page.locator("#USERNAME_FIELD-inner").fill("basis")
// //   await page.locator("#PASSWORD_FIELD-inner").fill("Welcome2025")
// //   await page.locator("#LANGUAGE_SELECT").click()
// //   await page.selectOption("#LANGUAGE_SELECT", "EN")
// //   await page.locator('#LOGIN_LINK').click()
// //   await page.waitForTimeout(1000)
// //   await expect(page.getByRole("heading",{name:'Service Master Data'})).toBeVisible({ timeout: 10000})
// await page.goto(
//   'https://kps4hana:44304/sap/bc/ui2/flp?sap-client=001&sap-language=EN#Shell-home'
// );

// // Login
// await page.locator('#USERNAME_FIELD-inner').fill('basis');
// await page.locator('#PASSWORD_FIELD-inner').fill('Welcome2025');

// // Language selection (no click needed)
// await page.selectOption('#LANGUAGE_SELECT', 'EN');

// // Submit
// await page.locator('#LOGIN_LINK').click();

// // Assert successful login (auto-wait)
// await expect(
//   page.getByRole('heading', { name: 'Service Master Data' })
// ).toBeVisible({ timeout: 10000 });

// };




import { expect, Page } from '@playwright/test';

export async function Login(page: Page) {
  await page.goto(
    'https://kps4hana:44304/sap/bc/ui2/flp?sap-client=001&sap-language=EN',
    { waitUntil: 'domcontentloaded' }
  );

  // Username & Password
  await page.locator('#USERNAME_FIELD-inner').waitFor({ state: 'visible' });
  await page.locator('#USERNAME_FIELD-inner').fill(process.env.SAP_USER ?? 'basis');
  await page.locator('#PASSWORD_FIELD-inner').fill(process.env.SAP_PASSWORD ?? 'Welcome2025');

  // Language
  await page.selectOption('#LANGUAGE_SELECT', 'EN');

  // Login
  await page.locator('#LOGIN_LINK').click();

  // ✅ STRONG assertion → Shell loaded
  await expect(
    page.getByRole('button', { name: 'Home', exact: true })
  ).toBeVisible({ timeout: 30000 });
}
