/**
 * Module Syntax Validation System
 * 
 * Provides validation for ES module syntax, import paths, and browser compatibility
 * before Web Worker creation. Ensures graceful degradation when modules fail to load.
 * 
 * Copyright (c) 2025 Jason Tally and contributors
 * SPDX-License-Identifier: MIT
 */

// ============================================================================
// Browser Compatibility Detection
// ============================================================================

/**
 * Check if ES modules are supported in the current environment
 * @returns {boolean} True if ES modules are supported
 */
export function isESModuleSupported() {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    'noModule' in HTMLScriptElement.prototype &&
    // Check if dynamic import is available by testing it
    (() => {
      try {
        new Function('return import("")');
        return true;
      } catch (e) {
        return false;
      }
    })()
  );
}

/**
 * Check if dynamic imports are supported
 * @returns {boolean} True if dynamic imports are supported
 */
export function isDynamicImportSupported() {
  try {
    // Test dynamic import support
    new Function('return import("")');
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Check if Web Worker module type is supported
 * @returns {boolean} True if Worker module type is supported
 */
export function isWorkerModuleSupported() {
  try {
    // Create a proper blob with valid JavaScript content for testing
    const testCode = 'self.postMessage("test");';
    const blob = new Blob([testCode], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);
    const testWorker = new Worker(blobUrl, { type: 'module' });
    testWorker.terminate();
    URL.revokeObjectURL(blobUrl);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Get comprehensive browser compatibility report
 * @returns {Object} Compatibility status for different features
 */
export function getBrowserCompatibility() {
  return {
    esModules: isESModuleSupported(),
    dynamicImports: isDynamicImportSupported(),
    workerModules: isWorkerModuleSupported(),
    webWorkers: typeof Worker !== 'undefined',
    urlCreateObjectURL: typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function',
    blob: typeof Blob !== 'undefined'
  };
}

// ============================================================================
// Module Syntax Validation
// ============================================================================

/**
 * Validate ES module syntax in a string of code
 * @param {string} code - The module code to validate
 * @returns {Object} Validation result with errors and warnings
 */
export function validateModuleSyntax(code) {
  const result = {
    isValid: true,
    errors: [],
    warnings: [],
    importStatements: [],
    exportStatements: []
  };

  if (!code || typeof code !== 'string') {
    result.isValid = false;
    result.errors.push('Code must be a non-empty string');
    return result;
  }

  const lines = code.split('\n');
  
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const lineNumber = index + 1;

    // Skip comments and empty lines
    if (trimmed.startsWith('//') || trimmed === '' || trimmed.startsWith('/*')) {
      return;
    }

    // Check import statements
    if (trimmed.startsWith('import ')) {
      result.importStatements.push({ line: lineNumber, statement: trimmed });
      
      // Validate import syntax
      if (!validateImportSyntax(trimmed)) {
        result.isValid = false;
        result.errors.push(`Invalid import syntax at line ${lineNumber}: ${trimmed}`);
      }
    }

    // Check export statements
    if (trimmed.startsWith('export ')) {
      result.exportStatements.push({ line: lineNumber, statement: trimmed });
      
      // Validate export syntax
      if (!validateExportSyntax(trimmed)) {
        result.isValid = false;
        result.errors.push(`Invalid export syntax at line ${lineNumber}: ${trimmed}`);
      }
    }

    // Check for CommonJS patterns (not allowed in ES modules)
    if (trimmed.includes('require(') || trimmed.includes('module.exports')) {
      result.isValid = false;
      result.errors.push(`CommonJS syntax detected at line ${lineNumber}: ${trimmed}`);
    }
  });

  return result;
}

/**
 * Validate import statement syntax
 * @param {string} importStatement - Import statement to validate
 * @returns {boolean} True if syntax is valid
 */
function validateImportSyntax(importStatement) {
  // Basic regex patterns for valid import statements
  const patterns = [
    // import default from 'module'
    /^import\s+\w+\s+from\s+['"][^'"]+['"];?$/,
    // import * as name from 'module'
    /^import\s+\*\s+as\s+\w+\s+from\s+['"][^'"]+['"];?$/,
    // import { name1, name2 } from 'module'
    /^import\s+\{[^}]+\}\s+from\s+['"][^'"]+['"];?$/,
    // import { name as alias } from 'module'
    /^import\s+\{[^}]+\s+as\s+[^}]+\}\s+from\s+['"][^'"]+['"];?$/,
    // import default, { named } from 'module'
    /^import\s+\w+,\s*\{[^}]+\}\s+from\s+['"][^'"]+['"];?$/,
    // import 'module' (side effects)
    /^import\s+['"][^'"]+['"];?$/,
    // Dynamic import in template context
    /^import\s*\(/
  ];

  const trimmed = importStatement.trim().replace(/;$/, '');
  
  return patterns.some(pattern => pattern.test(trimmed));
}

/**
 * Validate export statement syntax
 * @param {string} exportStatement - Export statement to validate
 * @returns {boolean} True if syntax is valid
 */
function validateExportSyntax(exportStatement) {
  // Basic regex patterns for valid export statements
  const patterns = [
    // export default expression
    /^export\s+default\s+/,
    // export { name1, name2 }
    /^export\s+\{[^}]+\};?$/,
    // export { name1 as alias }
    /^export\s+\{[^}]+\s+as\s+[^}]+\};?$/,
    // export const/function/class
    /^export\s+(const|let|var|function|class)\s+/,
    // export async function
    /^export\s+async\s+function\s+/
  ];

  const trimmed = exportStatement.trim();
  
  return patterns.some(pattern => pattern.test(trimmed));
}

// ============================================================================
// Import Path Resolution Validation
// ============================================================================

/**
 * Validate import paths in module code
 * @param {string} code - Module code to validate
 * @param {string} baseUrl - Base URL for resolving relative paths
 * @returns {Object} Validation result with path information
 */
export function validateImportPaths(code, baseUrl = null) {
  const result = {
    isValid: true,
    errors: [],
    warnings: [],
    paths: []
  };

  if (!code || typeof code !== 'string') {
    result.isValid = false;
    result.errors.push('Code must be a non-empty string');
    return result;
  }

  const importMatches = code.match(/import\s+.*?from\s+['"]([^'"]+)['"]/g) || [];
  
  importMatches.forEach(match => {
    const pathMatch = match.match(/from\s+['"]([^'"]+)['"]/);
    if (pathMatch) {
      const path = pathMatch[1];
      const pathInfo = validateSingleImportPath(path, baseUrl);
      result.paths.push(pathInfo);
      
      if (!pathInfo.isValid) {
        result.isValid = false;
        result.errors.push(`Invalid import path: ${path} - ${pathInfo.error}`);
      }
      
      if (pathInfo.warnings.length > 0) {
        result.warnings.push(...pathInfo.warnings);
      }
    }
  });

  return result;
}

/**
 * Validate a single import path
 * @param {string} path - Import path to validate
 * @param {string} baseUrl - Base URL for resolving relative paths
 * @returns {Object} Path validation result
 */
function validateSingleImportPath(path, baseUrl) {
  const result = {
    path,
    type: 'unknown',
    isValid: true,
    error: null,
    warnings: []
  };

  // Check for empty path
  if (!path || path.trim() === '') {
    result.isValid = false;
    result.error = 'Empty import path';
    return result;
  }

  // Check for invalid characters (excluding : and ? which are valid in URLs)
  if (/[<>"*]/.test(path)) {
    result.isValid = false;
    result.error = 'Invalid characters in path';
    return result;
  }

  // Determine path type
  if (path.startsWith('http://') || path.startsWith('https://')) {
    result.type = 'cdn';
    
    // Validate CDN URL
    try {
      const url = new URL(path);
      if (!['http:', 'https:'].includes(url.protocol)) {
        result.isValid = false;
        result.error = 'CDN URL must use HTTP or HTTPS protocol';
      }
      
      // Check for common CDN patterns
      const cdnPatterns = [
        /esm\.sh/,
        /cdn\.jsdelivr\.net/,
        /unpkg\.com/,
        /skypack\.dev/
      ];
      
      if (!cdnPatterns.some(pattern => pattern.test(url.hostname))) {
        result.warnings.push('Using non-standard CDN - may not support ES modules');
      }
    } catch (e) {
      result.isValid = false;
      result.error = `Invalid CDN URL: ${e.message}`;
    }
  } else if (path.startsWith('./') || path.startsWith('../') || path.startsWith('/')) {
    result.type = 'relative';
    
    // Validate relative path
    if (path.includes('..') && !baseUrl) {
      result.warnings.push('Relative path with parent directory requires base URL');
    }
    
    // Check for potential directory traversal
    if (path.includes('../') && path.split('../').length > 3) {
      result.warnings.push('Deep directory traversal detected');
    }
  } else if (path.endsWith('.js') || path.endsWith('.mjs') || path.endsWith('.ts')) {
    result.type = 'local';
    
    // Validate local file path
    if (!path.startsWith('./') && !path.startsWith('../') && !path.startsWith('/')) {
      result.warnings.push('Local file path should start with ./, ../, or /');
    }
  } else {
    result.type = 'bare';
    
    // Bare module imports (e.g., 'diff', 'lodash')
    // These may not work in browsers without import maps
    if (typeof window !== 'undefined' && !window.importMaps) {
      result.warnings.push('Bare module import may not work without import map');
    }
  }

  return result;
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Generate cache busting version
 * @param {number} version - Version number
 * @returns {string} Cache busting parameter
 */
export function generateCacheBust(version = Date.now()) {
  return `?v=${version}`;
}

/**
 * Add cache busting to import paths in code
 * @param {string} code - Module code with import statements
 * @param {number|string} version - Version to use for cache busting
 * @returns {string} Code with cache busting added
 */
export function addCacheBusting(code, version = Date.now()) {
  const cacheBustParam = generateCacheBust(version);
  
  return code.replace(
    /from\s+(['"])([^'"]+)\1/g,
    (match, quote, path) => {
      // Skip CDN URLs and add cache busting only to local paths
      if (path.startsWith('./') || path.startsWith('../') || path.startsWith('/')) {
        return `from ${quote}${path}${cacheBustParam}${quote}`;
      }
      return match;
    }
  );
}

// ============================================================================
// Enhanced Error Handling
// ============================================================================

/**
 * Create a comprehensive error message for module loading failures
 * @param {Error} error - The original error
 * @param {Object} context - Context information about the failure
 * @returns {string} Enhanced error message
 */
export function createEnhancedErrorMessage(error, context = {}) {
  const compatibility = getBrowserCompatibility();
  
  let message = 'Module loading failed: ';
  
  // Safely get error message - handle ErrorEvent objects and regular Errors
  let errorMessage = 'Unknown error';
  if (error) {
    if (error.message && typeof error.message === 'string') {
      // ErrorEvent or Error object with message property
      errorMessage = error.message;
    } else if (error.error && error.error.message) {
      // Nested error object
      errorMessage = error.error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else {
      // Try to get meaningful info from the error object
      errorMessage = error.toString ? error.toString() : String(error);
      if (errorMessage === '[object Object]' || errorMessage === '[object Event]') {
        errorMessage = 'Worker failed to initialize. Check console for details.';
      }
    }
  }
  
  if (errorMessage.includes('Failed to construct \'Worker\'')) {
    message += 'Web Worker creation failed. ';
    if (!compatibility.webWorkers) {
      message += 'Web Workers are not supported in this browser. ';
    } else if (!compatibility.workerModules) {
      message += 'ES module workers are not supported. Consider using a different browser. ';
    }
  } else if (errorMessage.includes('Failed to load module')) {
    message += 'Module import failed. ';
    if (!compatibility.esModules) {
      message += 'ES modules are not supported. ';
    } else if (!compatibility.dynamicImports) {
      message += 'Dynamic imports are not supported. ';
    }
  } else if (errorMessage.includes('CORS')) {
    message += 'CORS error. Make sure all modules are served from the same origin or configure CORS headers. ';
  } else if (errorMessage.includes('MIME type')) {
    message += 'MIME type error. Ensure your server serves .js files with correct MIME type. ';
  } else {
    message += `${errorMessage} `;
  }

  // Add context-specific suggestions
  if (context.isWorker) {
    message += 'Try serving the application via HTTP(S) instead of file:// URLs. ';
  }
  
  if (context.importPaths) {
    const cdnPaths = context.importPaths.filter(p => p.type === 'cdn');
    if (cdnPaths.length > 0) {
      message += 'Check your internet connection and CDN availability. ';
    }
  }

  // Add browser compatibility info
  message += `Browser compatibility: ES Modules ${compatibility.esModules ? '✓' : '✗'}, `;
  message += `Worker Modules ${compatibility.workerModules ? '✓' : '✗'}.`;

  return message;
}

/**
 * Attempt graceful degradation when module loading fails
 * @param {Object} options - Options for graceful degradation
 * @returns {Object} Fallback strategy
 */
export function getGracefulDegradationStrategy(options = {}) {
  // Use provided compatibility if available, otherwise detect
  const compatibility = options.compatibility || getBrowserCompatibility();
  
  if (!compatibility.webWorkers) {
    return {
      canProceed: false,
      strategy: 'no-fallback',
      message: 'Web Workers are not supported. Cannot perform diff calculations.'
    };
  }

  if (!compatibility.workerModules) {
    return {
      canProceed: true,
      strategy: 'classic-worker',
      message: 'Falling back to classic worker (without ES modules). Some advanced features may be disabled.'
    };
  }

  if (!compatibility.dynamicImports) {
    return {
      canProceed: true,
      strategy: 'inline-worker',
      message: 'Falling back to inline worker code. Dynamic loading disabled.'
    };
  }

  return {
    canProceed: true,
    strategy: 'full-es-modules',
    message: 'All features supported.'
  };
}

// ============================================================================
// Main Validation Interface
// ============================================================================

/**
 * Perform comprehensive module validation before worker creation
 * @param {string} workerCode - The worker code to validate
 * @param {string} baseUrl - Base URL for resolving imports
 * @returns {Object} Complete validation result
 */
export function validateWorkerModule(workerCode, baseUrl = null) {
  const result = {
    isValid: true,
    errors: [],
    warnings: [],
    compatibility: getBrowserCompatibility(),
    syntax: null,
    paths: null,
    degradationStrategy: null
  };

  // Check browser compatibility
  if (!result.compatibility.esModules) {
    result.isValid = false;
    result.errors.push('ES modules are not supported in this browser');
  }

  if (!result.compatibility.workerModules) {
    result.errors.push('ES module workers are not supported in this browser');
  }

  // Validate syntax
  result.syntax = validateModuleSyntax(workerCode);
  result.errors.push(...result.syntax.errors);
  result.warnings.push(...result.syntax.warnings);

  // Validate import paths
  result.paths = validateImportPaths(workerCode, baseUrl);
  result.errors.push(...result.paths.errors);
  result.warnings.push(...result.paths.warnings);

  // Check overall validity
  result.isValid = result.errors.length === 0 && result.compatibility.workerModules;

  // Get degradation strategy
  result.degradationStrategy = getGracefulDegradationStrategy({
    isWorker: true,
    importPaths: result.paths.paths
  });

  return result;
}

export default {
  // Browser compatibility
  isESModuleSupported,
  isDynamicImportSupported,
  isWorkerModuleSupported,
  getBrowserCompatibility,
  
  // Syntax validation
  validateModuleSyntax,
  validateImportPaths,
  
  // Cache management
  generateCacheBust,
  addCacheBusting,
  
  // Error handling
  createEnhancedErrorMessage,
  getGracefulDegradationStrategy,
  
  // Main interface
  validateWorkerModule
};