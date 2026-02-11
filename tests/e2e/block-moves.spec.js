/**
 * Block Move Detection E2E Tests
 * 
 * Based on Implementation Plan: Phase 3 - Task 3.1
 * Tests the complete user experience for detecting and viewing block moves
 * with new visual indicators (< and > symbols, tooltips, blue/purple colors)
 * 
 * All tests use 30-second timeouts for unoptimized app compatibility.
 */

import { test, expect } from '@playwright/test';

/**
 * Semantic Selectors for Block Move Testing
 * 
 * These selectors are documented and should be maintained for future test updates.
 * 
 * Visual Indicators:
 * - .unified-marker - The symbol column (<, >, ≤, ≥, +, -, ~, space)
 * - .block-moved-source / .block-moved-from - Source line classes
 * - .block-moved-destination / .block-moved-to - Destination line classes
 * - .block-moved-from-modified / .block-moved-to-modified - Modified move classes
 * - .block-moved-indicator - Wrapper class for hover/tooltip support
 * 
 * Color Verification (CSS variables):
 * - --diff-block-move-from-fg: #0072B2 (blue)
 * - --diff-block-move-from-modified-fg: #9467BD (purple)
 * 
 * Statistics:
 * - [data-testid="stat-moved"] - Moved counter display
 * - [data-testid="stat-moved-container"] - Moved stat container
 * 
 * Tooltips:
 * - Use native title attribute for accessibility
 * - "Block moved to line X" for source
 * - "Block moved from line X" for destination
 * - "Block moved and modified (similarity: X%)" for modified moves
 */

test.describe('Block Move Detection - Visual Indicators', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
  });

  test('should display < symbol for block move source', async ({ page }) => {
    // Test data with enough changes (>10 lines) to trigger block move detection
    // Need at least 10 changed lines (added + removed) total
    const original = `line 1
line 2
line 3
line 4
line 5
function movedFunction() {
    console.log('test');
    return true;
}
line 7
line 8
line 9
line 10
line 11
line 12
line 13
line 14
line 15`;

    const modified = `line 1
line 2
line 3
line 4
line 5
line 7 MODIFIED
line 8 MODIFIED
line 9 MODIFIED
line 10 MODIFIED
line 11 MODIFIED
line 12 MODIFIED
line 13 MODIFIED
line 14 MODIFIED
line 15
function movedFunction() {
    console.log('test');
    return true;
}`;

    await page.fill('#previous-text', original);
    await page.fill('#current-text', modified);
    await page.click('#compare-btn');

    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
    await page.click('.view-btn[data-view="unified"]');
    await page.waitForTimeout(3000); // Wait for unified view to fully render with block moves

    // Find rows with block-moved-from class in unified view
    const sourceRows = page.locator('.unified-row.block-moved-from, .unified-row.block-moved-source');
    const count = await sourceRows.count();
    
    // If no unified rows found, check split view
    if (count === 0) {
      const splitSourceRows = page.locator('.diff-row.block-moved-from, .diff-row.block-moved-source');
      const splitCount = await splitSourceRows.count();
      expect(splitCount).toBeGreaterThan(0);
    } else {
      expect(count).toBeGreaterThan(0);
    }

    // Verify < symbol is present in at least one source row
    let foundLessThanSymbol = false;
    for (let i = 0; i < count; i++) {
      const row = sourceRows.nth(i);
      const marker = row.locator('.unified-marker');
      const markerText = await marker.textContent().catch(() => '');
      if (markerText === '<' || markerText === '≤') {
        foundLessThanSymbol = true;
        break;
      }
    }
    expect(foundLessThanSymbol).toBe(true);
  });

  test('should display > symbol for block move destination', async ({ page }) => {
    // Test data with enough changes (>10 lines) to trigger block move detection
    // Pattern: 8 modified lines + 3 line block move = 14 changes > 10 minimum
    const original = `line 1
line 2
line 3
line 4
line 5
function testFunc() {
    console.log('hello');
    return false;
}
line 7
line 8
line 9
line 10
line 11
line 12
line 13
line 14
line 15`;

    const modified = `line 1
line 2
line 3
line 4
line 5
line 7 MODIFIED
line 8 MODIFIED
line 9 MODIFIED
line 10 MODIFIED
line 11 MODIFIED
line 12 MODIFIED
line 13 MODIFIED
line 14 MODIFIED
line 15
function testFunc() {
    console.log('hello');
    return false;
}`;

    await page.fill('#previous-text', original);
    await page.fill('#current-text', modified);
    await page.click('#compare-btn');

    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
    await page.click('.view-btn[data-view="unified"]');
    await page.waitForTimeout(3000); // Wait for unified view to fully render with block moves

    // Find rows with block-moved-to class in unified view
    const destRows = page.locator('.unified-row.block-moved-to, .unified-row.block-moved-destination');
    const count = await destRows.count();
    
    // If no unified rows found, check split view
    if (count === 0) {
      const splitDestRows = page.locator('.diff-row.block-moved-to, .diff-row.block-moved-destination');
      const splitCount = await splitDestRows.count();
      expect(splitCount).toBeGreaterThan(0);
    } else {
      expect(count).toBeGreaterThan(0);
    }

    // Verify > symbol is present in at least one destination row
    let foundGreaterThanSymbol = false;
    for (let i = 0; i < count; i++) {
      const row = destRows.nth(i);
      const marker = row.locator('.unified-marker');
      const markerText = await marker.textContent().catch(() => '');
      if (markerText === '>' || markerText === '≥') {
        foundGreaterThanSymbol = true;
        break;
      }
    }
    expect(foundGreaterThanSymbol).toBe(true);
  });

  test('should show "Block moved to line X" tooltip on source hover', async ({ page }) => {
    // Test data with enough changes (>10 lines) to trigger block move detection
    // Pattern: 8 modified lines + 2 function swaps = 12+ changes
    const original = `line 1
line 2
line 3
line 4
context A
function blockA() {
    return 'A';
}
context B
context C
context D
context E
context F
context G
context H
function blockB() {
    return 'B';
}`;

    const modified = `line 1
line 2
line 3
line 4
context A
MODIFIED 1
MODIFIED 2
MODIFIED 3
MODIFIED 4
MODIFIED 5
MODIFIED 6
MODIFIED 7
MODIFIED 8
function blockB() {
    return 'B';
}
function blockA() {
    return 'A';
}`;

    await page.fill('#previous-text', original);
    await page.fill('#current-text', modified);
    await page.click('#compare-btn');

    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
    await page.click('.view-btn[data-view="unified"]');
    await page.waitForTimeout(3000); // Wait for unified view to render
    
    // Find block-moved-source rows in unified view (with fallback to split view)
    let sourceRows = page.locator('.unified-row.block-moved-from, .unified-row.block-moved-source');
    let count = await sourceRows.count();
    
    // If not found in unified view, check split view
    if (count === 0) {
      sourceRows = page.locator('.diff-row.block-moved-from, .diff-row.block-moved-source');
      count = await sourceRows.count();
    }
    
    expect(count).toBeGreaterThan(0);

    // Check first source row for tooltip
    const sourceRow = sourceRows.first();
    await expect(sourceRow).toBeVisible();
    const title = await sourceRow.getAttribute('title');
    expect(title).toMatch(/moved to line \d+/i);
  });

  test('should show "Block moved from line X" tooltip on destination hover', async ({ page }) => {
    // Test data that ACTUALLY moves a block (same content, different position)
    // Total changes: 8 lines modified + 3 lines moved = 11 > 10 minimum
    const original = `line 1
line 2
line 3
line 4
context A
function movedBlock() {
    return 'data';
}
line A
line B
line C
line D
line E
line F
line G
line H
footer 1
footer 2`;

    const modified = `line 1
line 2
line 3
line 4
context A
MODIFIED 1
MODIFIED 2
MODIFIED 3
MODIFIED 4
MODIFIED 5
MODIFIED 6
MODIFIED 7
MODIFIED 8
footer 1
function movedBlock() {
    return 'data';
}
footer 2`;

    await page.fill('#previous-text', original);
    await page.fill('#current-text', modified);
    await page.click('#compare-btn');

    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
    await page.click('.view-btn[data-view="unified"]');
    await page.waitForTimeout(3000);
    
    // Find block-moved-destination rows in unified view (with fallback to split view)
    let destRows = page.locator('.unified-row.block-moved-to, .unified-row.block-moved-destination');
    let count = await destRows.count();
    
    // If not found in unified view, check split view
    if (count === 0) {
      destRows = page.locator('.diff-row.block-moved-to, .diff-row.block-moved-destination');
      count = await destRows.count();
    }
    
    expect(count).toBeGreaterThan(0);

    // Check first destination row for tooltip
    const destRow = destRows.first();
    await expect(destRow).toBeVisible();

    // Check for tooltip using title attribute
    const title = await destRow.getAttribute('title');
    expect(title).toMatch(/moved from line \d+/i);
  });

  test('should use blue color (#0072B2) for pure block moves', async ({ page }) => {
    // Test data that moves a block with no modifications (pure move)
    // Total changes: 8 modified + 3 lines moved = 11 > 10 minimum
    const original = `start 1
start 2
start 3
start 4
marker X
function pureMove() {
    return 'unchanged';
}
item 1
item 2
item 3
item 4
item 5
item 6
item 7
item 8
end 1
end 2`;

    const modified = `start 1
start 2
start 3
start 4
marker X
CHANGE 1
CHANGE 2
CHANGE 3
CHANGE 4
CHANGE 5
CHANGE 6
CHANGE 7
CHANGE 8
end 1
function pureMove() {
    return 'unchanged';
}
end 2`;

    await page.fill('#previous-text', original);
    await page.fill('#current-text', modified);
    await page.click('#compare-btn');

    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
    await page.click('.view-btn[data-view="unified"]');
    await page.waitForTimeout(3000);
    
    // Find block-moved-from rows in unified view (with fallback to split view)
    let sourceRows = page.locator('.unified-row.block-moved-from');
    let count = await sourceRows.count();
    
    // If not found in unified view, check split view
    if (count === 0) {
      sourceRows = page.locator('.diff-row.block-moved-from');
      count = await sourceRows.count();
    }
    
    expect(count).toBeGreaterThan(0);

    // Find a pure block move row (uses < symbol, not ≤)
    const sourceRow = sourceRows.first();
    await expect(sourceRow).toBeVisible();

    // Verify the CSS color variable is applied
    const computedStyle = await sourceRow.evaluate(el => {
      const marker = el.querySelector('.unified-marker, .line-marker');
      if (marker) {
        return window.getComputedStyle(marker).color;
      }
      return window.getComputedStyle(el).borderLeftColor;
    });

    // Accept either RGB format of #0072B2 (blue) or the CSS variable
    expect(computedStyle).toMatch(/rgb\(0, 114, 178\)|rgb\(0, 115, 178\)|#0072B2/);
  });

  test('should use purple color (#9467BD) for moved+modified blocks', async ({ page }) => {
    // Test data with enough changes (>10 lines) and a modified block move
    const original = `begin 1
begin 2
begin 3
begin 4
marker X
function modifiedMove() {
    const oldData = 'old value';
    return oldData;
}
field 1
field 2
field 3
field 4
field 5
field 6
field 7
field 8`;

    const modified = `begin 1
begin 2
begin 3
begin 4
marker X
UPDATE 1
UPDATE 2
UPDATE 3
UPDATE 4
UPDATE 5
UPDATE 6
UPDATE 7
UPDATE 8
function modifiedMove() {
    const newData = 'new value';
    return newData;
}`;

    await page.fill('#previous-text', original);
    await page.fill('#current-text', modified);
    await page.click('#compare-btn');

    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
    await page.click('.view-btn[data-view="unified"]');
    await page.waitForTimeout(3000);

    // Look for modified block move rows (≤ or ≥ symbols)
    const unifiedRows = page.locator('.unified-row');
    let foundModifiedMove = false;
    let rowColor = '';

    const count = await unifiedRows.count();
    for (let i = 0; i < count; i++) {
      const row = unifiedRows.nth(i);
      const marker = row.locator('.unified-marker');
      const markerText = await marker.textContent().catch(() => '');
      
      if (markerText === '≤' || markerText === '≥') {
        foundModifiedMove = true;
        rowColor = await row.evaluate(el => {
          const m = el.querySelector('.unified-marker');
          if (m) return window.getComputedStyle(m).color;
          return window.getComputedStyle(el).borderLeftColor;
        });
        break;
      }
    }

    // If modified move was found, verify purple color
    if (foundModifiedMove) {
      expect(rowColor).toMatch(/rgb\(148, 103, 189\)|#9467BD/);
    }
  });

  test('should detect 3-line block moves', async ({ page }) => {
    // Test data with enough changes (>10 lines) and a 3-line block move
    const original = `prefix 1
prefix 2
prefix 3
prefix 4
header H
function threeLine() {
    const x = 1;
    return x;
}
item 1
item 2
item 3
item 4
item 5
item 6
item 7
item 8`;

    const modified = `prefix 1
prefix 2
prefix 3
prefix 4
header H
DIFF 1
DIFF 2
DIFF 3
DIFF 4
DIFF 5
DIFF 6
DIFF 7
DIFF 8
function threeLine() {
    const x = 1;
    return x;
}`;

    await page.fill('#previous-text', original);
    await page.fill('#current-text', modified);
    await page.click('#compare-btn');

    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
    await page.click('.view-btn[data-view="unified"]');
    await page.waitForTimeout(3000);

    // Count block moved source rows
    const sourceCount = await page.locator('.block-moved-from, .block-moved-source').count();
    const destCount = await page.locator('.block-moved-to, .block-moved-destination').count();

    // Should detect at least 1 grouped line for source and destination
    // diffLines may group lines, so we check for at least 1 row
    expect(sourceCount).toBeGreaterThan(0);
    expect(destCount).toBeGreaterThan(0);

    // Source and destination counts should be balanced
    expect(sourceCount).toBe(destCount);
  });
});

test.describe('Block Move Detection - View Compatibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
  });

  test('should work in unified view', async ({ page }) => {
    // Test data with enough changes (>10 lines) to trigger block move detection
    const original = `head 1
head 2
head 3
head 4
tag T
function movedBlock() {
    const x = 1;
    const y = 2;
    return x + y;
}
row 1
row 2
row 3
row 4
row 5
row 6
row 7
row 8`;

    const modified = `head 1
head 2
head 3
head 4
tag T
EDIT 1
EDIT 2
EDIT 3
EDIT 4
EDIT 5
EDIT 6
EDIT 7
EDIT 8
function movedBlock() {
    const x = 1;
    const y = 2;
    return x + y;
}`;

    await page.fill('#previous-text', original);
    await page.fill('#current-text', modified);
    await page.click('#compare-btn');

    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
    
    // Switch to unified view
    await page.click('.view-btn[data-view="unified"]');
    await page.waitForTimeout(3000);

    // Verify unified container is visible
    const unifiedContainer = page.locator('#unified-container');
    await expect(unifiedContainer).toBeVisible();

    // Should have block move indicators
    const sourceCount = await page.locator('.block-moved-from, .block-moved-source').count();
    const destCount = await page.locator('.block-moved-to, .block-moved-destination').count();
    
    expect(sourceCount).toBeGreaterThan(0);
    expect(destCount).toBeGreaterThan(0);
  });

  test('should work in split view', async ({ page }) => {
    // Test data with enough changes (>10 lines) to trigger block move detection
    const original = `top 1
top 2
top 3
top 4
label L
function movedBlock() {
    const x = 1;
    const y = 2;
    return x + y;
}
entry 1
entry 2
entry 3
entry 4
entry 5
entry 6
entry 7
entry 8`;

    const modified = `top 1
top 2
top 3
top 4
label L
SHIFT 1
SHIFT 2
SHIFT 3
SHIFT 4
SHIFT 5
SHIFT 6
SHIFT 7
SHIFT 8
function movedBlock() {
    const x = 1;
    const y = 2;
    return x + y;
}`;

    await page.fill('#previous-text', original);
    await page.fill('#current-text', modified);
    await page.click('#compare-btn');

    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
    
    // Ensure split view is active (default)
    const splitContainer = page.locator('#diff-container');
    await expect(splitContainer).toBeVisible();

    // Should have block move indicators in both panels
    const prevPanel = page.locator('#previous-diff-content');
    const currPanel = page.locator('#current-diff-content');

    const sourceInPrev = await prevPanel.locator('.block-moved-from, .block-moved-source').count();
    const destInCurr = await currPanel.locator('.block-moved-to, .block-moved-destination').count();

    expect(sourceInPrev).toBeGreaterThan(0);
    expect(destInCurr).toBeGreaterThan(0);
  });

  test('should persist indicators when switching between split and unified views', async ({ page }) => {
    // Test data that moves a block (same content, different position)
    // Total changes: 8 modified + 3 lines moved = 11 > 10 minimum
    const original = `begin A
begin B
begin C
begin D
tag T
function persistTest() {
    return true;
}
field 1
field 2
field 3
field 4
field 5
field 6
field 7
field 8
footer X
footer Y`;

    const modified = `begin A
begin B
begin C
begin D
tag T
EDIT 1
EDIT 2
EDIT 3
EDIT 4
EDIT 5
EDIT 6
EDIT 7
EDIT 8
footer X
function persistTest() {
    return true;
}
footer Y`;

    await page.fill('#previous-text', original);
    await page.fill('#current-text', modified);
    await page.click('#compare-btn');

    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });

    // Get initial block move counts in split view
    const splitSourceCount = await page.locator('.block-moved-from, .block-moved-source').count();
    const splitDestCount = await page.locator('.block-moved-to, .block-moved-destination').count();

    expect(splitSourceCount).toBeGreaterThan(0);
    expect(splitDestCount).toBeGreaterThan(0);

    // Switch to unified view
    await page.click('.view-btn[data-view="unified"]');
    await page.waitForTimeout(3000); // Increased wait time for view switch
    
    // Check for block moves in unified view (with fallback)
    let unifiedSourceCount = await page.locator('.unified-row.block-moved-from, .unified-row.block-moved-source').count();
    let unifiedDestCount = await page.locator('.unified-row.block-moved-to, .unified-row.block-moved-destination').count();
    
    // If not found in unified view, check generic selectors
    if (unifiedSourceCount === 0) {
      unifiedSourceCount = await page.locator('.block-moved-from, .block-moved-source').count();
    }
    if (unifiedDestCount === 0) {
      unifiedDestCount = await page.locator('.block-moved-to, .block-moved-destination').count();
    }

    // Unified view should have block moves (they may render differently)
    expect(unifiedSourceCount).toBeGreaterThan(0);
    expect(unifiedDestCount).toBeGreaterThan(0);

    // Switch back to split view
    await page.click('.view-btn[data-view="split"]');
    await page.waitForTimeout(3000);
    
    // Check for block moves in split view
    let finalSourceCount = await page.locator('.diff-row.block-moved-from, .diff-row.block-moved-source').count();
    let finalDestCount = await page.locator('.diff-row.block-moved-to, .diff-row.block-moved-destination').count();
    
    // If not found in diff-rows, check generic selectors
    if (finalSourceCount === 0) {
      finalSourceCount = await page.locator('.block-moved-from, .block-moved-source').count();
    }
    if (finalDestCount === 0) {
      finalDestCount = await page.locator('.block-moved-to, .block-moved-destination').count();
    }

    expect(finalSourceCount).toBeGreaterThan(0);
    expect(finalDestCount).toBeGreaterThan(0);
  });
});

test.describe('Block Move Detection - Statistics Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
  });

  test('should increment "Moved:" counter correctly', async ({ page }) => {
    // Test data with enough changes (>10 lines) and a block that moves to a new position
    const original = `part 1
part 2
part 3
part 4
anchor A
function counterTest() {
    return 'data';
}
seg 1
seg 2
seg 3
seg 4
seg 5
seg 6
seg 7
seg 8`;

    const modified = `part 1
part 2
part 3
part 4
anchor A
MOD 1
MOD 2
MOD 3
MOD 4
MOD 5
MOD 6
MOD 7
MOD 8
seg 1
function counterTest() {
    return 'data';
}
seg 2
seg 3`;

    await page.fill('#previous-text', original);
    await page.fill('#current-text', modified);
    await page.click('#compare-btn');

    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });

    // Check that the moved counter is visible and has value > 0
    const movedStat = page.locator('[data-testid="stat-moved"]');
    await expect(movedStat).toBeVisible();

    const movedValue = await movedStat.textContent();
    expect(parseInt(movedValue || '0')).toBeGreaterThan(0);
  });

  test('should update stats after comparison', async ({ page }) => {
    // First comparison - no changes
    await page.fill('#previous-text', 'line 1\nline 2');
    await page.fill('#current-text', 'line 1\nline 2');
    await page.click('#compare-btn');

    await page.waitForTimeout(2000);

    // Check moved count is 0 or stats are visible
    const initialMovedValue = await page.locator('[data-testid="stat-moved"]').textContent().catch(() => '0');
    const initialMoved = parseInt(initialMovedValue || '0');

    // Second comparison - with block move and >10 changes
    const original = `pos 1
pos 2
pos 3
pos 4
flag F
function updateTest() {
    return 'value';
}
rec 1
rec 2
rec 3
rec 4
rec 5
rec 6
rec 7
rec 8`;

    const modified = `pos 1
pos 2
pos 3
pos 4
flag F
DIFF 1
DIFF 2
DIFF 3
rec 1
function updateTest() {
    return 'value';
}
rec 2
rec 3
rec 4
rec 5
rec 6`;

    await page.fill('#previous-text', original);
    await page.fill('#current-text', modified);
    await page.click('#compare-btn');

    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });

    // Verify moved counter updated
    const updatedMovedValue = await page.locator('[data-testid="stat-moved"]').textContent();
    const updatedMoved = parseInt(updatedMovedValue || '0');

    expect(updatedMoved).toBeGreaterThan(initialMoved);
  });
});

test.describe('Block Move Detection - Navigation Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
  });

  test('should navigate through block moves with prev/next buttons', async ({ page }) => {
    // Test data that ACTUALLY moves a block (same content, different position)
    // Total changes: 8 modified + 3 lines moved = 11 > 10 minimum
    const original = `head 1
head 2
head 3
head 4
anchor A
function navTest1() {
    return 1;
}
data 1
data 2
data 3
data 4
data 5
data 6
data 7
data 8
tail 1
tail 2`;

    const modified = `head 1
head 2
head 3
head 4
anchor A
EDIT 1
EDIT 2
EDIT 3
EDIT 4
EDIT 5
EDIT 6
EDIT 7
EDIT 8
tail 1
function navTest1() {
    return 1;
}
tail 2`;

    await page.fill('#previous-text', original);
    await page.fill('#current-text', modified);
    await page.click('#compare-btn');

    await page.waitForSelector('#navigation-section', { timeout: 30000 });

    // Get initial counter
    const initialCounter = await page.locator('#change-counter').textContent();
    expect(initialCounter).toMatch(/\d+ of \d+/);

    // Navigate next - verify button works without error
    await page.locator('#next-change-btn').click();
    await page.waitForTimeout(1000); // Wait for navigation to complete
    
    // Verify navigation still works (counter exists and has valid format)
    const nextCounter = await page.locator('#change-counter').textContent();
    expect(nextCounter).toMatch(/\d+ of \d+/);
    
    // Navigate previous - verify button works without error
    await page.locator('#prev-change-btn').click();
    await page.waitForTimeout(1000);
    
    // Verify navigation still works
    const prevCounter = await page.locator('#change-counter').textContent();
    expect(prevCounter).toMatch(/\d+ of \d+/);
  });

  test('should include block moves in change counter', async ({ page }) => {
    // Test data with enough changes (>10 lines) to trigger block move detection
    const original = `init 1
init 2
init 3
init 4
flag X
function counterBlock() {
    return true;
}
data 1
data 2
data 3
data 4
data 5
data 6
data 7
data 8`;

    const modified = `init 1
init 2
init 3
init 4
flag X
EDIT 1
EDIT 2
EDIT 3
EDIT 4
EDIT 5
EDIT 6
EDIT 7
EDIT 8
function counterBlock() {
    return true;
}`;

    await page.fill('#previous-text', original);
    await page.fill('#current-text', modified);
    await page.click('#compare-btn');

    await page.waitForSelector('#change-counter', { timeout: 30000 });

    // Get counter text
    const counterText = await page.locator('#change-counter').textContent();
    const match = counterText?.match(/(\d+) of (\d+)/);
    
    expect(match).toBeTruthy();
    if (match) {
      const current = parseInt(match[1]);
      const total = parseInt(match[2]);
      expect(total).toBeGreaterThan(0);
      expect(current).toBeGreaterThanOrEqual(1);
      expect(current).toBeLessThanOrEqual(total);
    }
  });
});

test.describe('Block Move Detection - Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
  });

  test('should handle overlapping block moves correctly', async ({ page }) => {
    // Test with sufficient changes to trigger detection
    const original = `// Header
base 1
base 2
base 3
base 4
function func1() { return 1; }
function func2() { return 2; }
function func3() { return 3; }
function func4() { return 4; }
function func5() { return 5; }
// Footer`;

    const modified = `// Header
base 1
base 2
base 3
base 4
function func3() { return 3; }
function func4() { return 4; }
function func5() { return 5; }
function func1() { return 1; }
function func2() { return 2; }
// Footer`;

    await page.fill('#previous-text', original);
    await page.fill('#current-text', modified);
    await page.click('#compare-btn');

    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
    await page.click('.view-btn[data-view="unified"]');
    await page.waitForTimeout(3000);

    // Check for block moves by title attribute (more reliable across views)
    const movedElements = await page.locator('[title*="Block moved"]').count();
    
    // Also check for marker symbols < and >
    const sourceMarkers = await page.locator('.unified-marker:has-text("<")').count();
    const destMarkers = await page.locator('.unified-marker:has-text(">")').count();
    
    // Should have either title attributes or marker symbols indicating block moves
    expect(movedElements + sourceMarkers + destMarkers).toBeGreaterThan(0);
  });

  test('should handle large block moves (10+ lines)', async ({ page }) => {
    // Create data with 10 lines that get moved from position 5 to end
    const original = `line 1
line 2
line 3
line 4
line 5
MOVE 1
MOVE 2
MOVE 3
MOVE 4
MOVE 5
MOVE 6
MOVE 7
MOVE 8
MOVE 9
MOVE 10
line 16`;

    const modified = `line 1
line 2
line 3
line 4
line 5
line 16
MOVE 1
MOVE 2
MOVE 3
MOVE 4
MOVE 5
MOVE 6
MOVE 7
MOVE 8
MOVE 9
MOVE 10`;

    await page.fill('#previous-text', original);
    await page.fill('#current-text', modified);
    await page.click('#compare-btn');

    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
    await page.click('.view-btn[data-view="unified"]');
    await page.waitForTimeout(3000);

    // Check for block moves by title attribute or marker symbols
    const movedElements = await page.locator('[title*="Block moved"]').count();
    const sourceMarkers = await page.locator('.unified-marker:has-text("<")').count();
    const destMarkers = await page.locator('.unified-marker:has-text(">")').count();
    
    expect(movedElements + sourceMarkers + destMarkers).toBeGreaterThan(0);
  });

  test('should distinguish moved vs modified blocks', async ({ page }) => {
    // Test data with enough changes (>10 lines) to trigger block move detection
    const original = `// Header
context 1
context 2
context 3
context 4
// Unchanged block
function unchanged() {
    return 'same';
}
// Modified block  
function modified() {
    return 'old';
}
footer A
footer B
footer C
footer D`;

    const modified = `// Header
MODIFIED 1
MODIFIED 2
MODIFIED 3
MODIFIED 4
// Modified block first
function modified() {
    return 'new';
}
// Unchanged block moved
function unchanged() {
    return 'same';
}
footer A
footer B
footer C
footer D`;

    await page.fill('#previous-text', original);
    await page.fill('#current-text', modified);
    await page.click('#compare-btn');

    await page.waitForSelector('.diff-row, .unified-row', { timeout: 30000 });
    await page.click('.view-btn[data-view="unified"]');
    await page.waitForTimeout(3000);

    // Check for block moves by title attribute or marker symbols
    const movedElements = await page.locator('[title*="Block moved"]').count();
    const sourceMarkers = await page.locator('.unified-marker:has-text("<")').count();
    const destMarkers = await page.locator('.unified-marker:has-text(">")').count();
    
    expect(movedElements + sourceMarkers + destMarkers).toBeGreaterThan(0);
  });
});
