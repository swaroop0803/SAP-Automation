import { Page } from "@playwright/test";
import { openFioriApp } from "../utils/Searching";
import { fillTextboxInSapFrame, getActiveSapFrame } from "../utils/sapUtils";

export async function GoodsReceiptCreation(page: Page, poNumber: string): Promise<void> {

    // navigating to Post Goods Movement
    await openFioriApp(page, 'post goods movement', 'Post Goods Movement Tile');

    const app = await getActiveSapFrame(page);

    // filling the poNumber passed from purchase order into the field
    await fillTextboxInSapFrame(app, "Purchase Order", poNumber);

    // Press Enter
    await page.keyboard.press('Enter');

    // clicking Item OK checkbox
    const itemOkCheckbox = app.getByRole('checkbox', { name: 'Item OK' });
    await itemOkCheckbox.waitFor({ state: 'visible', timeout: 30000 });
    await itemOkCheckbox.check();

    // clicking the post button
    await app.getByRole('button', { name: /Post/i }).click();

    await page.waitForTimeout(2000);
}
