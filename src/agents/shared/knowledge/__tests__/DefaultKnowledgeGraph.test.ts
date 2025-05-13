/**
 * DefaultKnowledgeGraph Tests
 * 
 * Tests for the DefaultKnowledgeGraph implementation of the KnowledgeGraph interface
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  KnowledgeNodeType,
  KnowledgeEdgeType
} from '../interfaces/KnowledgeGraph.interface';
import { 
  DefaultKnowledgeGraph,
  GraphNotInitializedError,
  NodeNotFoundError
} from '../DefaultKnowledgeGraph';

describe('DefaultKnowledgeGraph', () => {
  let graph: DefaultKnowledgeGraph;
  
  beforeEach(async () => {
    // Create a fresh graph for each test
    graph = new DefaultKnowledgeGraph();
    await graph.initialize();
  });
  
  describe('Initialization and Lifecycle', () => {
    it('should initialize successfully', async () => {
      const result = await graph.initialize();
      expect(result).toBe(true);
    });
    
    it('should throw error if not initialized', async () => {
      const uninitializedGraph = new DefaultKnowledgeGraph();
      await expect(uninitializedGraph.addNode({
        label: 'Test Node',
        type: KnowledgeNodeType.CONCEPT
      })).rejects.toThrow(GraphNotInitializedError);
    });
    
    it('should clear all data', async () => {
      // Add some data
      const nodeId = await graph.addNode({
        label: 'Test Node',
        type: KnowledgeNodeType.CONCEPT
      });
      
      const node2Id = await graph.addNode({
        label: 'Second Node',
        type: KnowledgeNodeType.ENTITY
      });
      
      await graph.addEdge({
        from: nodeId,
        to: node2Id,
        type: KnowledgeEdgeType.RELATED_TO
      });
      
      // Verify data exists
      expect(await graph.getNode(nodeId)).not.toBeNull();
      expect((await graph.getEdges(nodeId)).length).toBe(1);
      
      // Clear the graph
      const clearResult = await graph.clear();
      expect(clearResult).toBe(true);
      
      // Verify data is gone
      expect(await graph.getNode(nodeId)).toBeNull();
      
      // After clearing, the node is deleted so getEdges should throw or return empty
      try {
        const edges = await graph.getEdges(nodeId);
        expect(edges.length).toBe(0);
      } catch (error) {
        // It's also acceptable if getEdges throws a NodeNotFoundError
        expect(error).toBeInstanceOf(NodeNotFoundError);
      }
    });
    
    it('should shutdown cleanly', async () => {
      const shutdownResult = await graph.shutdown();
      expect(shutdownResult).toBe(true);
      
      // Should throw after shutdown
      await expect(graph.addNode({
        label: 'Post-Shutdown Node',
        type: KnowledgeNodeType.CONCEPT
      })).rejects.toThrow(GraphNotInitializedError);
    });
  });
  
  describe('Node Operations', () => {
    it('should add a node with generated ID', async () => {
      const nodeId = await graph.addNode({
        label: 'Test Node',
        type: KnowledgeNodeType.CONCEPT,
        description: 'A test node',
        tags: ['test', 'concept']
      });
      
      expect(nodeId).toBeDefined();
      expect(typeof nodeId).toBe('string');
      
      // Retrieve the node
      const node = await graph.getNode(nodeId);
      expect(node).toBeDefined();
      expect(node?.id).toBe(nodeId);
      expect(node?.label).toBe('Test Node');
      expect(node?.type).toBe(KnowledgeNodeType.CONCEPT);
      expect(node?.description).toBe('A test node');
      expect(node?.tags).toEqual(['test', 'concept']);
      expect(node?.createdAt).toBeInstanceOf(Date);
      expect(node?.updatedAt).toBeInstanceOf(Date);
    });
    
    it('should get a node by ID', async () => {
      const nodeId = await graph.addNode({
        label: 'Get Node Test',
        type: KnowledgeNodeType.ENTITY
      });
      
      const node = await graph.getNode(nodeId);
      expect(node).toBeDefined();
      expect(node?.id).toBe(nodeId);
      expect(node?.label).toBe('Get Node Test');
    });
    
    it('should return null for non-existent node ID', async () => {
      const node = await graph.getNode('non-existent-id');
      expect(node).toBeNull();
    });
    
    it('should update a node', async () => {
      const nodeId = await graph.addNode({
        label: 'Original Label',
        type: KnowledgeNodeType.CONCEPT,
        description: 'Original description',
        tags: ['original']
      });
      
      const updateResult = await graph.updateNode(nodeId, {
        label: 'Updated Label',
        description: 'Updated description',
        tags: ['updated', 'modified']
      });
      
      expect(updateResult).toBe(true);
      
      // Check updated values
      const updatedNode = await graph.getNode(nodeId);
      expect(updatedNode?.label).toBe('Updated Label');
      expect(updatedNode?.description).toBe('Updated description');
      expect(updatedNode?.tags).toEqual(['updated', 'modified']);
      
      // Type should remain unchanged
      expect(updatedNode?.type).toBe(KnowledgeNodeType.CONCEPT);
      
      // updatedAt should be newer than createdAt
      expect(updatedNode?.updatedAt).not.toEqual(updatedNode?.createdAt);
      expect(updatedNode).toBeDefined();
      if (updatedNode && updatedNode.updatedAt && updatedNode.createdAt) {
        expect(updatedNode.updatedAt.getTime()).toBeGreaterThan(updatedNode.createdAt.getTime());
      }
    });
    
    it('should return false when updating non-existent node', async () => {
      const result = await graph.updateNode('non-existent-id', {
        label: 'Updated Label'
      });
      
      expect(result).toBe(false);
    });
    
    it('should delete a node', async () => {
      const nodeId = await graph.addNode({
        label: 'Node To Delete',
        type: KnowledgeNodeType.CONCEPT
      });
      
      // Verify node exists
      expect(await graph.getNode(nodeId)).not.toBeNull();
      
      // Delete the node
      const deleteResult = await graph.deleteNode(nodeId);
      expect(deleteResult).toBe(true);
      
      // Verify node is gone
      expect(await graph.getNode(nodeId)).toBeNull();
    });
    
    it('should return false when deleting non-existent node', async () => {
      const result = await graph.deleteNode('non-existent-id');
      expect(result).toBe(false);
    });
    
    it('should delete connected edges when deleting a node', async () => {
      const node1Id = await graph.addNode({
        label: 'Source Node',
        type: KnowledgeNodeType.CONCEPT
      });
      
      const node2Id = await graph.addNode({
        label: 'Target Node',
        type: KnowledgeNodeType.CONCEPT
      });
      
      await graph.addEdge({
        from: node1Id,
        to: node2Id,
        type: KnowledgeEdgeType.RELATED_TO
      });
      
      // Verify edge exists
      expect((await graph.getEdges(node1Id)).length).toBe(1);
      
      // Delete the source node
      await graph.deleteNode(node1Id);
      
      // Edge should be gone
      await expect(graph.getEdges(node1Id)).rejects.toThrow(NodeNotFoundError);
      expect((await graph.getEdges(node2Id)).length).toBe(0);
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
      const edgeId = await graph.addEdge({
        from: sourceNodeId,
        to: targetNodeId,
        type: KnowledgeEdgeType.RELATED_TO,
        strength: 0.8,
        label: 'Test Edge'
      });
      
      expect(edgeId).toBeDefined();
      expect(typeof edgeId).toBe('string');
      
      // Verify edge exists
      const edges = await graph.getEdges(sourceNodeId);
      expect(edges).toHaveLength(1);
      expect(edges[0].from).toBe(sourceNodeId);
      expect(edges[0].to).toBe(targetNodeId);
      expect(edges[0].type).toBe(KnowledgeEdgeType.RELATED_TO);
      expect(edges[0].strength).toBe(0.8);
      expect(edges[0].label).toBe('Test Edge');
      expect(edges[0].createdAt).toBeInstanceOf(Date);
      expect(edges[0].updatedAt).toBeInstanceOf(Date);
    });
    
    it('should throw error when adding edge to non-existent source node', async () => {
      await expect(graph.addEdge({
        from: 'non-existent-id',
        to: targetNodeId,
        type: KnowledgeEdgeType.RELATED_TO
      })).rejects.toThrow(NodeNotFoundError);
    });
    
    it('should throw error when adding edge to non-existent target node', async () => {
      await expect(graph.addEdge({
        from: sourceNodeId,
        to: 'non-existent-id',
        type: KnowledgeEdgeType.RELATED_TO
      })).rejects.toThrow(NodeNotFoundError);
    });
    
    it('should not create duplicate edges', async () => {
      // Add an edge
      await graph.addEdge({
        from: sourceNodeId,
        to: targetNodeId,
        type: KnowledgeEdgeType.RELATED_TO
      });
      
      // Add the same edge again
      await graph.addEdge({
        from: sourceNodeId,
        to: targetNodeId,
        type: KnowledgeEdgeType.RELATED_TO
      });
      
      // Should still only have one edge
      const edges = await graph.getEdges(sourceNodeId);
      expect(edges).toHaveLength(1);
    });
    
    it('should get edges by direction', async () => {
      // Add edges in both directions
      await graph.addEdge({
        from: sourceNodeId,
        to: targetNodeId,
        type: KnowledgeEdgeType.RELATED_TO
      });
      
      await graph.addEdge({
        from: targetNodeId,
        to: sourceNodeId,
        type: KnowledgeEdgeType.INFLUENCES
      });
      
      // Get outgoing edges
      const outgoingEdges = await graph.getEdges(sourceNodeId, 'outgoing');
      expect(outgoingEdges).toHaveLength(1);
      expect(outgoingEdges[0].type).toBe(KnowledgeEdgeType.RELATED_TO);
      
      // Get incoming edges
      const incomingEdges = await graph.getEdges(sourceNodeId, 'incoming');
      expect(incomingEdges).toHaveLength(1);
      expect(incomingEdges[0].type).toBe(KnowledgeEdgeType.INFLUENCES);
      
      // Get all edges
      const allEdges = await graph.getEdges(sourceNodeId, 'both');
      expect(allEdges).toHaveLength(2);
    });
    
    it('should get edges by type', async () => {
      // Add edges of different types
      await graph.addEdge({
        from: sourceNodeId,
        to: targetNodeId,
        type: KnowledgeEdgeType.RELATED_TO
      });
      
      await graph.addEdge({
        from: sourceNodeId,
        to: targetNodeId,
        type: KnowledgeEdgeType.DEPENDS_ON
      });
      
      // Get edges of specific type
      const relatedEdges = await graph.getEdges(
        sourceNodeId, 
        'outgoing', 
        [KnowledgeEdgeType.RELATED_TO]
      );
      
      expect(relatedEdges).toHaveLength(1);
      expect(relatedEdges[0].type).toBe(KnowledgeEdgeType.RELATED_TO);
      
      // Get edges of multiple types
      const multiTypeEdges = await graph.getEdges(
        sourceNodeId, 
        'outgoing', 
        [KnowledgeEdgeType.RELATED_TO, KnowledgeEdgeType.DEPENDS_ON]
      );
      
      expect(multiTypeEdges).toHaveLength(2);
    });
    
    it('should update an edge', async () => {
      // Add an edge
      await graph.addEdge({
        from: sourceNodeId,
        to: targetNodeId,
        type: KnowledgeEdgeType.RELATED_TO,
        strength: 0.5
      });
      
      // Update the edge
      const updateResult = await graph.updateEdge(
        sourceNodeId,
        targetNodeId,
        KnowledgeEdgeType.RELATED_TO,
        {
          strength: 0.8,
          label: 'Updated Edge'
        }
      );
      
      expect(updateResult).toBe(true);
      
      // Check updated values
      const edges = await graph.getEdges(sourceNodeId);
      expect(edges).toHaveLength(1);
      expect(edges[0].strength).toBe(0.8);
      expect(edges[0].label).toBe('Updated Edge');
      
      // These values should not change
      expect(edges[0].from).toBe(sourceNodeId);
      expect(edges[0].to).toBe(targetNodeId);
      expect(edges[0].type).toBe(KnowledgeEdgeType.RELATED_TO);
    });
    
    it('should return false when updating non-existent edge', async () => {
      const result = await graph.updateEdge(
        sourceNodeId,
        targetNodeId,
        KnowledgeEdgeType.RELATED_TO,
        { strength: 0.8 }
      );
      
      expect(result).toBe(false);
    });
    
    it('should delete an edge by type', async () => {
      // Add two edges of different types
      await graph.addEdge({
        from: sourceNodeId,
        to: targetNodeId,
        type: KnowledgeEdgeType.RELATED_TO
      });
      
      await graph.addEdge({
        from: sourceNodeId,
        to: targetNodeId,
        type: KnowledgeEdgeType.DEPENDS_ON
      });
      
      // Verify both edges exist
      expect((await graph.getEdges(sourceNodeId)).length).toBe(2);
      
      // Delete one edge by type
      const deleteResult = await graph.deleteEdge(
        sourceNodeId,
        targetNodeId,
        KnowledgeEdgeType.RELATED_TO
      );
      
      expect(deleteResult).toBe(true);
      
      // Verify only one edge remains
      const remainingEdges = await graph.getEdges(sourceNodeId);
      expect(remainingEdges).toHaveLength(1);
      expect(remainingEdges[0].type).toBe(KnowledgeEdgeType.DEPENDS_ON);
    });
    
    it('should delete all edges between nodes', async () => {
      // Add multiple edges between the same nodes
      await graph.addEdge({
        from: sourceNodeId,
        to: targetNodeId,
        type: KnowledgeEdgeType.RELATED_TO
      });
      
      await graph.addEdge({
        from: sourceNodeId,
        to: targetNodeId,
        type: KnowledgeEdgeType.DEPENDS_ON
      });
      
      // Delete all edges between the nodes
      const deleteResult = await graph.deleteEdge(sourceNodeId, targetNodeId);
      expect(deleteResult).toBe(true);
      
      // Verify no edges remain
      expect((await graph.getEdges(sourceNodeId)).length).toBe(0);
    });
    
    it('should return false when deleting non-existent edge', async () => {
      const result = await graph.deleteEdge(
        sourceNodeId,
        targetNodeId,
        KnowledgeEdgeType.RELATED_TO
      );
      
      expect(result).toBe(false);
    });
  });
  
  describe('Search Operations', () => {
    beforeEach(async () => {
      // Add a variety of nodes for search testing
      await graph.addNode({
        label: 'Machine Learning',
        type: KnowledgeNodeType.CONCEPT,
        description: 'The study of algorithms that improve through experience',
        tags: ['ai', 'technology', 'data science'],
        importance: 0.9,
        confidence: 0.95
      });
      
      await graph.addNode({
        label: 'Deep Learning',
        type: KnowledgeNodeType.CONCEPT,
        description: 'Neural network approach to machine learning',
        tags: ['ai', 'neural networks', 'technology'],
        importance: 0.85,
        confidence: 0.9
      });
      
      await graph.addNode({
        label: 'Python Programming',
        type: KnowledgeNodeType.TOOL,
        description: 'Programming language popular for data science',
        tags: ['programming', 'technology', 'data science'],
        importance: 0.8,
        confidence: 0.95
      });
      
      await graph.addNode({
        label: 'Data Cleaning',
        type: KnowledgeNodeType.PROCESS,
        description: 'Process of fixing or removing incorrect data',
        tags: ['data science', 'preprocessing'],
        importance: 0.7,
        confidence: 0.85
      });
      
      await graph.addNode({
        label: 'BERT Model',
        type: KnowledgeNodeType.TOOL,
        description: 'Bidirectional Encoder Representations from Transformers',
        tags: ['ai', 'nlp', 'transformers'],
        importance: 0.75,
        confidence: 0.8
      });
    });
    
    it('should find nodes by text query', async () => {
      const results = await graph.findNodes('learning');
      expect(results).toHaveLength(2);
      expect(results.map(n => n.label)).toContain('Machine Learning');
      expect(results.map(n => n.label)).toContain('Deep Learning');
    });
    
    it('should filter search by node type', async () => {
      const results = await graph.findNodes('technology', {
        nodeTypes: [KnowledgeNodeType.TOOL]
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].label).toBe('Python Programming');
    });
    
    it('should filter search by tags', async () => {
      const results = await graph.findNodes('', {
        includeTags: ['nlp']
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].label).toBe('BERT Model');
    });
    
    it('should filter by importance and confidence', async () => {
      const results = await graph.findNodes('', {
        minImportance: 0.8,
        minConfidence: 0.9
      });
      
      // Expecting 3 nodes to match criteria
      expect(results).toHaveLength(3); 
      expect(results.map(n => n.label)).toContain('Machine Learning');
      expect(results.map(n => n.label)).toContain('Deep Learning');
      expect(results.map(n => n.label)).toContain('Python Programming');
      
      // Test more restrictive filtering
      const highThresholdResults = await graph.findNodes('', {
        minImportance: 0.85,
        minConfidence: 0.9
      });
      
      expect(highThresholdResults).toHaveLength(2);
      expect(highThresholdResults.map(n => n.label)).toContain('Machine Learning');
      expect(highThresholdResults.map(n => n.label)).toContain('Deep Learning');
    });
    
    it('should apply limit and offset', async () => {
      // Get all items first to determine expected order
      const allResults = await graph.findNodes('');
      
      // Get first 2 items
      const limitResults = await graph.findNodes('', {
        limit: 2
      });
      
      expect(limitResults).toHaveLength(2);
      expect(limitResults[0].id).toBe(allResults[0].id);
      expect(limitResults[1].id).toBe(allResults[1].id);
      
      // Get items with offset
      const offsetResults = await graph.findNodes('', {
        offset: 2,
        limit: 2
      });
      
      expect(offsetResults).toHaveLength(2);
      expect(offsetResults[0].id).toBe(allResults[2].id);
      expect(offsetResults[1].id).toBe(allResults[3].id);
    });
  });
  
  describe('Visualization', () => {
    it('should return visualization data', async () => {
      // Add some nodes and edges
      const node1Id = await graph.addNode({
        label: 'Node 1',
        type: KnowledgeNodeType.CONCEPT
      });
      
      const node2Id = await graph.addNode({
        label: 'Node 2',
        type: KnowledgeNodeType.ENTITY
      });
      
      await graph.addEdge({
        from: node1Id,
        to: node2Id,
        type: KnowledgeEdgeType.RELATED_TO
      });
      
      // Get visualization data
      const visData = graph.getVisualizationData();
      
      expect(visData.nodes).toHaveLength(2);
      expect(visData.edges).toHaveLength(1);
      
      // Verify node data is complete
      expect(visData.nodes[0].id).toBe(node1Id);
      expect(visData.nodes[0].label).toBe('Node 1');
      expect(visData.nodes[0].type).toBe(KnowledgeNodeType.CONCEPT);
      
      // Verify edge data is complete
      expect(visData.edges[0].from).toBe(node1Id);
      expect(visData.edges[0].to).toBe(node2Id);
      expect(visData.edges[0].type).toBe(KnowledgeEdgeType.RELATED_TO);
    });
  });
  
  describe('Statistics', () => {
    it('should return graph statistics', async () => {
      // Add nodes of different types
      await graph.addNode({
        label: 'Concept 1',
        type: KnowledgeNodeType.CONCEPT
      });
      
      await graph.addNode({
        label: 'Concept 2',
        type: KnowledgeNodeType.CONCEPT
      });
      
      await graph.addNode({
        label: 'Tool 1',
        type: KnowledgeNodeType.TOOL
      });
      
      // Add edges of different types
      const nodes = Array.from((await graph.findNodes('')));
      
      await graph.addEdge({
        from: nodes[0].id,
        to: nodes[1].id,
        type: KnowledgeEdgeType.RELATED_TO
      });
      
      await graph.addEdge({
        from: nodes[0].id,
        to: nodes[2].id,
        type: KnowledgeEdgeType.DEPENDS_ON
      });
      
      // Get statistics
      const stats = await graph.getStats();
      
      // Verify basic counts
      expect(stats.totalNodes).toBe(3);
      expect(stats.totalEdges).toBe(2);
      
      // Verify type counts
      expect(stats.nodeTypes[KnowledgeNodeType.CONCEPT]).toBe(2);
      expect(stats.nodeTypes[KnowledgeNodeType.TOOL]).toBe(1);
      
      expect(stats.edgeTypes[KnowledgeEdgeType.RELATED_TO]).toBe(1);
      expect(stats.edgeTypes[KnowledgeEdgeType.DEPENDS_ON]).toBe(1);
      
      // Verify most connected nodes
      expect(stats.mostConnectedNodes).toHaveLength(3);
      expect(stats.mostConnectedNodes[0].connections).toBe(2);
      expect(stats.mostConnectedNodes[0].id).toBe(nodes[0].id);
      
      // Verify calculations
      expect(stats.averageDegree).toBeCloseTo(4/3);
      expect(stats.density).toBeCloseTo(2/(3*2));
    });
  });
}); 