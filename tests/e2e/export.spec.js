/**
 * Export Features E2E Tests
 * 
 * Tests for copy to clipboard and download functionality
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';

test.describe('Copy to Clipboard', () => {
  test.beforeEach(async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/index.html');
    
    // Add content and compare
    await page.locator('#previous-text').fill('line 1\nline 2\nline 3');
    await page.locator('#current-text').fill('line 1\nmodified line 2\nline 3\nnew line 4');
    await page.locator('#compare-btn').click();
    await page.waitForSelector('#export-controls');
  });

  test('should copy unified diff to clipboard', async ({ page }) => {
    // Click copy button
    await page.locator('#copy-btn').click();
    
    // Read clipboard content
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    
    // Verify it's a valid unified diff format
    expect(clipboardText).toContain('---');
    expect(clipboardText).toContain('+++');
    expect(clipboardText).toMatch(/@@ -\d+,\d+ \+\d+,\d+ @@/);
    
    // Should contain diff markers
    expect(clipboardText).toMatch(/[\+\- ]/m);
  });

  test('copied diff should include all changes', async ({ page }) => {
    await page.locator('#copy-btn').click();
    
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    
    // Should contain the modified line
    expect(clipboardText).toContain('modified line 2');
    
    // Should contain the added line
    expect(clipboardText).toContain('new line 4');
  });
});

test.describe('Download .patch File', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    
    // Add content and compare
    await page.locator('#previous-text').fill('line 1\nline 2\nline 3');
    await page.locator('#current-text').fill('line 1\nmodified line 2\nline 3\nnew line 4');
    await page.locator('#compare-btn').click();
    await page.waitForSelector('#export-controls');
  });

  test('should download patch file', async ({ page }) => {
    // Set up download listener
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#download-btn').click()
    ]);
    
    // Verify download filename
    const suggestedFilename = download.suggestedFilename();
    expect(suggestedFilename).toMatch(/\.patch$/);
    expect(suggestedFilename).toContain('diff');
    
    // Save and verify content
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    
    const content = fs.readFileSync(downloadPath, 'utf-8');
    
    // Verify it's a valid patch format
    expect(content).toContain('---');
    expect(content).toContain('+++');
    expect(content).toMatch(/@@ -\d+,\d+ \+\d+,\d+ @@/);
  });

  test('downloaded patch should be valid unified diff format', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#download-btn').click()
    ]);
    
    const downloadPath = await download.path();
    const content = fs.readFileSync(downloadPath, 'utf-8');
    const lines = content.split('\n');
    
    // Should start with --- and +++ headers
    expect(lines[0]).toMatch(/^---\s+/);
    expect(lines[1]).toMatch(/^\+\+\+\s+/);
    
    // Should have hunk header
    const hunkHeader = lines.find(l => l.startsWith('@@'));
    expect(hunkHeader).toBeDefined();
    expect(hunkHeader).toMatch(/@@ -\d+,\d+ \+\d+,\d+ @@/);
    
    // Should have content lines with proper prefixes
    const contentLines = lines.filter(l => !l.startsWith('---') && !l.startsWith('+++') && !l.startsWith('@@') && l.trim() !== '');
    expect(contentLines.length).toBeGreaterThan(0);
    
    // Each content line should start with space, +, or -
    for (const line of contentLines) {
      expect(line[0]).toMatch(/[ \+\-]/);
    }
  });
});

test.describe('Export Controls Visibility', () => {
  test('export controls should be hidden initially', async ({ page }) => {
    await page.goto('/index.html');
    
    const exportControls = page.locator('#export-controls');
    await expect(exportControls).toBeHidden();
  });

  test('export controls should appear after comparison', async ({ page }) => {
    await page.goto('/index.html');
    
    await page.locator('#previous-text').fill('test');
    await page.locator('#current-text').fill('test modified');
    await page.locator('#compare-btn').click();
    
    await page.waitForSelector('#export-controls');
    
    const exportControls = page.locator('#export-controls');
    await expect(exportControls).toBeVisible();
    
    // Both buttons should be visible
    await expect(page.locator('#copy-btn')).toBeVisible();
    await expect(page.locator('#download-btn')).toBeVisible();
  });
});
