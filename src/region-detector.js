/**
 * Region Detector Module
 * 
 * Identifies comment and string regions in code lines.
 * Uses tree-sitter for accurate parsing when available, with regex fallback.
 * 
 * Copyright (c) 2025 Jason Tally and contributors
 * SPDX-License-Identifier: MIT
 */

// ============================================================================
// Region Types
// ============================================================================

export const REGION_TYPES = {
  COMMENT: 'comment',
  STRING: 'string',
  CODE: 'code'
};

// ============================================================================
// Language Configuration
// ============================================================================

const LANGUAGE_CONFIGS = {
  // C-style languages: C, C++, Java, C#, JavaScript, TypeScript, etc.
  c: {
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    strings: [
      { start: '"', end: '"', escape: '\\' },
      { start: "'", end: "'", escape: '\\' }
    ]
  },
  
  // Python
  python: {
    lineComments: ['#'],
    blockComments: [],
    strings: [
      { start: '"', end: '"', escape: '\\' },
      { start: "'", end: "'", escape: '\\' },
      { start: '"""', end: '"""', multiline: true },
      { start: "'''", end: "'''", multiline: true }
    ]
  },
  
  // Shell scripts (bash, sh, zsh)
  shell: {
    lineComments: ['#'],
    blockComments: [],
    strings: [
      { start: '"', end: '"', escape: '\\' },
      { start: "'", end: "'", escape: false }
    ]
  },
  
  // SQL
  sql: {
    lineComments: ['--'],
    blockComments: [['/*', '*/']],
    strings: [
      { start: "'", end: "'", escape: '\\' }
    ]
  },
  
  // HTML/XML
  html: {
    lineComments: [],
    blockComments: [['<!--', '-->']],
    strings: [
      { start: '"', end: '"', escape: '\\' },
      { start: "'", end: "'", escape: '\\' }
    ]
  },
  
  // CSS
  css: {
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    strings: [
      { start: '"', end: '"', escape: '\\' },
      { start: "'", end: "'", escape: '\\' }
    ]
  },
  
  // Ruby
  ruby: {
    lineComments: ['#'],
    blockComments: [['=begin', '=end']],
    strings: [
      { start: '"', end: '"', escape: '\\' },
      { start: "'", end: "'", escape: '\\' },
      { start: '%Q', end: '"', escape: '\\' },
      { start: '%q', end: "'", escape: '\\' }
    ]
  },
  
  // PHP
  php: {
    lineComments: ['//', '#'],
    blockComments: [['/*', '*/']],
    strings: [
      { start: '"', end: '"', escape: '\\' },
      { start: "'", end: "'", escape: '\\' }
    ]
  },
  
  // Go
  go: {
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    strings: [
      { start: '"', end: '"', escape: '\\' },
      { start: "'", end: "'", escape: '\\' },
      { start: '`', end: '`', raw: true }
    ]
  },
  
  // Rust
  rust: {
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    strings: [
      { start: '"', end: '"', escape: '\\' },
      { start: "'", end: "'", escape: '\\' },
      { start: 'r#', end: '"', raw: true },
      { start: 'r##', end: '"', raw: true },
      { start: 'r###', end: '"', raw: true }
    ]
  },
  
  // Swift
  swift: {
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    strings: [
      { start: '"', end: '"', escape: '\\' },
      { start: "'", end: "'", escape: '\\' },
      { start: '"""', end: '"""', multiline: true }
    ]
  },
  
  // Kotlin
  kotlin: {
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    strings: [
      { start: '"', end: '"', escape: '\\' },
      { start: "'", end: "'", escape: '\\' },
      { start: '"""', end: '"""', multiline: true }
    ]
  },
  
  // Scala
  scala: {
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    strings: [
      { start: '"', end: '"', escape: '\\' },
      { start: "'", end: "'", escape: '\\' },
      { start: '"""', end: '"""', multiline: true }
    ]
  },
  
  // Haskell
  haskell: {
    lineComments: ['--'],
    blockComments: [['{-', '-}']],
    strings: [
      { start: '"', end: '"', escape: '\\' }
    ]
  },
  
  // Lua
  lua: {
    lineComments: ['--'],
    blockComments: [['--[[', ']]']],
    strings: [
      { start: '"', end: '"', escape: '\\' },
      { start: "'", end: "'", escape: '\\' },
      { start: '[[', end: ']]', multiline: true }
    ]
  },
  
  // Perl
  perl: {
    lineComments: ['#'],
    blockComments: [],
    strings: [
      { start: '"', end: '"', escape: '\\' },
      { start: "'", end: "'", escape: '\\' },
      { start: '`', end: '`', escape: '\\' }
    ]
  },
  
  // R
  r: {
    lineComments: ['#'],
    blockComments: [],
    strings: [
      { start: '"', end: '"', escape: '\\' },
      { start: "'", end: "'", escape: '\\' }
    ]
  },
  
  // Dockerfile
  dockerfile: {
    lineComments: ['#'],
    blockComments: [],
    strings: [
      { start: '"', end: '"', escape: '\\' },
      { start: "'", end: "'", escape: '\\' }
    ]
  },
  
  // JSON (no comments, just strings)
  json: {
    lineComments: [],
    blockComments: [],
    strings: [
      { start: '"', end: '"', escape: '\\' }
    ]
  },
  
  // YAML
  yaml: {
    lineComments: ['#'],
    blockComments: [],
    strings: [
      { start: '"', end: '"', escape: '\\' },
      { start: "'", end: "'", escape: '\\' }
    ]
  },
  
  // TOML
  toml: {
    lineComments: ['#'],
    blockComments: [],
    strings: [
      { start: '"', end: '"', escape: '\\' },
      { start: "'", end: "'", escape: '\\' },
      { start: '"""', end: '"""', multiline: true },
      { start: "'''", end: "'''", multiline: true }
    ]
  },
  
  // INI files
  ini: {
    lineComments: [';', '#'],
    blockComments: [],
    strings: [
      { start: '"', end: '"', escape: '\\' },
      { start: "'", end: "'", escape: '\\' }
    ]
  },
  
  // Properties files
  properties: {
    lineComments: ['#', '!'],
    blockComments: [],
    strings: [
      { start: '"', end: '"', escape: '\\' }
    ]
  },
  
  // Makefile
  makefile: {
    lineComments: ['#'],
    blockComments: [],
    strings: [
      { start: '"', end: '"', escape: '\\' },
      { start: "'", end: "'", escape: '\\' }
    ]
  },
  
  // Default configuration for unknown languages
  default: {
    lineComments: ['//', '#', '--'],
    blockComments: [['/*', '*/'], ['<!--', '-->']],
    strings: [
      { start: '"', end: '"', escape: '\\' },
      { start: "'", end: "'", escape: '\\' }
    ]
  }
};

// ============================================================================
// Tree-sitter Integration
// ============================================================================

/**
 * Check if tree-sitter is available
 * @returns {boolean} True if tree-sitter can be used
 */
export function isTreeSitterAvailable() {
  // In a real implementation, this would check for tree-sitter module
  // For now, we'll use a placeholder that returns false
  // The actual tree-sitter integration can be added later
  return false;
}

/**
 * Detect regions using tree-sitter parsing
 * @param {string} line - The line to analyze
 * @param {string} language - The language identifier
 * @returns {Array<Object>} Array of regions with type and positions
 */
export function detectWithTreeSitter(line, language) {
  // Placeholder for tree-sitter implementation
  // In a real implementation, this would:
  // 1. Load the appropriate tree-sitter parser for the language
  // 2. Parse the line to get syntax tree
  // 3. Walk the tree to identify comment and string nodes
  // 4. Return regions with accurate positions
  
  // For now, fall back to regex detection
  return detectWithRegex(line, language);
}

// ============================================================================
// Regex-based Detection
// ============================================================================

/**
 * Get language configuration for a given language
 * @param {string} language - Language identifier
 * @returns {Object} Language configuration
 */
function getLanguageConfig(language) {
  if (!language) {
    return LANGUAGE_CONFIGS.default;
  }
  
  // Normalize language name
  const normalizedLang = language.toLowerCase().trim();
  
  // Direct match
  if (LANGUAGE_CONFIGS[normalizedLang]) {
    return LANGUAGE_CONFIGS[normalizedLang];
  }
  
  // Common aliases
  const aliases = {
    'js': 'c',           // JavaScript uses C-style syntax
    'javascript': 'c',
    'typescript': 'c',
    'ts': 'c',
    'java': 'c',
    'cpp': 'c',
    'c++': 'c',
    'c#': 'c',
    'cs': 'c',
    'bash': 'shell',
    'sh': 'shell',
    'zsh': 'shell',
    'xml': 'html',
    'svg': 'html',
    'py': 'python',
    'rb': 'ruby',
    'rs': 'rust',
    'go': 'go',
    'kt': 'kotlin',
    'hs': 'haskell',
    'pl': 'perl',
    'docker': 'dockerfile'
  };
  
  const config = LANGUAGE_CONFIGS[aliases[normalizedLang]];
  if (config) {
    return config;
  }
  
  // Try to match common patterns
  if (normalizedLang.includes('java') || 
      normalizedLang.includes('c') || 
      normalizedLang.includes('cpp') ||
      normalizedLang.includes('script')) {
    return LANGUAGE_CONFIGS.c;
  }
  
  if (normalizedLang.includes('py') || normalizedLang.includes('python')) {
    return LANGUAGE_CONFIGS.python;
  }
  
  if (normalizedLang.includes('sql')) {
    return LANGUAGE_CONFIGS.sql;
  }
  
  if (normalizedLang.includes('html') || normalizedLang.includes('xml')) {
    return LANGUAGE_CONFIGS.html;
  }
  
  if (normalizedLang.includes('css')) {
    return LANGUAGE_CONFIGS.css;
  }
  
  // Return default configuration
  return LANGUAGE_CONFIGS.default;
}

/**
 * Detect regions using regex patterns
 * @param {string} line - The line to analyze
 * @param {string} language - The language identifier
 * @returns {Array<Object>} Array of regions with type and positions
 */
export function detectWithRegex(line, language) {
  const config = getLanguageConfig(language);
  const regions = [];
  let index = 0;
  
  while (index < line.length) {
    // Check if we're inside a string first
    let inString = false;
    let stringEnd = -1;
    
    for (const stringConfig of config.strings) {
      const startMatch = line.indexOf(stringConfig.start, index);
      if (startMatch === index || (startMatch > index && startMatch < stringEnd)) {
        inString = true;
        
        // Find the end of the string
        let endIndex = findStringEnd(line, startMatch, stringConfig);
        if (endIndex !== -1) {
          stringEnd = endIndex + stringConfig.end.length;
          
          // Add string region
          regions.push({
            type: REGION_TYPES.STRING,
            start: startMatch,
            end: stringEnd,
            content: line.substring(startMatch, stringEnd)
          });
          
          // Move index past this string
          index = stringEnd;
          break;
        }
      }
    }
    
    if (inString && stringEnd !== -1) {
      continue;
    }
    
    // Check for comments (only if not in string)
    let foundComment = false;
    
    // Check line comments
    for (const lineComment of config.lineComments) {
      if (line.startsWith(lineComment, index)) {
        regions.push({
          type: REGION_TYPES.COMMENT,
          start: index,
          end: line.length,
          content: line.substring(index)
        });
        index = line.length;
        foundComment = true;
        break;
      }
    }
    
    if (foundComment) continue;
    
    // Check block comments
    for (const [startComment, endComment] of config.blockComments) {
      const startMatch = line.indexOf(startComment, index);
      if (startMatch === index) {
        const endMatch = line.indexOf(endComment, startComment.length);
        if (endMatch !== -1) {
          const endIndex = endMatch + endComment.length;
          regions.push({
            type: REGION_TYPES.COMMENT,
            start: startMatch,
            end: endIndex,
            content: line.substring(startMatch, endIndex)
          });
          index = endIndex;
        } else {
          // Block comment not closed on this line
          regions.push({
            type: REGION_TYPES.COMMENT,
            start: startMatch,
            end: line.length,
            content: line.substring(startMatch)
          });
          index = line.length;
        }
        foundComment = true;
        break;
      }
    }
    
    if (foundComment) continue;
    
    // Move to next character
    index++;
  }
  
  return regions;
}

/**
 * Find the end of a string literal
 * @param {string} line - The line being analyzed
 * @param {number} startIndex - Starting index of the string
 * @param {Object} stringConfig - String configuration
 * @returns {number} Index of the end of the string, or -1 if not found
 */
function findStringEnd(line, startIndex, stringConfig) {
  const { start, end, escape, multiline, raw } = stringConfig;
  let index = startIndex + start.length;
  const endIndex = line.indexOf(end, index);
  
  if (endIndex === -1) {
    return -1;
  }
  
  // For raw strings or when escape is disabled, return first match
  if (raw || escape === false) {
    return endIndex;
  }
  
  // For escaped strings, check if the end is escaped
  while (endIndex !== -1) {
    let escapeCount = 0;
    let checkIndex = endIndex - 1;
    
    // Count consecutive escape characters
    while (checkIndex >= index && line[checkIndex] === escape) {
      escapeCount++;
      checkIndex--;
    }
    
    // If even number of escapes, this is the real end
    if (escapeCount % 2 === 0) {
      return endIndex;
    }
    
    // Odd number of escapes means the end is escaped, look for next
    index = endIndex + end.length;
    const nextEnd = line.indexOf(end, index);
    if (nextEnd === -1) {
      return -1;
    }
    return nextEnd;
  }
  
  return -1;
}

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detect comment and string regions in a line
 * @param {string} line - The line to analyze
 * @param {string} language - The programming language (optional)
 * @returns {Array<Object>} Array of regions with type and positions
 */
export function detectRegions(line, language = null) {
  if (!line || typeof line !== 'string') {
    return [];
  }
  
  // Try tree-sitter first if available
  if (isTreeSitterAvailable() && language) {
    try {
      const treeSitterRegions = detectWithTreeSitter(line, language);
      if (treeSitterRegions && treeSitterRegions.length > 0) {
        return treeSitterRegions;
      }
    } catch (error) {
      console.warn('Tree-sitter detection failed, falling back to regex:', error);
    }
  }
  
  // Fallback to regex detection
  return detectWithRegex(line, language);
}

/**
 * Get the type of region at a specific position
 * @param {string} line - The line to analyze
 * @param {number} position - Position in the line
 * @param {string} language - The programming language (optional)
 * @returns {string} Region type at the position
 */
export function getRegionTypeAt(line, position, language = null) {
  const regions = detectRegions(line, language);
  
  for (const region of regions) {
    if (position >= region.start && position < region.end) {
      return region.type;
    }
  }
  
  return REGION_TYPES.CODE;
}

/**
 * Check if a position is inside a comment
 * @param {string} line - The line to analyze
 * @param {number} position - Position in the line
 * @param {string} language - The programming language (optional)
 * @returns {boolean} True if position is inside a comment
 */
export function isInsideComment(line, position, language = null) {
  return getRegionTypeAt(line, position, language) === REGION_TYPES.COMMENT;
}

/**
 * Check if a position is inside a string
 * @param {string} line - The line to analyze
 * @param {number} position - Position in the line
 * @param {string} language - The programming language (optional)
 * @returns {boolean} True if position is inside a string
 */
export function isInsideString(line, position, language = null) {
  return getRegionTypeAt(line, position, language) === REGION_TYPES.STRING;
}

/**
 * Strip comments from a line
 * @param {string} line - The line to process
 * @param {string} language - The programming language (optional)
 * @returns {string} Line with comments removed
 */
export function stripCommentsFromLine(line, language = null) {
  const regions = detectRegions(line, language);
  let result = line;
  
  // Remove comment regions, starting from the end to preserve indices
  const commentRegions = regions
    .filter(r => r.type === REGION_TYPES.COMMENT)
    .sort((a, b) => b.start - a.start);
  
  for (const region of commentRegions) {
    result = result.substring(0, region.start) + result.substring(region.end);
  }
  
  return result;
}

/**
 * Get all supported languages
 * @returns {Array<string>} Array of supported language identifiers
 */
export function getSupportedLanguages() {
  return Object.keys(LANGUAGE_CONFIGS).filter(lang => lang !== 'default');
}

export default {
  detectRegions,
  getRegionTypeAt,
  isInsideComment,
  isInsideString,
  stripCommentsFromLine,
  getSupportedLanguages,
  REGION_TYPES,
  isTreeSitterAvailable,
  detectWithTreeSitter,
  detectWithRegex
};