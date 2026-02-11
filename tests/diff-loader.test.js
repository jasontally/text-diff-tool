/**
 * Diff Loader Tests
 * 
 * Tests for the cross-environment import helper.
 * 
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import { loadDiffLibrary, isNode, isBrowser, isWorker, CDN_URLS } from '../src/diff-loader.js';

describe('Diff Loader', () => {
  describe('Environment Detection', () => {
    it('should detect Node.js environment', () => {
      expect(isNode()).toBe(true);
      expect(isBrowser()).toBe(false);
      expect(isWorker()).toBe(false);
    });
  });

  describe('CDN URLs', () => {
    it('should have valid CDN URLs', () => {
      expect(CDN_URLS.primary).toContain('esm.sh');
      expect(CDN_URLS.fallback).toContain('jsdelivr');
      expect(CDN_URLS.primary).toContain('diff@5.1.0');
    });

    it('should have HTTPS URLs', () => {
      expect(CDN_URLS.primary).toMatch(/^https:\/\//);
      expect(CDN_URLS.fallback).toMatch(/^https:\/\//);
    });
  });

  describe('Library Loading', () => {
    it('should load diff library in Node.js', async () => {
      const diff = await loadDiffLibrary();
      
      expect(diff).toBeDefined();
      expect(diff.diffLines).toBeDefined();
      expect(diff.diffWords).toBeDefined();
      expect(diff.diffChars).toBeDefined();
      expect(typeof diff.diffLines).toBe('function');
      expect(typeof diff.diffWords).toBe('function');
      expect(typeof diff.diffChars).toBe('function');
    });

    it('should have working diffLines function', async () => {
      const diff = await loadDiffLibrary();
      const result = diff.diffLines('line1\nline2', 'line1\nline2\nline3');
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should have working diffWords function', async () => {
      const diff = await loadDiffLibrary();
      const result = diff.diffWords('hello world', 'hello there');
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
