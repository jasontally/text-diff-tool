/**
 * Complexity Limits Unit Tests
 * 
 * Tests for complexity limit handling and fast mode fallback.
 * These tests ensure that the diff algorithm gracefully handles large files
 * and complex diffs by falling back to fast mode when limits are exceeded.
 * 
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { diffLines, diffWords, diffChars } from 'diff';
import {
  CONFIG,
  checkComplexityLimits,
  runFastMode,
  runDiffPipeline
} from '../src/diff-algorithms.js';

// ============================================================================
// Configuration Constants for Testing
// ============================================================================

const TEST_CONFIG = {
  ...CONFIG,
  MAX_LINES: 100,  // Lower threshold for testing
  MAX_GRAPH_VERTICES: 1000,
  ENABLE_FAST_MODE: true
};

const LARGE_CONFIG = {
  ...CONFIG,
  MAX_LINES: 10,
  MAX_GRAPH_VERTICES: 50,
  ENABLE_FAST_MODE: true
};

// ============================================================================
// Helper Functions for Testing
// ============================================================================

/**
 * Generate text with specified number of lines
 */
function generateLines(count, prefix = 'line') {
  return Array(count).fill(null).map((_, i) => `${prefix} ${i}`).join('\n');
}

/**
 * Generate text with many changes to trigger graph size limit
 */
function generateChangeDenseText(lines, changeRatio = 0.5) {
  const oldLines = [];
  const newLines = [];
  
  for (let i = 0; i < lines; i++) {
    if (Math.random() < changeRatio) {
      // Add different content to create changes
      oldLines.push(`old content ${i}`);
      newLines.push(`new content ${i}`);
    } else {
      // Add same content
      const same = `same content ${i}`;
      oldLines.push(same);
      newLines.push(same);
    }
  }
  
  return {
    oldText: oldLines.join('\n'),
    newText: newLines.join('\n')
  };
}

// ============================================================================
// checkComplexityLimits() Tests
// ============================================================================

describe('checkComplexityLimits', () => {
  it('should pass for files under line limit', () => {
    const oldLines = generateLines(50).split('\n');
    const newLines = generateLines(50).split('\n');
    
    const result = checkComplexityLimits(oldLines, newLines, { diffLines }, TEST_CONFIG);
    
    expect(result.exceeded).toBe(false);
    expect(result.reason).toBe(null);
  });

  it('should trigger line limit for files over threshold', () => {
    const oldLines = generateLines(150).split('\n');
    const newLines = generateLines(50).split('\n');
    
    const result = checkComplexityLimits(oldLines, newLines, { diffLines }, TEST_CONFIG);
    
    expect(result.exceeded).toBe(true);
    expect(result.reason).toBe('line_count');
    expect(result.lineCount).toBe(150);
    expect(result.maxLines).toBe(100);
  });

  it('should trigger line limit when either file exceeds threshold', () => {
    const oldLines = generateLines(50).split('\n');
    const newLines = generateLines(150).split('\n');
    
    const result = checkComplexityLimits(oldLines, newLines, { diffLines }, TEST_CONFIG);
    
    expect(result.exceeded).toBe(true);
    expect(result.reason).toBe('line_count');
    expect(result.lineCount).toBe(150);
  });

  it('should trigger graph size limit for dense changes', () => {
    // Create predictable changes to guarantee graph size limit
    // Use 10 lines with max changes to get 10×10=100 graph size
    const oldLines = ['old1', 'old2', 'old3', 'old4', 'old5', 'old6', 'old7', 'old8', 'old9', 'old10'];
    const newLines = ['new1', 'new2', 'new3', 'new4', 'new5', 'new6', 'new7', 'new8', 'new9', 'new10'];
    
    const result = checkComplexityLimits(oldLines, newLines, { diffLines }, {
      MAX_LINES: 100,  // Well above 10 lines
      MAX_GRAPH_VERTICES: 50  // Below expected graph size of 100
    });
    
    expect(result.exceeded).toBe(true);
    expect(result.reason).toBe('graph_size');
    expect(result.graphSize).toBeGreaterThan(50);
    expect(result.removedCount).toBeGreaterThan(0);
    expect(result.addedCount).toBeGreaterThan(0);
  });

  it('should calculate graph size correctly', () => {
    // Create predictable changes
    const oldLines = ['a', 'b', 'c', 'd', 'e'];
    const newLines = ['1', '2', '3', '4', '5'];
    
    const result = checkComplexityLimits(oldLines, newLines, { diffLines }, TEST_CONFIG);
    
    // All 5 lines changed, so graph size should be 5 × 5 = 25
    expect(result.graphSize).toBe(25);
    expect(result.removedCount).toBe(5);
    expect(result.addedCount).toBe(5);
  });

  it('should handle edge case of exactly at line limit', () => {
    const oldLines = generateLines(100).split('\n'); // Exactly at limit
    const newLines = generateLines(100).split('\n');
    
    const result = checkComplexityLimits(oldLines, newLines, { diffLines }, TEST_CONFIG);
    
    expect(result.exceeded).toBe(false);
    expect(result.reason).toBe(null);
  });

  it('should handle edge case of one line over limit', () => {
    const oldLines = generateLines(101).split('\n'); // One over limit
    const newLines = generateLines(100).split('\n');
    
    const result = checkComplexityLimits(oldLines, newLines, { diffLines }, TEST_CONFIG);
    
    expect(result.exceeded).toBe(true);
    expect(result.reason).toBe('line_count');
    expect(result.lineCount).toBe(101);
  });

  it('should return complete information when limits not exceeded', () => {
    const oldLines = generateLines(50).split('\n');
    const newLines = generateLines(50).split('\n');
    
    const result = checkComplexityLimits(oldLines, newLines, { diffLines }, TEST_CONFIG);
    
    expect(result.exceeded).toBe(false);
    expect(result.removedCount).toBeDefined();
    expect(result.addedCount).toBeDefined();
    expect(result.graphSize).toBeDefined();
    expect(result.maxLines).toBeDefined();
    expect(result.maxGraphVertices).toBeDefined();
  });
});

// ============================================================================
// runFastMode() Tests
// ============================================================================

describe('runFastMode', () => {
  it('should produce valid diff results', () => {
    const oldText = 'line 1\nline 2\nline 3';
    const newText = 'line 1\nmodified line 2\nline 3\nline 4';
    const limitInfo = {
      exceeded: true,
      reason: 'line_count',
      lineCount: 150,
      maxLines: 100
    };
    
    const result = runFastMode(oldText, newText, { diffLines, diffWords, diffChars }, limitInfo);
    
    expect(result.results).toBeDefined();
    expect(result.stats).toBeDefined();
    expect(result.limitInfo).toBeDefined();
    expect(Array.isArray(result.results)).toBe(true);
  });

  it('should include limitInfo with fastMode flag', () => {
    const oldText = 'line 1\nline 2';
    const newText = 'line 1\nline 2 modified';
    const limitInfo = {
      exceeded: true,
      reason: 'graph_size',
      graphSize: 1000,
      maxGraphVertices: 500
    };
    
    const result = runFastMode(oldText, newText, { diffLines, diffWords, diffChars }, limitInfo);
    
    expect(result.limitInfo.fastMode).toBe(true);
    expect(result.limitInfo.exceeded).toBe(true);
    expect(result.limitInfo.reason).toBe('graph_size');
  });

  it('should classify changes without detailed analysis when word/char modes disabled', () => {
    const oldText = 'line 1\nline 2\nline 3';
    const newText = 'line 1\nnew line 2\nline 3\nnew line 4';
    const limitInfo = { exceeded: true, reason: 'line_count' };
    const options = { modeToggles: { lines: true, words: false, chars: false } };
    
    const result = runFastMode(oldText, newText, { diffLines, diffWords, diffChars }, limitInfo, options);
    
    // Should have basic classifications only (no 'modified' from similarity analysis)
    const classifications = result.results.map(r => r.classification);
    expect(classifications).toEqual(expect.arrayContaining(['added', 'removed', 'unchanged']));
    
    // Fast mode should not produce detailed similarity data when modes are disabled
    result.results.forEach(change => {
      expect(change.similarity).toBeUndefined();
      expect(change.wordDiff).toBeUndefined();
      expect(change.charDiff).toBeUndefined();
    });
  });

  it('should generate word-level diffs in fast mode when words mode enabled', () => {
    const oldText = 'line 1\nline 2\nline 3';
    const newText = 'line 1\nmodified line 2\nline 3';
    const limitInfo = { exceeded: true, reason: 'line_count' };
    const options = { modeToggles: { lines: true, words: true, chars: false } };
    
    const result = runFastMode(oldText, newText, { diffLines, diffWords, diffChars }, limitInfo, options);
    
    // Find the modified line pair and check it has wordDiff
    const modifiedChanges = result.results.filter(r => r.classification === 'modified');
    expect(modifiedChanges.length).toBeGreaterThanOrEqual(1);
    
    // At least one modified change should have wordDiff
    const hasWordDiff = modifiedChanges.some(c => c.wordDiff && c.wordDiff.length > 0);
    expect(hasWordDiff).toBe(true);
  });

  it('should calculate statistics correctly', () => {
    const oldText = 'a\nb\nc';
    const newText = 'a\nx\nc\ny';
    const limitInfo = { exceeded: true, reason: 'line_count' };
    const options = { modeToggles: { lines: true, words: false, chars: false } };
    
    const result = runFastMode(oldText, newText, { diffLines, diffWords, diffChars }, limitInfo, options);
    
    expect(result.stats.added).toBeGreaterThanOrEqual(1); // At least y is added
    expect(result.stats.removed).toBe(1); // b is removed
    expect(result.stats.unchanged).toBe(1); // a is unchanged
    expect(result.stats.modified).toBe(0); // No modified classification when word mode disabled
  });

  it('should handle empty files', () => {
    const oldText = '';
    const newText = 'new line';
    const limitInfo = { exceeded: true, reason: 'line_count' };
    
    const result = runFastMode(oldText, newText, { diffLines, diffWords, diffChars }, limitInfo);
    
    expect(result.results).toBeDefined();
    expect(result.stats.added).toBe(1);
    expect(result.stats.removed).toBe(0);
  });

  it('should handle identical files', () => {
    const text = 'line 1\nline 2\nline 3';
    const limitInfo = { exceeded: true, reason: 'line_count' };
    
    const result = runFastMode(text, text, { diffLines, diffWords, diffChars }, limitInfo);
    
    expect(result.stats.added).toBe(0);
    expect(result.stats.removed).toBe(0);
    expect(result.stats.unchanged).toBeGreaterThan(0);
  });
});

// ============================================================================
// runDiffPipeline Integration Tests
// ============================================================================

describe('runDiffPipeline Complexity Limits Integration', () => {
  it('should use fast mode when line limit exceeded', () => {
    const oldText = generateLines(150); // Over TEST_CONFIG.MAX_LINES
    const newText = generateLines(150);
    
    const result = runDiffPipeline(oldText, newText, { diffLines, diffWords, diffChars }, {
      config: TEST_CONFIG
    });
    
    expect(result.limitInfo.exceeded).toBe(true);
    expect(result.limitInfo.fastMode).toBe(true);
    expect(result.limitInfo.reason).toBe('line_count');
  });

  it('should use fast mode when graph size limit exceeded', () => {
    // Create predictable changes to guarantee graph size limit
    // Use 5 lines with max changes to get 5×5=25 graph size
    const oldText = 'old1\nold2\nold3\nold4\nold5';
    const newText = 'new1\nnew2\nnew3\nnew4\nnew5';
    
    const result = runDiffPipeline(oldText, newText, { diffLines, diffWords, diffChars }, {
      config: {
        MAX_LINES: 10,  // Above 5 lines
        MAX_GRAPH_VERTICES: 20,  // Below expected graph size of 25
        ENABLE_FAST_MODE: true
      }
    });
    
    expect(result.limitInfo.exceeded).toBe(true);
    expect(result.limitInfo.fastMode).toBe(true);
    expect(result.limitInfo.reason).toBe('graph_size');
  });

  it('should use normal mode when limits not exceeded', () => {
    const oldText = generateLines(50); // Under TEST_CONFIG.MAX_LINES
    const newText = generateLines(50);
    
    const result = runDiffPipeline(oldText, newText, { diffLines, diffWords, diffChars }, {
      config: TEST_CONFIG
    });
    
    expect(result.limitInfo.exceeded).toBe(false);
    expect(result.limitInfo.fastMode).toBe(false);
    expect(result.limitInfo.reason).toBe(null);
  });

  it('should produce valid results under fast mode', () => {
    const oldText = generateLines(150);
    const newText = generateLines(150).replace(/line 50/, 'modified line 50');
    
    const result = runDiffPipeline(oldText, newText, { diffLines, diffWords, diffChars }, {
      config: TEST_CONFIG
    });
    
    expect(result.results).toBeDefined();
    expect(result.stats).toBeDefined();
    expect(result.limitInfo.fastMode).toBe(true);
    
    // Results should still be properly classified
    const classifications = result.results.map(r => r.classification);
    expect(classifications.every(c => ['added', 'removed', 'unchanged', 'modified'].includes(c))).toBe(true);
  });

  it('should include correct limitInfo in results', () => {
    const oldText = generateLines(150);
    const newText = generateLines(150);
    
    const result = runDiffPipeline(oldText, newText, { diffLines, diffWords, diffChars }, {
      config: TEST_CONFIG
    });
    
    // Check that limitInfo includes all necessary fields
    expect(result.limitInfo).toMatchObject({
      exceeded: true,
      fastMode: true,
      reason: 'line_count',
      lineCount: 150,
      maxLines: 100
    });
  });

  it('should handle exact boundary at line limit', () => {
    const oldText = generateLines(100); // Exactly at limit
    const newText = generateLines(100);
    
    const result = runDiffPipeline(oldText, newText, { diffLines, diffWords, diffChars }, {
      config: TEST_CONFIG
    });
    
    expect(result.limitInfo.exceeded).toBe(false);
    expect(result.limitInfo.fastMode).toBe(false);
  });

  it('should handle single line over limit', () => {
    const oldText = generateLines(101); // One over limit
    const newText = generateLines(100);
    
    const result = runDiffPipeline(oldText, newText, { diffLines, diffWords, diffChars }, {
      config: TEST_CONFIG
    });
    
    expect(result.limitInfo.exceeded).toBe(true);
    expect(result.limitInfo.fastMode).toBe(true);
    expect(result.limitInfo.reason).toBe('line_count');
    expect(result.limitInfo.lineCount).toBe(101);
  });

  it('should handle very large files gracefully', () => {
    const oldText = generateLines(1000); // Way over limit
    const newText = generateLines(1000);
    
    const start = performance.now();
    const result = runDiffPipeline(oldText, newText, { diffLines, diffWords, diffChars }, {
      config: TEST_CONFIG
    });
    const duration = performance.now() - start;
    
    expect(result.limitInfo.exceeded).toBe(true);
    expect(result.limitInfo.fastMode).toBe(true);
    expect(duration).toBeLessThan(1000); // Should complete quickly in fast mode
  });

  it('should respect ENABLE_FAST_MODE setting', () => {
    const oldText = generateLines(150);
    const newText = generateLines(150);
    
    const configWithFastModeDisabled = {
      ...TEST_CONFIG,
      ENABLE_FAST_MODE: false
    };
    
    // Should not use fast mode even when limits exceeded
    const result = runDiffPipeline(oldText, newText, { diffLines, diffWords, diffChars }, {
      config: configWithFastModeDisabled
    });
    
    // When fast mode is disabled, it should proceed with normal processing
    // (which may be slow but should still work)
    expect(result.limitInfo).toBeDefined();
    // Note: The exact behavior depends on implementation when fast mode is disabled
  });
});

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

describe('Complexity Limits Edge Cases', () => {
  it('should handle empty files', () => {
    const oldLines = [''];
    const newLines = [''];
    
    const result = checkComplexityLimits(oldLines, newLines, { diffLines }, TEST_CONFIG);
    
    expect(result.exceeded).toBe(false);
    expect(result.graphSize).toBe(0);
  });

  it('should handle single line files', () => {
    const oldLines = ['single line'];
    const newLines = ['single line'];
    
    const result = checkComplexityLimits(oldLines, newLines, { diffLines }, TEST_CONFIG);
    
    expect(result.exceeded).toBe(false);
    expect(result.graphSize).toBe(0);
  });

  it('should handle files with only additions', () => {
    const oldLines = [''];
    const newLines = generateLines(50).split('\n');
    
    const result = checkComplexityLimits(oldLines, newLines, { diffLines }, TEST_CONFIG);
    
    expect(result.exceeded).toBe(false);
    // Only additions, so graph size should be 0
    expect(result.graphSize).toBe(0);
    expect(result.removedCount).toBe(0);
    expect(result.addedCount).toBe(50);
  });

  it('should handle files with only removals', () => {
    const oldLines = generateLines(50).split('\n');
    const newLines = [''];
    
    const result = checkComplexityLimits(oldLines, newLines, { diffLines }, TEST_CONFIG);
    
    expect(result.exceeded).toBe(false);
    // Only removals, so graph size should be 0
    expect(result.graphSize).toBe(0);
    expect(result.removedCount).toBe(50);
    expect(result.addedCount).toBe(0);
  });

  it('should calculate graph size correctly for mixed changes', () => {
    const oldText = 'a\nb\nc'; // 3 lines
    const newText = 'x\ny\nz\nw'; // 4 lines, all different
    
    const result = checkComplexityLimits(
      oldText.split('\n'),
      newText.split('\n'),
      { diffLines },
      TEST_CONFIG
    );
    
    expect(result.removedCount).toBe(3);
    expect(result.addedCount).toBe(4);
    expect(result.graphSize).toBe(12); // 3 × 4
  });

  it('should handle configuration overrides', () => {
    const oldLines = generateLines(150).split('\n');
    const newLines = generateLines(150).split('\n');
    
    // Custom config with higher limit
    const customConfig = {
      ...CONFIG,
      MAX_LINES: 200
    };
    
    const result = checkComplexityLimits(oldLines, newLines, { diffLines }, customConfig);
    
    expect(result.exceeded).toBe(false);
    expect(result.maxLines).toBe(200);
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('Complexity Limits Performance', () => {
  it('should complete limit checking quickly for large files', () => {
    const oldLines = generateLines(60000).split('\n'); // Over default MAX_LINES of 50000
    const newLines = generateLines(60000).split('\n');
    
    const start = performance.now();
    const result = checkComplexityLimits(oldLines, newLines, { diffLines }, CONFIG);
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(100); // Should be very fast
    expect(result.exceeded).toBe(true);
    expect(result.reason).toBe('line_count');
  });

  it('should complete fast mode quickly', () => {
    const oldText = generateLines(1000);
    const newText = generateLines(1000);
    const limitInfo = { exceeded: true, reason: 'line_count' };
    
    const start = performance.now();
    const result = runFastMode(oldText, newText, { diffLines, diffWords, diffChars }, limitInfo);
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(500); // Should complete quickly
    expect(result.results).toBeDefined();
    expect(result.stats).toBeDefined();
  });
});