import { Page } from "@playwright/test";
import { openFioriApp } from "../utils/Searching";
import { fillTextboxInSapFrame, getActiveSapFrame } from "../utils/sapUtils";

export async function GoodsReceiptCreation(page: Page, poNumber: string): Promise<string> {

    // navigating to Post Goods Movement
    await openFioriApp(page, 'post goods movement', 'Post Goods Movement Tile');

    const app = await getActiveSapFrame(page);

    // filling the poNumber passed from purchase order into the field
    await fillTextboxInSapFrame(app, "Purchase Order", poNumber);


    // Press Enter
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500)
    // clicking Item OK checkbox
    const itemOkCheckbox = app.getByRole('checkbox', { name: 'Item OK' });
    await itemOkCheckbox.waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(500)
    await itemOkCheckbox.check();

    await page.waitForTimeout(800)
    // clicking the post button
    await app.getByRole('button', { name: 'Post  Emphasized' }).click();

    // Click Yes button after Post if dialog appears
    try {
        const yesButton = app.getByRole('button', { name: 'Yes', exact: true });
        await yesButton.waitFor({ state: 'visible', timeout: 3000 });
        await yesButton.click();
        console.log('Yes button clicked after Post');
    } catch {
        await page.keyboard.press('Enter');
        console.log('Enter pressed after Post (Yes button not found)');
    }

    await page.waitForTimeout(2000);

    // Capture Material Document Number from the current frame (Goods Receipt)
    let materialDocNumber = '';
    try {
        // Find the element containing "Material document X posted" in the current GR frame
        const materialDocElement = app.locator('text=/Material document \\d+ posted/').first();
        await materialDocElement.waitFor({ state: 'visible', timeout: 30000 });

        const elementText = await materialDocElement.textContent();
        console.log('Found Material Document text:', elementText);

        // Extract document number using regex
        const match = elementText?.match(/Material document (\d+) posted/);
        if (match && match[1]) {
            materialDocNumber = match[1];
            console.log('Material Document Number:', materialDocNumber);
        } else {
            console.log('Could not extract Material Document Number from:', elementText);
        }
    } catch (error) {
        console.log('Error capturing Material Document Number:', error);
    }

    return materialDocNumber;
}
