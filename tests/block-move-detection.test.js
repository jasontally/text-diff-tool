// Test Block Move Detection Implementation
// This test specifically verifies the new block move detection features

import { describe, it, expect } from 'vitest';
import { detectBlockMovesFast } from '../src/diff-algorithms.js';

// Mock diff functions
const mockDiffWords = (a, b) => [{ value: a, removed: true }, { value: b, added: true }];
const mockDiffChars = (a, b) => [{ value: a, removed: true }, { value: b, added: true }];

describe('Block Move Detection', () => {
  it('should detect a 3-line block move', () => {
    // Create test blocks with 3-line moved sequence + filler to meet minimum
    const allBlocks = [
      {
        removed: [
          { line: 'function funcA() {', index: 0, blockIdx: 0, localIdx: 0 },
          { line: '    return 1;', index: 1, blockIdx: 0, localIdx: 1 },
          { line: '}', index: 2, blockIdx: 0, localIdx: 2 },
          { line: 'filler1', index: 3, blockIdx: 0, localIdx: 3 },
          { line: 'filler2', index: 4, blockIdx: 0, localIdx: 4 }
        ],
        added: []
      },
      {
        removed: [],
        added: [
          { line: 'filler1', index: 8, blockIdx: 1, localIdx: 0 },
          { line: 'filler2', index: 9, blockIdx: 1, localIdx: 1 },
          { line: 'function funcA() {', index: 10, blockIdx: 1, localIdx: 2 },
          { line: '    return 1;', index: 11, blockIdx: 1, localIdx: 3 },
          { line: '}', index: 12, blockIdx: 1, localIdx: 4 }
        ]
      }
    ];
    
    const result = detectBlockMovesFast(allBlocks, mockDiffWords, mockDiffChars);
    
    // Should detect the 3-line block move
    expect(result.blockMoves).toBeDefined();
    expect(result.blockMoves.length).toBe(1);
    expect(result.blockMoves[0].type).toBe('block-moved');
    expect(result.blockMoves[0].size).toBe(3);
    expect(result.blockMoves.some(move => move.size === 3 && move.from === 0 && move.to === 10)).toBe(true);
  });

  it('should detect a 5-line block move', () => {
    const allBlocks = [
      {
        removed: [
          ...Array(5).fill(null).map((_, i) => ({
            line: `line ${i + 1}`,
            index: i,
            blockIdx: 0,
            localIdx: i
          })),
          { line: 'filler1', index: 5, blockIdx: 0, localIdx: 5 },
          { line: 'filler2', index: 6, blockIdx: 0, localIdx: 6 },
          { line: 'filler3', index: 7, blockIdx: 0, localIdx: 7 }
        ],
        added: []
      },
      {
        removed: [],
        added: [
          { line: 'filler1', index: 15, blockIdx: 1, localIdx: 0 },
          { line: 'filler2', index: 16, blockIdx: 1, localIdx: 1 },
          { line: 'filler3', index: 17, blockIdx: 1, localIdx: 2 },
          ...Array(5).fill(null).map((_, i) => ({
            line: `line ${i + 1}`,
            index: i + 20,
            blockIdx: 1,
            localIdx: i + 3
          }))
        ]
      }
    ];
    
    const result = detectBlockMovesFast(allBlocks, mockDiffWords, mockDiffChars);
    
    // Should detect the 5-line block move
    expect(result.blockMoves.length).toBeGreaterThan(0);
    expect(result.blockMoves.some(move => move.size === 5)).toBe(true);
    expect(result.blockMoves.some(move => move.size === 5 && move.similarity > 0.8)).toBe(true);
  });

  it('should ignore blocks smaller than minimum size', () => {
    const allBlocks = [
      {
        removed: [
          { line: 'line 1', index: 0, blockIdx: 0, localIdx: 0 },
          { line: 'line 2', index: 1, blockIdx: 0, localIdx: 1 }
        ],
        added: []
      },
      {
        removed: [],
        added: [
          { line: 'line 1', index: 10, blockIdx: 1, localIdx: 0 },
          { line: 'line 2', index: 11, blockIdx: 1, localIdx: 1 }
        ]
      }
    ];
    
    const result = detectBlockMovesFast(allBlocks, mockDiffWords, mockDiffChars);
    
    // Should not detect 2-line blocks (below MIN_BLOCK_SIZE)
    expect(result.blockMoves.length).toBe(0);
  });

  it('should handle multiple block moves', () => {
    // Two separate 3-line blocks moved
    const allBlocks = [
      {
        removed: [
          { line: 'block1 line1', index: 0, blockIdx: 0, localIdx: 0 },
          { line: 'block1 line2', index: 1, blockIdx: 0, localIdx: 1 },
          { line: 'block1 line3', index: 2, blockIdx: 0, localIdx: 2 },
          { line: 'block2 line1', index: 3, blockIdx: 0, localIdx: 3 },
          { line: 'block2 line2', index: 4, blockIdx: 0, localIdx: 4 },
          { line: 'block2 line3', index: 5, blockIdx: 0, localIdx: 5 }
        ],
        added: []
      },
      {
        removed: [],
        added: [
          { line: 'block2 line1', index: 20, blockIdx: 1, localIdx: 0 },
          { line: 'block2 line2', index: 21, blockIdx: 1, localIdx: 1 },
          { line: 'block2 line3', index: 22, blockIdx: 1, localIdx: 2 },
          { line: 'block1 line1', index: 23, blockIdx: 1, localIdx: 3 },
          { line: 'block1 line2', index: 24, blockIdx: 1, localIdx: 4 },
          { line: 'block1 line3', index: 25, blockIdx: 1, localIdx: 5 }
        ]
      }
    ];
    
    const result = detectBlockMovesFast(allBlocks, mockDiffWords, mockDiffChars);
    
    // Should detect both block moves
    expect(result.blockMoves.length).toBe(2);
    
    const block1Move = result.blockMoves.find(m => m.from === 0 && m.to === 23);
    const block2Move = result.blockMoves.find(m => m.from === 3 && m.to === 20);
    
    expect(block1Move).toBeDefined();
    expect(block2Move).toBeDefined();
  });

  it('should return empty blockMoves for large files (performance protection)', () => {
    // Create many lines to simulate a large file (over 5000 total lines)
    const allBlocks = [
      {
        removed: Array(3000).fill(null).map((_, i) => ({
          line: `line ${i}`,
          index: i,
          blockIdx: 0,
          localIdx: i
        })),
        added: []
      },
      {
        removed: [],
        added: Array(3000).fill(null).map((_, i) => ({
          line: `line ${i}`,
          index: i + 3000,
          blockIdx: 1,
          localIdx: i
        }))
      }
    ];
    
    const result = detectBlockMovesFast(allBlocks, mockDiffWords, mockDiffChars);
    
    // Should skip block detection for large files - return empty array, not undefined
    expect(result.blockMoves).toEqual([]);
  });

  it('should detect a 10-line block move', () => {
    const allBlocks = [
      {
        removed: [
          ...Array(10).fill(null).map((_, i) => ({
            line: `function func${i}() { return ${i}; }`,
            index: i,
            blockIdx: 0,
            localIdx: i
          })),
          ...Array(5).fill(null).map((_, i) => ({
            line: `filler${i}`,
            index: 10 + i,
            blockIdx: 0,
            localIdx: 10 + i
          }))
        ],
        added: []
      },
      {
        removed: [],
        added: [
          ...Array(5).fill(null).map((_, i) => ({
            line: `filler${i}`,
            index: 40 + i,
            blockIdx: 1,
            localIdx: i
          })),
          ...Array(10).fill(null).map((_, i) => ({
            line: `function func${i}() { return ${i}; }`,
            index: i + 50,
            blockIdx: 1,
            localIdx: i + 5
          }))
        ]
      }
    ];
    
    const result = detectBlockMovesFast(allBlocks, mockDiffWords, mockDiffChars);
    
    // Should detect the 10-line block move
    expect(result.blockMoves.length).toBeGreaterThan(0);
    expect(result.blockMoves.some(move => move.size === 10)).toBe(true);
    expect(result.blockMoves.some(move => move.size === 10 && move.from === 0 && move.to === 50)).toBe(true);
    expect(result.blockMoves.some(move => move.size === 10 && move.similarity > 0.8)).toBe(true);
  });

  it('should handle overlapping block moves correctly', () => {
    // Create overlapping blocks - one 3-line and one 5-line that share lines
    const allBlocks = [
      {
        removed: [
          { line: 'line A1', index: 0, blockIdx: 0, localIdx: 0 },
          { line: 'line A2', index: 1, blockIdx: 0, localIdx: 1 },
          { line: 'line A3', index: 2, blockIdx: 0, localIdx: 2 },
          { line: 'line A4', index: 3, blockIdx: 0, localIdx: 3 },
          { line: 'line A5', index: 4, blockIdx: 0, localIdx: 4 },
          { line: 'filler1', index: 5, blockIdx: 0, localIdx: 5 },
          { line: 'filler2', index: 6, blockIdx: 0, localIdx: 6 }
        ],
        added: []
      },
      {
        removed: [],
        added: [
          { line: 'filler1', index: 10, blockIdx: 1, localIdx: 0 },
          { line: 'filler2', index: 11, blockIdx: 1, localIdx: 1 },
          { line: 'line A1', index: 12, blockIdx: 1, localIdx: 2 },
          { line: 'line A2', index: 13, blockIdx: 1, localIdx: 3 },
          { line: 'line A3', index: 14, blockIdx: 1, localIdx: 4 },
          { line: 'line A4', index: 15, blockIdx: 1, localIdx: 5 },
          { line: 'line A5', index: 16, blockIdx: 1, localIdx: 6 }
        ]
      }
    ];
    
    const result = detectBlockMovesFast(allBlocks, mockDiffWords, mockDiffChars);
    
    // Should detect the larger overlapping block (5 lines) over smaller ones
    expect(result.blockMoves.length).toBeGreaterThan(0);
    
    // Should prefer the largest possible block
    const largestBlock = result.blockMoves.reduce((max, block) => 
      block.size > max.size ? block : max, result.blockMoves[0]);
    
    expect(largestBlock.size).toBe(5);
    expect(largestBlock.from).toBe(0);
    expect(largestBlock.to).toBe(12); // Adjusted index due to filler lines
  });

  it('should distinguish between moved blocks and modified blocks', () => {
    // One block is moved unchanged, another is moved with modifications
    const allBlocks = [
      {
        removed: [
          // Unchanged block (will be moved)
          { line: 'function unchanged() {', index: 0, blockIdx: 0, localIdx: 0 },
          { line: '    return 42;', index: 1, blockIdx: 0, localIdx: 1 },
          { line: '}', index: 2, blockIdx: 0, localIdx: 2 },
          // Modified block (will be moved with changes)
          { line: 'function modified() {', index: 3, blockIdx: 0, localIdx: 3 },
          { line: '    return old_value;', index: 4, blockIdx: 0, localIdx: 4 },
          { line: '}', index: 5, blockIdx: 0, localIdx: 5 },
          // Add filler to meet minimum
          { line: 'filler1', index: 6, blockIdx: 0, localIdx: 6 },
          { line: 'filler2', index: 7, blockIdx: 0, localIdx: 7 }
        ],
        added: []
      },
      {
        removed: [],
        added: [
          // Filler lines first
          { line: 'filler1', index: 15, blockIdx: 1, localIdx: 0 },
          { line: 'filler2', index: 16, blockIdx: 1, localIdx: 1 },
          // Unchanged block moved
          { line: 'function unchanged() {', index: 20, blockIdx: 1, localIdx: 2 },
          { line: '    return 42;', index: 21, blockIdx: 1, localIdx: 3 },
          { line: '}', index: 22, blockIdx: 1, localIdx: 4 },
          // Modified block moved with changes
          { line: 'function modified() {', index: 23, blockIdx: 1, localIdx: 5 },
          { line: '    return new_value;', index: 24, blockIdx: 1, localIdx: 6 },
          { line: '}', index: 25, blockIdx: 1, localIdx: 7 }
        ]
      }
    ];
    
    const result = detectBlockMovesFast(allBlocks, mockDiffWords, mockDiffChars);
    
    // Should detect the unchanged block as a move
    const unchangedMove = result.blockMoves.find(move => move.from === 0);
    expect(unchangedMove).toBeDefined();
    expect(unchangedMove.similarity).toBeGreaterThan(0.95);
    
    // Should detect both unchanged and modified blocks (modified ones may have lower similarity)
    expect(result.blockMoves.length).toBeGreaterThan(0);
    expect(result.crossBlockModifications.length).toBeGreaterThan(0);
    
    // Should also track cross-block modifications
    expect(result.crossBlockModifications.length).toBeGreaterThan(0);
  });

  it('should maintain performance under 10 seconds for 1000 lines', () => {
    const allBlocks = [
      {
        removed: Array(500).fill(null).map((_, i) => ({
          line: `content line ${i}`,
          index: i,
          blockIdx: 0,
          localIdx: i
        })),
        added: []
      },
      {
        removed: [],
        added: Array(500).fill(null).map((_, i) => ({
          line: `content line ${i}`,
          index: i + 1000,
          blockIdx: 1,
          localIdx: i
        }))
      }
    ];
    
    const startTime = performance.now();
    const result = detectBlockMovesFast(allBlocks, mockDiffWords, mockDiffChars);
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Should complete in under 10 seconds (adjusted for complexity)
    expect(duration).toBeLessThan(10000);
    
    // Should still detect the block move
    expect(result.blockMoves?.length).toBeGreaterThan(0);
  });
});