import { test, expect } from 'vitest';
import { runDiffPipeline } from '../src/diff-algorithms.js';
import { diffLines, diffWords, diffChars } from 'diff';

test('Full pipeline: should detect 3-line block move in unchanged lines', async () => {
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

  const result = await runDiffPipeline(original, modified, { diffLines, diffWords, diffChars }, {
    detectMoves: true,
    modeToggles: { lines: true, words: true, chars: true }
  });

  console.log('\n=== STATS ===');
  console.log(result.stats);
  
  console.log('\n=== CLASSIFICATIONS ===');
  result.results.forEach((r, i) => {
    if (r.classification !== 'unchanged') {
      console.log(`[${i}] ${r.classification}: "${r.value?.substring(0, 50)}"`);
    }
  });

  const blockMovedLines = result.results.filter(r => r.classification === 'block-moved');
  console.log('\n=== BLOCK-MOVED LINES ===');
  console.log('Count:', blockMovedLines.length);
  blockMovedLines.forEach((r, i) => {
    console.log(`[${i}] "${r.value?.substring(0, 50)}"`);
  });
  
  // Should detect moved lines (either as 'moved' or 'block-moved')
  expect(result.stats.moved).toBeGreaterThan(0);
});
