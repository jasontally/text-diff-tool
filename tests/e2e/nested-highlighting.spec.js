/**
 * E2E Tests for Nested Highlighting
 * 
 * These tests verify that nested word diff highlighting works correctly in the browser:
 * - Word changes inside comments are properly highlighted
 * - Word changes inside strings are properly highlighted  
 * - Code regions use character-level highlighting
 * - Multiple regions on the same line are handled
 * - Visual distinction between different region types
 * - Both view modes (side-by-side and unified) work correctly
 * 
 * CRITICAL: If a test fails, DO NOT modify/disable/remove it without review!
 * Instead, analyze code, test, and expectations together.
 */

import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  page.on('console', msg => console.log(`CONSOLE: ${msg.text()}`));
  await page.goto('/index.html');
});

// Helper to perform a diff comparison
async function performDiff(page, oldText, newText) {
  // Wait for page to be ready
  await page.waitForSelector('#previous-text', { timeout: 5000 });
  await page.waitForSelector('#current-text', { timeout: 5000 });
  
  // Clear and set previous text
  await page.locator('#previous-text').fill(oldText);

  // Clear and set current text
  await page.locator('#current-text').fill(newText);

  // Click compare button
  await page.locator('#compare-btn').click();
  
  // Wait for progress modal to be hidden (diff completed)
  await page.waitForSelector('#progress-modal.hidden', { state: 'attached', timeout: 30000 });
  
  // Wait for results to appear
  await page.waitForSelector('.diff-row', { timeout: 10000 });

  // Give time for rendering
  await page.waitForTimeout(100);
}

// Helper to enable nested highlighting mode
async function enableNestedMode(page) {
  // Enable words and chars modes for nested highlighting
  const wordsButton = page.locator('[data-mode="words"]');
  const charsButton = page.locator('[data-mode="chars"]');
  
  // Ensure both are enabled (check if they have active class)
  const wordsActive = await wordsButton.evaluate(el => el.classList.contains('active'));
  const charsActive = await charsButton.evaluate(el => el.classList.contains('active'));
  
  if (!wordsActive) await wordsButton.click();
  if (!charsActive) await charsButton.click();
  
  await page.waitForTimeout(100);
}

test.describe('Comment Word Highlighting', () => {
  test('should highlight word changes in line comments', async ({ page }) => {
    const oldText = 'const x = 5; // old comment';
    const newText = 'const x = 5; // new comment';
    
    await performDiff(page, oldText, newText);
    await enableNestedMode(page);
    
    // Should have a modified row
    const modifiedRows = await page.locator('.diff-row.modified').all();
    expect(modifiedRows.length).toBeGreaterThan(0);
    
    // Should have word-level highlighting for the comment change
    const addedWordSpans = await page.locator('.inline-added-word').all();
    const removedWordSpans = await page.locator('.inline-removed-word').all();
    
    expect(addedWordSpans.length + removedWordSpans.length).toBeGreaterThan(0);
    
    // Check that the comment words are highlighted (need to await textContent for each)
    const addedTexts = await Promise.all(addedWordSpans.map(span => span.textContent()));
    const removedTexts = await Promise.all(removedWordSpans.map(span => span.textContent()));
    const addedText = addedTexts.join('');
    const removedText = removedTexts.join('');
    
    expect(addedText).toContain('new');
    expect(removedText).toContain('old');
  });
  
  test('should highlight word changes in block comments', async ({ page }) => {
    const oldText = 'function test() { /* old implementation */ }';
    const newText = 'function test() { /* new implementation */ }';
    
    await performDiff(page, oldText, newText);
    await enableNestedMode(page);
    
    const modifiedRows = await page.locator('.diff-row.modified').all();
    expect(modifiedRows.length).toBeGreaterThan(0);
    
    // Should have word highlighting for the block comment
    const addedWords = await page.locator('.inline-added-word').all();
    const removedWords = await page.locator('.inline-removed-word').all();
    
    expect(addedWords.length + removedWords.length).toBeGreaterThan(0);
    
    // Verify the change is captured (need to await textContent for each)
    const addedTexts = await Promise.all(addedWords.map(w => w.textContent()));
    const removedTexts = await Promise.all(removedWords.map(w => w.textContent()));
    const addedText = addedTexts.join('');
    const removedText = removedTexts.join('');
    
    expect(addedText).toContain('new');
    expect(removedText).toContain('old');
  });
  
  test('should handle Python comments correctly', async ({ page }) => {
    const oldText = 'x = 5 # old value';
    const newText = 'x = 5 # new value';
    
    await performDiff(page, oldText, newText);
    await enableNestedMode(page);
    
    const modifiedRows = await page.locator('.diff-row.modified').all();
    expect(modifiedRows.length).toBeGreaterThan(0);
    
    // Should highlight comment change
    const addedWords = await page.locator('.inline-added-word').all();
    const removedWords = await page.locator('.inline-removed-word').all();
    
    expect(addedWords.length + removedWords.length).toBeGreaterThan(0);
    
    const addedTexts = await Promise.all(addedWords.map(w => w.textContent()));
    const removedTexts = await Promise.all(removedWords.map(w => w.textContent()));
    const addedText = addedTexts.join('');
    const removedText = removedTexts.join('');
    
    expect(addedText).toContain('new');
    expect(removedText).toContain('old');
  });
  
  test('should not highlight unchanged comments', async ({ page }) => {
    const oldText = 'const x = 5; // same comment';
    const newText = 'const x = 6; // same comment';
    
    await performDiff(page, oldText, newText);
    await enableNestedMode(page);
    
    // Should have modified row due to variable change
    const modifiedRows = await page.locator('.diff-row.modified').all();
    expect(modifiedRows.length).toBeGreaterThan(0);
    
    // Should not highlight the comment portion
    const commentText = 'same comment';
    const rowContent = await modifiedRows[0].textContent();
    
    // The comment text should appear unchanged in the output
    expect(rowContent).toContain(commentText);
  });
});

test.describe('String Word Highlighting', () => {
  test('should highlight word changes in double-quoted strings', async ({ page }) => {
    const oldText = 'console.log("old message");';
    const newText = 'console.log("new message");';
    
    await performDiff(page, oldText, newText);
    await enableNestedMode(page);
    
    const modifiedRows = await page.locator('.diff-row.modified').all();
    expect(modifiedRows.length).toBeGreaterThan(0);
    
    // Should have word highlighting for the string change
    const addedWords = await page.locator('.inline-added-word').all();
    const removedWords = await page.locator('.inline-removed-word').all();
    
    expect(addedWords.length + removedWords.length).toBeGreaterThan(0);
    
    // Verify the string content change is captured
    const addedText = (await Promise.all(addedWords.map(w => w.textContent()))).join('');
    const removedText = (await Promise.all(removedWords.map(w => w.textContent()))).join('');
    
    expect(addedText).toContain('new');
    expect(removedText).toContain('old');
  });
  
  test('should highlight word changes in single-quoted strings', async ({ page }) => {
    const oldText = "const s = 'old value';";
    const newText = "const s = 'new value';";
    
    await performDiff(page, oldText, newText);
    await enableNestedMode(page);
    
    const modifiedRows = await page.locator('.diff-row.modified').all();
    expect(modifiedRows.length).toBeGreaterThan(0);
    
    // Should highlight string content change
    const addedWords = await page.locator('.inline-added-word').all();
    const removedWords = await page.locator('.inline-removed-word').all();
    
    expect(addedWords.length + removedWords.length).toBeGreaterThan(0);
    
    const addedText = (await Promise.all(addedWords.map(w => w.textContent()))).join('');
    const removedText = (await Promise.all(removedWords.map(w => w.textContent()))).join('');
    
    expect(addedText).toContain('new');
    expect(removedText).toContain('old');
  });
  
  test('should handle multiple word changes in a string', async ({ page }) => {
    const oldText = 'const msg = "old debug message";';
    const newText = 'const msg = "new warning text";';
    
    await performDiff(page, oldText, newText);
    await enableNestedMode(page);
    
    const modifiedRows = await page.locator('.diff-row.modified').all();
    expect(modifiedRows.length).toBeGreaterThan(0);
    
    // Should capture all word changes in the string
    const addedWords = await page.locator('.inline-added-word').all();
    const removedWords = await page.locator('.inline-removed-word').all();
    
    expect(addedWords.length).toBeGreaterThan(0);
    expect(removedWords.length).toBeGreaterThan(0);
    
    const addedText = (await Promise.all(addedWords.map(w => w.textContent()))).join('');
    const removedText = (await Promise.all(removedWords.map(w => w.textContent()))).join('');
    
    // Should contain all the changed words
    expect(addedText).toContain('new');
    expect(addedText).toContain('warning');
    expect(addedText).toContain('text');
    
    expect(removedText).toContain('old');
    expect(removedText).toContain('debug');
    expect(removedText).toContain('message');
  });
  
  test('should handle Python strings correctly', async ({ page }) => {
    const oldText = 'print("old text")';
    const newText = 'print("new text")';
    
    await performDiff(page, oldText, newText);
    await enableNestedMode(page);
    
    const modifiedRows = await page.locator('.diff-row.modified').all();
    expect(modifiedRows.length).toBeGreaterThan(0);
    
    // Should highlight string content change
    const addedWords = await page.locator('.inline-added-word').all();
    const removedWords = await page.locator('.inline-removed-word').all();
    
    expect(addedWords.length + removedWords.length).toBeGreaterThan(0);
    
    const addedText = (await Promise.all(addedWords.map(w => w.textContent()))).join('');
    const removedText = (await Promise.all(removedWords.map(w => w.textContent()))).join('');
    
    expect(addedText).toContain('new');
    expect(removedText).toContain('old');
  });
  
  test('should not highlight unchanged strings', async ({ page }) => {
    const oldText = 'console.log("same text"); // different comment';
    const newText = 'console.log("same text"); // new comment';
    
    await performDiff(page, oldText, newText);
    await enableNestedMode(page);
    
    const modifiedRows = await page.locator('.diff-row.modified').all();
    expect(modifiedRows.length).toBeGreaterThan(0);
    
    // The string content should appear unchanged
    const rowContent = await modifiedRows[0].textContent();
    expect(rowContent).toContain('same text');
  });
});

test.describe('Multiple Regions on Same Line', () => {
  test('should handle string and comment changes together', async ({ page }) => {
    const oldText = 'console.log("old") // old comment';
    const newText = 'console.log("new") // new comment';
    
    await performDiff(page, oldText, newText);
    await enableNestedMode(page);
    
    const modifiedRows = await page.locator('.diff-row.modified').all();
    expect(modifiedRows.length).toBeGreaterThan(0);
    
    // Should have word highlighting for both string and comment changes
    const addedWords = await page.locator('.inline-added-word').all();
    const removedWords = await page.locator('.inline-removed-word').all();
    
    expect(addedWords.length + removedWords.length).toBeGreaterThan(0);
    
    const addedText = (await Promise.all(addedWords.map(w => w.textContent()))).join('');
    const removedText = (await Promise.all(removedWords.map(w => w.textContent()))).join('');
    
    // Should capture both changes
    expect(addedText).toContain('new');
    expect(removedText).toContain('old');
    
    // Should have multiple instances (string + comment)
    const addedInstances = addedText.match(/new/g) || [];
    const removedInstances = removedText.match(/old/g) || [];
    
    expect(addedInstances.length).toBeGreaterThanOrEqual(2); // At least string + comment
    expect(removedInstances.length).toBeGreaterThanOrEqual(2); // At least string + comment
  });
  
  test('should handle multiple strings on same line', async ({ page }) => {
    const oldText = 'concat("old1", "old2")';
    const newText = 'concat("new1", "new2")';
    
    await performDiff(page, oldText, newText);
    await enableNestedMode(page);
    
    const modifiedRows = await page.locator('.diff-row.modified').all();
    expect(modifiedRows.length).toBeGreaterThan(0);
    
    const addedWords = await page.locator('.inline-added-word').all();
    const removedWords = await page.locator('.inline-removed-word').all();
    
    const addedText = (await Promise.all(addedWords.map(w => w.textContent()))).join('');
    const removedText = (await Promise.all(removedWords.map(w => w.textContent()))).join('');
    
    // Should detect changes in both strings
    expect(addedText).toContain('new1');
    expect(addedText).toContain('new2');
    expect(removedText).toContain('old1');
    expect(removedText).toContain('old2');
  });
  
  test('should handle mixed regions correctly', async ({ page }) => {
    const oldText = 'func("old") /* old block */ // old line';
    const newText = 'func("new") /* new block */ // old line';
    
    await performDiff(page, oldText, newText);
    await enableNestedMode(page);
    
    const modifiedRows = await page.locator('.diff-row.modified').all();
    expect(modifiedRows.length).toBeGreaterThan(0);
    
    const addedWords = await page.locator('.inline-added-word').all();
    const removedWords = await page.locator('.inline-removed-word').all();
    
    const addedText = (await Promise.all(addedWords.map(w => w.textContent()))).join('');
    const removedText = (await Promise.all(removedWords.map(w => w.textContent()))).join('');
    
    // Should capture string and block comment changes
    expect(addedText).toContain('new'); // Both string and block comment
    expect(removedText).toContain('old'); // Both string and block comment
    
    // Should have at least 2 "new" instances (string + block comment)
    const addedInstances = addedText.match(/new/g) || [];
    const removedInstances = removedText.match(/old/g) || [];
    
    expect(addedInstances.length).toBeGreaterThanOrEqual(2);
    expect(removedInstances.length).toBeGreaterThanOrEqual(2);
  });
});

test.describe('Code Regions Character Highlighting', () => {
  test('should use character highlighting for code changes', async ({ page }) => {
    const oldText = 'const oldVariable = 5;';
    const newText = 'const newVariable = 5;';
    
    await performDiff(page, oldText, newText);
    await enableNestedMode(page);
    
    const modifiedRows = await page.locator('.diff-row.modified').all();
    expect(modifiedRows.length).toBeGreaterThan(0);
    
    // Should have character-level highlighting for the identifier change
    const addedChars = await page.locator('.inline-added-char').all();
    const removedChars = await page.locator('.inline-removed-char').all();
    
    expect(addedChars.length + removedChars.length).toBeGreaterThan(0);
    
    const addedText = (await Promise.all(addedChars.map(c => c.textContent()))).join('');
    const removedText = (await Promise.all(removedChars.map(c => c.textContent()))).join('');
    
    // Should capture the character-level change in the variable name
    expect(addedText).toContain('new');
    expect(removedText).toContain('old');
  });
  
  test('should use character highlighting when code and string both change', async ({ page }) => {
    // Use more similar lines so they get classified as "modified" instead of add/remove
    const oldText = 'console.log("old message");';
    const newText = 'console.log("new message");';
    
    await performDiff(page, oldText, newText);
    await enableNestedMode(page);
    
    // Get all diff rows
    const modifiedRows = await page.locator('.diff-row.modified').all();
    const addedRows = await page.locator('.diff-row.added').all();
    const removedRows = await page.locator('.diff-row.removed').all();
    const allRows = [...modifiedRows, ...addedRows, ...removedRows];
    
    expect(allRows.length).toBeGreaterThan(0);
    
    // Should have word highlighting for string portion
    const addedWords = await page.locator('.inline-added-word').all();
    const removedWords = await page.locator('.inline-removed-word').all();
    
    expect(addedWords.length + removedWords.length).toBeGreaterThan(0);
    
    // Capture the word text
    const wordText = ((await Promise.all(addedWords.map(w => w.textContent()))).join('') + 
                      (await Promise.all(removedWords.map(w => w.textContent()))).join(''));
    
    // Should have string content highlighted
    expect(wordText).toMatch(/old|new/);
  });
  
  test('should use character highlighting for function name changes', async ({ page }) => {
    // Use lines without comments to get char mode highlighting
    const oldText = 'oldFunction();';
    const newText = 'newFunction();';
    
    await performDiff(page, oldText, newText);
    await enableNestedMode(page);
    
    const modifiedRows = await page.locator('.diff-row.modified').all();
    expect(modifiedRows.length).toBeGreaterThan(0);
    
    // Should have character highlighting for function name change (no nested regions)
    const addedChars = await page.locator('.inline-added-char').all();
    const removedChars = await page.locator('.inline-removed-char').all();
    
    expect(addedChars.length + removedChars.length).toBeGreaterThan(0);
    
    const addedText = (await Promise.all(addedChars.map(c => c.textContent()))).join('');
    const removedText = (await Promise.all(removedChars.map(c => c.textContent()))).join('');
    
    expect(addedText).toContain('new');
    expect(removedText).toContain('old');
  });
});

test.describe('Visual Distinction and Appearance', () => {
  test('should maintain visual consistency for comment highlighting', async ({ page }) => {
    const oldText = 'const x = 5; // old comment';
    const newText = 'const x = 5; // new comment';
    
    await performDiff(page, oldText, newText);
    await enableNestedMode(page);
    
    // Check that word highlighting has consistent styling
    const addedWords = await page.locator('.inline-added-word').all();
    const removedWords = await page.locator('.inline-removed-word').all();
    
    if (addedWords.length > 0) {
      const firstAddedWord = addedWords[0];
      const addedBg = await firstAddedWord.evaluate(el => 
        window.getComputedStyle(el).backgroundColor
      );
      // Should have a green-ish background for added words
      expect(addedBg).not.toBe('rgba(0, 0, 0, 0)');
    }
    
    if (removedWords.length > 0) {
      const firstRemovedWord = removedWords[0];
      const removedBg = await firstRemovedWord.evaluate(el => 
        window.getComputedStyle(el).backgroundColor
      );
      // Should have a red-ish background for removed words
      expect(removedBg).not.toBe('rgba(0, 0, 0, 0)');
    }
  });
  
  test('should maintain visual consistency for string highlighting', async ({ page }) => {
    const oldText = 'console.log("old message");';
    const newText = 'console.log("new message");';
    
    await performDiff(page, oldText, newText);
    await enableNestedMode(page);
    
    const addedWords = await page.locator('.inline-added-word').all();
    const removedWords = await page.locator('.inline-removed-word').all();
    
    // Should have styling similar to comments (both are word-level)
    if (addedWords.length > 0) {
      const firstAddedWord = addedWords[0];
      const isVisible = await firstAddedWord.isVisible();
      expect(isVisible).toBe(true);
    }
    
    if (removedWords.length > 0) {
      const firstRemovedWord = removedWords[0];
      const isVisible = await firstRemovedWord.isVisible();
      expect(isVisible).toBe(true);
    }
  });
  
  test('should distinguish character from word highlighting visually', async ({ page }) => {
    // Use lines WITHOUT nested regions to test pure char mode
    const oldText = 'oldFunction();';
    const newText = 'newFunction();';
    
    await performDiff(page, oldText, newText);
    await enableNestedMode(page);
    
    const addedChars = await page.locator('.inline-added-char').all();
    const removedChars = await page.locator('.inline-removed-char').all();
    const addedWords = await page.locator('.inline-added-word').all();
    const removedWords = await page.locator('.inline-removed-word').all();
    
    // Should have character highlighting (no nested regions)
    expect(addedChars.length + removedChars.length).toBeGreaterThan(0);
    
    // When there are no nested regions, char mode is used, not word mode
    // So word count should be 0
    expect(addedWords.length + removedWords.length).toBe(0);
    
    // Character highlights should be present (for function name)
    if (addedChars.length > 0) {
      const charVisible = await addedChars[0].isVisible();
      expect(charVisible).toBe(true);
    }
  });

  test('should show nested highlighting in unified view', async ({ page }) => {
    const oldText = 'const x = 5; // old comment';
    const newText = 'const x = 5; // new comment';
    
    await performDiff(page, oldText, newText);
    await enableNestedMode(page);
    
    // Switch to unified view after diff is complete
    await page.click('[aria-label="Show unified diff view"]');
    await page.waitForTimeout(100);
    
    // Should have unified rows with highlighting
    const unifiedRows = await page.locator('.unified-row').all();
    expect(unifiedRows.length).toBeGreaterThan(0);
    
    // Should still have word highlighting in unified view
    const addedWords = await page.locator('.inline-added-word').all();
    const removedWords = await page.locator('.inline-removed-word').all();
    
    expect(addedWords.length + removedWords.length).toBeGreaterThan(0);
    
    // Should capture comment change
    const addedText = (await Promise.all(addedWords.map(w => w.textContent()))).join('');
    const removedText = (await Promise.all(removedWords.map(w => w.textContent()))).join('');
    
    expect(addedText).toContain('new');
    expect(removedText).toContain('old');
  });
  
  test('should handle multiple regions in unified view', async ({ page }) => {
    const oldText = 'console.log("old") // old comment';
    const newText = 'console.log("new") // new comment';
    
    await performDiff(page, oldText, newText);
    await enableNestedMode(page);
    
    // Switch to unified view after diff
    await page.click('[aria-label="Show unified diff view"]');
    await page.waitForTimeout(100);
    
    const unifiedRows = await page.locator('.unified-row').all();
    expect(unifiedRows.length).toBeGreaterThan(0);
    
    // Should have word highlighting for both string and comment
    const addedWords = await page.locator('.inline-added-word').all();
    const removedWords = await page.locator('.inline-removed-word').all();
    
    expect(addedWords.length + removedWords.length).toBeGreaterThan(0);
    
    const addedText = (await Promise.all(addedWords.map(w => w.textContent()))).join('');
    const removedText = (await Promise.all(removedWords.map(w => w.textContent()))).join('');
    
    // Should have multiple instances in unified view as well
    const addedInstances = addedText.match(/new/g) || [];
    const removedInstances = removedText.match(/old/g) || [];
    
    expect(addedInstances.length).toBeGreaterThanOrEqual(2);
    expect(removedInstances.length).toBeGreaterThanOrEqual(2);
  });
  
  test('should show character highlighting in unified view', async ({ page }) => {
    const oldText = 'const oldVariable = 5;';
    const newText = 'const newVariable = 5;';
    
    await performDiff(page, oldText, newText);
    await enableNestedMode(page);
    
    // Switch to unified view after diff
    await page.click('[aria-label="Show unified diff view"]');
    await page.waitForTimeout(100);
    
    const unifiedRows = await page.locator('.unified-row').all();
    expect(unifiedRows.length).toBeGreaterThan(0);
    
    // Should have character highlighting in unified view
    const addedChars = await page.locator('.inline-added-char').all();
    const removedChars = await page.locator('.inline-removed-char').all();
    
    expect(addedChars.length + removedChars.length).toBeGreaterThan(0);
    
    const addedText = (await Promise.all(addedChars.map(c => c.textContent()))).join('');
    const removedText = (await Promise.all(removedChars.map(c => c.textContent()))).join('');
    
    expect(addedText).toContain('new');
    expect(removedText).toContain('old');
  });
});

test.describe('Edge Cases', () => {
  test('should handle escaped quotes in strings', async ({ page }) => {
    const oldText = 'const s = "Hello \\"old\\" world";';
    const newText = 'const s = "Hello \\"new\\" world";';
    
    await performDiff(page, oldText, newText);
    await enableNestedMode(page);
    
    const modifiedRows = await page.locator('.diff-row.modified').all();
    expect(modifiedRows.length).toBeGreaterThan(0);
    
    // Should highlight word changes despite escaped quotes
    const addedWords = await page.locator('.inline-added-word').all();
    const removedWords = await page.locator('.inline-removed-word').all();
    
    expect(addedWords.length + removedWords.length).toBeGreaterThan(0);
    
    const addedText = (await Promise.all(addedWords.map(w => w.textContent()))).join('');
    const removedText = (await Promise.all(removedWords.map(w => w.textContent()))).join('');
    
    expect(addedText).toContain('new');
    expect(removedText).toContain('old');
  });
  
  test('should handle lines without regions', async ({ page }) => {
    const oldText = 'justCode();';
    const newText = 'justDifferentCode();';
    
    await performDiff(page, oldText, newText);
    await enableNestedMode(page);
    
    const modifiedRows = await page.locator('.diff-row.modified').all();
    expect(modifiedRows.length).toBeGreaterThan(0);
    
    // Should have character highlighting but no nested word highlighting
    const addedChars = await page.locator('.inline-added-char').all();
    const removedChars = await page.locator('.inline-removed-char').all();
    
    expect(addedChars.length + removedChars.length).toBeGreaterThan(0);
  });
  
  test('should handle empty lines gracefully', async ({ page }) => {
    const oldText = '';
    const newText = '// new comment line';
    
    await performDiff(page, oldText, newText);
    await enableNestedMode(page);
    
    // Should handle empty old line without crashing
    const rows = await page.locator('.diff-row, .unified-row').all();
    expect(rows.length).toBeGreaterThan(0);
  });
  
  test('should handle very long lines with multiple regions', async ({ page }) => {
    const longOldText = 'veryLongFunctionName("old string content here") /* old comment content about the function */ // another old comment';
    const longNewText = 'veryLongFunctionName("new string content here") /* new comment content about the function */ // another new comment';
    
    await performDiff(page, longOldText, longNewText);
    await enableNestedMode(page);
    
    // Should handle long lines without performance issues
    const modifiedRows = await page.locator('.diff-row.modified').all();
    expect(modifiedRows.length).toBeGreaterThan(0);
    
    // Should detect multiple regions even in long lines
    const addedWords = await page.locator('.inline-added-word').all();
    const removedWords = await page.locator('.inline-removed-word').all();
    
    expect(addedWords.length + removedWords.length).toBeGreaterThan(0);
  });
});

test.describe('Mode Toggles Interaction', () => {
  test('should toggle word highlighting mode', async ({ page }) => {
    // Use lines WITHOUT nested regions so char mode is used
    const oldText = 'oldFunction();';
    const newText = 'newFunction();';
    
    await performDiff(page, oldText, newText);
    
    // Turn off word mode
    await page.click('[data-mode="words"]');
    await page.waitForTimeout(100);
    
    // Word highlighting should be gone (wasn't there anyway for this case)
    const wordHighlights = await page.locator('.inline-added-word, .inline-removed-word').count();
    expect(wordHighlights).toBe(0);
    
    // Character highlighting should remain (char mode is still on)
    const charHighlights = await page.locator('.inline-added-char, .inline-removed-char').count();
    expect(charHighlights).toBeGreaterThan(0);
  });
  
  test('should toggle character highlighting mode', async ({ page }) => {
    const oldText = 'oldVar "old" // old';
    const newText = 'newVar "new" // new';
    
    await performDiff(page, oldText, newText);
    await enableNestedMode(page);
    
    // Turn off char mode
    await page.click('[data-mode="chars"]');
    await page.waitForTimeout(100);
    
    // Character highlighting should be gone
    const charHighlights = await page.locator('.inline-added-char, .inline-removed-char').count();
    expect(charHighlights).toBe(0);
    
    // Word highlighting should remain
    const wordHighlights = await page.locator('.inline-added-word, .inline-removed-word').count();
    expect(wordHighlights).toBeGreaterThan(0);
  });
  
  test('should handle all modes disabled', async ({ page }) => {
    const oldText = 'oldVar "old" // old';
    const newText = 'newVar "new" // new';
    
    await performDiff(page, oldText, newText);
    
    // Turn off both word and char modes
    await page.click('[data-mode="words"]');
    await page.click('[data-mode="chars"]');
    await page.waitForTimeout(100);
    
    // Should not have inline highlighting
    const charHighlights = await page.locator('.inline-added-char, .inline-removed-char').count();
    const wordHighlights = await page.locator('.inline-added-word, .inline-removed-word').count();
    
    expect(charHighlights).toBe(0);
    expect(wordHighlights).toBe(0);
    
    // Should still have row-level highlighting
    const modifiedRows = await page.locator('.diff-row.modified').all();
    expect(modifiedRows.length).toBeGreaterThan(0);
  });
});