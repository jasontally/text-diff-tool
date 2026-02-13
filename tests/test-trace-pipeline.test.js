import { test, expect } from 'vitest';
import { runDiffPipeline } from '../src/diff-algorithms.js';
import { diffLines, diffWords, diffChars } from 'diff';

test('Trace pipeline results in detail', async () => {
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

  console.log('\n=== PIPELINE RESULTS ===');
  console.log('Stats:', result.stats);
  
  console.log('\n=== ALL RESULTS ===');
  result.results.forEach((r, i) => {
    const flags = [];
    if (r.added) flags.push('added');
    if (r.removed) flags.push('removed');
    if (!r.added && !r.removed) flags.push('unchanged');
    console.log(`[${i}] ${r.classification} (${flags.join(',')}) index=${r.index}: "${r.value?.substring(0, 40)}"`);
    if (r.classification === 'block-moved') {
      console.log(`      blockMoveSource=${r.blockMoveSource}, blockMoveDestination=${r.blockMoveDestination}`);
    }
  });
  
  const blockMoved = result.results.filter(r => r.classification === 'block-moved');
  console.log('\n=== BLOCK-MOVED ENTRIES ===');
  console.log('Count:', blockMoved.length);
  
  // Check what calculateStats sees
  const movedCount = result.results.filter(c => c.classification === 'moved' || c.classification === 'block-moved').length;
  console.log('\nManual moved count:', movedCount);
  
  expect(movedCount).toBeGreaterThan(0);
});
