import { test, expect } from 'vitest';
import { diffLines, diffWords, diffChars } from 'diff';
import { runDiffPipeline } from '../src/diff-algorithms.js';
import { enhanceDiffWithTreeSitterMoves } from '../src/tree-sitter-move-detector.js';

test('Missing lines bug: lines 28-29 should appear in output', async () => {
  // This is the exact scenario from the browser test
  const leftText = `// CONFIGURATION SECTION - UNCHANGED
const config = {
  debug: true,
  timeout: 5000
};
// ADDED LINES - Completely new function
function newFeature() {
  console.log("This is a new feature");
  return { status: "active" };
}
// UNCHANGED LINE
const unchanged = "stays the same";
// MODIFIED LINE - Comment changed to indicate modification
function calculateTotal(price) {
  // MODIFIED LINE - Changed from 'tax' to 'taxRate' and value
  const taxRate = price * 0.10;  // Tax rate increased
  return price + taxRate;
}
// MOVED MODIFIED LINES - Block moved here AND modified
function validateInput(input) {  // Function renamed
  // Modified during move - changed logic
  if (input === null || input === undefined) return false;
  return input.length > 0 && input.trim() !== "";
}
// MOVED LINE - Function moved from earlier position
function utilityFunction() {
  return "utility";
}
// MAIN FUNCTION - UNCHANGED
function main() {
  console.log("Starting application");
  calculateTotal(100);
  utilityFunction();
  newFeature();  // ADDED LINE - New call added
}`;

  const rightText = `// CONFIGURATION SECTION - UNCHANGED
const config = {
  debug: true,
  timeout: 5000
};
// REMOVED LINE - This entire function will be deleted
function oldHelperFunction() {
  return "this function is being removed";
}
// MOVED LINE - This function will move to after main()
function utilityFunction() {
  return "utility";
}
// UNCHANGED LINE
const unchanged = "stays the same";
// MODIFIED LINE - This comment will change
function calculateTotal(price) {
  // MODIFIED LINE - Variable name and value will change
  const tax = price * 0.08;
  return price + tax;
}
// MOVED MODIFIED LINES - This block moves AND changes
function validationHelper(data) {
  // This moves and gets modified
  if (!data) return false;
  return data.length > 0;
}
// ADDED LINES - These are new (only in File B)
// (Nothing here in File A)
// MAIN FUNCTION - UNCHANGED
function main() {
  console.log("Starting application");
  calculateTotal(100);
  utilityFunction();
}`;

  console.log('\n=== Missing Lines Bug Test ===');
  const leftLines = leftText.split('\n');
  const rightLines = rightText.split('\n');
  
  console.log('Left input lines:', leftLines.length);
  console.log('Right input lines:', rightLines.length);
  
  // Lines 28-29 in right input (0-indexed: 27-28)
  console.log('\nRight input lines 28-29:');
  console.log('  Line 28 (index 27):', rightLines[27]);
  console.log('  Line 29 (index 28):', rightLines[28]);
  
  // Define target lines early
  const targetLines = [rightLines[27], rightLines[28]];
  
  // First check raw diffLines output
  console.log('\n=== Raw diffLines Output ===');
  const rawResults = diffLines(rightText, leftText);
  console.log('Raw entries:', rawResults.length);
  
  // Check if target lines appear in raw output
  let rawFoundCount = 0;
  rawResults.forEach((entry, idx) => {
    const type = entry.added ? 'added' : entry.removed ? 'removed' : 'unchanged';
    const lines = entry.value.split('\n').filter(l => l.length > 0);
    
    lines.forEach(line => {
      targetLines.forEach(target => {
        if (line.trim() === target.trim()) {
          console.log(`✓ [Raw ${idx} ${type}] Found: "${target.substring(0, 50)}"`);
          rawFoundCount++;
        }
      });
    });
  });
  console.log(`Raw diffLines found: ${rawFoundCount}/2`);
  
  // Run diff pipeline
  const pipelineResult = await runDiffPipeline(leftText, rightText, { diffLines, diffWords, diffChars }, {
    detectMoves: true,
    modeToggles: { lines: true, words: true, chars: true }
  });
  
  console.log('\n=== Pipeline Results ===');
  console.log('Total entries:', pipelineResult.results.length);
  
  // Check if lines 28-29 appear in any entry
  let foundCount = 0;
  
  pipelineResult.results.forEach((entry, idx) => {
    const classification = entry.classification || (entry.added ? 'added' : entry.removed ? 'removed' : 'unchanged');
    const lines = entry.value.split('\n').filter(l => l.length > 0);
    
    lines.forEach(line => {
      if (targetLines.some(tl => line.trim() === tl.trim())) {
        console.log(`\n✓ FOUND target line in entry ${idx} (${classification}):`);
        console.log(`    "${line.substring(0, 60)}"`);
        foundCount++;
      }
    });
  });
  
  console.log(`\n=== Summary ===`);
  console.log(`Target lines found: ${foundCount}/2`);
  
  if (foundCount < 2) {
    console.log('\n!!! LINES 28-29 ARE MISSING FROM OUTPUT !!!');
    console.log('This is the bug we need to fix.');
  }
  
  // Both lines should be found
  // This test verifies that lines removed from the input actually appear
  // in the diff output with 'removed' classification
  expect(foundCount).toBe(2);
});
