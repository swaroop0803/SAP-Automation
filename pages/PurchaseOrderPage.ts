import { Page, FrameLocator, expect } from '@playwright/test';
import { waitForSAPIdle } from '../utils/sapUtils';

export class PurchaseOrderPage {
  readonly page: Page;
  readonly app: FrameLocator;

  constructor(page: Page) {
    this.page = page;
    this.app = page.frameLocator(
      'iframe[name="application-PurchaseOrder-create-iframe"]'
    );
  }

  async searchAndOpenApp() {
    await this.page.getByRole('button', { name: 'Home', exact: true }).click();
    await this.page.locator('#sf').click();

    const searchInput = this.page.locator('#searchFieldInShell-input-inner');
    await searchInput.fill('create purchase order advanced');
    await this.page.keyboard.press('Enter');

    await this.page.getByLabel('Create Purchase Order Advanced Tile').click();
    await waitForSAPIdle(this.page);
  }

  async fillHeaderData() {
    const supplier = this.app.getByRole('textbox', { name: 'Supplier', exact: true });
    await supplier.waitFor({ state: 'visible', timeout: 30000 });
    await supplier.focus();
    await this.page.keyboard.press('F4');

    const companyCode = this.app.getByRole('textbox', { name: 'Company Code', exact: true });
    await companyCode.fill('acs');
    await this.page.keyboard.press('Enter');
    await this.page.keyboard.press('Enter');
    await waitForSAPIdle(this.page);

    await this.app.getByRole('button', {name: 'Expand Header Ctrl+F2',}).click(); // open header
    await this.app.getByRole('tab', { name: 'Org. Data', exact: true }).click();

    await this.app.getByRole('textbox', { name: 'Purch. Org.', exact: true }).fill('acs');
    await this.page.keyboard.press('Enter');

    await this.page.keyboard.type('acs');
    await this.page.keyboard.press('Enter');

    await this.page.keyboard.press('Control+F5'); // close header
  }

  async fillItemOverview() {
    await this.page.keyboard.press('Control+F3');

    await this.app.getByRole('textbox', { name: 'A' }).nth(2).fill('K');

    await this.app.getByRole('textbox', { name: 'Material' }).first().fill('P-A2026-3');
    await this.app.getByRole('textbox', { name: 'PO Quantity' }).first().fill('1');
    await this.app.getByRole('textbox', { name: 'OUn' }).first().fill('EA');

    const today = new Date().toLocaleDateString('de-DE');
    await this.app.getByRole('textbox', { name: 'Deliv. Date' }).first().fill(today);

    await this.app.getByRole('textbox', { name: 'Net Price' }).first().fill('1000');
    await this.app.getByRole('textbox', { name: 'Plant' }).first().fill('acs');
    await this.page.keyboard.press('Enter');

    await waitForSAPIdle(this.page);
  }

  async fillAccountAssignment() {
    await this.app.getByRole('tab', { name: 'Account Assignment', exact: true }).click();

    const glAccount = this.app.getByRole('textbox', { name: 'G/L Account' }).first();
    await glAccount.fill('610010');
    await this.page.keyboard.press('Enter');

    await this.page.keyboard.press('F4');

    const companyCode = this.app.getByRole('textbox', { name: 'Company Code' });
    await companyCode.fill('acs');
    await this.page.keyboard.press('Enter');

    await waitForSAPIdle(this.page);
  }

  async saveAndValidate() {
    await this.page.keyboard.press('Control+S');
    await waitForSAPIdle(this.page);

    const successMessage = this.app.getByText(/Purchase order/i);
    await expect(successMessage).toBeVisible({ timeout: 30000 });
  }
}
