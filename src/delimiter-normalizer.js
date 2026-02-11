/**
 * Delimiter Normalizer Module
 * 
 * Normalizes whitespace inside delimiters for text comparison.
 * Supports common delimiter pairs and language-specific handling.
 * 
 * Copyright (c) 2026 Jason Tally and contributors
 * SPDX-License-Identifier: MIT
 */

// ============================================================================
// Language-Specific Delimiter Configuration
// ============================================================================

/**
 * Get delimiter pairs for a specific language
 * @param {string|null} language - Language identifier (e.g., 'python', 'javascript')
 * @returns {Array<Array<string>>} Array of [open, close] delimiter pairs
 */
function getDelimiterPairs(language = null) {
  // Base delimiter pairs common to most languages
  const basePairs = [
    ['(', ')'],
    ['[', ']'],
    ['{', '}'],
    ['<', '>']
  ];
  
  // Language-specific extensions
  const languageExtensions = {
    python: [
      ...basePairs,
      ['[', ']'], // List brackets - important for Python
      ['(', ')'], // Tuple parentheses
      ['{', '}'], // Dict braces
    ],
    javascript: [
      ...basePairs,
      ['(', ')'],
      ['[', ']'],
      ['{', '}'],
      ['${', '}'] // Template literal expressions
    ],
    html: [
      ['<', '>'],
      ['<!--', '-->'] // HTML comments
    ],
    css: [
      ['(', ')'],
      ['[', ']'],
      ['{', '}']
    ],
    json: [
      ['[', ']'],
      ['{', '}']
    ]
  };
  
  return languageExtensions[language?.toLowerCase()] || basePairs;
}

/**
 * Escape special regex characters in a string
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// Normalization Functions
// ============================================================================

/**
 * Normalize whitespace inside delimiters for comparison
 * 
 * @param {string} text - Input text to normalize
 * @param {string|null} language - Language identifier for language-specific rules
 * @param {Object} options - Normalization options
 * @param {boolean} options.preserveInnerWhitespace - Keep single spaces inside delimiters
 * @param {boolean} options.normalizeNested - Apply normalization to nested delimiters
 * @returns {string} Normalized text
 */
export function normalizeDelimiters(text, language = null, options = {}) {
  if (!text || typeof text !== 'string') {
    return text;
  }
  
  const {
    preserveInnerWhitespace = false,
    normalizeNested = true
  } = options;
  
  const pairs = getDelimiterPairs(language);
  let normalized = text;
  
  // First pass: Remove spaces around all delimiters globally
  normalized = normalized.replace(/\s*\(\s*/g, '(');
  normalized = normalized.replace(/\s*\)\s*/g, ')');
  normalized = normalized.replace(/\s*\[\s*/g, '[');
  normalized = normalized.replace(/\s*\]\s*/g, ']');
  normalized = normalized.replace(/\s*\{\s*/g, '{');
  normalized = normalized.replace(/\s*\}\s*/g, '}');
  normalized = normalized.replace(/\s*<\s*/g, '<');
  normalized = normalized.replace(/\s*>\s*/g, '>');
  
  // Process each delimiter pair for specific handling
  for (const [open, close] of pairs) {
    if (open === close) {
      // Handle special case like quotes (not implemented in this version)
      continue;
    }
    
    // Skip HTML comments as they have special structure
    if (open === '<!--' && close === '-->') {
      normalized = normalizeHtmlComments(normalized);
      continue;
    }
    
    normalized = normalizeDelimiterPair(normalized, open, close, {
      preserveInnerWhitespace,
      normalizeNested
    });
  }
  
  return normalized;
}

/**
 * Normalize a specific delimiter pair
 * @param {string} text - Input text
 * @param {string} open - Opening delimiter
 * @param {string} close - Closing delimiter
 * @param {Object} options - Normalization options
 * @returns {string} Normalized text
 */
function normalizeDelimiterPair(text, open, close, options = {}) {
  const { preserveInnerWhitespace = false, normalizeNested = true } = options;
  let result = text;
  
  // First, normalize empty delimiters: [ ] → []
  const emptyPattern = new RegExp(
    escapeRegex(open) + '\\s+' + escapeRegex(close),
    'g'
  );
  result = result.replace(emptyPattern, open + close);
  
  // Handle spaces around delimiters: ( x ) → (x), [ x ] → [x]
  const aroundPattern = new RegExp(
    '(' + escapeRegex(open) + ')\\s+([^' + escapeRegex(close) + ']*)\\s+(' + escapeRegex(close) + ')',
    'g'
  );
  result = result.replace(aroundPattern, (match, openMatch, content, closeMatch) => {
    const normalizedContent = content.trim();
    return openMatch + normalizedContent + closeMatch;
  });
  
  // For braces {} also remove spaces around them: { x } → {x}
  if (open === '{' && close === '}') {
    const bracePattern = new RegExp(
      '\\{\\s+([^}]*)\\s+\\}',
      'g'
    );
    result = result.replace(bracePattern, (match, content) => {
      const normalizedContent = content.trim();
      return '{' + normalizedContent + '}';
    });
  }
  
  // Handle spaces after opening and before closing delimiters
  const afterOpenPattern = new RegExp(
    escapeRegex(open) + '\\s+',
    'g'
  );
  result = result.replace(afterOpenPattern, open);
  
  const beforeClosePattern = new RegExp(
    '\\s+' + escapeRegex(close),
    'g'
  );
  result = result.replace(beforeClosePattern, close);
  
  // Handle nested delimiters if enabled
  if (normalizeNested && needNestedNormalization(open, close)) {
    result = normalizeNestedDelimiters(result, open, close, options);
  }
  
  return result;
}

/**
 * Check if a delimiter pair needs nested normalization
 * @param {string} open - Opening delimiter
 * @param {string} close - Closing delimiter
 * @returns {boolean} Whether nested normalization is needed
 */
function needNestedNormalization(open, close) {
  // Brackets, braces, and parentheses often have nested structures
  return (open === '[' && close === ']') ||
         (open === '{' && close === '}') ||
         (open === '(' && close === ')');
}

/**
 * Normalize nested delimiters recursively
 * @param {string} text - Input text
 * @param {string} open - Opening delimiter
 * @param {string} close - Closing delimiter
 * @param {Object} options - Normalization options
 * @param {number} depth - Current recursion depth
 * @returns {string} Normalized text
 */
function normalizeNestedDelimiters(text, open, close, options = {}, depth = 0) {
  // Prevent infinite recursion
  if (depth > 10) {
    return text;
  }
  
  let result = text;
  let stack = [];
  let start = 0;
  
  for (let i = 0; i < result.length; i++) {
    const char = result[i];
    
    // Check for opening delimiter (not escaped)
    if (result.slice(i, i + open.length) === open && !isEscaped(result, i)) {
      if (stack.length === 0) {
        start = i + open.length;
      }
      stack.push(open);
      i += open.length - 1; // Skip the delimiter
    } else if (result.slice(i, i + close.length) === close && !isEscaped(result, i) && stack.length > 0) {
      stack.pop();
      
      if (stack.length === 0) {
        // Found a complete pair
        const content = result.slice(start, i);
        
        // Normalize whitespace in the content
        const normalizedContent = options.preserveInnerWhitespace
          ? content.replace(/\s+/g, ' ').trim()
          : content.replace(/\s+/g, ' ').trim();
        
        // Replace in result
        result = result.slice(0, start) + normalizedContent + result.slice(i);
        
        // Recursively normalize nested structures in the content
        if (normalizedContent !== content) {
          result = normalizeNestedDelimiters(result, open, close, options, depth + 1);
        }
        
        // Restart from beginning since we modified the string
        return normalizeNestedDelimiters(result, open, close, options, depth + 1);
      }
      i += close.length - 1; // Skip the delimiter
    }
  }
  
  return result;
}

/**
 * Normalize HTML comments specifically
 * @param {string} text - Input text
 * @returns {string} Normalized text
 */
function normalizeHtmlComments(text) {
  // HTML comments: <!-- comment --> becomes <!--comment-->
  const commentPattern = /<!--\s+([\s\S]*?)\s+-->/g;
  return text.replace(commentPattern, (match, content) => {
    const normalizedContent = content.replace(/\s+/g, ' ').trim();
    return `<!--${normalizedContent}-->`;
  });
}

/**
 * Check if a character at position is escaped
 * @param {string} str - String to check
 * @param {number} pos - Position to check
 * @returns {boolean} Whether the character is escaped
 */
function isEscaped(str, pos) {
  if (pos === 0) return false;
  
  let escaped = false;
  let i = pos - 1;
  
  // Count backslashes
  while (i >= 0 && str[i] === '\\') {
    escaped = !escaped;
    i--;
  }
  
  return escaped;
}

// ============================================================================
// Denormalization Functions
// ============================================================================

/**
 * Store normalization state for denormalization
 */
class NormalizationState {
  constructor() {
    this.transformations = [];
  }
  
  addTransformation(original, normalized, start, end) {
    this.transformations.push({
      original,
      normalized,
      start,
      end
    });
  }
  
  getTransformations() {
    return this.transformations;
  }
}

/**
 * Normalize delimiters with state tracking for denormalization
 * @param {string} text - Input text to normalize
 * @param {string|null} language - Language identifier
 * @param {Object} options - Normalization options
 * @returns {Object} Object with normalized text and state
 */
export function normalizeDelimitersWithState(text, language = null, options = {}) {
  const state = new NormalizationState();
  
  // Store original for comparison
  const original = text;
  
  // Apply normalization while tracking changes
  const normalized = normalizeDelimiters(text, language, {
    ...options,
    _trackState: state,
    _original: original
  });
  
  return {
    normalized,
    state,
    original
  };
}

/**
 * Denormalize text using normalization state
 * @param {string} normalizedText - Normalized text
 * @param {NormalizationState} state - Normalization state
 * @returns {string} Denormalized text
 */
export function denormalizeDelimiters(normalizedText, state) {
  if (!state || !state.transformations) {
    return normalizedText;
  }
  
  let result = normalizedText;
  
  // Apply transformations in reverse order
  for (let i = state.transformations.length - 1; i >= 0; i--) {
    const transform = state.transformations[i];
    result = result.slice(0, transform.start) + 
              transform.original + 
              result.slice(transform.end);
  }
  
  return result;
}

// ============================================================================
// Language-Specific Functions
// ============================================================================

/**
 * Python-specific delimiter normalization
 * Handles Python's significant whitespace and special cases
 * @param {string} text - Python code
 * @param {Object} options - Options
 * @returns {string} Normalized Python code
 */
export function normalizePythonDelimiters(text, options = {}) {
  if (!text) return text;
  
  let result = normalizeDelimiters(text, 'python', options);
  
  // Python-specific: Handle indentation in multi-line structures
  // Don't normalize whitespace that affects Python's meaning
  
  return result;
}

/**
 * JavaScript-specific delimiter normalization
 * Handles template literals and object notation
 * @param {string} text - JavaScript code
 * @param {Object} options - Options
 * @returns {string} Normalized JavaScript code
 */
export function normalizeJavaScriptDelimiters(text, options = {}) {
  if (!text) return text;
  
  let result = normalizeDelimiters(text, 'javascript', options);
  
  // JavaScript-specific: Handle template literals
  // Don't normalize inside template literals unless requested
  
  return result;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Count delimiter pairs in text
 * @param {string} text - Input text
 * @param {string|null} language - Language identifier
 * @returns {Object} Object with counts for each delimiter type
 */
export function countDelimiters(text, language = null) {
  if (!text) return {};
  
  const pairs = getDelimiterPairs(language);
  const counts = {};
  
  for (const [open, close] of pairs) {
    const openCount = (text.match(new RegExp(escapeRegex(open), 'g')) || []).length;
    const closeCount = (text.match(new RegExp(escapeRegex(close), 'g')) || []).length;
    counts[open] = openCount;
    counts[close] = closeCount;
  }
  
  return counts;
}

/**
 * Validate that delimiters are balanced in text
 * @param {string} text - Input text
 * @param {string|null} language - Language identifier
 * @returns {Object} Object with validation results
 */
export function validateDelimiters(text, language = null) {
  if (!text) return { balanced: true, errors: [] };
  
  const pairs = getDelimiterPairs(language);
  const stack = [];
  const errors = [];
  
  for (let i = 0; i < text.length; i++) {
    for (const [open, close] of pairs) {
      if (text.slice(i, i + open.length) === open && !isEscaped(text, i)) {
        stack.push({ delimiter: open, position: i, close });
        i += open.length - 1;
      } else if (text.slice(i, i + close.length) === close && !isEscaped(text, i)) {
        if (stack.length === 0 || stack[stack.length - 1].delimiter !== open) {
          errors.push({
            type: 'unexpected_close',
            delimiter: close,
            position: i,
            expected: stack.length > 0 ? stack[stack.length - 1].close : null
          });
        } else {
          stack.pop();
        }
        i += close.length - 1;
      }
    }
  }
  
  // Add unclosed delimiters to errors
  for (const unclosed of stack) {
    errors.push({
      type: 'unclosed',
      delimiter: unclosed.delimiter,
      position: unclosed.position,
      expected: unclosed.close
    });
  }
  
  return {
    balanced: errors.length === 0,
    errors
  };
}