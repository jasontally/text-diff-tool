import { test, expect } from 'vitest';
import { runDiffPipeline, identifyChangeBlocks } from '../src/diff-algorithms.js';
import { diffLines, diffWords, diffChars } from 'diff';
import { detectBlockMovesFast, BLOCK_MOVE_CONFIG } from '../src/block-move-detector.js';

test('Debug block move detection step by step', () => {
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

  // Step 1: Run raw diff
  const rawResults = diffLines(original, modified);
  console.log('\n=== RAW DIFF RESULTS ===');
  rawResults.forEach((r, i) => {
    console.log(`[${i}] added: ${r.added}, removed: ${r.removed}, value: "${r.value?.substring(0, 50)}"`);
  });

  // Step 2: Identify change blocks
  const blocks = identifyChangeBlocks(rawResults);
  console.log('\n=== CHANGE BLOCKS ===');
  console.log('Number of blocks:', blocks.length);
  blocks.forEach((block, i) => {
    console.log(`\nBlock ${i}:`);
    console.log('  Removed lines:', block.removed.length);
    block.removed.forEach(r => console.log(`    [${r.index}] "${r.line?.substring(0, 40)}"`));
    console.log('  Added lines:', block.added.length);
    block.added.forEach(a => console.log(`    [${a.index}] "${a.line?.substring(0, 40)}"`));
  });

  // Step 3: Check block move config
  console.log('\n=== BLOCK MOVE CONFIG ===');
  console.log('MIN_LINES_FOR_DETECTION:', BLOCK_MOVE_CONFIG.MIN_LINES_FOR_DETECTION);
  console.log('MIN_BLOCK_SIZE:', BLOCK_MOVE_CONFIG.MIN_BLOCK_SIZE);
  console.log('MOVE_THRESHOLD:', BLOCK_MOVE_CONFIG.MOVE_THRESHOLD);

  // Step 4: Run block move detection directly
  // Count physical lines (not diff entries) since diffLines groups lines
  const totalRemoved = blocks.reduce((sum, b) => 
    sum + b.removed.reduce((lineSum, r) => lineSum + (r.line?.split('\n').length || 1), 0), 0);
  const totalAdded = blocks.reduce((sum, b) => 
    sum + b.added.reduce((lineSum, a) => lineSum + (a.line?.split('\n').length || 1), 0), 0);
  console.log('\n=== BLOCK MOVE DETECTION INPUT ===');
  console.log('Total removed (physical lines):', totalRemoved);
  console.log('Total added (physical lines):', totalAdded);
  console.log('Total changes (physical lines):', totalRemoved + totalAdded);
  console.log('Should skip?', totalRemoved + totalAdded < BLOCK_MOVE_CONFIG.MIN_LINES_FOR_DETECTION);

  if (totalRemoved + totalAdded >= BLOCK_MOVE_CONFIG.MIN_LINES_FOR_DETECTION) {
    const moveResult = detectBlockMovesFast(
      blocks,
      diffWords,
      diffChars,
      8,
      BLOCK_MOVE_CONFIG.MOVE_THRESHOLD,
      0.60,
      32,
      { lines: true, words: true, chars: true },
      null,
      {}
    );
    console.log('\n=== BLOCK MOVE DETECTION RESULT ===');
    console.log('Block moves found:', moveResult.blockMoves.length);
    console.log('Individual moves:', moveResult.moves.size);
    console.log('Block moves:', JSON.stringify(moveResult.blockMoves, null, 2));
  }

  // Step 5: Run full pipeline
  const result = runDiffPipeline(original, modified, { diffLines, diffWords, diffChars }, {
    detectMoves: true,
    modeToggles: { lines: true, words: true, chars: true }
  });

  console.log('\n=== FULL PIPELINE RESULT ===');
  console.log('Stats:', result.stats);
  
  const blockMovedLines = result.results.filter(r => r.classification === 'block-moved');
  console.log('Block-moved classifications:', blockMovedLines.length);
  
  expect(result.stats.moved).toBeGreaterThan(0);
});
