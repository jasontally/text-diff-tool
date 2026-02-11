/**
 * Graph-based diff algorithm data structures
 * Based on difftastic's approach using Dijkstra's algorithm on a DAG
 * 
 * Copyright (c) 2026 Jason Tally and contributors
 * SPDX-License-Identifier: MIT
 */

/**
 * Vertex in the diff graph representing a pair of positions
 * Each vertex represents (lhsPosition, rhsPosition, parentStack)
 */
export class GraphVertex {
  /**
   * Create a new graph vertex
   * @param {ASTNode|null} lhsNode - AST node from left side or null
   * @param {ASTNode|null} rhsNode - AST node from right side or null  
   * @param {string} id - Unique vertex identifier
   * @param {Array} parentStack - Stack of parent delimiters to exit together
   */
  constructor(lhsNode, rhsNode, id, parentStack = []) {
    this.lhsNode = lhsNode;      // AST node or null
    this.rhsNode = rhsNode;      // AST node or null
    this.id = id;                // Unique identifier
    this.parentStack = parentStack; // For handling nested delimiters
    this.edges = [];             // Outgoing edges
    this.distance = Infinity;    // Distance from start (for Dijkstra)
    this.visited = false;        // Visitation flag
    this.previous = null;        // Previous vertex in shortest path
  }

  /**
   * Check if this vertex represents the end state
   * @param {number} lhsLength - Total nodes in left tree
   * @param {number} rhsLength - Total nodes in right tree
   * @returns {boolean} True if this is an end vertex
   */
  isEnd(lhsLength, rhsLength) {
    return this.lhsNode === null && this.rhsNode === null &&
           this.parentStack.length === 0;
  }

  /**
   * Get string representation for debugging
   * @returns {string} Debug string
   */
  toString() {
    const lhs = this.lhsNode ? this.lhsNode.type : 'null';
    const rhs = this.rhsNode ? this.rhsNode.type : 'null';
    return `Vertex(${this.id}): lhs=${lhs}, rhs=${rhs}, stack=${this.parentStack.length}`;
  }
}

/**
 * Edge in the diff graph representing an operation
 * Each edge connects two vertices with a cost and operation type
 */
export class GraphEdge {
  /**
   * Create a new graph edge
   * @param {string} type - Edge type: 'unchanged', 'novel-left', 'novel-right'
   * @param {number} cost - Edge cost for Dijkstra's algorithm
   * @param {GraphVertex} from - Source vertex
   * @param {GraphVertex} to - Target vertex
   * @param {Object} metadata - Additional edge metadata
   */
  constructor(type, cost, from, to, metadata = {}) {
    this.type = type;           // 'unchanged', 'novel-left', 'novel-right'
    this.cost = cost;           // Edge weight
    this.from = from;           // Source vertex
    this.to = to;              // Target vertex
    this.metadata = metadata;   // Additional info (node types, etc.)
  }

  /**
   * Get string representation for debugging
   * @returns {string} Debug string
   */
  toString() {
    return `Edge(${this.type}): cost=${this.cost}, ${this.from.id}→${this.to.id}`;
  }
}

/**
 * Cost model for graph edges based on difftastic's approach
 */
export const COST_MODEL = {
  // Unchanged nodes: low cost to encourage matches (1-40 range)
  UNCHANGED_MIN: 1,
  UNCHANGED_MAX: 40,
  
  // Novel nodes: high cost to discourage unnecessary changes (~300)
  NOVEL_NODE: 300,
  
  // Delimiter handling costs
  DELIMITER_ENTER_UNCHANGED: 10,
  DELIMITER_ENTER_NOVEL: 150,
  DELIMITER_EXIT_UNCHANGED: 10,
  DELIMITER_EXIT_NOVEL: 150,
};

/**
 * Calculate edge cost based on type and node characteristics
 * @param {string} edgeType - Type of edge
 * @param {ASTNode} node - Relevant AST node
 * @returns {number} Calculated cost
 */
export function calculateEdgeCost(edgeType, node = null) {
  switch (edgeType) {
    case 'unchanged':
      // Cost varies by node type within the unchanged range
      if (!node) return COST_MODEL.UNCHANGED_MIN;
      
      // Lower cost for simple nodes, higher for complex structures
      if (node.type === 'identifier' || node.type === 'literal') {
        return COST_MODEL.UNCHANGED_MIN;
      } else if (node.type === 'list' || node.children) {
        return COST_MODEL.UNCHANGED_MAX;
      }
      return COST_MODEL.UNCHANGED_MIN + 10;
      
    case 'novel-left':
    case 'novel-right':
      return COST_MODEL.NOVEL_NODE;
      
    case 'delimiter-enter-unchanged':
      return COST_MODEL.DELIMITER_ENTER_UNCHANGED;
      
    case 'delimiter-enter-novel':
      return COST_MODEL.DELIMITER_ENTER_NOVEL;
      
    case 'delimiter-exit-unchanged':
      return COST_MODEL.DELIMITER_EXIT_UNCHANGED;
      
    case 'delimiter-exit-novel':
      return COST_MODEL.DELIMITER_EXIT_NOVEL;
      
    default:
      return 100; // Default medium cost
  }
}

/**
 * Graph data structure for diff algorithm
 * Manages vertices and edges for Dijkstra's shortest path algorithm
 */
export class DiffGraph {
  /**
   * Create a new diff graph
   * @param {number} maxVertices - Maximum vertices before fallback (performance limit)
   * @param {number} maxEdges - Maximum edges before fallback (performance limit)
   */
  constructor(maxVertices = 100000, maxEdges = 500000) {
    this.vertices = new Map();    // Map<vertexId, GraphVertex>
    this.edges = [];              // Array of GraphEdge
    this.startVertex = null;      // START vertex
    this.endVertex = null;        // END vertex
    this.nextVertexId = 0;        // Auto-incrementing vertex IDs
    this.maxVertices = maxVertices;  // Size limit for performance
    this.maxEdges = maxEdges;        // Size limit for performance
  }

  /**
   * Add a vertex to the graph
   * @param {GraphVertex} vertex - Vertex to add
   * @returns {boolean} True if added, false if size limit exceeded
   */
  addVertex(vertex) {
    if (this.vertices.size >= this.maxVertices) {
      return false; // Size limit exceeded
    }
    
    this.vertices.set(vertex.id, vertex);
    this.nextVertexId = Math.max(this.nextVertexId, vertex.id + 1);
    return true;
  }

  /**
   * Add an edge to the graph
   * @param {GraphEdge} edge - Edge to add
   * @returns {boolean} True if added, false if size limit exceeded
   */
  addEdge(edge) {
    if (this.edges.length >= this.maxEdges) {
      return false; // Size limit exceeded
    }
    
    this.edges.push(edge);
    edge.from.edges.push(edge);
    return true;
  }

  /**
   * Create and add a new vertex
   * @param {ASTNode|null} lhsNode - Left AST node
   * @param {ASTNode|null} rhsNode - Right AST node
   * @param {Array} parentStack - Parent delimiter stack
   * @returns {GraphVertex|null} Created vertex or null if limit exceeded
   */
  createVertex(lhsNode, rhsNode, parentStack = []) {
    const vertex = new GraphVertex(lhsNode, rhsNode, this.nextVertexId++, parentStack);
    if (this.addVertex(vertex)) {
      return vertex;
    }
    return null; // Size limit exceeded
  }

  /**
   * Create a vertex with a specific ID (for graph building)
   * @param {string} id - Vertex ID
   * @param {ASTNode|null} lhsNode - Left AST node
   * @param {ASTNode|null} rhsNode - Right AST node
   * @param {Array} parentStack - Parent delimiter stack
   * @returns {GraphVertex} Created vertex
   */
  createVertexWithId(id, lhsNode, rhsNode, parentStack = []) {
    if (this.vertices.size >= this.maxVertices) {
      throw new Error('Graph size limit exceeded');
    }
    
    const vertex = new GraphVertex(lhsNode, rhsNode, id, parentStack);
    this.vertices.set(id, vertex);
    return vertex;
  }

  /**
   * Create and add a new edge
   * @param {string} type - Edge type
   * @param {GraphVertex} from - Source vertex
   * @param {GraphVertex} to - Target vertex
   * @param {ASTNode} node - Relevant node for cost calculation
   * @param {Object} metadata - Additional metadata
   * @returns {GraphEdge|null} Created edge or null if limit exceeded
   */
  createEdge(type, from, to, node = null, metadata = {}) {
    const cost = calculateEdgeCost(type, node);
    const edge = new GraphEdge(type, cost, from, to, metadata);
    if (this.addEdge(edge)) {
      return edge;
    }
    return null; // Size limit exceeded
  }

  /**
   * Get vertex by ID
   * @param {number} id - Vertex ID
   * @returns {GraphVertex|undefined} Vertex or undefined
   */
  getVertex(id) {
    return this.vertices.get(id);
  }

  /**
   * Check if graph exceeds recommended size limits
   * @returns {boolean} True if graph is too large
   */
  isTooLarge() {
    return this.vertices.size >= this.maxVertices || 
           this.edges.length >= this.maxEdges;
  }

  /**
   * Get graph statistics
   * @returns {Object} Graph statistics
   */
  getStats() {
    return {
      vertexCount: this.vertices.size,
      edgeCount: this.edges.length,
      maxVertices: this.maxVertices,
      maxEdges: this.maxEdges,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Estimate memory usage in bytes (rough approximation)
   * @returns {number} Estimated memory usage in bytes
   */
  estimateMemoryUsage() {
    // Rough estimation: each vertex ~200 bytes, each edge ~150 bytes
    const vertexBytes = this.vertices.size * 200;
    const edgeBytes = this.edges.length * 150;
    return vertexBytes + edgeBytes;
  }

  /**
   * Clear all vertices and edges (reset graph)
   */
  clear() {
    this.vertices.clear();
    this.edges.length = 0;
    this.startVertex = null;
    this.endVertex = null;
    this.nextVertexId = 0;
  }

  /**
   * Get string representation for debugging
   * @returns {string} Debug string
   */
  toString() {
    return `DiffGraph: ${this.vertices.size} vertices, ${this.edges.length} edges`;
  }
}

/**
 * Node mapping utilities for AST to graph vertex conversion
 */
export class NodeMapper {
  /**
   * Create a node mapper
   */
  constructor() {
    this.lhsToVertex = new Map();  // Map<lhsNode, Set<vertexId>>
    this.rhsToVertex = new Map();  // Map<rhsNode, Set<vertexId>>
  }

  /**
   * Map an AST node to vertex IDs
   * @param {ASTNode} node - AST node to map
   * @param {string} side - 'lhs' or 'rhs'
   * @param {number} vertexId - Vertex ID
   */
  mapNode(node, side, vertexId) {
    if (!node) return;
    
    const map = side === 'lhs' ? this.lhsToVertex : this.rhsToVertex;
    if (!map.has(node)) {
      map.set(node, new Set());
    }
    map.get(node).add(vertexId);
  }

  /**
   * Get vertices that contain a specific AST node
   * @param {ASTNode} node - AST node to lookup
   * @param {string} side - 'lhs' or 'rhs'
   * @returns {Set<number>} Set of vertex IDs
   */
  getVerticesForNode(node, side) {
    if (!node) return new Set();
    
    const map = side === 'lhs' ? this.lhsToVertex : this.rhsToVertex;
    return map.get(node) || new Set();
  }

  /**
   * Clear all mappings
   */
  clear() {
    this.lhsToVertex.clear();
    this.rhsToVertex.clear();
  }
}

// ============================================================================
// Dijkstra Diff Algorithm Implementation
// ============================================================================

/**
 * Build a diff graph from two ASTs using Dijkstra's algorithm approach
 * @param {ASTNode} astA - Left AST node (before)
 * @param {ASTNode} astB - Right AST node (after)
 * @param {Object} options - Configuration options
 * @returns {DiffGraph} Constructed diff graph
 */
export function buildGraphFromASTs(astA, astB, options = {}) {
  const graph = new DiffGraph(options.maxVertices, options.maxEdges);
  
  // Convert ASTs to flat lists for easier processing
  const lhsNodes = flattenAST(astA);
  const rhsNodes = flattenAST(astB);
  
  // Create start and end vertices using numeric IDs
  const start = graph.createVertex(null, null, []);
  if (!start) {
    throw new Error('Failed to create start vertex - graph size limit exceeded');
  }
  graph.startVertex = start;
  
  const end = graph.createVertex(null, null, []);
  if (!end) {
    throw new Error('Failed to create end vertex - graph size limit exceeded');
  }
  graph.endVertex = end;
  
  // Build a simple linear graph for demonstration
  // In a full implementation, this would build the complete state space
  let previousVertex = start;
  
  // Add vertices for each possible position combination
  const maxLength = Math.max(lhsNodes.length, rhsNodes.length);
  
  for (let i = 0; i <= maxLength; i++) {
    // Handle deletions (lhs advances, rhs doesn't)
    if (i < lhsNodes.length) {
      const deleteVertex = graph.createVertex(lhsNodes[i], null, []);
      if (deleteVertex) {
        const deleteCost = calculateEdgeCost('novel-left', lhsNodes[i]);
        graph.createEdge('novel-left', previousVertex, deleteVertex, lhsNodes[i]);
        previousVertex = deleteVertex;
      }
    }
    
    // Handle insertions (rhs advances, lhs doesn't)
    if (i < rhsNodes.length) {
      const insertVertex = graph.createVertex(null, rhsNodes[i], []);
      if (insertVertex) {
        const insertCost = calculateEdgeCost('novel-right', rhsNodes[i]);
        graph.createEdge('novel-right', previousVertex, insertVertex, rhsNodes[i]);
        previousVertex = insertVertex;
      }
    }
    
    // Handle matches (both advance)
    if (i < lhsNodes.length && i < rhsNodes.length) {
      if (areNodesSimilar(lhsNodes[i], rhsNodes[i])) {
        const matchVertex = graph.createVertex(lhsNodes[i], rhsNodes[i], []);
        if (matchVertex) {
          const matchCost = calculateEdgeCost('unchanged', lhsNodes[i]);
          graph.createEdge('unchanged', previousVertex, matchVertex, lhsNodes[i]);
          previousVertex = matchVertex;
        }
      }
    }
  }
  
  // Connect final vertex to end
  if (previousVertex) {
    graph.createEdge('unchanged', previousVertex, end);
  }
  
  return graph;
}

/**
 * Generate possible edges from current vertex
 * @param {DiffGraph} graph - The diff graph
 * @param {GraphVertex} current - Current vertex
 * @param {Array} lhsNodes - Flattened left AST nodes
 * @param {Array} rhsNodes - Flattened right AST nodes
 * @param {number} lhsIndex - Current left index
 * @param {number} rhsIndex - Current right index
 * @param {PriorityQueue} queue - Priority queue for Dijkstra
 */
function generateEdges(graph, current, lhsNodes, rhsNodes, lhsIndex, rhsIndex, queue) {
  // Edge 1: Novel Left (deletion) - advance left side only
  if (lhsIndex < lhsNodes.length) {
    const nextLhsNode = lhsNodes[lhsIndex];
    const nextLhsIndex = lhsIndex + 1;
    
    // Find or create vertex for this position
    const novelLeftKey = `lhs_${nextLhsIndex}_rhs_${rhsIndex}`;
    let novelLeftVertex = graph.getVertex(novelLeftKey);
    
    if (!novelLeftVertex) {
      novelLeftVertex = graph.createVertex(nextLhsNode, current.rhsNode, current.parentStack);
      if (novelLeftVertex) {
        // Update the vertex ID to use our key
        graph.vertices.delete(novelLeftVertex.id);
        novelLeftVertex.id = novelLeftKey;
        graph.vertices.set(novelLeftKey, novelLeftVertex);
      }
    }
    
    if (novelLeftVertex) {
      const novelCost = calculateEdgeCost('novel-left', nextLhsNode);
      const novelEdge = graph.createEdge('novel-left', current, novelLeftVertex, nextLhsNode);
      
      if (novelEdge && novelLeftVertex.distance > current.distance + novelCost) {
        novelLeftVertex.distance = current.distance + novelCost;
        novelLeftVertex.previous = current;
        queue.enqueue(novelLeftVertex);
      }
    }
  }
  
  // Edge 2: Novel Right (insertion) - advance right side only
  if (rhsIndex < rhsNodes.length) {
    const nextRhsNode = rhsNodes[rhsIndex];
    const nextRhsIndex = rhsIndex + 1;
    
    // Find or create vertex for this position
    const novelRightKey = `lhs_${lhsIndex}_rhs_${nextRhsIndex}`;
    let novelRightVertex = graph.getVertex(novelRightKey);
    
    if (!novelRightVertex) {
      novelRightVertex = graph.createVertex(current.lhsNode, nextRhsNode, current.parentStack);
      if (novelRightVertex) {
        // Update the vertex ID to use our key
        graph.vertices.delete(novelRightVertex.id);
        novelRightVertex.id = novelRightKey;
        graph.vertices.set(novelRightKey, novelRightVertex);
      }
    }
    
    if (novelRightVertex) {
      const novelCost = calculateEdgeCost('novel-right', nextRhsNode);
      const novelEdge = graph.createEdge('novel-right', current, novelRightVertex, nextRhsNode);
      
      if (novelEdge && novelRightVertex.distance > current.distance + novelCost) {
        novelRightVertex.distance = current.distance + novelCost;
        novelRightVertex.previous = current;
        queue.enqueue(novelRightVertex);
      }
    }
  }
  
  // Edge 3: Unchanged (match) - advance both sides if nodes are similar
  if (lhsIndex < lhsNodes.length && rhsIndex < rhsNodes.length) {
    const lhsNode = lhsNodes[lhsIndex];
    const rhsNode = rhsNodes[rhsIndex];
    
    if (areNodesSimilar(lhsNode, rhsNode)) {
      const nextLhsIndex = lhsIndex + 1;
      const nextRhsIndex = rhsIndex + 1;
      
      // Find or create vertex for this position
      const unchangedKey = `lhs_${nextLhsIndex}_rhs_${nextRhsIndex}`;
      let unchangedVertex = graph.getVertex(unchangedKey);
      
      if (!unchangedVertex) {
        unchangedVertex = graph.createVertex(lhsNode, rhsNode, current.parentStack);
        if (unchangedVertex) {
          // Update the vertex ID to use our key
          graph.vertices.delete(unchangedVertex.id);
          unchangedVertex.id = unchangedKey;
          graph.vertices.set(unchangedKey, unchangedVertex);
        }
      }
      
      if (unchangedVertex) {
        const unchangedCost = calculateEdgeCost('unchanged', lhsNode);
        const unchangedEdge = graph.createEdge('unchanged', current, unchangedVertex, lhsNode);
        
        if (unchangedEdge && unchangedVertex.distance > current.distance + unchangedCost) {
          unchangedVertex.distance = current.distance + unchangedCost;
          unchangedVertex.previous = current;
          queue.enqueue(unchangedVertex);
        }
      }
    }
  }
}

/**
 * Run Dijkstra's algorithm on a diff graph
 * @param {DiffGraph} graph - The diff graph
 * @returns {GraphVertex|null} End vertex with shortest path
 */
export function dijkstra(graph) {
  if (!graph.startVertex) {
    throw new Error('Graph has no start vertex');
  }
  
  // Reset all vertices
  for (const vertex of graph.vertices.values()) {
    vertex.distance = Infinity;
    vertex.visited = false;
    vertex.previous = null;
  }
  
  graph.startVertex.distance = 0;
  
  const queue = new PriorityQueue();
  queue.enqueue(graph.startVertex);
  
  while (!queue.isEmpty()) {
    const current = queue.dequeue();
    
    if (current.visited) continue;
    current.visited = true;
    
    // If we've reached the end, return it
    if (current === graph.endVertex) {
      return current;
    }
    
    // Process all outgoing edges
    for (const edge of current.edges) {
      const neighbor = edge.to;
      
      if (!neighbor.visited && neighbor.distance > current.distance + edge.cost) {
        neighbor.distance = current.distance + edge.cost;
        neighbor.previous = current;
        queue.enqueue(neighbor);
      }
    }
  }
  
  // Return the end vertex even if not perfectly reachable (partial path)
  return graph.endVertex;
}

/**
 * Run the complete Dijkstra-based diff algorithm
 * @param {ASTNode} astA - Left AST node (before)
 * @param {ASTNode} astB - Right AST node (after)
 * @param {Object} options - Configuration options
 * @returns {Array} Array of diff results
 */
export function runDijkstraDiff(astA, astB, options = {}) {
  const {
    maxVertices = 100000,
    maxEdges = 500000,
    similarityThreshold = 0.8
  } = options;
  
  try {
    // Build the graph
    const graph = buildGraphFromASTs(astA, astB, { maxVertices, maxEdges });
    
    // Run Dijkstra to find shortest path
    const endVertex = dijkstra(graph);
    
    if (!endVertex) {
      throw new Error('No path found from start to end');
    }
    
    // Convert path to diff results
    return pathToDiff(endVertex);
    
  } catch (error) {
    if (error.message.includes('Graph too large')) {
      // Fallback to simpler algorithm for large inputs
      console.warn('Graph too large, falling back to LCS algorithm');
      // This would integrate with existing LCS algorithm
      throw error; // For now, re-throw
    }
    throw error;
  }
}

/**
 * Convert the shortest path to diff results
 * @param {GraphVertex} endVertex - End vertex of shortest path
 * @returns {Array} Array of diff results
 */
function pathToDiff(endVertex) {
  const results = [];
  let current = endVertex;
  
  // Walk backwards from end to start
  while (current && current.previous) {
    // Find the edge that connects previous to current
    const edge = current.previous.edges.find(e => e.to === current);
    
    if (edge) {
      const diffResult = {
        type: edge.type,
        lhsNode: edge.from.lhsNode,
        rhsNode: edge.to.rhsNode,
        cost: edge.cost,
        metadata: edge.metadata
      };
      results.unshift(diffResult);
    }
    
    current = current.previous;
  }
  
  return results;
}

/**
 * Check if two AST nodes are similar enough to be considered unchanged
 * @param {ASTNode} nodeA - First node
 * @param {ASTNode} nodeB - Second node
 * @returns {boolean} True if nodes are similar
 */
function areNodesSimilar(nodeA, nodeB) {
  // Exact match
  if (nodeA.type === nodeB.type && nodeA.text === nodeB.text) {
    return true;
  }
  
  // Same type with similar content
  if (nodeA.type === nodeB.type) {
    const similarity = calculateTextSimilarity(nodeA.text || '', nodeB.text || '');
    return similarity > 0.8;
  }
  
  return false;
}

/**
 * Calculate text similarity using simple Levenshtein distance
 * @param {string} text1 - First text
 * @param {string} text2 - Second text
 * @returns {number} Similarity score between 0 and 1
 */
function calculateTextSimilarity(text1, text2) {
  if (text1 === text2) return 1;
  if (text1.length === 0) return 0;
  if (text2.length === 0) return 0;
  
  const distance = levenshteinDistance(text1, text2);
  const maxLength = Math.max(text1.length, text2.length);
  return 1 - (distance / maxLength);
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Levenshtein distance
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Flatten AST into a list of nodes for processing
 * @param {ASTNode} ast - Root AST node
 * @returns {Array} Flattened list of nodes
 */
function flattenAST(ast) {
  const nodes = [];
  
  function traverse(node) {
    if (!node) return;
    
    nodes.push(node);
    
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }
  
  traverse(ast);
  return nodes;
}

/**
 * Simple priority queue implementation for Dijkstra
 */
export class PriorityQueue {
  /**
   * Create a priority queue
   * @param {Function} comparator - Comparison function
   */
  constructor(comparator = (a, b) => a.distance - b.distance) {
    this.heap = [];
    this.comparator = comparator;
  }
  
  /**
   * Add an item to the queue
   * @param {*} item - Item to add
   */
  enqueue(item) {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }
  
  /**
   * Remove and return the highest priority item
   * @returns {*} Highest priority item or null if empty
   */
  dequeue() {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop();
    
    const top = this.heap[0];
    this.heap[0] = this.heap.pop();
    this.bubbleDown(0);
    return top;
  }
  
  /**
   * Check if queue is empty
   * @returns {boolean} True if empty
   */
  isEmpty() {
    return this.heap.length === 0;
  }
  
  /**
   * Bubble up an element to maintain heap property
   * @param {number} index - Index of element to bubble up
   */
  bubbleUp(index) {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.comparator(this.heap[index], this.heap[parentIndex]) >= 0) break;
      
      [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
      index = parentIndex;
    }
  }
  
  /**
   * Bubble down an element to maintain heap property
   * @param {number} index - Index of element to bubble down
   */
  bubbleDown(index) {
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;
      
      if (leftChild < this.heap.length && 
          this.comparator(this.heap[leftChild], this.heap[smallest]) < 0) {
        smallest = leftChild;
      }
      
      if (rightChild < this.heap.length && 
          this.comparator(this.heap[rightChild], this.heap[smallest]) < 0) {
        smallest = rightChild;
      }
      
      if (smallest === index) break;
      
      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }
}