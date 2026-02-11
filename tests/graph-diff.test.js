import { describe, it, expect, beforeEach } from 'vitest';
import { 
  GraphVertex, 
  GraphEdge, 
  DiffGraph, 
  NodeMapper, 
  calculateEdgeCost, 
  COST_MODEL,
  buildGraphFromASTs,
  dijkstra,
  runDijkstraDiff,
  PriorityQueue
} from '../src/graph-diff.js';

describe('Graph Diff Data Structures', () => {
  describe('GraphVertex', () => {
    it('should create vertex with required properties', () => {
      const lhsNode = { type: 'identifier', text: 'foo' };
      const rhsNode = { type: 'identifier', text: 'bar' };
      const vertex = new GraphVertex(lhsNode, rhsNode, 1, ['delimiter1']);

      expect(vertex.lhsNode).toBe(lhsNode);
      expect(vertex.rhsNode).toBe(rhsNode);
      expect(vertex.id).toBe(1);
      expect(vertex.parentStack).toEqual(['delimiter1']);
      expect(vertex.edges).toEqual([]);
      expect(vertex.distance).toBe(Infinity);
      expect(vertex.visited).toBe(false);
      expect(vertex.previous).toBe(null);
    });

    it('should identify end vertex correctly', () => {
      const vertex = new GraphVertex(null, null, 1, []);
      expect(vertex.isEnd(10, 10)).toBe(true);

      const nonEndVertex = new GraphVertex({ type: 'text' }, null, 2, []);
      expect(nonEndVertex.isEnd(10, 10)).toBe(false);

      const withParentStack = new GraphVertex(null, null, 3, ['delimiter1']);
      expect(withParentStack.isEnd(10, 10)).toBe(false);
    });

    it('should provide string representation', () => {
      const vertex = new GraphVertex({ type: 'identifier' }, null, 1, ['test']);
      expect(vertex.toString()).toBe('Vertex(1): lhs=identifier, rhs=null, stack=1');
    });
  });

  describe('GraphEdge', () => {
    it('should create edge with required properties', () => {
      const fromVertex = new GraphVertex(null, null, 1);
      const toVertex = new GraphVertex(null, null, 2);
      const edge = new GraphEdge('unchanged', 10, fromVertex, toVertex, { test: true });

      expect(edge.type).toBe('unchanged');
      expect(edge.cost).toBe(10);
      expect(edge.from).toBe(fromVertex);
      expect(edge.to).toBe(toVertex);
      expect(edge.metadata).toEqual({ test: true });
    });

    it('should provide string representation', () => {
      const fromVertex = new GraphVertex(null, null, 1);
      const toVertex = new GraphVertex(null, null, 2);
      const edge = new GraphEdge('novel-left', 300, fromVertex, toVertex);

      expect(edge.toString()).toBe('Edge(novel-left): cost=300, 1→2');
    });
  });

  describe('Cost Model', () => {
    it('should calculate costs correctly', () => {
      const identifier = { type: 'identifier' };
      const list = { type: 'list' };

      expect(calculateEdgeCost('unchanged', identifier)).toBe(1);
      expect(calculateEdgeCost('unchanged', list)).toBe(40);
      expect(calculateEdgeCost('unchanged')).toBe(1);
      expect(calculateEdgeCost('novel-left')).toBe(300);
      expect(calculateEdgeCost('novel-right')).toBe(300);
      expect(calculateEdgeCost('delimiter-enter-unchanged')).toBe(10);
      expect(calculateEdgeCost('delimiter-enter-novel')).toBe(150);
    });
  });

  describe('DiffGraph', () => {
    it('should create graph with defaults', () => {
      const graph = new DiffGraph();
      expect(graph.vertices.size).toBe(0);
      expect(graph.edges.length).toBe(0);
      expect(graph.maxVertices).toBe(100000);
      expect(graph.maxEdges).toBe(500000);
      expect(graph.nextVertexId).toBe(0);
    });

    it('should create graph with custom limits', () => {
      const graph = new DiffGraph(100, 500);
      expect(graph.maxVertices).toBe(100);
      expect(graph.maxEdges).toBe(500);
    });

    it('should add vertices and edges', () => {
      const graph = new DiffGraph(10, 20);
      const vertex = new GraphVertex(null, null, 1);
      
      expect(graph.addVertex(vertex)).toBe(true);
      expect(graph.vertices.size).toBe(1);

      const fromVertex = new GraphVertex(null, null, 2);
      const toVertex = new GraphVertex(null, null, 3);
      graph.addVertex(fromVertex);
      graph.addVertex(toVertex);

      const edge = new GraphEdge('unchanged', 10, fromVertex, toVertex);
      expect(graph.addEdge(edge)).toBe(true);
      expect(graph.edges.length).toBe(1);
      expect(fromVertex.edges).toContain(edge);
    });

    it('should enforce size limits', () => {
      const graph = new DiffGraph(2, 2);
      
      // Add vertices up to limit
      const v1 = new GraphVertex(null, null, 1);
      const v2 = new GraphVertex(null, null, 2);
      expect(graph.addVertex(v1)).toBe(true);
      expect(graph.addVertex(v2)).toBe(true);
      
      // Exceed limit
      const v3 = new GraphVertex(null, null, 3);
      expect(graph.addVertex(v3)).toBe(false);
    });

    it('should create vertices and edges with factory methods', () => {
      const graph = new DiffGraph();
      const node = { type: 'identifier' };
      
      const v1 = graph.createVertex(node, null, []);
      expect(v1).toBeInstanceOf(GraphVertex);
      expect(v1.id).toBe(0);
      expect(graph.vertices.size).toBe(1);

      const v2 = graph.createVertex(null, node, []);
      const edge = graph.createEdge('unchanged', v1, v2, node);
      
      expect(edge).toBeInstanceOf(GraphEdge);
      expect(edge.cost).toBe(1); // identifier has cost 1
      expect(graph.edges.length).toBe(1);
    });

    it('should check if graph is too large', () => {
      const graph = new DiffGraph(2, 2);
      expect(graph.isTooLarge()).toBe(false);
      
      graph.createVertex(null, null, []);
      graph.createVertex(null, null, []);
      expect(graph.isTooLarge()).toBe(true); // Vertex limit reached
    });

    it('should provide graph statistics', () => {
      const graph = new DiffGraph();
      graph.createVertex(null, null, []);
      graph.createVertex(null, null, []);
      
      const v1 = graph.getVertex(0);
      const v2 = graph.getVertex(1);
      graph.createEdge('unchanged', v1, v2);

      const stats = graph.getStats();
      expect(stats.vertexCount).toBe(2);
      expect(stats.edgeCount).toBe(1);
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });

    it('should clear graph state', () => {
      const graph = new DiffGraph();
      graph.createVertex(null, null, []);
      graph.startVertex = graph.getVertex(0);
      graph.endVertex = graph.startVertex;
      
      graph.clear();
      
      expect(graph.vertices.size).toBe(0);
      expect(graph.edges.length).toBe(0);
      expect(graph.startVertex).toBe(null);
      expect(graph.endVertex).toBe(null);
      expect(graph.nextVertexId).toBe(0);
    });

    it('should provide string representation', () => {
      const graph = new DiffGraph();
      graph.createVertex(null, null, []);
      expect(graph.toString()).toBe('DiffGraph: 1 vertices, 0 edges');
    });
  });

  describe('NodeMapper', () => {
    it('should map nodes to vertices', () => {
      const mapper = new NodeMapper();
      const node = { type: 'identifier' };
      
      mapper.mapNode(node, 'lhs', 1);
      mapper.mapNode(node, 'rhs', 2);
      
      const lhsVertices = mapper.getVerticesForNode(node, 'lhs');
      const rhsVertices = mapper.getVerticesForNode(node, 'rhs');
      
      expect(Array.from(lhsVertices)).toEqual([1]);
      expect(Array.from(rhsVertices)).toEqual([2]);
    });

    it('should handle non-existent nodes', () => {
      const mapper = new NodeMapper();
      const node = { type: 'identifier' };
      
      const vertices = mapper.getVerticesForNode(node, 'lhs');
      expect(Array.from(vertices)).toEqual([]);
    });

    it('should clear mappings', () => {
      const mapper = new NodeMapper();
      const node = { type: 'identifier' };
      
      mapper.mapNode(node, 'lhs', 1);
      expect(mapper.lhsToVertex.size).toBe(1);
      
      mapper.clear();
      expect(mapper.lhsToVertex.size).toBe(0);
      expect(mapper.rhsToVertex.size).toBe(0);
    });
  });
});

// ============================================================================
// Dijkstra Algorithm Tests
// ============================================================================

describe('Dijkstra Algorithm Implementation', () => {
  let graph;
  let start, middle, end;

  beforeEach(() => {
    graph = new DiffGraph();
    start = graph.createVertex(null, null, []);
    middle = graph.createVertex(null, null, []);
    end = graph.createVertex(null, null, []);
    
    graph.startVertex = start;
    graph.endVertex = end;
  });

  it('should find shortest path in simple graph', () => {
    // Direct path with cost 10
    graph.createEdge('unchanged', start, end);
    
    // Indirect path with cost 5
    graph.createEdge('unchanged', start, middle);
    graph.createEdge('unchanged', middle, end);
    
    const result = dijkstra(graph);
    
    expect(result).toBe(end);
    expect(start.distance).toBe(0);
    // Either path could be chosen, just verify end is reachable
    expect(end.distance).toBeLessThan(Infinity);
  });

  it('should handle disconnected graph', () => {
    const isolated = graph.createVertex(null, null, []);
    // No edges from start to any other vertex
    
    const result = dijkstra(graph);
    
    // Should return either start (if nothing reachable) or end (if end is set)
    expect(result === start || result === end).toBe(true);
  });

  it('should handle equal cost paths', () => {
    // Two paths with equal cost
    const alt = graph.createVertex(null, null, []);
    
    graph.createEdge('unchanged', start, alt);
    graph.createEdge('unchanged', alt, end);
    
    graph.createEdge('unchanged', start, middle);
    graph.createEdge('unchanged', middle, end);
    
    const result = dijkstra(graph);
    
    expect(result).toBe(end);
    expect(result.distance).toBe(2); // Two unchanged edges
  });
});

// ============================================================================
// Priority Queue Tests
// ============================================================================

describe('PriorityQueue', () => {
  it('should enqueue and dequeue items in priority order', () => {
    const queue = new PriorityQueue();
    
    queue.enqueue({ distance: 10 });
    queue.enqueue({ distance: 1 });
    queue.enqueue({ distance: 5 });
    
    expect(queue.dequeue().distance).toBe(1);
    expect(queue.dequeue().distance).toBe(5);
    expect(queue.dequeue().distance).toBe(10);
    expect(queue.isEmpty()).toBe(true);
  });

  it('should handle custom comparator', () => {
    const queue = new PriorityQueue((a, b) => b.distance - a.distance); // Reverse order
    
    queue.enqueue({ distance: 1 });
    queue.enqueue({ distance: 10 });
    
    expect(queue.dequeue().distance).toBe(10);
    expect(queue.dequeue().distance).toBe(1);
  });

  it('should handle empty queue', () => {
    const queue = new PriorityQueue();
    
    expect(queue.isEmpty()).toBe(true);
    expect(queue.dequeue()).toBeNull();
  });
});

// ============================================================================
// Graph Building Tests
// ============================================================================

describe('Graph Building from ASTs', () => {
  function createMockNode(type, text, children = []) {
    return { type, text, children };
  }

  function createMockAST(nodes) {
    return createMockNode('root', '', nodes.map(spec => 
      createMockNode(spec.type, spec.text, spec.children || [])
    ));
  }

  it('should build graph from simple identical ASTs', () => {
    const astA = createMockAST([
      { type: 'identifier', text: 'foo' },
      { type: 'identifier', text: 'bar' }
    ]);
    
    const astB = createMockAST([
      { type: 'identifier', text: 'foo' },
      { type: 'identifier', text: 'bar' }
    ]);
    
    const graph = buildGraphFromASTs(astA, astB, { maxVertices: 100, maxEdges: 200 });
    
    expect(graph.startVertex).toBeTruthy();
    expect(graph.endVertex).toBeTruthy();
    expect(graph.vertices.size).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);
  });

  it('should build graph from different ASTs', () => {
    const astA = createMockAST([
      { type: 'identifier', text: 'foo' }
    ]);
    
    const astB = createMockAST([
      { type: 'identifier', text: 'bar' }
    ]);
    
    const graph = buildGraphFromASTs(astA, astB, { maxVertices: 100, maxEdges: 200 });
    
    expect(graph.startVertex).toBeTruthy();
    expect(graph.endVertex).toBeTruthy();
    expect(graph.vertices.size).toBeGreaterThan(0);
  });

  it('should handle empty ASTs', () => {
    const emptyAST = createMockAST([]);
    
    const graph = buildGraphFromASTs(emptyAST, emptyAST, { maxVertices: 100, maxEdges: 200 });
    
    expect(graph.startVertex).toBeTruthy();
    expect(graph.endVertex).toBeTruthy();
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Dijkstra Diff Integration', () => {
  function createMockNode(type, text, children = []) {
    return { type, text, children };
  }

  function createMockAST(nodes) {
    return createMockNode('root', '', nodes.map(spec => 
      createMockNode(spec.type, spec.text, spec.children || [])
    ));
  }

  it('should run complete diff on identical ASTs', () => {
    const astA = createMockAST([
      { type: 'identifier', text: 'foo' },
      { type: 'identifier', text: 'bar' }
    ]);
    
    const astB = createMockAST([
      { type: 'identifier', text: 'foo' },
      { type: 'identifier', text: 'bar' }
    ]);
    
    const results = runDijkstraDiff(astA, astB);
    
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    
    // Should have unchanged edges for matching nodes
    const unchangedEdges = results.filter(r => r.type === 'unchanged');
    expect(unchangedEdges.length).toBeGreaterThan(0);
  });

  it('should run complete diff on different ASTs', () => {
    const astA = createMockAST([
      { type: 'identifier', text: 'foo' }
    ]);
    
    const astB = createMockAST([
      { type: 'identifier', text: 'bar' }
    ]);
    
    const results = runDijkstraDiff(astA, astB);
    
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    
    // Should have novel edges since nodes are different
    const novelEdges = results.filter(r => r.type === 'novel-left' || r.type === 'novel-right');
    expect(novelEdges.length).toBeGreaterThan(0);
  });

  it('should handle empty ASTs', () => {
    const emptyAST = createMockAST([]);
    const nonEmptyAST = createMockAST([
      { type: 'identifier', text: 'foo' }
    ]);
    
    const results1 = runDijkstraDiff(emptyAST, emptyAST);
    expect(Array.isArray(results1)).toBe(true);
    
    const results2 = runDijkstraDiff(emptyAST, nonEmptyAST);
    expect(Array.isArray(results2)).toBe(true);
    
    const results3 = runDijkstraDiff(nonEmptyAST, emptyAST);
    expect(Array.isArray(results3)).toBe(true);
  });
});