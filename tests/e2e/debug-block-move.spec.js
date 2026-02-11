import { test, expect } from '@playwright/test';

test('Simple test for block move classes', async ({ page }) => {
  await page.goto('/index.html');
  
  const original = `line 1
line 2
function movedFunction() {
    console.log('test');
    return true;
}
line 6
line 7`;

  const modified = `line 1
line 2
line 6
line 7
function movedFunction() {
    console.log('test');
    return true;
}`;

  await page.fill('#previous-text', original);
  await page.fill('#current-text', modified);
  await page.click('#compare-btn');
  
  await page.waitForSelector('.diff-row', { state: 'visible' });
  await page.click('.view-btn[data-view="unified"]');
  
  // Check for any elements with block-moved classes
  const allBlockMovedElements = await page.locator('[class*="block-moved"]').count();
  console.log('All block-moved elements:', allBlockMovedElements);
  
  const sourceRows = await page.locator('.block-moved-source').count();
  const destRows = await page.locator('.block-moved-destination').count();
  const indicators = await page.locator('.block-moved-indicator').count();
  
  console.log('Source rows:', sourceRows);
  console.log('Dest rows:', destRows);
  console.log('Indicators:', indicators);
  
  // Take screenshot for debugging
  await page.screenshot({ path: '/tmp/block-move-test.png' });
  
  expect(indicators).toBeGreaterThan(0);
});
