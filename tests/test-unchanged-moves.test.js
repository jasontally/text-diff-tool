import { test, expect } from 'vitest';
import { detectMovesInUnchangedLines } from '../src/diff-algorithms.js';
import { diffLines } from 'diff';

test('detectMovesInUnchangedLines only detects significant moves (>5 line shift)', () => {
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

  const diffResults = diffLines(original, modified);
  
  console.log('\n=== DIFF RESULTS ===');
  diffResults.forEach((r, i) => {
    console.log(`[${i}] added: ${r.added}, removed: ${r.removed}, unchanged: ${!r.added && !r.removed}`);
    const lines = r.value.split('\n').filter(l => l.length > 0);
    lines.forEach(l => console.log(`    "${l.substring(0, 50)}"`));
  });

  const virtualBlocks = detectMovesInUnchangedLines(diffResults, original, modified);
  
  console.log('\n=== VIRTUAL MOVE BLOCKS ===');
  console.log('Found', virtualBlocks.length, 'virtual blocks');
  
  // The function moved from line 2 to line 4 - only a 2-line shift
  // This is below the 5-line threshold, so it won't be detected here
  // But it SHOULD be detected by detectBlockMovesFast which compares content
  expect(virtualBlocks.length).toBe(0);
});

test('detectMovesInUnchangedLines detects unchanged blocks that moved significantly', () => {
  // This test verifies that content marked as "unchanged" by diffLines
  // but with significant position shifts (>5 lines) is detected as moved.
  // Note: This requires the content to be truly unchanged (identical) and
  // appear in a single unchanged diff entry.
  
  const original = `config section
unchanged line 1
unchanged line 2
unchanged line 3
unchanged line 4
unchanged line 5
unchanged line 6
unchanged line 7
unchanged line 8
end config`;

  const modified = `new content line 1
new content line 2
new content line 3
new content line 4
new content line 5
new content line 6
config section
unchanged line 1
unchanged line 2
unchanged line 3
unchanged line 4
unchanged line 5
unchanged line 6
unchanged line 7
unchanged line 8
end config`;

  const diffResults = diffLines(original, modified);
  
  console.log('\n=== UNCHANGED BLOCK MOVE TEST ===');
  diffResults.forEach((r, i) => {
    console.log(`[${i}] added: ${r.added}, removed: ${r.removed}, unchanged: ${!r.added && !r.removed}`);
    const lines = r.value.split('\n').filter(l => l.length > 0);
    lines.forEach((l, j) => console.log(`    line ${j}: "${l.substring(0, 50)}"`));
  });

  const virtualBlocks = detectMovesInUnchangedLines(diffResults, original, modified);
  
  console.log('\n=== VIRTUAL BLOCKS ===');
  console.log('Found', virtualBlocks.length, 'virtual blocks');
  virtualBlocks.forEach((block, i) => {
    console.log(`\nBlock ${i}:`);
    console.log('  removed.length:', block.removed.length);
    block.removed.forEach((r, j) => console.log(`    [${j}] "${r.line.substring(0, 40)}"`));
  });
  
  // The config section moved from line 0 to line 6 - a 6-line shift
  // This is marked as unchanged by diffLines and meets our threshold
  expect(virtualBlocks.length).toBeGreaterThan(0);
  expect(virtualBlocks[0].removed.length).toBeGreaterThanOrEqual(3);
});
