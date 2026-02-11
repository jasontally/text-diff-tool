import { test, expect } from 'vitest';
import { diffLines } from 'diff';
import { fixDiffLinesClassification, detectMovesInUnchangedLines } from '../src/diff-algorithms.js';

test('Compare raw vs fixed diff results', () => {
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

  // Raw diff
  const rawResults = diffLines(original, modified);
  console.log('\n=== RAW DIFF ===');
  rawResults.forEach((r, i) => {
    const lines = r.value.split('\n').filter(l => l.length > 0);
    console.log(`[${i}] added: ${r.added}, removed: ${r.removed}, unchanged: ${!r.added && !r.removed}, lines: ${lines.length}`);
  });

  // Fixed diff
  const fixedResults = fixDiffLinesClassification(rawResults, original);
  console.log('\n=== FIXED DIFF ===');
  fixedResults.forEach((r, i) => {
    const lines = r.value.split('\n').filter(l => l.length > 0);
    console.log(`[${i}] added: ${r.added}, removed: ${r.removed}, unchanged: ${!r.added && !r.removed}, lines: ${lines.length}`);
  });

  // Virtual blocks from raw
  const rawVirtualBlocks = detectMovesInUnchangedLines(rawResults, original, modified);
  console.log('\n=== RAW VIRTUAL BLOCKS ===');
  console.log('Count:', rawVirtualBlocks.length);
  rawVirtualBlocks.forEach((b, i) => {
    console.log(`Block ${i}: ${b.removed.length} lines at indices ${b.removed.map(r => r.index).join(',')}`);
  });

  // Virtual blocks from fixed
  const fixedVirtualBlocks = detectMovesInUnchangedLines(fixedResults, original, modified);
  console.log('\n=== FIXED VIRTUAL BLOCKS ===');
  console.log('Count:', fixedVirtualBlocks.length);
  fixedVirtualBlocks.forEach((b, i) => {
    console.log(`Block ${i}: ${b.removed.length} lines at indices ${b.removed.map(r => r.index).join(',')}`);
  });

  // Raw should detect the virtual block
  expect(rawVirtualBlocks.length).toBeGreaterThan(0);
});
