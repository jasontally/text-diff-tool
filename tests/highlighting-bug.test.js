/**
 * Word/Char Highlighting Bug Test
 * 
 * Test case to reproduce the reported issue where word/char highlighting
 * stops working with just 3 lines of text.
 */

import { diffLines, diffWords, diffChars } from 'diff';
import { runDiffPipeline, detectModifiedLines } from '../src/diff-algorithms.js';
import { TEST_CONFIG } from './test-config.js';

describe('Word/Char Highlighting Bug - 3 Lines', () => {
  it('should highlight word changes in line 2 with 2 lines total', () => {
    const oldText = '# System Configuration\n# Version: 1.0.4';
    const newText = '# System Configuration\n# Version: 1.0.5';
    
    const result = runDiffPipeline(oldText, newText, { diffLines, diffWords, diffChars }, {
      config: TEST_CONFIG,
      modeToggles: { lines: true, words: true, chars: true }
    });
    
    console.log('2-line result:', JSON.stringify(result.results, null, 2));
    
    // Find the modified line
    const modifiedChanges = result.results.filter(r => r.classification === 'modified');
    expect(modifiedChanges.length).toBeGreaterThanOrEqual(1);
    
    // Should have word diff
    const hasWordDiff = modifiedChanges.some(c => c.wordDiff && c.wordDiff.length > 0);
    expect(hasWordDiff).toBe(true);
  });

  it('should highlight word changes in lines 2 and 3 with 3 lines total', () => {
    const oldText = '# System Configuration\n# Version: 1.0.4\n# Author: Alex Smith';
    const newText = '# System Configuration\n# Version: 1.0.5\n# Author: Alex J. Smith';
    
    const result = runDiffPipeline(oldText, newText, { diffLines, diffWords, diffChars }, {
      config: TEST_CONFIG,
      modeToggles: { lines: true, words: true, chars: true }
    });
    
    console.log('3-line result:', JSON.stringify(result.results, null, 2));
    
    // Find all modified lines
    const modifiedChanges = result.results.filter(r => r.classification === 'modified');
    console.log('Modified changes:', modifiedChanges.length);
    
    // Should have at least 2 modified lines (line 2 and line 3)
    expect(modifiedChanges.length).toBeGreaterThanOrEqual(2);
    
    // All modified lines should have word diffs
    modifiedChanges.forEach((change, idx) => {
      console.log(`Modified line ${idx}:`, change.value);
      console.log(`Has wordDiff:`, !!change.wordDiff);
      console.log(`Has charDiff:`, !!change.charDiff);
      
      // Each modified line should have word diff
      expect(change.wordDiff).toBeDefined();
      expect(change.wordDiff.length).toBeGreaterThan(0);
    });
  });

  it('should properly detect modified lines directly', () => {
    const oldText = '# System Configuration\n# Version: 1.0.4\n# Author: Alex Smith';
    const newText = '# System Configuration\n# Version: 1.0.5\n# Author: Alex J. Smith';
    
    // Run diffLines first
    const rawResults = diffLines(oldText, newText);
    console.log('Raw diffLines results:', JSON.stringify(rawResults, null, 2));
    
    // Then run detectModifiedLines
    const classified = detectModifiedLines(rawResults, diffWords, diffChars, {
      modeToggles: { lines: true, words: true, chars: true }
    });
    
    console.log('Classified results:', JSON.stringify(classified, null, 2));
    
    // Check that modified lines have wordDiff
    const modifiedChanges = classified.filter(r => r.classification === 'modified');
    modifiedChanges.forEach((change, idx) => {
      console.log(`Direct modified line ${idx}:`, change.value);
      console.log(`Has wordDiff:`, !!change.wordDiff);
      expect(change.wordDiff).toBeDefined();
      expect(change.wordDiff.length).toBeGreaterThan(0);
    });
  });

  it('should show the exact structure of the 3-line diff', () => {
    const oldText = '# System Configuration\n# Version: 1.0.4\n# Author: Alex Smith';
    const newText = '# System Configuration\n# Version: 1.0.5\n# Author: Alex J. Smith';
    
    // Check raw diffLines output
    const rawResults = diffLines(oldText, newText);
    console.log('\n=== RAW DIFFLINES OUTPUT ===');
    rawResults.forEach((r, i) => {
      console.log(`[${i}] added: ${r.added}, removed: ${r.removed}, value: "${r.value.replace(/\n/g, '\\n')}"`);
    });
    
    // Run full pipeline
    const result = runDiffPipeline(oldText, newText, { diffLines, diffWords, diffChars }, {
      config: TEST_CONFIG,
      modeToggles: { lines: true, words: true, chars: true }
    });
    
    console.log('\n=== FULL PIPELINE OUTPUT ===');
    result.results.forEach((r, i) => {
      console.log(`[${i}] classification: ${r.classification}, added: ${r.added}, removed: ${r.removed}, value: "${r.value.replace(/\n/g, '\\n')}"`);
      if (r.wordDiff) {
        console.log(`     wordDiff: ${JSON.stringify(r.wordDiff.map(d => ({ added: d.added, removed: d.removed, value: d.value })))}`);
      }
      if (r.charDiff) {
        console.log(`     charDiff: present (${r.charDiff.length} items)`);
      }
    });
  });
});
