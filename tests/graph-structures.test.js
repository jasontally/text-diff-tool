/**
 * Graph Data Structures Unit Tests
 * 
 * Tests for graph-based diff algorithm data structures.
 * Tests vertex creation, edge connections, graph building, and size limits.
 * 
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  GraphVertex,
  GraphEdge,
  DiffGraph,
  NodeMapper,
  COST_MODEL,
  calculateEdgeCost
} from '../src/graph-diff.js';

// ============================================================================
// Mock AST Nodes for Testing
// ============================================================================

function createMockASTNode(type, text = '', children = null) {
  return {
    type,
    text,
    children,
    startPosition: 0,
    endPosition: text.length
  };
}

// ============================================================================
// GraphVertex Tests
// ============================================================================

describe('GraphVertex', () => {
  it('should create a vertex with null nodes', () => {
    const vertex = new GraphVertex(null, null, 0, []);
    
    expect(vertex.lhsNode).toBeNull();
    expect(vertex.rhsNode).toBeNull();
    expect(vertex.id).toBe(0);
    expect(vertex.parentStack).toEqual([]);
    expect(vertex.edges).toEqual([]);
    expect(vertex.distance).toBe(Infinity);
    expect(vertex.visited).toBe(false);
    expect(vertex.previous).toBeNull();
  });

  it('should create a vertex with AST nodes', () => {
    const lhsNode = createMockASTNode('identifier', 'foo');
    const rhsNode = createMockASTNode('identifier', 'bar');
    const parentStack = ['{', '}'];
    
    const vertex = new GraphVertex(lhsNode, rhsNode, 1, parentStack);
    
    expect(vertex.lhsNode).toBe(lhsNode);
    expect(vertex.rhsNode).toBe(rhsNode);
    expect(vertex.id).toBe(1);
    expect(vertex.parentStack).toEqual(parentStack);
  });

  it('should correctly identify end vertex', () => {
    const endVertex = new GraphVertex(null, null, 0, []);
    expect(endVertex.isEnd(10, 10)).toBe(true);
    
    const nonEndVertex1 = new GraphVertex(createMockASTNode('identifier'), null, 1, []);
    expect(nonEndVertex1.isEnd(10, 10)).toBe(false);
    
    const nonEndVertex2 = new GraphVertex(null, createMockASTNode('identifier'), 2, []);
    expect(nonEndVertex2.isEnd(10, 10)).toBe(false);
    
    const nonEndVertex3 = new GraphVertex(null, null, 3, ['{']);
    expect(nonEndVertex3.isEnd(10, 10)).toBe(false);
  });

  it('should provide meaningful string representation', () => {
    const lhsNode = createMockASTNode('identifier', 'foo');
    const rhsNode = createMockASTNode('literal', '42');
    const vertex = new GraphVertex(lhsNode, rhsNode, 5, ['{', '}']);
    
    const str = vertex.toString();
    expect(str).toContain('Vertex(5)');
    expect(str).toContain('lhs=identifier');
    expect(str).toContain('rhs=literal');
    expect(str).toContain('stack=2');
  });

  it('should handle null nodes in string representation', () => {
    const vertex = new GraphVertex(null, null, 0, []);
    const str = vertex.toString();
    expect(str).toContain('lhs=null');
    expect(str).toContain('rhs=null');
  });
});

// ============================================================================
// GraphEdge Tests
// ============================================================================

describe('GraphEdge', () => {
  let fromVertex, toVertex;
  
  beforeEach(() => {
    fromVertex = new GraphVertex(null, null, 0, []);
    toVertex = new GraphVertex(null, null, 1, []);
  });

  it('should create an edge with required properties', () => {
    const edge = new GraphEdge('unchanged', 5, fromVertex, toVertex, { test: true });
    
    expect(edge.type).toBe('unchanged');
    expect(edge.cost).toBe(5);
    expect(edge.from).toBe(fromVertex);
    expect(edge.to).toBe(toVertex);
    expect(edge.metadata).toEqual({ test: true });
  });

  it('should create an edge without metadata', () => {
    const edge = new GraphEdge('novel-left', 300, fromVertex, toVertex);
    
    expect(edge.metadata).toEqual({});
  });

  it('should provide meaningful string representation', () => {
    const edge = new GraphEdge('unchanged', 10, fromVertex, toVertex);
    const str = edge.toString();
    
    expect(str).toContain('Edge(unchanged)');
    expect(str).toContain('cost=10');
    expect(str).toContain('0→1');
  });
});

// ============================================================================
// Edge Cost Calculation Tests
// ============================================================================

describe('Edge Cost Calculation', () => {
  it('should calculate unchanged cost for identifier nodes', () => {
    const node = createMockASTNode('identifier', 'foo');
    const cost = calculateEdgeCost('unchanged', node);
    expect(cost).toBe(COST_MODEL.UNCHANGED_MIN);
  });

  it('should calculate unchanged cost for literal nodes', () => {
    const node = createMockASTNode('literal', '42');
    const cost = calculateEdgeCost('unchanged', node);
    expect(cost).toBe(COST_MODEL.UNCHANGED_MIN);
  });

  it('should calculate unchanged cost for list/complex nodes', () => {
    const node = createMockASTNode('list', '', [createMockASTNode('identifier', 'x')]);
    const cost = calculateEdgeCost('unchanged', node);
    expect(cost).toBe(COST_MODEL.UNCHANGED_MAX);
  });

  it('should calculate unchanged cost for nodes with children', () => {
    const node = createMockASTNode('function', '', [createMockASTNode('identifier', 'x')]);
    const cost = calculateEdgeCost('unchanged', node);
    expect(cost).toBe(COST_MODEL.UNCHANGED_MAX);
  });

  it('should calculate unchanged cost for other node types', () => {
    const node = createMockASTNode('operator', '+');
    const cost = calculateEdgeCost('unchanged', node);
    expect(cost).toBe(COST_MODEL.UNCHANGED_MIN + 10);
  });

  it('should calculate unchanged cost without node', () => {
    const cost = calculateEdgeCost('unchanged');
    expect(cost).toBe(COST_MODEL.UNCHANGED_MIN);
  });

  it('should calculate novel node costs', () => {
    const leftCost = calculateEdgeCost('novel-left');
    const rightCost = calculateEdgeCost('novel-right');
    
    expect(leftCost).toBe(COST_MODEL.NOVEL_NODE);
    expect(rightCost).toBe(COST_MODEL.NOVEL_NODE);
  });

  it('should calculate delimiter costs', () => {
    expect(calculateEdgeCost('delimiter-enter-unchanged')).toBe(COST_MODEL.DELIMITER_ENTER_UNCHANGED);
    expect(calculateEdgeCost('delimiter-enter-novel')).toBe(COST_MODEL.DELIMITER_ENTER_NOVEL);
    expect(calculateEdgeCost('delimiter-exit-unchanged')).toBe(COST_MODEL.DELIMITER_EXIT_UNCHANGED);
    expect(calculateEdgeCost('delimiter-exit-novel')).toBe(COST_MODEL.DELIMITER_EXIT_NOVEL);
  });

  it('should return default cost for unknown edge types', () => {
    const cost = calculateEdgeCost('unknown-type');
    expect(cost).toBe(100);
  });
});

// ============================================================================
// DiffGraph Tests
// ============================================================================

describe('DiffGraph', () => {
  let graph;
  
  beforeEach(() => {
    graph = new DiffGraph();
  });

  it('should create graph with default limits', () => {
    expect(graph.maxVertices).toBe(100000);
    expect(graph.maxEdges).toBe(500000);
    expect(graph.vertices.size).toBe(0);
    expect(graph.edges.length).toBe(0);
    expect(graph.nextVertexId).toBe(0);
  });

  it('should create graph with custom limits', () => {
    const customGraph = new DiffGraph(1000, 5000);
    expect(customGraph.maxVertices).toBe(1000);
    expect(customGraph.maxEdges).toBe(5000);
  });

  it('should add vertices successfully', () => {
    const vertex = new GraphVertex(null, null, 0, []);
    const result = graph.addVertex(vertex);
    
    expect(result).toBe(true);
    expect(graph.vertices.size).toBe(1);
    expect(graph.getVertex(0)).toBe(vertex);
    expect(graph.nextVertexId).toBe(1);
  });

  it('should reject vertices when limit exceeded', () => {
    const smallGraph = new DiffGraph(2, 100);
    
    const vertex1 = new GraphVertex(null, null, 0, []);
    const vertex2 = new GraphVertex(null, null, 1, []);
    const vertex3 = new GraphVertex(null, null, 2, []);
    
    expect(smallGraph.addVertex(vertex1)).toBe(true);
    expect(smallGraph.addVertex(vertex2)).toBe(true);
    expect(smallGraph.addVertex(vertex3)).toBe(false); // Limit exceeded
    
    expect(smallGraph.vertices.size).toBe(2);
  });

  it('should add edges successfully', () => {
    const fromVertex = new GraphVertex(null, null, 0, []);
    const toVertex = new GraphVertex(null, null, 1, []);
    const edge = new GraphEdge('unchanged', 5, fromVertex, toVertex);
    
    graph.addVertex(fromVertex);
    graph.addVertex(toVertex);
    
    const result = graph.addEdge(edge);
    
    expect(result).toBe(true);
    expect(graph.edges.length).toBe(1);
    expect(fromVertex.edges).toContain(edge);
  });

  it('should reject edges when limit exceeded', () => {
    const smallGraph = new DiffGraph(100, 2);
    
    const fromVertex1 = new GraphVertex(null, null, 0, []);
    const toVertex1 = new GraphVertex(null, null, 1, []);
    const edge1 = new GraphEdge('unchanged', 5, fromVertex1, toVertex1);
    
    const fromVertex2 = new GraphVertex(null, null, 2, []);
    const toVertex2 = new GraphVertex(null, null, 3, []);
    const edge2 = new GraphEdge('novel-left', 300, fromVertex2, toVertex2);
    
    const fromVertex3 = new GraphVertex(null, null, 4, []);
    const toVertex3 = new GraphVertex(null, null, 5, []);
    const edge3 = new GraphEdge('novel-right', 300, fromVertex3, toVertex3);
    
    smallGraph.addVertex(fromVertex1);
    smallGraph.addVertex(toVertex1);
    smallGraph.addVertex(fromVertex2);
    smallGraph.addVertex(toVertex2);
    smallGraph.addVertex(fromVertex3);
    smallGraph.addVertex(toVertex3);
    
    expect(smallGraph.addEdge(edge1)).toBe(true);
    expect(smallGraph.addEdge(edge2)).toBe(true);
    expect(smallGraph.addEdge(edge3)).toBe(false); // Limit exceeded
    
    expect(smallGraph.edges.length).toBe(2);
  });

  it('should create vertices with auto-incrementing IDs', () => {
    const vertex1 = graph.createVertex(null, null, []);
    const vertex2 = graph.createVertex(null, null, []);
    const vertex3 = graph.createVertex(null, null, []);
    
    expect(vertex1.id).toBe(0);
    expect(vertex2.id).toBe(1);
    expect(vertex3.id).toBe(2);
    expect(graph.vertices.size).toBe(3);
  });

  it('should return null when vertex creation fails due to limit', () => {
    const smallGraph = new DiffGraph(2, 100);
    
    const vertex1 = smallGraph.createVertex(null, null, []);
    const vertex2 = smallGraph.createVertex(null, null, []);
    const vertex3 = smallGraph.createVertex(null, null, []);
    
    expect(vertex1).not.toBeNull();
    expect(vertex2).not.toBeNull();
    expect(vertex3).toBeNull(); // Limit exceeded
  });

  it('should create edges with calculated costs', () => {
    const fromVertex = graph.createVertex(null, null, []);
    const toVertex = graph.createVertex(null, null, []);
    const node = createMockASTNode('identifier', 'foo');
    
    const edge = graph.createEdge('unchanged', fromVertex, toVertex, node);
    
    expect(edge).not.toBeNull();
    expect(edge.type).toBe('unchanged');
    expect(edge.cost).toBe(COST_MODEL.UNCHANGED_MIN);
    expect(edge.from).toBe(fromVertex);
    expect(edge.to).toBe(toVertex);
    expect(graph.edges.length).toBe(1);
  });

  it('should return null when edge creation fails due to limit', () => {
    const smallGraph = new DiffGraph(100, 2);
    
    const fromVertex1 = smallGraph.createVertex(null, null, []);
    const toVertex1 = smallGraph.createVertex(null, null, []);
    const edge1 = smallGraph.createEdge('unchanged', fromVertex1, toVertex1);
    
    const fromVertex2 = smallGraph.createVertex(null, null, []);
    const toVertex2 = smallGraph.createVertex(null, null, []);
    const edge2 = smallGraph.createEdge('novel-left', fromVertex2, toVertex2);
    
    const fromVertex3 = smallGraph.createVertex(null, null, []);
    const toVertex3 = smallGraph.createVertex(null, null, []);
    const edge3 = smallGraph.createEdge('novel-right', fromVertex3, toVertex3);
    
    expect(edge1).not.toBeNull();
    expect(edge2).not.toBeNull();
    expect(edge3).toBeNull(); // Limit exceeded
  });

  it('should check if graph is too large', () => {
    const smallGraph = new DiffGraph(2, 2);
    
    expect(smallGraph.isTooLarge()).toBe(false);
    
    // Add vertices up to limit
    smallGraph.createVertex(null, null, []);
    smallGraph.createVertex(null, null, []);
    expect(smallGraph.isTooLarge()).toBe(true); // Vertex limit reached
    
    // Test edge limit
    const largeGraph = new DiffGraph(100, 2);
    largeGraph.createVertex(null, null, []);
    largeGraph.createVertex(null, null, []);
    largeGraph.createVertex(null, null, []);
    largeGraph.createVertex(null, null, []);
    
    expect(largeGraph.isTooLarge()).toBe(false);
    
    largeGraph.createEdge('unchanged', largeGraph.getVertex(0), largeGraph.getVertex(1));
    largeGraph.createEdge('novel-left', largeGraph.getVertex(2), largeGraph.getVertex(3));
    
    expect(largeGraph.isTooLarge()).toBe(true); // Edge limit reached
  });

  it('should provide graph statistics', () => {
    graph.createVertex(null, null, []);
    graph.createVertex(null, null, []);
    graph.createVertex(null, null, []);
    
    const fromVertex = graph.getVertex(0);
    const toVertex = graph.getVertex(1);
    graph.createEdge('unchanged', fromVertex, toVertex);
    graph.createEdge('novel-left', fromVertex, toVertex);
    
    const stats = graph.getStats();
    
    expect(stats.vertexCount).toBe(3);
    expect(stats.edgeCount).toBe(2);
    expect(stats.maxVertices).toBe(100000);
    expect(stats.maxEdges).toBe(500000);
    expect(stats.memoryUsage).toBeGreaterThan(0);
  });

  it('should estimate memory usage correctly', () => {
    // Create some vertices and edges
    for (let i = 0; i < 10; i++) {
      graph.createVertex(null, null, []);
    }
    
    const fromVertex = graph.getVertex(0);
    const toVertex = graph.getVertex(1);
    for (let i = 0; i < 5; i++) {
      graph.createEdge('unchanged', fromVertex, toVertex);
    }
    
    const memoryUsage = graph.estimateMemoryUsage();
    expect(memoryUsage).toBe(10 * 200 + 5 * 150); // 10 vertices * 200 bytes + 5 edges * 150 bytes
  });

  it('should clear graph completely', () => {
    graph.createVertex(null, null, []);
    graph.createVertex(null, null, []);
    
    const fromVertex = graph.getVertex(0);
    const toVertex = graph.getVertex(1);
    graph.createEdge('unchanged', fromVertex, toVertex);
    
    graph.startVertex = fromVertex;
    graph.endVertex = toVertex;
    
    graph.clear();
    
    expect(graph.vertices.size).toBe(0);
    expect(graph.edges.length).toBe(0);
    expect(graph.startVertex).toBeNull();
    expect(graph.endVertex).toBeNull();
    expect(graph.nextVertexId).toBe(0);
  });

  it('should provide meaningful string representation', () => {
    graph.createVertex(null, null, []);
    graph.createVertex(null, null, []);
    
    const fromVertex = graph.getVertex(0);
    const toVertex = graph.getVertex(1);
    graph.createEdge('unchanged', fromVertex, toVertex);
    
    const str = graph.toString();
    expect(str).toContain('DiffGraph:');
    expect(str).toContain('2 vertices');
    expect(str).toContain('1 edges');
  });
});

// ============================================================================
// NodeMapper Tests
// ============================================================================

describe('NodeMapper', () => {
  let mapper;
  
  beforeEach(() => {
    mapper = new NodeMapper();
  });

  it('should create empty mapper', () => {
    expect(mapper.lhsToVertex.size).toBe(0);
    expect(mapper.rhsToVertex.size).toBe(0);
  });

  it('should map LHS nodes to vertices', () => {
    const node1 = createMockASTNode('identifier', 'foo');
    const node2 = createMockASTNode('identifier', 'bar');
    
    mapper.mapNode(node1, 'lhs', 1);
    mapper.mapNode(node1, 'lhs', 2); // Same node, different vertex
    mapper.mapNode(node2, 'lhs', 3);
    
    const vertices1 = mapper.getVerticesForNode(node1, 'lhs');
    const vertices2 = mapper.getVerticesForNode(node2, 'lhs');
    
    expect(vertices1).toEqual(new Set([1, 2]));
    expect(vertices2).toEqual(new Set([3]));
  });

  it('should map RHS nodes to vertices', () => {
    const node = createMockASTNode('literal', '42');
    
    mapper.mapNode(node, 'rhs', 10);
    mapper.mapNode(node, 'rhs', 20);
    
    const vertices = mapper.getVerticesForNode(node, 'rhs');
    expect(vertices).toEqual(new Set([10, 20]));
  });

  it('should handle null nodes gracefully', () => {
    mapper.mapNode(null, 'lhs', 1);
    mapper.mapNode(null, 'rhs', 2);
    
    const lhsVertices = mapper.getVerticesForNode(null, 'lhs');
    const rhsVertices = mapper.getVerticesForNode(null, 'rhs');
    
    expect(lhsVertices).toEqual(new Set());
    expect(rhsVertices).toEqual(new Set());
  });

  it('should return empty set for unmapped nodes', () => {
    const node = createMockASTNode('identifier', 'foo');
    
    const lhsVertices = mapper.getVerticesForNode(node, 'lhs');
    const rhsVertices = mapper.getVerticesForNode(node, 'rhs');
    
    expect(lhsVertices).toEqual(new Set());
    expect(rhsVertices).toEqual(new Set());
  });

  it('should clear all mappings', () => {
    const node1 = createMockASTNode('identifier', 'foo');
    const node2 = createMockASTNode('literal', '42');
    
    mapper.mapNode(node1, 'lhs', 1);
    mapper.mapNode(node2, 'rhs', 2);
    
    expect(mapper.lhsToVertex.size).toBe(1);
    expect(mapper.rhsToVertex.size).toBe(1);
    
    mapper.clear();
    
    expect(mapper.lhsToVertex.size).toBe(0);
    expect(mapper.rhsToVertex.size).toBe(0);
  });

  it('should handle multiple mappings for the same node', () => {
    const node = createMockASTNode('identifier', 'foo');
    
    // Map the same node to many vertices
    for (let i = 0; i < 5; i++) {
      mapper.mapNode(node, 'lhs', i);
    }
    
    const vertices = mapper.getVerticesForNode(node, 'lhs');
    expect(vertices).toEqual(new Set([0, 1, 2, 3, 4]));
    expect(vertices.size).toBe(5);
  });

  it('should handle different sides independently', () => {
    const lhsNode = createMockASTNode('identifier', 'foo');
    const rhsNode = createMockASTNode('identifier', 'foo'); // Same type/text, different instance
    
    mapper.mapNode(lhsNode, 'lhs', 1);
    mapper.mapNode(rhsNode, 'rhs', 2);
    
    const lhsVertices = mapper.getVerticesForNode(lhsNode, 'lhs');
    const rhsVertices = mapper.getVerticesForNode(rhsNode, 'rhs');
    
    expect(lhsVertices).toEqual(new Set([1]));
    expect(rhsVertices).toEqual(new Set([2]));
    
    // Cross-side lookups should be empty
    expect(mapper.getVerticesForNode(lhsNode, 'rhs')).toEqual(new Set());
    expect(mapper.getVerticesForNode(rhsNode, 'lhs')).toEqual(new Set());
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Graph Integration Tests', () => {
  it('should build a complete diff graph', () => {
    const graph = new DiffGraph(10, 20);
    
    // Create vertices
    const startVertex = graph.createVertex(null, null, []);
    const vertex1 = graph.createVertex(createMockASTNode('identifier', 'foo'), null, []);
    const vertex2 = graph.createVertex(null, createMockASTNode('identifier', 'bar'), []);
    const endVertex = graph.createVertex(null, null, []);
    
    // Create edges
    graph.createEdge('unchanged', startVertex, vertex1, vertex1.lhsNode);
    graph.createEdge('novel-right', vertex1, vertex2);
    graph.createEdge('novel-left', vertex2, endVertex);
    
    // Verify structure
    expect(graph.vertices.size).toBe(4);
    expect(graph.edges.length).toBe(3);
    expect(startVertex.edges.length).toBe(1);
    expect(vertex1.edges.length).toBe(1);
    expect(vertex2.edges.length).toBe(1);
    expect(endVertex.edges.length).toBe(0);
  });

  it('should handle size limits gracefully', () => {
    const graph = new DiffGraph(3, 3); // Small limits for testing
    
    // Add vertices up to limit
    const v1 = graph.createVertex(null, null, []);
    const v2 = graph.createVertex(null, null, []);
    const v3 = graph.createVertex(null, null, []);
    const v4 = graph.createVertex(null, null, []); // Should fail
    
    expect(v1).not.toBeNull();
    expect(v2).not.toBeNull();
    expect(v3).not.toBeNull();
    expect(v4).toBeNull();
    
    // Add edges up to limit (3 edges max)
    const e1 = graph.createEdge('unchanged', v1, v2);
    const e2 = graph.createEdge('novel-left', v2, v3);
    const e3 = graph.createEdge('novel-right', v1, v3);
    const e4 = graph.createEdge('unchanged', v1, v3); // Should fail
    
    expect(e1).not.toBeNull();
    expect(e2).not.toBeNull();
    expect(e3).not.toBeNull();
    expect(e4).toBeNull();
    
    expect(graph.isTooLarge()).toBe(true);
  });

  it('should integrate node mapping with graph building', () => {
    const graph = new DiffGraph();
    const mapper = new NodeMapper();
    
    const lhsNode = createMockASTNode('identifier', 'foo');
    const rhsNode = createMockASTNode('identifier', 'bar');
    
    // Create vertices that use the nodes
    const vertex1 = graph.createVertex(lhsNode, null, []);
    const vertex2 = graph.createVertex(lhsNode, rhsNode, []);
    const vertex3 = graph.createVertex(null, rhsNode, []);
    
    // Map nodes to vertices
    mapper.mapNode(lhsNode, 'lhs', vertex1.id);
    mapper.mapNode(lhsNode, 'lhs', vertex2.id);
    mapper.mapNode(rhsNode, 'rhs', vertex2.id);
    mapper.mapNode(rhsNode, 'rhs', vertex3.id);
    
    // Verify mappings
    const lhsVertices = mapper.getVerticesForNode(lhsNode, 'lhs');
    const rhsVertices = mapper.getVerticesForNode(rhsNode, 'rhs');
    
    expect(lhsVertices).toEqual(new Set([vertex1.id, vertex2.id]));
    expect(rhsVertices).toEqual(new Set([vertex2.id, vertex3.id]));
    
    // Verify vertices exist in graph
    expect(graph.getVertex(vertex1.id)).toBe(vertex1);
    expect(graph.getVertex(vertex2.id)).toBe(vertex2);
    expect(graph.getVertex(vertex3.id)).toBe(vertex3);
  });
});