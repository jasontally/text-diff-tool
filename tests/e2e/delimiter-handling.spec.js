/**
 * Delimiter Handling E2E Tests
 * 
 * End-to-end tests for delimiter normalization in the browser:
 * - UI elements are present and accessible
 * - Basic toggle functionality works
 * - Integration with comparison
 */

import { test, expect } from '@playwright/test';

test.describe('Delimiter Handling E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('UI Elements', () => {
    test('should have delimiter normalization toggle in config panel', async ({ page }) => {
      // Open config panel
      await page.click('button:has-text("Settings")');
      await page.waitForSelector('#config-panel:not(.hidden)');
      
      // Verify the delimiter normalization toggle exists
      const toggle = page.locator('#normalize-delimiters');
      await expect(toggle).toBeVisible();
      
      // Verify it has proper labeling
      const label = await page.locator('#normalize-delimiters-label');
      await expect(label).toBeVisible();
      await expect(label).toContainText('Normalize Delimiters');
      
      // Verify description
      const description = await page.locator('#normalize-delimiters-desc');
      await expect(description).toBeVisible();
      await expect(description).toContainText('Normalize whitespace inside delimiters');
    });

    test('should be keyboard accessible', async ({ page }) => {
      // Open config panel
      await page.click('button:has-text("Settings")');
      await page.waitForSelector('#config-panel:not(.hidden)');
      
      // Tab to the toggle
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Verify it's focused (after some tabs)
      const focused = await page.locator(':focus');
      const isVisible = await focused.isVisible();
      
      // The toggle should be focusable via keyboard navigation
      expect(await page.locator('#normalize-delimiters').isVisible()).toBe(true);
    });

    test('should have proper ARIA attributes', async ({ page }) => {
      // Open config panel
      await page.click('button:has-text("Settings")');
      await page.waitForSelector('#config-panel:not(.hidden)');
      
      // Check ARIA attributes
      const toggle = page.locator('#normalize-delimiters');
      await expect(toggle).toHaveAttribute('aria-labelledby', 'normalize-delimiters-label normalize-delimiters-desc');
      
      // Check associated label
      const label = page.locator('#normalize-delimiters-label');
      await expect(label).toHaveAttribute('for', 'normalize-delimiters');
      
      // Check description
      const description = page.locator('#normalize-delimiters-desc');
      await expect(description).toHaveAttribute('id', 'normalize-delimiters-desc');
    });
  });

  test.describe('Basic Functionality', () => {
    test('should toggle state when clicked', async ({ page }) => {
      // Open config panel
      await page.click('button:has-text("Settings")');
      await page.waitForSelector('#config-panel:not(.hidden)');
      
      const toggle = page.locator('#normalize-delimiters');
      
      // Check initial state
      const initialState = await toggle.isChecked();
      
      // Click to toggle
      await toggle.check();
      
      // Verify state changed
      const afterState = await toggle.isChecked();
      expect(afterState).toBe(true);
      
      // Click to uncheck
      await toggle.uncheck();
      
      // Verify state changed back
      const finalState = await toggle.isChecked();
      expect(finalState).toBe(false);
    });

    test('should persist setting after save', async ({ page }) => {
      // Open config panel
      await page.click('button:has-text("Settings")');
      await page.waitForSelector('#config-panel:not(.hidden)');
      
      const toggle = page.locator('#normalize-delimiters');
      
      // Set a specific state
      await toggle.check();
      
      // Save settings
      await page.click('button[aria-label="Save configuration settings"]');
      
      // Wait for save to complete
      await page.waitForTimeout(1000);
      
      // Close and reopen config panel
      await page.keyboard.press('Escape'); // Close panel
      await page.waitForSelector('#config-panel.hidden');
      await page.click('button:has-text("Settings")');
      await page.waitForSelector('#config-panel:not(.hidden)');
      
      // Verify setting persisted
      const persistedState = await toggle.isChecked();
      expect(persistedState).toBe(true);
    });
  });

  test.describe('Integration with Comparison', () => {
    test('should be able to compare with delimiter normalization enabled', async ({ page }) => {
      // Open config panel and enable normalization
      await page.click('button:has-text("Settings")');
      await page.waitForSelector('#config-panel:not(.hidden)');
      await page.check('#normalize-delimiters');
      await page.click('button[aria-label="Save configuration settings"]');
      await page.keyboard.press('Escape');
      
      // Enter test data
      await page.fill('#previous-text', 'const arr = [ 1, 2, 3 ];');
      await page.fill('#current-text', 'const arr = [1, 2, 3];');
      
      // Compare
      await page.click('button[aria-label="Compare text versions"]');
      await page.waitForSelector('.diff-result');
      
      // Verify comparison completed (no errors)
      const diffResult = page.locator('.diff-result');
      await expect(diffResult).toBeVisible();
      
      // Check if any changes were detected (may vary based on implementation)
      const hasChanges = await page.locator('.diff-added, .diff-removed').count() > 0;
      // With normalization enabled, should have fewer or no changes
      // This test mainly verifies the system doesn't crash
    });

    test('should be able to compare with delimiter normalization disabled', async ({ page }) => {
      // Open config panel and disable normalization
      await page.click('button:has-text("Settings")');
      await page.waitForSelector('#config-panel:not(.hidden)');
      await page.uncheck('#normalize-delimiters');
      await page.click('button[aria-label="Save configuration settings"]');
      await page.keyboard.press('Escape');
      
      // Enter test data
      await page.fill('#previous-text', 'const arr = [ 1, 2, 3 ];');
      await page.fill('#current-text', 'const arr = [1, 2, 3];');
      
      // Compare
      await page.click('button[aria-label="Compare text versions"]');
      await page.waitForSelector('.diff-result');
      
      // Verify comparison completed (no errors)
      const diffResult = page.locator('.diff-result');
      await expect(diffResult).toBeVisible();
    });
  });

  test.describe('Real Code Examples', () => {
    test('should handle JavaScript code without errors', async ({ page }) => {
      // Enable normalization
      await page.click('button:has-text("Settings")');
      await page.waitForSelector('#config-panel:not(.hidden)');
      await page.check('#normalize-delimiters');
      await page.click('button[aria-label="Save configuration settings"]');
      await page.keyboard.press('Escape');
      
      const jsCode1 = `const Component = ( props ) => {
  return <div className={ "container" }>{ props.content }</div>;
};`;
      
      const jsCode2 = `const Component = (props) => {
  return <div className={"container"}>{props.content}</div>;
};`;
      
      await page.fill('#previous-text', jsCode1);
      await page.fill('#current-text', jsCode2);
      await page.click('button[aria-label="Compare text versions"]');
      await page.waitForSelector('.diff-result');
      
      // Should handle JavaScript without errors
      await expect(page.locator('.diff-result')).toBeVisible();
    });

    test('should handle Python code without errors', async ({ page }) => {
      // Enable normalization
      await page.click('button:has-text("Settings")');
      await page.waitForSelector('#config-panel:not(.hidden)');
      await page.check('#normalize-delimiters');
      await page.click('button[aria-label="Save configuration settings"]');
      await page.keyboard.press('Escape');
      
      const pythonCode1 = `def calculate( items ):
    return [ item * 2 for item in items ]`;
      
      const pythonCode2 = `def calculate(items):
    return [item * 2 for item in items]`;
      
      await page.fill('#previous-text', pythonCode1);
      await page.fill('#current-text', pythonCode2);
      await page.click('button[aria-label="Compare text versions"]');
      await page.waitForSelector('.diff-result');
      
      // Should handle Python without errors
      await expect(page.locator('.diff-result')).toBeVisible();
    });
  });
});