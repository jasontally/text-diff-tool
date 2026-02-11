/**
 * Tests for Tokenizer Module
 * 
 * Tests token-based similarity and line comparison
 */

import { describe, it, expect } from 'vitest';
import { 
  tokenize, 
  tokenizeLines, 
  normalizeTokens, 
  compareLines,
  TOKEN_TYPES 
} from '../src/tokenizer.js';

describe('Tokenizer', () => {
  describe('tokenize', () => {
    it('should tokenize a simple variable declaration', () => {
      const tokens = tokenize('const x = 5;');
      
      expect(tokens).toHaveLength(5);
      expect(tokens[0]).toEqual({ type: TOKEN_TYPES.KEYWORD, value: 'const' });
      expect(tokens[1]).toEqual({ type: TOKEN_TYPES.IDENTIFIER, value: 'x' });
      expect(tokens[2]).toEqual({ type: TOKEN_TYPES.OPERATOR, value: '=' });
      expect(tokens[3]).toEqual({ type: TOKEN_TYPES.NUMBER, value: '5' });
      expect(tokens[4]).toEqual({ type: TOKEN_TYPES.DELIMITER, value: ';' });
    });

    it('should tokenize a function declaration', () => {
      const tokens = tokenize('function hello(name) { return "world"; }');
      
      expect(tokens.length).toBeGreaterThanOrEqual(10);
      expect(tokens[0]).toEqual({ type: TOKEN_TYPES.KEYWORD, value: 'function' });
      expect(tokens[1]).toEqual({ type: TOKEN_TYPES.IDENTIFIER, value: 'hello' });
      expect(tokens[2]).toEqual({ type: TOKEN_TYPES.DELIMITER, value: '(' });
      expect(tokens[3]).toEqual({ type: TOKEN_TYPES.IDENTIFIER, value: 'name' });
      expect(tokens[4]).toEqual({ type: TOKEN_TYPES.DELIMITER, value: ')' });
    });

    it('should tokenize string literals', () => {
      const tokens = tokenize('const msg = "hello world";');
      
      const stringToken = tokens.find(t => t.type === TOKEN_TYPES.STRING);
      expect(stringToken).toBeDefined();
      expect(stringToken.value).toBe('"hello world"');
    });

    it('should tokenize comments', () => {
      const tokens = tokenize('const x = 5; // this is a comment');
      
      const commentToken = tokens.find(t => t.type === TOKEN_TYPES.COMMENT);
      expect(commentToken).toBeDefined();
      expect(commentToken.value).toBe('// this is a comment');
    });

    it('should handle operators correctly', () => {
      const tokens = tokenize('a === b && c !== d');
      
      expect(tokens).toContainEqual({ type: TOKEN_TYPES.OPERATOR, value: '===' });
      expect(tokens).toContainEqual({ type: TOKEN_TYPES.OPERATOR, value: '&&' });
      expect(tokens).toContainEqual({ type: TOKEN_TYPES.OPERATOR, value: '!==' });
    });

    it('should skip whitespace by default', () => {
      const tokens = tokenize('const    x   =    5;');
      
      const whitespaceTokens = tokens.filter(t => t.type === TOKEN_TYPES.WHITESPACE);
      expect(whitespaceTokens).toHaveLength(0);
    });

    it('should include whitespace when requested', () => {
      const tokens = tokenize('const x = 5;', { includeWhitespace: true });
      
      const whitespaceTokens = tokens.filter(t => t.type === TOKEN_TYPES.WHITESPACE);
      expect(whitespaceTokens.length).toBeGreaterThan(0);
    });
  });

  describe('tokenizeLines', () => {
    it('should tokenize multiple lines', () => {
      const text = 'const x = 5;\nconst y = 10;';
      const result = tokenizeLines(text);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveLength(5);  // const x = 5;
      expect(result[1]).toHaveLength(5);  // const y = 10;
    });
  });

  describe('normalizeTokens', () => {
    it('should normalize literals to placeholders', () => {
      const tokens = tokenize('const x = 5;');
      const normalized = normalizeTokens(tokens, { normalizeLiterals: true });
      
      const numberToken = normalized.find(t => t.type === TOKEN_TYPES.NUMBER);
      expect(numberToken.value).toMatch(/__number_\d+__/);
    });

    it('should keep original value when not normalizing', () => {
      const tokens = tokenize('const x = 5;');
      const normalized = normalizeTokens(tokens, { normalizeLiterals: false });
      
      const numberToken = normalized.find(t => t.type === TOKEN_TYPES.NUMBER);
      expect(numberToken.value).toBe('5');
    });

    it('should normalize identifiers when requested', () => {
      const tokens = tokenize('const x = 5;');
      const normalized = normalizeTokens(tokens, { 
        normalizeLiterals: true, 
        normalizeIdentifiers: true 
      });
      
      const idToken = normalized.find(t => t.type === TOKEN_TYPES.IDENTIFIER);
      expect(idToken.value).toMatch(/__IDENT_\d+__/);
    });
  });

  describe('compareLines', () => {
    it('should return high similarity for identical lines', () => {
      const result = compareLines('const x = 5;', 'const x = 5;');
      
      expect(result.similarity).toBeGreaterThanOrEqual(0.999);
    });

    it('should detect high similarity for lines with same structure', () => {
      // Same structure, different variable name
      const result = compareLines('const x = 5;', 'const y = 5;');
      
      expect(result.similarity).toBeGreaterThan(0.7);
      expect(result.details.identifierSimilarity).toBe(0); // Different identifiers
      expect(result.details.normalizedSimilarity).toBeGreaterThan(0.75); // Similar structure
    });

    it('should detect lower similarity for structurally different lines', () => {
      const result = compareLines('const x = 5;', 'let y = "hello";');
      
      expect(result.similarity).toBeLessThan(0.8);
    });

    it('should detect high similarity for same keyword pattern', () => {
      // Both are function declarations with same structure
      const result = compareLines(
        'function calculateSum(a, b) {',
        'function calculateProduct(x, y) {'
      );
      
      expect(result.similarity).toBeGreaterThan(0.6);
      expect(result.details.keywordSimilarity).toBe(1.0); // Same keywords
    });

    it('should handle empty lines', () => {
      const result = compareLines('', '');
      
      expect(result.similarity).toBeGreaterThanOrEqual(0.999);
    });

    it('should handle one empty line', () => {
      const result = compareLines('const x = 5;', '');
      
      expect(result.similarity).toBe(0.0);
    });

    it('should detect modified vs completely different lines', () => {
      const modified = compareLines('const x = 5;', 'let x = 5;');
      const different = compareLines('const x = 5;', 'function foo() {');
      
      // Modified should have higher similarity than completely different
      expect(modified.similarity).toBeGreaterThan(different.similarity);
    });

    it('should handle Python-style code', () => {
      const result = compareLines(
        'def calculate_sum(a, b):',
        'def calculate_product(x, y):'
      );
      
      expect(result.similarity).toBeGreaterThan(0.6);
    });

    it('should handle SQL queries', () => {
      const result = compareLines(
        'SELECT * FROM users WHERE id = 1;',
        'SELECT name FROM users WHERE id = 2;'
      );
      
      expect(result.similarity).toBeGreaterThan(0.7);
    });
  });
});
