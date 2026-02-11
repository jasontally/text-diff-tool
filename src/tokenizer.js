/**
 * Tokenizer Module
 * 
 * Lightweight tokenizer for code comparison. Breaks lines into meaningful
 * tokens without requiring full language parsers.
 * 
 * Copyright (c) 2026 Jason Tally and contributors
 * SPDX-License-Identifier: MIT
 */

// Common programming keywords across popular languages
const KEYWORDS = new Set([
  // JavaScript/TypeScript
  'const', 'let', 'var', 'function', 'class', 'interface', 'type', 'enum',
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
  'return', 'try', 'catch', 'finally', 'throw', 'new', 'this', 'super',
  'extends', 'implements', 'import', 'export', 'from', 'as', 'default',
  'async', 'await', 'yield', 'typeof', 'instanceof', 'in', 'of', 'void',
  'null', 'undefined', 'true', 'false', 'NaN', 'Infinity',
  
  // Python
  'def', 'class', 'if', 'elif', 'else', 'for', 'while', 'break', 'continue',
  'return', 'try', 'except', 'finally', 'raise', 'with', 'as', 'import',
  'from', 'lambda', 'yield', 'pass', 'assert', 'del', 'global', 'nonlocal',
  'True', 'False', 'None', 'and', 'or', 'not', 'is', 'in',
  
  // Java/C/C++/C#/Go/Rust
  'public', 'private', 'protected', 'static', 'final', 'abstract', 'virtual',
  'override', 'int', 'float', 'double', 'char', 'bool', 'boolean', 'string',
  'String', 'void', 'struct', 'enum', 'union', 'typedef', 'sizeof', 'goto',
  'let', 'mut', 'fn', 'pub', 'crate', 'mod', 'use', 'impl', 'trait', 'match',
  'if', 'else', 'for', 'while', 'loop', 'return', 'break', 'continue',
  'package', 'func', 'chan', 'go', 'defer', 'select', 'range',
  
  // SQL
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'JOIN', 'LEFT',
  'RIGHT', 'INNER', 'OUTER', 'ON', 'GROUP', 'BY', 'HAVING', 'ORDER', 'LIMIT',
  'AND', 'OR', 'NOT', 'NULL', 'IS', 'IN', 'EXISTS', 'BETWEEN', 'LIKE',
  
  // Shell/Bash
  'if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done', 'case',
  'esac', 'in', 'function', 'return', 'exit', 'echo', 'export', 'source'
]);

// Operators grouped by precedence/type
const OPERATORS = [
  // Multi-character operators first (longer matches take priority)
  '===', '!==', '==', '!=', '<=', '>=', '=>', '->', '**', '//', '++', '--',
  '&&', '||', '<<', '>>', '::', '??', '?.', '...', '..',
  // Single-character operators
  '+', '-', '*', '/', '%', '=', '<', '>', '!', '~', '&', '|', '^', '?', ':'
];

// Delimiters
const DELIMITERS = '()[]{},;.';

// Quote characters for string literals
const QUOTES = '"\'`';

/**
 * Token types
 */
export const TOKEN_TYPES = {
  KEYWORD: 'keyword',
  IDENTIFIER: 'identifier',
  OPERATOR: 'operator',
  DELIMITER: 'delimiter',
  STRING: 'string',
  NUMBER: 'number',
  COMMENT: 'comment',
  WHITESPACE: 'whitespace',
  OTHER: 'other'
};

/**
 * Check if a character is whitespace
 * @param {string} char - Character to check
 * @returns {boolean}
 */
function isWhitespace(char) {
  return /\s/.test(char);
}

/**
 * Check if a character is a digit
 * @param {string} char - Character to check
 * @returns {boolean}
 */
function isDigit(char) {
  return /\d/.test(char);
}

/**
 * Check if a character is a valid identifier start
 * @param {string} char - Character to check
 * @returns {boolean}
 */
function isIdentifierStart(char) {
  return /[a-zA-Z_\$@]/.test(char);
}

/**
 * Check if a character is a valid identifier part
 * @param {string} char - Character to check
 * @returns {boolean}
 */
function isIdentifierPart(char) {
  return /[a-zA-Z0-9_\$@]/.test(char);
}

/**
 * Tokenize a single line of code
 * 
 * @param {string} line - Line of code to tokenize
 * @param {Object} options - Tokenization options
 * @param {boolean} options.includeWhitespace - Include whitespace tokens (default: false)
 * @param {boolean} options.includeComments - Include comment tokens (default: true)
 * @returns {Array} Array of token objects with type and value
 */
export function tokenize(line, options = {}) {
  const { includeWhitespace = false, includeComments = true } = options;
  const tokens = [];
  let i = 0;
  
  while (i < line.length) {
    const char = line[i];
    
    // Handle whitespace
    if (isWhitespace(char)) {
      let value = '';
      while (i < line.length && isWhitespace(line[i])) {
        value += line[i];
        i++;
      }
      if (includeWhitespace) {
        tokens.push({ type: TOKEN_TYPES.WHITESPACE, value });
      }
      continue;
    }
    
    // Handle comments (//, #, --, /* */)
    if (char === '/' && line[i + 1] === '/') {
      const value = line.substring(i);
      if (includeComments) {
        tokens.push({ type: TOKEN_TYPES.COMMENT, value });
      }
      break; // Rest of line is comment
    }
    
    if (char === '#' || (char === '-' && line[i + 1] === '-')) {
      const value = line.substring(i);
      if (includeComments) {
        tokens.push({ type: TOKEN_TYPES.COMMENT, value });
      }
      break;
    }
    
    // Handle string literals
    if (QUOTES.includes(char)) {
      const quote = char;
      let value = char;
      i++;
      while (i < line.length) {
        if (line[i] === '\\') {
          value += line[i];
          i++;
          if (i < line.length) {
            value += line[i];
            i++;
          }
        } else if (line[i] === quote) {
          value += line[i];
          i++;
          break;
        } else {
          value += line[i];
          i++;
        }
      }
      tokens.push({ type: TOKEN_TYPES.STRING, value });
      continue;
    }
    
    // Handle numbers
    if (isDigit(char) || (char === '.' && isDigit(line[i + 1]))) {
      let value = '';
      while (i < line.length && (isDigit(line[i]) || line[i] === '.' || 
             line[i] === 'e' || line[i] === 'E' || line[i] === 'x' ||
             line[i] === 'X' || line[i] === 'b' || line[i] === 'B' ||
             line[i] === 'o' || line[i] === 'O')) {
        value += line[i];
        i++;
      }
      tokens.push({ type: TOKEN_TYPES.NUMBER, value });
      continue;
    }
    
    // Handle multi-character operators
    let matchedOperator = false;
    for (const op of OPERATORS) {
      if (line.substring(i, i + op.length) === op) {
        tokens.push({ type: TOKEN_TYPES.OPERATOR, value: op });
        i += op.length;
        matchedOperator = true;
        break;
      }
    }
    if (matchedOperator) continue;
    
    // Handle delimiters
    if (DELIMITERS.includes(char)) {
      tokens.push({ type: TOKEN_TYPES.DELIMITER, value: char });
      i++;
      continue;
    }
    
    // Handle identifiers and keywords
    if (isIdentifierStart(char)) {
      let value = '';
      while (i < line.length && isIdentifierPart(line[i])) {
        value += line[i];
        i++;
      }
      const type = KEYWORDS.has(value) ? TOKEN_TYPES.KEYWORD : TOKEN_TYPES.IDENTIFIER;
      tokens.push({ type, value });
      continue;
    }
    
    // Unknown character - treat as OTHER
    tokens.push({ type: TOKEN_TYPES.OTHER, value: char });
    i++;
  }
  
  return tokens;
}

/**
 * Tokenize multiple lines
 * 
 * @param {string} text - Multi-line text to tokenize
 * @param {Object} options - Tokenization options
 * @returns {Array} Array of token arrays, one per line
 */
export function tokenizeLines(text, options = {}) {
  const lines = text.split('\n');
  return lines.map(line => tokenize(line, options));
}

/**
 * Get normalized token sequence for comparison
 * Ignores whitespace and literal values (strings/numbers) for structure comparison
 * 
 * @param {Array} tokens - Token array from tokenize()
 * @param {Object} options - Normalization options
 * @param {boolean} options.normalizeLiterals - Replace literals with placeholders (default: true)
 * @param {boolean} options.normalizeIdentifiers - Replace identifiers with placeholders (default: false)
 * @returns {Array} Normalized tokens
 */
export function normalizeTokens(tokens, options = {}) {
  const { normalizeLiterals = true, normalizeIdentifiers = false } = options;
  
  return tokens
    .filter(t => t.type !== TOKEN_TYPES.WHITESPACE && t.type !== TOKEN_TYPES.COMMENT)
    .map((t, index) => {
      if (normalizeLiterals && (t.type === TOKEN_TYPES.STRING || t.type === TOKEN_TYPES.NUMBER)) {
        return { type: t.type, value: `__${t.type}_${index}__`, originalValue: t.value };
      }
      if (normalizeIdentifiers && t.type === TOKEN_TYPES.IDENTIFIER) {
        return { type: t.type, value: `__IDENT_${index}__`, originalValue: t.value };
      }
      return t;
    });
}

/**
 * Calculate token-based similarity between two lines
 * 
 * @param {string} lineA - First line
 * @param {string} lineB - Second line
 * @param {Object} options - Options for tokenization and comparison
 * @returns {Object} Similarity score and details
 */
export function compareLines(lineA, lineB, options = {}) {
  const tokensA = tokenize(lineA, { includeWhitespace: false, includeComments: true });
  const tokensB = tokenize(lineB, { includeWhitespace: false, includeComments: true });
  
  // Calculate raw token similarity
  const rawSimilarity = calculateTokenSimilarity(tokensA, tokensB);
  
  // Calculate normalized token similarity (structure-focused)
  const normalizedA = normalizeTokens(tokensA, { normalizeLiterals: true });
  const normalizedB = normalizeTokens(tokensB, { normalizeLiterals: true });
  const normalizedSimilarity = calculateTokenSimilarity(normalizedA, normalizedB);
  
  // Calculate identifier overlap (important for semantic similarity)
  const identifiersA = tokensA.filter(t => t.type === TOKEN_TYPES.IDENTIFIER).map(t => t.value);
  const identifiersB = tokensB.filter(t => t.type === TOKEN_TYPES.IDENTIFIER).map(t => t.value);
  const identifierSimilarity = calculateJaccardSimilarity(identifiersA, identifiersB);
  
  // Calculate keyword overlap
  const keywordsA = tokensA.filter(t => t.type === TOKEN_TYPES.KEYWORD).map(t => t.value);
  const keywordsB = tokensB.filter(t => t.type === TOKEN_TYPES.KEYWORD).map(t => t.value);
  const keywordSimilarity = calculateJaccardSimilarity(keywordsA, keywordsB);
  
  // Weighted combination - adjusted to favor structure more heavily
  // When normalized similarity is high, overall score should be high even if identifiers differ
  const weightedScore = (
    normalizedSimilarity * 0.55 +  // Structure is most important (same token types in same order)
    keywordSimilarity * 0.25 +     // Keywords indicate control flow similarity
    identifierSimilarity * 0.15 +  // Identifiers matter less for structure
    rawSimilarity * 0.05            // Raw tokens provide fine-grained similarity
  );
  
  return {
    similarity: Math.min(1.0, weightedScore),
    details: {
      rawSimilarity,
      normalizedSimilarity,
      identifierSimilarity,
      keywordSimilarity
    },
    tokensA,
    tokensB
  };
}

/**
 * Calculate similarity between two token arrays using longest common subsequence
 * 
 * @param {Array} tokensA - First token array
 * @param {Array} tokensB - Second token array
 * @returns {number} Similarity score 0.0-1.0
 */
function calculateTokenSimilarity(tokensA, tokensB) {
  if (tokensA.length === 0 && tokensB.length === 0) return 1.0;
  if (tokensA.length === 0 || tokensB.length === 0) return 0.0;
  
  // Use simplified LCS - just count matching tokens in order
  const lcsLength = longestCommonSubsequenceLength(tokensA, tokensB);
  return (2 * lcsLength) / (tokensA.length + tokensB.length);
}

/**
 * Calculate LCS length between two token arrays
 * Uses dynamic programming with optimization for small sequences
 * 
 * @param {Array} tokensA - First token array
 * @param {Array} tokensB - Second token array
 * @returns {number} Length of longest common subsequence
 */
function longestCommonSubsequenceLength(tokensA, tokensB) {
  const maxLength = 200; // Limit for performance
  
  if (tokensA.length > maxLength || tokensB.length > maxLength) {
    // Use greedy approximation for large sequences
    return greedyLCS(tokensA, tokensB);
  }
  
  // Standard DP approach for smaller sequences
  const m = tokensA.length;
  const n = tokensB.length;
  
  // Use Uint16Array for memory efficiency
  let prev = new Uint16Array(n + 1);
  let curr = new Uint16Array(n + 1);
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (tokensMatch(tokensA[i - 1], tokensB[j - 1])) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    // Swap arrays
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }
  
  return prev[n];
}

/**
 * Greedy LCS approximation for large sequences
 * Faster but less accurate than full DP
 * 
 * @param {Array} tokensA - First token array
 * @param {Array} tokensB - Second token array
 * @returns {number} Approximate LCS length
 */
function greedyLCS(tokensA, tokensB) {
  let count = 0;
  let j = 0;
  
  for (let i = 0; i < tokensA.length && j < tokensB.length; i++) {
    while (j < tokensB.length && !tokensMatch(tokensA[i], tokensB[j])) {
      j++;
    }
    if (j < tokensB.length && tokensMatch(tokensA[i], tokensB[j])) {
      count++;
      j++;
    }
  }
  
  return count;
}

/**
 * Check if two tokens match (same type and value)
 * 
 * @param {Object} tokenA - First token
 * @param {Object} tokenB - Second token
 * @returns {boolean}
 */
function tokensMatch(tokenA, tokenB) {
  return tokenA.type === tokenB.type && tokenA.value === tokenB.value;
}

/**
 * Calculate Jaccard similarity between two sets
 * Jaccard = |A ∩ B| / |A ∪ B|
 * 
 * @param {Array} setA - First set (array)
 * @param {Array} setB - Second set (array)
 * @returns {number} Jaccard similarity 0.0-1.0
 */
function calculateJaccardSimilarity(setA, setB) {
  if (setA.length === 0 && setB.length === 0) return 1.0;
  if (setA.length === 0 || setB.length === 0) return 0.0;
  
  const set1 = new Set(setA);
  const set2 = new Set(setB);
  
  let intersection = 0;
  for (const item of set1) {
    if (set2.has(item)) intersection++;
  }
  
  const union = set1.size + set2.size - intersection;
  return intersection / union;
}

export default {
  tokenize,
  tokenizeLines,
  normalizeTokens,
  compareLines,
  TOKEN_TYPES
};
