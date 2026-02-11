/**
 * Test for cross-block modification detection
 * Tests that lines modified and moved up to 10 lines apart are detected as modified
 * 
 * Run with: npm test -- tests/cross-block-modified.test.js
 */

import { describe, it, expect } from 'vitest';
import { diffLines, diffWords, diffChars } from 'diff';
import {
  detectBlockMovesFast,
  identifyChangeBlocks,
  CONFIG
} from '../src/diff-algorithms.js';

describe('Cross-Block Modification Detection', () => {
  it('should detect cross-block modifications for moved similar lines', () => {
    // Simulate a scenario where a line is removed from position 3
    // and added at position 8 (5 lines moved) with slight modification
    // Need at least 10 total changes to trigger move detection
    const blocks = [
      {
        // First block: multiple lines removed (including the function def)
        removed: [
          { line: 'import math', index: 0 },
          { line: 'import sys', index: 1 },
          { line: '', index: 2 },
          { line: 'def process_data(data):', index: 3 },
          { line: '    pass', index: 4 },
          { line: '', index: 5 }
        ],
        added: []
      },
      {
        // Some unchanged lines would be here in the real diff
        removed: [],
        added: []
      },
      {
        // Second block: lines added (function def moved down with change)
        removed: [],
        added: [
          { line: '# Helper function', index: 10 },
          { line: 'def helper():', index: 11 },
          { line: '    pass', index: 12 },
          { line: '', index: 13 },
          { line: 'def process_data(data, factor=1.5):', index: 14 },
          { line: '    return data', index: 15 }
        ]
      }
    ];

    const result = detectBlockMovesFast(blocks, diffWords, diffChars);
    
    console.log('Moves detected:', result.moves.size);
    console.log('Cross-block modifications:', result.crossBlockModifications.length);
    
    // The function definition should be detected as moved
    expect(result.moves.size).toBeGreaterThan(0);
    
    // It should also be detected as a cross-block modification
    // because the similarity is high (around 0.80)
    expect(result.crossBlockModifications.length).toBeGreaterThan(0);
    
    // Find the modification for the function definition
    const funcMod = result.crossBlockModifications.find(m => 
      (m.removedLine && m.removedLine.includes('def process_data')) ||
      (m.addedLine && m.addedLine.includes('def process_data'))
    );
    
    expect(funcMod).toBeDefined();
    expect(funcMod.type).toBe('modified');
    expect(funcMod.isCrossBlock).toBe(true);
    expect(funcMod.similarity).toBeGreaterThan(CONFIG.MODIFIED_THRESHOLD);
    expect(funcMod.removedLine).toContain('def process_data');
    expect(funcMod.addedLine).toContain('def process_data');
    
    // Should have word and char diffs
    expect(funcMod.wordDiff).toBeDefined();
    expect(funcMod.charDiff).toBeDefined();
  });

  it('should detect modifications when function moves up 10 lines', () => {
    // Create two blocks 10 lines apart with similar content
    const blocks = [
      {
        // Lines 0-4 removed
        removed: [
          { line: 'line 0', index: 0 },
          { line: 'line 1', index: 1 },
          { line: 'line 2', index: 2 },
          { line: 'def helper():', index: 3 },
          { line: '    pass', index: 4 }
        ],
        added: []
      },
      {
        // Empty block (lines 5-9)
        removed: [],
        added: []
      },
      {
        // Lines 10-14 added
        removed: [],
        added: [
          { line: 'line 10', index: 10 },
          { line: 'line 11', index: 11 },
          { line: 'line 12', index: 12 },
          { line: 'def helper(x):', index: 13 },
          { line: '    return x', index: 14 }
        ]
      }
    ];

    const result = detectBlockMovesFast(blocks, diffWords, diffChars);
    
    console.log('Helper function move detection:');
    console.log('  Moves:', result.moves.size);
    console.log('  Cross-block mods:', result.crossBlockModifications.length);
    
    if (result.crossBlockModifications.length > 0) {
      const mod = result.crossBlockModifications[0];
      console.log('  Similarity:', mod.similarity.toFixed(4));
      console.log('  Removed:', mod.removedLine);
      console.log('  Added:', mod.addedLine);
    }
    
    // Should detect cross-block modifications for modified functions
    // (similarity is ~0.79, which is below move threshold of 0.90 but above modified threshold of 0.60)
    expect(result.crossBlockModifications.length).toBeGreaterThan(0);
    
    // The function definition should be detected as a cross-block modification
    const funcMod = result.crossBlockModifications.find(m => 
      m.removedLine.includes('def helper') || m.addedLine.includes('def helper')
    );
    expect(funcMod).toBeDefined();
    expect(funcMod.similarity).toBeGreaterThan(CONFIG.MODIFIED_THRESHOLD);
  });

  it('should not create cross-block modifications for dissimilar moved lines', () => {
    const blocks = [
      {
        removed: [
          { line: 'completely different content here', index: 0 },
          { line: 'another line', index: 1 },
          { line: 'third line', index: 2 },
          { line: 'fourth line', index: 3 },
          { line: 'fifth line', index: 4 }
        ],
        added: []
      },
      {
        removed: [],
        added: []
      },
      {
        removed: [],
        added: [
          { line: 'new content', index: 10 },
          { line: 'more new', index: 11 },
          { line: 'even more', index: 12 },
          { line: 'totally unrelated', index: 13 },
          { line: 'last one', index: 14 }
        ]
      }
    ];

    const result = detectBlockMovesFast(blocks, diffWords, diffChars);
    
    // Should not detect cross-block modifications for dissimilar lines
    // because similarity will be below the 0.60 threshold
    const similarMods = result.crossBlockModifications.filter(
      m => m.similarity >= CONFIG.MODIFIED_THRESHOLD
    );
    
    expect(similarMods.length).toBe(0);
  });
});
