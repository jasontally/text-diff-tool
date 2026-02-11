/**
 * AST Feature Extractor Module
 * 
 * Extracts lightweight, serializable AST features from code for use in Web Workers.
 * Works with Tree-sitter to parse code and extract structure signatures that can
 * be passed via postMessage for AST-aware similarity calculation.
 * 
 * Copyright (c) 2025 Jason Tally and contributors
 * SPDX-License-Identifier: MIT
 */

/**
 * Extract AST features from a single line of code
 * 
 * @param {Object} tree - Tree-sitter parse tree for the line
 * @param {number} maxDepth - Maximum depth to extract (default: 3)
 * @returns {Object|null} AST signature or null if failed
 */
export function getASTSignature(tree, maxDepth = 3) {
  if (!tree || !tree.rootNode) {
    return null;
  }
  
  const rootNode = tree.rootNode;
  
  // Check for parse errors
  if (rootNode.hasError && rootNode.hasError()) {
    return { hasError: true, type: rootNode.type, childCount: rootNode.childCount };
  }
  
  // Ignored node types (punctuation, comments)
  const IGNORED_NODE_TYPES = [
    'comment', 'line_comment', 'block_comment',
    ';', ',', '(', ')', '{', '}', '[', ']'
  ];
  
  /**
   * Recursively extract node structure
   * 
   * @param {Object} node - Tree-sitter node
   * @param {number} depth - Current depth
   * @returns {Object|null} Node structure
   */
  function extractNode(node, depth = 0) {
    // Base case: max depth reached
    if (depth >= maxDepth) {
      return { type: node.type, truncated: true };
    }
    
    // Skip ignored node types
    if (IGNORED_NODE_TYPES.includes(node.type)) {
      return null;
    }
    
    const result = {
      type: node.type,
      children: []
    };
    
    // Limit children processed
    const MAX_CHILDREN = 20;
    const childrenToProcess = node.children ? node.children.slice(0, MAX_CHILDREN) : [];
    
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
 * Extract AST features for an entire file
 * Parses the file and returns features for each line
 * 
 * @param {Object} parser - Tree-sitter parser instance
 * @param {string} text - Full file text
 * @returns {Object} AST features for the file
 */
export function extractFileASTFeatures(parser, text) {
  if (!parser || !text) {
    return null;
  }
  
  try {
    const tree = parser.parse(text);
    if (!tree || !tree.rootNode) {
      return null;
    }
    
    const rootNode = tree.rootNode;
    const lines = text.split('\n');
    const lineSignatures = [];
    
    // Extract signature for each line
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      
      // Skip empty lines
      if (!lineText.trim()) {
        lineSignatures.push(null);
        continue;
      }
      
      // Find nodes on this line
      const lineNodes = findNodesOnLine(rootNode, i);
      
      if (lineNodes.length > 0) {
        // Create a composite signature from nodes on this line
        const lineSig = createLineSignature(lineNodes);
        lineSignatures.push(lineSig);
      } else {
        lineSignatures.push(null);
      }
    }
    
    // Clean up tree to prevent memory leaks
    try {
      tree.delete();
    } catch (e) {
      // Ignore cleanup errors
    }
    
    return {
      rootType: rootNode.type,
      totalLines: lines.length,
      lineSignatures: lineSignatures,
      fileSignature: getASTSignature(tree)
    };
  } catch (error) {
    console.warn('[ASTFeatureExtractor] Failed to extract features:', error.message);
    return null;
  }
}

/**
 * Find all AST nodes that exist on a specific line
 * 
 * @param {Object} node - Root node to search from
 * @param {number} lineIndex - Line index (0-based)
 * @returns {Array} Array of nodes on this line
 */
function findNodesOnLine(node, lineIndex) {
  const nodes = [];
  const targetLine = lineIndex; // Tree-sitter uses 0-based row indexing
  
  function traverse(n) {
    if (!n) return;
    
    // Check if node starts on this line
    if (n.startPosition && n.startPosition.row === targetLine) {
      // Only include significant nodes (not just punctuation)
      if (isSignificantNode(n)) {
        nodes.push(n);
      }
    }
    
    // Recurse into children
    if (n.children && n.children.length > 0) {
      for (const child of n.children) {
        traverse(child);
      }
    }
  }
  
  traverse(node);
  return nodes;
}

/**
 * Check if a node is significant (not just punctuation/whitespace)
 * 
 * @param {Object} node - Tree-sitter node
 * @returns {boolean} True if significant
 */
function isSignificantNode(node) {
  const insignificantTypes = [
    ';', ',', '(', ')', '{', '}', '[', ']',
    '.', ':', ';', '\n', '\t', ' '
  ];
  
  return !insignificantTypes.includes(node.type);
}

/**
 * Create a signature for a line from its nodes
 * 
 * @param {Array} nodes - Nodes on this line
 * @returns {Object} Line signature
 */
function createLineSignature(nodes) {
  if (nodes.length === 0) {
    return null;
  }
  
  // Get the primary node (usually the first significant one)
  const primaryNode = nodes[0];
  
  return {
    type: primaryNode.type,
    nodeTypes: nodes.map(n => n.type),
    startColumn: primaryNode.startPosition ? primaryNode.startPosition.column : 0,
    endColumn: primaryNode.endPosition ? primaryNode.endPosition.column : 0,
    childCount: primaryNode.childCount || 0
  };
}

/**
 * Calculate similarity between two AST signatures
 * Uses the same algorithm as ast-comparator.js
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
  
  // Calculate child similarity using greedy matching
  let matches = 0;
  const maxChildren = Math.max(childrenA.length, childrenB.length);
  
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
 * Calculate similarity between two lines using pre-extracted features
 * This is the main entry point for worker-side comparison
 * 
 * @param {Object} featuresA - AST features for line A
 * @param {Object} featuresB - AST features for line B
 * @returns {number|null} Similarity score or null if not comparable
 */
export function calculateSimilarityFromFeatures(featuresA, featuresB) {
  // If either is null, fall back to text comparison
  if (!featuresA || !featuresB) {
    return null;
  }
  
  // Use line-level signatures if available
  if (featuresA.lineSignatures && featuresB.lineSignatures) {
    // This would require line index, handled in batch comparison
    return null;
  }
  
  // Use full file signatures for overall structural similarity
  if (featuresA.fileSignature && featuresB.fileSignature) {
    return compareASTSignatures(featuresA.fileSignature, featuresB.fileSignature);
  }
  
  return null;
}

/**
 * Prepare AST features for both files to pass to worker
 * Main thread calls this before starting comparison
 * 
 * @param {Object} parser - Tree-sitter parser instance
 * @param {string} oldText - Previous version text
 * @param {string} newText - Current version text
 * @returns {Object|null} AST features for both files or null if failed
 */
export function prepareASTFeatures(parser, oldText, newText) {
  if (!parser) {
    return null;
  }
  
  try {
    const oldFeatures = extractFileASTFeatures(parser, oldText);
    const newFeatures = extractFileASTFeatures(parser, newText);
    
    if (!oldFeatures || !newFeatures) {
      return null;
    }
    
    return {
      oldFeatures,
      newFeatures,
      timestamp: Date.now()
    };
  } catch (error) {
    console.warn('[ASTFeatureExtractor] Failed to prepare features:', error.message);
    return null;
  }
}

export default {
  getASTSignature,
  extractFileASTFeatures,
  compareASTSignatures,
  calculateSimilarityFromFeatures,
  prepareASTFeatures
};
