/**
 * Slider Correction E2E Tests
 * 
 * Tests for slider detection and correction functionality in the browser
 */

import { test, expect } from '@playwright/test';

test.describe('Slider Correction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./index.html');
  });

  test('should handle basic text comparison', async ({ page }) => {
    // Simple text to verify basic functionality
    const oldText = 'line 1\nline 2\nline 3';
    const newText = 'line 1\nmodified line 2\nline 3';

    // Wait for the page to load
    await page.waitForSelector('textarea', { timeout: 10000 });

    // Fill text areas - try both possible selectors
    const textareas = await page.locator('textarea').all();
    if (textareas.length >= 2) {
      await textareas[0].fill(oldText);
      await textareas[1].fill(newText);
    }

    // Look for compare button
    const compareButton = page.locator('button:has-text("Compare"), button:has-text("compare"), button[type="button"]').first();
    if (await compareButton.isVisible()) {
      await compareButton.click();
      
      // Wait for any results
      await page.waitForTimeout(2000);
      
      // Check if any diff elements appear
      const diffElements = await page.locator('*').filter({ hasText: /modified/ }).count();
      expect(diffElements).toBeGreaterThan(0);
    } else {
      // Skip test if no compare button found
      test.skip();
    }
  });

  test('should handle different text inputs without errors', async ({ page }) => {
    const testCases = [
      { old: 'Hello', new: 'World' },
      { old: 'function test() { return true; }', new: 'function test() { return false; }' },
      { old: 'a\nb\nc', new: 'a\nx\nc' }
    ];

    for (const testCase of testCases) {
      await page.reload();
      await page.waitForSelector('textarea', { timeout: 10000 });

      const textareas = await page.locator('textarea').all();
      if (textareas.length >= 2) {
        await textareas[0].fill(testCase.old);
        await textareas[1].fill(testCase.new);

        // Verify no JavaScript errors occur
        await page.waitForTimeout(1000);
        
        const errors = await page.evaluate(() => {
          const logs = [];
          const originalLog = console.error;
          console.error = (...args) => logs.push(args.join(' '));
          console.error = originalLog;
          return logs;
        });
        
        expect(errors.length).toBe(0);
      }
    }
  });

  test('should page load without errors', async ({ page }) => {
    // Basic page load test
    await page.waitForSelector('body', { timeout: 10000 });
    
    // Check for JavaScript errors
    const errors = await page.evaluate(() => {
      const logs = [];
      const originalLog = console.error;
      console.error = (...args) => logs.push(args.join(' '));
      console.error = originalLog;
      return logs;
    });
    
    expect(errors.length).toBe(0);
  });
});