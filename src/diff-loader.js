/**
 * Diff Library Loader
 * 
 * Dynamically loads the 'diff' library in a way that works across environments:
 * - Browser/Worker: Imports from CDN (esm.sh)
 * - Node.js tests: Imports from npm package
 * 
 * This enables the same algorithm code to run in both contexts.
 * 
 * Copyright (c) 2025 Jason Tally and contributors
 * SPDX-License-Identifier: MIT
 */

// CDN URLs for browser/Worker environment
export const CDN_URLS = {
  primary: 'https://esm.sh/diff@5.1.0',
  fallback: 'https://cdn.jsdelivr.net/npm/diff@5.1.0/dist/diff.esm.js'
};

/**
 * Load the diff library, trying multiple strategies
 * Works in both browser/Worker and Node.js environments
 * 
 * @returns {Promise<Object>} Object with diffLines, diffWords, diffChars functions
 */
export async function loadDiffLibrary() {
  // Strategy 1: Try Node.js/npm import (for testing)
  try {
    // In Node.js, this will resolve to the npm package
    // In browser, this will throw because 'diff' isn't a valid URL
    const diff = await import('diff');
    return {
      diffLines: diff.diffLines,
      diffWords: diff.diffWords,
      diffChars: diff.diffChars
    };
  } catch (nodeError) {
    // Not in Node.js or package not available, continue to CDN
  }
  
  // Strategy 2: Try primary CDN (esm.sh)
  try {
    const diff = await import(CDN_URLS.primary);
    return {
      diffLines: diff.diffLines,
      diffWords: diff.diffWords,
      diffChars: diff.diffChars
    };
  } catch (cdn1Error) {
    console.warn('Primary CDN failed, trying fallback...');
  }
  
  // Strategy 3: Try fallback CDN (jsdelivr)
  try {
    const diff = await import(CDN_URLS.fallback);
    return {
      diffLines: diff.diffLines,
      diffWords: diff.diffWords,
      diffChars: diff.diffChars
    };
  } catch (cdn2Error) {
    throw new Error(
      'Failed to load diff library from any source. ' +
      'Please ensure you have internet connectivity or install the npm package: npm install diff'
    );
  }
}

/**
 * Check if we're running in a Web Worker context
 * @returns {boolean}
 */
export function isWorker() {
  return typeof WorkerGlobalScope !== 'undefined' && 
         self instanceof WorkerGlobalScope;
}

/**
 * Check if we're running in Node.js
 * @returns {boolean}
 */
export function isNode() {
  return typeof process !== 'undefined' && 
         process.versions != null && 
         process.versions.node != null;
}

/**
 * Check if we're running in a browser (main thread)
 * @returns {boolean}
 */
export function isBrowser() {
  return typeof window !== 'undefined' && 
         typeof window.document !== 'undefined';
}

export default {
  loadDiffLibrary,
  isWorker,
  isNode,
  isBrowser,
  CDN_URLS
};
