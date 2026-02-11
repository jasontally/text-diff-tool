/**
 * Content Hash Module
 * 
 * SimHash-style content hashing for fast similarity comparison.
 * Uses character bigrams (2-grams) for stable fuzzy matching.
 * 
 * Copyright (c) 2025 Jason Tally and contributors
 * SPDX-License-Identifier: MIT
 */

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_BITS = 32;

// ============================================================================
// Hash Generation
// ============================================================================

/**
 * Generate a SimHash-style content hash for a line
 * Uses character bigrams (2-grams) for stable fuzzy matching
 * 
 * @param {string} line - Input line to hash
 * @param {number} numBits - Number of bits for the hash (default: 32)
 * @returns {string} Hash as a string suitable for Map keys
 */
export function hashLine(line, numBits = DEFAULT_BITS) {
  const normalized = line.trim().toLowerCase();
  if (normalized.length === 0) {
    return '0'.repeat(numBits);
  }
  
  // Initialize bit weights (SimHash-style weighted accumulation)
  const weights = new Array(numBits).fill(0);
  
  // Process each bigram
  for (let i = 0; i < normalized.length - 1; i++) {
    const char1 = normalized.charCodeAt(i);
    const char2 = normalized.charCodeAt(i + 1);
    
    // Create multiple hashes per bigram for better distribution
    const hash1 = ((char1 * 31) + char2) % numBits;
    const hash2 = ((char2 * 37) + char1) % numBits;
    const hash3 = ((char1 * char2) * 17) % numBits;
    
    // Accumulate weights (SimHash approach)
    weights[hash1]++;
    weights[hash2]++;
    weights[hash3]++;
    
    // Also use char codes to influence bits
    const bit4 = (char1 + char2) % numBits;
    weights[bit4]++;
  }
  
  // Convert weights to binary hash (positive = 1, negative/0 = 0)
  let hashString = '';
  for (let i = 0; i < numBits; i++) {
    hashString += weights[i] > 0 ? '1' : '0';
  }
  
  return hashString;
}

/**
 * Calculate the Hamming distance between two hash strings
 * Number of positions where bits differ
 * 
 * @param {string} hash1 - First hash string
 * @param {string} hash2 - Second hash string
 * @returns {number} Hamming distance (0 = identical, max = hash length)
 */
export function hammingDistance(hash1, hash2) {
  if (hash1.length !== hash2.length) {
    throw new Error(`Hash length mismatch: ${hash1.length} vs ${hash2.length}`);
  }
  
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++;
    }
  }
  
  return distance;
}

/**
 * Compare two hashes and return similarity score
 * Returns 1.0 for identical, 0.0 for completely different
 * 
 * @param {string} hash1 - First hash string
 * @param {string} hash2 - Second hash string
 * @returns {number} Similarity score between 0.0 and 1.0
 */
export function compareHashes(hash1, hash2) {
  // Handle edge cases
  if (!hash1 && !hash2) return 1.0;
  if (!hash1 || !hash2) return 0.0;
  
  const distance = hammingDistance(hash1, hash2);
  const numBits = hash1.length;
  
  return 1.0 - (distance / numBits);
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Hash multiple lines efficiently
 * 
 * @param {Array<string>} lines - Array of lines to hash
 * @param {number} numBits - Number of bits for hashes
 * @returns {Array<string>} Array of hash strings
 */
export function hashLines(lines, numBits = DEFAULT_BITS) {
  return lines.map(line => hashLine(line, numBits));
}

/**
 * Find similar lines using LSH (Locality Sensitive Hashing)
 * Groups lines that are likely similar based on hash prefixes
 * 
 * @param {Array<string>} hashes - Array of hash strings
 * @param {number} bandSize - Size of each LSH band
 * @returns {Map<string, Array<number>>} Map of band values to line indices
 */
export function buildLSHIndex(hashes, bandSize = 4) {
  const index = new Map();
  
  for (let i = 0; i < hashes.length; i++) {
    const hash = hashes[i];
    const numBands = Math.floor(hash.length / bandSize);
    
    for (let band = 0; band < numBands; band++) {
      const start = band * bandSize;
      const bandValue = hash.substring(start, start + bandSize);
      const key = `${band}_${bandValue}`;
      
      if (!index.has(key)) {
        index.set(key, []);
      }
      index.get(key).push(i);
    }
  }
  
  return index;
}

// ============================================================================
// Export
// ============================================================================

export default {
  hashLine,
  hashLines,
  compareHashes,
  hammingDistance,
  buildLSHIndex
};
