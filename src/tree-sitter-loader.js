/**
 * Tree-sitter Loader Module
 * 
 * Manages loading and initialization of web-tree-sitter and language grammars.
 * Handles WASM loading, caching, and error recovery.
 * 
 * Copyright (c) 2026 Jason Tally and contributors
 * SPDX-License-Identifier: MIT
 */

let Parser = null;
let Language = null;
let Query = null;
let isInitializing = false;
let initPromise = null;

// Cache for loaded language parsers
const languageCache = new Map();

// CDN URLs for language WASM files
// Using @latest for most languages as they have working WASM files
// YAML is only available via tree-sitter-wasms package
const LANGUAGE_URLS = {
  javascript: 'https://cdn.jsdelivr.net/npm/tree-sitter-javascript@latest/tree-sitter-javascript.wasm',
  typescript: 'https://cdn.jsdelivr.net/npm/tree-sitter-typescript@latest/tree-sitter-typescript.wasm',
  tsx: 'https://cdn.jsdelivr.net/npm/tree-sitter-typescript@latest/tree-sitter-tsx.wasm',
  python: 'https://cdn.jsdelivr.net/npm/tree-sitter-python@latest/tree-sitter-python.wasm',
  json: 'https://cdn.jsdelivr.net/npm/tree-sitter-json@latest/tree-sitter-json.wasm',
  html: 'https://cdn.jsdelivr.net/npm/tree-sitter-html@latest/tree-sitter-html.wasm',
  css: 'https://cdn.jsdelivr.net/npm/tree-sitter-css@latest/tree-sitter-css.wasm',
  go: 'https://cdn.jsdelivr.net/npm/tree-sitter-go@latest/tree-sitter-go.wasm',
  rust: 'https://cdn.jsdelivr.net/npm/tree-sitter-rust@latest/tree-sitter-rust.wasm',
  java: 'https://cdn.jsdelivr.net/npm/tree-sitter-java@latest/tree-sitter-java.wasm',
  c: 'https://cdn.jsdelivr.net/npm/tree-sitter-c@latest/tree-sitter-c.wasm',
  cpp: 'https://cdn.jsdelivr.net/npm/tree-sitter-cpp@latest/tree-sitter-cpp.wasm',
  yaml: 'https://cdn.jsdelivr.net/npm/tree-sitter-wasms@0.1.13/out/tree-sitter-yaml.wasm',
  bash: 'https://cdn.jsdelivr.net/npm/tree-sitter-bash@latest/tree-sitter-bash.wasm',
  regex: 'https://cdn.jsdelivr.net/npm/tree-sitter-regex@latest/tree-sitter-regex.wasm',
};

// Supported languages list
export const SUPPORTED_LANGUAGES = Object.keys(LANGUAGE_URLS);

/**
 * Check if we're in a browser environment with WebAssembly support
 * @returns {boolean}
 */
function isBrowserEnvironment() {
  return (
    (typeof window !== 'undefined' || typeof self !== 'undefined') && 
    typeof WebAssembly !== 'undefined'
  );
}

/**
 * Initialize Tree-sitter core library
 * This must be called before any parsing operations
 * 
 * @returns {Promise<Object>} The Parser class
 * @throws {Error} If initialization fails
 */
export async function initTreeSitter() {
  // Return cached parser if already initialized
  if (Parser) {
    return Parser;
  }
  
  // Return existing promise if initialization is in progress
  if (isInitializing && initPromise) {
    return initPromise;
  }
  
  // Check if we're in a browser environment
  if (!isBrowserEnvironment()) {
    throw new Error('Tree-sitter is only available in browser environments with WebAssembly support');
  }
  
  isInitializing = true;
  
  initPromise = (async () => {
    try {
      // Dynamically import web-tree-sitter from CDN
      // URL is split to prevent static analysis from trying to validate the CDN import in Node.js
      const cdnBase = 'https://cdn.jsdelivr.net/npm/web-tree-sitter@0.25.10';
      const cdnPath = '/+esm';
      const module = await import(cdnBase + cdnPath);
      Parser = module.Parser;
      Language = module.Language;
      Query = module.Query;
      
      if (!Parser) {
        throw new Error('Failed to load Parser from web-tree-sitter module');
      }
      
      if (!Language) {
        throw new Error('Failed to load Language from web-tree-sitter module');
      }
      
      if (!Query) {
        console.warn('[TreeSitter] Query class not available, syntax highlighting will use fallback');
      }
      
      // Initialize the WASM runtime
      await Parser.init();
      
      console.log('[TreeSitter] Initialized successfully');
      return Parser;
    } catch (error) {
      console.error('[TreeSitter] Initialization failed:', error);
      throw new Error(`Tree-sitter initialization failed: ${error.message}`);
    } finally {
      isInitializing = false;
    }
  })();
  
  return initPromise;
}

/**
 * Load a language parser
 * Languages are lazy-loaded and cached for reuse
 * 
 * @param {string} language - Language identifier (e.g., 'javascript', 'python')
 * @returns {Promise<Object>} Configured parser for the language
 * @throws {Error} If language not supported or loading fails
 */
export async function getLanguageParser(language) {
  // Check cache first
  if (languageCache.has(language)) {
    return languageCache.get(language);
  }
  
  // Validate language support
  const wasmUrl = LANGUAGE_URLS[language];
  if (!wasmUrl) {
    throw new Error(`Language '${language}' is not supported. Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}`);
  }
  
  try {
    // Ensure Tree-sitter is initialized
    const Parser = await initTreeSitter();
    
    // Load the language WASM
    console.log(`[TreeSitter] Loading language: ${language} from ${wasmUrl}`);
    const lang = await Language.load(wasmUrl);
    
    if (!lang) {
      throw new Error(`Failed to load language ${language}: Language.load() returned null`);
    }
    
    // Create and configure parser
    const parser = new Parser();
    parser.setLanguage(lang);
    
    // Cache the parser
    languageCache.set(language, parser);
    
    console.log(`[TreeSitter] Language ${language} loaded successfully`);
    return parser;
  } catch (error) {
    console.error(`[TreeSitter] Failed to load language ${language}:`, error);
    
    // Provide helpful error messages for common issues
    if (error.message.includes('MIME type')) {
      throw new Error(
        `Failed to load ${language} grammar: WASM file must be served with 'application/wasm' MIME type. ` +
        `If running locally, ensure your server is configured correctly.`
      );
    }
    
    if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
      throw new Error(
        `Failed to load ${language} grammar: Network error. ` +
        `Check your internet connection and CORS settings.`
      );
    }
    
    throw new Error(`Failed to load ${language} parser: ${error.message}`);
  }
}

/**
 * Pre-load multiple languages in parallel
 * Useful for warming up the cache
 * 
 * @param {Array<string>} languages - Array of language identifiers
 * @returns {Promise<Array<Object>>} Array of loaded parsers
 */
export async function preloadLanguages(languages) {
  const promises = languages.map(lang => 
    getLanguageParser(lang).catch(error => {
      console.warn(`[TreeSitter] Failed to preload ${lang}:`, error);
      return null;
    })
  );
  
  return Promise.all(promises);
}

/**
 * Check if a language is supported
 * 
 * @param {string} language - Language identifier
 * @returns {boolean}
 */
export function isLanguageSupported(language) {
  return LANGUAGE_URLS.hasOwnProperty(language);
}

/**
 * Get list of supported languages
 * 
 * @returns {Array<string>}
 */
export function getSupportedLanguages() {
  return [...SUPPORTED_LANGUAGES];
}

/**
 * Get the Query class for creating Tree-sitter queries
 * 
 * @returns {Function|null} The Query constructor class
 */
export function getQueryClass() {
  return Query;
}

/**
 * Clear language cache
 * Useful for memory management in long-running applications
 */
export function clearLanguageCache() {
  // Note: Tree-sitter parsers don't have an explicit cleanup method,
  // but we can clear our cache to allow GC
  languageCache.clear();
  console.log('[TreeSitter] Language cache cleared');
}

/**
 * Get cache statistics
 * 
 * @returns {Object}
 */
export function getCacheStats() {
  return {
    cachedLanguages: Array.from(languageCache.keys()),
    cacheSize: languageCache.size,
    isInitialized: !!Parser
  };
}

/**
 * Check if Tree-sitter is available in this environment
 * Tests for WebAssembly support and basic functionality
 * 
 * @returns {Promise<boolean>}
 */
export async function isTreeSitterAvailable() {
  try {
    // Check WebAssembly support
    if (typeof WebAssembly === 'undefined') {
      return false;
    }
    
    // Try to initialize
    await initTreeSitter();
    return true;
  } catch (error) {
    console.warn('[TreeSitter] Not available:', error.message);
    return false;
  }
}

/**
 * Detect language by attempting to parse with tree-sitter parsers
 * Returns the language with the best parse (most complete tree)
 * This is more accurate than regex-based detection for code
 * 
 * @param {string} content - Code content to analyze
 * @param {Array<string>} languages - Optional list of languages to try (default: common languages)
 * @returns {Promise<string|null>} Detected language or null
 */
export async function detectLanguageWithTreeSitter(content, languages = null) {
  if (!content || content.trim().length < 10) {
    return null;
  }
  
  const langsToTry = languages || ['javascript', 'python', 'typescript', 'java', 'go', 'rust', 'c', 'cpp', 'bash', 'json'];
  
  let bestLanguage = null;
  let bestScore = -1;
  
  for (const language of langsToTry) {
    if (!LANGUAGE_URLS[language]) continue;
    
    try {
      const parser = await getLanguageParser(language);
      if (!parser) continue;
      
      // Try to parse the content
      const tree = parser.parse(content);
      if (!tree || !tree.rootNode) continue;
      
      // Check for parse errors
      const hasError = tree.rootNode.hasError();
      const nodeCount = countNodes(tree.rootNode);
      const charCount = content.length;
      
      // Calculate a score: more nodes = better parse, penalize errors
      let score = nodeCount / Math.max(1, charCount / 10);
      if (hasError) {
        score *= 0.5; // Penalize languages with parse errors
      }
      
      // Bonus for complete parse (root node covers entire content)
      if (tree.rootNode.endIndex === content.length) {
        score *= 1.5;
      }
      
      // Bonus for specific language indicators
      if (language === 'python' && content.includes('#')) score *= 1.3; // Python comments
      if (language === 'javascript' || language === 'typescript') {
        if (/\b(const|let|var|function|class|import|export)\b/.test(content)) score *= 1.2;
      }
      if (language === 'java') {
        if (/\b(public|private|class|void|static)\b/.test(content)) score *= 1.2;
      }
      if (language === 'go') {
        if (/\b(package|func|import|type)\b/.test(content)) score *= 1.2;
      }
      if (language === 'rust') {
        if (/\b(fn|let|mut|impl|struct|enum)\b/.test(content)) score *= 1.2;
      }
      if (language === 'bash') {
        if (/^#!|\b(echo|export|if|then|fi|done)\b/.test(content)) score *= 1.3;
      }
      if (language === 'json') {
        if (/^[\[\{]/.test(content.trim())) score *= 1.5;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestLanguage = language;
      }
      
      tree.delete();
    } catch (error) {
      // Skip languages that fail to parse
      continue;
    }
  }
  
  // Only return if we have a reasonable score
  return bestScore > 0 ? bestLanguage : null;
}

/**
 * Count nodes in a tree (for scoring)
 */
function countNodes(node) {
  let count = 1;
  let child = node.firstChild;
  while (child) {
    count += countNodes(child);
    child = child.nextSibling;
  }
  return count;
}

export default {
  initTreeSitter,
  getLanguageParser,
  preloadLanguages,
  isLanguageSupported,
  getSupportedLanguages,
  clearLanguageCache,
  getCacheStats,
  isTreeSitterAvailable,
  SUPPORTED_LANGUAGES,
  detectLanguageWithTreeSitter
};
