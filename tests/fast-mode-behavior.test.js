/**
 * Fast Mode Behavior Tests
 * 
 * These tests verify that:
 * 1. Small files (< 50,000 lines, < 100,000 graph vertices) do NOT use fast mode
 * 2. Fast mode only triggers when limits are exceeded
 * 3. Fast mode respects the ENABLE_FAST_MODE setting
 * 
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import { diffLines, diffWords, diffChars } from 'diff';
import { runDiffPipeline, runFastMode, CONFIG } from '../src/diff-algorithms.js';

// Test configuration that ensures fast mode is enabled but with small limits for testing
const TEST_CONFIG_ENABLED = {
  ...CONFIG,
  MAX_LINES: 100,  // Small limit for testing
  MAX_GRAPH_VERTICES: 1000,
  ENABLE_FAST_MODE: true
};

const TEST_CONFIG_DISABLED = {
  ...CONFIG,
  MAX_LINES: 100,
  MAX_GRAPH_VERTICES: 1000,
  ENABLE_FAST_MODE: false
};

describe('Fast Mode Behavior - Small Files', () => {
  describe('Files under complexity limits', () => {
    it('should NOT use fast mode for files under 100 lines with default config', () => {
      const oldText = 'line 1\nline 2\nline 3\nline 4\nline 5';
      const newText = 'line 1\nmodified line 2\nline 3\nline 4\nline 5';
      
      const result = runDiffPipeline(oldText, newText, { diffLines, diffWords, diffChars });
      
      expect(result.limitInfo.exceeded).toBe(false);
      expect(result.limitInfo.fastMode).toBe(false);
      expect(result.limitInfo.reason).toBeNull();
    });

    it('should NOT use fast mode for 99 lines (under the limit)', () => {
      const oldText = Array(99).fill(null).map((_, i) => `content line ${i}`).join('\n');
      const newText = Array(99).fill(null).map((_, i) => `content line ${i}`).join('\n');
      
      const result = runDiffPipeline(oldText, newText, { diffLines, diffWords, diffChars }, {
        config: TEST_CONFIG_ENABLED
      });
      
      expect(result.limitInfo.exceeded).toBe(false);
      expect(result.limitInfo.fastMode).toBe(false);
      expect(result.limitInfo.reason).toBeNull();
    });

    it('should produce detailed word diffs for small files', () => {
      const oldText = 'const x = 1;\nconst y = 2;';
      const newText = 'const x = 5;\nconst y = 2;';
      
      const result = runDiffPipeline(oldText, newText, { diffLines, diffWords, diffChars }, {
        config: TEST_CONFIG_ENABLED,
        modeToggles: { lines: true, words: true, chars: true }
      });
      
      // Should NOT be in fast mode
      expect(result.limitInfo.fastMode).toBe(false);
      
      // Should have word-level diffs on modified lines
      const modifiedChanges = result.results.filter(r => r.classification === 'modified');
      expect(modifiedChanges.length).toBeGreaterThanOrEqual(1);
      
      // At least one modified change should have wordDiff
      const hasWordDiff = modifiedChanges.some(c => c.wordDiff && c.wordDiff.length > 0);
      expect(hasWordDiff).toBe(true);
    });
  });

  describe('Fast mode trigger conditions', () => {
    it('should use fast mode when exceeding MAX_LINES limit', () => {
      const oldText = Array(101).fill(null).map((_, i) => `line ${i}`).join('\n');
      const newText = Array(101).fill(null).map((_, i) => `modified line ${i}`).join('\n');
      
      const result = runDiffPipeline(oldText, newText, { diffLines, diffWords, diffChars }, {
        config: TEST_CONFIG_ENABLED
      });
      
      expect(result.limitInfo.exceeded).toBe(true);
      expect(result.limitInfo.fastMode).toBe(true);
      expect(result.limitInfo.reason).toBe('line_count');
    });

    it('should use fast mode when exceeding MAX_GRAPH_VERTICES limit', () => {
      // Create 32 lines that all change to get 32×32=1024 graph vertices
      const oldLines = Array(32).fill(null).map((_, i) => `old content ${i}`);
      const newLines = Array(32).fill(null).map((_, i) => `new content ${i}`);
      
      const result = runDiffPipeline(oldLines.join('\n'), newLines.join('\n'), 
        { diffLines, diffWords, diffChars }, {
          config: {
            ...TEST_CONFIG_ENABLED,
            MAX_GRAPH_VERTICES: 100  // Low limit to trigger
          }
        });
      
      expect(result.limitInfo.exceeded).toBe(true);
      expect(result.limitInfo.fastMode).toBe(true);
      expect(result.limitInfo.reason).toBe('graph_size');
    });
  });

  describe('ENABLE_FAST_MODE setting', () => {
    it('should respect ENABLE_FAST_MODE=false even when limits exceeded', () => {
      const oldText = Array(200).fill(null).map((_, i) => `line ${i}`).join('\n');
      const newText = Array(200).fill(null).map((_, i) => `modified ${i}`).join('\n');
      
      const result = runDiffPipeline(oldText, newText, { diffLines, diffWords, diffChars }, {
        config: TEST_CONFIG_DISABLED
      });
      
      // Limits exceeded but fast mode disabled
      expect(result.limitInfo.exceeded).toBe(true);
      expect(result.limitInfo.fastMode).toBe(false);
    });

    it('should use fast mode when ENABLE_FAST_MODE=true and limits exceeded', () => {
      const oldText = Array(200).fill(null).map((_, i) => `line ${i}`).join('\n');
      const newText = Array(200).fill(null).map((_, i) => `modified ${i}`).join('\n');
      
      const result = runDiffPipeline(oldText, newText, { diffLines, diffWords, diffChars }, {
        config: TEST_CONFIG_ENABLED
      });
      
      expect(result.limitInfo.exceeded).toBe(true);
      expect(result.limitInfo.fastMode).toBe(true);
    });
  });

  describe('Fast mode word diff generation', () => {
    it('should generate word diffs in fast mode when words mode enabled', () => {
      const oldText = 'line 1\nline 2\nline 3';
      const newText = 'line 1\nmodified line 2\nline 3';
      const limitInfo = { exceeded: true, reason: 'line_count' };
      const options = { modeToggles: { lines: true, words: true, chars: false } };
      
      const result = runFastMode(oldText, newText, { diffLines, diffWords, diffChars }, limitInfo, options);
      
      // Should be in fast mode
      expect(result.limitInfo.fastMode).toBe(true);
      
      // Should have word diffs on modified lines
      const modifiedChanges = result.results.filter(r => r.classification === 'modified');
      expect(modifiedChanges.length).toBeGreaterThanOrEqual(2); // removed + added pair
      
      const hasWordDiff = modifiedChanges.some(c => c.wordDiff && c.wordDiff.length > 0);
      expect(hasWordDiff).toBe(true);
    });

    it('should NOT generate word diffs in fast mode when words mode disabled', () => {
      const oldText = 'line 1\nline 2\nline 3';
      const newText = 'line 1\nmodified line 2\nline 3';
      const limitInfo = { exceeded: true, reason: 'line_count' };
      const options = { modeToggles: { lines: true, words: false, chars: false } };
      
      const result = runFastMode(oldText, newText, { diffLines, diffWords, diffChars }, limitInfo, options);
      
      expect(result.limitInfo.fastMode).toBe(true);
      
      // Should NOT have word diffs
      result.results.forEach(change => {
        expect(change.wordDiff).toBeUndefined();
      });
    });
  });
});

describe('Production Config Limits', () => {
  it('should have MAX_LINES set to 50000 in production config', () => {
    expect(CONFIG.MAX_LINES).toBe(50000);
  });

  it('should have MAX_GRAPH_VERTICES set to 100000 in production config', () => {
    expect(CONFIG.MAX_GRAPH_VERTICES).toBe(100000);
  });

  it('should have ENABLE_FAST_MODE set to true in production config', () => {
    expect(CONFIG.ENABLE_FAST_MODE).toBe(true);
  });
});
