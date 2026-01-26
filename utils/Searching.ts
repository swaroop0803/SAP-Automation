import { Page, expect } from '@playwright/test';

export async function openFioriApp(
  page: Page,
  searchText: string,
  tileLabel: string,
  maxRetries: number = 3
) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting to open "${tileLabel}" (attempt ${attempt}/${maxRetries})`);

      // Go to Home
      await page.getByRole('button', { name: 'Home', exact: true }).click();
      await page.waitForTimeout(1000);

      // Focus search
      await page.locator('#sf').click();

      const searchInput = page.locator('#searchFieldInShell-input-inner');
      await searchInput.waitFor({ state: 'visible', timeout: 15000 });

      // Clear and search app
      await searchInput.clear();
      await searchInput.fill(searchText);
      await page.keyboard.press('Enter');

      // Wait for search results to load
      await page.waitForTimeout(2000);

      // Try multiple ways to find the tile
      let tile = page.getByLabel(tileLabel);

      // Check if tile is visible with shorter timeout
      try {
        await tile.waitFor({ state: 'visible', timeout: 10000 });
      } catch {
        // Try finding by partial text match
        console.log(`Tile not found by label, trying text match...`);
        const tileKeyword = tileLabel.replace(' Tile', '').trim();
        tile = page.locator(`[aria-label*="${tileKeyword}"]`).first();
        await tile.waitFor({ state: 'visible', timeout: 10000 });
      }

      // Open tile
      await tile.click();
      console.log(`✅ Opened Fiori app: ${tileLabel}`);
      return; // Success - exit function

    } catch (error) {
      lastError = error as Error;
      console.log(`Attempt ${attempt} failed: ${lastError.message}`);

      if (attempt < maxRetries) {
        console.log(`Retrying in 2 seconds...`);
        await page.waitForTimeout(2000);
      }
    }
  }

  // All retries failed
  throw new Error(`Failed to open "${tileLabel}" after ${maxRetries} attempts. Last error: ${lastError?.message}`);
}










// import { Page, expect } from '@playwright/test';

// export async function openFioriApp(
//   page: Page,
//   searchText: string,
//   tileLabel: string
// ) {
//   // Go to Home
//   await page.getByRole('button', { name: 'Home', exact: true }).click();

//   // Focus search
//   await page.locator('#sf').click();

//   const searchInput = page.locator('#searchFieldInShell-input-inner');
//   await searchInput.waitFor({ state: 'visible', timeout: 15000 });

//   // Search app
//   await searchInput.fill(searchText);
//   await page.keyboard.press('Enter');

//   // Wait for tile
//   const tile = page.getByLabel(tileLabel);
//   await tile.waitFor({ state: 'visible', timeout: 30000 });

//   // Open tile
//   await tile.click();

//   console.log(`✅ Opened Fiori app: ${tileLabel}`);
// }
