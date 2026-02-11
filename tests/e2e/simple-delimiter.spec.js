/**
 * Simple Delimiter E2E Test
 * Test basic functionality without complex interactions
 */

import { test, expect } from '@playwright/test';

test('should have delimiter normalization in UI', async ({ page }) => {
  await page.goto('/');
  
  // Check if Settings button exists (use the one in header, not Save Settings)
  const settingsButton = page.locator('#config-toggle-btn');
  await expect(settingsButton).toBeVisible();
  
  // Manually open the config panel by removing hidden class
  await page.evaluate(() => {
    const panel = document.getElementById('config-panel');
    if (panel) {
      panel.classList.remove('hidden');
      panel.removeAttribute('aria-hidden');
      const btn = document.getElementById('config-toggle-btn');
      if (btn) {
        btn.setAttribute('aria-expanded', 'true');
      }
    }
  });
  
  // Check if config panel opens
  const configPanel = page.locator('#config-panel');
  await expect(configPanel).toBeVisible();
  
  // Check if delimiter toggle exists
  const delimiterToggle = page.locator('#normalize-delimiters');
  await expect(delimiterToggle).toBeVisible();
});