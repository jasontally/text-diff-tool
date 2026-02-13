import { test } from 'vitest';
import { diffLines } from 'diff';
import { fixDiffLinesClassification, detectMovesInUnchangedLines } from '../src/diff-algorithms.js';

test('Debug indices in fixed diff', () => {
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

  const fixedResults = fixDiffLinesClassification(diffLines(original, modified), original, modified);
  
  console.log('\n=== TRACKING LINE POSITIONS ===');
  let oldLineNum = 0;
  let newLineNum = 0;
  
  for (let i = 0; i < fixedResults.length; i++) {
    const change = fixedResults[i];
    const lines = change.value.split('\n').filter(l => l.length > 0);
    const flags = [];
    if (change.added) flags.push('added');
    if (change.removed) flags.push('removed');
    if (!change.added && !change.removed) flags.push('unchanged');
    
    console.log(`\n[${i}] ${flags.join(',')} lines: ${lines.length}`);
    
    if (change.removed) {
      for (const line of lines) {
        console.log(`  OLD[${oldLineNum}]: "${line.substring(0, 40)}"`);
        oldLineNum++;
      }
    } else if (change.added) {
      for (const line of lines) {
        console.log(`  NEW[${newLineNum}]: "${line.substring(0, 40)}"`);
        newLineNum++;
      }
    } else {
      // Unchanged
      for (const line of lines) {
        const shift = newLineNum - oldLineNum;
        console.log(`  OLD[${oldLineNum}] -> NEW[${newLineNum}] (shift: ${shift}): "${line.substring(0, 40)}"`);
        oldLineNum++;
        newLineNum++;
      }
    }
  }
  
  // Now see what detectMovesInUnchangedLines sees
  console.log('\n=== DETECT MOVES OUTPUT ===');
  const blocks = detectMovesInUnchangedLines(fixedResults, original, modified);
  console.log('Found', blocks.length, 'virtual blocks');
});
