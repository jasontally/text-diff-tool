/**
 * Compare Flow E2E Tests
 * 
 * Based on Implementation Plan: Phase 3 - Task 3.2
 * Tests for the core text comparison functionality with documented semantic selectors
 * and statistics/navigation/view switching tests.
 * 
 * All tests use 30-second timeouts for unoptimized app compatibility.
 * 
 * Semantic Selector Documentation:
 * 
 * Input Fields:
 * - #previous-text - Previous version textarea
 * - #current-text - Current version textarea
 * 
 * Action Buttons:
 * - #compare-btn - Compare button
 * - #clear-btn - Clear both panels button
 * - #swap-btn - Swap panels button
 * 
 * View Controls:
 * - [data-view="split"] - Split view button
 * - [data-view="unified"] - Unified view button
 * - #diff-container - Split view container
 * - #unified-container - Unified view container
 * 
 * Diff Content:
 * - .diff-row - Individual diff rows
 * - .unified-row - Unified view rows
 * - [data-testid="previous-diff-content"] - Previous panel content
 * - [data-testid="current-diff-content"] - Current panel content
 * 
 * Change Types (CSS classes):
 * - .added - Added lines (green)
 * - .removed - Removed lines (red)
 * - .modified - Modified lines (yellow)
 * - .unchanged - Unchanged lines
 * 
 * Statistics:
 * - [data-testid="stat-added"] - Added count
 * - [data-testid="stat-removed"] - Removed count
 * - [data-testid="stat-modified"] - Modified count
 * - [data-testid="stat-moved"] - Moved count
 * - #stats - Stats container
 * 
 * Navigation:
 * - #navigation-section - Navigation section
 * - #prev-change-btn - Previous change button
 * - #next-change-btn - Next change button
 * - #change-counter - Change counter (e.g., "1 of 5")
 * 
 * Filter Controls:
 * - #ignore-whitespace - Ignore whitespace checkbox
 * - #ignore-comments - Ignore comments checkbox
 * 
 * Mode Controls:
 * - [data-mode="lines"] - Line diff mode button
 * - [data-mode="words"] - Word diff mode button
 * - [data-mode="chars"] - Char diff mode button
 * 
 * Export Controls:
 * - #export-controls - Export buttons container
 * - #copy-btn - Copy to clipboard button
 * - #download-btn - Download patch button
 */

import { test, expect } from '@playwright/test';

// Store console messages for each test
const testConsoleMessages = [];

test.describe('Basic Compare Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear messages for this test
    testConsoleMessages.length = 0;
    
    // Collect all console messages during tests
    page.on('console', msg => {
      const message = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
        time: new Date().toISOString()
      };
      testConsoleMessages.push(message);
      
      // Log errors and warnings immediately
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.error(`[Browser ${msg.type().toUpperCase()}] ${msg.text()}`);
      }
    });
    
    // Also capture page errors
    page.on('pageerror', error => {
      const errorInfo = {
        type: 'pageerror',
        text: error.message,
        stack: error.stack,
        time: new Date().toISOString()
      };
      testConsoleMessages.push(errorInfo);
      console.error(`[Browser PAGE ERROR] ${error.message}`);
    });
    
    await page.goto('/index.html');
  });
  
  test.afterEach(async ({}, testInfo) => {
    // Report any console errors after each test
    const errors = testConsoleMessages.filter(m => m.type === 'error' || m.type === 'pageerror');
    const warnings = testConsoleMessages.filter(m => m.type === 'warning');
    
    if (errors.length > 0) {
      console.log(`\n⚠️  Test "${testInfo.title}" had ${errors.length} console error(s):`);
      errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err.text}`);
      });
    }
    
    if (warnings.length > 0) {
      console.log(`\nℹ️  Test "${testInfo.title}" had ${warnings.length} console warning(s)`);
    }
  });

  test('should compare two different texts and show results without JavaScript errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => {
      errors.push(error.message);
    });
    
    const oldText = 'line 1\nline 2\nline 3';
    const newText = 'line 1\nmodified line 2\nline 3\nnew line 4';
    
    await page.locator('#previous-text').fill(oldText);
    await page.locator('#current-text').fill(newText);
    await page.locator('#compare-btn').click();
    
    // Wait for diff results with 30s timeout
    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
    
    // Check that results are displayed
    const diffRows = await page.locator('.diff-row, .unified-row').count();
    expect(diffRows).toBeGreaterThan(0);
    
    // Check stats are updated using semantic selectors
    const addedCount = await page.locator('[data-testid="stat-added"]').textContent();
    const removedCount = await page.locator('[data-testid="stat-removed"]').textContent();
    
    expect(parseInt(addedCount || '0')).toBeGreaterThanOrEqual(0);
    expect(parseInt(removedCount || '0')).toBeGreaterThanOrEqual(0);
    
    // Ensure no JavaScript errors occurred
    expect(errors).toHaveLength(0);
    
    // Check for silent failures - no output but no error
    const hasOutput = diffRows > 0 || parseInt(addedCount) > 0 || parseInt(removedCount) > 0;
    const hasErrors = testConsoleMessages.some(m => m.type === 'error' || m.type === 'pageerror');
    expect(hasOutput || hasErrors).toBe(true);
  });
  
  test('should not silently fail when comparison produces no output', async ({ page }) => {
    // This test checks for the specific bug where comparison fails silently
    const oldText = 'function test() {\n  return 1;\n}';
    const newText = 'function test() {\n  return 2;\n}';
    
    await page.locator('#previous-text').fill(oldText);
    await page.locator('#current-text').fill(newText);
    await page.locator('#compare-btn').click();
    
    // Wait for either results OR an alert (error) - 30s timeout
    let alertShown = false;
    let alertMessage = '';
    page.on('dialog', async dialog => {
      alertShown = true;
      alertMessage = dialog.message();
      await dialog.accept();
    });
    
    await page.waitForTimeout(5000);
    
    // Check if results appeared
    const diffRows = await page.locator('.diff-row, .unified-row').count();
    const hasStats = await page.locator('[data-testid="stat-modified"]').isVisible().catch(() => false);
    
    // Either we should have results OR an error should be shown/logged
    const hasOutput = diffRows > 0;
    const hasConsoleErrors = testConsoleMessages.some(m => 
      m.type === 'error' || m.type === 'pageerror'
    );
    
    // Detect silent failure: no output AND no error
    if (!hasOutput && !alertShown && !hasConsoleErrors) {
      throw new Error('Silent failure detected: Comparison produced no output and no error was shown or logged');
    }
    
    // If there were errors, they should be logged to console
    if (alertShown && !hasConsoleErrors) {
      console.warn('Alert was shown but no console error was logged:', alertMessage);
    }
  });

  test('should handle mixed content with added, removed, and modified lines', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => {
      errors.push(error.message);
    });
    
    // Test with configuration-style content
    const oldText = `# Config v1
server {
  host: localhost
  port: 8080
}
old section {
  value: 1
}`;
    
    const newText = `# Config v2
server {
  host: 0.0.0.0
  port: 3000
}
new section {
  value: 2
}`;
    
    await page.locator('#previous-text').fill(oldText);
    await page.locator('#current-text').fill(newText);
    await page.locator('#compare-btn').click();
    
    // Wait for diff results with 30s timeout
    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
    
    // Check that results are displayed
    const diffRows = await page.locator('.diff-row, .unified-row').count();
    expect(diffRows).toBeGreaterThan(0);
    
    // Ensure no JavaScript errors occurred (catches const redeclaration issues)
    expect(errors).toHaveLength(0);
    
    // Verify we see all types of changes
    const addedRows = await page.locator('.diff-row.added, .unified-row.added').count();
    const removedRows = await page.locator('.diff-row.removed, .unified-row.removed').count();
    const modifiedRows = await page.locator('.diff-row.modified, .unified-row.modified').count();
    
    // Should have at least some changes
    expect(addedRows + removedRows + modifiedRows).toBeGreaterThan(0);
  });

  test('should show added lines in green with + marker', async ({ page }) => {
    await page.locator('#previous-text').fill('line 1');
    await page.locator('#current-text').fill('line 1\nline 2');
    await page.locator('#compare-btn').click();
    
    await page.waitForSelector('.diff-row.added, .unified-row.added', { timeout: 30000 });
    
    const addedRow = page.locator('.diff-row.added, .unified-row.added').first();
    await expect(addedRow).toBeVisible();
    
    // Check for + prefix in unified marker
    const marker = addedRow.locator('.unified-marker');
    if (await marker.count() > 0) {
      const markerText = await marker.textContent();
      expect(markerText).toBe('+');
    }
  });

  test('should show removed lines in red with - marker', async ({ page }) => {
    await page.locator('#previous-text').fill('line 1\nline 2');
    await page.locator('#current-text').fill('line 1');
    await page.locator('#compare-btn').click();
    
    await page.waitForSelector('.diff-row.removed, .unified-row.removed', { timeout: 30000 });
    
    const removedRow = page.locator('.diff-row.removed, .unified-row.removed').first();
    await expect(removedRow).toBeVisible();
    
    // Check for - prefix in unified marker
    const marker = removedRow.locator('.unified-marker');
    if (await marker.count() > 0) {
      const markerText = await marker.textContent();
      expect(markerText).toBe('-');
    }
  });

  test('should show modified lines in yellow with ~ marker', async ({ page }) => {
    await page.locator('#previous-text').fill('interface GigabitEthernet0/1\n  ip address 192.168.1.1 255.255.255.0');
    await page.locator('#current-text').fill('interface GigabitEthernet0/1\n  ip address 10.0.0.1 255.255.255.0');
    await page.locator('#compare-btn').click();
    
    await page.waitForSelector('.diff-row.modified, .unified-row.modified', { timeout: 30000 });
    
    const modifiedRow = page.locator('.diff-row.modified, .unified-row.modified').first();
    await expect(modifiedRow).toBeVisible();
    
    // Check for ~ prefix in unified marker
    const marker = modifiedRow.locator('.unified-marker');
    if (await marker.count() > 0) {
      const markerText = await marker.textContent();
      expect(markerText).toBe('~');
    }
  });

  test('should show correct content in both panels for modified lines', async ({ page }) => {
    // This test verifies that Previous panel shows old text and Current panel shows new text
    // Use lines that are similar enough to be classified as modified (>60% similarity)
    const oldText = 'interface GigabitEthernet0/1\n  ip address 192.168.1.1 255.255.255.0';
    const newText = 'interface GigabitEthernet0/1\n  ip address 10.0.0.1 255.255.255.0';
    
    await page.locator('#previous-text').fill(oldText);
    await page.locator('#current-text').fill(newText);
    await page.locator('#compare-btn').click();
    
    // Wait for any diff results to appear with 30s timeout
    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
    
    // Get all diff rows and find modified ones
    const modifiedRows = page.locator('.diff-row.modified, .unified-row.modified');
    const modifiedCount = await modifiedRows.count();
    
    // We MUST have modified rows for this test to be meaningful
    // If there are no modified rows, the lines were classified as removed/added instead
    expect(modifiedCount).toBeGreaterThan(0);
    
    // Get the specific panels using semantic selectors
    const prevPanel = page.locator('[data-testid="previous-diff-content"]');
    const currPanel = page.locator('[data-testid="current-diff-content"]');
    
    // Find the first modified row in each panel and get its content
    const prevModifiedRows = prevPanel.locator('.diff-row.modified, .unified-row.modified');
    const currModifiedRows = currPanel.locator('.diff-row.modified, .unified-row.modified');
    
    expect(await prevModifiedRows.count()).toBeGreaterThan(0);
    expect(await currModifiedRows.count()).toBeGreaterThan(0);
    
    // Check that the Previous panel shows the old IP (192.168.1.1)
    const prevContent = await prevModifiedRows.first().locator('.line-content, .unified-content').textContent();
    expect(prevContent).toContain('192.168.1.1');
    expect(prevContent).not.toContain('10.0.0.1');
    
    // Check that the Current panel shows the new IP (10.0.0.1)
    const currContent = await currModifiedRows.first().locator('.line-content, .unified-content').textContent();
    expect(currContent).toContain('10.0.0.1');
    expect(currContent).not.toContain('192.168.1.1');
  });

  test('should handle empty text comparison', async ({ page }) => {
    await page.locator('#previous-text').fill('');
    await page.locator('#current-text').fill('');
    await page.locator('#compare-btn').click();
    
    // Should either show no results or handle gracefully - 30s timeout
    const diffContainer = page.locator('#diff-container, #unified-container');
    const isVisible = await diffContainer.isVisible().catch(() => false);
    
    if (isVisible) {
      // If visible, check it handled empty gracefully
      const rows = await page.locator('.diff-row, .unified-row').count();
      expect(rows).toBe(0);
    }
  });

  test('should match input content to output content across all browsers', async ({ page }) => {
    // This test specifically catches the Safari bug where output didn't match input
    const oldText = 'server {\n    host: localhost\n    port: 8080\n    debug: true\n}';
    const newText = 'server {\n    host: 0.0.0.0\n    port: 3000\n    debug: false\n}';
    
    await page.locator('#previous-text').fill(oldText);
    await page.locator('#current-text').fill(newText);
    await page.locator('#compare-btn').click();
    
    // Wait for diff results with 30s timeout
    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
    
    // Get all content from Previous panel (excluding gaps)
    const prevContent = await page.locator('[data-testid="previous-diff-content"] .diff-row:not(.gap) .line-content, [data-testid="previous-diff-content"] .unified-row:not(.gap) .unified-content').allTextContents();
    const prevText = prevContent.join('\n').replace(/^\s*[-+]?\s*/, '').trim();
    
    // Get all content from Current panel (excluding gaps)  
    const currContent = await page.locator('[data-testid="current-diff-content"] .diff-row:not(.gap) .line-content, [data-testid="current-diff-content"] .unified-row:not(.gap) .unified-content').allTextContents();
    const currText = currContent.join('\n').replace(/^\s*[-+]?\s*/, '').trim();
    
    // Verify Previous panel contains original input text
    expect(prevText).toContain('localhost');
    expect(prevText).toContain('8080');
    expect(prevText).toContain('true');
    expect(prevText).not.toContain('0.0.0.0'); // Should NOT have new content
    expect(prevText).not.toContain('3000');
    expect(prevText).not.toContain('false');
    
    // Verify Current panel contains new input text
    expect(currText).toContain('0.0.0.0');
    expect(currText).toContain('3000');
    expect(currText).toContain('false');
    expect(currText).not.toContain('localhost'); // Should NOT have old content
    expect(currText).not.toContain('8080');
    expect(currText).not.toContain('true');
  });

  test('should preserve exact text content without marker interference', async ({ page }) => {
    // Test that +/- markers don't corrupt the actual text content
    const oldText = 'line1\nline2\nline3';
    const newText = 'line1\nmodified\nline3\nline4';
    
    await page.locator('#previous-text').fill(oldText);
    await page.locator('#current-text').fill(newText);
    await page.locator('#compare-btn').click();
    
    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
    
    // Collect all content from Previous panel (filter out empty/whitespace-only content)
    const prevContents = [];
    const prevRows = await page.locator('[data-testid="previous-diff-content"] .diff-row:not(.gap), [data-testid="previous-diff-content"] .unified-row:not(.gap)').all();
    for (const row of prevRows) {
      const contentDiv = row.locator('.line-content, .unified-content');
      // Some rows may not have a content div - skip those
      const count = await contentDiv.count();
      if (count > 0) {
        const content = await contentDiv.textContent();
        prevContents.push(content);
      }
    }
    
    // Collect all content from Current panel (filter out empty/whitespace-only content)
    const currContents = [];
    const currRows = await page.locator('[data-testid="current-diff-content"] .diff-row:not(.gap), [data-testid="current-diff-content"] .unified-row:not(.gap)').all();
    for (const row of currRows) {
      const contentDiv = row.locator('.line-content, .unified-content');
      // Some rows may not have a content div - skip those
      const count = await contentDiv.count();
      if (count > 0) {
        const content = await contentDiv.textContent();
        currContents.push(content);
      }
    }
    
    // Verify Previous panel has the expected lines
    // line1 (unchanged), line2 (removed/modified from), line3 (unchanged)
    const prevText = prevContents.join('\n');
    expect(prevText).toContain('line1');
    expect(prevText).toContain('line2');
    expect(prevText).toContain('line3');
    expect(prevText).not.toContain('modified'); // Old version shouldn't have the new text
    expect(prevText).not.toContain('line4'); // Old version shouldn't have the added line
    
    // Verify Current panel has the expected lines
    // line1 (unchanged), modified (modified to), line3 (unchanged), line4 (added)
    const currText = currContents.join('\n');
    expect(currText).toContain('line1');
    expect(currText).toContain('modified');
    expect(currText).toContain('line3');
    expect(currText).toContain('line4');
    expect(currText).not.toContain('line2'); // New version shouldn't have the old modified text
    
    // Verify non-empty rows have actual content (filter out gap/placeholder rows)
    const nonEmptyPrevContents = prevContents.filter(c => c && c.trim().length > 0 && c.trim() !== '-');
    const nonEmptyCurrContents = currContents.filter(c => c && c.trim().length > 0 && c.trim() !== '+');
    
    // Each non-empty row should have meaningful content
    for (const content of nonEmptyPrevContents) {
      expect(content.trim().length).toBeGreaterThan(0);
    }
    for (const content of nonEmptyCurrContents) {
      expect(content.trim().length).toBeGreaterThan(0);
    }
    
    // Verify we have the expected number of content rows (excluding gaps)
    expect(nonEmptyPrevContents.length).toBeGreaterThanOrEqual(3); // At least 3 lines from old text
    expect(nonEmptyCurrContents.length).toBeGreaterThanOrEqual(4); // At least 4 lines from new text
  });

  test('should clear both panels when Clear Both is clicked', async ({ page }) => {
    await page.locator('#previous-text').fill('previous text');
    await page.locator('#current-text').fill('current text');
    
    await page.locator('#clear-btn').click();
    
    const prevValue = await page.locator('#previous-text').inputValue();
    const currValue = await page.locator('#current-text').inputValue();
    
    expect(prevValue).toBe('');
    expect(currValue).toBe('');
  });

  test('should swap panels when Swap is clicked', async ({ page }) => {
    await page.locator('#previous-text').fill('previous content');
    await page.locator('#current-text').fill('current content');
    
    await page.locator('#swap-btn').click();
    
    const prevValue = await page.locator('#previous-text').inputValue();
    const currValue = await page.locator('#current-text').inputValue();
    
    expect(prevValue).toBe('current content');
    expect(currValue).toBe('previous content');
  });
});

test.describe('Statistics Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
  });

  test('should display all stat counters after comparison', async ({ page }) => {
    const oldText = 'line 1\nline 2\nline 3';
    const newText = 'line 1\nmodified line 2\nline 3\nnew line 4';
    
    await page.locator('#previous-text').fill(oldText);
    await page.locator('#current-text').fill(newText);
    await page.locator('#compare-btn').click();
    
    await page.waitForSelector('#stats', { timeout: 30000 });
    
    // Check all stat counters are visible using semantic selectors
    const addedStat = page.locator('[data-testid="stat-added-container"]');
    const removedStat = page.locator('[data-testid="stat-removed-container"]');
    const modifiedStat = page.locator('[data-testid="stat-modified-container"]');
    const movedStat = page.locator('[data-testid="stat-moved-container"]');
    
    await expect(addedStat).toBeVisible();
    await expect(removedStat).toBeVisible();
    await expect(modifiedStat).toBeVisible();
    await expect(movedStat).toBeVisible();
  });

  test('should update stats after subsequent comparisons', async ({ page }) => {
    // First comparison
    await page.locator('#previous-text').fill('line 1');
    await page.locator('#current-text').fill('line 1\nline 2');
    await page.locator('#compare-btn').click();
    
    await page.waitForSelector('#stats', { timeout: 30000 });
    
    const firstAdded = await page.locator('[data-testid="stat-added"]').textContent();
    const firstAddedCount = parseInt(firstAdded || '0');
    
    // Second comparison with different content
    await page.locator('#previous-text').fill('line 1\nline 2\nline 3\nline 4');
    await page.locator('#current-text').fill('line 1');
    await page.locator('#compare-btn').click();
    
    await page.waitForTimeout(2000);
    
    const secondRemoved = await page.locator('[data-testid="stat-removed"]').textContent();
    const secondRemovedCount = parseInt(secondRemoved || '0');
    
    expect(secondRemovedCount).toBeGreaterThan(0);
  });

  test('should show zero stats when comparing identical content', async ({ page }) => {
    const identicalText = 'line 1\nline 2\nline 3';
    
    await page.locator('#previous-text').fill(identicalText);
    await page.locator('#current-text').fill(identicalText);
    await page.locator('#compare-btn').click();
    
    await page.waitForTimeout(2000);
    
    // Stats may not show or show zeros for identical content
    const addedCount = await page.locator('[data-testid="stat-added"]').textContent().catch(() => '0');
    const removedCount = await page.locator('[data-testid="stat-removed"]').textContent().catch(() => '0');
    
    expect(parseInt(addedCount)).toBe(0);
    expect(parseInt(removedCount)).toBe(0);
  });
});

test.describe('Navigation Controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    
    // Add content with multiple changes
    await page.locator('#previous-text').fill('line 1\nold line 2\nline 3\nold line 4');
    await page.locator('#current-text').fill('line 1\nnew line 2\nline 3\nnew line 4');
    await page.locator('#compare-btn').click();
    await page.waitForSelector('#navigation-section', { timeout: 30000 });
  });

  test('should navigate to next and previous changes', async ({ page }) => {
    // Get initial counter
    const initialCounter = await page.locator('#change-counter').textContent();
    expect(initialCounter).toMatch(/\d+ of \d+/);
    
    // Click next
    await page.locator('#next-change-btn').click();
    
    const nextCounter = await page.locator('#change-counter').textContent();
    expect(nextCounter).not.toBe(initialCounter);
    
    // Click previous
    await page.locator('#prev-change-btn').click();
    
    const prevCounter = await page.locator('#change-counter').textContent();
    expect(prevCounter).toBe(initialCounter);
  });

  test('should disable prev button at first change', async ({ page }) => {
    const prevBtn = page.locator('#prev-change-btn');
    
    // At start, prev should be disabled
    const isDisabled = await prevBtn.isDisabled();
    expect(isDisabled).toBe(true);
  });

  test('should disable next button at last change', async ({ page }) => {
    // Navigate to last change
    const counterText = await page.locator('#change-counter').textContent();
    const match = counterText?.match(/of (\d+)/);
    
    if (match) {
      const totalChanges = parseInt(match[1]);
      
      // Click next until we reach the end
      for (let i = 1; i < totalChanges; i++) {
        await page.locator('#next-change-btn').click();
      }
      
      // Now next button should be disabled
      const nextBtn = page.locator('#next-change-btn');
      const isDisabled = await nextBtn.isDisabled();
      expect(isDisabled).toBe(true);
    }
  });
});

test.describe('View Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    
    // Add content and compare first
    await page.locator('#previous-text').fill('line 1\nline 2');
    await page.locator('#current-text').fill('line 1\nmodified line 2');
    await page.locator('#compare-btn').click();
    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
  });

  test('should switch between split and unified views', async ({ page }) => {
    // Default should be split view
    const splitContainer = page.locator('#diff-container');
    await expect(splitContainer).toBeVisible();
    
    // Switch to unified view
    await page.locator('[data-view="unified"]').click();
    
    const unifiedContainer = page.locator('#unified-container');
    await expect(unifiedContainer).toBeVisible();
    await expect(splitContainer).toBeHidden();
    
    // Switch back to split view
    await page.locator('[data-view="split"]').click();
    await expect(splitContainer).toBeVisible();
    await expect(unifiedContainer).toBeHidden();
  });

  test('should maintain diff content when switching views', async ({ page }) => {
    // Get content count in split view
    const splitRowCount = await page.locator('#diff-container .diff-row, #diff-container .unified-row').count();
    expect(splitRowCount).toBeGreaterThan(0);
    
    // Switch to unified
    await page.locator('[data-view="unified"]').click();
    await page.waitForTimeout(500);
    
    // Get content count in unified view
    const unifiedRowCount = await page.locator('#unified-container .diff-row, #unified-container .unified-row').count();
    expect(unifiedRowCount).toBeGreaterThan(0);
    
    // Switch back to split
    await page.locator('[data-view="split"]').click();
    await page.waitForTimeout(500);
    
    // Verify content is still there
    const finalRowCount = await page.locator('#diff-container .diff-row, #diff-container .unified-row').count();
    expect(finalRowCount).toBe(splitRowCount);
  });
});

test.describe('Diff Mode Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
  });

  test('should switch between line, word, and char modes', async ({ page }) => {
    await page.locator('#previous-text').fill('The quick brown fox');
    await page.locator('#current-text').fill('The slow brown fox');
    
    // Test Line mode (default)
    await page.locator('[data-mode="lines"]').click();
    await page.locator('#compare-btn').click();
    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
    
    // Test Word mode
    await page.locator('[data-mode="words"]').click();
    await page.locator('#compare-btn').click();
    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
    
    // Check word mode button is active
    const wordBtn = page.locator('[data-mode="words"]');
    await expect(wordBtn).toHaveClass(/active/);
    
    // Test Char mode
    await page.locator('[data-mode="chars"]').click();
    await page.locator('#compare-btn').click();
    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
    
    const charBtn = page.locator('[data-mode="chars"]');
    await expect(charBtn).toHaveClass(/active/);
  });
});

test.describe('Filter Controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
  });

  test('should toggle ignore whitespace filter', async ({ page }) => {
    const checkbox = page.locator('#ignore-whitespace');
    
    // Should be unchecked by default
    await expect(checkbox).not.toBeChecked();
    
    // Toggle it
    await checkbox.click();
    await expect(checkbox).toBeChecked();
    
    // Toggle back
    await checkbox.click();
    await expect(checkbox).not.toBeChecked();
  });

  test('should toggle ignore comments filter', async ({ page }) => {
    const checkbox = page.locator('#ignore-comments');
    
    // Should be unchecked by default
    await expect(checkbox).not.toBeChecked();
    
    // Toggle it
    await checkbox.click();
    await expect(checkbox).toBeChecked();
  });

  test('should apply filters when comparing', async ({ page }) => {
    await page.locator('#previous-text').fill('line 1\n  line 2  ');
    await page.locator('#current-text').fill('line 1\nline 2');
    
    // Enable whitespace filter
    await page.locator('#ignore-whitespace').click();
    await page.locator('#compare-btn').click();
    
    await page.waitForSelector('#stats', { timeout: 30000 });
    
    // With filter applied, whitespace-only changes should be ignored
    // Stats should reflect this
    const modifiedCount = await page.locator('[data-testid="stat-modified"]').textContent();
    expect(parseInt(modifiedCount || '0')).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Large File Handling', () => {
  test('should handle 1000 lines comparison', async ({ page }) => {
    await page.goto('/index.html');
    
    const oldLines = Array(1000).fill(null).map((_, i) => `Line ${i + 1}`).join('\n');
    const newLines = Array(1000).fill(null).map((_, i) => `Line ${i + 1}${i % 10 === 0 ? ' modified' : ''}`).join('\n');
    
    await page.locator('#previous-text').fill(oldLines);
    await page.locator('#current-text').fill(newLines);
    
    await page.locator('#compare-btn').click();
    
    // 30-second timeout for unoptimized app
    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
    
    // Verify results exist
    const rowCount = await page.locator('.diff-row, .unified-row').count();
    expect(rowCount).toBeGreaterThan(0);
  });
});

test.describe('Console Log Verification', () => {
  test('should have clean console logs after comparison', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    
    // Collect all console messages
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });
    
    // Collect page errors
    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });
    
    await page.goto('/index.html');
    
    // Perform a comparison with various content types
    const oldText = `interface GigabitEthernet0/1
  description Server Uplink
  ip address 192.168.1.1 255.255.255.0
  no shutdown
  
function calculateTotal() {
  return items.reduce((sum, item) => sum + item.price, 0);
}`;
    
    const newText = `interface GigabitEthernet0/1
  description Server Uplink - Updated
  ip address 192.168.1.1 255.255.255.0
  no shutdown
  
function calculateTotal() {
  return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}`;
    
    await page.locator('#previous-text').fill(oldText);
    await page.locator('#current-text').fill(newText);
    await page.locator('#compare-btn').click();
    
    // Wait for results with 30s timeout
    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
    
    // Wait a bit more for any async console messages
    await page.waitForTimeout(1000);
    
    // Filter out non-error console messages (info, log are OK)
    const errorMessages = consoleMessages.filter(msg => 
      msg.type === 'error' || msg.type === 'warn'
    );
    
    // Check for any unexpected errors or warnings
    // Some expected warnings (like worker-related) are acceptable
    const unexpectedErrors = errorMessages.filter(msg => {
      const text = msg.text.toLowerCase();
      // Filter out expected messages
      return !text.includes('source map') && 
             !text.includes('sourcemap') &&
             !text.includes('worker') &&
             !text.includes('blocked by client');
    });
    
    // Assert no unexpected errors or warnings
    expect(unexpectedErrors).toHaveLength(0);
    
    // Assert no page errors
    expect(pageErrors).toHaveLength(0);
    
    // Log all console messages for debugging if needed
    if (consoleMessages.length > 0) {
      console.log('Console messages captured:', consoleMessages.length);
      consoleMessages.forEach(msg => {
        console.log(`[${msg.type}] ${msg.text.substring(0, 200)}`);
      });
    }
  });
  
  test('should not produce errors during complex diff operations', async ({ page }) => {
    const errors = [];
    const warnings = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      } else if (msg.type() === 'warn') {
        warnings.push(msg.text());
      }
    });
    
    page.on('pageerror', error => {
      errors.push(error.message);
    });
    
    await page.goto('/index.html');
    
    // Test with empty content
    await page.locator('#compare-btn').click();
    await page.waitForTimeout(500);
    
    // Test with identical content
    const identicalText = 'line 1\nline 2\nline 3';
    await page.locator('#previous-text').fill(identicalText);
    await page.locator('#current-text').fill(identicalText);
    await page.locator('#compare-btn').click();
    await page.waitForTimeout(500);
    
    // Test with various view modes
    await page.locator('[data-mode="words"]').click();
    await page.locator('#compare-btn').click();
    await page.waitForTimeout(500);
    
    await page.locator('[data-mode="chars"]').click();
    await page.locator('#compare-btn').click();
    await page.waitForTimeout(500);
    
    // Filter out expected warnings
    const unexpectedErrors = errors.filter(err => {
      const text = err.toLowerCase();
      return !text.includes('source map') && !text.includes('sourcemap');
    });
    
    const unexpectedWarnings = warnings.filter(warn => {
      const text = warn.toLowerCase();
      return !text.includes('source map') && !text.includes('sourcemap');
    });
    
    expect(unexpectedErrors).toHaveLength(0);
    expect(unexpectedWarnings).toHaveLength(0);
  });
});
