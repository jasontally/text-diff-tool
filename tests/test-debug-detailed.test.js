import { test, expect } from 'vitest';
import { runDiffPipeline, detectModifiedLines, detectMovesInUnchangedLines, identifyChangeBlocks } from '../src/diff-algorithms.js';
import { diffLines, diffWords, diffChars } from 'diff';
import { detectBlockMovesFast } from '../src/block-move-detector.js';

test('Debug: Trace block move detection step by step', async () => {
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

  // Step 1: Raw diff
  const diffResults = diffLines(original, modified);
  console.log('\n=== STEP 1: RAW DIFF ===');
  diffResults.forEach((r, i) => {
    const lines = r.value.split('\n').filter(l => l.length > 0);
    console.log(`[${i}] added: ${r.added}, removed: ${r.removed}, unchanged: ${!r.added && !r.removed}, lines: ${lines.length}`);
  });

  // Step 2: Identify regular change blocks
  const regularBlocks = identifyChangeBlocks(diffResults);
  console.log('\n=== STEP 2: REGULAR BLOCKS ===');
  console.log('Count:', regularBlocks.length);
  regularBlocks.forEach((b, i) => {
    console.log(`Block ${i}: ${b.removed.length} removed, ${b.added.length} added`);
  });

  // Step 3: Detect virtual move blocks
  const virtualBlocks = detectMovesInUnchangedLines(diffResults, original, modified);
  console.log('\n=== STEP 3: VIRTUAL BLOCKS ===');
  console.log('Count:', virtualBlocks.length);
  virtualBlocks.forEach((b, i) => {
    console.log(`Block ${i}: ${b.removed.length} lines, indices: ${b.removed.map(r => r.index).join(',')}`);
    console.log('  isVirtualMoveBlock:', b.isVirtualMoveBlock);
  });

  // Step 4: Merge and run block move detection
  const allBlocks = [...regularBlocks, ...virtualBlocks];
  console.log('\n=== STEP 4: ALL BLOCKS FOR MOVE DETECTION ===');
  console.log('Total blocks:', allBlocks.length);
  
  const moveResult = detectBlockMovesFast(
    allBlocks,
    diffWords,
    diffChars,
    8,
    0.7,
    0.60,
    32,
    { lines: true, words: true, chars: true },
    null,
    {}
  );
  
  console.log('\n=== STEP 5: BLOCK MOVE RESULT ===');
  console.log('Block moves found:', moveResult.blockMoves.length);
  console.log('Individual moves:', moveResult.moves.size);
  moveResult.blockMoves.forEach((bm, i) => {
    console.log(`Block move ${i}: from=${bm.from}, to=${bm.to}, size=${bm.size}`);
  });

  // Step 6: Run full detectModifiedLines
  const classified = await detectModifiedLines(diffResults, diffWords, diffChars, {
    detectMoves: true,
    modeToggles: { lines: true, words: true, chars: true }
  }, original, modified);
  
  console.log('\n=== STEP 6: CLASSIFIED RESULTS ===');
  classified.forEach((c, i) => {
    console.log(`[${i}] ${c.classification}: removed=${c.removed}, added=${c.added}, index=${c.index}`);
  });
  
  const blockMovedCount = classified.filter(c => c.classification === 'block-moved').length;
  console.log('\nBlock-moved count:', blockMovedCount);
  
  // Step 7: Full pipeline
  const pipelineResult = await runDiffPipeline(original, modified, { diffLines, diffWords, diffChars }, {
    detectMoves: true,
    modeToggles: { lines: true, words: true, chars: true }
  });
  
  console.log('\n=== STEP 7: PIPELINE STATS ===');
  console.log(pipelineResult.stats);
  
  expect(blockMovedCount).toBeGreaterThan(0);
});
