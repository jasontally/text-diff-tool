/**
 * Diff Algorithms Module
 * 
 * Core diff processing algorithms extracted for testability.
 * These functions are environment-agnostic and accept the diff library
 * as a parameter, allowing them to work in both browser (CDN) and 
 * Node.js (npm) environments.
 * 
 * Copyright (c) 2026 Jason Tally and contributors
 * SPDX-License-Identifier: MIT
 */

// Import token-based similarity functions
import { compareLines, TOKEN_TYPES } from './tokenizer.js';
import { calculateASTSimilarity } from './ast-comparator.js';
import { detectCommonLanguage } from './language-detect.js';
import { hashLine } from './content-hash.js';
import { patienceLCS } from './patience-diff.js';
import { detectRegions, REGION_TYPES } from './region-detector.js';
import { normalizeDelimiters } from './delimiter-normalizer.js';
import { detectSliders, correctSliders } from './slider-correction.js';
import { detectBlockMovesFast as newDetectBlockMovesFast } from './block-move-detector.js?v=13';

// ============================================================================
// Text Processing Functions
// ============================================================================

/**
 * Apply filters to text before diff processing
 * Currently handles delimiter normalization based on filter options
 * 
 * @param {string} text - The text to filter
 * @param {Object} filterOptions - Filter configuration options
 * @param {string|null} filterOptions.language - Language for language-specific processing
 * @param {boolean} filterOptions.normalizeDelimiters - Whether to normalize delimiters
 * @returns {string} Processed text
 */
function applyFilters(text, filterOptions = {}) {
  const { language = null, normalizeDelimiters: shouldNormalize = false } = filterOptions;
  
  if (shouldNormalize) {
    return normalizeDelimiters(text, language);
  }
  
  return text;
}

// ============================================================================
// Configuration Constants
// ============================================================================

export const CONFIG = {
  MODIFIED_THRESHOLD: 0.50,      // 50% similarity to classify as "modified" (Git standard)
  MOVE_THRESHOLD: 0.90,          // 90% similarity for move detection
  FAST_THRESHOLD: 0.30,          // Minimum signature similarity for full diff
  SIGNATURE_BITS: 32,            // Number of bits for SimHash signatures
  LSH_BANDS: 8,                  // Number of LSH bands for move detection
  MIN_LINES_FOR_MOVE_DETECTION: 10, // Minimum changes to enable move detection
  MAX_LINES_FOR_MOVE_DETECTION: 50000, // Disable move detection for huge files
  USE_TOKEN_SIMILARITY: true,    // Enable token-based similarity calculation
  TOKEN_WEIGHT: 0.7,             // Weight for token similarity (vs word similarity)
  USE_AST_SIMILARITY: true,      // Enable AST-based similarity (Tree-sitter)
  AST_WEIGHT: 0.6,               // Weight for AST similarity (vs other methods)
  MAX_LINES_FOR_AST: 1000,       // Don't use AST for very large files (performance)
  
  // Complexity limits for performance protection
  MAX_LINES: 50000,              // Maximum lines per file for full diff analysis
  MAX_GRAPH_VERTICES: 100000,    // Maximum graph size (removed × added) for similarity matrix
  ENABLE_FAST_MODE: true,        // Enable fast mode fallback when limits exceeded
};

// ============================================================================
// Content Hash Cache
// ============================================================================

/**
 * Content hash cache for line deduplication
 * Stores line → hash mappings to avoid recomputing hashes
 */
const contentHashCache = new Map();

/**
 * Cache statistics for debugging
 */
const cacheStats = {
  hits: 0,
  misses: 0,
  total: 0
};



/**
 * Get cached hash for a line, computing and caching if not present
 * Exported for testing purposes
 * 
 * @param {string} line - Input line
 * @returns {string} Content hash of the line
 */
export function getLineHash(line) {
  cacheStats.total++;
  if (contentHashCache.has(line)) {
    cacheStats.hits++;
    return contentHashCache.get(line);
  }
  cacheStats.misses++;
  const hash = hashLine(line);
  contentHashCache.set(line, hash);
  return hash;
}

/**
 * Clear the content hash cache
 * Should be called after each diff operation to prevent memory leaks
 */
export function clearContentHashCache() {
  contentHashCache.clear();
  // Reset stats for new operation
  cacheStats.hits = 0;
  cacheStats.misses = 0;
  cacheStats.total = 0;
}

/**
 * Get cache statistics for debugging
 * 
 * @returns {Object} Cache stats object
 */
export function getCacheStats() {
  const hitRate = cacheStats.total > 0 
    ? (cacheStats.hits / cacheStats.total * 100).toFixed(2)
    : 0;
  return {
    hits: cacheStats.hits,
    misses: cacheStats.misses,
    total: cacheStats.total,
    hitRate: `${hitRate}%`,
    size: contentHashCache.size
  };
}

// ============================================================================
// Signature Generation (Fast Similarity Estimation)
// ============================================================================

/**
 * Generate a fast fuzzy signature for a line using SimHash-like approach
 * Uses character bigrams (2-grams) for fuzzy matching
 * 
 * @param {string} line - Input line
 * @param {number} numBits - Signature size in bits (default: 32)
 * @returns {number} Fuzzy signature as integer
 */
export function generateLineSignature(line, numBits = CONFIG.SIGNATURE_BITS) {
  const normalized = line.trim().toLowerCase();
  if (normalized.length === 0) return 0;
  
  let signature = 0;
  // Handle the mask properly for 32-bit (where 1 << 32 would overflow)
  const mask = numBits === 32 ? 0xFFFFFFFF : (1 << numBits) - 1;
  
  for (let i = 0; i < normalized.length - 1; i++) {
    const bigramHash = (
      (normalized.charCodeAt(i) * 31) + 
      normalized.charCodeAt(i + 1)
    ) % numBits;
    
    // Set bit in signature using unsigned shift
    signature = (signature | (1 << bigramHash)) >>> 0;
  }
  
  return signature & mask;
}



/**
 * Calculate Hamming distance between two signatures
 * 
 * @param {number} sig1 - First signature
 * @param {number} sig2 - Second signature
 * @returns {number} Hamming distance (number of differing bits)
 */
export function signatureHammingDistance(sig1, sig2) {
  // Convert to unsigned 32-bit to handle negative numbers correctly
  let xor = (sig1 ^ sig2) >>> 0;
  let distance = 0;
  
  // Count set bits (Kernighan's algorithm)
  while (xor) {
    distance += xor & 1;
    xor >>>= 1; // Use unsigned right shift
  }
  
  return distance;
}

/**
 * Quick similarity estimate using signatures
 * Returns approximate similarity 0.0-1.0 (1.0 = identical)
 * 
 * @param {number} sig1 - First signature
 * @param {number} sig2 - Second signature
 * @param {number} numBits - Signature size
 * @returns {number} Approximate similarity
 */
export function estimateSimilarity(sig1, sig2, numBits = CONFIG.SIGNATURE_BITS) {
  const distance = signatureHammingDistance(sig1, sig2);
  return 1.0 - (distance / numBits);
}

// ============================================================================
// Delimiter Normalization Helper
// ============================================================================

/**
 * Get comparable form of a line with optional delimiter normalization
 * 
 * @param {string} line - Input line to normalize
 * @param {string|null} language - Programming language for language-specific rules
 * @param {boolean} shouldNormalize - Whether to apply delimiter normalization
 * @returns {string} Normalized or original line for comparison
 */
function getComparableLine(line, language = null, shouldNormalize = false) {
  if (shouldNormalize) {
    return normalizeDelimiters(line, language);
  }
  return line;
}

// ============================================================================
// Similarity Calculation
// ============================================================================

/**
 * Calculate precise similarity between two lines using word-level diff
 * Used as Tier 2 (expensive but accurate)
 * 
 * @param {string} lineA - First line
 * @param {string} lineB - Second line
 * @param {Function} diffWords - The diffWords function from the 'diff' library
 * @param {Object} options - Options for similarity calculation
 * @param {string|null} options.language - Programming language for normalization
 * @param {boolean} options.normalizeDelimiters - Whether to normalize delimiters
 * @returns {number} Similarity score 0.0 to 1.0
 */
export function calculateSimilarity(lineA, lineB, diffWords, options = {}) {
  const { language = null, normalizeDelimiters: shouldNormalize = false } = options;
  
  // Apply delimiter normalization if enabled
  const comparableA = getComparableLine(lineA, language, shouldNormalize);
  const comparableB = getComparableLine(lineB, language, shouldNormalize);
  
  const normalizedA = comparableA.trim().toLowerCase();
  const normalizedB = comparableB.trim().toLowerCase();
  
  if (normalizedA === normalizedB) return 1.0;
  if (normalizedA.length === 0 && normalizedB.length === 0) return 1.0;
  if (normalizedA.length === 0 || normalizedB.length === 0) return 0.0;
  
  const wordDiff = diffWords(normalizedA, normalizedB);
  const unchangedParts = wordDiff.filter(p => !p.added && !p.removed);
  const unchangedChars = unchangedParts.reduce((sum, p) => sum + p.value.length, 0);
  const totalChars = normalizedA.length + normalizedB.length;
  
  return (2 * unchangedChars) / totalChars;
}

// ============================================================================
// Token-Based Similarity Calculation (Enhanced)
// ============================================================================

/**
 * Calculate similarity between two lines using token-based comparison
 * This is more accurate than word-based for code comparison as it understands
 * language structure (keywords, identifiers, operators, etc.)
 * 
 * @param {string} lineA - First line
 * @param {string} lineB - Second line
 * @param {Function} diffWords - The diffWords function from the 'diff' library (fallback)
 * @param {Object} options - Options for similarity calculation
 * @param {boolean} options.useTokenSimilarity - Whether to use token-based similarity (default: true)
 * @param {number} options.tokenWeight - Weight given to token similarity vs word similarity (0.0-1.0)
 * @param {string|null} options.language - Programming language for normalization
 * @param {boolean} options.normalizeDelimiters - Whether to normalize delimiters
 * @returns {number} Similarity score 0.0 to 1.0
 */
export function calculateSimilarityEnhanced(lineA, lineB, diffWords, options = {}) {
  const useTokenSimilarity = options.useTokenSimilarity ?? false; // Disabled for now
  const tokenWeight = options.tokenWeight ?? CONFIG.TOKEN_WEIGHT;
  const language = options.language ?? null;
  const shouldNormalize = options.normalizeDelimiters ?? false;
  
  // Apply delimiter normalization if enabled for quick comparison
  const comparableA = getComparableLine(lineA, language, shouldNormalize);
  const comparableB = getComparableLine(lineB, language, shouldNormalize);
  
  const normalizedA = comparableA.trim().toLowerCase();
  const normalizedB = comparableB.trim().toLowerCase();
  
  if (normalizedA === normalizedB) return 1.0;
  if (normalizedA.length === 0 && normalizedB.length === 0) return 1.0;
  if (normalizedA.length === 0 || normalizedB.length === 0) return 0.0;
  
  // Calculate word-based similarity (existing method) with normalization options
  const wordSimilarity = calculateSimilarity(lineA, lineB, diffWords, options);
  
  // If token similarity is disabled, return word similarity
  if (!useTokenSimilarity) {
    return wordSimilarity;
  }
  
  try {
    // Calculate token-based similarity
    const tokenComparison = compareLines(lineA, lineB);
    const tokenSimilarity = tokenComparison.similarity;
    
    // Weighted combination
    // Token similarity is better for code structure
    // Word similarity catches literal string/number changes better
    const combinedSimilarity = (
      tokenSimilarity * tokenWeight +
      wordSimilarity * (1 - tokenWeight)
    );
    
    return combinedSimilarity;
  } catch (error) {
    // If tokenization fails, fall back to word similarity
    console.warn('Token-based similarity failed, falling back to word similarity:', error);
    return wordSimilarity;
  }
}

/**
 * Quick token-based similarity check (without full tokenization)
 * Useful for pre-filtering before expensive comparison
 * 
 * @param {string} lineA - First line
 * @param {string} lineB - Second line
 * @returns {number} Approximate similarity 0.0-1.0
 */
export function quickTokenSimilarity(lineA, lineB) {
  // Normalize both lines
  const normalizedA = lineA.trim().toLowerCase().replace(/\s+/g, ' ');
  const normalizedB = lineB.trim().toLowerCase().replace(/\s+/g, ' ');
  
  if (normalizedA === normalizedB) return 1.0;
  if (normalizedA.length === 0 && normalizedB.length === 0) return 1.0;
  if (normalizedA.length === 0 || normalizedB.length === 0) return 0.0;
  
  // Count common keyword patterns
  const keywords = ['function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 
                    'return', 'import', 'export', 'class', 'async', 'await'];
  
  let commonKeywords = 0;
  let totalKeywordsA = 0;
  let totalKeywordsB = 0;
  
  for (const keyword of keywords) {
    const hasInA = normalizedA.includes(keyword);
    const hasInB = normalizedB.includes(keyword);
    
    if (hasInA) totalKeywordsA++;
    if (hasInB) totalKeywordsB++;
    if (hasInA && hasInB) commonKeywords++;
  }
  
  // Structure similarity based on delimiters
  const delimitersA = normalizedA.replace(/[^(){}[\];,]/g, '').length;
  const delimitersB = normalizedB.replace(/[^(){}[\];,]/g, '').length;
  const delimiterDiff = Math.abs(delimitersA - delimitersB);
  const maxDelimiters = Math.max(delimitersA, delimitersB, 1);
  const delimiterSimilarity = 1.0 - (delimiterDiff / maxDelimiters);
  
  // Combine metrics
  let keywordSimilarity = 0;
  if (totalKeywordsA + totalKeywordsB > 0) {
    keywordSimilarity = (2 * commonKeywords) / (totalKeywordsA + totalKeywordsB);
  } else {
    keywordSimilarity = 1.0; // No keywords in either
  }
  
  return (keywordSimilarity * 0.5 + delimiterSimilarity * 0.3 + 0.2);
}

// ============================================================================
// Phase 0.5: Full Similarity with AST Support
// ============================================================================

/**
 * Calculate comprehensive similarity with Token + AST + Word-based comparison
 * This is the main similarity function that combines all three methods
 * 
 * @param {string} lineA - First line
 * @param {string} lineB - Second line
 * @param {Function} diffWords - The diffWords function from the 'diff' library
 * @param {string} language - Detected programming language (optional)
 * @param {Object} options - Configuration options
 * @param {boolean} options.useAST - Whether to use AST similarity (default: true)
 * @param {number} options.maxLinesForAST - Max file size to use AST (default: 1000)
 * @param {number} options.totalLines - Total lines in file (for AST decision)
 * @param {boolean} options.normalizeDelimiters - Whether to normalize delimiters
 * @returns {Promise<number>} Similarity score 0.0-1.0
 */
export async function calculateSimilarityFull(lineA, lineB, diffWords, language = null, options = {}) {
  // Apply delimiter normalization if enabled for quick comparison
  const shouldNormalize = options.normalizeDelimiters ?? false;
  const comparableA = getComparableLine(lineA, language, shouldNormalize);
  const comparableB = getComparableLine(lineB, language, shouldNormalize);
  
  const normalizedA = comparableA.trim().toLowerCase();
  const normalizedB = comparableB.trim().toLowerCase();
  
  if (normalizedA === normalizedB) return 1.0;
  if (normalizedA.length === 0 && normalizedB.length === 0) return 1.0;
  if (normalizedA.length === 0 || normalizedB.length === 0) return 0.0;
  
  // Get base token+word similarity (Phase 1 implementation) with normalization options
  const tokenWordSimilarity = calculateSimilarityEnhanced(lineA, lineB, diffWords, options);
  
  // Determine if we should use AST
  const useAST = options.useAST ?? CONFIG.USE_AST_SIMILARITY;
  const maxLinesForAST = options.maxLinesForAST ?? CONFIG.MAX_LINES_FOR_AST;
  const totalLines = options.totalLines ?? 0;
  
  // Skip AST for large files or if language not detected
  if (!useAST || totalLines > maxLinesForAST) {
    return tokenWordSimilarity;
  }
  
  // Check if pre-computed AST features are available (from main thread)
  const astFeatures = options.astFeatures || null;
  
  if (astFeatures && astFeatures.oldFeatures && astFeatures.newFeatures) {
    // Use pre-computed AST features from main thread
    try {
      const { calculateSimilarityFromFeatures } = await import('./ast-feature-extractor.js');
      const astSimilarity = calculateSimilarityFromFeatures(
        astFeatures.oldFeatures,
        astFeatures.newFeatures
      );
      
      if (astSimilarity !== null) {
        // Weighted combination: AST gets higher weight for structural understanding
        const astWeight = CONFIG.AST_WEIGHT;
        const combinedSimilarity = (
          astSimilarity * astWeight +
          tokenWordSimilarity * (1 - astWeight)
        );
        return combinedSimilarity;
      }
    } catch (error) {
      console.warn('[calculateSimilarityFull] Pre-computed AST comparison failed:', error);
      // Fall through to fallback
    }
  }
  
  // Fallback: Calculate AST similarity on-demand (for Node.js tests or if features not provided)
  if (language) {
    try {
      const astSimilarity = await calculateASTSimilarity(lineA, lineB, language);
      
      if (astSimilarity === null) {
        // AST failed, use token+word only
        return tokenWordSimilarity;
      }
      
      // Weighted combination: AST gets higher weight for structural understanding
      const astWeight = CONFIG.AST_WEIGHT;
      const combinedSimilarity = (
        astSimilarity * astWeight +
        tokenWordSimilarity * (1 - astWeight)
      );
      
      return combinedSimilarity;
    } catch (error) {
      console.warn('[calculateSimilarityFull] AST comparison failed:', error);
      return tokenWordSimilarity;
    }
  }
  
  return tokenWordSimilarity;
}

/**
 * Batch calculate similarities for multiple line pairs
 * Efficiently processes multiple comparisons, loading language parser once
 * 
 * @param {Array<{lineA: string, lineB: string}>} pairs - Array of line pairs
 * @param {Function} diffWords - diffWords function
 * @param {string} language - Programming language
 * @param {Object} options - Options
 * @returns {Promise<Array<number>>} Array of similarity scores
 */
export async function batchCalculateSimilarity(pairs, diffWords, language, options = {}) {
  if (!language || pairs.length === 0) {
    // No language, use fast token-based for all
    return pairs.map(({ lineA, lineB }) => 
      calculateSimilarityEnhanced(lineA, lineB, diffWords)
    );
  }
  
  const results = [];
  
  for (const { lineA, lineB } of pairs) {
    try {
      const similarity = await calculateSimilarityFull(lineA, lineB, diffWords, language, options);
      results.push(similarity);
    } catch (error) {
      console.warn('[batchCalculateSimilarity] Failed for pair:', error);
      // Fallback to token-based
      results.push(calculateSimilarityEnhanced(lineA, lineB, diffWords));
    }
  }
  
  return results;
}

// ============================================================================
// Phase 1: Identify Change Blocks
// ============================================================================

/**
 * Group consecutive removes and adds into change blocks for analysis
 * 
 * @param {Array} diffResults - Raw diff output from diffLines()
 * @returns {Array} Array of change blocks (each with removed[] and added[] lines)
 */
export function identifyChangeBlocks(diffResults) {
  const blocks = [];
  let currentBlock = null;
  
  for (let i = 0; i < diffResults.length; i++) {
    const change = diffResults[i];
    
    if (change.removed) {
      if (!currentBlock) {
        currentBlock = { removed: [], added: [], startIndex: i };
      }
      currentBlock.removed.push({ line: change.value, index: i });
    } else if (change.added) {
      if (!currentBlock) continue;
      currentBlock.added.push({ line: change.value, index: i });
    } else {
      if (currentBlock && (currentBlock.removed.length > 0 || currentBlock.added.length > 0)) {
        blocks.push(currentBlock);
      }
      currentBlock = null;
    }
  }
  
  if (currentBlock && (currentBlock.removed.length > 0 || currentBlock.added.length > 0)) {
    blocks.push(currentBlock);
  }
  
  return blocks;
}

/**
 * Detect moves in unchanged lines by comparing original vs new positions
 * When diffLines marks content as "unchanged" but it's at a different position,
 * we can detect it as a move by comparing line positions in old vs new text.
 * 
 * @param {Array} diffResults - Raw diff output from diffLines()
 * @param {string} oldText - Original text
 * @param {string} newText - Modified text  
 * @returns {Array} Virtual change blocks for detected moves
 */
export function detectMovesInUnchangedLines(diffResults, oldText, newText) {
  const virtualBlocks = [];
  
  // Build position maps for unchanged lines
  const unchangedEntries = [];
  let oldLineNum = 0;
  let newLineNum = 0;
  
  for (let i = 0; i < diffResults.length; i++) {
    const change = diffResults[i];
    const lines = change.value.split('\n').filter(l => l.length > 0);
    
    if (change.removed) {
      oldLineNum += lines.length;
    } else if (change.added) {
      newLineNum += lines.length;
    } else {
      // Unchanged - track positions
      for (const line of lines) {
        unchangedEntries.push({
          line,
          oldIndex: oldLineNum,
          newIndex: newLineNum,
          diffIndex: i
        });
        oldLineNum++;
        newLineNum++;
      }
    }
  }
  
  // Group consecutive unchanged lines that moved (oldIndex != newIndex)
  let currentBlock = null;
  for (const entry of unchangedEntries) {
    const positionShift = entry.newIndex - entry.oldIndex;
    
    if (positionShift !== 0) {
      // This line moved - either join existing block or start new one
      if (currentBlock && 
          Math.abs(entry.diffIndex - currentBlock.endDiffIndex) <= 2 &&
          entry.newIndex === currentBlock.expectedNewIndex) {
        // Continue existing block
        currentBlock.removed.push({ line: entry.line, index: entry.diffIndex });
        currentBlock.added.push({ line: entry.line, index: entry.diffIndex });
        currentBlock.endDiffIndex = entry.diffIndex;
        currentBlock.expectedNewIndex = entry.newIndex + 1;
        currentBlock.oldLinePositions.push(entry.oldIndex);
        currentBlock.newLinePositions.push(entry.newIndex);
      } else {
        // Start new block
        if (currentBlock && currentBlock.removed.length >= 3) {
          virtualBlocks.push(currentBlock);
        }
        currentBlock = {
          removed: [{ line: entry.line, index: entry.diffIndex }],
          added: [{ line: entry.line, index: entry.diffIndex }],
          startDiffIndex: entry.diffIndex,
          endDiffIndex: entry.diffIndex,
          expectedNewIndex: entry.newIndex + 1,
          isVirtualMoveBlock: true,
          oldLinePositions: [entry.oldIndex],
          newLinePositions: [entry.newIndex]
        };
      }
    } else {
      // Line didn't move - close current block if it exists
      if (currentBlock && currentBlock.removed.length >= 3) {
        virtualBlocks.push(currentBlock);
      }
      currentBlock = null;
    }
  }
  
  // Don't forget the last block
  if (currentBlock && currentBlock.removed.length >= 3) {
    virtualBlocks.push(currentBlock);
  }
  
  return virtualBlocks;
}

// ============================================================================
// Phase 5: Fast Move Detection (LSH) with Block-Level Move Support
// ============================================================================

/**
 * Generate block signature using sliding window hash
 * Creates a fingerprint for a sequence of consecutive lines
 * 
 * @param {Array} lines - Array of line objects with signature property
 * @param {number} startIndex - Start index of block
 * @param {number} blockSize - Size of block
 * @returns {string} Combined block hash
 */
function generateBlockSignature(lines, startIndex, blockSize) {
  let combinedHash = 0;
  for (let i = 0; i < blockSize && (startIndex + i) < lines.length; i++) {
    combinedHash = ((combinedHash * 31) + lines[startIndex + i].signature) >>> 0;
  }
  return combinedHash.toString(36);
}

/**
 * Generate block signatures for all possible blocks of given size
 * Uses sliding window approach for efficiency
 * 
 * @param {Array} allBlocks - All change blocks
 * @param {string} type - 'removed' or 'added'
 * @param {number} blockSize - Size of blocks to detect
 * @returns {Map} Map of block hash to block info
 */
export function generateBlockSignatures(allBlocks, type, blockSize) {
  const blockSignatures = new Map();
  
  allBlocks.forEach((block, blockIdx) => {
    const lines = type === 'removed' ? block.removed : block.added;
    
    // Skip if not enough lines for this block size
    if (lines.length < blockSize) return;
    
    // Generate signatures using sliding window
    for (let startIdx = 0; startIdx <= lines.length - blockSize; startIdx++) {
      const blockLines = lines.slice(startIdx, startIdx + blockSize);
      const hash = generateBlockSignature(blockLines, 0, blockSize);
      
      const blockInfo = {
        hash,
        blockIdx,
        startIdx,
        endIdx: startIdx + blockSize - 1,
        size: blockSize,
        lines: blockLines.map(l => l.line),
        globalStartIndex: lines[startIdx].index,
        globalEndIndex: lines[startIdx + blockSize - 1].index
      };
      
      // Store all occurrences - duplicate blocks may exist
      if (!blockSignatures.has(hash)) {
        blockSignatures.set(hash, []);
      }
      blockSignatures.get(hash).push(blockInfo);
    }
  });
  
  return blockSignatures;
}

/**
 * Fast move detection using SimHash signatures and banded LSH indexing
 * Enhanced with block-level move detection for sequences of 3+ lines
 * 
 * Complexity: O(R + A) for indexing + O(candidates) for verification
 * where candidates << R×M due to LSH bucketing
 * + O(B×W) for block detection where B=blocks, W=window sizes
 * 
 * @param {Array} allBlocks - All change blocks in the file
 * @param {Function} diffWords - The diffWords function from the 'diff' library
 * @param {Function} diffChars - The diffChars function from the 'diff' library
 * @param {number} numBands - Number of LSH bands (default: 8)
 * @param {number} moveThreshold - Similarity threshold for moves (default: 0.90)
 * @param {number} modifiedThreshold - Similarity threshold for modifications (default: 0.60)
 * @param {number} numBits - Number of bits for signatures
 * @param {Object} modeToggles - Which diff modes are enabled
 * @param {string} language - Detected programming language
 * @returns {Object} Object with moves Map, crossBlockModifications array, and blockMoves array
 */
export function detectBlockMovesFast(
  allBlocks,
  diffWords,
  diffChars,
  numBands = CONFIG.LSH_BANDS,
  moveThreshold = CONFIG.MOVE_THRESHOLD,
  modifiedThreshold = CONFIG.MODIFIED_THRESHOLD,
  numBits = CONFIG.SIGNATURE_BITS,
  modeToggles = { lines: true, words: true, chars: true },
  language = null,
  options = {}
) {
  // Use the new git-style hash-based implementation
  return newDetectBlockMovesFast(
    allBlocks,
    diffWords,
    diffChars,
    numBands,
    moveThreshold,
    modifiedThreshold,
    numBits,
    modeToggles,
    language,
    options
  );
}

// ============================================================================
// Phase 4: Similarity Matrix Construction
// ============================================================================

/**
 * Build optimized similarity matrix with tiered approach
 * Uses fast signatures for prefiltering, then full similarity for promising candidates
 * 
 * Tier 0: Content hash cache for exact matches (O(1))
 * Tier 1: Signature-based prefiltering (SimHash)
 * Tier 2: Enhanced token-based similarity for candidates
 * 
 * @param {Object} block - Block with removed[] and added[] lines
 * @param {Function} diffWords - The diffWords function from the 'diff' library
 * @param {number} fastThreshold - Minimum signature similarity to run full diff (default: CONFIG.FAST_THRESHOLD)
 * @param {Object} options - Additional options for similarity calculation
 * @returns {number[][]} 2D array of similarity scores (0.0-1.0)
 */
export function buildOptimizedSimilarityMatrix(block, diffWords, fastThreshold = CONFIG.FAST_THRESHOLD, options = {}) {
  const numBits = CONFIG.SIGNATURE_BITS;
  const matrix = [];
  const numRemoved = block.removed.length;
  const numAdded = block.added.length;
  
  // Pre-compute signatures for all lines (O(N+M))
  const removedSigs = block.removed.map(r => generateLineSignature(r.line, numBits));
  const addedSigs = block.added.map(a => generateLineSignature(a.line, numBits));
  
  // Build matrix with tiered approach
  for (let r = 0; r < numRemoved; r++) {
    matrix[r] = [];
    const removedSig = removedSigs[r];
    const removedLine = block.removed[r].line;
    
    for (let a = 0; a < numAdded; a++) {
      // Tier 0: Check content hash cache for exact matches
      // Check actual line equality first (most reliable)
      if (removedLine === block.added[a].line) {
        // Exact match, no need for further calculation
        // Still use cache to maintain statistics
        getLineHash(removedLine);
        getLineHash(block.added[a].line);
        matrix[r][a] = 1.0;
        continue;
      }
      
      // Use hash for quick non-match check
      const removedHash = getLineHash(removedLine);
      const addedHash = getLineHash(block.added[a].line);
      
      // If hashes are different, lines are definitely different
      // (for lines longer than 1 character where hash is meaningful)
      if (removedHash !== addedHash && 
          (removedLine.length > 1 && block.added[a].line.length > 1)) {
        // Different hashes means different lines for content > 1 char
        // Continue with similarity calculation
      }
      
      // Tier 1: Fast signature comparison
      const sigSimilarity = estimateSimilarity(removedSig, addedSigs[a], numBits);
      
      // Special case: Both signatures are 0 (no bigrams, e.g., single chars)
      // In this case, signature similarity is meaningless, use full comparison
      if (removedSig === 0 && addedSigs[a] === 0) {
        matrix[r][a] = calculateSimilarityEnhanced(removedLine, block.added[a].line, diffWords, options);
      } else if (sigSimilarity < fastThreshold) {
        // Lines are too different, skip expensive word diff
        // Assign low but non-zero score to allow pairing if no better matches
        matrix[r][a] = sigSimilarity * 0.5;
      } else {
        // Tier 2: Full enhanced similarity for promising candidates
        matrix[r][a] = calculateSimilarityEnhanced(removedLine, block.added[a].line, diffWords, options);
      }
    }
  }
  
  return matrix;
}

// ============================================================================
// Phase 5: Optimal Pairing
// ============================================================================

/**
 * Find optimal pairings between removed and added lines using greedy algorithm
 * Always pairs best match first to ensure modifications are highlighted properly
 * Generates word/char diffs when modes are enabled
 * 
 * @param {Object} block - Block with removed[] and added[] lines
 * @param {number[][]} matrix - Similarity matrix from buildOptimizedSimilarityMatrix
 * @param {Function} diffWords - The diffWords function from the 'diff' library
 * @param {Function} diffChars - The diffChars function from the 'diff' library
 * @param {number} modifiedThreshold - Similarity threshold for modifications (default: CONFIG.MODIFIED_THRESHOLD)
 * @param {Object} modeToggles - Which diff modes are enabled
 * @param {string} language - Detected programming language
 * @returns {Array} Array of pairing objects with type, indices, and diffs
 */
export async function findOptimalPairings(
  block, 
  matrix, 
  diffWords, 
  diffChars,
  modifiedThreshold = CONFIG.MODIFIED_THRESHOLD,
  modeToggles = { lines: true, words: true, chars: true },
  language = null
) {
  const pairings = [];
  const usedRemoved = new Set();
  const usedAdded = new Set();
  
  // Create list of all possible pairings with their similarities
  const allPairings = [];
  for (let r = 0; r < block.removed.length; r++) {
    for (let a = 0; a < block.added.length; a++) {
      allPairings.push({
        removedIdx: r,
        addedIdx: a,
        similarity: matrix[r][a],
        removedIndex: block.removed[r].index,
        addedIndex: block.added[a].index,
        removedLine: block.removed[r].line,
        addedLine: block.added[a].line
      });
    }
  }
  
  // Sort by similarity descending (best matches first)
  allPairings.sort((a, b) => b.similarity - a.similarity);
  
  // Greedy pairing: always pick the best remaining match
  for (const pairing of allPairings) {
    if (usedRemoved.has(pairing.removedIdx) || usedAdded.has(pairing.addedIdx)) {
      continue; // Skip if either line is already paired
    }
    
    // Determine classification based on similarity
    const isModified = pairing.similarity >= modifiedThreshold;
    
    // Only pair lines if they meet the modified threshold
    // Lines with similarity below threshold should remain unpaired
    // and be treated as separate added/removed
    if (!isModified) {
      continue; // Skip pairing - let these become pure add/remove
    }
    
    const result = {
      type: 'modified',
      removedIndex: pairing.removedIndex,
      addedIndex: pairing.addedIndex,
      removedLine: pairing.removedLine,
      addedLine: pairing.addedLine,
      similarity: pairing.similarity
    };
    
    // Compute word-level diff if word mode is enabled
    if (modeToggles.words) {
      result.wordDiff = diffWords(pairing.removedLine, pairing.addedLine);
    }
    
    // Compute char-level diff if char mode is enabled
    if (modeToggles.chars) {
      result.charDiff = diffChars(pairing.removedLine, pairing.addedLine);
    }
    
    // Compute nested diffs for comment/string regions (async)
    if (modeToggles.words && language) {
      await computeNestedDiffs(result, diffWords, language);
    }
    
    pairings.push(result);
    usedRemoved.add(pairing.removedIdx);
    usedAdded.add(pairing.addedIdx);
  }
  
  // Handle unpaired removed lines (pure removals)
  for (let r = 0; r < block.removed.length; r++) {
    if (!usedRemoved.has(r)) {
      pairings.push({
        type: 'removed',
        removedIndex: block.removed[r].index,
        addedIndex: null,
        removedLine: block.removed[r].line,
        addedLine: null,
        similarity: 0
      });
    }
  }
  
  // Handle unpaired added lines (pure additions)
  for (let a = 0; a < block.added.length; a++) {
    if (!usedAdded.has(a)) {
      pairings.push({
        type: 'added',
        removedIndex: null,
        addedIndex: block.added[a].index,
        removedLine: null,
        addedLine: block.added[a].line,
        similarity: 0
      });
    }
  }
  
  return pairings;
}

/**
 * Compute nested diffs for comment/string regions
 * This is a helper function for findOptimalPairings
 * 
 * @param {Object} pairing - The pairing object to augment
 * @param {Function} diffWords - The diffWords function from the 'diff' library
 * @param {string} language - Programming language for context
 */
async function computeNestedDiffs(pairing, diffWords, language) {
  // Detect regions in both lines (async)
  const [removedRegions, addedRegions] = await Promise.all([
    detectRegions(pairing.removedLine, language),
    detectRegions(pairing.addedLine, language)
  ]);
  
  // Only process if both have comment/string regions
  const hasRegions = removedRegions.some(r => r.type !== REGION_TYPES.CODE) ||
                    addedRegions.some(r => r.type !== REGION_TYPES.CODE);
  
  if (!hasRegions) {
    return;
  }
  
  // Store region-specific diffs for enhanced display
  pairing.nestedDiffs = [];
  
  // Pair up regions by type and position
  let removedIdx = 0;
  let addedIdx = 0;
  
  while (removedIdx < removedRegions.length && addedIdx < addedRegions.length) {
    const removedRegion = removedRegions[removedIdx];
    const addedRegion = addedRegions[addedIdx];
    
    // If same region type, compute diff
    if (removedRegion.type === addedRegion.type) {
      const regionDiff = diffWords(removedRegion.content, addedRegion.content);
      pairing.nestedDiffs.push({
        type: removedRegion.type,
        removedRegion,
        addedRegion,
        wordDiff: regionDiff
      });
      
      removedIdx++;
      addedIdx++;
    } else {
      // Skip mismatched regions
      if (removedRegion.type === REGION_TYPES.CODE) {
        removedIdx++;
      } else {
        addedIdx++;
      }
    }
  }
}

// ============================================================================
// Phase 6: Final Classification
// ============================================================================

/**
 * Complete modified line detection pipeline
 * 
 * @param {Array} diffResults - Raw diff from diffLines()
 * @param {Function} diffWords - The diffWords function from the 'diff' library
 * @param {Function} diffChars - The diffChars function from the 'diff' library
 * @param {Object} options - Configuration options
 * @returns {Array} Results with 'added', 'removed', 'modified', or 'unchanged' classification
 */
export async function detectModifiedLines(diffResults, diffWords, diffChars, options = {}, oldText = '', newText = '') {
  const blocks = identifyChangeBlocks(diffResults);
  const allPairings = [];
  const modeToggles = options.modeToggles || { lines: true, words: true, chars: true };
  const language = options.language || null;
  
  for (const block of blocks) {
    const matrix = buildOptimizedSimilarityMatrix(
      block, 
      diffWords, 
      options.fastThreshold || CONFIG.FAST_THRESHOLD
    );
    const pairings = await findOptimalPairings(
      block, 
      matrix, 
      diffWords, 
      diffChars,
      options.modifiedThreshold,
      modeToggles,
      language
    );
    allPairings.push(...pairings);
  }
  
  // Optional move detection with cross-block modification support
  let moves = new Map();
  let crossBlockModifications = [];
  
  // Get virtual move blocks - either from pre-detected option or detect them here
  // Pre-detected blocks come from runSinglePassDiff which runs detection on raw results
  // before fixDiffLinesClassification potentially corrupts them
  const virtualMoveBlocks = options._virtualMoveBlocks || 
    ((options.detectMoves !== false && oldText && newText) 
      ? detectMovesInUnchangedLines(diffResults, oldText, newText)
      : []);
  
  // Merge virtual blocks with regular blocks for move detection
  const allBlocksForMoveDetection = [...blocks, ...virtualMoveBlocks];
  
  // Count physical lines (not diff entries) since diffLines groups lines
  const totalRemoved = allBlocksForMoveDetection.reduce((sum, b) => 
    sum + b.removed.reduce((lineSum, r) => lineSum + (r.line?.split('\n').length || 1), 0), 0);
  const totalAdded = allBlocksForMoveDetection.reduce((sum, b) => 
    sum + b.added.reduce((lineSum, a) => lineSum + (a.line?.split('\n').length || 1), 0), 0);
  
  if (options.detectMoves !== false && (totalRemoved + totalAdded) < CONFIG.MAX_LINES_FOR_MOVE_DETECTION) {
    const moveResult = detectBlockMovesFast(
      allBlocksForMoveDetection, 
      diffWords, 
      diffChars,
      CONFIG.LSH_BANDS, 
      CONFIG.MOVE_THRESHOLD,
      options.modifiedThreshold || CONFIG.MODIFIED_THRESHOLD,
      CONFIG.SIGNATURE_BITS,
      modeToggles,
      language,
      options
    );
    moves = moveResult.moves;
    crossBlockModifications = moveResult.crossBlockModifications;
    const blockMoves = moveResult.blockMoves || [];
    
    // Add cross-block modifications to pairings
    allPairings.push(...crossBlockModifications);
    
    // Store block moves for later processing
    if (blockMoves.length > 0) {
      options._blockMoves = blockMoves;
    }
  }
  
  // Merge classifications
  const classified = diffResults.map((change, index) => {
    const pairing = allPairings.find(p => 
      p.removedIndex === index || p.addedIndex === index
    );
    
    if (pairing) {
      const result = {
        ...change,
        index: index,
        classification: pairing.type,
        pairIndex: pairing.type === 'modified' 
          ? (change.removed ? pairing.addedIndex : pairing.removedIndex)
          : null,
        similarity: pairing.similarity || null
      };
      
      // For modified lines, store both the removed and added line values
      // This allows the UI to display the correct content in each panel
      if (pairing.type === 'modified') {
        result.removedLine = pairing.removedLine;
        result.addedLine = pairing.addedLine;
      }
      
      // Include diffs based on mode toggles
      if (pairing.wordDiff) {
        result.wordDiff = pairing.wordDiff;
      }
      if (pairing.charDiff) {
        result.charDiff = pairing.charDiff;
      }
      
      return result;
    }
    
    if (moves.has(index)) {
      // Check if this entry will be handled as part of a block move
      // If so, skip the 'moved' classification and let the block move handler set 'block-moved'
      // Use options._blockMoves which was set earlier in this function
      const blockMovesToCheck = options._blockMoves || [];
      const willBeBlockMoved = blockMovesToCheck.some(bm => {
        const isVirtual = bm.from === bm.to;
        if (isVirtual) {
          // For virtual blocks, check if this index matches the block
          return bm.from === index;
        } else {
          // For regular blocks, check if index is within the block range
          return index >= bm.from && index < bm.from + bm.size;
        }
      });
      
      if (!willBeBlockMoved) {
        const move = moves.get(index);
        // Only classify as 'moved' if the line actually changed position
        // If fromIndex === toIndex, it's not a move, it's unchanged
        if (move.toIndex !== index) {
          return {
            ...change,
            index: index,
            classification: 'moved',
            moveDestination: move.toIndex
          };
        }
      }
    }
    
    return {
      ...change,
      index: index,
      classification: change.added ? 'added' : change.removed ? 'removed' : 'unchanged'
    };
  });
  
  // Apply block move classifications after individual line classification
  if (options._blockMoves && options._blockMoves.length > 0) {
    const blockMoves = options._blockMoves;
    
    // Mark lines that are part of block moves
    for (const blockMove of blockMoves) {
      // Check if this is a virtual block (from unchanged lines)
      // Virtual blocks have from === to (same diff index) but represent moved content
      const isVirtualBlock = blockMove.from === blockMove.to;
      
      if (isVirtualBlock) {
        // For virtual blocks (where from === to), check if content actually moved position
        // If we can't determine that it moved, skip processing to avoid false positives
        const oldPositions = blockMove.oldLinePositions;
        const newPositions = blockMove.newLinePositions;
        const fromLineNum = blockMove.fromLineNumber;
        const toLineNum = blockMove.toLineNumber;
        
        // Determine if content actually moved
        // Default to NOT processing unless we have evidence it moved
        let actuallyMoved = false;
        
        // Check using position arrays from detectMovesInUnchangedLines
        if (oldPositions && newPositions && oldPositions.length > 0) {
          actuallyMoved = oldPositions.some((oldPos, i) => oldPos !== newPositions[i]);
        }
        // Check using line numbers from block move detector
        else if (fromLineNum !== undefined && toLineNum !== undefined) {
          actuallyMoved = fromLineNum !== toLineNum;
        }
        
        // Only process if we have evidence the content actually moved
        if (actuallyMoved) {
          // For virtual blocks, match by content since indices may have changed
          // The blockMove.content array contains the actual lines
          const firstLine = blockMove.content?.[0];
          
          if (firstLine) {
            // Find an entry that contains this content (could be added, unchanged, etc.)
            const matchingEntry = classified.find(c => 
              c.value && c.value.includes(firstLine.substring(0, 40))
            );
            
            if (matchingEntry) {
              // Mark as destination (where the content appears in the new file)
              matchingEntry.classification = 'block-moved';
              matchingEntry.blockMoveDestination = blockMove.to;
              matchingEntry.blockMoveSource = undefined;
              matchingEntry.blockMoveInfo = blockMove;
              matchingEntry.added = true;
              matchingEntry.removed = false;
              matchingEntry._wasUnchangedButMoved = true;
              
              // Create source entry for the old position
              const sourceEntry = {
                ...matchingEntry,
                index: blockMove.from,
                added: false,
                removed: true,
                blockMoveSource: blockMove.from,
                blockMoveDestination: undefined,
                _isVirtualSource: true
              };
              
              // Insert source entry at the correct position in the array
              // Find the insertion point based on the original line position
              const insertIndex = classified.findIndex(c => c.index >= blockMove.from);
              if (insertIndex >= 0) {
                classified.splice(insertIndex, 0, sourceEntry);
              } else {
                // If no appropriate position found, append to end
                classified.push(sourceEntry);
              }
            }
          }
        }
      } else {
        // For normal block moves, process each line individually
        for (let i = 0; i < blockMove.size; i++) {
          const fromIndex = blockMove.from + i;
          const toIndex = blockMove.to + i;
          
          // Find and update the corresponding classified entries
          const fromEntry = classified.find(c => c.removed && c.index === fromIndex);
          const toEntry = classified.find(c => c.added && c.index === toIndex);
          
          if (fromEntry) {
            fromEntry.classification = 'block-moved';
            fromEntry.blockMoveDestination = toIndex;
            fromEntry.blockMoveInfo = blockMove;
          }
          
          if (toEntry) {
            toEntry.classification = 'block-moved';
            toEntry.blockMoveSource = fromIndex;
            toEntry.blockMoveInfo = blockMove;
          }
        }
      }
    }
  }
  
  return classified;
}

// ============================================================================
// Statistics Helper
// ============================================================================

/**
 * Calculate statistics from classified results
 * 
 * @param {Array} classifiedResults - Results from detectModifiedLines()
 * @returns {Object} Statistics object
 */
export function calculateStats(classifiedResults) {
  return {
    totalChanges: classifiedResults.length,
    added: classifiedResults.filter(c => c.classification === 'added').length,
    removed: classifiedResults.filter(c => c.classification === 'removed').length,
    modified: classifiedResults.filter(c => c.classification === 'modified').length,
    moved: classifiedResults.filter(c => c.classification === 'moved' || c.classification === 'block-moved').length,
    unchanged: classifiedResults.filter(c => c.classification === 'unchanged').length
  };
}

// ============================================================================
// Post-Processing: Fix diffLines Classification Bug
// ============================================================================

/**
 * Fix for diffLines() v5.1.0 bugs:
 * 1. New content after a removed block is incorrectly marked as "unchanged" instead of "added"
 * 2. Content that exists in both old and new is incorrectly marked as "removed"+"added" when it should be "unchanged"+"added"
 * 
 * Detection logic for bug #1: If an entry has no `added` or `removed` flags (appears unchanged),
 * but it comes immediately after a `removed` entry and has different content
 * than what was removed, it should be marked as `added: true`.
 * 
 * Detection logic for bug #2: If we have a removed entry followed by an added entry where
 * the added entry contains the removed content as a prefix, split the added entry into
 * unchanged (the common part) and added (the new part).
 * 
 * @param {Array} diffResults - Raw diff output from diffLines()
 * @param {string} oldText - Original text for comparison
 * @returns {Array} Corrected diff results with proper added flags
 */
export function fixDiffLinesClassification(diffResults, oldText) {
  if (!diffResults || diffResults.length === 0) {
    return diffResults;
  }

  const corrected = [];
  let lastWasRemoved = false;
  let removedContent = '';
  const oldLines = oldText ? oldText.split('\n') : [];
  let oldLineIndex = 0;

  for (let i = 0; i < diffResults.length; i++) {
    const entry = diffResults[i];
    const isUnchanged = !entry.added && !entry.removed;
    const entryValue = entry.value || '';

    // Track if this entry was originally in old text
    if (entry.removed) {
      lastWasRemoved = true;
      removedContent = entryValue;
      corrected.push(entry);
      // Advance old line index for removed lines
      const removedLines = entryValue.split('\n');
      if (removedLines[removedLines.length - 1] === '') {
        removedLines.pop();
      }
      oldLineIndex += removedLines.length;
    } else if (isUnchanged && lastWasRemoved) {
      // Check if this "unchanged" content is actually new
      // It's new if it doesn't match the removed content and
      // it's not present in the old text at the current position
      const isActuallyNew = entryValue !== removedContent &&
        (oldLineIndex >= oldLines.length || 
         oldLines[oldLineIndex].trim() !== entryValue.trim());
      
      if (isActuallyNew) {
        // This should be marked as added, not unchanged
        corrected.push({
          ...entry,
          added: true
        });
      } else {
        corrected.push(entry);
        lastWasRemoved = false;
      }
      
      // Advance old line index for unchanged lines
      const unchangedLines = entryValue.split('\n');
      if (unchangedLines[unchangedLines.length - 1] === '') {
        unchangedLines.pop();
      }
      oldLineIndex += unchangedLines.length;
    } else if (entry.added && lastWasRemoved && removedContent) {
      // Bug #2: Check if the added entry contains the removed content as a complete line match
      // This happens when diffLines incorrectly marks unchanged content as removed
      // Only apply this fix when the removed content matches a complete line in the added content
      const removedLines = removedContent.split('\n');
      if (removedLines[removedLines.length - 1] === '') {
        removedLines.pop();
      }
      const addedLines = entryValue.split('\n');
      if (addedLines[addedLines.length - 1] === '') {
        addedLines.pop();
      }
      
      // Check if added content starts with the removed content as complete lines
      const removedPrefix = removedLines.join('\n');
      const addedValue = addedLines.join('\n');
      
      // Only split if: 1) added starts with removed, AND 2) there's more content after
      // AND 3) the removed content ends with a newline in the added value
      // This ensures we're only fixing the case where a new line was added after existing content
      const addedStartsWithRemoved = addedValue.startsWith(removedPrefix);
      const hasMoreContent = addedValue.length > removedPrefix.length;
      const newlineAfterPrefix = addedValue.charAt(removedPrefix.length) === '\n';
      
      if (addedStartsWithRemoved && hasMoreContent && newlineAfterPrefix) {
        // The removed content is actually unchanged - convert the removed entry to unchanged
        // and split the added entry into unchanged (common part) and added (new part)
        
        // Remove the last "removed" entry and replace with "unchanged"
        corrected.pop();
        corrected.push({
          value: removedContent,
          added: undefined,
          removed: undefined
        });
        
        // The new part is what's left after the common prefix (skip the newline)
        const newContent = addedValue.slice(removedPrefix.length + 1);
        if (newContent) {
          corrected.push({
            value: newContent + (entryValue.endsWith('\n') ? '\n' : ''),
            added: true,
            removed: undefined
          });
        }
        
        lastWasRemoved = false;
      } else if (removedLines.length > addedLines.length) {
        // Check if the last N lines of removed match added lines exactly
        // This handles the case where lines are removed from the end
        // e.g., old: "line one\nline to remove", new: "line one"
        const removedSuffixLines = removedLines.slice(addedLines.length);
        const removedPrefixLines = removedLines.slice(0, addedLines.length);
        const removedPrefixValue = removedPrefixLines.join('\n');
        
        // Check if the first part of removed matches added exactly
        if (removedPrefixValue === addedValue) {
          // Remove the last "removed" entry
          corrected.pop();
          
          // Add the common part as unchanged
          corrected.push({
            value: entryValue + (removedContent.endsWith('\n') ? '\n' : ''),
            added: undefined,
            removed: undefined
          });
          
          // Add the removed part (lines only in old)
          const removedSuffix = removedSuffixLines.join('\n') + (removedContent.endsWith('\n') ? '\n' : '');
          corrected.push({
            value: removedSuffix,
            added: undefined,
            removed: true
          });
          
          lastWasRemoved = false;
        }
      } else {
        corrected.push(entry);
        lastWasRemoved = false;
      }
    } else {
      lastWasRemoved = entry.added || false;
      corrected.push(entry);
      
      // Advance old line index
      if (!entry.added && !entry.removed) {
        const unchangedLines = entryValue.split('\n');
        if (unchangedLines[unchangedLines.length - 1] === '') {
          unchangedLines.pop();
        }
        oldLineIndex += unchangedLines.length;
      }
    }
  }

  return corrected;
}

// ============================================================================
// Filter Functions
// ============================================================================

/**
 * Strip comments from text based on common comment patterns
 * Supports: //, #, --, block comments, and HTML comments
 *
 * @param {string} text - Input text
 * @returns {string} Text with comments removed
 */
export function stripComments(text) {
  if (!text) return text;
  
  const lines = text.split('\n');
  const processedLines = lines.map(line => {
    // Check for line comments first (these take precedence)
    // Pattern: // comment, # comment, -- comment
    let result = line;
    
    // Remove // comments
    const slashCommentIndex = result.indexOf('//');
    if (slashCommentIndex !== -1) {
      result = result.substring(0, slashCommentIndex);
    }
    
    // Remove # comments (but not in strings)
    const hashIndex = result.indexOf('#');
    if (hashIndex !== -1 && !isInsideString(result, hashIndex)) {
      result = result.substring(0, hashIndex);
    }
    
    // Remove -- comments (SQL style, but not in strings)
    const dashIndex = result.indexOf('--');
    if (dashIndex !== -1 && !isInsideString(result, dashIndex)) {
      result = result.substring(0, dashIndex);
    }
    
    // Remove /* */ block comments
    while (result.includes('/*') && result.includes('*/')) {
      const start = result.indexOf('/*');
      const end = result.indexOf('*/', start) + 2;
      if (end > start) {
        result = result.substring(0, start) + result.substring(end);
      } else {
        break;
      }
    }
    
    // Remove <!-- --> HTML comments
    while (result.includes('<!--') && result.includes('-->')) {
      const start = result.indexOf('<!--');
      const end = result.indexOf('-->', start) + 3;
      if (end > start) {
        result = result.substring(0, start) + result.substring(end);
      } else {
        break;
      }
    }
    
    return result;
  });
  
  return processedLines.join('\n');
}

/**
 * Check if a position in a string is inside a quoted string
 * 
 * @param {string} str - The string to check
 * @param {number} pos - Position to check
 * @returns {boolean} True if inside a string
 */
function isInsideString(str, pos) {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;
  
  for (let i = 0; i < pos; i++) {
    const char = str[i];
    const prevChar = i > 0 ? str[i - 1] : '';
    
    if (escaped) {
      escaped = false;
      continue;
    }
    
    if (char === '\\') {
      escaped = true;
      continue;
    }
    
    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    } else if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    }
  }
  
  return inSingleQuote || inDoubleQuote;
}

/**
 * Normalize whitespace in text
 * - Trim leading/trailing whitespace from each line
 * - Collapse multiple consecutive spaces to single space
 * - Remove empty lines
 * 
 * @param {string} text - Input text
 * @returns {string} Text with normalized whitespace
 */
export function normalizeWhitespace(text) {
  if (!text) return text;
  
  return text
    .split('\n')
    .map(line => line.trim().replace(/\s+/g, ' '))
    .filter(line => line.length > 0)
    .join('\n');
}

// ============================================================================
// Two-Pass Diff: Region Processing
// ============================================================================

/**
 * Process a single changed region with enhanced move detection
 * 
 * @param {Object} region - Changed region object
 * @param {Object} diffLib - Diff library functions
 * @param {Object} options - Options for processing
 * @returns {Array} Classified diff results for this region
 */
export async function processChangedRegion(region, diffLib, options = {}) {
  const { diffLines, diffWords, diffChars } = diffLib;
  const { modeToggles = { lines: true, words: true, chars: true } } = options;
  const language = options.language || null;
  
  // Handle edge cases
  if (region.oldLines.length === 0 && region.newLines.length === 0) {
    return [];
  }
  
  // Special case: pure additions (empty old region)
  if (region.oldLines.length === 0) {
    return region.newLines.map(line => ({
      value: line + '\n',
      added: true,
      removed: false,
      classification: 'added',
      _regionOldStart: region.oldStart,
      _regionNewStart: region.newStart
    }));
  }
  
  // Special case: pure deletions (empty new region)
  if (region.newLines.length === 0) {
    return region.oldLines.map(line => ({
      value: line + '\n',
      added: false,
      removed: true,
      classification: 'removed',
      _regionOldStart: region.oldStart,
      _regionNewStart: region.newStart
    }));
  }
  
  // Join lines back into text for diffLines
  const oldText = region.oldLines.join('\n');
  const newText = region.newLines.join('\n');
  
  // Run primary diff on this region
  const rawResults = diffLines(oldText, newText);
  
  // Post-process to fix diffLines classification bug
  const fixedResults = fixDiffLinesClassification(rawResults, oldText);
  
  // Run modified line detection pipeline (async)
  const classified = await detectModifiedLines(fixedResults, diffWords, diffChars, {
    detectMoves: options.detectMoves,
    fastThreshold: options.fastThreshold,
    modifiedThreshold: options.modifiedThreshold,
    modeToggles,
    language,
    normalizeDelimiters: options.normalizeDelimiters
  }, oldText, newText);
  
  // Adjust indices to reflect position in original text
  return classified.map(result => ({
    ...result,
    _regionOldStart: region.oldStart,
    _regionNewStart: region.newStart
  }));
}

// ============================================================================
// Two-Pass Diff: LCS Preprocessing for Performance
// ============================================================================
// Two-Pass Diff: LCS Preprocessing for Performance
// ============================================================================

/**
 * Represents an unchanged line marker from LCS preprocessing
 * @typedef {Object} UnchangedMarker
 * @property {number} oldIndex - Index in old text
 * @property {number} newIndex - Index in new text
 * @property {string} line - The line content
 */

/**
 * Represents a changed region between unchanged markers
 * @typedef {Object} ChangedRegion
 * @property {number} oldStart - Start index in old text (inclusive)
 * @property {number} oldEnd - End index in old text (exclusive)
 * @property {number} newStart - Start index in new text (inclusive)
 * @property {number} newEnd - End index in new text (exclusive)
 * @property {string[]} oldLines - Lines from old text in this region
 * @property {string[]} newLines - Lines from new text in this region
 */

/**
 * Pass 1: Use patienceLCS to identify unchanged line sequences
 * Creates a set of markers for lines that are identical between versions
 * 
 * Verifies that LCS matches are actually valid (works around potential
 * bugs in LCS implementations that may return false positives)
 * 
 * @param {string[]} oldLines - Lines from old text
 * @param {string[]} newLines - Lines from new text
 * @returns {Object} Object containing unchangedMarkers and LCS result
 */
export function identifyUnchangedLines(oldLines, newLines) {
  // Run Patience LCS to find longest common subsequence
  const lcsResult = patienceLCS(oldLines, newLines);
  
  // Create a Set for O(1) lookup of unchanged line indices
  const unchangedOldIndices = new Set();
  const unchangedNewIndices = new Set();
  const unchangedMarkers = [];
  
  for (const match of lcsResult) {
    // Verify the match is valid - the lines must actually be equal
    const oldLine = oldLines[match.aIndex];
    const newLine = newLines[match.bIndex];
    
    if (oldLine === newLine) {
      unchangedOldIndices.add(match.aIndex);
      unchangedNewIndices.add(match.bIndex);
      unchangedMarkers.push({
        oldIndex: match.aIndex,
        newIndex: match.bIndex,
        line: match.line
      });
    }
    // If lines don't match, this is a false positive from LCS - skip it
  }
  
  return {
    unchangedMarkers,
    unchangedOldIndices,
    unchangedNewIndices,
    lcsResult
  };
}

/**
 * Pass 1b: Extract changed regions based on unchanged markers
 * Divides the text into contiguous sections of modifications
 * 
 * @param {string[]} oldLines - Lines from old text
 * @param {string[]} newLines - Lines from new text
 * @param {Set<number>} unchangedOldIndices - Set of unchanged indices in old text
 * @param {Set<number>} unchangedNewIndices - Set of unchanged indices in new text
 * @returns {ChangedRegion[]} Array of changed regions
 */
export function extractChangedRegions(oldLines, newLines, unchangedOldIndices, unchangedNewIndices) {
  const regions = [];
  let oldIndex = 0;
  let newIndex = 0;
  
  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    // Skip unchanged lines at the start
    while (oldIndex < oldLines.length && unchangedOldIndices.has(oldIndex) &&
           newIndex < newLines.length && unchangedNewIndices.has(newIndex)) {
      oldIndex++;
      newIndex++;
    }
    
    // Check if we've reached the end
    if (oldIndex >= oldLines.length && newIndex >= newLines.length) {
      break;
    }
    
    // Find the end of this changed region
    const regionOldStart = oldIndex;
    const regionNewStart = newIndex;
    
    // Advance through changed lines
    while (oldIndex < oldLines.length && !unchangedOldIndices.has(oldIndex)) {
      oldIndex++;
    }
    while (newIndex < newLines.length && !unchangedNewIndices.has(newIndex)) {
      newIndex++;
    }
    
    // Create the region
    regions.push({
      oldStart: regionOldStart,
      oldEnd: oldIndex,
      newStart: regionNewStart,
      newEnd: newIndex,
      oldLines: oldLines.slice(regionOldStart, oldIndex),
      newLines: newLines.slice(regionNewStart, newIndex)
    });
    
    // Skip the unchanged line that ends this region
    if (oldIndex < oldLines.length && unchangedOldIndices.has(oldIndex)) {
      oldIndex++;
    }
    if (newIndex < newLines.length && unchangedNewIndices.has(newIndex)) {
      newIndex++;
    }
  }
  
  return regions;
}



/**
 * Merge unchanged markers with processed changed regions
 * Reconstructs the complete diff result in correct order
 * 
 * @param {UnchangedMarker[]} unchangedMarkers - Unchanged line markers
 * @param {Array[]} regionResults - Results from each changed region
 * @param {ChangedRegion[]} regions - The changed region definitions
 * @param {string[]} oldLines - Original old lines
 * @param {string[]} newLines - Original new lines
 * @returns {Array} Complete merged diff results
 */
export function mergeTwoPassResults(unchangedMarkers, regionResults, regions, oldLines, newLines) {
  const merged = [];
  
  // Sort unchanged markers by oldIndex (and newIndex)
  const sortedMarkers = [...unchangedMarkers].sort((a, b) => {
    if (a.oldIndex !== b.oldIndex) return a.oldIndex - b.oldIndex;
    return a.newIndex - b.newIndex;
  });
  
  // Create combined list of events sorted by position
  const events = [];
  
  // Add unchanged markers
  for (const marker of sortedMarkers) {
    events.push({
      type: 'unchanged',
      position: marker.oldIndex,
      marker
    });
  }
  
  // Add regions
  for (let i = 0; i < regions.length; i++) {
    events.push({
      type: 'region',
      position: regions[i].oldStart,
      regionIndex: i,
      region: regions[i]
    });
  }
  
  // Sort by position
  events.sort((a, b) => a.position - b.position);
  
  // Process events in order
  for (const event of events) {
    if (event.type === 'unchanged') {
      merged.push({
        value: event.marker.line + '\n',
        added: false,
        removed: false,
        classification: 'unchanged'
      });
    } else if (event.type === 'region') {
      const regionResult = regionResults[event.regionIndex];
      if (regionResult && regionResult.length > 0) {
        merged.push(...regionResult);
      }
    }
  }
  
  return merged;
}

/**
 * Convert merged two-pass results to standard diff format
 * Ensures compatibility with existing output expectations
 * 
 * @param {Array} mergedResults - Results from mergeTwoPassResults
 * @returns {Object} Object with results array and stats
 */
export function finalizeTwoPassResults(mergedResults) {
  const stats = calculateStats(mergedResults);
  
  return {
    results: mergedResults,
    stats
  };
}

// ============================================================================
// Complexity Limits and Fast Mode
// ============================================================================

/**
 * Check if the diff exceeds complexity limits
 * Returns an object with limit status information
 * 
 * @param {string[]} oldLines - Old text split into lines
 * @param {string[]} newLines - New text split into lines
 * @param {Object} diffLib - Diff library with diffLines function
 * @param {Object} config - Configuration object with limits
 * @returns {Object} Limit check result { exceeded: boolean, reason: string|null, graphSize: number }
 */
export function checkComplexityLimits(oldLines, newLines, diffLib, config = CONFIG) {
  const maxLines = config.MAX_LINES || 50000;
  const maxGraphVertices = config.MAX_GRAPH_VERTICES || 100000;
  
  // Check line count limit
  if (oldLines.length > maxLines || newLines.length > maxLines) {
    return {
      exceeded: true,
      reason: 'line_count',
      lineCount: Math.max(oldLines.length, newLines.length),
      maxLines,
      graphSize: 0
    };
  }
  
  // Estimate graph size by running a quick diffLines
  // This gives us the number of changed regions
  const oldText = oldLines.join('\n');
  const newText = newLines.join('\n');
  const quickDiff = diffLib.diffLines(oldText, newText);
  
  // Count removed and added lines
  let removedCount = 0;
  let addedCount = 0;
  
  for (const change of quickDiff) {
    if (change.removed) {
      removedCount += change.value.split('\n').filter(l => l.length > 0 || change.value === '\n').length;
    } else if (change.added) {
      addedCount += change.value.split('\n').filter(l => l.length > 0 || change.value === '\n').length;
    }
  }
  
  // Graph size is roughly removed × added for the similarity matrix
  const graphSize = removedCount * addedCount;
  
  if (graphSize > maxGraphVertices) {
    return {
      exceeded: true,
      reason: 'graph_size',
      removedCount,
      addedCount,
      graphSize,
      maxGraphVertices
    };
  }
  
  return {
    exceeded: false,
    reason: null,
    removedCount,
    addedCount,
    graphSize,
    maxLines,
    maxGraphVertices
  };
}

/**
 * Run fast mode diff when complexity limits are exceeded
 * This uses a simplified approach without detailed similarity analysis
 * 
 * @param {string} oldText - Previous version text
 * @param {string} newText - Current version text
 * @param {Object} diffLib - Diff library functions
 * @param {Object} limitInfo - Information about which limit was exceeded
 * @param {Object} options - Configuration options
 * @returns {Object} Simplified diff results with limit status
 */
export async function runFastMode(oldText, newText, diffLib, limitInfo, options = {}) {
  const { diffLines, diffWords, diffChars } = diffLib;
  
  // Get mode toggles (default all enabled)
  const modeToggles = options?.modeToggles || { lines: true, words: true, chars: true };
  
  // Run basic line-level diff
  const rawResults = diffLines(oldText, newText);
  
  // Fix any classification issues
  const results = fixDiffLinesClassification(rawResults, oldText);
  
  // Simple classification without detailed similarity analysis
  const classified = results.map(change => {
    let classification = 'unchanged';
    if (change.added) classification = 'added';
    else if (change.removed) classification = 'removed';
    
    return {
      ...change,
      classification
    };
  });
  
  // Generate word-level diffs for modified lines when words mode is enabled
  if (modeToggles.words) {
    // Find consecutive removed/added pairs and mark them as modified
    for (let i = 0; i < classified.length - 1; i++) {
      const current = classified[i];
      const next = classified[i + 1];
      
      if (current.removed && next.added) {
        // This is a modification pair - generate word diff
        current.classification = 'modified';
        next.classification = 'modified';
        
        // Generate word-level diff
        if (diffWords) {
          current.wordDiff = diffWords(current.value, next.value);
          next.wordDiff = current.wordDiff;
        }
        
        // Generate char-level diff if chars mode is enabled and change is small
        if (modeToggles.chars && diffChars) {
          const totalLength = current.value.length + next.value.length;
          if (totalLength < 200) { // Only for small changes to maintain performance
            current.charDiff = diffChars(current.value, next.value);
            next.charDiff = current.charDiff;
          }
        }
      }
    }
  }
  
  const stats = calculateStats(classified);
  
  return {
    results: classified,
    stats,
    limitInfo: {
      ...limitInfo,
      fastMode: true
    }
  };
}

// ============================================================================
// Complete Diff Pipeline
// ============================================================================

/**
 * Run the complete diff pipeline including primary diff and modified line detection
 * 
 * Two-pass mode (default for files > 100 lines):
 * - Pass 1: Use patienceLCS to identify unchanged line sequences
 * - Pass 2: Run full diff pipeline only on changed regions
 * 
 * This reduces computational complexity for files with large unchanged sections,
 * significantly improving performance on typical code diffs where most lines
 * remain the same.
 * 
 * Complexity Limits:
 * - Checks total line count against MAX_LINES threshold
 * - Estimates graph size (removed × added) against MAX_GRAPH_VERTICES
 * - Falls back to fast mode when limits exceeded
 * 
 * @param {string} oldText - Previous version text
 * @param {string} newText - Current version text
 * @param {Object} diffLib - Object containing diffLines, diffWords, and diffChars functions
 * @param {Object} options - Configuration options
 * @param {boolean} options.useTwoPass - Enable two-pass diff (default: auto for large files)
 * @param {number} options.twoPassThreshold - Line count threshold for auto-enabling (default: 100)
 * @param {Object} options.config - Override default CONFIG values for limits
 * @returns {Object} Object containing results array, stats, and limit status
 */
export async function runDiffPipeline(oldText, newText, diffLib, options = {}) {
  const { diffLines, diffWords, diffChars } = diffLib;
  
  // Clear content hash cache before starting new diff operation
  clearContentHashCache();

  try {
    // Apply filters if specified
    const filterOptions = options?.filterOptions || {};
    const processedOldText = applyFilters(oldText, filterOptions);
    const processedNewText = applyFilters(newText, filterOptions);

    // Get mode toggles (default all enabled)
    const modeToggles = options?.modeToggles || { lines: true, words: true, chars: true };
    
    // Get line arrays for limit checking
    const oldLines = processedOldText.split('\n');
    const newLines = processedNewText.split('\n');
    
    // Merge config from options with defaults
    const config = { ...CONFIG, ...options?.config };
    
    // Check complexity limits before processing
    const limitCheck = checkComplexityLimits(oldLines, newLines, diffLib, config);
    
    // Check both property naming conventions (camelCase from UI, UPPER_SNAKE_CASE from CONFIG)
    const enableFastMode = config.ENABLE_FAST_MODE !== false && config.enableFastMode !== false;
    
    if (limitCheck.exceeded && enableFastMode) {
      // Fall back to fast mode (async)
      const fastResult = await runFastMode(processedOldText, processedNewText, diffLib, limitCheck, options);
      
      // Add debug info if requested
      if (options?.debug) {
        fastResult.debug = {
          ...fastResult.debug,
          complexityLimitTriggered: true,
          limitCheck
        };
        fastResult.cacheStats = getCacheStats();
      }
      
      return fastResult;
    }
    
    // Determine if we should use two-pass mode
    const totalLines = oldLines.length + newLines.length;
    const twoPassThreshold = options?.twoPassThreshold ?? 100;
    const useTwoPass = options?.useTwoPass ?? (totalLines > twoPassThreshold);
    
    let result;
    
    // For small files or when disabled, use single-pass mode
    if (!useTwoPass) {
      result = await runSinglePassDiff(processedOldText, processedNewText, diffLib, options, modeToggles);
    } else {
      // Two-pass diff mode (async)
      result = await runTwoPassDiff(oldLines, newLines, diffLib, options, modeToggles);
    }
    
    // Include limit info (limits not exceeded)
    result.limitInfo = {
      exceeded: false,
      fastMode: false,
      ...limitCheck
    };
    
    // Capture cache stats before clearing for debug purposes
    if (options && options.debug) {
      result.cacheStats = getCacheStats();
    }
    
    return result;
    
  } finally {
    // Always clear cache after diff operation to prevent memory leaks
    clearContentHashCache();
  }
}

/**
 * Single-pass diff (original implementation)
 * Used for small files or when two-pass is disabled
 * 
 * @param {string} processedOldText - Filtered old text
 * @param {string} processedNewText - Filtered new text
 * @param {Object} diffLib - Diff library functions
 * @param {Object} options - Configuration options
 * @param {Object} modeToggles - Mode toggles
 * @returns {Object} Diff results and stats
 */
async function runSinglePassDiff(processedOldText, processedNewText, diffLib, options, modeToggles) {
  const { diffLines, diffWords, diffChars } = diffLib;
  
  // Detect language for nested diff processing
  const language = detectCommonLanguage(processedOldText, processedNewText);
  
  // Run primary diff - always use line-level for the main comparison
  const rawResults = diffLines(processedOldText, processedNewText);

  // Detect moves in unchanged lines BEFORE fixDiffLinesClassification
  // (fixDiffLinesClassification can incorrectly mark moved content as added)
  const virtualMoveBlocks = (options?.detectMoves !== false)
    ? detectMovesInUnchangedLines(rawResults, processedOldText, processedNewText)
    : [];

  // Post-process to fix diffLines classification bug (v5.1.0)
  const results = fixDiffLinesClassification(rawResults, processedOldText);

  // Run modified line detection pipeline with mode toggles (async)
  // Pass virtual blocks so they can be included in move detection
  const classified = await detectModifiedLines(results, diffWords, diffChars, {
    detectMoves: options?.detectMoves,
    fastThreshold: options?.fastThreshold,
    modifiedThreshold: options?.modifiedThreshold,
    modeToggles,
    language,
    normalizeDelimiters: options?.normalizeDelimiters,
    _virtualMoveBlocks: virtualMoveBlocks
  }, processedOldText, processedNewText);

  // Apply slider correction if enabled
  let finalResults = classified;
  const DEBUG_STATS = options?.debug ? { cacheStats: getCacheStats() } : {};
  
  if (options?.correctSliders) {
    const sliders = detectSliders(classified, {
      language,
      debug: options?.debug,
      ...options?.sliderOptions
    });
    
    if (sliders.length > 0) {
      finalResults = correctSliders(classified, sliders, {
        correctSliders: true,
        language,
        correctionThreshold: options?.correctionThreshold,
        ...options?.sliderOptions
      });
      
      // Add debug info about sliders
      if (options?.debug) {
        debugStats.sliders = {
          detected: sliders.length,
          corrected: finalResults.filter(r => r._sliderCorrected).length,
          details: sliders.slice(0, 5) // Show first 5 for debugging
        };
      }
    }
  }

  const stats = calculateStats(finalResults);
  
  // Include cache stats for debugging (in development)
  const debugStats = options?.debug ? { cacheStats: getCacheStats() } : {};

  return {
    results: finalResults,
    stats,
    ...debugStats
  };
}

/**
 * Two-pass diff implementation
 * Pass 1: Identify unchanged lines with LCS
 * Pass 2: Process only changed regions
 * 
 * @param {string[]} oldLines - Old text as array of lines
 * @param {string[]} newLines - New text as array of lines
 * @param {Object} diffLib - Diff library functions
 * @param {Object} options - Configuration options
 * @param {Object} modeToggles - Mode toggles
 * @returns {Object} Diff results and stats
 */
async function runTwoPassDiff(oldLines, newLines, diffLib, options, modeToggles) {
  // Detect language for nested diff processing
  const language = detectCommonLanguage(oldLines.join('\n'), newLines.join('\n'));
  
  // Pass 1: Identify unchanged lines using LCS
  const { 
    unchangedMarkers, 
    unchangedOldIndices, 
    unchangedNewIndices,
    lcsResult 
  } = identifyUnchangedLines(oldLines, newLines);
  
  // If very few unchanged lines, two-pass won't help - fall back to single-pass
  // Also fall back if LCS returned suspicious results (more matches than makes sense)
  const minUnchangedThreshold = 0.05; // At least 5% of lines should be unchanged
  const totalLines = oldLines.length + newLines.length;
  const unchangedRatio = unchangedMarkers.length * 2 / totalLines;
  
  if (unchangedMarkers.length === 0 || unchangedRatio < minUnchangedThreshold) {
    const oldText = oldLines.join('\n');
    const newText = newLines.join('\n');
    const result = await runSinglePassDiff(oldText, newText, diffLib, options, modeToggles);
    
    if (options?.debug) {
      result.twoPassInfo = {
        unchangedLines: unchangedMarkers.length,
        changedRegions: 0,
        totalOldLines: oldLines.length,
        totalNewLines: newLines.length,
        lcsMatches: lcsResult.length,
        fallback: 'too_few_unchanged'
      };
    }
    
    return result;
  }
  
  // Pass 1b: Extract changed regions
  const regions = extractChangedRegions(
    oldLines, 
    newLines, 
    unchangedOldIndices, 
    unchangedNewIndices
  );
  
  // If no changed regions, return all unchanged
  if (regions.length === 0) {
    const results = oldLines.map(line => ({
      value: line + '\n',
      added: false,
      removed: false,
      classification: 'unchanged'
    }));
    return {
      results,
      stats: calculateStats(results)
    };
  }
  
  // Pass 2: Process each changed region (async)
  const regionPromises = regions.map(region => 
    processChangedRegion(region, diffLib, {
      detectMoves: options?.detectMoves,
      fastThreshold: options?.fastThreshold,
      modifiedThreshold: options?.modifiedThreshold,
      modeToggles,
      language,
      normalizeDelimiters: options?.normalizeDelimiters
    })
  );
  const regionResults = await Promise.all(regionPromises);
  
  // Merge unchanged markers with processed regions
  const mergedResults = mergeTwoPassResults(
    unchangedMarkers,
    regionResults,
    regions,
    oldLines,
    newLines
  );
  
  // Finalize and return
  let finalizedResults = finalizeTwoPassResults(mergedResults);
  
  // Apply slider correction if enabled
  if (options?.correctSliders) {
    const sliders = detectSliders(finalizedResults.results, {
      language,
      debug: options?.debug,
      ...options?.sliderOptions
    });
    
    if (sliders.length > 0) {
      finalizedResults.results = correctSliders(finalizedResults.results, sliders, {
        correctSliders: true,
        language,
        correctionThreshold: options?.correctionThreshold,
        ...options?.sliderOptions
      });
    }
  }
  
  const result = { results: finalizedResults.results, stats: calculateStats(finalizedResults.results) };
  
  // Include debug stats if requested
  if (options?.debug) {
    result.cacheStats = getCacheStats();
    result.twoPassInfo = {
      unchangedLines: unchangedMarkers.length,
      changedRegions: regions.length,
      totalOldLines: oldLines.length,
      totalNewLines: newLines.length,
      lcsMatches: lcsResult.length,
      fallback: false
    };
    
    // Add slider debug info if correction was applied
    if (options?.correctSliders) {
      const sliders = detectSliders(finalizedResults.results, { language });
      result.sliders = {
        detected: sliders.length,
        corrected: finalizedResults.results.filter(r => r._sliderCorrected).length,
        details: sliders.slice(0, 5) // Show first 5 for debugging
      };
    }
  }
  
  return result;
}

export default {
  CONFIG,
  generateLineSignature,
  signatureHammingDistance,
  estimateSimilarity,
  calculateSimilarity,
  identifyChangeBlocks,
  detectBlockMovesFast,
  detectModifiedLines,
  fixDiffLinesClassification,
  calculateStats,
  runDiffPipeline,
  calculateSimilarityEnhanced,
  quickTokenSimilarity,
  calculateSimilarityFull,
  batchCalculateSimilarity,
  clearContentHashCache,
  getCacheStats,
  TOKEN_TYPES,
  // Two-pass diff exports
  identifyUnchangedLines,
  extractChangedRegions,
  processChangedRegion,
  mergeTwoPassResults,
  finalizeTwoPassResults,
  // Complexity limit exports
  checkComplexityLimits,
  runFastMode
};
