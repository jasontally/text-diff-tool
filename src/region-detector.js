/**
 * Region Detector Module
 * 
 * Identifies comment and string regions in code lines.
 * Uses tree-sitter for accurate parsing when available, with regex fallback.
 * 
 * Copyright (c) 2026 Jason Tally and contributors
 * SPDX-License-Identifier: MIT
 */

// ============================================================================
// Tree-sitter Integration
// ============================================================================

import { isTreeSitterAvailable, getLanguageParser, isLanguageSupported } from './tree-sitter-loader.js';

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
// Tree-sitter Region Detection
// ============================================================================

/**
 * Detect regions using tree-sitter parsing
 * @param {string} line - The line to analyze
 * @param {string} language - The language identifier
 * @returns {Promise<Array<Object>>} Array of regions with type and positions
 */
async function detectWithTreeSitter(line, language) {
  try {
    // Get parser for the language
    const parser = await getLanguageParser(language);
    if (!parser) {
      return null;
    }
    
    // Parse the line
    const tree = parser.parse(line);
    if (!tree) {
      return null;
    }
    
    // Walk the tree to find comment and string nodes
    const regions = [];
    const cursor = tree.walk();
    
    // Traverse the tree
    function traverse() {
      const node = cursor.currentNode;
      const nodeType = node.type;
      
      // Check if node is a comment or string
      const regionType = getTreeSitterNodeType(nodeType, language);
      if (regionType) {
        regions.push({
          type: regionType,
          start: node.startIndex,
          end: node.endIndex,
          content: line.slice(node.startIndex, node.endIndex)
        });
      }
      
      // Visit children
      if (cursor.gotoFirstChild()) {
        do {
          traverse();
        } while (cursor.gotoNextSibling());
        cursor.gotoParent();
      }
    }
    
    traverse();
    tree.delete();
    
    // Sort regions by start position
    regions.sort((a, b) => a.start - b.start);
    
    // Fill in gaps with CODE regions
    return fillCodeGaps(regions, line);
  } catch (error) {
    console.warn('[RegionDetector] Tree-sitter detection failed:', error.message);
    return null;
  }
}

/**
 * Get region type from tree-sitter node type
 * @param {string} nodeType - Tree-sitter node type
 * @param {string} language - Language identifier
 * @returns {string|null} Region type or null if not a comment/string
 */
function getTreeSitterNodeType(nodeType, language) {
  // Common comment node types across languages
  const commentTypes = [
    'comment',
    'line_comment',
    'block_comment',
    'multi_line_comment',
    'documentation_comment',
    'hash_comment',  // Python, Ruby
    'html_comment',  // HTML/XML
  ];
  
  // Common string node types
  const stringTypes = [
    'string',
    'string_literal',
    'single_quote_string',
    'double_quote_string',
    'template_string',
    'heredoc',
    'character',
    'raw_string',
    'format_string',
  ];
  
  if (commentTypes.includes(nodeType)) {
    return REGION_TYPES.COMMENT;
  }
  
  if (stringTypes.includes(nodeType)) {
    return REGION_TYPES.STRING;
  }
  
  // Language-specific patterns
  if (language === 'python') {
    if (nodeType === 'comment' || nodeType === 'hash_comment') return REGION_TYPES.COMMENT;
    if (nodeType === 'string' || nodeType === 'concatenated_string') return REGION_TYPES.STRING;
  }
  
  if (language === 'javascript' || language === 'typescript') {
    if (nodeType === 'comment') return REGION_TYPES.COMMENT;
    if (nodeType === 'string' || nodeType === 'template_string' || nodeType === 'regex') {
      return REGION_TYPES.STRING;
    }
  }
  
  if (language === 'bash' || language === 'shell') {
    if (nodeType === 'comment') return REGION_TYPES.COMMENT;
    if (nodeType === 'string' || nodeType === 'raw_string') return REGION_TYPES.STRING;
  }
  
  return null;
}

/**
 * Fill gaps between regions with CODE type
 * @param {Array<Object>} regions - Sorted regions
 * @param {string} line - Original line
 * @returns {Array<Object>} Complete region list including code gaps
 */
function fillCodeGaps(regions, line) {
  if (regions.length === 0) {
    return [{ type: REGION_TYPES.CODE, start: 0, end: line.length, content: line }];
  }
  
  const result = [];
  let currentPos = 0;
  
  for (const region of regions) {
    // Add code region before this region if there's a gap
    if (region.start > currentPos) {
      result.push({
        type: REGION_TYPES.CODE,
        start: currentPos,
        end: region.start,
        content: line.slice(currentPos, region.start)
      });
    }
    
    // Add the region itself
    result.push(region);
    currentPos = region.end;
  }
  
  // Add final code region if needed
  if (currentPos < line.length) {
    result.push({
      type: REGION_TYPES.CODE,
      start: currentPos,
      end: line.length,
      content: line.slice(currentPos)
    });
  }
  
  return result;
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
 * @returns {Promise<Array<Object>>} Array of regions with type and positions
 */
export async function detectRegions(line, language = null) {
  if (!line || typeof line !== 'string') {
    return [];
  }
  
  // Try tree-sitter first if available and language is supported
  if (language && isLanguageSupported(language)) {
    try {
      const treeSitterAvailable = await isTreeSitterAvailable();
      if (treeSitterAvailable) {
        const treeSitterRegions = await detectWithTreeSitter(line, language);
        if (treeSitterRegions && treeSitterRegions.length > 0) {
          return treeSitterRegions;
        }
      }
    } catch (error) {
      console.warn('[RegionDetector] Tree-sitter detection failed, falling back to regex:', error.message);
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
 * @returns {Promise<string>} Region type at the position
 */
export async function getRegionTypeAt(line, position, language = null) {
  const regions = await detectRegions(line, language);
  
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
 * @returns {Promise<boolean>} True if position is inside a comment
 */
export async function isInsideComment(line, position, language = null) {
  const type = await getRegionTypeAt(line, position, language);
  return type === REGION_TYPES.COMMENT;
}

/**
 * Check if a position is inside a string
 * @param {string} line - The line to analyze
 * @param {number} position - Position in the line
 * @param {string} language - The programming language (optional)
 * @returns {Promise<boolean>} True if position is inside a string
 */
export async function isInsideString(line, position, language = null) {
  const type = await getRegionTypeAt(line, position, language);
  return type === REGION_TYPES.STRING;
}

/**
 * Strip comments from a line
 * @param {string} line - The line to process
 * @param {string} language - The programming language (optional)
 * @returns {string} Line with comments removed
 */
export async function stripCommentsFromLine(line, language = null) {
  const regions = await detectRegions(line, language);
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
  detectWithRegex
};