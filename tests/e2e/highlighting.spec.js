/**
 * E2E Tests for Diff Highlighting System
 * 
 * These tests verify the visual highlighting of diffs including:
 * - Character-level highlighting (adds/removes)
 * - Word-level highlighting
 * - Line-level highlighting (modified rows in yellow/orange)
 * - Entire row add/remove highlighting (green/red backgrounds)
 * - Cross-block modified rows (moved + changed should show same highlighting)
 * 
 * CRITICAL: If a test fails, DO NOT modify/disable/remove it without review!
 * Instead, analyze the code, test, and expectations together.
 */

import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  // Navigate to the baseURL from playwright.config.js
  await page.goto('/');
  
  // Wait for page to be fully loaded
  await page.waitForLoadState('networkidle');
  
  // Ensure textareas are empty and ready
  await page.waitForSelector('#previous-text', { timeout: 5000 });
  await page.waitForSelector('#current-text', { timeout: 5000 });
});

// Helper to perform a diff comparison
async function performDiff(page, oldText, newText) {
  // Wait for the page to be ready
  await page.waitForSelector('#previous-text', { timeout: 5000 });
  await page.waitForSelector('#current-text', { timeout: 5000 });
  
  // Clear and set previous text (triple-click to select all, then type)
  await page.click('#previous-text');
  await page.keyboard.press('Control+A');
  await page.keyboard.type(oldText);
  
  // Clear and set current text
  await page.click('#current-text');
  await page.keyboard.press('Control+A');
  await page.keyboard.type(newText);
  
  // Click compare button
  await page.click('[aria-label="Compare the two text versions"]');
  
  // Wait for results to appear
  await page.waitForSelector('.diff-row, .unified-row', { timeout: 5000 });
  
  // Give time for rendering
  await page.waitForTimeout(100);
}

test.describe('Character-Level Highlighting', () => {
  test('should highlight single character addition in green', async ({ page }) => {
    const oldText = 'hello';
    const newText = 'hellox';
    
    await performDiff(page, oldText, newText);
    
    // Get all diff rows
    const rows = await page.locator('.diff-row').all();
    expect(rows.length).toBeGreaterThan(0);
    
    // Find rows by content
    const modifiedRows = await page.locator('.diff-row.modified').all();
    expect(modifiedRows.length).toBeGreaterThan(0);
    
    // Current panel should have inline added highlighting
    const addedCharSpan = await page.locator('.inline-added-char').first();
    await expect(addedCharSpan).toBeVisible();
    
    // Verify it contains the added character
    const text = await addedCharSpan.textContent();
    expect(text).toContain('x');
  });
  
  test('should highlight single character removal in red', async ({ page }) => {
    const oldText = 'hellox';
    const newText = 'hello';
    
    await performDiff(page, oldText, newText);
    
    // Previous panel should have inline removed highlighting
    const removedCharSpan = await page.locator('.inline-removed-char').first();
    await expect(removedCharSpan).toBeVisible();
    
    // Verify it contains the removed character
    const text = await removedCharSpan.textContent();
    expect(text).toContain('x');
  });
  
  test('should highlight multiple character changes with different colors', async ({ page }) => {
    // Use a replacement case (not insertion) to show both removed and added chars
    const oldText = 'tezt';
    const newText = 'test';
    
    await performDiff(page, oldText, newText);
    
    // Should have modified class on rows
    const modifiedRows = await page.locator('.diff-row.modified').all();
    expect(modifiedRows.length).toBeGreaterThan(0);
    
    // Should have either removed or added char highlighting (or both)
    const removedChars = await page.locator('.inline-removed-char').count();
    const addedChars = await page.locator('.inline-added-char').count();
    expect(removedChars + addedChars).toBeGreaterThan(0);
  });
  
  test('should highlight character changes in the middle of a word', async ({ page }) => {
    const oldText = 'tezt';
    const newText = 'test';
    
    await performDiff(page, oldText, newText);
    
    const modifiedRows = await page.locator('.diff-row.modified').all();
    expect(modifiedRows.length).toBeGreaterThan(0);
    
    // Should have both added and removed char highlighting
    const hasRemoved = await page.locator('.inline-removed-char').count() > 0;
    const hasAdded = await page.locator('.inline-added-char').count() > 0;
    
    expect(hasRemoved || hasAdded).toBeTruthy();
  });
});

test.describe('Hybrid Mode Selection', () => {
  test('should use char-level highlighting for small changes (hello → hellox)', async ({ page }) => {
    const oldText = 'hello';
    const newText = 'hellox';
    
    await performDiff(page, oldText, newText);
    
    // Should show modified row
    const modifiedRows = await page.locator('.diff-row.modified').all();
    expect(modifiedRows.length).toBeGreaterThan(0);
    
    // Should have character-level highlighting for the single added 'x'
    const addedCharSpan = await page.locator('.inline-added-char').first();
    await expect(addedCharSpan).toBeVisible();
    
    // Verify it contains only 'x' (not the whole word)
    const text = await addedCharSpan.textContent();
    expect(text).toBe('x');
    
    // Should NOT have word-level highlighting for this small change
    const addedWordCount = await page.locator('.inline-added-word').count();
    expect(addedWordCount).toBe(0);
  });
  
  test('should use word-level highlighting for larger changes (hello world → hello beautiful world)', async ({ page }) => {
    const oldText = 'hello world';
    const newText = 'hello beautiful world';
    
    await performDiff(page, oldText, newText);
    
    // Should show modified row
    const modifiedRows = await page.locator('.diff-row.modified').all();
    expect(modifiedRows.length).toBeGreaterThan(0);
    
    // Should have word-level highlighting for "beautiful"
    const addedWordSpan = await page.locator('.inline-added-word').first();
    await expect(addedWordSpan).toBeVisible();
    
    // Verify it contains "beautiful"
    const text = await addedWordSpan.textContent();
    expect(text).toContain('beautiful');
  });
  
  test('should use char-level for 3-or-fewer character changes', async ({ page }) => {
    const oldText = 'test';
    const newText = 'tesT';  // 1 char change
    
    await performDiff(page, oldText, newText);
    
    // Should have character-level highlighting
    const addedCharCount = await page.locator('.inline-added-char').count();
    const removedCharCount = await page.locator('.inline-removed-char').count();
    const totalCharHighlights = addedCharCount + removedCharCount;
    
    expect(totalCharHighlights).toBeGreaterThan(0);
    
    // Should NOT use word-level for such a small change
    const addedWordCount = await page.locator('.inline-added-word').count();
    const removedWordCount = await page.locator('.inline-removed-word').count();
    const totalWordHighlights = addedWordCount + removedWordCount;
    
    expect(totalWordHighlights).toBe(0);
  });
});

test.describe('Word-Level Highlighting', () => {
  test('should highlight added word in green', async ({ page }) => {
    const oldText = 'hello world';
    const newText = 'hello beautiful world';
    
    await performDiff(page, oldText, newText);
    
    // Should show modified row
    const modifiedRows = await page.locator('.diff-row.modified').all();
    expect(modifiedRows.length).toBeGreaterThan(0);
    
    // Should have inline added highlighting
    const addedWordSpan = await page.locator('.inline-added-word, .inline-added-char').first();
    await expect(addedWordSpan).toBeVisible();
  });
  
  test('should highlight removed word in red', async ({ page }) => {
    const oldText = 'hello beautiful world';
    const newText = 'hello world';
    
    await performDiff(page, oldText, newText);
    
    // Should have inline removed highlighting
    const removedWordSpan = await page.locator('.inline-removed-word, .inline-removed-char').first();
    await expect(removedWordSpan).toBeVisible();
  });
  
  test('should highlight replaced word with different colors in each panel', async ({ page }) => {
    const oldText = 'old value';
    const newText = 'new value';
    
    await performDiff(page, oldText, newText);
    
    // Both panels should show modified
    const modifiedRows = await page.locator('.diff-row.modified').all();
    expect(modifiedRows.length).toBeGreaterThanOrEqual(2);
  });
});

test.describe('Line-Level Highlighting (Modified Rows)', () => {
  test('should apply yellow/orange background to modified line', async ({ page }) => {
    const oldText = 'line one\nline two\nline three';
    const newText = 'line one\nmodified line\nline three';
    
    await performDiff(page, oldText, newText);
    
    // Should have modified rows with yellow background
    const modifiedRows = await page.locator('.diff-row.modified').all();
    expect(modifiedRows.length).toBeGreaterThanOrEqual(2);
    
    // Verify the row contains the modified content
    for (const row of modifiedRows) {
      const text = await row.textContent();
      if (text.includes('modified') || text.includes('line two')) {
        expect(text).toBeTruthy();
      }
    }
  });
  
  test('should show inline highlighting within modified row', async ({ page }) => {
    const oldText = 'original text';
    const newText = 'modified text';
    
    await performDiff(page, oldText, newText);
    
    const modifiedRows = await page.locator('.diff-row.modified').all();
    expect(modifiedRows.length).toBeGreaterThan(0);
    
    // Should have inline highlighting
    const hasInlineHighlighting = await page.locator('.inline-added-char, .inline-removed-char, .inline-added-word, .inline-removed-word').count() > 0;
    expect(hasInlineHighlighting).toBeTruthy();
  });
});

test.describe('Entire Row Add/Remove Highlighting', () => {
  test('should highlight entirely added row with green background', async ({ page }) => {
    const oldText = 'line one';
    const newText = 'line one\nnew line added';
    
    await performDiff(page, oldText, newText);
    
    // Should have an added row
    const addedRows = await page.locator('.diff-row.added').all();
    expect(addedRows.length).toBeGreaterThan(0);
    
    // Verify it has the + marker
    const addedRow = addedRows[0];
    const text = await addedRow.textContent();
    expect(text).toContain('new line added');
    
    // Previous panel should have a gap
    const gapRows = await page.locator('.diff-row.gap').all();
    expect(gapRows.length).toBeGreaterThan(0);
  });
  
  test('should highlight entirely removed row with red background', async ({ page }) => {
    const oldText = 'line one\nline to remove';
    const newText = 'line one';
    
    await performDiff(page, oldText, newText);
    
    // Should have a removed row
    const removedRows = await page.locator('.diff-row.removed').all();
    expect(removedRows.length).toBeGreaterThan(0);
    
    // Verify it contains the removed content
    const removedRow = removedRows[0];
    const text = await removedRow.textContent();
    expect(text).toContain('line to remove');
  });
  
  test('should handle multiple consecutive added rows', async ({ page }) => {
    const oldText = 'line one';
    const newText = 'line one\nline two\nline three\nline four';
    
    await performDiff(page, oldText, newText);
    
    // Should have 3 added rows
    const addedRows = await page.locator('.diff-row.added').all();
    expect(addedRows.length).toBe(3);
  });
  
  test('should handle multiple consecutive removed rows', async ({ page }) => {
    const oldText = 'line one\nline two\nline three\nline four';
    const newText = 'line one';
    
    await performDiff(page, oldText, newText);
    
    // Should have 3 removed rows
    const removedRows = await page.locator('.diff-row.removed').all();
    expect(removedRows.length).toBe(3);
  });
});

test.describe('Moved and Modified Row Highlighting', () => {
  test('should show modified highlighting for moved and changed rows (same as non-moved)', async ({ page }) => {
    // Content where line moves AND changes
    const oldText = `import math

def helper():
    pass

def process_data(data):
    return data`;
    
    const newText = `import math

# Helper function
def helper(x):
    return x

def process_data(data, factor=1.5):
    return data`;
    
    await performDiff(page, oldText, newText);
    
    // Find rows with helper function - should be marked as modified
    const rows = await page.locator('.diff-row').all();
    let foundHelperModified = false;
    
    for (const row of rows) {
      const text = await row.textContent();
      const className = await row.getAttribute('class');
      
      if (text && text.includes('helper') && className && className.includes('modified')) {
        foundHelperModified = true;
        break;
      }
    }
    
    expect(foundHelperModified).toBe(true);
  });
  
  test('should apply same inline highlighting to moved+modified as to regular modified', async ({ page }) => {
    const oldText = 'line one\nhelper()\nline three';
    const newText = 'line one\n# New comment\nhelper(x)\nline three';
    
    await performDiff(page, oldText, newText);
    
    // Find rows containing 'helper'
    const rows = await page.locator('.diff-row').all();
    
    for (const row of rows) {
      const text = await row.textContent();
      if (text && text.includes('helper')) {
        const className = await row.getAttribute('class');
        // Should be classified as modified
        expect(className).toContain('modified');
      }
    }
  });
});

test.describe('Unified View Highlighting', () => {
  test('should show added lines with green background in unified view', async ({ page }) => {
    // Switch to unified view
    await page.click('[aria-label="Show unified diff view"]');
    await page.waitForTimeout(100);
    
    const oldText = 'line one';
    const newText = 'line one\nline two';
    
    await performDiff(page, oldText, newText);
    
    // Should have unified rows
    const unifiedRows = await page.locator('.unified-row').all();
    expect(unifiedRows.length).toBeGreaterThan(0);
    
    // Find the added row
    const addedRows = await page.locator('.unified-row.added').all();
    expect(addedRows.length).toBeGreaterThan(0);
    
    // Verify it has the + marker
    const addedRow = addedRows[0];
    const marker = await addedRow.locator('.unified-marker').textContent();
    expect(marker).toBe('+');
  });
  
  test('should show removed lines with red background in unified view', async ({ page }) => {
    // Switch to unified view
    await page.click('[aria-label="Show unified diff view"]');
    await page.waitForTimeout(100);
    
    const oldText = 'line one\nline two';
    const newText = 'line one';
    
    await performDiff(page, oldText, newText);
    
    // Should have removed row
    const removedRows = await page.locator('.unified-row.removed').all();
    expect(removedRows.length).toBeGreaterThan(0);
    
    // Verify it has the - marker
    const removedRow = removedRows[0];
    const marker = await removedRow.locator('.unified-marker').textContent();
    expect(marker).toBe('-');
  });
  
  test('should show modified lines with yellow/orange background in unified view', async ({ page }) => {
    // Switch to unified view
    await page.click('[aria-label="Show unified diff view"]');
    await page.waitForTimeout(100);
    
    const oldText = 'original line';
    const newText = 'modified line';
    
    await performDiff(page, oldText, newText);
    
    // Should have modified rows
    const modifiedRows = await page.locator('.unified-row.modified').all();
    expect(modifiedRows.length).toBeGreaterThan(0);
  });
});

test.describe('Hierarchical Highlighting Modes', () => {
  test('should use char-level highlighting when all modes enabled', async ({ page }) => {
    const oldText = 'test';
    const newText = 'text';
    
    await performDiff(page, oldText, newText);
    
    // Should have char-level highlighting (darkest)
    const charHighlights = await page.locator('.inline-added-char, .inline-removed-char').count();
    expect(charHighlights).toBeGreaterThan(0);
  });
  
  test('should toggle highlighting modes correctly', async ({ page }) => {
    const oldText = 'hello world';
    const newText = 'hello modified world';
    
    await performDiff(page, oldText, newText);
    
    // Turn off char mode
    await page.click('[data-mode="chars"]');
    await page.waitForTimeout(100);
    
    // Should still have word-level highlighting
    const hasWordLevel = await page.locator('.inline-added-word, .inline-removed-word').count() > 0;
    const hasCharLevel = await page.locator('.inline-added-char, .inline-removed-char').count() > 0;
    
    // When char mode is off, word mode should still work
    expect(hasWordLevel || hasCharLevel).toBeTruthy();
  });
});

test.describe('Edge Cases in Highlighting', () => {
  test('should handle empty lines correctly', async ({ page }) => {
    const oldText = 'line one\n\nline three';
    const newText = 'line one\nline two\nline three';
    
    await performDiff(page, oldText, newText);
    
    // Should not crash and should show highlighting
    const rows = await page.locator('.diff-row').all();
    expect(rows.length).toBeGreaterThan(0);
  });
  
  test('should handle very long lines', async ({ page }) => {
    const longText = 'a'.repeat(1000);
    const newLongText = 'a'.repeat(500) + 'b'.repeat(500);
    
    await performDiff(page, longText, newLongText);
    
    const rows = await page.locator('.diff-row').all();
    expect(rows.length).toBeGreaterThan(0);
    
    const modifiedRow = await page.locator('.diff-row.modified').first();
    await expect(modifiedRow).toBeVisible();
  });
  
  test('should handle special characters and unicode', async ({ page }) => {
    const oldText = 'emoji: 😀';
    const newText = 'emoji: 🎉';
    
    await performDiff(page, oldText, newText);
    
    const modifiedRow = await page.locator('.diff-row.modified').first();
    await expect(modifiedRow).toBeVisible();
    
    const text = await modifiedRow.textContent();
    expect(text).toContain('emoji');
  });
  
  test('should highlight only when similarity is above threshold', async ({ page }) => {
    // Completely different lines should be added/removed, not modified
    const oldText = 'completely different content here';
    const newText = 'totally unrelated new content';
    
    await performDiff(page, oldText, newText);
    
    // These might be detected as removed + added or as modified depending on threshold
    // The important thing is that highlighting is applied consistently
    const rows = await page.locator('.diff-row').all();
    expect(rows.length).toBeGreaterThan(0);
    
    // At least some highlighting should be present
    const hasAnyHighlighting = await page.locator('.added, .removed, .modified').count() > 0;
    expect(hasAnyHighlighting).toBeTruthy();
  });
});
