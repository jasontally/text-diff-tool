/**
 * Block Move Detection Module
 * 
 * Git-style hash-based block move detection algorithm.
 * Optimized for reliability and performance with browser Web Worker support.
 * 
 * Copyright (c) 2026 Jason Tally and contributors
 * SPDX-License-Identifier: MIT
 */

// ============================================================================
// Configuration Constants
// ============================================================================

export const BLOCK_MOVE_CONFIG = {
  MIN_BLOCK_SIZE: 3,              // Minimum lines for a block move
  MAX_BLOCK_SIZE: 100,            // Maximum block size to prevent memory issues
  MIN_SIMILARITY: 0.65,           // Minimum similarity threshold
  MOVE_THRESHOLD: 0.70,           // High similarity for "pure" moves
  MAX_BLOCKS_RETURNED: 100,       // Maximum number of blocks to return
  
  // Performance limits
  DEFAULT_TIMEOUT: 5000,          // 5 seconds default timeout
  DEFAULT_MAX_OPERATIONS: 100000, // Max operations before stopping
  
  // File size limits
  MAX_LINES_FOR_DETECTION: 50000, // Skip for very large files
  MIN_LINES_FOR_DETECTION: 3,     // Minimum changes to enable detection (allow small test cases)
};

// ============================================================================
// Error Types
// ============================================================================

export class TimeoutError extends Error {
  constructor(message, partialResults = null) {
    super(message);
    this.name = 'TimeoutError';
    this.partialResults = partialResults;
  }
}

export class OperationLimitError extends Error {
  constructor(message, partialResults = null) {
    super(message);
    this.name = 'OperationLimitError';
    this.partialResults = partialResults;
  }
}

// ============================================================================
// Simple Hash Function (djb2 variant - fast and well-distributed)
// ============================================================================

/**
 * Generate a fast hash for a line of text
 * Uses djb2 algorithm which is simple and effective
 * 
 * @param {string} line - The line to hash
 * @param {boolean} ignoreWhitespace - Whether to normalize whitespace first
 * @returns {number} Hash value
 */
export function hashLineSimple(line, ignoreWhitespace = false) {
  if (!line || line.length === 0) return 0;
  
  let normalized = line;
  if (ignoreWhitespace) {
    normalized = line.trim().replace(/\s+/g, ' ');
  }
  
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash) + normalized.charCodeAt(i); // hash * 33 + char
    hash = hash >>> 0; // Convert to unsigned 32-bit
  }
  
  return hash;
}

// ============================================================================
// Operation Tracking
// ============================================================================

/**
 * Create an operation tracker with timeout and limit protection
 * 
 * @param {Object} options - Configuration options
 * @returns {Object} Tracker object with checkTimeout() function
 */
function createOperationTracker(options = {}) {
  const timeout = options.timeout || BLOCK_MOVE_CONFIG.DEFAULT_TIMEOUT;
  const maxOperations = options.maxOperations || BLOCK_MOVE_CONFIG.DEFAULT_MAX_OPERATIONS;
  const startTime = performance.now();
  let operations = 0;
  
  return {
    checkTimeout: () => {
      operations++;
      
      // Check every 1000 operations to reduce overhead
      if (operations % 1000 === 0) {
        const elapsed = performance.now() - startTime;
        if (elapsed > timeout) {
          throw new TimeoutError(`Block move detection timed out after ${timeout}ms`, { operations, elapsed });
        }
      }
      
      if (operations > maxOperations) {
        throw new OperationLimitError(`Operation limit exceeded: ${maxOperations}`, { operations });
      }
      
      return { operations };
    },
    getStats: () => ({
      operations,
      elapsed: performance.now() - startTime
    })
  };
}

// ============================================================================
// Block Detection Algorithm
// ============================================================================

/**
 * Detect block moves using git-style hash-based algorithm
 * 
 * Algorithm:
 * 1. Hash all lines (O(n))
 * 2. Build index of added lines by hash (O(n))
 * 3. For each removed line, find matching added lines by hash (O(n))
 * 4. Grow contiguous blocks from matching pairs (O(n * maxBlockSize))
 * 5. Filter overlapping blocks and return results
 * 
 * @param {Array} oldLines - Array of line objects { line: string, index: number }
 * @param {Array} newLines - Array of line objects { line: string, index: number }
 * @param {Object} options - Configuration options
 * @returns {Object} Result with blocks array and metadata
 */
export function detectBlockMoves(oldLines, newLines, options = {}) {
  const {
    ignoreWhitespace = false,
    minBlockSize = BLOCK_MOVE_CONFIG.MIN_BLOCK_SIZE,
    maxBlockSize = BLOCK_MOVE_CONFIG.MAX_BLOCK_SIZE,
    minSimilarity = BLOCK_MOVE_CONFIG.MIN_SIMILARITY,
    timeout = BLOCK_MOVE_CONFIG.DEFAULT_TIMEOUT,
    maxOperations = BLOCK_MOVE_CONFIG.DEFAULT_MAX_OPERATIONS,
    maxBlocksReturned = BLOCK_MOVE_CONFIG.MAX_BLOCKS_RETURNED
  } = options;
  
  // Check file size limits
  const totalLines = oldLines.length + newLines.length;
  if (totalLines > BLOCK_MOVE_CONFIG.MAX_LINES_FOR_DETECTION) {
    return {
      blocks: [],
      partial: true,
      reason: `File too large: ${totalLines} lines exceeds limit of ${BLOCK_MOVE_CONFIG.MAX_LINES_FOR_DETECTION}`,
      stats: { totalLines, oldLines: oldLines.length, newLines: newLines.length }
    };
  }
  
  if (totalLines < BLOCK_MOVE_CONFIG.MIN_LINES_FOR_DETECTION) {
    return {
      blocks: [],
      partial: false,
      reason: 'Too few changes for block move detection',
      stats: { totalLines }
    };
  }
  
  const tracker = createOperationTracker({ timeout, maxOperations });
  
  try {
    // Phase 1: Hash all lines
    tracker.checkTimeout();
    const removedHashes = oldLines.map(l => hashLineSimple(l.line, ignoreWhitespace));
    const addedHashes = newLines.map(l => hashLineSimple(l.line, ignoreWhitespace));
    
    // Phase 2: Build index of added lines
    tracker.checkTimeout();
    const addedIndex = new Map(); // hash -> array of indices
    
    for (let i = 0; i < addedHashes.length; i++) {
      tracker.checkTimeout();
      const hash = addedHashes[i];
      if (!addedIndex.has(hash)) {
        addedIndex.set(hash, []);
      }
      addedIndex.get(hash).push(i);
    }
    
    // Phase 3: Find all potential block starts
    tracker.checkTimeout();
    const potentialBlocks = [];
    
    for (let removedIdx = 0; removedIdx < removedHashes.length; removedIdx++) {
      tracker.checkTimeout();
      const hash = removedHashes[removedIdx];
      const matches = addedIndex.get(hash);
      
      if (!matches || matches.length === 0) continue;
      
      // For each match, try to grow a block
      for (const addedIdx of matches) {
        tracker.checkTimeout();
        
        const block = growBlock(
          removedHashes, 
          addedHashes, 
          removedIdx, 
          addedIdx, 
          minBlockSize,
          maxBlockSize,
          tracker
        );
        
        if (block && block.size >= minBlockSize) {
          potentialBlocks.push({
            ...block,
            removedStart: removedIdx,
            addedStart: addedIdx,
            // Store references to original line objects for similarity calculation
            removedLines: oldLines.slice(removedIdx, removedIdx + block.size),
            addedLines: newLines.slice(addedIdx, addedIdx + block.size)
          });
        }
      }
    }
    
    // Phase 4: Calculate similarity and filter blocks
    tracker.checkTimeout();
    const scoredBlocks = scoreBlocks(potentialBlocks, minSimilarity, tracker);
    
    // Phase 5: Remove overlapping blocks (prefer larger ones)
    tracker.checkTimeout();
    const filteredBlocks = filterOverlappingBlocks(scoredBlocks, maxBlocksReturned, tracker);
    
    // Convert to final format
    // Include original line positions to detect if content actually moved
    const blocks = filteredBlocks.map(block => {
      const fromLine = oldLines[block.removedStart];
      const toLine = newLines[block.addedStart];
      
      // Get the original block to check for position arrays
      const originalBlock = fromLine?._originalBlock;
      
      return {
        type: 'block-moved',
        from: fromLine.index,
        to: toLine.index,
        size: block.size,
        similarity: block.similarity,
        fromBlock: fromLine?.blockIdx ?? 0,
        toBlock: toLine?.blockIdx ?? 0,
        content: block.removedLines.map(l => l.line),
        // Track actual line positions to detect if content moved
        fromLineNumber: fromLine?.lineNumber ?? fromLine.index,
        toLineNumber: toLine?.lineNumber ?? toLine.index,
        // Preserve position arrays from virtual blocks if available
        oldLinePositions: originalBlock?.oldLinePositions,
        newLinePositions: originalBlock?.newLinePositions
      };
    });
    
    const stats = tracker.getStats();
    
    return {
      blocks,
      partial: false,
      stats: {
        ...stats,
        totalLines,
        potentialBlocks: potentialBlocks.length,
        scoredBlocks: scoredBlocks.length,
        finalBlocks: blocks.length
      }
    };
    
  } catch (error) {
    if (error instanceof TimeoutError || error instanceof OperationLimitError) {
      console.warn(`[BlockMoveDetector] ${error.message}`);
      return {
        blocks: [],
        partial: true,
        reason: error.message,
        stats: tracker.getStats()
      };
    }
    throw error;
  }
}

/**
 * Grow a contiguous block from a matching pair of lines
 * 
 * @param {Array<number>} removedHashes - Hashes of removed lines
 * @param {Array<number>} addedHashes - Hashes of added lines
 * @param {number} removedStart - Starting index in removed
 * @param {number} addedStart - Starting index in added
 * @param {number} minBlockSize - Minimum block size
 * @param {number} maxBlockSize - Maximum block size
 * @param {Object} tracker - Operation tracker
 * @returns {Object|null} Block info or null if block is too small
 */
function growBlock(removedHashes, addedHashes, removedStart, addedStart, minBlockSize, maxBlockSize, tracker) {
  let size = 1;
  
  // Grow forward as long as hashes match
  while (
    size < maxBlockSize &&
    removedStart + size < removedHashes.length &&
    addedStart + size < addedHashes.length &&
    removedHashes[removedStart + size] === addedHashes[addedStart + size]
  ) {
    tracker.checkTimeout();
    size++;
  }
  
  // Try to grow backward (extend block before the match point)
  let backwardExtension = 0;
  while (
    backwardExtension < 3 && // Limit backward growth to prevent huge blocks
    removedStart - backwardExtension - 1 >= 0 &&
    addedStart - backwardExtension - 1 >= 0 &&
    removedHashes[removedStart - backwardExtension - 1] === addedHashes[addedStart - backwardExtension - 1]
  ) {
    tracker.checkTimeout();
    backwardExtension++;
  }
  
  if (backwardExtension > 0) {
    return {
      size: size + backwardExtension,
      removedStart: removedStart - backwardExtension,
      addedStart: addedStart - backwardExtension
    };
  }
  
  return { size };
}

/**
 * Calculate similarity scores for all potential blocks
 * Uses a fast character-based similarity for performance
 * 
 * @param {Array} blocks - Potential blocks with line references
 * @param {number} minSimilarity - Minimum similarity threshold
 * @param {Object} tracker - Operation tracker
 * @returns {Array} Scored blocks above threshold
 */
function scoreBlocks(blocks, minSimilarity, tracker) {
  const scored = [];
  
  for (const block of blocks) {
    tracker.checkTimeout();
    
    let totalSimilarity = 0;
    let validComparisons = 0;
    
    for (let i = 0; i < block.size; i++) {
      tracker.checkTimeout();
      
      const removedLine = block.removedLines[i]?.line || '';
      const addedLine = block.addedLines[i]?.line || '';
      
      const similarity = calculateLineSimilarityFast(removedLine, addedLine);
      totalSimilarity += similarity;
      validComparisons++;
    }
    
    const avgSimilarity = validComparisons > 0 ? totalSimilarity / validComparisons : 0;
    
    // Adaptive threshold: larger blocks can have slightly lower similarity
    const blockThreshold = Math.max(
      minSimilarity - (block.size - BLOCK_MOVE_CONFIG.MIN_BLOCK_SIZE) * 0.01,
      minSimilarity * 0.9
    );
    
    if (avgSimilarity >= blockThreshold) {
      scored.push({
        ...block,
        similarity: avgSimilarity
      });
    }
  }
  
  return scored;
}

/**
 * Fast line similarity calculation
 * Uses normalized Levenshtein distance approximation
 * 
 * @param {string} lineA - First line
 * @param {string} lineB - Second line
 * @returns {number} Similarity 0.0-1.0
 */
export function calculateLineSimilarityFast(lineA, lineB) {
  const a = lineA.trim().toLowerCase();
  const b = lineB.trim().toLowerCase();
  
  if (a === b) return 1.0;
  if (a.length === 0 && b.length === 0) return 1.0;
  if (a.length === 0 || b.length === 0) return 0.0;
  
  // For short lines, use character-based comparison
  const maxLen = Math.max(a.length, b.length);
  
  if (maxLen < 50) {
    // Simple character matching for short lines
    let matches = 0;
    const minLen = Math.min(a.length, b.length);
    for (let i = 0; i < minLen; i++) {
      if (a[i] === b[i]) matches++;
    }
    // Add a small epsilon to avoid exact boundary issues
    const similarity = (matches / maxLen) + 0.0001;
    return Math.min(similarity, 1.0);
  }
  
  // For longer lines, use word-based comparison
  const wordsA = a.split(/\s+/).filter(w => w.length > 0);
  const wordsB = b.split(/\s+/).filter(w => w.length > 0);
  
  if (wordsA.length === 0 && wordsB.length === 0) return 1.0;
  if (wordsA.length === 0 || wordsB.length === 0) return 0.0;
  
  // Count common words
  const setA = new Set(wordsA);
  let commonWords = 0;
  for (const word of wordsB) {
    if (setA.has(word)) commonWords++;
  }
  
  // Add a small epsilon to avoid exact boundary issues
  const similarity = ((2 * commonWords) / (wordsA.length + wordsB.length)) + 0.0001;
  return Math.min(similarity, 1.0);
}

/**
 * Filter overlapping blocks, preferring larger ones
 * Uses a greedy approach: sort by score (size * similarity), then add non-overlapping blocks
 * 
 * @param {Array} blocks - Scored blocks
 * @param {number} maxBlocks - Maximum blocks to return
 * @param {Object} tracker - Operation tracker
 * @returns {Array} Non-overlapping blocks
 */
function filterOverlappingBlocks(blocks, maxBlocks, tracker) {
  // Sort by combined score (size * similarity), then by similarity
  const sorted = [...blocks].sort((a, b) => {
    const scoreA = a.size * a.similarity;
    const scoreB = b.size * b.similarity;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return b.similarity - a.similarity;
  });
  
  const filtered = [];
  const usedRemoved = new Set();
  const usedAdded = new Set();
  
  for (const block of sorted) {
    tracker.checkTimeout();
    
    // Check if this block overlaps with already selected blocks
    let overlaps = false;
    
    for (let i = 0; i < block.size; i++) {
      if (usedRemoved.has(block.removedStart + i) || usedAdded.has(block.addedStart + i)) {
        overlaps = true;
        break;
      }
    }
    
    if (!overlaps) {
      filtered.push(block);
      
      // Mark lines as used
      for (let i = 0; i < block.size; i++) {
        usedRemoved.add(block.removedStart + i);
        usedAdded.add(block.addedStart + i);
      }
      
      if (filtered.length >= maxBlocks) break;
    }
  }
  
  return filtered;
}

// ============================================================================
// Legacy API Compatibility
// ============================================================================

/**
 * Fast block move detection - legacy API wrapper
 * This function provides backward compatibility with the old API
 * while using the new implementation internally
 * 
 * @param {Array} allBlocks - All change blocks from identifyChangeBlocks()
 * @param {Function} diffWords - diffWords function from diff library
 * @param {Function} diffChars - diffChars function from diff library
 * @param {number} numBands - LSH bands (unused, kept for API compatibility)
 * @param {number} moveThreshold - Similarity threshold for moves
 * @param {number} modifiedThreshold - Similarity threshold for modifications
 * @param {number} numBits - Signature bits (unused, kept for API compatibility)
 * @param {Object} modeToggles - Which diff modes are enabled
 * @param {string} language - Detected programming language
 * @param {Object} options - Additional options
 * @returns {Object} { moves, crossBlockModifications, blockMoves }
 */
export function detectBlockMovesFast(
  allBlocks,
  diffWords,
  diffChars,
  numBands = 8,
  moveThreshold = 0.90,
  modifiedThreshold = 0.60,
  numBits = 32,
  modeToggles = { lines: true, words: true, chars: true },
  language = null,
  options = {}
) {
  // Skip if too few changes
  // Count physical lines (not diff entries) since diffLines groups lines
  const totalRemoved = allBlocks.reduce((sum, b) => 
    sum + b.removed.reduce((lineSum, r) => lineSum + (r.line?.split('\n').length || 1), 0), 0);
  const totalAdded = allBlocks.reduce((sum, b) => 
    sum + b.added.reduce((lineSum, a) => lineSum + (a.line?.split('\n').length || 1), 0), 0);
  
  if (totalRemoved + totalAdded < BLOCK_MOVE_CONFIG.MIN_LINES_FOR_DETECTION) {
    return { moves: new Map(), crossBlockModifications: [], blockMoves: [], _skipped: true, _reason: 'Too few lines' };
  }
  
  // Skip if file too large
  if (totalRemoved + totalAdded > BLOCK_MOVE_CONFIG.MAX_LINES_FOR_DETECTION) {
    return { 
      moves: new Map(), 
      crossBlockModifications: [], 
      blockMoves: [],
      _skipped: true,
      _reason: 'File too large'
    };
  }
  
  // Flatten all removed and added lines
  const allRemoved = [];
  const allAdded = [];
  
  allBlocks.forEach((block, blockIdx) => {
    block.removed.forEach((r, localIdx) => {
      allRemoved.push({
        ...r,
        blockIdx,
        localIdx,
        _originalBlock: block  // Keep reference to original block for position info
      });
    });
    
    block.added.forEach((a, localIdx) => {
      allAdded.push({
        ...a,
        blockIdx,
        localIdx,
        _originalBlock: block  // Keep reference to original block for position info
      });
    });
  });
  
  // Run the new detection algorithm
  const result = detectBlockMoves(allRemoved, allAdded, {
    minSimilarity: moveThreshold,
    timeout: options.timeout || 5000,
    maxOperations: options.maxOperations || 100000,
    ignoreWhitespace: options.normalizeDelimiters || false
  });
  
  // Convert block moves to the old format (moves map for individual lines)
  const moves = new Map();
  const crossBlockModifications = [];
  const usedAddedIndices = new Set();
  
  // Build moves map from block moves
  for (const block of result.blocks) {
    for (let i = 0; i < block.size; i++) {
      const fromIndex = block.from + i;
      const toIndex = block.to + i;
      
      moves.set(fromIndex, {
        type: 'moved',
        fromIndex,
        toIndex,
        fromBlock: block.fromBlock,
        toBlock: block.toBlock,
        similarity: block.similarity
      });
      
      usedAddedIndices.add(toIndex);
      
      // Also calculate individual line similarity to detect modified lines within blocks
      const removedLine = allRemoved.find(r => r.index === fromIndex);
      const addedLine = allAdded.find(a => a.index === toIndex);
      
      if (removedLine && addedLine) {
        const lineSimilarity = calculateLineSimilarityFast(removedLine.line, addedLine.line);
        
        // For modified lines (similarity < 0.99), add cross-block modifications
        // This allows UI to show both "block moved" and "line modified"
        if (lineSimilarity < 0.99) {
          const pairing = {
            type: 'modified',
            removedIndex: fromIndex,
            addedIndex: toIndex,
            removedLine: removedLine.line,
            addedLine: addedLine.line,
            similarity: lineSimilarity,
            isCrossBlock: true
          };
          
          // Generate word and char diffs if functions provided
          if (diffWords) {
            try {
              pairing.wordDiff = diffWords(removedLine.line, addedLine.line);
            } catch (e) {
              // Ignore diff errors
            }
          }
          
          if (diffChars) {
            try {
              pairing.charDiff = diffChars(removedLine.line, addedLine.line);
            } catch (e) {
              // Ignore diff errors
            }
          }
          
          crossBlockModifications.push(pairing);
        }
      }
    }
  }
  
  // Also identify individual line moves (not just blocks)
  // This handles single lines that moved with high similarity
  // For individual lines, we need to check ALL pairs (not just hash matches)
  // since the lines might have been modified slightly
  
  // First, try to match by exact hash (faster path)
  const ignoreWhitespaceForIndividual = options.normalizeDelimiters || false;
  const removedHashesForIndividual = allRemoved.map(l => hashLineSimple(l.line, ignoreWhitespaceForIndividual));
  const addedHashesForIndividual = allAdded.map(l => hashLineSimple(l.line, ignoreWhitespaceForIndividual));
  
  // Build index for exact hash matches
  const individualAddedIndex = new Map();
  addedHashesForIndividual.forEach((hash, idx) => {
    if (!individualAddedIndex.has(hash)) {
      individualAddedIndex.set(hash, []);
    }
    individualAddedIndex.get(hash).push(idx);
  });
  
  // Find exact individual line moves
  for (let i = 0; i < allRemoved.length; i++) {
    const removed = allRemoved[i];
    
    // Skip if already part of a block move
    if (moves.has(removed.index)) continue;
    
    const hash = removedHashesForIndividual[i];
    const matches = individualAddedIndex.get(hash);
    
    if (!matches || matches.length === 0) continue;
    
    // Find the best match among candidates with exact hash
    let bestMatch = null;
    let bestSimilarity = 0;
    
    for (const addedIdx of matches) {
      const added = allAdded[addedIdx];
      
      // Skip if already paired
      if (usedAddedIndices.has(added.index)) continue;
      
      // Must be from different block
      if (added.blockIdx === removed.blockIdx) continue;
      
      // Calculate similarity
      const similarity = calculateLineSimilarityFast(removed.line, added.line);
      if (similarity > bestSimilarity && similarity >= moveThreshold) {
        bestSimilarity = similarity;
        bestMatch = added;
      }
    }
    
    if (bestMatch) {
      moves.set(removed.index, {
        type: 'moved',
        fromIndex: removed.index,
        toIndex: bestMatch.index,
        fromBlock: removed.blockIdx,
        toBlock: bestMatch.blockIdx,
        similarity: bestSimilarity
      });
      usedAddedIndices.add(bestMatch.index);
    }
  }
  
  // Second, for remaining unmatched lines, try similarity-based matching
  // This catches lines that moved AND changed (like function signatures)
  // Only detect as "moves" if similarity meets the full move threshold
  // Lines with lower similarity (>= modifiedThreshold) will be caught by cross-block detection
  
  for (let i = 0; i < allRemoved.length; i++) {
    const removed = allRemoved[i];
    
    // Skip if already part of a block or individual move
    if (moves.has(removed.index)) continue;
    
    // Find best matching added line by similarity
    let bestMatch = null;
    let bestSimilarity = 0;
    
    for (let j = 0; j < allAdded.length; j++) {
      const added = allAdded[j];
      
      // Skip if already paired
      if (usedAddedIndices.has(added.index)) continue;
      
      // Must be from different block
      if (added.blockIdx === removed.blockIdx) continue;
      
      // Calculate similarity
      const similarity = calculateLineSimilarityFast(removed.line, added.line);
      if (similarity > bestSimilarity && similarity >= moveThreshold) {
        bestSimilarity = similarity;
        bestMatch = added;
      }
    }
    
    if (bestMatch) {
      moves.set(removed.index, {
        type: 'moved',
        fromIndex: removed.index,
        toIndex: bestMatch.index,
        fromBlock: removed.blockIdx,
        toBlock: bestMatch.blockIdx,
        similarity: bestSimilarity
      });
      usedAddedIndices.add(bestMatch.index);
    }
  }
  
  // Now identify cross-block modifications for lines that moved AND changed
  
  // Find cross-block modifications (lines that moved and changed)
  for (const removed of allRemoved) {
    // Skip if already part of a block move
    if (moves.has(removed.index)) continue;
    
    // Find best matching added line (not already paired)
    let bestMatch = null;
    let bestSimilarity = 0;
    
    for (const added of allAdded) {
      if (usedAddedIndices.has(added.index)) continue;
      if (added.blockIdx === removed.blockIdx) continue;
      
      const similarity = calculateLineSimilarityFast(removed.line, added.line);
      if (similarity > bestSimilarity && similarity >= modifiedThreshold) {
        bestSimilarity = similarity;
        bestMatch = added;
      }
    }
    
    if (bestMatch) {
      const pairing = {
        type: 'modified',
        removedIndex: removed.index,
        addedIndex: bestMatch.index,
        removedLine: removed.line,
        addedLine: bestMatch.line,
        similarity: bestSimilarity,
        isCrossBlock: true
      };
      
      // Generate word and char diffs if functions provided
      if (diffWords) {
        try {
          pairing.wordDiff = diffWords(removed.line, bestMatch.line);
        } catch (e) {
          // Ignore diff errors
        }
      }
      
      if (diffChars) {
        try {
          pairing.charDiff = diffChars(removed.line, bestMatch.line);
        } catch (e) {
          // Ignore diff errors
        }
      }
      
      crossBlockModifications.push(pairing);
      usedAddedIndices.add(bestMatch.index);
    }
  }
  
  // Phase 3: Find cross-block modifications for lines not in any block
  // This handles modified lines that weren't grouped into a block move
  const usedRemovedForBlocks = new Set();
  for (const block of result.blocks) {
    for (let i = 0; i < block.size; i++) {
      usedRemovedForBlocks.add(block.from + i);
    }
  }
  
  for (const removed of allRemoved) {
    // Skip if already processed as a move or cross-block modification
    if (moves.has(removed.index)) continue;
    if (usedRemovedForBlocks.has(removed.index)) continue;
    if (crossBlockModifications.some(m => m.removedIndex === removed.index)) continue;
    
    // Find best matching added line (not already paired)
    let bestMatch = null;
    let bestSimilarity = 0;
    
    for (const added of allAdded) {
      if (usedAddedIndices.has(added.index)) continue;
      if (crossBlockModifications.some(m => m.addedIndex === added.index)) continue;
      if (added.blockIdx === removed.blockIdx) continue;
      
      const similarity = calculateLineSimilarityFast(removed.line, added.line);
      if (similarity > bestSimilarity && similarity >= modifiedThreshold) {
        bestSimilarity = similarity;
        bestMatch = added;
      }
    }
    
    if (bestMatch) {
      const pairing = {
        type: 'modified',
        removedIndex: removed.index,
        addedIndex: bestMatch.index,
        removedLine: removed.line,
        addedLine: bestMatch.line,
        similarity: bestSimilarity,
        isCrossBlock: true
      };
      
      // Generate word and char diffs if functions provided
      if (diffWords) {
        try {
          pairing.wordDiff = diffWords(removed.line, bestMatch.line);
        } catch (e) {
          // Ignore diff errors
        }
      }
      
      if (diffChars) {
        try {
          pairing.charDiff = diffChars(removed.line, bestMatch.line);
        } catch (e) {
          // Ignore diff errors
        }
      }
      
      crossBlockModifications.push(pairing);
      usedAddedIndices.add(bestMatch.index);
    }
  }
  
  return {
    moves,
    crossBlockModifications,
    blockMoves: result.blocks,
    _stats: result.stats,
    _partial: result.partial
  };
}

// ============================================================================
// Module Exports
// ============================================================================

export default {
  detectBlockMoves,
  detectBlockMovesFast,
  hashLineSimple,
  BLOCK_MOVE_CONFIG,
  TimeoutError,
  OperationLimitError
};
