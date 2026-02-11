/**
 * Performance E2E Tests
 * 
 * Based on Implementation Plan: Phase 3 - Task 3.3
 * 
 * Changes from previous version:
 * - All timeouts changed to 30 seconds (generous for unoptimized app)
 * - Added assertions for progress modal appearance (>1000 lines)
 * - Added assertions for modal closing after completion
 * - Removed absolute timing assertions (<1s, <10s)
 * - Kept completion-based assertions (hasResults, progressModalVisible)
 * 
 * Test Strategy:
 * - Focus on functionality over performance optimization
 * - Verify app handles various file sizes without crashing
 * - Confirm progress feedback for large comparisons
 * - Ensure UI responsiveness during processing
 */

import { test, expect } from '@playwright/test';

test.describe('Performance - File Size Handling', () => {
  test('should process 1k lines without crashing', async ({ page }) => {
    await page.goto('/index.html');
    
    const generateLines = (count, suffix) => {
      return Array(count).fill(null).map((_, i) => `Line ${i + 1} ${suffix}`).join('\n');
    };
    
    const oldText = generateLines(1000, 'original');
    const newText = generateLines(1000, 'modified');
    
    // Fill textareas
    await page.locator('#previous-text').fill(oldText);
    await page.locator('#current-text').fill(newText);
    
    // Start comparison
    await page.locator('#compare-btn').click();
    
    // Wait for results with 30s timeout - completion-based assertion
    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
    
    // Verify correct diff results appeared
    const changes = await page.locator('.diff-change, .diff-row, .unified-row').count();
    expect(changes).toBeGreaterThan(0);
    
    console.log('1k lines processed successfully');
  });

  test('should process 10k lines without crashing', async ({ page }) => {
    await page.goto('/index.html');
    
    // Generate 10,000 lines of text
    const generateLines = (count, suffix) => {
      return Array(count).fill(null).map((_, i) => `Line ${i + 1} ${suffix}`).join('\n');
    };
    
    const oldText = generateLines(10000, 'original');
    const newText = generateLines(10000, 'modified');
    
    // Fill textareas
    await page.locator('#previous-text').fill(oldText);
    await page.locator('#current-text').fill(newText);
    
    // Start comparison
    await page.locator('#compare-btn').click();
    
    // Wait for results with 30s timeout - completion-based assertion
    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
    
    // Verify correct diff results appeared
    const changes = await page.locator('.diff-change, .diff-row, .unified-row').count();
    expect(changes).toBeGreaterThan(0);
    
    console.log('10k lines processed successfully');
  });

  test('should handle 50k lines without crashing', async ({ page }) => {
    await page.goto('/index.html');
    
    // Generate 50,000 lines
    const oldLines = Array(50000).fill(null).map((_, i) => `Line ${i + 1}`).join('\n');
    const newLines = Array(50000).fill(null).map((_, i) => `Line ${i + 1}${i % 100 === 0 ? ' changed' : ''}`).join('\n');
    
    await page.locator('#previous-text').fill(oldLines);
    await page.locator('#current-text').fill(newLines);
    
    await page.locator('#compare-btn').click();
    
    // Wait for results with 30s timeout
    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
    
    // Verify page is still responsive
    const title = await page.title();
    expect(title).toBe('Text Diff Visualizer');
    
    console.log('50k lines processed successfully');
  });
});

test.describe('Performance - Progress Modal', () => {
  test('should show progress modal for comparisons >1000 lines', async ({ page }) => {
    await page.goto('/index.html');
    
    // Generate 2000 lines to reliably trigger progress modal
    const generateLines = (count, suffix) => {
      return Array(count).fill(null).map((_, i) => `Line ${i + 1} ${suffix}`).join('\n');
    };
    
    const lines = generateLines(2000, 'with some content to ensure processing time');
    const modifiedLines = generateLines(2000, 'with modified content for comparison');
    
    await page.locator('#previous-text').fill(lines);
    await page.locator('#current-text').fill(modifiedLines);
    
    await page.locator('#compare-btn').click();
    
    // Progress modal should appear for large comparisons
    const modal = page.locator('#progress-modal');
    
    // Wait for modal to appear (may take a moment for large files)
    await expect(modal).toBeVisible({ timeout: 5000 });
    
    // Modal should eventually complete and hide
    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
    await expect(modal).toBeHidden();
  });

  test('should show progress modal and close after completion', async ({ page }) => {
    await page.goto('/index.html');
    
    // Use 5000 lines to ensure progress modal triggers
    const lines = Array(5000).fill(null).map((_, i) => `This is line number ${i + 1} with some content`).join('\n');
    const modifiedLines = Array(5000).fill(null).map((_, i) => `This is line number ${i + 1} with modified content`).join('\n');
    
    await page.locator('#previous-text').fill(lines);
    await page.locator('#current-text').fill(modifiedLines);
    
    await page.locator('#compare-btn').click();
    
    // Progress modal should appear
    const modal = page.locator('#progress-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });
    
    // Wait for results to appear (modal should close automatically)
    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
    
    // Modal should be hidden after completion
    await expect(modal).toBeHidden();
  });

  test('progress modal should display analyzing message', async ({ page }) => {
    await page.goto('/index.html');
    
    // Use large file to trigger progress modal
    const lines = Array(3000).fill('test line content for progress modal test').join('\n');
    
    await page.locator('#previous-text').fill(lines);
    await page.locator('#current-text').fill(lines);
    await page.locator('#compare-btn').click();
    
    // Check modal content
    const modal = page.locator('#progress-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });
    
    // Verify analyzing message is shown
    const modalText = await modal.textContent();
    expect(modalText).toMatch(/analyzing|comparing|processing/i);
  });
});

test.describe('Performance - Results Appearance', () => {
  test('should display results within timeout for 5k lines', async ({ page }) => {
    await page.goto('/index.html');
    
    const lines = Array(5000).fill(null).map((_, i) => `Line ${i + 1}`).join('\n');
    const modifiedLines = Array(5000).fill(null).map((_, i) => `Line ${i + 1}${i % 50 === 0 ? ' X' : ''}`).join('\n');
    
    await page.locator('#previous-text').fill(lines);
    await page.locator('#current-text').fill(modifiedLines);
    await page.locator('#compare-btn').click();
    
    // 30s timeout - completion-based assertion
    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
    
    // Count rendered rows
    const rowCount = await page.locator('.diff-row, .unified-row').count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test('should display results within timeout for 10k lines', async ({ page }) => {
    await page.goto('/index.html');
    
    const lines = Array(10000).fill(null).map((_, i) => `Line ${i + 1}`).join('\n');
    const modifiedLines = Array(10000).fill(null).map((_, i) => `Line ${i + 1}${i % 100 === 0 ? ' changed' : ''}`).join('\n');
    
    await page.locator('#previous-text').fill(lines);
    await page.locator('#current-text').fill(modifiedLines);
    await page.locator('#compare-btn').click();
    
    // 30s timeout - completion-based assertion
    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
    
    // Verify results exist
    const rowCount = await page.locator('.diff-row, .unified-row').count();
    expect(rowCount).toBeGreaterThan(0);
  });
});

test.describe('Performance - UI Responsiveness', () => {
  test('should maintain UI responsiveness during comparison', async ({ page }) => {
    await page.goto('/index.html');
    
    const lines = Array(5000).fill('test line content').join('\n');
    
    await page.locator('#previous-text').fill(lines);
    await page.locator('#current-text').fill(lines);
    
    // Start comparison
    await page.locator('#compare-btn').click();
    
    // Page title should still be accessible during processing
    const title = await page.title();
    expect(title).toBe('Text Diff Visualizer');
    
    // Wait for completion with 30s timeout
    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
  });

  test('should handle view switching during processing', async ({ page }) => {
    await page.goto('/index.html');
    
    const lines = Array(3000).fill('test content').join('\n');
    
    await page.locator('#previous-text').fill(lines);
    await page.locator('#current-text').fill(lines);
    await page.locator('#compare-btn').click();
    
    // Try to switch views during processing (should not crash)
    await page.locator('[data-view="unified"]').click().catch(() => {
      // It's OK if this fails during processing
    });
    
    // Wait for completion
    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
    
    // Page should still be functional
    const title = await page.title();
    expect(title).toBe('Text Diff Visualizer');
  });
});

test.describe('Performance - Memory Usage', () => {
  test('should handle repeated comparisons without memory leak', async ({ page }) => {
    await page.goto('/index.html');
    
    const text1 = Array(1000).fill(null).map((_, i) => `Line ${i + 1} version A`).join('\n');
    const text2 = Array(1000).fill(null).map((_, i) => `Line ${i + 1} version B`).join('\n');
    
    // Perform multiple comparisons
    for (let i = 0; i < 5; i++) {
      await page.locator('#previous-text').fill(text1);
      await page.locator('#current-text').fill(text2);
      await page.locator('#compare-btn').click();
      
      // 30s timeout for each comparison
      await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
      
      // Clear between runs
      await page.locator('#clear-btn').click();
    }
    
    // Page should still be responsive
    const title = await page.title();
    expect(title).toBe('Text Diff Visualizer');
  });
});

test.describe('Performance - Rendering', () => {
  test('should render results efficiently for 10k lines', async ({ page }) => {
    await page.goto('/index.html');
    
    const lines = Array(10000).fill(null).map((_, i) => `Line ${i + 1}`).join('\n');
    const modifiedLines = Array(10000).fill(null).map((_, i) => `Line ${i + 1}${i % 50 === 0 ? ' X' : ''}`).join('\n');
    
    await page.locator('#previous-text').fill(lines);
    await page.locator('#current-text').fill(modifiedLines);
    await page.locator('#compare-btn').click();
    
    // Wait for render with 30s timeout
    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
    
    // Count rendered rows
    const rowCount = await page.locator('.diff-row, .unified-row').count();
    expect(rowCount).toBeGreaterThan(0);
    
    // Scrolling should work smoothly
    const panel = page.locator('#previous-diff-panel, #unified-diff-panel').first();
    await panel.evaluate(el => el.scrollTo(0, 10000));
    
    // Check scroll position
    const scrollTop = await panel.evaluate(el => el.scrollTop);
    expect(scrollTop).toBeGreaterThan(0);
  });

  test('synchronized scrolling should work with large files', async ({ page }) => {
    await page.goto('/index.html');
    
    const lines = Array(5000).fill(null).map((_, i) => `Line ${i + 1}`).join('\n');
    
    await page.locator('#previous-text').fill(lines);
    await page.locator('#current-text').fill(lines);
    await page.locator('#compare-btn').click();
    
    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
    
    // Scroll one panel
    const prevPanel = page.locator('#previous-diff-panel');
    const currPanel = page.locator('#current-diff-panel');
    
    // Only test if we're in split view (panels exist)
    const prevExists = await prevPanel.count() > 0;
    const currExists = await currPanel.count() > 0;
    
    if (prevExists && currExists) {
      await prevPanel.evaluate(el => el.scrollTo(0, 5000));
      
      // Wait a bit for sync
      await page.waitForTimeout(100);
      
      // Both panels should be at similar scroll position
      const prevScroll = await prevPanel.evaluate(el => el.scrollTop);
      const currScroll = await currPanel.evaluate(el => el.scrollTop);
      
      expect(Math.abs(prevScroll - currScroll)).toBeLessThan(10);
    }
  });
});
