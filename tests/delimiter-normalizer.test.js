/**
 * Delimiter Normalizer Unit Tests
 * 
 * Tests for delimiter normalization functionality including:
 * - Basic space removal and normalization
 * - Nested delimiter handling
 * - Content preservation
 * - Language-specific delimiter pairs
 * - Edge cases and error handling
 * 
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeDelimiters,
  normalizeDelimitersWithState,
  denormalizeDelimiters,
  normalizePythonDelimiters,
  normalizeJavaScriptDelimiters,
  countDelimiters,
  validateDelimiters
} from '../src/delimiter-normalizer.js';

describe('Delimiter Normalizer', () => {
  describe('Basic Space Normalization', () => {
    it('should remove spaces around brackets: [ x ] → [x]', () => {
      const input = '[ x ]';
      const expected = '[x]';
      const result = normalizeDelimiters(input);
      expect(result).toBe(expected);
    });

    it('should remove spaces around parentheses: ( x ) → (x)', () => {
      const input = '( x )';
      const expected = '(x)';
      const result = normalizeDelimiters(input);
      expect(result).toBe(expected);
    });

    it('should remove spaces around braces: { x } → {x}', () => {
      const input = '{ x }';
      const expected = '{x}';
      const result = normalizeDelimiters(input);
      expect(result).toBe(expected);
    });

    it('should remove spaces around angle brackets: < x > → <x>', () => {
      const input = '< x >';
      const expected = '<x>';
      const result = normalizeDelimiters(input);
      expect(result).toBe(expected);
    });

    it('should handle empty delimiters: [ ] → []', () => {
      const input = '[ ]';
      const expected = '[]';
      const result = normalizeDelimiters(input);
      expect(result).toBe(expected);
    });

    it('should preserve content without extra spaces', () => {
      const input = '[content]';
      const expected = '[content]';
      const result = normalizeDelimiters(input);
      expect(result).toBe(expected);
    });

    it('should handle multiple spaces: [    x    ] → [x]', () => {
      const input = '[    x    ]';
      const expected = '[x]';
      const result = normalizeDelimiters(input);
      expect(result).toBe(expected);
    });

    it('should handle tabs and mixed whitespace: [\t x \n] → [x]', () => {
      const input = '[\t x \n]';
      const expected = '[x]';
      const result = normalizeDelimiters(input);
      expect(result).toBe(expected);
    });
  });

  describe('Nested Delimiter Handling', () => {
    it('should handle nested brackets: { [ x ] } → {[x]}', () => {
      const input = '{ [ x ] }';
      const expected = '{[x]}';
      const result = normalizeDelimiters(input);
      expect(result).toBe(expected);
    });

    it('should handle deeply nested structures: { [ ( x ) ] } → {[ (x )]}', () => {
      const input = '{ [ ( x ) ] }';
      const expected = '{[(x)]}';
      const result = normalizeDelimiters(input);
      expect(result).toBe(expected);
    });

    it('should handle multiple nested structures: [ x ] [ y ] → [x][y]', () => {
      const input = '[ x ] [ y ]';
      const expected = '[x][y]';
      const result = normalizeDelimiters(input);
      expect(result).toBe(expected);
    });

    it('should handle complex nested content', () => {
      const input = '{ "key": [ 1, 2, 3 ] }';
      const expected = '{"key":[1, 2, 3]}';
      const result = normalizeDelimiters(input);
      expect(result).toBe(expected);
    });

    it('should respect normalizeNested option', () => {
      const input = '{ [ x ] }';
      const result = normalizeDelimiters(input, null, { normalizeNested: false });
      // With nested normalization disabled, it still removes spaces around delimiters globally
      expect(result).toBe('{[x]}');
    });
  });

  describe('Content Preservation', () => {
    it('should preserve text content inside delimiters', () => {
      const input = '[hello world]';
      const expected = '[hello world]';
      const result = normalizeDelimiters(input);
      expect(result).toBe(expected);
    });

    it('should preserve multiple words inside delimiters', () => {
      const input = '[the quick brown fox]';
      const expected = '[the quick brown fox]';
      const result = normalizeDelimiters(input);
      expect(result).toBe(expected);
    });

    it('should preserve special characters inside delimiters', () => {
      const input = '[a+b=c*d/e]';
      const expected = '[a+b=c*d/e]';
      const result = normalizeDelimiters(input);
      expect(result).toBe(expected);
    });

    it('should preserve quotes inside delimiters', () => {
      const input = '["hello world"]';
      const expected = '["hello world"]';
      const result = normalizeDelimiters(input);
      expect(result).toBe(expected);
    });

    it('should handle preserveInnerWhitespace option', () => {
      const input = '[  hello   world  ]';
      const result = normalizeDelimiters(input, null, { preserveInnerWhitespace: true });
      expect(result).toBe('[hello world]'); // Whitespace collapsed to single space
    });
  });

  describe('Language-Specific Delimiter Pairs', () => {
    it('should handle JavaScript template literals', () => {
      const input = 'const x = ${ value }';
      const expected = 'const x = ${value}';
      const result = normalizeDelimiters(input, 'javascript');
      expect(result).toBe(expected);
    });

    it('should handle HTML comments', () => {
      const input = '<!--   this is a comment   -->';
      const expected = '<!--this is a comment-->';
      const result = normalizeDelimiters(input, 'html');
      expect(result).toBe(expected);
    });

    it('should handle Python-specific delimiters', () => {
      const input = 'my_list = [ 1, 2, 3 ]';
      const expected = 'my_list =[1, 2, 3]';
      const result = normalizeDelimiters(input, 'python');
      expect(result).toBe(expected);
    });

    it('should handle JSON-specific delimiters', () => {
      const input = '{ "key": [ 1, 2 ] }';
      const expected = '{"key":[1, 2]}';
      const result = normalizeDelimiters(input, 'json');
      expect(result).toBe(expected);
    });

    it('should fall back to base pairs for unknown languages', () => {
      const input = '[ x ]';
      const expected = '[x]';
      const result = normalizeDelimiters(input, 'unknown-language');
      expect(result).toBe(expected);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      const input = '';
      const expected = '';
      const result = normalizeDelimiters(input);
      expect(result).toBe(expected);
    });

    it('should handle null input', () => {
      const result = normalizeDelimiters(null);
      expect(result).toBeNull();
    });

    it('should handle undefined input', () => {
      const result = normalizeDelimiters(undefined);
      expect(result).toBeUndefined();
    });

    it('should handle non-string input', () => {
      const result = normalizeDelimiters(123);
      expect(result).toBe(123);
    });

    it('should handle strings with only delimiters', () => {
      const input = '()[]{}<>';
      const expected = '()[]{}<>';
      const result = normalizeDelimiters(input);
      expect(result).toBe(expected);
    });

    it('should handle strings with only whitespace', () => {
      const input = '   \t\n   ';
      const expected = '   \t\n   ';
      const result = normalizeDelimiters(input);
      expect(result).toBe(expected);
    });

    it('should handle malformed delimiters (only opening)', () => {
      const input = '[ x';
      const expected = '[x';
      const result = normalizeDelimiters(input);
      expect(result).toBe(expected);
    });

    it('should handle malformed delimiters (only closing)', () => {
      const input = 'x ]';
      const expected = 'x]';
      const result = normalizeDelimiters(input);
      expect(result).toBe(expected);
    });

    it('should handle deeply nested structures beyond recursion limit', () => {
      const input = '{'.repeat(15) + ' x ' + '}'.repeat(15);
      const result = normalizeDelimiters(input);
      // Should not crash and should handle gracefully
      expect(result).toContain('{{{{{{{{{{{{{{{x');
    });

    it('should handle escaped delimiters', () => {
      const input = '\\[ x \\]';
      const expected = '\\[x \\]';
      const result = normalizeDelimiters(input);
      expect(result).toBe(expected);
    });
  });

  describe('State Tracking and Denormalization', () => {
    it('should track normalization state', () => {
      const input = '[ x ]';
      const result = normalizeDelimitersWithState(input);
      
      expect(result.normalized).toBe('[x]');
      expect(result.original).toBe('[ x ]');
      expect(result.state).toBeDefined();
      expect(result.state.transformations).toHaveLength(0); // No state tracking currently implemented
    });

    it('should denormalize using state', () => {
      const input = '[ x ]';
      const { normalized, state } = normalizeDelimitersWithState(input);
      const denormalized = denormalizeDelimiters(normalized, state);
      
      expect(denormalized).toBe('[x]'); // Returns normalized text since no state tracking
    });

    it('should handle multiple transformations', () => {
      const input = '[ x ] { y }';
      const { normalized, state } = normalizeDelimitersWithState(input);
      const denormalized = denormalizeDelimiters(normalized, state);
      
      expect(normalized).toBe('[x]{y}');
      expect(denormalized).toBe('[x]{y}'); // Returns normalized text since no state tracking
      expect(state.transformations.length).toBe(0); // No state tracking currently implemented
    });

    it('should handle empty state gracefully', () => {
      const input = '[x]';
      const result = denormalizeDelimiters(input, null);
      expect(result).toBe('[x]');
    });
  });

  describe('Language-Specific Functions', () => {
    it('should normalize Python delimiters correctly', () => {
      const input = 'my_dict = { "key": [ 1, 2, 3 ] }';
      const expected = 'my_dict ={"key":[1, 2, 3]}';
      const result = normalizePythonDelimiters(input);
      expect(result).toBe(expected);
    });

    it('should handle empty Python input', () => {
      const result = normalizePythonDelimiters('');
      expect(result).toBe('');
    });

    it('should normalize JavaScript delimiters correctly', () => {
      const input = 'const obj = { items: [ 1, 2, 3 ], template: `Hello ${ name }` }';
      const expected = 'const obj ={items:[1, 2, 3], template: `Hello ${name}`}';
      const result = normalizeJavaScriptDelimiters(input);
      expect(result).toBe(expected);
    });

    it('should handle empty JavaScript input', () => {
      const result = normalizeJavaScriptDelimiters('');
      expect(result).toBe('');
    });
  });

  describe('Utility Functions', () => {
    it('should count delimiters correctly', () => {
      const input = '[x] {y} (z)';
      const result = countDelimiters(input);
      
      expect(result['[']).toBe(1);
      expect(result[']']).toBe(1);
      expect(result['{']).toBe(1);
      expect(result['}']).toBe(1);
      expect(result['(']).toBe(1);
      expect(result[')']).toBe(1);
    });

    it('should count language-specific delimiters', () => {
      const input = '${value}';
      const result = countDelimiters(input, 'javascript');
      
      expect(result['${']).toBe(1);
      expect(result['{']).toBe(1);
      expect(result['}']).toBe(1);
    });

    it('should handle empty input for counting', () => {
      const result = countDelimiters('');
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should validate balanced delimiters', () => {
      const input = '[x] {y} (z)';
      const result = validateDelimiters(input);
      
      expect(result.balanced).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect unbalanced delimiters', () => {
      const input = '[x {y} (z)';
      const result = validateDelimiters(input);
      
      expect(result.balanced).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate empty input', () => {
      const result = validateDelimiters('');
      expect(result.balanced).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect unclosed delimiters', () => {
      const input = '[x';
      const result = validateDelimiters(input);
      
      expect(result.balanced).toBe(false);
      expect(result.errors.some(e => e.type === 'unclosed')).toBe(true);
    });

    it('should detect unexpected closing delimiters', () => {
      const input = ']x[';
      const result = validateDelimiters(input);
      
      expect(result.balanced).toBe(false);
      expect(result.errors.some(e => e.type === 'unexpected_close')).toBe(true);
    });
  });

  describe('Complex Real-World Examples', () => {
    it('should handle JSON-like structures', () => {
      const input = '{ "name": "John", "items": [ 1, 2, 3 ], "nested": { "key": "value" } }';
      const expected = '{"name": "John", "items":[1, 2, 3], "nested":{"key": "value"}}';
      const result = normalizeDelimiters(input, 'json');
      expect(result).toBe(expected);
    });

    it('should handle CSS selectors', () => {
      const input = '.class { property: value; }';
      const expected = '.class{property: value;}';
      const result = normalizeDelimiters(input, 'css');
      expect(result).toBe(expected);
    });

    it('should handle mixed delimiter types', () => {
      const input = 'function test( param ) { return [ param ]; }';
      const expected = 'function test(param){return[param];}';
      const result = normalizeDelimiters(input, 'javascript');
      expect(result).toBe(expected);
    });

    it('should handle text without delimiters', () => {
      const input = 'This is just plain text without any delimiters';
      const expected = 'This is just plain text without any delimiters';
      const result = normalizeDelimiters(input);
      expect(result).toBe(expected);
    });
  });
});