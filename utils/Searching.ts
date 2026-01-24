import { Page, expect } from '@playwright/test';

export async function openFioriApp(
  page: Page,
  searchText: string,
  tileLabel: string
) {
  // Go to Home
  await page.getByRole('button', { name: 'Home', exact: true }).click();

  // Focus search
  await page.locator('#sf').click();

  const searchInput = page.locator('#searchFieldInShell-input-inner');
  await searchInput.waitFor({ state: 'visible', timeout: 15000 });

  // Search app
  await searchInput.fill(searchText);
  await page.keyboard.press('Enter');

  // Wait for tile
  const tile = page.getByLabel(tileLabel);
  await tile.waitFor({ state: 'visible', timeout: 30000 });

  // Open tile
  await tile.click();

  console.log(`✅ Opened Fiori app: ${tileLabel}`);
}
