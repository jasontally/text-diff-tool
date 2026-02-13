import { test, expect } from 'vitest';
import { runDiffPipeline } from '../src/diff-algorithms.js';
import { diffLines, diffWords, diffChars } from 'diff';

test('Debug block moves in pipeline', async () => {
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
    modeToggles: { lines: true, words: true, chars: true },
    debug: true
  });

  console.log('\n=== STATS ===');
  console.log(result.stats);

  console.log('\n=== ALL RESULTS ===');
  result.results.forEach((r, i) => {
    const flags = [];
    if (r.added) flags.push('added');
    if (r.removed) flags.push('removed');
    if (r.blockMoveInfo) flags.push('hasBlockMoveInfo');
    console.log(`[${i}] ${r.classification} (${flags.join(',')}) index=${r.index}: "${r.value?.substring(0, 30)}..."`);
    if (r.blockMoveInfo) {
      console.log(`      blockMoveInfo: from=${r.blockMoveInfo.from}, to=${r.blockMoveInfo.to}, size=${r.blockMoveInfo.size}`);
    }
  });

  const blockMoved = result.results.filter(r => r.classification === 'block-moved');
  console.log('\n=== BLOCK-MOVED COUNT ===');
  console.log(blockMoved.length);

  expect(blockMoved.length).toBeGreaterThan(0);
});
