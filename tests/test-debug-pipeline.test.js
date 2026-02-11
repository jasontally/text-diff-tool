import { test, expect } from 'vitest';
import { runDiffPipeline } from '../src/diff-algorithms.js';
import { diffLines, diffWords, diffChars } from 'diff';

test('Debug pipeline with debug mode', () => {
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

  const result = runDiffPipeline(original, modified, { diffLines, diffWords, diffChars }, {
    detectMoves: true,
    modeToggles: { lines: true, words: true, chars: true },
    debug: true
  });

  console.log('\n=== FULL RESULT ===');
  console.log('Stats:', result.stats);
  console.log('Limit info:', result.limitInfo);
  console.log('Debug info:', result.debug);
  
  // Log classifications
  console.log('\n=== CLASSIFICATIONS ===');
  result.results.forEach((r, i) => {
    console.log(`[${i}] ${r.classification}: index=${r.index}`);
  });
  
  // Check if this is actually using fast mode
  if (result.limitInfo?.fastMode) {
    console.log('\nWARNING: Fast mode was triggered!');
  }
  
  const movedCount = result.results.filter(c => c.classification === 'block-moved' || c.classification === 'moved').length;
  console.log('\nTotal moved entries:', movedCount);
  
  // The test should pass now
  expect(movedCount).toBeGreaterThan(0);
});
