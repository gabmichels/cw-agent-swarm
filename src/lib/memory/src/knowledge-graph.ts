import * as serverQdrant from '../../../server/qdrant';
import { DateTime } from 'luxon';

/**
 * Knowledge Graph System
 * 
 * Provides memory connections and inference capabilities:
 * - Builds a graph of related memories
 * - Identifies implicit relationships
 * - Enables traversal of related concepts
 * - Supports inferring new connections
 */

/**
 * Enumeration of relationship types for Knowledge Graph edges
 */
export enum RelationType {
  RELATED_TO = 'RELATED_TO',
  INCLUDES = 'INCLUDES',
  CAUSES = 'CAUSES',
  INFLUENCES = 'INFLUENCES',
  CONTRADICTS = 'CONTRADICTS',
  SIMILAR_TO = 'SIMILAR_TO',
  DEPENDS_ON = 'DEPENDS_ON',
  PRECEDES = 'PRECEDES',
  FOLLOWS = 'FOLLOWS',
  IMPLIES = 'IMPLIES',
  SPECIALIZES = 'SPECIALIZES',
  GENERALIZES = 'GENERALIZES',
  INSTANCE_OF = 'INSTANCE_OF',
  MEMBER_OF = 'MEMBER_OF'
}

/**
 * Node types for the knowledge graph
 */
export enum NodeType {
  CONCEPT = 'concept',
  ENTITY = 'entity',
  EVENT = 'event',
  FACT = 'fact',
  PRINCIPLE = 'principle',
  INSIGHT = 'insight'
}

/**
 * Interface for a node in the knowledge graph
 */
export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  description?: string;
  created: Date;
  lastUpdated: Date;
  importance: number; // 0-1 scale
  metadata: Record<string, unknown>;
  source?: string;
  confidence?: number; // 0-1 scale of confidence
  properties?: Record<string, string | number | boolean | null>;
}

/**
 * Interface for an edge/relationship in the knowledge graph
 */
export interface GraphEdge {
  id: string;
  source: string; // Node ID
  target: string; // Node ID
  type: RelationType;
  description?: string;
  strength: number; // 0-1 scale
  created: Date;
  lastUpdated: Date;
  metadata: Record<string, unknown>;
  bidirectional: boolean;
  properties?: Record<string, string | number | boolean | null>;
}

/**
 * Interface for querying the knowledge graph
 */
export interface GraphQuery {
  startNode?: string;
  relationTypes?: RelationType[];
  nodeTypes?: NodeType[];
  maxDepth?: number;
  minStrength?: number;
  limit?: number;
  includePaths?: boolean;
  includeMetadata?: boolean;
}

/**
 * Knowledge Graph implementation
 */
export class KnowledgeGraph {
  private namespace: string;
  private isInitialized: boolean = false;
  
  constructor(namespace: string = 'default') {
    this.namespace = namespace;
  }
  
  /**
   * Initialize the knowledge graph
   */
  async initialize(): Promise<boolean> {
    try {
      if (typeof window === 'undefined') {
        // Initialize storage for graph on server-side
        // In this implementation, we'll use Qdrant collections for nodes and edges
        await serverQdrant.initMemory({
          qdrantUrl: process.env.QDRANT_URL,
          qdrantApiKey: process.env.QDRANT_API_KEY,
          useOpenAI: true
        });
        
        // Ensure collections exist for nodes and edges
        // In a real implementation, we would create these collections if they don't exist
      }
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing knowledge graph:', error);
      return false;
    }
  }
  
  /**
   * Add a node to the knowledge graph
   */
  async addNode(
    label: string,
    type: NodeType,
    metadata: Record<string, any> = {},
    importance: number = 0.5
  ): Promise<string> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const now = new Date();
      const nodeId = `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      const node: GraphNode = {
        id: nodeId,
        type,
        label,
        created: now,
        lastUpdated: now,
        importance,
        metadata: {
          ...metadata,
          namespace: this.namespace
        }
      };
      
      // Store node in knowledge_graph_nodes collection
      // In this implementation, we'll use the document collection
      await serverQdrant.addMemory(
        'document',
        `${type}:${label}`,
        {
          ...node,
          type: 'knowledge_graph_node',
          nodeType: type,
          importance
        }
      );
      
      return nodeId;
    } catch (error) {
      console.error('Error adding node to knowledge graph:', error);
      throw error;
    }
  }
  
  /**
   * Add edge between two nodes
   */
  async addEdge(
    sourceId: string,
    targetId: string,
    type: RelationType,
    strength: number = 0.5,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const now = new Date();
      const edgeId = `edge_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      const edge: GraphEdge = {
        id: edgeId,
        source: sourceId,
        target: targetId,
        type,
        strength,
        created: now,
        lastUpdated: now,
        metadata: {
          ...metadata,
          namespace: this.namespace
        },
        bidirectional: false,
        properties: {}
      };
      
      // Store edge in knowledge_graph_edges collection
      // In this implementation, we'll use the document collection
      await serverQdrant.addMemory(
        'document',
        `${type}:${sourceId}->${targetId}`,
        {
          ...edge,
          type: 'knowledge_graph_edge',
          edgeType: type,
          strength
        }
      );
      
      return edgeId;
    } catch (error) {
      console.error('Error adding edge to knowledge graph:', error);
      throw error;
    }
  }
  
  /**
   * Find nodes matching a label pattern
   */
  async findNodes(
    labelPattern: string,
    nodeTypes?: string[],
    limit: number = 10
  ): Promise<GraphNode[]> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      // Create filter
      const filter: Record<string, any> = {
        type: 'knowledge_graph_node',
        namespace: this.namespace
      };
      
      if (nodeTypes && nodeTypes.length > 0) {
        filter.nodeType = { $in: nodeTypes };
      }
      
      // Search for nodes
      const results = await serverQdrant.searchMemory(
        'document',
        labelPattern,
        {
          filter,
          limit
        }
      );
      
      if (!results || results.length === 0) {
        return [];
      }
      
      // Convert to GraphNode objects
      return results.map(result => ({
        id: result.metadata.id,
        type: result.metadata.nodeType,
        label: result.metadata.label || result.text.split(':')[1],
        created: new Date(result.metadata.created),
        lastUpdated: new Date(result.metadata.lastUpdated),
        importance: result.metadata.importance || 0.5,
        metadata: result.metadata
      }));
    } catch (error) {
      console.error('Error finding nodes in knowledge graph:', error);
      return [];
    }
  }
  
  /**
   * Get edges connected to a node
   */
  async getEdges(
    nodeId: string,
    direction: 'outgoing' | 'incoming' | 'both' = 'both',
    types?: RelationType[],
    minStrength: number = 0
  ): Promise<GraphEdge[]> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      // Create filters for outgoing and/or incoming edges
      const filters: Record<string, any>[] = [];
      
      if (direction === 'outgoing' || direction === 'both') {
        const outgoingFilter: Record<string, any> = {
          type: 'knowledge_graph_edge',
          namespace: this.namespace,
          source: nodeId
        };
        
        if (types && types.length > 0) {
          outgoingFilter.edgeType = { $in: types };
        }
        
        if (minStrength > 0) {
          outgoingFilter.strength = { $gte: minStrength };
        }
        
        filters.push(outgoingFilter);
      }
      
      if (direction === 'incoming' || direction === 'both') {
        const incomingFilter: Record<string, any> = {
          type: 'knowledge_graph_edge',
          namespace: this.namespace,
          target: nodeId
        };
        
        if (types && types.length > 0) {
          incomingFilter.edgeType = { $in: types };
        }
        
        if (minStrength > 0) {
          incomingFilter.strength = { $gte: minStrength };
        }
        
        filters.push(incomingFilter);
      }
      
      // Search for edges using both filters
      const edges: GraphEdge[] = [];
      
      for (const filter of filters) {
        const results = await serverQdrant.searchMemory(
          'document',
          '',
          {
            filter,
            limit: 100
          }
        );
        
        if (results && results.length > 0) {
          // Convert to GraphEdge objects
          const convertedEdges = results.map(result => ({
            id: result.metadata.id,
            source: result.metadata.source,
            target: result.metadata.target,
            type: result.metadata.edgeType as RelationType,
            strength: result.metadata.strength || 0.5,
            created: new Date(result.metadata.created),
            lastUpdated: new Date(result.metadata.lastUpdated),
            metadata: result.metadata,
            bidirectional: result.metadata.bidirectional || false,
            properties: result.metadata.properties || {}
          }));
          
          edges.push(...convertedEdges);
        }
      }
      
      return edges;
    } catch (error) {
      console.error('Error getting edges in knowledge graph:', error);
      return [];
    }
  }
  
  /**
   * Find path between two nodes
   */
  async findPath(
    startNodeId: string,
    endNodeId: string,
    maxDepth: number = 3
  ): Promise<GraphEdge[]> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      // Simple BFS implementation for path finding
      const visited = new Set<string>();
      const queue: Array<{ nodeId: string; path: GraphEdge[] }> = [];
      
      // Start from the start node
      queue.push({ nodeId: startNodeId, path: [] });
      visited.add(startNodeId);
      
      while (queue.length > 0) {
        const { nodeId, path } = queue.shift()!;
        
        // Get all edges from this node
        const edges = await this.getEdges(nodeId, 'outgoing');
        
        for (const edge of edges) {
          if (edge.target === endNodeId) {
            // Found path to end node
            return [...path, edge];
          }
          
          if (!visited.has(edge.target) && path.length < maxDepth) {
            // Add target node to queue
            visited.add(edge.target);
            queue.push({
              nodeId: edge.target,
              path: [...path, edge]
            });
          }
        }
      }
      
      // No path found
      return [];
    } catch (error) {
      console.error('Error finding path in knowledge graph:', error);
      return [];
    }
  }
  
  /**
   * Infer potential new edges based on existing patterns
   * This implements simple transitive inference
   */
  async inferNewEdges(
    nodeId: string,
    minConfidence: number = 0.6
  ): Promise<Array<{ source: string; target: string; type: RelationType; confidence: number }>> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const inferences: Array<{ 
        source: string; 
        target: string; 
        type: RelationType; 
        confidence: number 
      }> = [];
      
      // Implement simple transitive inference:
      // If A->B and B->C then potentially A->C
      
      // Get all outgoing edges
      const outgoingEdges = await this.getEdges(nodeId, 'outgoing');
      
      for (const edge1 of outgoingEdges) {
        // For each node this node points to, get its outgoing edges
        const secondLevelEdges = await this.getEdges(edge1.target, 'outgoing');
        
        for (const edge2 of secondLevelEdges) {
          // Don't create self-loops
          if (edge2.target === nodeId) continue;
          
          // Check if we already have this connection
          const existingEdges = await this.getEdges(nodeId, 'outgoing');
          const hasDirectConnection = existingEdges.some(e => e.target === edge2.target);
          
          if (!hasDirectConnection) {
            // Infer new connection
            let inferredType: RelationType;
            let confidence: number;
            
            // Apply rules for type inference based on combination
            if (edge1.type === edge2.type) {
              // Same relationship type can sometimes be transitive
              inferredType = edge1.type;
              confidence = edge1.strength * edge2.strength * 0.8;
            } else if (edge1.type === RelationType.MEMBER_OF && edge2.type === RelationType.MEMBER_OF) {
              // Transitive part-of relationship
              inferredType = RelationType.MEMBER_OF;
              confidence = edge1.strength * edge2.strength * 0.9;
            } else if (edge1.type === RelationType.CAUSES && edge2.type === RelationType.CAUSES) {
              // Causal chains can be transitive
              inferredType = RelationType.CAUSES;
              confidence = edge1.strength * edge2.strength * 0.7;
            } else {
              // Default to general relationship
              inferredType = RelationType.RELATED_TO;
              confidence = edge1.strength * edge2.strength * 0.5;
            }
            
            // Only add if confidence meets threshold
            if (confidence >= minConfidence) {
              inferences.push({
                source: nodeId,
                target: edge2.target,
                type: inferredType,
                confidence
              });
            }
          }
        }
      }
      
      return inferences;
    } catch (error) {
      console.error('Error inferring new edges in knowledge graph:', error);
      return [];
    }
  }
}

// Factory function
export const createKnowledgeGraph = (namespace: string = 'chloe'): KnowledgeGraph => {
  return new KnowledgeGraph(namespace);
}; 