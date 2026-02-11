/**
 * Web Worker Templates for Diff Processing
 * 
 * Provides worker code templates for the modular ES Module approach.
 * The template imports from both CDN (diff library) and local files (algorithms).
 * 
 * This is the RECOMMENDED approach (Option B) for this codebase:
 * - No code duplication between worker and tests
 * - Algorithms in src/diff-algorithms.js are the single source of truth
 * - Static site compatible (just serve files via HTTP)
 * - Testable: Same code runs in Node.js and browser
 * 
 * Copyright (c) 2025 Jason Tally and contributors
 * SPDX-License-Identifier: MIT
 */

// ============================================================================
// RECOMMENDED: Modular Worker Template
// ============================================================================

/**
 * Worker code template that imports from both CDN and local modules.
 * 
 * IMPORTANT: The import path for diff-algorithms.js is a RELATIVE placeholder
 * that must be resolved to an absolute URL at runtime:
 * 
 *   const workerCode = WORKER_CODE_TEMPLATE.replace(
 *     "from './diff-algorithms.js'",
 *     `from '${window.location.origin}/src/diff-algorithms.js'`
 *   );
 * 
 * This template should be used by index.html to create the worker.
 */
export const WORKER_CODE_TEMPLATE = `
// CDN import for the diff library (external dependency)
import { diffLines, diffWords, diffChars } from 'https://esm.sh/diff@5.1.0';

// Local imports for our algorithms (resolved at runtime by index.html)
// Cache busting version: 13 - forces browser to reload modules when updated
import { runDiffPipeline, CONFIG, calculateSimilarityFull } from './diff-algorithms.js?v=13';
import { detectCommonLanguage } from './language-detect.js?v=13';

self.onmessage = async function(e) {
  const { oldText, newText, options } = e.data;
  
  try {
    // Detect language from filenames or content
    const detectedLanguage = detectCommonLanguage(
      options.filenameA,
      options.filenameB,
      oldText,
      newText
    );
    
    if (detectedLanguage) {
      console.log('[Worker] Detected language:', detectedLanguage);
    }
    
    // Check if AST features were provided by main thread
    const astFeatures = options.astFeatures || null;
    const useAST = astFeatures !== null;
    
    if (useAST) {
      console.log('[Worker] Using AST features from main thread for enhanced comparison');
    }
    
    // Run complete pipeline using extracted algorithms
    const diffLib = { diffLines, diffWords, diffChars };
    const pipelineOptions = {
      ...options,
      language: useAST ? detectedLanguage : null,
      useAST: useAST,
      astFeatures: astFeatures, // Pass AST features to algorithms
      totalLines: Math.max(
        oldText.split('\\n').length,
        newText.split('\\n').length
      ),
      // Pass config from options (includes maxLines, maxGraphVertices, etc.)
      config: options.config || undefined
    };
    
    const result = runDiffPipeline(oldText, newText, diffLib, pipelineOptions);
    
    self.postMessage({ 
      type: 'complete', 
      results: result.results,
      stats: result.stats,
      limitInfo: result.limitInfo,
      language: detectedLanguage,
      useAST: useAST
    });
  } catch (error) {
    console.error('[Worker] Error processing diff:', error);
    self.postMessage({ 
      type: 'error', 
      error: error.message,
      stack: error.stack
    });
  }
};
`;

// ============================================================================
// Helper Functions for index.html
// ============================================================================

/**
 * Create a worker from the template code with dynamic URL resolution.
 * This is the RECOMMENDED way to create the worker.
 * 
 * @param {string} baseUrl - The base URL where src/ files are served (e.g., 'http://localhost:8000')
 * @returns {Worker} Web Worker instance
 * 
 * @example
 * import { createWorker } from './src/diff-worker.js';
 * const worker = createWorker(window.location.origin);
 */
export function createWorker(baseUrl) {
  // Replace the import path with the actual URL
  const workerCode = WORKER_CODE_TEMPLATE.replace(
    "from './diff-algorithms.js'",
    `from '${baseUrl}/src/diff-algorithms.js'`
  );
  
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  const blobUrl = URL.createObjectURL(blob);
  return new Worker(blobUrl, { type: 'module' });
}

// ============================================================================
// Exports
// ============================================================================

export default {
  WORKER_CODE_TEMPLATE,
  createWorker
};
