/**
 * Debug test for Python function modification detection
 * Run with: npm test -- tests/debug-python-modified.test.js
 */

import { describe, it, expect } from 'vitest';
import { diffLines, diffWords, diffChars } from 'diff';
import {
  calculateSimilarity,
  calculateSimilarityEnhanced,
  identifyChangeBlocks,
  buildOptimizedSimilarityMatrix,
  findOptimalPairings,
  detectModifiedLines,
  CONFIG
} from '../src/diff-algorithms.js';

describe('Python Function Modification Detection', () => {
  const oldText = `import math

def process_data(data):
    # Calculate sum of all items
    total = sum(data)
    
    # Apply processing loop
    results = []
    for item in data:
        val = item * 1.5
        results.append(val)
        
    print("Processing complete.")
    return total, results

# Initial call
process_data([10, 20, 30])`;

  const newText = `import math

def process_data(data, factor=1.5):
    # Calculate sum of all items
    total = sum(data)
    
    # Apply processing loop
    results = []
    for item in data:
        val = item * factor
        results.append(val)
        
    print("Processing complete.")
    return total, results

# Initial call
process_data([10, 20, 30])`;

  it('should detect function signature modification in context', async () => {
    const rawDiff = diffLines(oldText, newText);
    const classified = await detectModifiedLines(rawDiff, diffWords, diffChars, {
      modifiedThreshold: CONFIG.MODIFIED_THRESHOLD,
      fastThreshold: CONFIG.FAST_THRESHOLD
    });

    // Find the function definition line classification
    const functionLineChanges = classified.filter((c, idx) => {
      const lines = c.value.split('\n');
      return lines.some(line => line.includes('def process_data'));
    });

    console.log('Function line changes:', functionLineChanges.map(c => ({
      classification: c.classification,
      similarity: c.similarity,
      line: c.value.split('\n')[0].substring(0, 50)
    })));

    // The function definition should be classified as 'modified', not 'removed'/'added'
    const functionModified = functionLineChanges.some(c => 
      c.classification === 'modified' && c.similarity > CONFIG.MODIFIED_THRESHOLD
    );

    expect(functionModified).toBe(true);
  });

  it('should calculate high similarity for function signature changes', () => {
    const line1 = 'def process_data(data):';
    const line2 = 'def process_data(data, factor=1.5):';

    const wordSim = calculateSimilarity(line1, line2, diffWords);
    const enhancedSim = calculateSimilarityEnhanced(line1, line2, diffWords);

    console.log('Word similarity:', wordSim.toFixed(4));
    console.log('Enhanced similarity:', enhancedSim.toFixed(4));
    console.log('Threshold:', CONFIG.MODIFIED_THRESHOLD);

    // Both should be well above the 0.60 threshold
    expect(wordSim).toBeGreaterThan(0.60);
    expect(enhancedSim).toBeGreaterThan(0.60);
  });

  it('should properly pair function lines in change block', async () => {
    const rawDiff = diffLines(oldText, newText);
    const blocks = identifyChangeBlocks(rawDiff);

    console.log('Number of blocks:', blocks.length);
    
    for (const block of blocks) {
      console.log(`\nBlock:`);
      console.log(`  Removed: ${block.removed.length}`);
      block.removed.forEach((r, i) => {
        console.log(`    [${i}] ${r.line.substring(0, 60)}`);
      });
      console.log(`  Added: ${block.added.length}`);
      block.added.forEach((a, i) => {
        console.log(`    [${i}] ${a.line.substring(0, 60)}`);
      });

      if (block.removed.length > 0 && block.added.length > 0) {
        const matrix = buildOptimizedSimilarityMatrix(block, diffWords);
        console.log('  Similarity matrix:');
        matrix.forEach((row, r) => {
          console.log(`    Removed[${r}]: ${row.map(s => s.toFixed(2)).join(', ')}`);
        });

        const pairings = await findOptimalPairings(
          block, 
          matrix, 
          diffWords, 
          diffChars,
          CONFIG.MODIFIED_THRESHOLD
        );

        console.log('  Pairings:');
        pairings.forEach(p => {
          console.log(`    Type: ${p.type}, Similarity: ${p.similarity?.toFixed(4) || 'N/A'}`);
        });

        // At least one pairing should be a modification with high similarity
        const hasModification = pairings.some(p => 
          p.type === 'modified' && p.similarity > CONFIG.MODIFIED_THRESHOLD
        );
        expect(hasModification).toBe(true);
      }
    }
  });
});
