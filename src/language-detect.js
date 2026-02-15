/**
 * Language Detection Module
 * 
 * Detects programming language from file extension and/or content.
 * Maps detected languages to Tree-sitter language identifiers.
 * 
 * Uses highlight.js for robust content-based detection (browser only).
 * Falls back to regex-based detection in Node.js.
 * 
 * Copyright (c) 2026 Jason Tally and contributors
 * SPDX-License-Identifier: MIT
 */

let hljs = null;

// Supported languages for AST parsing - must be kept in sync with tree-sitter-loader.js
// Defined here to avoid importing tree-sitter-loader (which has browser-only CDN imports)
const DETECTABLE_LANGUAGES = [
  'javascript', 'typescript', 'tsx', 'python', 'json', 'html', 'css',
  'go', 'rust', 'java', 'c', 'cpp', 'yaml', 'bash', 'regex'
];

/**
 * Map file extensions to Tree-sitter language identifiers
 */
const EXTENSION_MAP = {
  // JavaScript/TypeScript
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.mts': 'typescript',
  '.cts': 'typescript',
  
  // Python
  '.py': 'python',
  '.pyw': 'python',
  '.pyi': 'python',
  '.pyc': null, // Don't parse compiled Python
  
  // JSON
  '.json': 'json',
  '.jsonc': 'json', // JSON with comments
  
  // Web
  '.html': 'html',
  '.htm': 'html',
  '.xhtml': 'html',
  '.css': 'css',
  '.scss': 'css',
  '.sass': 'css',
  '.less': 'css',
  
  // Go
  '.go': 'go',
  
  // Rust
  '.rs': 'rust',
  
  // Java
  '.java': 'java',
  
  // C/C++
  '.c': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.hxx': 'cpp',
  
  // Data/Config
  '.yml': 'yaml',
  '.yaml': 'yaml',
  
  // Shell
  '.sh': 'bash',
  '.bash': 'bash',
  '.zsh': 'bash',
  '.fish': 'bash',
  
  // Other
  '.regex': 'regex',
  '.regexp': 'regex',
};

/**
 * Map highlight.js language names to app's language identifiers
 */
const HLJS_LANGUAGE_MAP = {
  'javascript': 'javascript',
  'typescript': 'typescript',
  'python': 'python',
  'bash': 'bash',
  'shell': 'bash',
  'go': 'go',
  'rust': 'rust',
  'java': 'java',
  'json': 'json',
  'html': 'html',
  'xml': 'html',
  'css': 'css',
  'yaml': 'yaml',
  'c': 'c',
  'cpp': 'cpp',
  'c++': 'cpp',
};

/**
 * Initialize highlight.js (browser only)
 */
async function initHighlightJS() {
  if (hljs) return hljs;
  
  // Only load in browser environment
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }
  
  try {
    hljs = await import('https://esm.sh/highlight.js@11.9.0');
    hljs = hljs.default;
    return hljs;
  } catch (error) {
    console.warn('[LanguageDetect] Failed to load highlight.js:', error.message);
    return null;
  }
}

/**
 * Detect language using highlight.js auto-detection
 */
function detectLanguageWithHighlightJS(content) {
  if (!content || content.trim().length < 10) {
    return null;
  }
  
  // Try to load highlight.js if not already loaded
  if (!hljs && typeof window !== 'undefined') {
    // Synchronous check won't work for dynamic import, so we skip for now
    // and let the async init happen on first use
    return null;
  }
  
  if (!hljs) {
    return null;
  }
  
  try {
    const result = hljs.highlightAuto(content);
    if (result.language && result.confidence >= 70) {
      const mapped = HLJS_LANGUAGE_MAP[result.language];
      if (mapped && DETECTABLE_LANGUAGES.includes(mapped)) {
        return mapped;
      }
    }
  } catch (error) {
    console.warn('[LanguageDetect] highlight.js detection failed:', error.message);
  }
  
  return null;
}

/**
 * Initialize highlight.js and return promise (async)
 */
export async function initLanguageDetection() {
  await initHighlightJS();
}

/**
 * Content-based detection patterns
 * Each pattern returns the language if matched, null otherwise
 */
const CONTENT_DETECTORS = [
  {
    language: 'json',
    test: (content) => {
      const trimmed = content.trim();
      if (!trimmed) return false;
      
      // Check if valid JSON
      if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && 
          isValidJSON(trimmed)) {
        return true;
      }
      return false;
    }
  },
  {
    language: 'typescript',
    test: (content) => {
      // TypeScript-specific patterns (in addition to JS patterns)
      const tsPatterns = [
        /:\s*(string|number|boolean|any|void|never)\s*[=;)]/m,
        /\binterface\s+\w+\s*\{/m,
        /\btype\s+\w+\s*=/m,
        /\b(enum|namespace|module)\s+\w+/m,
        /<\w+(,\s*\w+)*>/m,  // Generic type parameters
      ];
      
      // Must have JS patterns AND at least one TS pattern
      const jsScore = [
        /\b(const|let|var)\s+/m,
        /\bfunction\s+/m,
        /\b(import|export)\b/m,
      ].reduce((count, pattern) => count + (pattern.test(content) ? 1 : 0), 0);
      
      const tsScore = tsPatterns.reduce((count, pattern) => {
        return count + (pattern.test(content) ? 1 : 0);
      }, 0);
      
      return jsScore >= 1 && tsScore >= 1;
    }
  },
  {
    language: 'javascript',
    test: (content) => {
      // JavaScript/TypeScript patterns - more specific to avoid false positives with Java
      const patterns = [
        /\b(const|let|var)\s+[\w_$]+\s*[=:]/m,  // const/let/var assignment
        /\bfunction\s+[\w_$]+\s*\(/m,           // function declaration (not class)
        /\bclass\s+[\w_$]+\s*\{/m,               // class with brace (JS style, no public/protected)
        /\b(import|export)\s+\{/m,               // ES modules
        /\basync\s+function\b/m,                 // async function
        /\bawait\s+/m,                          // await keyword
        /=>/m,                                   // arrow functions
        /\bconsole\.(log|error|warn|info)\b/m,   // console methods
        /\bdocument\.\w+\(/m,                    // DOM methods
      ];
      
      const score = patterns.reduce((count, pattern) => {
        return count + (pattern.test(content) ? 1 : 0);
      }, 0);
      
      // Exclude Java-specific patterns
      const hasPublicClass = /\bpublic\s+class\b/.test(content);
      const hasPrivateField = /\bprivate\s+\w+\s+\w+;/.test(content);
      const hasSystemOut = /\bSystem\.(out|err)\./.test(content);
      const hasJavaImport = /\bimport\s+java\./.test(content);
      const isJavaCode = hasPublicClass || hasPrivateField || hasSystemOut || hasJavaImport;
      
      if (isJavaCode) return false;
      
      // Exclude TypeScript-specific patterns
      const hasTypeAnnotation = /:\s*(string|number|boolean|any|void|never)\s*[=;)]/.test(content);
      const hasInterface = /\binterface\s+\w+\s*\{/.test(content);
      const hasTypeAlias = /\btype\s+\w+\s*=/.test(content);
      const hasEnum = /\benum\s+\w+/.test(content);
      const isTypeScriptCode = hasTypeAnnotation || hasInterface || hasTypeAlias || hasEnum;
      
      if (isTypeScriptCode) return false;
      
      // Exclude Python-specific patterns
      const hasPythonDef = /^\s*def\s+\w+/.test(content);
      const hasPythonImport = /^\s*(import\s+\w+|from\s+\w+\s+import)/m.test(content);
      const hasPythonDecorator = /^\s*@[\w_]+/m.test(content);
      const hasPythonAsync = /^\s*async def/m.test(content);
      const isPythonCode = hasPythonDef || (hasPythonDecorator && hasPythonAsync);
      
      if (isPythonCode) return false;
      
      // Exclude Rust-specific patterns
      const hasRustFn = /\bfn\s+\w+\s*\(/m.test(content);
      const hasRustMod = /\bmod\s+\w+/.test(content);
      const hasRustUse = /\buse\s+\w+::/.test(content);
      const hasRustImpl = /\bimpl\s+/.test(content);
      const isRustCode = (hasRustFn && hasRustMod) || (hasRustFn && hasRustUse) || (hasRustFn && hasRustImpl);
      
      if (isRustCode) return false;
      
      // Check for JS/TS comment styles
      const hasJsLineComment = /\/\/\s*\w+/.test(content); // // comment style
      const hasJsBlockComment = /\/\*[\s\S]*?\*\//.test(content); // /* */ comment style
      const hasHashComment = / #\s*\w+/.test(content); // # comment (Python)
      
       // Require 2+ patterns for reliable detection
      return score >= 2;
    }
  },
  {
    language: 'bash',
    test: (content) => {
      // Check shebang first (strong indicator)
      // Use [#] to avoid parsing issues with #! sequence
      if (/^[#]!\/bin\/(bash|sh|zsh|dash)/m.test(content)) {
        return true;
      }
      
      const patterns = [
        /^\s*(if|then|else|elif|fi)\s*$/m,
        /^\s*(for|while|do|done)\s*$/m,
        /^\s*echo\s+/m,
        /\$\w+/m,  // Variables
        /\$\{\w+\}/m,  // Variable expansion
        /^\s*export\s+\w+=/m,
      ];
      
      const score = patterns.reduce((count, pattern) => {
        return count + (pattern.test(content) ? 1 : 0);
      }, 0);
      
      return score >= 2;
    }
  },
  {
    language: 'python',
    test: (content) => {
      // Python-specific patterns - be more specific to avoid Java conflicts
      const patterns = [
        /^\s*def\s+\w+\s*\(/m,  // def function()
        /^\s*class\s+\w+.*:/m,  // class MyClass: (with colon like Python)
        /^\s*import\s+(?!java\b)\w/m,  // Import statements (exclude Java imports)
        /^\s*from\s+\w+\s+import/m,  // From imports (Python specific syntax)
        /^\s*if __name__\s*==\s*['"]__main__['"]\s*:/m,
        /^\s*async def/m,  // async def
        /^\s*(try|except|finally|raise)\s*:/m,
        /^\s*print\s*\(/m,  // print function (at start of line)
        /^\s*#.*$/m,  // Comment at start of line (with leading whitespace)
      ];
      
      const score = patterns.reduce((count, pattern) => {
        return count + (pattern.test(content) ? 1 : 0);
      }, 0);
      
      // Require 2+ patterns to avoid false positives
      return score >= 2;
    }
  },
  {
    language: 'go',
    test: (content) => {
      const patterns = [
        /^\s*package\s+\w+/m,
        /^\s*func\s+\w+/m,
        /^\s*import\s*\(/m,
        /\bdefer\s+/m,
        /\bgo\s+\w+\(/m,
        /\bchan\s+/m,
      ];
      
      const score = patterns.reduce((count, pattern) => {
        return count + (pattern.test(content) ? 1 : 0);
      }, 0);
      
      return score >= 2;
    }
  },
  {
    language: 'rust',
    test: (content) => {
      const patterns = [
        /\bfn\s+\w+\s*\(/m,
        /\blet\s+mut\s+/m,
        /\bimpl\s+/m,
        /\buse\s+\w+::/m,
        /\bmod\s+\w+/m,
        /\bpub\s+(fn|struct|enum|trait)/m,
        /\bmatch\s+/m,
      ];
      
      const score = patterns.reduce((count, pattern) => {
        return count + (pattern.test(content) ? 1 : 0);
      }, 0);
      
      return score >= 2;
    }
  },
  {
    language: 'java',
    test: (content) => {
      const patterns = [
        /\bpublic\s+class\s+\w+/m,
        /\bprivate\s+\w+\s+\w+\s*;/m,
        /\bSystem\.(out|err)\./m,
        /\bimport\s+java\./m,
        /@\w+\s*$/m,  // Annotations
      ];
      
      const score = patterns.reduce((count, pattern) => {
        return count + (pattern.test(content) ? 1 : 0);
      }, 0);
      
      return score >= 2;
    }
  },
  {
    language: 'yaml',
    test: (content) => {
      const patterns = [
        /^---\s*$/m,
        /^\w+:\s*\w/m,
        /^\s+-\s+\w/m,  // Array items
        /^\w+:\s*$/m,   // Key with no value yet
      ];
      
      const score = patterns.reduce((count, pattern) => {
        return count + (pattern.test(content) ? 1 : 0);
      }, 0);
      
      return score >= 2;
    }
  },
  {
    language: 'html',
    test: (content) => {
      // Must look like HTML, not just have < > characters
      const patterns = [
        /<(!DOCTYPE|html|head|body|div|span|p|a|img)\b/i,
        /<\w+\s+\w+\s*=\s*["'][^"']*["']/i,  // Attributes
        /<\/\w+>/i,  // Closing tags
      ];
      
      const score = patterns.reduce((count, pattern) => {
        return count + (pattern.test(content) ? 1 : 0);
      }, 0);
      
      return score >= 2;
    }
  },
];

/**
 * Validate JSON string
 * 
 * @param {string} str - String to validate
 * @returns {boolean}
 */
function isValidJSON(str) {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect language from filename and/or content
 * Returns null if language not detected or not supported
 * 
 * @param {string} filename - Filename (optional)
 * @param {string} content - File content (optional)
 * @returns {string|null} Tree-sitter language identifier or null
 */
export function detectLanguage(filename = '', content = '') {
  // Method 1: File extension (fastest, most reliable)
  if (filename) {
    const ext = getFileExtension(filename);
    if (ext) {
      const lang = EXTENSION_MAP[ext.toLowerCase()];
      if (lang && DETECTABLE_LANGUAGES.includes(lang)) {
        return lang;
      }
    }
  }
  
  // Method 2: highlight.js auto-detection (more robust than regex)
  if (content && content.trim().length >= 10) {
    const hljsResult = detectLanguageWithHighlightJS(content);
    if (hljsResult) {
      return hljsResult;
    }
  }
  
  // Method 3: Regex-based content detection (fallback)
  if (content && content.trim().length > 0) {
    for (const detector of CONTENT_DETECTORS) {
      if (DETECTABLE_LANGUAGES.includes(detector.language)) {
        try {
          const result = detector.test(content);
          if (result) {
            return detector.language;
          }
        } catch (error) {
          console.warn(`[LanguageDetect] Detector ${detector.language} failed:`, error);
        }
      }
    }
  }
  
  // No language detected
  return null;
}

/**
 * Async language detection using tree-sitter parsers
 * More accurate than regex-based detection
 * 
 * @param {string} filename - Filename (optional)
 * @param {string} content - File content (optional)
 * @returns {Promise<string|null>} Detected language or null
 */
export async function detectLanguageAsync(filename = '', content = '') {
  // First try synchronous detection (extension + regex)
  const syncResult = detectLanguage(filename, content);
  if (syncResult) {
    return syncResult;
  }
  
  // Fall back to tree-sitter detection only for longer content
  // Short snippets may not have enough patterns, but still try for content 30+ chars
  if (!content || content.trim().length < 30) {
    return null;
  }
  
  try {
    // Dynamic import to avoid issues in Node.js
    const loader = await import('./tree-sitter-loader.js');
    const { isTreeSitterAvailable, detectLanguageWithTreeSitter } = loader;
    
    const available = await isTreeSitterAvailable();
    if (!available) {
      return null;
    }
    
    const detected = await detectLanguageWithTreeSitter(content);
    if (detected && DETECTABLE_LANGUAGES.includes(detected)) {
      return detected;
    }
  } catch (error) {
    console.warn('[LanguageDetect] Tree-sitter detection failed:', error.message);
  }
  
  return null;
}

/**
 * Get file extension from filename
 * Handles compound extensions like .d.ts
 * 
 * @param {string} filename 
 * @returns {string|null}
 */
function getFileExtension(filename) {
  if (!filename || typeof filename !== 'string') {
    return null;
  }
  
  const lower = filename.toLowerCase();
  
  // Handle special compound extensions first
  if (lower.endsWith('.d.ts')) return '.d.ts';
  if (lower.endsWith('.test.js')) return '.js';
  if (lower.endsWith('.spec.js')) return '.js';
  if (lower.endsWith('.test.ts')) return '.ts';
  if (lower.endsWith('.spec.ts')) return '.ts';
  
  // Standard extension extraction
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0) {
    return null;
  }
  
  return filename.slice(lastDot).toLowerCase();
}

/**
 * Detect language from both sides of a comparison
 * Returns common language if both match, null otherwise
 * 
 * @param {string} filenameA - Filename A
 * @param {string} filenameB - Filename B  
 * @param {string} contentA - Content A
 * @param {string} contentB - Content B
 * @returns {string|null} Common language or null
 */
export function detectCommonLanguage(filenameA = '', filenameB = '', contentA = '', contentB = '') {
  const langA = detectLanguage(filenameA, contentA);
  const langB = detectLanguage(filenameB, contentB);
  
  // If both detected and match, return that language
  if (langA && langB && langA === langB) {
    return langA;
  }
  
  // If only one detected, use that (file might be new/empty)
  if (langA && !langB) return langA;
  if (langB && !langA) return langB;
  
  // If both detected but different, prefer null over making a wrong guess
  // But for nested highlighting, any detection is better than none - use the one with higher confidence
  if (langA && langB && langA !== langB) {
    // Prefer languages that have stronger indicators
    // JavaScript gets priority when there's console.* or document.*
    if (contentA.includes('console.') || contentA.includes('document.') || 
        contentB.includes('console.') || contentB.includes('document.')) {
      return 'javascript';
    }
    console.warn(`[LanguageDetect] Mismatched languages: ${langA} vs ${langB}`);
    return null;
  }
  
  return null;
}

/**
 * Get a list of supported file extensions
 * 
 * @returns {Array<string>}
 */
export function getSupportedExtensions() {
  return Object.keys(EXTENSION_MAP);
}

/**
 * Check if a language is supported by Tree-sitter
 * 
 * @param {string} language 
 * @returns {boolean}
 */
export function isLanguageSupported(language) {
  return DETECTABLE_LANGUAGES.includes(language);
}

/**
 * Get detection details for debugging
 * 
 * @param {string} filename 
 * @param {string} content 
 * @returns {Object}
 */
export function getDetectionDetails(filename = '', content = '') {
  const extension = getFileExtension(filename);
  const extLanguage = extension ? EXTENSION_MAP[extension.toLowerCase()] : null;
  
  const contentMatches = [];
  for (const detector of CONTENT_DETECTORS) {
    try {
      const matched = detector.test(content);
      contentMatches.push({
        language: detector.language,
        matched
      });
    } catch (error) {
      contentMatches.push({
        language: detector.language,
        matched: false,
        error: error.message
      });
    }
  }
  
  return {
    filename,
    extension,
    extensionLanguage: extLanguage,
    contentLanguage: detectLanguage('', content),
    finalLanguage: detectLanguage(filename, content),
    contentMatches,
    supported: isLanguageSupported(detectLanguage(filename, content))
  };
}

export default {
  detectLanguage,
  detectCommonLanguage,
  getSupportedExtensions,
  isLanguageSupported,
  getDetectionDetails,
  EXTENSION_MAP
};
