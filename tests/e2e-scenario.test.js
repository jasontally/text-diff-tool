import { test, expect } from 'vitest';
import { runDiffPipeline } from '../src/diff-algorithms.js';
import { diffLines, diffWords, diffChars } from 'diff';

test('E2E scenario: 3-line block move should be detected', async () => {
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

  console.log('Stats:', result.stats);
  
  // Should detect moved lines
  expect(result.stats.moved).toBeGreaterThan(0);
  
  // Check that we have block-moved classifications
  const blockMovedLines = result.results.filter(r => r.classification === 'block-moved');
  console.log('Block-moved lines count:', blockMovedLines.length);
  expect(blockMovedLines.length).toBeGreaterThan(0);
});
