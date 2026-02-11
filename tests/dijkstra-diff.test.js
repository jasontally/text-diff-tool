/**
 * Dijkstra Diff Algorithm Unit Tests
 * 
 * Tests for the graph-based diff algorithm using Dijkstra's shortest path.
 * Tests verify correct path finding, cost calculation, and optimization.
 * 
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { diffLines } from 'diff';
import {
  GraphVertex,
  GraphEdge,
  DiffGraph,
  NodeMapper,
  PriorityQueue,
  COST_MODEL,
  calculateEdgeCost,
  buildGraphFromASTs,
  dijkstra,
  runDijkstraDiff
} from '../src/graph-diff.js';

// ============================================================================
// Test Data and Helpers
// ============================================================================

/**
 * Create a simple mock AST node
 * @param {string} type - Node type
 * @param {string} text - Node text content
 * @param {Array} children - Child nodes
 * @returns {Object} Mock AST node
 */
function createMockNode(type, text, children = []) {
  return { type, text, children };
}

/**
 * Create a simple test graph with known structure
 * @returns {DiffGraph} Test graph
 */
function createTestGraph() {
  const graph = new DiffGraph();
  
  // Create vertices
  const start = graph.createVertex(null, null, []);
  const v1 = graph.createVertex(createMockNode('identifier', 'a'), null, []);
  const v2 = graph.createVertex(null, createMockNode('identifier', 'b'), []);
  const v3 = graph.createVertex(createMockNode('identifier', 'a'), createMockNode('identifier', 'b'), []);
  const end = graph.createVertex(null, null, []);
  
  graph.startVertex = start;
  graph.endVertex = end;
  
  // Create edges with known costs
  graph.createEdge('novel-left', start, v1, v1.lhsNode);
  graph.createEdge('novel-right', v1, v2, v2.rhsNode);
  graph.createEdge('unchanged', v2, v3, v3.lhsNode);
  graph.createEdge('unchanged', v3, end);
  
  return graph;
}

/**
 * Create test ASTs for comparison
 * @param {Object} options - Options for AST creation
 * @returns {Object} Object with astA and astB
 */
function createTestASTs(options = {}) {
  const { complexity = 'simple' } = options;
  
  if (complexity === 'simple') {
    return {
      astA: createMockNode('program', 'program', [
        createMockNode('declaration', 'let x = 1'),
        createMockNode('declaration', 'let y = 2')
      ]),
      astB: createMockNode('program', 'program', [
        createMockNode('declaration', 'let x = 1'),
        createMockNode('declaration', 'let y = 3'),
        createMockNode('declaration', 'let z = 4')
      ])
    };
  }
  
  if (complexity === 'complex') {
    return {
      astA: createMockNode('class', 'TestClass', [
        createMockNode('method', 'method1()'),
        createMockNode('method', 'method2()'),
        createMockNode('property', 'prop1')
      ]),
      astB: createMockNode('class', 'TestClass', [
        createMockNode('property', 'prop1'),
        createMockNode('method', 'method1()'),
        createMockNode('method', 'method2()'),
        createMockNode('method', 'method3()')
      ])
    };
  }
  
  return { astA: null, astB: null };
}

// ============================================================================
// Graph Structure Tests
// ============================================================================

describe('Graph Structure', () => {
  it('should create vertices with correct properties', () => {
    const lhsNode = createMockNode('identifier', 'test');
    const rhsNode = createMockNode('literal', '42');
    const vertex = new GraphVertex(lhsNode, rhsNode, 'test_id', ['stack1']);
    
    expect(vertex.lhsNode).toBe(lhsNode);
    expect(vertex.rhsNode).toBe(rhsNode);
    expect(vertex.id).toBe('test_id');
    expect(vertex.parentStack).toEqual(['stack1']);
    expect(vertex.distance).toBe(Infinity);
    expect(vertex.visited).toBe(false);
    expect(vertex.previous).toBe(null);
  });

  it('should create edges with correct properties', () => {
    const from = new GraphVertex(null, null, 'from');
    const to = new GraphVertex(null, null, 'to');
    const node = createMockNode('identifier', 'test');
    const edge = new GraphEdge('unchanged', 10, from, to, { test: 'data' });
    
    expect(edge.type).toBe('unchanged');
    expect(edge.cost).toBe(10);
    expect(edge.from).toBe(from);
    expect(edge.to).toBe(to);
    expect(edge.metadata).toEqual({ test: 'data' });
  });

  it('should identify end vertices correctly', () => {
    const endVertex = new GraphVertex(null, null, 'end', []);
    const nonEndVertex1 = new GraphVertex(createMockNode('id', 'a'), null, 'v1');
    const nonEndVertex2 = new GraphVertex(null, null, 'v2', ['stack']);
    
    expect(endVertex.isEnd(5, 5)).toBe(true);
    expect(nonEndVertex1.isEnd(5, 5)).toBe(false);
    expect(nonEndVertex2.isEnd(5, 5)).toBe(false);
  });
});

// ============================================================================
// Cost Function Tests
// ============================================================================

describe('Cost Functions', () => {
  it('should calculate unchanged edge costs correctly', () => {
    const identifier = createMockNode('identifier', 'x');
    const literal = createMockNode('literal', '42');
    const list = createMockNode('list', '', [identifier, literal]);
    
    expect(calculateEdgeCost('unchanged', identifier)).toBe(COST_MODEL.UNCHANGED_MIN);
    expect(calculateEdgeCost('unchanged', literal)).toBe(COST_MODEL.UNCHANGED_MIN);
    expect(calculateEdgeCost('unchanged', list)).toBe(COST_MODEL.UNCHANGED_MAX);
    expect(calculateEdgeCost('unchanged')).toBe(COST_MODEL.UNCHANGED_MIN);
  });

  it('should calculate novel edge costs correctly', () => {
    expect(calculateEdgeCost('novel-left')).toBe(COST_MODEL.NOVEL_NODE);
    expect(calculateEdgeCost('novel-right')).toBe(COST_MODEL.NOVEL_NODE);
  });

  it('should calculate delimiter costs correctly', () => {
    expect(calculateEdgeCost('delimiter-enter-unchanged')).toBe(COST_MODEL.DELIMITER_ENTER_UNCHANGED);
    expect(calculateEdgeCost('delimiter-enter-novel')).toBe(COST_MODEL.DELIMITER_ENTER_NOVEL);
    expect(calculateEdgeCost('delimiter-exit-unchanged')).toBe(COST_MODEL.DELIMITER_EXIT_UNCHANGED);
    expect(calculateEdgeCost('delimiter-exit-novel')).toBe(COST_MODEL.DELIMITER_EXIT_NOVEL);
  });

  it('should handle unknown edge types', () => {
    expect(calculateEdgeCost('unknown')).toBe(100); // Default cost
  });
});

// ============================================================================
// Priority Queue Tests
// ============================================================================

describe('Priority Queue', () => {
  it('should enqueue and dequeue items in priority order', () => {
    const queue = new PriorityQueue();
    
    const item1 = { distance: 10 };
    const item2 = { distance: 5 };
    const item3 = { distance: 15 };
    
    queue.enqueue(item1);
    queue.enqueue(item2);
    queue.enqueue(item3);
    
    expect(queue.dequeue()).toBe(item2); // Lowest distance first
    expect(queue.dequeue()).toBe(item1);
    expect(queue.dequeue()).toBe(item3);
    expect(queue.isEmpty()).toBe(true);
  });

  it('should handle empty queue correctly', () => {
    const queue = new PriorityQueue();
    expect(queue.isEmpty()).toBe(true);
    expect(queue.dequeue()).toBe(null);
  });

  it('should handle custom comparator', () => {
    const queue = new PriorityQueue((a, b) => b.priority - a.priority);
    
    const item1 = { priority: 10 };
    const item2 = { priority: 20 };
    const item3 = { priority: 5 };
    
    queue.enqueue(item1);
    queue.enqueue(item2);
    queue.enqueue(item3);
    
    expect(queue.dequeue()).toBe(item2); // Highest priority first
  });
});

// ============================================================================
// Graph Building Tests
// ============================================================================

describe('Graph Building', () => {
  let graph;
  
  beforeEach(() => {
    graph = new DiffGraph();
  });

  it('should add vertices within limits', () => {
    const vertex = graph.createVertex(null, null, []);
    expect(vertex).toBeTruthy();
    expect(graph.vertices.size).toBe(1);
  });

  it('should reject vertices beyond limits', () => {
    const smallGraph = new DiffGraph(2, 10);
    
    expect(smallGraph.createVertex(null, null, [])).toBeTruthy();
    expect(smallGraph.createVertex(null, null, [])).toBeTruthy();
    expect(smallGraph.createVertex(null, null, [])).toBeNull(); // Limit exceeded
  });

  it('should add edges within limits', () => {
    const v1 = graph.createVertex(null, null, []);
    const v2 = graph.createVertex(null, null, []);
    const edge = graph.createEdge('unchanged', v1, v2);
    
    expect(edge).toBeTruthy();
    expect(graph.edges.length).toBe(1);
    expect(v1.edges.length).toBe(1);
    expect(v1.edges[0]).toBe(edge);
  });

  it('should track memory usage', () => {
    graph.createVertex(null, null, []);
    graph.createVertex(createMockNode('id', 'test'), null, []);
    graph.createVertex(null, createMockNode('lit', '42'), []);
    
    const stats = graph.getStats();
    expect(stats.vertexCount).toBe(3);
    expect(stats.edgeCount).toBe(0);
    expect(stats.memoryUsage).toBeGreaterThan(0);
  });
});

// ============================================================================
// Dijkstra Algorithm Tests
// ============================================================================

describe('Dijkstra Algorithm', () => {
  it('should find shortest path in simple graph', () => {
    const graph = createTestGraph();
    
    const result = dijkstra(graph);
    
    expect(result).toBeTruthy();
    expect(result).toBe(graph.endVertex);
    
    // Verify path cost is calculated
    expect(result.distance).toBeLessThan(Infinity);
    expect(result.distance).toBeGreaterThan(0);
  });

  it('should handle graph with no start vertex', () => {
    const graph = new DiffGraph();
    
    expect(() => dijkstra(graph)).toThrow('Graph has no start vertex');
  });

  it('should reset vertex states correctly', () => {
    const graph = createTestGraph();
    
    // Run first time
    const result1 = dijkstra(graph);
    expect(result1.distance).toBeGreaterThan(0);
    
    // Modify a vertex distance
    graph.startVertex.distance = 100;
    
    // Run again - should reset to 0
    const result2 = dijkstra(graph);
    expect(result2.distance).toBeGreaterThan(0);
  });
});

// ============================================================================
// Simple Cases (2-3 Nodes)
// ============================================================================

describe('Simple Cases - 2-3 Nodes', () => {
  it('should handle 2-node simple comparison', () => {
    const astA = createMockNode('program', '', [
      createMockNode('identifier', 'x')
    ]);
    const astB = createMockNode('program', '', [
      createMockNode('identifier', 'y')
    ]);
    
    const results = runDijkstraDiff(astA, astB, { maxVertices: 1000, maxEdges: 5000 });
    
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    
    // Should detect change from x to y
    const hasNovelLeft = results.some(r => r.type === 'novel-left');
    const hasNovelRight = results.some(r => r.type === 'novel-right');
    expect(hasNovelLeft || hasNovelRight).toBe(true);
  });

  it('should handle 3-node identical comparison', () => {
    const baseNode = createMockNode('identifier', 'test');
    const astA = createMockNode('program', '', [baseNode]);
    const astB = createMockNode('program', '', [baseNode]);
    
    const results = runDijkstraDiff(astA, astB, { maxVertices: 1000, maxEdges: 5000 });
    
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    
    // Should have unchanged edges
    const hasUnchanged = results.some(r => r.type === 'unchanged');
    expect(hasUnchanged).toBe(true);
  });

  it('should handle empty comparison', () => {
    const astA = createMockNode('program', '', []);
    const astB = createMockNode('program', '', []);
    
    const results = runDijkstraDiff(astA, astB, { maxVertices: 1000, maxEdges: 5000 });
    
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
  });
});

// ============================================================================
// Complex AST Structures
// ============================================================================

describe('Complex AST Structures', () => {
  it('should handle nested structure comparison', () => {
    const { astA, astB } = createTestASTs({ complexity: 'complex' });
    
    const results = runDijkstraDiff(astA, astB, { maxVertices: 10000, maxEdges: 50000 });
    
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    
    // Should detect various change types
    const changeTypes = new Set(results.map(r => r.type));
    expect(changeTypes.size).toBeGreaterThan(0);
  });

  it('should handle deep nesting', () => {
    const deepNode = createMockNode('nested', 'root', [
      createMockNode('nested', 'level1', [
        createMockNode('nested', 'level2', [
          createMockNode('identifier', 'deep')
        ])
      ])
    ]);
    
    const astA = createMockNode('program', '', [deepNode]);
    const astB = createMockNode('program', '', [deepNode]);
    
    const results = runDijkstraDiff(astA, astB, { maxVertices: 10000, maxEdges: 50000 });
    
    expect(results).toBeDefined();
    
    // Should handle deep structure without errors
    const hasUnchanged = results.some(r => r.type === 'unchanged');
    expect(hasUnchanged).toBe(true);
  });

  it('should handle large number of siblings', () => {
    const manyNodes = Array.from({ length: 50 }, (_, i) => 
      createMockNode('identifier', `item${i}`)
    );
    
    const astA = createMockNode('program', '', manyNodes.slice(0, 25));
    const astB = createMockNode('program', '', manyNodes.slice(25));
    
    const results = runDijkstraDiff(astA, astB, { maxVertices: 10000, maxEdges: 50000 });
    
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    
    // Should detect many changes
    expect(results.length).toBeGreaterThan(20);
  });
});

// ============================================================================
// Path Optimization Tests
// ============================================================================

describe('Path Optimization', () => {
  it('should prefer lower cost paths', () => {
    const graph = new DiffGraph();
    
    // Create vertices
    const start = graph.createVertex(null, null, []);
    const middle1 = graph.createVertex(null, null, []);
    const middle2 = graph.createVertex(null, null, []);
    const end = graph.createVertex(null, null, []);
    
    graph.startVertex = start;
    graph.endVertex = end;
    
    // Create two paths: high cost and low cost
    graph.createEdge('novel-left', start, middle1); // High cost (300)
    graph.createEdge('unchanged', middle1, end);    // Low cost (1)
    
    graph.createEdge('unchanged', start, middle2);   // Low cost (1)
    graph.createEdge('unchanged', middle2, end);    // Low cost (1)
    
    const result = dijkstra(graph);
    
    // Should prefer the low-cost path
    expect(result.distance).toBeLessThan(300);
    expect(result.distance).toBe(2); // Two unchanged edges
  });

  it('should handle equal cost paths correctly', () => {
    const graph = new DiffGraph();
    
    const start = graph.createVertex(null, null, []);
    const v1 = graph.createVertex(null, null, []);
    const v2 = graph.createVertex(null, null, []);
    const end = graph.createVertex(null, null, []);
    
    graph.startVertex = start;
    graph.endVertex = end;
    
    // Two paths with equal cost
    graph.createEdge('unchanged', start, v1);
    graph.createEdge('unchanged', v1, end);
    
    graph.createEdge('unchanged', start, v2);
    graph.createEdge('unchanged', v2, end);
    
    const result = dijkstra(graph);
    
    // Should find a valid path
    expect(result.distance).toBe(2);
    expect(result.previous).toBeTruthy();
  });
});

// ============================================================================
// Comparison with Existing Diff
// ============================================================================

describe('Comparison with Existing Diff', () => {
  it('should produce comparable results to diffLines', () => {
    const oldText = 'line 1\nline 2\nline 3';
    const newText = 'line 1\nmodified line 2\nline 3';
    
    // Create simple ASTs from text
    const oldLines = oldText.split('\n').map((line, i) => 
      createMockNode('line', line, { index: i })
    );
    const newLines = newText.split('\n').map((line, i) => 
      createMockNode('line', line, { index: i })
    );
    
    const astA = createMockNode('program', '', oldLines);
    const astB = createMockNode('program', '', newLines);
    
    // Get traditional diff
    const traditionalDiff = diffLines(oldText, newText);
    
    // Get Dijkstra diff
    const dijkstraResults = runDijkstraDiff(astA, astB, { maxVertices: 10000, maxEdges: 50000 });
    
    expect(traditionalDiff).toBeDefined();
    expect(dijkstraResults).toBeDefined();
    expect(dijkstraResults.length).toBeGreaterThan(0);
    
    // Both should detect changes
    const traditionalChanges = traditionalDiff.filter(d => d.added || d.removed);
    const dijkstraChanges = dijkstraResults.filter(r => 
      r.type === 'novel-left' || r.type === 'novel-right'
    );
    
    expect(traditionalChanges.length).toBeGreaterThan(0);
    expect(dijkstraChanges.length).toBeGreaterThan(0);
  });

  it('should handle identical texts', () => {
    const text = 'line 1\nline 2\nline 3';
    const lines = text.split('\n').map((line, i) => 
      createMockNode('line', line, { index: i })
    );
    const astA = createMockNode('program', '', lines);
    const astB = createMockNode('program', '', lines);
    
    const traditionalDiff = diffLines(text, text);
    const dijkstraResults = runDijkstraDiff(astA, astB, { maxVertices: 10000, maxEdges: 50000 });
    
    // Traditional diff should be mostly unchanged
    const traditionalUnchanged = traditionalDiff.filter(d => !d.added && !d.removed);
    expect(traditionalUnchanged.length).toBeGreaterThan(0);
    
    // Dijkstra should find unchanged path
    expect(dijkstraResults.length).toBeGreaterThan(0);
    const dijkstraUnchanged = dijkstraResults.filter(r => r.type === 'unchanged');
    expect(dijkstraUnchanged.length).toBeGreaterThan(0);
  });

  it('should handle completely different texts', () => {
    const oldText = 'old line 1\nold line 2';
    const newText = 'new line 1\nnew line 2';
    
    const oldLines = oldText.split('\n').map((line, i) => 
      createMockNode('line', line, { index: i })
    );
    const newLines = newText.split('\n').map((line, i) => 
      createMockNode('line', line, { index: i })
    );
    
    const astA = createMockNode('program', '', oldLines);
    const astB = createMockNode('program', '', newLines);
    
    const traditionalDiff = diffLines(oldText, newText);
    const dijkstraResults = runDijkstraDiff(astA, astB, { maxVertices: 10000, maxEdges: 50000 });
    
    // Both should detect significant changes
    const traditionalChanges = traditionalDiff.filter(d => d.added || d.removed);
    const dijkstraChanges = dijkstraResults.filter(r => 
      r.type === 'novel-left' || r.type === 'novel-right'
    );
    
    expect(traditionalChanges.length).toBeGreaterThan(0);
    expect(dijkstraChanges.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Performance and Edge Cases
// ============================================================================

describe('Performance and Edge Cases', () => {
  it('should handle large graphs efficiently', () => {
    const startTime = performance.now();
    
    // Create moderately sized ASTs
    const manyNodes = Array.from({ length: 100 }, (_, i) => 
      createMockNode('identifier', `var${i}`)
    );
    
    const astA = createMockNode('program', '', manyNodes);
    const astB = createMockNode('program', '', manyNodes.slice(50));
    
    const results = runDijkstraDiff(astA, astB, { maxVertices: 50000, maxEdges: 200000 });
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(results).toBeDefined();
    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
  });

  it('should handle graph size limits gracefully', () => {
    const smallGraph = new DiffGraph(2, 5); // Very small limits
    
    expect(() => {
      // Try to exceed limits
      smallGraph.createVertex(null, null, []);
      smallGraph.createVertex(null, null, []);
      smallGraph.createVertex(null, null, []); // Should fail
    }).not.toThrow();
    
    // The third vertex should be null
    const vertex = smallGraph.createVertex(null, null, []);
    expect(vertex).toBeNull();
  });

  it('should handle memory usage estimation', () => {
    const graph = new DiffGraph();
    
    for (let i = 0; i < 10; i++) {
      graph.createVertex(null, null, []);
    }
    
    const stats = graph.getStats();
    
    expect(stats.vertexCount).toBe(10);
    expect(stats.edgeCount).toBe(0);
    expect(stats.memoryUsage).toBeGreaterThan(0);
    expect(stats.memoryUsage).toBeLessThan(10000); // Should be reasonable
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Integration Tests', () => {
  it('should complete full pipeline', () => {
    const { astA, astB } = createTestASTs({ complexity: 'simple' });
    
    // Full pipeline
    const graph = buildGraphFromASTs(astA, astB, { maxVertices: 10000, maxEdges: 50000 });
    expect(graph).toBeDefined();
    expect(graph.startVertex).toBeDefined();
    expect(graph.endVertex).toBeDefined();
    
    const endVertex = dijkstra(graph);
    expect(endVertex).toBeDefined();
    
    // Convert path to diff results manually for testing
    const diffResults = [];
    let current = endVertex;
    while (current && current.previous) {
      const edge = current.previous.edges.find(e => e.to === current);
      if (edge) {
        diffResults.unshift({
          type: edge.type,
          lhsNode: edge.from.lhsNode,
          rhsNode: edge.to.rhsNode,
          cost: edge.cost,
          metadata: edge.metadata
        });
      }
      current = current.previous;
    }
    
    expect(diffResults).toBeDefined();
    expect(Array.isArray(diffResults)).toBe(true);
  });

  it('should maintain graph invariants', () => {
    const graph = createTestGraph();
    
    // All vertices should have valid IDs
    const ids = Array.from(graph.vertices.keys());
    expect(ids.length).toBeGreaterThan(0);
    
    // IDs should be valid (not null/undefined)
    ids.forEach(id => {
      expect(id).toBeDefined();
      expect(id !== null).toBe(true);
    });
    
    // All edges should connect existing vertices
    for (const edge of graph.edges) {
      expect(graph.vertices.has(edge.from.id)).toBe(true);
      expect(graph.vertices.has(edge.to.id)).toBe(true);
    }
  });

  it('should handle invalid inputs gracefully', () => {
    expect(() => {
      runDijkstraDiff(null, null);
    }).not.toThrow();
    
    expect(() => {
      runDijkstraDiff(createMockNode('test', ''), null);
    }).not.toThrow();
  });
});