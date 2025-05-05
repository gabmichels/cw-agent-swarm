import { getMemoryServices } from '../../../server/memory/services';
import { MemoryType as StandardMemoryType } from '../../../server/memory/config/types';
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
  CAUSED_BY = 'CAUSED_BY',
  INFLUENCES = 'INFLUENCES',
  INFLUENCED_BY = 'INFLUENCED_BY',
  CONTRADICTS = 'CONTRADICTS',
  SIMILAR_TO = 'SIMILAR_TO',
  DEPENDS_ON = 'DEPENDS_ON',
  REQUIRED_BY = 'REQUIRED_BY',
  PRECEDES = 'PRECEDES',
  FOLLOWS = 'FOLLOWS',
  IMPLIES = 'IMPLIES',
  SPECIALIZES = 'SPECIALIZES',
  GENERALIZES = 'GENERALIZES',
  INSTANCE_OF = 'INSTANCE_OF',
  HAS_INSTANCE = 'HAS_INSTANCE',
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
  weight?: number; // Added for MemoryGraph compatibility
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
        // Initialize storage for graph on server-side using new memory services
        // The memory service initialization is handled by getMemoryServices
        await getMemoryServices();
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
      
      // Store node using memory service instead of directly with qdrant
      const { memoryService } = await getMemoryServices();
      
      await memoryService.addMemory({
        id: nodeId,
        type: StandardMemoryType.DOCUMENT,
        content: `${type}:${label}`,
        metadata: {
          ...node,
          type: 'knowledge_graph_node',
          nodeType: type,
          importance
        }
      });
      
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
        bidirectional: false,
        metadata: {
          ...metadata,
          namespace: this.namespace
        }
      };
      
      // Store edge using memory service
      const { memoryService } = await getMemoryServices();
      
      await memoryService.addMemory({
        id: edgeId,
        type: StandardMemoryType.DOCUMENT,
        content: `${sourceId}-[${type}]->${targetId}`,
        metadata: {
          ...edge,
          type: 'knowledge_graph_edge',
          edgeType: type,
          strength,
          sourceNode: sourceId,
          targetNode: targetId
        }
      });
      
      return edgeId;
    } catch (error) {
      console.error('Error adding edge to knowledge graph:', error);
      throw error;
    }
  }
  
  /**
   * Find nodes by label pattern
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
      
      // Search for nodes using memory service
      const { searchService } = await getMemoryServices();
      
      // Build filter
      const filter: any = {
        must: [
          {
            key: "metadata.type",
            match: {
              value: "knowledge_graph_node"
            }
          },
          {
            key: "metadata.namespace",
            match: {
              value: this.namespace
            }
          }
        ]
      };
      
      // Add node type filter if specified
      if (nodeTypes && nodeTypes.length > 0) {
        filter.must.push({
          key: "metadata.nodeType",
          match: {
            value: nodeTypes
          }
        });
      }
      
      // Search with filter
      const results = await searchService.search(labelPattern, {
        types: [StandardMemoryType.DOCUMENT],
        filter,
        limit
      });
      
      // Convert to GraphNode array
      const nodes: GraphNode[] = [];
      
      for (const result of results) {
        const point = result.point;
        const metadata = point.payload.metadata || {};
        
        if (metadata.id) {
          try {
            const node: GraphNode = {
              id: metadata.id,
              type: metadata.nodeType || NodeType.CONCEPT,
              label: metadata.label || point.payload.text,
              created: new Date(metadata.created),
              lastUpdated: new Date(metadata.lastUpdated),
              importance: typeof metadata.importance === 'number' ? metadata.importance : 
                (metadata.importance ? Number(metadata.importance.toString()) : 0.5),
              metadata: metadata,
              source: metadata.source,
              confidence: metadata.confidence
            };
            
            nodes.push(node);
          } catch (error) {
            console.error('Error parsing node data:', error);
          }
        }
      }
      
      return nodes;
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
        const results = await getMemoryServices().then(services => services.searchService.search('', {
          filter,
          limit: 100
        }));
        
        if (results && results.length > 0) {
          // Convert to GraphEdge objects
          const convertedEdges = results.map(result => ({
            id: result.point.payload.metadata.id,
            source: result.point.payload.metadata.source,
            target: result.point.payload.metadata.target,
            type: result.point.payload.metadata.edgeType as RelationType,
            strength: result.point.payload.metadata.strength || 0.5,
            created: new Date(result.point.payload.metadata.created),
            lastUpdated: new Date(result.point.payload.metadata.lastUpdated),
            metadata: result.point.payload.metadata,
            bidirectional: result.point.payload.metadata.bidirectional || false,
            properties: result.point.payload.metadata.properties || {}
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

  /**
   * Add a relationship between two memory items
   * For MemoryGraph compatibility
   */
  async addRelationship(
    sourceId: string,
    targetId: string,
    relationshipType: RelationType,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    // Determine strength/weight from metadata
    const weight = metadata.weight || 0.5;
    delete metadata.weight; // Remove from metadata since we use it directly
    
    // Call the existing addEdge method
    return this.addEdge(sourceId, targetId, relationshipType, weight, metadata);
  }
}

// Factory function
export const createKnowledgeGraph = (namespace: string = 'chloe'): KnowledgeGraph => {
  return new KnowledgeGraph(namespace);
}; 