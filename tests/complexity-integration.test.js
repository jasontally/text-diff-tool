/**
 * Integration test for Task 2.3: Complex Limits in full pipeline
 * 
 * This test verifies that runDiffPipeline correctly:
 * - Checks limits before processing
 * - Falls back to fast mode when limits exceeded
 * - Returns limit status in results
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runDiffPipeline, CONFIG } from '../src/diff-algorithms.js';

describe('Complex Limits Integration', () => {
  let mockDiffLib;
  
  beforeEach(() => {
    mockDiffLib = {
      diffLines: vi.fn(),
      diffWords: vi.fn(),
      diffChars: vi.fn()
    };
  });
  
  describe('runDiffPipeline with limits', () => {
    it('should use fast mode when line limit exceeded', async () => {
      const oldText = Array(60000).fill('line1\n').join('');
      const newText = Array(50000).fill('line2\n').join('');
      
      // Mock diffLines to return simple diff
      mockDiffLib.diffLines.mockReturnValue([
        { value: oldText, removed: true },
        { value: newText, added: true }
      ]);
      
      const result = await runDiffPipeline(oldText, newText, mockDiffLib);
      
      expect(result.limitInfo).toBeDefined();
      expect(result.limitInfo.fastMode).toBe(true);
      expect(result.limitInfo.exceeded).toBe(true);
      expect(result.limitInfo.reason).toBe('line_count');
    });
    
    it('should use fast mode when graph size limit exceeded', async () => {
      const oldText = Array(5000).fill('old\n').join('');
      const newText = Array(5000).fill('new\n').join('');
      
      // Mock diffLines to simulate large graph
      mockDiffLib.diffLines.mockReturnValue([
        { value: oldText, removed: true },
        { value: newText, added: true }
      ]);
      
      // Mock diffWords/diffChars for completeness
      mockDiffLib.diffWords.mockReturnValue([
        { value: 'old', added: false, removed: false },
        { value: 'new', added: false, removed: false }
      ]);
      mockDiffLib.diffChars.mockReturnValue([
        { value: 'old', added: false, removed: false },
        { value: 'new', added: false, removed: false }
      ]);
      
      const result = await runDiffPipeline(oldText, newText, mockDiffLib, {
        config: {
          MAX_LINES: 100000,
          MAX_GRAPH_VERTICES: 100, // Very low to trigger limit
          ENABLE_FAST_MODE: true
        }
      });
      
      expect(result.limitInfo).toBeDefined();
      expect(result.limitInfo.fastMode).toBe(true);
      expect(result.limitInfo.exceeded).toBe(true);
    });
    
    it('should use full mode when limits not exceeded', async () => {
      const oldText = 'line1\nline2\nline3';
      const newText = 'line1\nmodified\nline3';
      
      // Mock diffLines to return reasonable diff
      mockDiffLib.diffLines.mockReturnValue([
        { value: 'line1\n', added: false, removed: false },
        { value: 'line2\n', removed: true },
        { value: 'modified\n', added: true },
        { value: 'line3\n', added: false, removed: false }
      ]);
      
      // Mock diffWords for modified line detection (simple case - no modifications)
      mockDiffLib.diffWords.mockReturnValue([
        { value: 'line2', added: false, removed: false }
      ]);
      
      // Mock diffChars
      mockDiffLib.diffChars.mockReturnValue([
        { value: 'line2', added: false, removed: false }
      ]);
      
      const result = await runDiffPipeline(oldText, newText, mockDiffLib);
      
      expect(result.limitInfo).toBeDefined();
      expect(result.limitInfo.fastMode).toBe(false);
      expect(result.limitInfo.exceeded).toBe(false);
      expect(result.limitInfo.reason).toBeNull();
    });
    
    it('should use custom config when provided', async () => {
      const oldText = 'a\n';
      const newText = 'b\n';
      
      const customConfig = {
        MAX_LINES: 1, // Very low limit
        MAX_GRAPH_VERTICES: 100000,
        ENABLE_FAST_MODE: true
      };
      
      mockDiffLib.diffLines.mockReturnValue([
        { value: 'a\n', removed: true },
        { value: 'b\n', added: true }
      ]);
      
      // Mock diffWords/diffChars
      mockDiffLib.diffWords.mockReturnValue([
        { value: 'a', added: false, removed: false },
        { value: 'b', added: false, removed: false }
      ]);
      mockDiffLib.diffChars.mockReturnValue([
        { value: 'a', added: false, removed: false },
        { value: 'b', added: false, removed: false }
      ]);
      
      const result = await runDiffPipeline(oldText, newText, mockDiffLib, {
        config: customConfig
      });
      
      expect(result.limitInfo.exceeded).toBe(true);
      expect(result.limitInfo.reason).toBe('line_count');
      expect(result.limitInfo.maxLines).toBe(1);
    });
    
    it('should not use fast mode when ENABLE_FAST_MODE is false', async () => {
      const oldText = Array(100000).fill('old\n').join('');
      const newText = Array(100000).fill('new\n').join('');
      
      mockDiffLib.diffLines.mockReturnValue([
        { value: oldText, removed: true },
        { value: newText, added: true }
      ]);
      
      // Mock diffWords/diffChars
      mockDiffLib.diffWords.mockReturnValue([
        { value: 'old', added: false, removed: false },
        { value: 'new', added: false, removed: false }
      ]);
      mockDiffLib.diffChars.mockReturnValue([
        { value: 'old', added: false, removed: false },
        { value: 'new', added: false, removed: false }
      ]);
      
      const result = await runDiffPipeline(oldText, newText, mockDiffLib, {
        config: {
          ENABLE_FAST_MODE: false
        }
      });
      
      expect(result.limitInfo.fastMode).toBe(false);
      expect(result.limitInfo.exceeded).toBe(true);
    });
  });
});