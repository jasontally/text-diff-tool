import { test, expect } from 'vitest';
import { diffLines, diffWords, diffChars } from 'diff';
import { runDiffPipeline, identifyChangeBlocks } from '../src/diff-algorithms.js';

test('Content preservation: all lines from inputs should appear in output', async () => {
  const leftText = `// ADDED LINES - These are new (only in File B)
// (Nothing here in File A)
// UNCHANGED LINE
const unchanged = "stays the same";
function main() {
  console.log("test");
}`;

  const rightText = `// UNCHANGED LINE
const unchanged = "stays the same";
function main() {
  console.log("test");
}`;

  console.log('\n=== Content Preservation Test ===');
  console.log('Left input lines:', leftText.split('\n').length);
  console.log('Right input lines:', rightText.split('\n').length);

  const result = await runDiffPipeline(leftText, rightText, { diffLines, diffWords, diffChars }, {
    detectMoves: true,
    modeToggles: { lines: true, words: true, chars: true }
  });

  console.log('\n=== Output Results ===');
  console.log('Total diff entries:', result.results.length);
  
  // Check that all input lines appear in output
  const leftLines = leftText.split('\n');
  const rightLines = rightText.split('\n');
  
  // Track which input lines appear in output
  // Note: diffLines doesn't track line numbers - we match by content
  const leftLinesFound = new Set();
  const rightLinesFound = new Set();
  
  result.results.forEach((entry, idx) => {
    const classification = entry.classification || (entry.added ? 'added' : entry.removed ? 'removed' : 'unchanged');
    const entryLines = entry.value.split('\n').filter(l => l.length > 0);
    console.log(`\n[${idx}] classification: ${classification}, lines: ${entryLines.length}`);
    
    entryLines.forEach((line, lineIdx) => {
      console.log(`    [${lineIdx}] "${line.substring(0, 50)}"`);
      
      // Match by trimmed content
      const trimmedLine = line.trim();
      
      // Check left input lines
      leftLines.forEach((leftLine, leftIdx) => {
        if (trimmedLine === leftLine.trim()) {
          leftLinesFound.add(leftIdx);
        }
      });
      
      // Check right input lines
      rightLines.forEach((rightLine, rightIdx) => {
        if (trimmedLine === rightLine.trim()) {
          rightLinesFound.add(rightIdx);
        }
      });
    });
  });

  console.log('\n=== Line Coverage ===');
  console.log(`Left lines found: ${leftLinesFound.size}/${leftLines.length}`);
  console.log(`Right lines found: ${rightLinesFound.size}/${rightLines.length}`);
  
  // Identify missing lines
  const missingLeftLines = [];
  leftLines.forEach((line, idx) => {
    if (!leftLinesFound.has(idx)) {
      missingLeftLines.push({ index: idx, line });
    }
  });
  
  const missingRightLines = [];
  rightLines.forEach((line, idx) => {
    if (!rightLinesFound.has(idx)) {
      missingRightLines.push({ index: idx, line });
    }
  });
  
  if (missingLeftLines.length > 0) {
    console.log('\n!!! MISSING LEFT LINES !!!');
    missingLeftLines.forEach(m => console.log(`  Line ${m.index}: "${m.line}"`));
  }
  
  if (missingRightLines.length > 0) {
    console.log('\n!!! MISSING RIGHT LINES !!!');
    missingRightLines.forEach(m => console.log(`  Line ${m.index}: "${m.line}"`));
  }
  
  // All input lines should be represented in output
  expect(leftLinesFound.size).toBe(leftLines.length);
  expect(rightLinesFound.size).toBe(rightLines.length);
});

test('Content preservation: removed lines should not disappear', async () => {
  const oldText = `line 1
line 2 to be removed
line 3`;
  
  const newText = `line 1
line 3`;

  const result = await runDiffPipeline(oldText, newText, { diffLines, diffWords, diffChars }, {
    detectMoves: true
  });

  // The removed line should still appear in output as 'removed'
  const hasRemovedLine = result.results.some(r => 
    r.removed && r.value.includes('line 2 to be removed')
  );
  
  console.log('\nRemoved line check:', hasRemovedLine);
  console.log('Results:', result.results.map(r => ({
    classification: r.classification || (r.added ? 'added' : r.removed ? 'removed' : 'unchanged'),
    value: r.value.substring(0, 30)
  })));
  
  expect(hasRemovedLine).toBe(true);
});

test('Content preservation: multi-line blocks should not be combined into single line', async () => {
  const oldText = `// comment 1
// comment 2
// comment 3
function test() {}`;

  const newText = `function test() {}`;

  const result = await runDiffPipeline(oldText, newText, { diffLines, diffWords, diffChars }, {
    detectMoves: false
  });

  // The three comment lines should appear as 3 separate entries or lines, not combined
  const removedEntries = result.results.filter(r => r.removed);
  
  console.log('\nRemoved entries:', removedEntries.length);
  removedEntries.forEach((entry, idx) => {
    const lines = entry.value.split('\n').filter(l => l.length > 0);
    console.log(`Entry ${idx}: ${lines.length} lines`);
    lines.forEach((line, lineIdx) => {
      console.log(`  [${lineIdx}] "${line}"`);
    });
  });
  
  // Should have individual lines, not all combined into one
  const totalRemovedLines = removedEntries.reduce((sum, entry) => 
    sum + entry.value.split('\n').filter(l => l.length > 0).length, 0
  );
  
  console.log('Total removed lines found:', totalRemovedLines);
  
  // All 3 comment lines should be present
  expect(totalRemovedLines).toBeGreaterThanOrEqual(3);
});
