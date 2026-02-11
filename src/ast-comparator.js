/**
 * AST Comparator Module
 * 
 * Compares Abstract Syntax Trees from Tree-sitter to calculate
 * structural similarity between code lines.
 * 
 * Copyright (c) 2025 Jason Tally and contributors
 * SPDX-License-Identifier: MIT
 */

// Tree-sitter loader module - loaded lazily to avoid breaking Node.js tests
let treeSitterLoader = null;

/**
 * Lazily load tree-sitter-loader module
 * This prevents the CDN import from being parsed in Node.js environments
 */
async function getTreeSitterLoader() {
  if (!treeSitterLoader) {
    try {
      treeSitterLoader = await import('./tree-sitter-loader.js');
    } catch (error) {
      // Tree-sitter not available (Node.js environment or missing WebAssembly)
      console.log('[ASTComparator] Tree-sitter not available, using text-only comparison');
      return null;
    }
  }
  return treeSitterLoader;
}

/**
 * Configuration for AST comparison
 */
const CONFIG = {
  MAX_DEPTH: 3,              // Maximum recursion depth for structure extraction
  MAX_CHILDREN: 20,          // Maximum children to process per node
  IGNORED_NODE_TYPES: [      // Node types to ignore in comparison
    'comment',
    'line_comment',
    'block_comment',
    ';',                      // Semicolons (punctuation)
    ',',                      // Commas
    '(',
    ')',
    '{',
    '}',
    '[',
    ']',
  ]
};

/**
 * Extract structure signature from a parse tree
 * Captures the node types and hierarchy for comparison
 * 
 * @param {Object} tree - Tree-sitter parse tree
 * @param {number} maxDepth - Maximum depth to extract (default: 3)
 * @returns {Object} Structure signature
 */
export function getASTSignature(tree, maxDepth = CONFIG.MAX_DEPTH) {
  if (!tree || !tree.rootNode) {
    return null;
  }
  
  const rootNode = tree.rootNode;
  
  // Check for parse errors
  if (rootNode.hasError()) {
    return { hasError: true, type: rootNode.type };
  }
  
  /**
   * Recursively extract node structure
   * 
   * @param {Object} node - Tree-sitter node
   * @param {number} depth - Current depth
   * @returns {Object} Node structure
   */
  function extractNode(node, depth = 0) {
    // Base case: max depth reached
    if (depth >= maxDepth) {
      return { type: node.type, truncated: true };
    }
    
    // Skip ignored node types
    if (CONFIG.IGNORED_NODE_TYPES.includes(node.type)) {
      return null;
    }
    
    const result = {
      type: node.type,
      children: []
    };
    
    // Limit children processed
    const childrenToProcess = node.children.slice(0, CONFIG.MAX_CHILDREN);
    
    for (const child of childrenToProcess) {
      const childResult = extractNode(child, depth + 1);
      if (childResult) {
        result.children.push(childResult);
      }
    }
    
    return result;
  }
  
  return {
    type: rootNode.type,
    structure: extractNode(rootNode),
    childCount: rootNode.childCount,
    hasError: false
  };
}

/**
 * Serialize structure to a string for easy comparison
 * 
 * @param {Object} structure - Node structure
 * @returns {string} Serialized form
 */
function serializeStructure(structure) {
  if (!structure) return '';
  if (structure.truncated) return `${structure.type}:...`;
  
  const children = structure.children
    .map(child => serializeStructure(child))
    .filter(s => s)
    .join(',');
  
  if (children) {
    return `${structure.type}(${children})`;
  }
  return structure.type;
}

/**
 * Calculate similarity between two structure signatures
 * Uses a combination of:
 * - Root type matching (40%)
 * - Structure similarity (60%)
 * 
 * @param {Object} sigA - First signature
 * @param {Object} sigB - Second signature
 * @returns {number} Similarity score 0.0-1.0
 */
export function compareASTSignatures(sigA, sigB) {
  // Handle null signatures
  if (!sigA || !sigB) {
    return 0.0;
  }
  
  // Handle parse errors
  if (sigA.hasError || sigB.hasError) {
    // If both have errors, they might be similar invalid syntax
    if (sigA.hasError && sigB.hasError && sigA.type === sigB.type) {
      return 0.3;
    }
    return 0.0;
  }
  
  // Root type comparison (40% weight)
  const rootMatch = sigA.type === sigB.type ? 0.4 : 0.0;
  
  // Structure comparison (60% weight)
  const structureSimilarity = compareStructures(sigA.structure, sigB.structure);
  
  return rootMatch + (structureSimilarity * 0.6);
}

/**
 * Recursively compare two structure trees
 * 
 * @param {Object} structA - First structure
 * @param {Object} structB - Second structure
 * @returns {number} Similarity 0.0-1.0
 */
function compareStructures(structA, structB) {
  // Handle null cases
  if (!structA || !structB) {
    return (!structA && !structB) ? 1.0 : 0.0;
  }
  
  // Type match is essential
  if (structA.type !== structB.type) {
    return 0.0;
  }
  
  // Both truncated = perfect match at this level
  if (structA.truncated && structB.truncated) {
    return 1.0;
  }
  
  // One truncated, one not = partial match
  if (structA.truncated || structB.truncated) {
    return 0.5;
  }
  
  // Compare children
  const childrenA = structA.children || [];
  const childrenB = structB.children || [];
  
  if (childrenA.length === 0 && childrenB.length === 0) {
    return 1.0; // Leaf nodes with same type
  }
  
  if (childrenA.length === 0 || childrenB.length === 0) {
    return 0.3; // One has children, one doesn't
  }
  
  // Calculate child similarity using LCS-like approach
  let matches = 0;
  const maxChildren = Math.max(childrenA.length, childrenB.length);
  
  // Simple greedy matching
  let i = 0, j = 0;
  while (i < childrenA.length && j < childrenB.length) {
    const childSim = compareStructures(childrenA[i], childrenB[j]);
    if (childSim > 0.7) {
      matches += childSim;
      i++;
      j++;
    } else if (childrenA[i].type < childrenB[j].type) {
      i++;
    } else {
      j++;
    }
  }
  
  return matches / maxChildren;
}

/**
 * Calculate AST-based similarity between two lines of code
 * This is the main entry point for AST comparison
 * 
 * @param {string} lineA - First line of code
 * @param {string} lineB - Second line of code
 * @param {string} language - Programming language identifier
 * @returns {Promise<number|null>} Similarity score (0.0-1.0) or null if failed
 */
export async function calculateASTSimilarity(lineA, lineB, language) {
  // Validate inputs
  if (!lineA || !lineB) {
    return lineA === lineB ? 1.0 : 0.0;
  }
  
  if (!language) {
    console.warn('[ASTComparator] No language specified for AST comparison');
    return null;
  }
  
  console.log(`[ASTComparator] Starting AST comparison for language: ${language}`);
  
  // Try to load tree-sitter
  const loader = await getTreeSitterLoader();
  if (!loader || !loader.getLanguageParser) {
    console.warn('[ASTComparator] Tree-sitter loader not available');
    return null;
  }
  
  console.log(`[ASTComparator] Tree-sitter loader available, loading ${language} parser...`);
  
  let treeA = null;
  let treeB = null;
  
  try {
    // Get parser for the language
    console.log(`[ASTComparator] Calling getLanguageParser for ${language}...`);
    const parser = await loader.getLanguageParser(language);
    
    if (!parser) {
      throw new Error(`Parser not available for ${language}`);
    }
    
    console.log(`[ASTComparator] Parser loaded successfully for ${language}`);
    
    // Parse both lines
    treeA = parser.parse(lineA);
    treeB = parser.parse(lineB);
    
    if (!treeA || !treeB) {
      throw new Error('Tree-sitter parse returned null');
    }
    
    // Get signatures
    const sigA = getASTSignature(treeA);
    const sigB = getASTSignature(treeB);
    
    if (!sigA || !sigB) {
      throw new Error('Failed to extract AST signatures');
    }
    
    // Compare signatures
    const similarity = compareASTSignatures(sigA, sigB);
    
    return similarity;
  } catch (error) {
    console.warn(`[ASTComparator] Comparison failed:`, error.message);
    return null; // Signal to use fallback
  } finally {
    // Critical: Clean up tree objects to prevent memory leaks
    if (treeA) {
      try {
        treeA.delete();
      } catch (e) {
        console.warn('[ASTComparator] Error deleting treeA:', e);
      }
    }
    if (treeB) {
      try {
        treeB.delete();
      } catch (e) {
        console.warn('[ASTComparator] Error deleting treeB:', e);
      }
    }
  }
}

/**
 * Get detailed AST comparison info for debugging
 * 
 * @param {string} lineA - First line
 * @param {string} lineB - Second line
 * @param {string} language - Programming language
 * @returns {Promise<Object>} Detailed comparison result
 */
export async function compareASTDetailed(lineA, lineB, language) {
  // Try to load tree-sitter
  const loader = await getTreeSitterLoader();
  if (!loader || !loader.getLanguageParser) {
    return {
      similarity: null,
      error: 'Tree-sitter not available',
      lineA: { text: lineA },
      lineB: { text: lineB }
    };
  }
  
  let treeA = null;
  let treeB = null;
  
  try {
    const parser = await loader.getLanguageParser(language);
    
    treeA = parser.parse(lineA);
    treeB = parser.parse(lineB);
    
    const sigA = getASTSignature(treeA);
    const sigB = getASTSignature(treeB);
    
    const similarity = compareASTSignatures(sigA, sigB);
    
    return {
      similarity,
      lineA: {
        text: lineA,
        signature: sigA,
        serialized: sigA ? serializeStructure(sigA.structure) : null
      },
      lineB: {
        text: lineB,
        signature: sigB,
        serialized: sigB ? serializeStructure(sigB.structure) : null
      }
    };
  } catch (error) {
    return {
      similarity: null,
      error: error.message,
      lineA: { text: lineA },
      lineB: { text: lineB }
    };
  } finally {
    if (treeA) treeA.delete();
    if (treeB) treeB.delete();
  }
}

/**
 * Batch process multiple line comparisons
 * Useful for comparing entire blocks
 * 
 * @param {Array<{lineA: string, lineB: string}>} pairs - Array of line pairs
 * @param {string} language - Programming language
 * @returns {Promise<Array<number|null>>} Array of similarity scores
 */
export async function batchCompareAST(pairs, language) {
  if (!language || pairs.length === 0) {
    return pairs.map(() => null);
  }
  
  // Try to load tree-sitter
  const loader = await getTreeSitterLoader();
  if (!loader || !loader.getLanguageParser) {
    return pairs.map(() => null);
  }
  
  // Ensure parser is loaded before batch processing
  try {
    await loader.getLanguageParser(language);
  } catch (error) {
    console.warn(`[ASTComparator] Failed to load parser for batch:`, error);
    return pairs.map(() => null);
  }
  
  // Process in parallel with limited concurrency
  const CONCURRENCY = 5;
  const results = [];
  
  for (let i = 0; i < pairs.length; i += CONCURRENCY) {
    const batch = pairs.slice(i, i + CONCURRENCY);
    const batchPromises = batch.map(pair => 
      calculateASTSimilarity(pair.lineA, pair.lineB, language)
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  return results;
}

export default {
  calculateASTSimilarity,
  compareASTDetailed,
  batchCompareAST,
  getASTSignature,
  compareASTSignatures,
  CONFIG
};
