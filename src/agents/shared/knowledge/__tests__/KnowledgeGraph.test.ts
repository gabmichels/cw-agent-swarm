/**
 * Knowledge Graph Interface Tests
 * 
 * This file contains tests to validate the KnowledgeGraph interface contract
 * and verify that implementations adhere to the expected behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { 
  KnowledgeGraph, 
  KnowledgeNode, 
  KnowledgeEdge,
  KnowledgeNodeType,
  KnowledgeEdgeType,
  KnowledgeGraphPath,
  KnowledgeExtractionResult,
  GraphInsight
} from '../interfaces/KnowledgeGraph.interface';

// Mock implementation for testing
class MockKnowledgeGraph implements KnowledgeGraph {
  private nodes: Map<string, KnowledgeNode> = new Map();
  private edges: KnowledgeEdge[] = [];
  private initialized: boolean = false;
  
  async initialize(): Promise<boolean> {
    this.initialized = true;
    return true;
  }
  
  async addNode(node: Omit<KnowledgeNode, 'id'>): Promise<string> {
    if (!this.initialized) {
      throw new Error('Graph not initialized');
    }
    
    const id = uuidv4();
    const newNode: KnowledgeNode = {
      ...node,
      id
    };
    
    this.nodes.set(id, newNode);
    return id;
  }
  
  async getNode(id: string): Promise<KnowledgeNode | null> {
    if (!this.initialized) {
      throw new Error('Graph not initialized');
    }
    
    return this.nodes.get(id) || null;
  }
  
  async findNodes(query: string, options?: any): Promise<KnowledgeNode[]> {
    if (!this.initialized) {
      throw new Error('Graph not initialized');
    }
    
    const normalizedQuery = query.toLowerCase();
    let nodes = Array.from(this.nodes.values()).filter(node => 
      node.label.toLowerCase().includes(normalizedQuery) ||
      node.description?.toLowerCase().includes(normalizedQuery) ||
      node.tags?.some(tag => tag.toLowerCase().includes(normalizedQuery))
    );
    
    // Apply options filtering
    if (options?.nodeTypes?.length) {
      nodes = nodes.filter(node => options.nodeTypes.includes(node.type));
    }
    
    if (options?.limit) {
      nodes = nodes.slice(0, options.limit);
    }
    
    return nodes;
  }
  
  async updateNode(id: string, updates: Partial<KnowledgeNode>): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('Graph not initialized');
    }
    
    const node = this.nodes.get(id);
    if (!node) {
      return false;
    }
    
    this.nodes.set(id, { ...node, ...updates });
    return true;
  }
  
  async deleteNode(id: string): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('Graph not initialized');
    }
    
    if (!this.nodes.has(id)) {
      return false;
    }
    
    this.nodes.delete(id);
    
    // Also delete connected edges
    this.edges = this.edges.filter(edge => 
      edge.from !== id && edge.to !== id
    );
    
    return true;
  }
  
  async addEdge(edge: KnowledgeEdge): Promise<string> {
    if (!this.initialized) {
      throw new Error('Graph not initialized');
    }
    
    // Check if nodes exist
    if (!this.nodes.has(edge.from) || !this.nodes.has(edge.to)) {
      throw new Error('One or both nodes do not exist');
    }
    
    // Generate a simple edge ID
    const edgeId = `${edge.from}-${edge.to}-${edge.type}`;
    
    // Check if edge already exists
    const existingEdge = this.edges.find(e => 
      e.from === edge.from && e.to === edge.to && e.type === edge.type
    );
    
    if (existingEdge) {
      throw new Error('Edge already exists');
    }
    
    this.edges.push(edge);
    return edgeId;
  }
  
  async getEdges(
    nodeId: string,
    direction: 'outgoing' | 'incoming' | 'both' = 'both',
    types?: KnowledgeEdgeType[]
  ): Promise<KnowledgeEdge[]> {
    if (!this.initialized) {
      throw new Error('Graph not initialized');
    }
    
    return this.edges.filter(edge => {
      // Filter by node
      const matchesNode = (direction === 'outgoing' && edge.from === nodeId) ||
                          (direction === 'incoming' && edge.to === nodeId) ||
                          (direction === 'both' && (edge.from === nodeId || edge.to === nodeId));
      
      // Filter by type if specified
      const matchesType = !types?.length || types.includes(edge.type);
      
      return matchesNode && matchesType;
    });
  }
  
  async updateEdge(
    from: string,
    to: string,
    type: KnowledgeEdgeType,
    updates: Partial<KnowledgeEdge>
  ): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('Graph not initialized');
    }
    
    const index = this.edges.findIndex(edge => 
      edge.from === from && edge.to === to && edge.type === type
    );
    
    if (index === -1) {
      return false;
    }
    
    this.edges[index] = { ...this.edges[index], ...updates };
    return true;
  }
  
  async deleteEdge(
    from: string,
    to: string,
    type?: KnowledgeEdgeType
  ): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('Graph not initialized');
    }
    
    const initialLength = this.edges.length;
    
    this.edges = this.edges.filter(edge => {
      if (type) {
        return !(edge.from === from && edge.to === to && edge.type === type);
      }
      return !(edge.from === from && edge.to === to);
    });
    
    return this.edges.length < initialLength;
  }
  
  // Implementing required methods with minimal functionality for testing
  async traverse(options: any): Promise<{ nodes: KnowledgeNode[]; edges: KnowledgeEdge[] }> {
    return { nodes: [], edges: [] };
  }
  
  async findPaths(options: any): Promise<KnowledgeGraphPath[]> {
    return [];
  }
  
  async extractKnowledge(options: any): Promise<KnowledgeExtractionResult> {
    return {
      nodes: [],
      edges: [],
      confidence: 0,
      stats: {
        processingTimeMs: 0,
        entityCount: 0,
        relationshipCount: 0,
        avgConfidence: 0
      }
    };
  }
  
  async generateInsights(options?: any): Promise<GraphInsight[]> {
    return [];
  }
  
  async inferEdges(options: any): Promise<any[]> {
    return [];
  }
  
  async getStats(): Promise<any> {
    return {
      totalNodes: this.nodes.size,
      totalEdges: this.edges.length,
      nodeTypes: {},
      edgeTypes: {},
      density: 0,
      averageDegree: 0,
      mostConnectedNodes: []
    };
  }
  
  async clear(): Promise<boolean> {
    this.nodes.clear();
    this.edges = [];
    return true;
  }
  
  async buildGraph(options: any): Promise<any> {
    return { nodesAdded: 0, edgesAdded: 0, buildTimeMs: 0 };
  }
  
  async getGraphContext(topic: string, options?: any): Promise<string> {
    return '';
  }
  
  getVisualizationData(): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges
    };
  }
  
  async shutdown(): Promise<boolean> {
    this.initialized = false;
    return true;
  }
}

describe('KnowledgeGraph Interface', () => {
  let graph: KnowledgeGraph;
  
  beforeEach(async () => {
    graph = new MockKnowledgeGraph();
    await graph.initialize();
  });
  
  describe('Node Operations', () => {
    it('should add a node', async () => {
      const newNode = {
        label: 'Test Node',
        type: KnowledgeNodeType.CONCEPT,
        description: 'A test node for the knowledge graph',
        tags: ['test', 'concept', 'knowledge']
      };
      
      const nodeId = await graph.addNode(newNode);
      
      expect(nodeId).toBeDefined();
      expect(typeof nodeId).toBe('string');
      
      // Verify node can be retrieved
      const retrievedNode = await graph.getNode(nodeId);
      expect(retrievedNode).toBeDefined();
      expect(retrievedNode?.label).toBe(newNode.label);
      expect(retrievedNode?.type).toBe(newNode.type);
    });
    
    it('should get a node by ID', async () => {
      // Add a node first
      const nodeId = await graph.addNode({
        label: 'Test Retrieval',
        type: KnowledgeNodeType.INSIGHT,
        description: 'Testing node retrieval'
      });
      
      // Get the node
      const node = await graph.getNode(nodeId);
      
      expect(node).toBeDefined();
      expect(node?.id).toBe(nodeId);
      expect(node?.label).toBe('Test Retrieval');
    });
    
    it('should return null for non-existent node', async () => {
      const node = await graph.getNode('non-existent-id');
      expect(node).toBeNull();
    });
    
    it('should find nodes matching a query', async () => {
      // Add a few nodes
      await graph.addNode({
        label: 'Machine Learning',
        type: KnowledgeNodeType.CONCEPT,
        description: 'The study of algorithms that improve through experience',
        tags: ['ai', 'technology', 'data science']
      });
      
      await graph.addNode({
        label: 'Deep Learning',
        type: KnowledgeNodeType.CONCEPT,
        description: 'A subset of machine learning that uses neural networks',
        tags: ['ai', 'technology', 'neural networks']
      });
      
      await graph.addNode({
        label: 'Decision Tree',
        type: KnowledgeNodeType.CONCEPT,
        description: 'A decision support tool using a tree-like model',
        tags: ['ai', 'algorithm', 'classification']
      });
      
      // Search for nodes
      const results = await graph.findNodes('learning');
      
      expect(results).toHaveLength(2);
      expect(results.map(n => n.label)).toContain('Machine Learning');
      expect(results.map(n => n.label)).toContain('Deep Learning');
    });
    
    it('should update a node', async () => {
      // Add a node first
      const nodeId = await graph.addNode({
        label: 'Original Label',
        type: KnowledgeNodeType.CONCEPT,
        description: 'Original description'
      });
      
      // Update the node
      const updateSuccess = await graph.updateNode(nodeId, {
        label: 'Updated Label',
        description: 'Updated description'
      });
      
      expect(updateSuccess).toBe(true);
      
      // Verify the update
      const updatedNode = await graph.getNode(nodeId);
      expect(updatedNode?.label).toBe('Updated Label');
      expect(updatedNode?.description).toBe('Updated description');
      // Type should remain unchanged
      expect(updatedNode?.type).toBe(KnowledgeNodeType.CONCEPT);
    });
    
    it('should delete a node', async () => {
      // Add a node first
      const nodeId = await graph.addNode({
        label: 'Node to Delete',
        type: KnowledgeNodeType.CONCEPT
      });
      
      // Verify the node exists
      const beforeDelete = await graph.getNode(nodeId);
      expect(beforeDelete).toBeDefined();
      
      // Delete the node
      const deleteSuccess = await graph.deleteNode(nodeId);
      expect(deleteSuccess).toBe(true);
      
      // Verify the node is gone
      const afterDelete = await graph.getNode(nodeId);
      expect(afterDelete).toBeNull();
    });
  });
  
  describe('Edge Operations', () => {
    let sourceNodeId: string;
    let targetNodeId: string;
    
    beforeEach(async () => {
      // Create two nodes to use for edge operations
      sourceNodeId = await graph.addNode({
        label: 'Source Node',
        type: KnowledgeNodeType.CONCEPT
      });
      
      targetNodeId = await graph.addNode({
        label: 'Target Node',
        type: KnowledgeNodeType.CONCEPT
      });
    });
    
    it('should add an edge between nodes', async () => {
      const edge: KnowledgeEdge = {
        from: sourceNodeId,
        to: targetNodeId,
        type: KnowledgeEdgeType.RELATED_TO,
        label: 'Related to',
        strength: 0.8
      };
      
      const edgeId = await graph.addEdge(edge);
      
      expect(edgeId).toBeDefined();
      expect(typeof edgeId).toBe('string');
      
      // Verify edge can be retrieved
      const edges = await graph.getEdges(sourceNodeId);
      expect(edges).toHaveLength(1);
      expect(edges[0].from).toBe(sourceNodeId);
      expect(edges[0].to).toBe(targetNodeId);
      expect(edges[0].type).toBe(KnowledgeEdgeType.RELATED_TO);
    });
    
    it('should get edges for a node', async () => {
      // Add a few edges
      await graph.addEdge({
        from: sourceNodeId,
        to: targetNodeId,
        type: KnowledgeEdgeType.RELATED_TO
      });
      
      const thirdNodeId = await graph.addNode({
        label: 'Third Node',
        type: KnowledgeNodeType.CONCEPT
      });
      
      await graph.addEdge({
        from: sourceNodeId,
        to: thirdNodeId,
        type: KnowledgeEdgeType.DEPENDS_ON
      });
      
      await graph.addEdge({
        from: thirdNodeId,
        to: sourceNodeId,
        type: KnowledgeEdgeType.SUPPORTS
      });
      
      // Get outgoing edges
      const outgoingEdges = await graph.getEdges(sourceNodeId, 'outgoing');
      expect(outgoingEdges).toHaveLength(2);
      
      // Get incoming edges
      const incomingEdges = await graph.getEdges(sourceNodeId, 'incoming');
      expect(incomingEdges).toHaveLength(1);
      
      // Get all edges
      const allEdges = await graph.getEdges(sourceNodeId, 'both');
      expect(allEdges).toHaveLength(3);
      
      // Filter by type
      const relatedEdges = await graph.getEdges(
        sourceNodeId, 
        'both', 
        [KnowledgeEdgeType.RELATED_TO]
      );
      expect(relatedEdges).toHaveLength(1);
    });
    
    it('should update an edge', async () => {
      // Add an edge first
      await graph.addEdge({
        from: sourceNodeId,
        to: targetNodeId,
        type: KnowledgeEdgeType.RELATED_TO,
        strength: 0.5
      });
      
      // Update the edge
      const updateSuccess = await graph.updateEdge(
        sourceNodeId,
        targetNodeId,
        KnowledgeEdgeType.RELATED_TO,
        {
          label: 'Updated Label',
          strength: 0.9
        }
      );
      
      expect(updateSuccess).toBe(true);
      
      // Verify the update
      const edges = await graph.getEdges(sourceNodeId);
      expect(edges).toHaveLength(1);
      expect(edges[0].label).toBe('Updated Label');
      expect(edges[0].strength).toBe(0.9);
    });
    
    it('should delete an edge', async () => {
      // Add an edge first
      await graph.addEdge({
        from: sourceNodeId,
        to: targetNodeId,
        type: KnowledgeEdgeType.RELATED_TO
      });
      
      // Verify the edge exists
      const beforeDelete = await graph.getEdges(sourceNodeId);
      expect(beforeDelete).toHaveLength(1);
      
      // Delete the edge
      const deleteSuccess = await graph.deleteEdge(sourceNodeId, targetNodeId);
      expect(deleteSuccess).toBe(true);
      
      // Verify the edge is gone
      const afterDelete = await graph.getEdges(sourceNodeId);
      expect(afterDelete).toHaveLength(0);
    });
  });
  
  describe('Graph Operations', () => {
    it('should clear the graph', async () => {
      // Add a few nodes and edges
      const node1 = await graph.addNode({
        label: 'Node 1',
        type: KnowledgeNodeType.CONCEPT
      });
      
      const node2 = await graph.addNode({
        label: 'Node 2',
        type: KnowledgeNodeType.CONCEPT
      });
      
      await graph.addEdge({
        from: node1,
        to: node2,
        type: KnowledgeEdgeType.RELATED_TO
      });
      
      // Clear the graph
      const clearSuccess = await graph.clear();
      expect(clearSuccess).toBe(true);
      
      // Verify nodes are gone
      const node1After = await graph.getNode(node1);
      const node2After = await graph.getNode(node2);
      expect(node1After).toBeNull();
      expect(node2After).toBeNull();
      
      // Verify edges are gone
      const edges = await graph.getEdges(node1);
      expect(edges).toHaveLength(0);
    });
    
    it('should get graph visualization data', async () => {
      // Add a few nodes and edges
      const node1 = await graph.addNode({
        label: 'Node 1',
        type: KnowledgeNodeType.CONCEPT
      });
      
      const node2 = await graph.addNode({
        label: 'Node 2',
        type: KnowledgeNodeType.CONCEPT
      });
      
      await graph.addEdge({
        from: node1,
        to: node2,
        type: KnowledgeEdgeType.RELATED_TO
      });
      
      // Get visualization data
      const visualData = graph.getVisualizationData();
      
      expect(visualData.nodes).toHaveLength(2);
      expect(visualData.edges).toHaveLength(1);
    });
    
    it('should shutdown the graph', async () => {
      const shutdownSuccess = await graph.shutdown();
      expect(shutdownSuccess).toBe(true);
      
      // Operations should fail after shutdown
      await expect(graph.addNode({
        label: 'Post-Shutdown Node',
        type: KnowledgeNodeType.CONCEPT
      })).rejects.toThrow();
    });
  });
}); 