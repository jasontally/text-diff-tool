import { test, expect } from 'vitest';
import { detectMovesInUnchangedLines } from '../src/diff-algorithms.js';
import { diffLines } from 'diff';

test('detectMovesInUnchangedLines should find moved content', () => {
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
  virtualBlocks.forEach((block, i) => {
    console.log(`\nBlock ${i}:`);
    console.log('  Removed lines:', block.removed.length);
    block.removed.forEach(r => console.log(`    [${r.index}] "${r.line?.substring(0, 40)}"`));
    console.log('  Added lines:', block.added.length);
    block.added.forEach(a => console.log(`    [${a.index}] "${a.line?.substring(0, 40)}"`));
  });
  
  // Should detect at least one moved block
  expect(virtualBlocks.length).toBeGreaterThan(0);
  
  // The function body should be detected as moved (3 lines)
  const functionBlock = virtualBlocks.find(b => 
    b.removed.some(r => r.line.includes('function movedFunction'))
  );
  expect(functionBlock).toBeDefined();
  expect(functionBlock.removed.length).toBeGreaterThanOrEqual(3);
});
