import { test, expect } from 'vitest';
import { runDiffPipeline, detectMovesInUnchangedLines } from '../src/diff-algorithms.js';
import { diffLines } from 'diff';

test('Check full function block detection', () => {
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

  // Check raw diff
  const rawResults = diffLines(original, modified);
  console.log('\n=== RAW DIFF ===');
  rawResults.forEach((r, i) => {
    const lines = r.value.split('\n').filter(l => l.length > 0);
    console.log(`[${i}] added: ${r.added}, removed: ${r.removed}, unchanged: ${!r.added && !r.removed}, lines: ${lines.length}`);
    lines.forEach(l => console.log(`    "${l.substring(0, 50)}"`));
  });

  // Check virtual blocks
  const virtualBlocks = detectMovesInUnchangedLines(rawResults, original, modified);
  console.log('\n=== VIRTUAL BLOCKS ===');
  console.log('Count:', virtualBlocks.length);
  virtualBlocks.forEach((b, i) => {
    console.log(`Block ${i}:`);
    console.log('  removed.length:', b.removed.length);
    console.log('  Lines:');
    b.removed.forEach((r, j) => console.log(`    [${j}] "${r.line?.substring(0, 50)}"`));
    console.log('  isVirtualMoveBlock:', b.isVirtualMoveBlock);
  });

  // Run pipeline
  const result = runDiffPipeline(original, modified, { diffLines, diffWords: null, diffChars: null }, {
    detectMoves: true
  });

  console.log('\n=== PIPELINE RESULTS ===');
  result.results.forEach((r, i) => {
    if (r.classification !== 'unchanged') {
      console.log(`[${i}] ${r.classification}: "${r.value?.substring(0, 40)}..."`);
    }
  });

  expect(virtualBlocks.length).toBeGreaterThan(0);
});
