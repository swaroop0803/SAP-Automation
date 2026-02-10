import { Page } from "@playwright/test";

export async function Logout(page: Page) {
    try {
        // Step 1: Press F3 (Back) to exit SAP transaction and release locks
        try {
            await page.keyboard.press('F3');
            await page.waitForTimeout(1000);
            console.log('F3 pressed - transaction exited, locks released');
        } catch {
            console.log('F3 failed - continuing with logout');
        }

        // Step 2: Logout from SAP Fiori
        await page.getByRole('button', { name: 'Profile of basis' }).click({ timeout: 5000 });
        await page.getByText('Sign Out').click({ timeout: 5000 });
        await page.getByRole('button', { name: 'OK' }).click({ timeout: 5000 });
        console.log('Logged out successfully');
    } catch (error) {
        // Logout failed - page might be crashed or in bad state
        // Don't throw - just log and continue
        console.log('Logout skipped - page not in expected state');
    }
}
