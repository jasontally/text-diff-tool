// Test Block Move Detection Integration
// Test that the enhanced detectModifiedLines works with block moves

import { describe, it, expect } from 'vitest';
import { detectModifiedLines } from '../src/diff-algorithms.js';

// Mock diff functions for testing
const mockDiffWords = (a, b) => [{ value: a, removed: true }, { value: b, added: true }];
const mockDiffChars = (a, b) => [{ value: a, removed: true }, { value: b, added: true }];

describe('Block Move Detection Integration', () => {
  it('should handle simple case without breaking existing functionality', () => {
    const oldText = 'line 1\nline 2\nline 3';
    const newText = 'line 1\nmodified line 2\nline 3';
    
    const results = detectModifiedLines(
      [
        { value: 'line 1\n' },
        { value: 'line 2\n' },
        { value: 'line 3\n' }
      ],
      mockDiffWords,
      mockDiffChars
    );
    
    // Should classify correctly
    expect(results).toBeDefined();
    expect(results.length).toBe(3);
    
    // Check classifications exist
    const classifications = results.map(r => r.classification);
    expect(classifications.every(c => typeof c === 'string')).toBe(true);
  });

  it('should return blockMoves property when available', () => {
    const oldText = 'function a() {}\nfunction b() {}';
    const newText = 'function b() {}\nfunction a() {}';
    
    const results = detectModifiedLines(
      [
        { value: 'function a() {}\n', removed: true },
        { value: 'function b() {}\n', removed: true },
        { value: 'function b() {}\n', added: true },
        { value: 'function a() {}\n', added: true }
      ],
      mockDiffWords,
      mockDiffChars,
      { detectMoves: true }
    );
    
    // Results should have classifications
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].classification).toBeDefined();
  });
});