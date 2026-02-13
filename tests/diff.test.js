/**
 * Diff Algorithms Unit Tests
 * 
 * Tests for the extracted algorithm functions.
 * These tests work in Node.js using the npm 'diff' package.
 * 
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { diffLines, diffWords, diffChars } from 'diff';
import {
  CONFIG,
  generateLineSignature,
  signatureHammingDistance,
  estimateSimilarity,
  calculateSimilarity,
  identifyChangeBlocks,
  buildOptimizedSimilarityMatrix,
  findOptimalPairings,
  detectBlockMovesFast,
  detectModifiedLines,
  fixDiffLinesClassification,
  calculateStats
} from '../src/diff-algorithms.js';

// ============================================================================
// Signature Generation Tests
// ============================================================================

describe('Signature Generation', () => {
  it('should generate consistent signatures for identical lines', async () => {
    const sig1 = generateLineSignature('interface GigabitEthernet0/1');
    const sig2 = generateLineSignature('interface GigabitEthernet0/1');
    expect(sig1).toBe(sig2);
  });

  it('should generate different signatures for different lines', async () => {
    const sig1 = generateLineSignature('abcdefghijklmnopqrstuvwxyz');
    const sig2 = generateLineSignature('zyxwvutsrqponmlkjihgfedcba');
    // These have the same characters but different order, should produce different signatures
    expect(sig1).not.toBe(sig2);
  });

  it('should handle empty lines', async () => {
    const sig = generateLineSignature('');
    expect(sig).toBe(0);
  });

  it('should be case insensitive', async () => {
    const sig1 = generateLineSignature('Interface');
    const sig2 = generateLineSignature('interface');
    expect(sig1).toBe(sig2);
  });

  it('should ignore leading/trailing whitespace', async () => {
    const sig1 = generateLineSignature('  interface  ');
    const sig2 = generateLineSignature('interface');
    expect(sig1).toBe(sig2);
  });
});

// ============================================================================
// Hamming Distance Tests
// ============================================================================

describe('Hamming Distance', () => {
  it('should return 0 for identical signatures', async () => {
    const distance = signatureHammingDistance(0b1010, 0b1010);
    expect(distance).toBe(0);
  });

  it('should count differing bits', async () => {
    const distance = signatureHammingDistance(0b0000, 0b1111);
    expect(distance).toBe(4);
  });

  it('should work with 32-bit signatures', async () => {
    const sig1 = generateLineSignature('line one');
    const sig2 = generateLineSignature('line two');
    const distance = signatureHammingDistance(sig1, sig2);
    expect(distance).toBeGreaterThanOrEqual(0);
    expect(distance).toBeLessThanOrEqual(32);
  });
});

// ============================================================================
// Similarity Estimation Tests
// ============================================================================

describe('Similarity Estimation', () => {
  it('should return 1.0 for identical lines', async () => {
    const sig = generateLineSignature('test line');
    const similarity = estimateSimilarity(sig, sig);
    expect(similarity).toBe(1.0);
  });

  it('should return lower similarity for different lines', async () => {
    const sig1 = generateLineSignature('interface GigabitEthernet0/1');
    const sig2 = generateLineSignature('completely different content here');
    const similarity = estimateSimilarity(sig1, sig2);
    // These lines share some bigrams, so similarity won't be 0
    // But should be less than identical lines (1.0)
    expect(similarity).toBeLessThan(1.0);
    expect(similarity).toBeGreaterThanOrEqual(0);
  });

  it('should return values between 0 and 1', async () => {
    const sig1 = generateLineSignature('interface GigabitEthernet0/1');
    const sig2 = generateLineSignature('interface GigabitEthernet0/2');
    const similarity = estimateSimilarity(sig1, sig2);
    expect(similarity).toBeGreaterThanOrEqual(0);
    expect(similarity).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
// Full Similarity Calculation Tests
// ============================================================================

describe('Full Similarity Calculation', () => {
  it('should return 1.0 for identical lines', async () => {
    const similarity = calculateSimilarity('test line', 'test line', diffWords);
    expect(similarity).toBe(1.0);
  });

  it('should return 0.0 for completely different lines', async () => {
    const similarity = calculateSimilarity('abc', 'xyz', diffWords);
    expect(similarity).toBe(0.0);
  });

  it('should detect partial similarity', async () => {
    const similarity = calculateSimilarity(
      'interface GigabitEthernet0/1',
      'interface GigabitEthernet0/2',
      diffWords
    );
    expect(similarity).toBeGreaterThan(0.5);
    expect(similarity).toBeLessThan(1.0);
  });

  it('should handle empty lines', async () => {
    expect(calculateSimilarity('', '', diffWords)).toBe(1.0);
    expect(calculateSimilarity('text', '', diffWords)).toBe(0.0);
    expect(calculateSimilarity('', 'text', diffWords)).toBe(0.0);
  });

  it('should be case insensitive', async () => {
    const similarity = calculateSimilarity('Test Line', 'test line', diffWords);
    expect(similarity).toBe(1.0);
  });

  it('should ignore leading/trailing whitespace', async () => {
    const similarity = calculateSimilarity('  test  ', 'test', diffWords);
    expect(similarity).toBe(1.0);
  });
});

// ============================================================================
// Change Block Identification Tests
// ============================================================================

describe('Change Block Identification', () => {
  it('should identify simple add/remove block', async () => {
    const diffResults = [
      { value: 'line 1', removed: true },
      { value: 'line 1 modified', added: true }
    ];
    
    const blocks = identifyChangeBlocks(diffResults);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].removed).toHaveLength(1);
    expect(blocks[0].added).toHaveLength(1);
  });

  it('should identify multiple consecutive changes as one block', async () => {
    const diffResults = [
      { value: 'old 1', removed: true },
      { value: 'old 2', removed: true },
      { value: 'new 1', added: true },
      { value: 'new 2', added: true }
    ];
    
    const blocks = identifyChangeBlocks(diffResults);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].removed).toHaveLength(2);
    expect(blocks[0].added).toHaveLength(2);
  });

  it('should separate non-consecutive changes', async () => {
    const diffResults = [
      { value: 'old 1', removed: true },
      { value: 'unchanged', added: false, removed: false },
      { value: 'old 2', removed: true },
      { value: 'new 2', added: true }
    ];
    
    const blocks = identifyChangeBlocks(diffResults);
    expect(blocks).toHaveLength(2);
  });

  it('should preserve original indices', async () => {
    const diffResults = [
      { value: 'old', removed: true },
      { value: 'new', added: true }
    ];
    
    const blocks = identifyChangeBlocks(diffResults);
    expect(blocks[0].removed[0].index).toBe(0);
    expect(blocks[0].added[0].index).toBe(1);
  });
});

// ============================================================================
// Similarity Matrix Tests
// ============================================================================

describe('Optimized Similarity Matrix', () => {
  it('should build matrix for single remove/add pair', async () => {
    const block = {
      removed: [{ line: 'test', index: 0 }],
      added: [{ line: 'test', index: 1 }]
    };
    
    const matrix = buildOptimizedSimilarityMatrix(block, diffWords);
    expect(matrix).toHaveLength(1);
    expect(matrix[0]).toHaveLength(1);
    expect(matrix[0][0]).toBe(1.0);
  });

  it('should build matrix for multiple pairs', async () => {
    const block = {
      removed: [{ line: 'a', index: 0 }, { line: 'b', index: 1 }],
      added: [{ line: 'a', index: 2 }, { line: 'c', index: 3 }]
    };
    
    const matrix = buildOptimizedSimilarityMatrix(block, diffWords);
    expect(matrix).toHaveLength(2);
    expect(matrix[0]).toHaveLength(2);
    
    // Same lines should have high similarity
    expect(matrix[0][0]).toBeGreaterThan(0.9); // a vs a
    expect(matrix[1][1]).toBeLessThan(0.5); // b vs c
  });

  it('should use fast threshold to skip expensive diffs', async () => {
    const block = {
      removed: [{ line: 'completely different text here', index: 0 }],
      added: [{ line: 'nothing alike at all', index: 1 }]
    };
    
    const matrix = buildOptimizedSimilarityMatrix(block, diffWords, 0.5);
    // With high threshold, should use signature estimate only
    expect(matrix[0][0]).toBeLessThan(0.5);
  });
});

// ============================================================================
// Optimal Pairing Tests
// ============================================================================

describe('Optimal Pairing', () => {
  it('should pair identical lines as modified', async () => {
    const block = {
      removed: [{ line: 'test', index: 0 }],
      added: [{ line: 'test', index: 1 }]
    };
    const matrix = [[1.0]];
    
    const pairings = await findOptimalPairings(block, matrix, diffWords, diffChars);
    expect(pairings).toHaveLength(1);
    expect(pairings[0].type).toBe('modified');
    expect(pairings[0].similarity).toBe(1.0);
  });

  it('should only pair lines meeting similarity threshold', async () => {
    const block = {
      removed: [{ line: 'foo bar', index: 0 }],
      added: [{ line: 'baz qux', index: 1 }]
    };
    // Similarity 0.1 is below CONFIG.MODIFIED_THRESHOLD (0.50)
    // So lines should NOT be paired as modified
    const matrix = [[0.1]];

    const pairings = await findOptimalPairings(block, matrix, diffWords, diffChars);
    // Should get 2 pairings: 1 removed + 1 added (not modified)
    expect(pairings).toHaveLength(2);
    expect(pairings.some(p => p.type === 'removed')).toBe(true);
    expect(pairings.some(p => p.type === 'added')).toBe(true);
    expect(pairings.some(p => p.type === 'modified')).toBe(false);
  });

  it('should pair best matches first (greedy)', async () => {
    const block = {
      removed: [
        { line: 'aaa', index: 0 },
        { line: 'bbb', index: 1 }
      ],
      added: [
        { line: 'aaa', index: 2 },
        { line: 'bbb', index: 3 }
      ]
    };
    // Matrix: aaa matches aaa (1.0), bbb matches bbb (1.0)
    // Cross: aaa matches bbb (low), bbb matches aaa (low)
    const matrix = [
      [1.0, 0.1],
      [0.1, 1.0]
    ];
    
    const pairings = await findOptimalPairings(block, matrix, diffWords, diffChars);
    const modified = pairings.filter(p => p.type === 'modified');
    expect(modified).toHaveLength(2);
  });

  it('should handle unequal numbers of removes and adds', async () => {
    const block = {
      removed: [{ line: 'old', index: 0 }],
      added: [
        { line: 'new1', index: 1 },
        { line: 'new2', index: 2 }
      ]
    };
    // Similarity 0.3 is below CONFIG.MODIFIED_THRESHOLD (0.50)
    // So no modified pairing should occur
    const matrix = [[0.3, 0.3]];

    const pairings = await findOptimalPairings(block, matrix, diffWords, diffChars);
    // Should get 3 pairings: 1 removed + 2 added (no modified since similarity < threshold)
    expect(pairings).toHaveLength(3);
    expect(pairings.filter(p => p.type === 'removed').length).toBe(1);
    expect(pairings.filter(p => p.type === 'added').length).toBe(2);
    expect(pairings.filter(p => p.type === 'modified').length).toBe(0);
  });
});

// ============================================================================
// Move Detection Tests
// ============================================================================

describe('Block Move Detection', () => {
  it('should detect exact moves across blocks', async () => {
    // Need at least 10 total changes to trigger move detection
    const blocks = [
      {
        removed: [
          { line: 'line 1', index: 0 },
          { line: 'line 2', index: 1 },
          { line: 'line 3', index: 2 },
          { line: 'line 4', index: 3 },
          { line: 'moved line', index: 4 }
        ],
        added: []
      },
      {
        removed: [],
        added: [
          { line: 'new line 1', index: 5 },
          { line: 'new line 2', index: 6 },
          { line: 'new line 3', index: 7 },
          { line: 'new line 4', index: 8 },
          { line: 'moved line', index: 9 }
        ]
      }
    ];
    
    const result = detectBlockMovesFast(blocks, diffWords, diffChars);
    expect(result.moves.size).toBe(1);
    expect(result.moves.get(4).type).toBe('moved');
    expect(result.moves.get(4).toIndex).toBe(9);
  });

  it('should not detect moves within same block', async () => {
    const blocks = [
      {
        removed: [{ line: 'line', index: 0 }],
        added: [{ line: 'line', index: 1 }]
      }
    ];
    
    const result = detectBlockMovesFast(blocks, diffWords, diffChars);
    expect(result.moves.size).toBe(0);
  });

  it('should require minimum number of changes', async () => {
    const blocks = [
      {
        removed: [{ line: 'a', index: 0 }],
        added: []
      }
    ];
    
    const result = detectBlockMovesFast(blocks, diffWords, diffChars);
    expect(result.moves.size).toBe(0); // Below threshold
  });

  it('should only detect high-similarity moves', async () => {
    const blocks = [
      {
        removed: [{ line: 'original text here', index: 0 }],
        added: []
      },
      {
        removed: [],
        added: [{ line: 'completely different content', index: 1 }]
      }
    ];
    
    const result = detectBlockMovesFast(blocks, diffWords, diffChars, 8, 0.90);
    expect(result.moves.size).toBe(0);
  });
});

// ============================================================================
// Complete Pipeline Tests
// ============================================================================

describe('Complete Pipeline', () => {
  it('should classify simple modifications', async () => {
    const oldText = 'interface GigabitEthernet0/1\n  ip address 192.168.1.1 255.255.255.0\n  no shutdown';
    const newText = 'interface GigabitEthernet0/1\n  ip address 10.0.0.1 255.255.255.0\n  no shutdown';
    
    const rawDiff = diffLines(oldText, newText);
    const classified = await detectModifiedLines(rawDiff, diffWords, diffChars);
    
    expect(classified.some(c => c.classification === 'modified')).toBe(true);
  });

  it('should classify additions and removals', async () => {
    const oldText = 'interface GigabitEthernet0/1\n  no shutdown';
    const newText = 'interface GigabitEthernet0/1\n  ip address 192.168.1.1 255.255.255.0\n  no shutdown';
    
    const rawDiff = diffLines(oldText, newText);
    const classified = await detectModifiedLines(rawDiff, diffWords, diffChars);
    
    expect(classified.some(c => c.classification === 'added')).toBe(true);
  });

  it('should classify line added at end as added', async () => {
    const oldText = 'line one';
    const newText = 'line one\nnew line added';
    
    // Use the fix function before detectModifiedLines
    const rawDiff = diffLines(oldText, newText);
    const fixedDiff = fixDiffLinesClassification(rawDiff, oldText);
    const classified = await detectModifiedLines(fixedDiff, diffWords, diffChars);
    
    expect(classified.some(c => c.classification === 'added')).toBe(true);
    expect(classified.filter(c => c.classification === 'added').length).toBe(1);
  });

  it('should classify line removed from end as removed', async () => {
    const oldText = 'line one\nline to remove';
    const newText = 'line one';
    
    const rawDiff = diffLines(oldText, newText);
    const fixedDiff = fixDiffLinesClassification(rawDiff, oldText);
    const classified = await detectModifiedLines(fixedDiff, diffWords, diffChars);
    
    expect(classified.some(c => c.classification === 'removed')).toBe(true);
    expect(classified.filter(c => c.classification === 'removed').length).toBe(1);
  });

  it('should include wordDiff for modified lines', async () => {
    const oldText = 'interface GigabitEthernet0/1 description old';
    const newText = 'interface GigabitEthernet0/1 description new';
    
    const rawDiff = diffLines(oldText, newText);
    const classified = await detectModifiedLines(rawDiff, diffWords, diffChars);
    
    const modified = classified.find(c => c.classification === 'modified');
    expect(modified).toBeDefined();
    expect(modified.wordDiff).toBeDefined();
    expect(Array.isArray(modified.wordDiff)).toBe(true);
  });

  it('should calculate accurate statistics', async () => {
    const oldText = 'keep\nremove\nmodify';
    const newText = 'keep\nadd\nmodified';
    
    const rawDiff = diffLines(oldText, newText);
    const classified = await detectModifiedLines(rawDiff, diffWords, diffChars);
    const stats = calculateStats(classified);
    
    expect(stats.unchanged).toBeGreaterThan(0);
    expect(stats.added + stats.removed + stats.modified).toBeGreaterThan(0);
    expect(stats.totalChanges).toBe(classified.length);
  });
});

// ============================================================================
// Statistics Tests
// ============================================================================

describe('Statistics Calculation', () => {
  it('should count all classifications', async () => {
    const classified = [
      { classification: 'added' },
      { classification: 'removed' },
      { classification: 'modified' },
      { classification: 'unchanged' }
    ];
    
    const stats = calculateStats(classified);
    expect(stats.added).toBe(1);
    expect(stats.removed).toBe(1);
    expect(stats.modified).toBe(1);
    expect(stats.unchanged).toBe(1);
    expect(stats.totalChanges).toBe(4);
  });

  it('should handle empty results', async () => {
    const stats = calculateStats([]);
    expect(stats.added).toBe(0);
    expect(stats.removed).toBe(0);
    expect(stats.modified).toBe(0);
    expect(stats.moved).toBe(0);
    expect(stats.unchanged).toBe(0);
    expect(stats.totalChanges).toBe(0);
  });

  it('should count multiple of same type', async () => {
    const classified = [
      { classification: 'added' },
      { classification: 'added' },
      { classification: 'removed' }
    ];
    
    const stats = calculateStats(classified);
    expect(stats.added).toBe(2);
    expect(stats.removed).toBe(1);
  });
});

// ============================================================================
// Configuration Tests
// ============================================================================

describe('Configuration', () => {
  it('should have reasonable default thresholds', async () => {
    expect(CONFIG.MODIFIED_THRESHOLD).toBe(0.50);
    expect(CONFIG.MOVE_THRESHOLD).toBe(0.90);
    expect(CONFIG.FAST_THRESHOLD).toBe(0.30);
  });

  it('should have valid signature configuration', async () => {
    expect(CONFIG.SIGNATURE_BITS).toBe(32);
    expect(CONFIG.LSH_BANDS).toBe(8);
    expect(CONFIG.SIGNATURE_BITS % CONFIG.LSH_BANDS).toBe(0); // Must divide evenly
  });

  it('should have reasonable file size limits', async () => {
    expect(CONFIG.MIN_LINES_FOR_MOVE_DETECTION).toBeLessThan(CONFIG.MAX_LINES_FOR_MOVE_DETECTION);
    expect(CONFIG.MAX_LINES_FOR_MOVE_DETECTION).toBe(50000);
  });
});

// ============================================================================
// Performance Tests (Small Scale)
// ============================================================================

describe('Performance', () => {
  it('should handle 100 lines quickly', async () => {
    const oldText = Array(100).fill('line').map((l, i) => `${l} ${i}`).join('\n');
    const newText = Array(100).fill('line').map((l, i) => `${l} ${i + 1}`).join('\n');
    
    const start = performance.now();
    const rawDiff = diffLines(oldText, newText);
    const classified = await detectModifiedLines(rawDiff, diffWords, diffChars);
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    expect(classified.length).toBeGreaterThan(0);
  });

  it('should handle lines with varying similarity', async () => {
    const lines = [
      'interface GigabitEthernet0/1',
      '  ip address 192.168.1.1 255.255.255.0',
      '  no shutdown',
      '!'
    ];
    
    const oldText = lines.join('\n');
    const newText = lines.map(l => l.replace('192.168.1.1', '10.0.0.1')).join('\n');
    
    const rawDiff = diffLines(oldText, newText);
    const classified = await detectModifiedLines(rawDiff, diffWords, diffChars);
    
    expect(classified.filter(c => c.classification === 'modified').length).toBeGreaterThan(0);
  });

  it('should store both removedLine and addedLine for modified lines', async () => {
    // This test verifies that modified lines have both values stored correctly
    // for display in separate panels
    // Use lines with >60% similarity to ensure they're classified as modified
    const oldText = 'interface GigabitEthernet0/1\n  ip address 192.168.1.1 255.255.255.0';
    const newText = 'interface GigabitEthernet0/1\n  ip address 10.0.0.1 255.255.255.0';
    
    const rawDiff = diffLines(oldText, newText);
    const classified = await detectModifiedLines(rawDiff, diffWords, diffChars);
    
    // Find modified lines
    const modifiedLines = classified.filter(c => c.classification === 'modified');
    
    // We should have at least 1 modified line (the IP address line)
    expect(modifiedLines.length).toBeGreaterThanOrEqual(1);
    
    // Each modified line should have both removedLine and addedLine
    modifiedLines.forEach(line => {
      expect(line.removedLine).toBeDefined();
      expect(line.addedLine).toBeDefined();
      expect(line.removedLine).not.toBe(line.addedLine);
    });
    
    // Verify specific content for IP line
    const ipLine = modifiedLines.find(l => 
      l.removedLine.includes('192.168') || l.addedLine.includes('10.0.0')
    );
    expect(ipLine).toBeDefined();
    expect(ipLine.removedLine).toContain('192.168.1.1');
    expect(ipLine.addedLine).toContain('10.0.0.1');
    expect(ipLine.removedLine).not.toContain('10.0.0.1');
    expect(ipLine.addedLine).not.toContain('192.168.1.1');
  });
});
