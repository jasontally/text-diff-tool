/**
 * Tree-sitter based Move Detection
 * 
 * Uses Tree-sitter AST parsing to detect moved code blocks with high accuracy.
 * This approach is superior to text-based detection because it:
 * - Ignores comments and whitespace
 * - Understands code structure (functions, classes, etc.)
 * - Can detect moves even when surrounding context changes
 * - Handles modified moves (content similar but not identical)
 * 
 * Copyright (c) 2026 Jason Tally and contributors
 * SPDX-License-Identifier: MIT
 */

/**
 * Detect moved code blocks using Tree-sitter AST comparison
 * Also detects content moves (comments, declarations) that aren't AST nodes
 * 
 * @param {string} oldText - Original source code
 * @param {string} newText - Modified source code  
 * @param {Object} parser - Initialized Tree-sitter parser
 * @param {Object} options - Detection options
 * @returns {Object} Detected moves with mappings
 */
export function detectMovesWithTreeSitter(oldText, newText, parser, options = {}) {
  const config = {
    minBlockSize: options.minBlockSize || 1,        // Single line moves allowed
    maxBlockSize: options.maxBlockSize || 100,      // Prevent huge blocks
    similarityThreshold: options.similarityThreshold || 0.85,  // For modified moves
    ...options
  };

  // Parse both files
  const treeA = parser.parse(oldText);
  const treeB = parser.parse(newText);

  try {
    // Extract AST nodes (functions, classes, etc.)
    const oldNodes = extractSignificantNodes(treeA.rootNode, oldText);
    const newNodes = extractSignificantNodes(treeB.rootNode, newText);

    // Find moved AST nodes
    const moves = findMovedNodes(oldNodes, newNodes, config);
    
    // Also detect content moves (comments, declarations) using line-based comparison
    // This catches moves that aren't AST nodes but appear in both files
    const contentMoves = findContentMoves(oldText, newText, config);
    
    // Merge moves (avoid duplicates)
    const allMoves = [...moves, ...contentMoves];

    return {
      moves: allMoves,
      oldNodes,
      newNodes,
      treeA,
      treeB
    };
  } catch (error) {
    console.error('[TreeSitterMoveDetection] Error:', error);
    return { moves: [], oldNodes: [], newNodes: [], treeA, treeB };
  }
}

/**
 * Extract significant AST nodes that could be moved
 * Includes: functions, classes, methods, blocks, etc.
 */
function extractSignificantNodes(rootNode, sourceText) {
  const nodes = [];
  
  const significantTypes = [
    'function_declaration',
    'function_definition', 
    'method_definition',
    'class_declaration',
    'class_definition',
    'arrow_function',
    'statement_block',
    'object',
    'array',
    'if_statement',
    'for_statement',
    'while_statement',
    'switch_statement',
    'try_statement'
  ];

  function traverse(node, depth = 0) {
    // Skip very small nodes (single tokens)
    if (node.endPosition.row - node.startPosition.row < 0) {
      return;
    }

    // Check if this is a significant node type
    if (significantTypes.includes(node.type)) {
      const content = sourceText.substring(node.startIndex, node.endIndex);
      const normalizedContent = normalizeNodeContent(content);
      
      nodes.push({
        type: node.type,
        startLine: node.startPosition.row,
        endLine: node.endPosition.row,
        startIndex: node.startIndex,
        endIndex: node.endIndex,
        content: normalizedContent,
        contentHash: hashContent(normalizedContent),
        depth,
        node
      });
    }

    // Recurse into children
    for (let i = 0; i < node.childCount; i++) {
      traverse(node.child(i), depth + 1);
    }
  }

  traverse(rootNode);
  return nodes;
}

/**
 * Normalize node content by removing comments and extra whitespace
 * This ensures nodes match even if formatting differs
 */
function normalizeNodeContent(content) {
  return content
    // Remove single-line comments
    .replace(/\/\/.*$/gm, '')
    // Remove multi-line comments  
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Simple hash function for content comparison
 */
function hashContent(content) {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * Find nodes that moved by comparing old and new positions
 */
function findMovedNodes(oldNodes, newNodes, config) {
  const moves = [];
  const matchedOld = new Set();
  const matchedNew = new Set();

  // First pass: Find exact matches (pure moves)
  for (const oldNode of oldNodes) {
    if (matchedOld.has(oldNode)) continue;

    // Find matching node in new tree
    const matches = newNodes.filter(newNode => 
      !matchedNew.has(newNode) &&
      newNode.contentHash === oldNode.contentHash &&
      newNode.type === oldNode.type
    );

    if (matches.length === 1) {
      const newNode = matches[0];
      
      // Check if position changed
      if (oldNode.startLine !== newNode.startLine) {
        moves.push({
          type: 'moved',
          oldStartLine: oldNode.startLine,
          oldEndLine: oldNode.endLine,
          newStartLine: newNode.startLine,
          newEndLine: newNode.endLine,
          content: oldNode.content,
          similarity: 1.0,
          isModified: false,
          nodeType: oldNode.type
        });
        
        matchedOld.add(oldNode);
        matchedNew.add(newNode);
      }
    }
  }

  // Second pass: Find similar matches (modified moves)
  for (const oldNode of oldNodes) {
    if (matchedOld.has(oldNode)) continue;

    // Find similar nodes using content similarity
    const candidates = newNodes.filter(newNode => 
      !matchedNew.has(newNode) &&
      newNode.type === oldNode.type
    );

    let bestMatch = null;
    let bestSimilarity = 0;

    for (const newNode of candidates) {
      const similarity = calculateSimilarity(oldNode.content, newNode.content);
      
      if (similarity > config.similarityThreshold && similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = newNode;
      }
    }

    if (bestMatch && oldNode.startLine !== bestMatch.startLine) {
      moves.push({
        type: 'moved-modified',
        oldStartLine: oldNode.startLine,
        oldEndLine: oldNode.endLine,
        newStartLine: bestMatch.startLine,
        newEndLine: bestMatch.endLine,
        oldContent: oldNode.content,
        newContent: bestMatch.content,
        similarity: bestSimilarity,
        isModified: true,
        nodeType: oldNode.type
      });
      
      matchedOld.add(oldNode);
      matchedNew.add(bestMatch);
    }
  }

  return moves.sort((a, b) => a.oldStartLine - b.oldStartLine);
}

/**
 * Find content moves that aren't captured by AST node comparison
 * This detects when comments, declarations, or other text blocks moved
 * by comparing multi-line content between old and new files
 * 
 * @param {string} oldText - Original text
 * @param {string} newText - Modified text
 * @param {Object} config - Configuration options
 * @returns {Array} Array of detected content moves
 */
function findContentMoves(oldText, newText, config) {
  const moves = [];
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  
  // Look for multi-line blocks (2-5 lines) that appear in both files
  // but at different positions
  const blockSizes = [5, 4, 3, 2];
  const matchedOldLines = new Set();
  const matchedNewLines = new Set();
  
  for (const blockSize of blockSizes) {
    // Extract all blocks of this size from old file
    for (let oldStart = 0; oldStart <= oldLines.length - blockSize; oldStart++) {
      // Skip if any line in this block is already matched
      let alreadyMatched = false;
      for (let i = 0; i < blockSize; i++) {
        if (matchedOldLines.has(oldStart + i)) {
          alreadyMatched = true;
          break;
        }
      }
      if (alreadyMatched) continue;
      
      const oldBlock = oldLines.slice(oldStart, oldStart + blockSize);
      const oldContent = oldBlock.join('\n');
      
      // Skip blocks that are mostly empty or trivial
      if (oldContent.trim().length < 10) continue;
      
      // Look for matching block in new file
      for (let newStart = 0; newStart <= newLines.length - blockSize; newStart++) {
        // Skip if any line in this block is already matched
        let newAlreadyMatched = false;
        for (let i = 0; i < blockSize; i++) {
          if (matchedNewLines.has(newStart + i)) {
            newAlreadyMatched = true;
            break;
          }
        }
        if (newAlreadyMatched) continue;
        
        const newBlock = newLines.slice(newStart, newStart + blockSize);
        const newContent = newBlock.join('\n');
        
        // Check for exact match or high similarity
        const similarity = calculateSimilarity(oldContent, newContent);
        
        if (similarity >= 0.95) {
          // Found a match! Check if it moved
          if (oldStart !== newStart) {
            moves.push({
              type: similarity === 1.0 ? 'moved' : 'moved-modified',
              oldStartLine: oldStart,
              oldEndLine: oldStart + blockSize - 1,
              newStartLine: newStart,
              newEndLine: newStart + blockSize - 1,
              content: oldContent,
              newContent: newContent,
              similarity: similarity,
              isModified: similarity < 1.0,
              nodeType: 'content-block'
            });
            
            // Mark these lines as matched
            for (let i = 0; i < blockSize; i++) {
              matchedOldLines.add(oldStart + i);
              matchedNewLines.add(newStart + i);
            }
          }
          
          // Break out of new file search for this old block
          break;
        }
      }
    }
  }
  
  return moves;
}

/**
 * Calculate similarity between two content strings
 * Simple but effective for code comparison
 */
function calculateSimilarity(contentA, contentB) {
  if (contentA === contentB) return 1.0;
  if (!contentA || !contentB) return 0.0;

  const linesA = contentA.split('\n').filter(l => l.trim());
  const linesB = contentB.split('\n').filter(l => l.trim());
  
  if (linesA.length === 0 || linesB.length === 0) return 0.0;

  // Count matching lines
  let matches = 0;
  const usedB = new Set();

  for (const lineA of linesA) {
    const trimmedA = lineA.trim();
    if (!trimmedA) continue;

    for (let i = 0; i < linesB.length; i++) {
      if (usedB.has(i)) continue;
      
      const trimmedB = linesB[i].trim();
      if (trimmedA === trimmedB) {
        matches++;
        usedB.add(i);
        break;
      }
    }
  }

  const maxLines = Math.max(linesA.length, linesB.length);
  return matches / maxLines;
}

/**
 * Apply Tree-sitter detected moves to diff results
 * This integrates with the existing diff pipeline
 */
export function applyTreeSitterMoves(diffResults, moves, oldText, newText) {
  const enhancedResults = [...diffResults];
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  for (const move of moves) {
    // Find the diff entries corresponding to this move
    const oldStartIdx = findDiffIndexForLine(enhancedResults, move.oldStartLine, 'removed');
    const newStartIdx = findDiffIndexForLine(enhancedResults, move.newStartLine, 'added');

    if (oldStartIdx !== -1 && newStartIdx !== -1) {
      // Mark both entries as moved
      enhancedResults[oldStartIdx] = {
        ...enhancedResults[oldStartIdx],
        classification: move.isModified ? 'moved-modified' : 'moved',
        moveDestination: newStartIdx,
        isTreeSitterMove: true,
        moveInfo: move
      };

      enhancedResults[newStartIdx] = {
        ...enhancedResults[newStartIdx],
        classification: move.isModified ? 'moved-modified' : 'moved',
        moveSource: oldStartIdx,
        isTreeSitterMove: true,
        moveInfo: move
      };
    }
  }

  return enhancedResults;
}

/**
 * Find the diff result index that contains a specific line
 */
function findDiffIndexForLine(diffResults, lineNum, type) {
  let currentLine = 0;

  for (let i = 0; i < diffResults.length; i++) {
    const result = diffResults[i];
    const lines = result.value.split('\n').filter(l => l.length > 0);
    const lineCount = lines.length;

    if (type === 'removed' && result.removed) {
      if (currentLine <= lineNum && lineNum < currentLine + lineCount) {
        return i;
      }
      currentLine += lineCount;
    } else if (type === 'added' && result.added) {
      if (currentLine <= lineNum && lineNum < currentLine + lineCount) {
        return i;
      }
      currentLine += lineCount;
    } else if (!result.added && !result.removed) {
      // Unchanged lines count for both
      currentLine += lineCount;
    }
  }

  return -1;
}

/**
 * Main entry point for Tree-sitter move detection
 * Call this from index.html after getting diff results
 */
export async function enhanceDiffWithTreeSitterMoves(diffResult, oldText, newText, parser) {
  if (!parser) {
    console.log('[TreeSitterMoveDetection] No parser available');
    return diffResult;
  }

  console.log('[TreeSitterMoveDetection] Running move detection...');

  const detectionResult = detectMovesWithTreeSitter(oldText, newText, parser, {
    minBlockSize: 1,  // Support single line moves
    similarityThreshold: 0.75  // For detecting modified moves
  });

  if (detectionResult.moves.length === 0) {
    console.log('[TreeSitterMoveDetection] No moves detected');
    return diffResult;
  }

  console.log(`[TreeSitterMoveDetection] Found ${detectionResult.moves.length} moves`);

  // Apply moves to diff results
  const enhancedResults = applyTreeSitterMoves(
    diffResult.results,
    detectionResult.moves,
    oldText,
    newText
  );

  // Update stats
  const newStats = { ...diffResult.stats };
  const pureMoves = detectionResult.moves.filter(m => !m.isModified).length;
  const modifiedMoves = detectionResult.moves.filter(m => m.isModified).length;

  newStats.moved = (newStats.moved || 0) + pureMoves + modifiedMoves;
  newStats.removed = Math.max(0, newStats.removed - pureMoves);
  newStats.added = Math.max(0, newStats.added - pureMoves);

  // Clean up trees
  try {
    detectionResult.treeA.delete();
    detectionResult.treeB.delete();
  } catch (e) {
    // Ignore cleanup errors
  }

  return {
    ...diffResult,
    results: enhancedResults,
    stats: newStats,
    treeSitterMoves: detectionResult.moves
  };
}

export default {
  detectMovesWithTreeSitter,
  enhanceDiffWithTreeSitterMoves,
  applyTreeSitterMoves
};
