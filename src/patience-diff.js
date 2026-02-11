/**
 * Patience Diff Algorithm Module
 * 
 * Implementation of the Patience Diff algorithm for improved diff quality.
 * Based on the algorithm by Bram Cohen, with enhancements for detecting
 * moved blocks and better handling of code changes.
 * 
 * Key improvements over Myers diff:
 * - Better handling of moved blocks
 * - More intuitive diff output
 * - Uses "unique common elements" as anchors
 * 
 * Copyright (c) 2025 Jason Tally and contributors
 * SPDX-License-Identifier: MIT
 */

/**
 * Find the Longest Common Subsequence using the Patience sorting algorithm
 * This is the core of Patience Diff - it finds matching lines in a way that
 * preserves order and produces more readable diffs.
 * 
 * @param {Array} aLines - Array of strings (old version)
 * @param {Array} bLines - Array of strings (new version)
 * @param {Function} compareFn - Optional comparison function (default: strict equality)
 * @returns {Array} Array of matching pairs { aIndex, bIndex, line }
 */
export function patienceLCS(aLines, bLines, compareFn = null) {
  const compare = compareFn || ((a, b) => a === b);
  
  if (aLines.length === 0 || bLines.length === 0) {
    return [];
  }
  
  // Find unique common elements
  // These will be our "anchors" for dividing the problem
  const uniqueCommons = findUniqueCommonElements(aLines, bLines, compare);
  
  if (uniqueCommons.length === 0) {
    // No unique common elements found - fall back to standard approach
    // This happens when there are many duplicate lines
    return myersLCS(aLines, bLines, compare);
  }
  
  // Sort by position in aLines to maintain order
  uniqueCommons.sort((a, b) => a.aIndex - b.aIndex);
  
  // Now find longest increasing subsequence in bIndices
  // This gives us the optimal set of matches that preserves order
  const lis = longestIncreasingSubsequence(uniqueCommons.map(u => u.bIndex));
  
  // Extract the matching pairs
  const matches = [];
  for (const idx of lis) {
    const common = uniqueCommons[idx];
    matches.push({
      aIndex: common.aIndex,
      bIndex: common.bIndex,
      line: aLines[common.aIndex]
    });
  }
  
  return matches;
}

/**
 * Find elements that appear exactly once in both arrays
 * These are the "anchors" that Patience Diff uses to divide the problem
 * 
 * @param {Array} aLines - First array
 * @param {Array} bLines - Second array
 * @param {Function} compare - Comparison function
 * @returns {Array} Array of { aIndex, bIndex, line } for unique common elements
 */
function findUniqueCommonElements(aLines, bLines, compare) {
  // Count occurrences in aLines (O(n))
  const aCounts = new Map();
  for (const line of aLines) {
    aCounts.set(line, (aCounts.get(line) || 0) + 1);
  }
  
  // Count occurrences in bLines and track indices (O(n))
  const bCounts = new Map();
  const bIndices = new Map();
  for (let i = 0; i < bLines.length; i++) {
    const line = bLines[i];
    bCounts.set(line, (bCounts.get(line) || 0) + 1);
    if (!bIndices.has(line)) {
      bIndices.set(line, i); // Store first occurrence
    }
  }
  
  // Find elements that appear exactly once in both (O(n))
  const uniqueCommons = [];
  for (let aIndex = 0; aIndex < aLines.length; aIndex++) {
    const line = aLines[aIndex];
    
    const aCount = aCounts.get(line) || 0;
    const bCount = bCounts.get(line) || 0;
    
    if (aCount === 1 && bCount === 1) {
      const bIndex = bIndices.get(line);
      if (bIndex !== undefined) {
        uniqueCommons.push({ aIndex, bIndex, line });
      }
    }
  }
  
  return uniqueCommons;
}

/**
 * Find the Longest Increasing Subsequence
 * Uses patience sorting algorithm (hence the name)
 * 
 * @param {Array} sequence - Array of numbers
 * @returns {Array} Indices of elements in the LIS
 */
function longestIncreasingSubsequence(sequence) {
  if (sequence.length === 0) return [];
  
  const piles = []; // Top card of each pile
  const pileIndices = []; // Index in sequence for each pile top
  const backpointers = new Array(sequence.length); // For reconstruction
  
  for (let i = 0; i < sequence.length; i++) {
    const x = sequence[i];
    
    // Binary search to find which pile to place x on
    let left = 0;
    let right = piles.length;
    
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (piles[mid] < x) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    
    // Place x on pile at position 'left'
    piles[left] = x;
    pileIndices[left] = i;
    
    // Set backpointer to previous pile
    if (left > 0) {
      backpointers[i] = pileIndices[left - 1];
    } else {
      backpointers[i] = -1;
    }
  }
  
  // Reconstruct the LIS
  const lis = [];
  let k = pileIndices[pileIndices.length - 1];
  while (k >= 0) {
    lis.unshift(k);
    k = backpointers[k];
  }
  
  return lis;
}

/**
 * Standard Myers LCS algorithm (fallback when no unique common elements)
 * O(N*D) where D is the edit distance
 * 
 * @param {Array} a - First array
 * @param {Array} b - Second array  
 * @param {Function} compare - Comparison function
 * @returns {Array} Matching pairs
 */
function myersLCS(a, b, compare) {
  const n = a.length;
  const m = b.length;
  
  if (n === 0 || m === 0) return [];
  
  // Maximum possible edit distance
  const max = n + m;
  
  // V array for Myers algorithm (stores furthest reaching x for each k)
  const v = new Map();
  v.set(1, 0);
  
  // Traceback information
  const trace = [];
  
  for (let d = 0; d <= max; d++) {
    const vCopy = new Map(v);
    trace.push(vCopy);
    
    for (let k = -d; k <= d; k += 2) {
      let x;
      
      if (k === -d || (k !== d && v.get(k - 1) < v.get(k + 1))) {
        x = v.get(k + 1);
      } else {
        x = v.get(k - 1) + 1;
      }
      
      let y = x - k;
      
      // Extend diagonal
      while (x < n && y < m && compare(a[x], b[y])) {
        x++;
        y++;
      }
      
      v.set(k, x);
      
      if (x >= n && y >= m) {
        // Reached end - construct LCS from traceback
        return reconstructLCS(trace, a, b, compare, n, m, d);
      }
    }
  }
  
  return [];
}

/**
 * Reconstruct LCS from Myers traceback
 * 
 * @param {Array} trace - Trace arrays from Myers algorithm
 * @param {Array} a - First array
 * @param {Array} b - Second array
 * @param {Function} compare - Comparison function
 * @param {number} n - Length of a
 * @param {number} m - Length of b
 * @param {number} d - Edit distance
 * @returns {Array} Matching pairs
 */
function reconstructLCS(trace, a, b, compare, n, m, d) {
  const matches = [];
  let x = n;
  let y = m;
  
  for (let i = d; i > 0; i--) {
    const v = trace[i];
    const k = x - y;
    
    let prevK;
    if (k === -i || (k !== i && v.get(k - 1) < v.get(k + 1))) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    
    const prevX = trace[i - 1].get(prevK);
    const prevY = prevX - prevK;
    
    // Add diagonal moves (matches)
    while (x > prevX && y > prevY) {
      x--;
      y--;
      matches.unshift({
        aIndex: x,
        bIndex: y,
        line: a[x]
      });
    }
    
    x = prevX;
    y = prevY;
  }
  
  // Add any remaining diagonal at start
  while (x > 0 && y > 0 && compare(a[x - 1], b[y - 1])) {
    x--;
    y--;
    matches.unshift({
      aIndex: x,
      bIndex: y,
      line: a[x]
    });
  }
  
  return matches;
}

/**
 * Patience Diff Plus - Enhanced version that detects moved blocks
 * Returns not just the diff, but also move information
 * 
 * @param {Array} aLines - Original lines
 * @param {Array} bLines - Modified lines
 * @param {Object} options - Options
 * @returns {Object} Diff results with move detection
 */
export function patienceDiffPlus(aLines, bLines, options = {}) {
  const { 
    compareFn = null,
    moveThreshold = 0.8 
  } = options;
  
  const compare = compareFn || ((a, b) => a === b);
  
  // Get the base diff using Patience LCS
  const lcs = patienceLCS(aLines, bLines, compare);
  
  // Build result arrays
  const result = [];
  let aIndex = 0;
  let bIndex = 0;
  let lcsIndex = 0;
  
  while (aIndex < aLines.length || bIndex < bLines.length) {
    if (lcsIndex < lcs.length) {
      const match = lcs[lcsIndex];
      
      // Output any removed lines before this match
      while (aIndex < match.aIndex) {
        result.push({
          line: aLines[aIndex],
          aIndex: aIndex,
          bIndex: -1,
          removed: true
        });
        aIndex++;
      }
      
      // Output any added lines before this match
      while (bIndex < match.bIndex) {
        result.push({
          line: bLines[bIndex],
          aIndex: -1,
          bIndex: bIndex,
          added: true
        });
        bIndex++;
      }
      
      // Output the match (common line)
      result.push({
        line: match.line,
        aIndex: aIndex,
        bIndex: bIndex,
        common: true
      });
      
      aIndex++;
      bIndex++;
      lcsIndex++;
    } else {
      // No more matches - output remaining lines
      while (aIndex < aLines.length) {
        result.push({
          line: aLines[aIndex],
          aIndex: aIndex,
          bIndex: -1,
          removed: true
        });
        aIndex++;
      }
      
      while (bIndex < bLines.length) {
        result.push({
          line: bLines[bIndex],
          aIndex: -1,
          bIndex: bIndex,
          added: true
        });
        bIndex++;
      }
    }
  }
  
  // Detect moves
  const moves = detectMoves(result, moveThreshold);
  
  return {
    lines: result,
    moves: moves,
    aLength: aLines.length,
    bLength: bLines.length
  };
}

/**
 * Detect moved lines/blocks in diff results
 * Looks for removed lines that appear later as added lines (or vice versa)
 * 
 * @param {Array} diffLines - Result from patienceDiffPlus
 * @param {number} threshold - Similarity threshold for matching moved lines
 * @returns {Array} Array of move descriptors
 */
function detectMoves(diffLines, threshold = 0.8) {
  const moves = [];
  const removed = [];
  const added = [];
  
  // Collect removed and added lines with their positions
  diffLines.forEach((item, index) => {
    if (item.removed) {
      removed.push({ ...item, diffIndex: index });
    } else if (item.added) {
      added.push({ ...item, diffIndex: index });
    }
  });
  
  // Simple O(N*M) matching - could be optimized with LSH for large inputs
  const matchedRemoved = new Set();
  const matchedAdded = new Set();
  
  for (let i = 0; i < removed.length; i++) {
    if (matchedRemoved.has(i)) continue;
    
    const r = removed[i];
    let bestMatch = -1;
    let bestScore = 0;
    
    for (let j = 0; j < added.length; j++) {
      if (matchedAdded.has(j)) continue;
      
      const a = added[j];
      const score = calculateLineSimilarity(r.line, a.line);
      
      if (score >= threshold && score > bestScore) {
        bestScore = score;
        bestMatch = j;
      }
    }
    
    if (bestMatch !== -1) {
      matchedRemoved.add(i);
      matchedAdded.add(bestMatch);
      
      moves.push({
        fromIndex: removed[i].diffIndex,
        toIndex: added[bestMatch].diffIndex,
        fromAIndex: removed[i].aIndex,
        toBIndex: added[bestMatch].bIndex,
        line: removed[i].line,
        similarity: bestScore,
        type: 'moved'
      });
    }
  }
  
  return moves;
}

/**
 * Calculate simple line similarity (for move detection)
 * 
 * @param {string} lineA - First line
 * @param {string} lineB - Second line
 * @returns {number} Similarity 0.0-1.0
 */
function calculateLineSimilarity(lineA, lineB) {
  if (lineA === lineB) return 1.0;
  
  const normalizedA = lineA.trim().toLowerCase();
  const normalizedB = lineB.trim().toLowerCase();
  
  if (normalizedA === normalizedB) return 0.95;
  
  // Simple word-based similarity
  const wordsA = normalizedA.split(/\s+/).filter(w => w.length > 0);
  const wordsB = normalizedB.split(/\s+/).filter(w => w.length > 0);
  
  if (wordsA.length === 0 && wordsB.length === 0) return 1.0;
  if (wordsA.length === 0 || wordsB.length === 0) return 0.0;
  
  const commonWords = wordsA.filter(w => wordsB.includes(w)).length;
  return (2 * commonWords) / (wordsA.length + wordsB.length);
}

/**
 * Main Patience Diff function
 * Returns a simple diff array similar to standard diff
 * 
 * @param {Array} aLines - Original lines
 * @param {Array} bLines - Modified lines
 * @param {Object} options - Options
 * @returns {Array} Diff array with added/removed/common markers
 */
export function patienceDiff(aLines, bLines, options = {}) {
  const result = patienceDiffPlus(aLines, bLines, options);
  return result.lines;
}

export default {
  patienceDiff,
  patienceDiffPlus,
  patienceLCS
};
