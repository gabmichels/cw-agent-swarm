import { getMemoryServices } from '../../../server/memory/services';
import { MemoryType as StandardMemoryType } from '../../../server/memory/config/types';
import { BaseMemorySchema } from '../../../server/memory/models';
import { ImportanceLevel } from '../../../constants/memory';
import { ulid } from 'ulid';
import { ImportanceConverter } from '../../../services/importance/ImportanceConverter';
import { logger } from '../../../lib/logging';

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
 * Interface for node metadata in the knowledge graph
 */
export interface NodeMetadataSchema {
  schemaVersion: string;
  type: 'knowledge_graph_node';
  nodeType: NodeType;
  label: string;
  namespace: string;
  importance: ImportanceLevel | number;
  source?: string;
  confidence?: number;
  properties?: Record<string, string | number | boolean | null>;
  created: string;
  lastUpdated: string;
  [key: string]: unknown;
}

/**
 * Interface for edge metadata in the knowledge graph
 */
export interface EdgeMetadataSchema {
  schemaVersion: string;
  type: 'knowledge_graph_edge';
  edgeType: RelationType;
  source: string;
  target: string;
  strength: number;
  namespace: string;
  bidirectional: boolean;
  properties?: Record<string, string | number | boolean | null>;
  created: string;
  lastUpdated: string;
  [key: string]: unknown;
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
 * Interface for inferred edges
 */
export interface InferredEdge {
  source: string;
  target: string;
  type: RelationType;
  confidence: number;
}

/**
 * Interface for the Knowledge Graph operations
 */
export interface IKnowledgeGraph {
  initialize(options?: KnowledgeGraphOptions): Promise<boolean>;
  addNode(label: string, type: NodeType, metadata?: Record<string, unknown>, importance?: number): Promise<string>;
  addEdge(sourceId: string, targetId: string, type: RelationType, strength?: number, metadata?: Record<string, unknown>): Promise<string>;
  findNodes(labelPattern: string, nodeTypes?: string[], limit?: number): Promise<GraphNode[]>;
  getEdges(nodeId: string, direction?: 'outgoing' | 'incoming' | 'both', types?: RelationType[], minStrength?: number): Promise<GraphEdge[]>;
  findPath(startNodeId: string, endNodeId: string, maxDepth?: number): Promise<GraphEdge[]>;
  inferNewEdges(nodeId: string, minConfidence?: number): Promise<InferredEdge[]>;
  addRelationship(sourceId: string, targetId: string, relationshipType: RelationType, metadata?: Record<string, unknown>): Promise<string>;
}

/**
 * Options for knowledge graph operations
 */
export interface KnowledgeGraphOptions {
  /** Visualization context for tracking the graph operations */
  visualization?: any;
  
  /** Visualization service for creating nodes and edges */
  visualizer?: any;
  
  /** Parent node ID to connect to in the visualization */
  parentNodeId?: string;
}

/**
 * Knowledge Graph implementation
 */
export class KnowledgeGraph implements IKnowledgeGraph {
  private namespace: string;
  private isInitialized: boolean = false;
  
  /**
   * Create a new KnowledgeGraph
   * 
   * @param namespace Unique namespace for this graph instance
   */
  constructor(namespace: string = 'default') {
    this.namespace = namespace;
  }
  
  /**
   * Initialize the knowledge graph
   */
  async initialize(options: KnowledgeGraphOptions = {}): Promise<boolean> {
    const startTime = Date.now();
    let graphNodeId: string | undefined;
    const visualization = options.visualization;
    const visualizer = options.visualizer;
    
    try {
      // Create visualization node if visualization is enabled
      if (visualization && visualizer) {
        try {
          // Create a knowledge graph visualization node
          graphNodeId = visualizer.addNode(
            visualization,
            'knowledge_graph_init',
            'Knowledge Graph Initialization',
            {
              namespace: this.namespace,
              timestamp: startTime
            },
            'in_progress'
          );
          
          // Connect to parent node if specified
          if (options.parentNodeId && graphNodeId) {
            visualizer.addEdge(
              visualization,
              options.parentNodeId,
              graphNodeId,
              'child',
              'initializes'
            );
          }
        } catch (visualizationError) {
          logger.error('Error creating knowledge graph visualization node:', visualizationError);
        }
      }
      
      if (typeof window === 'undefined') {
        // Initialize storage for graph on server-side using new memory services
        // The memory service initialization is handled by getMemoryServices
        await getMemoryServices();
      }
      
      this.isInitialized = true;
      
      // Update visualization with success
      if (visualization && visualizer && graphNodeId) {
        try {
          visualizer.updateNode(
            visualization,
            graphNodeId,
            {
              status: 'completed',
              data: {
                namespace: this.namespace,
                executionCompleted: Date.now(),
                durationMs: Date.now() - startTime,
                success: true
              }
            }
          );
        } catch (visualizationError) {
          logger.error('Error updating knowledge graph visualization with result:', visualizationError);
        }
      }
      
      return true;
    } catch (error) {
      logger.error('Error initializing knowledge graph:', error);
      
      // Update visualization with error
      if (visualization && visualizer && graphNodeId) {
        try {
          visualizer.updateNode(
            visualization,
            graphNodeId,
            {
              status: 'error',
              data: {
                error: error instanceof Error ? error.message : String(error),
                errorCode: 'INITIALIZATION_ERROR',
                executionCompleted: Date.now(),
                durationMs: Date.now() - startTime
              }
            }
          );
        } catch (visualizationError) {
          logger.error('Error updating knowledge graph visualization with error:', visualizationError);
        }
      }
      
      return false;
    }
  }
  
  /**
   * Add a node to the graph
   * 
   * @param label Label for the node
   * @param type Node type
   * @param metadata Additional metadata
   * @param importance Importance score (0-1)
   * @returns Promise resolving to the created node ID
   */
  async addNode(
    label: string, 
    type: NodeType, 
    metadata: Record<string, unknown> = {}, 
    importance: number = 0.5,
    options: KnowledgeGraphOptions = {}
  ): Promise<string> {
    const startTime = Date.now();
    let addNodeId: string | undefined;
    const visualization = options.visualization;
    const visualizer = options.visualizer;
    
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      // Create visualization node if visualization is enabled
      if (visualization && visualizer) {
        try {
          // Create an add node visualization node
          addNodeId = visualizer.addNode(
            visualization,
            'add_graph_node',
            'Add Knowledge Graph Node',
            {
              label,
              type,
              timestamp: startTime
            },
            'in_progress'
          );
          
          // Connect to parent node if specified
          if (options.parentNodeId && addNodeId) {
            visualizer.addEdge(
              visualization,
              options.parentNodeId,
              addNodeId,
              'child',
              'adds_node'
            );
          }
        } catch (visualizationError) {
          logger.error('Error creating add node visualization node:', visualizationError);
        }
      }
      
      // Create the node
      const now = new Date();
      const nodeId = `node_${ulid()}`;
      
      const nodeMetadata: NodeMetadataSchema = {
        schemaVersion: '1.0.0',
        type: 'knowledge_graph_node',
        nodeType: type,
        label,
        namespace: this.namespace,
        importance: this.convertImportanceToLevel(importance),
        created: now.toISOString(),
        lastUpdated: now.toISOString(),
        ...metadata
      };
      
      // Store node using memory service
      const { memoryService } = await getMemoryServices();
      
      await memoryService.addMemory({
        id: nodeId,
        type: StandardMemoryType.DOCUMENT,
        content: `${type}:${label}`,
        metadata: nodeMetadata
      });
      
      // Update visualization with success
      if (visualization && visualizer && addNodeId) {
        try {
          visualizer.updateNode(
            visualization,
            addNodeId,
            {
              status: 'completed',
              data: {
                nodeId,
                executionCompleted: Date.now(),
                durationMs: Date.now() - startTime,
                success: true
              }
            }
          );
          
          // Create a representation of the actual graph node
          const graphNodeRepId = visualizer.addNode(
            visualization,
            'knowledge_node',
            label,
            {
              id: nodeId,
              type,
              properties: metadata,
              timestamp: Date.now()
            },
            'completed'
          );
          
          // Connect operation to the graph node
          visualizer.addEdge(
            visualization,
            addNodeId,
            graphNodeRepId,
            'creates',
            'created'
          );
        } catch (visualizationError) {
          logger.error('Error updating add node visualization with result:', visualizationError);
        }
      }
      
      return nodeId;
    } catch (error) {
      logger.error('Error adding node to knowledge graph:', error);
      
      // Update visualization with error
      if (visualization && visualizer && addNodeId) {
        try {
          visualizer.updateNode(
            visualization,
            addNodeId,
            {
              status: 'error',
              data: {
                error: error instanceof Error ? error.message : String(error),
                errorCode: 'ADD_NODE_ERROR',
                executionCompleted: Date.now(),
                durationMs: Date.now() - startTime
              }
            }
          );
        } catch (visualizationError) {
          logger.error('Error updating add node visualization with error:', visualizationError);
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Convert numeric importance (0-1) to an ImportanceLevel enum value
   */
  private convertImportanceToLevel(importance: number): ImportanceLevel {
    return ImportanceConverter.scoreToLevel(importance);
  }
  
  /**
   * Add an edge to the graph
   * 
   * @param sourceId Source node ID
   * @param targetId Target node ID
   * @param type Relationship type
   * @param strength Relationship strength (0-1)
   * @param metadata Additional metadata
   * @returns Promise resolving to the created edge ID
   */
  async addEdge(
    sourceId: string, 
    targetId: string, 
    type: RelationType, 
    strength: number = 0.5, 
    metadata: Record<string, unknown> = {},
    options: KnowledgeGraphOptions = {}
  ): Promise<string> {
    const startTime = Date.now();
    let addEdgeId: string | undefined;
    const visualization = options.visualization;
    const visualizer = options.visualizer;
    
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      // Create visualization node if visualization is enabled
      if (visualization && visualizer) {
        try {
          // Create an add edge visualization node
          addEdgeId = visualizer.addNode(
            visualization,
            'add_graph_edge',
            'Add Knowledge Graph Edge',
            {
              sourceId,
              targetId,
              type,
              timestamp: startTime
            },
            'in_progress'
          );
          
          // Connect to parent node if specified
          if (options.parentNodeId && addEdgeId) {
            visualizer.addEdge(
              visualization,
              options.parentNodeId,
              addEdgeId,
              'child',
              'adds_edge'
            );
          }
        } catch (visualizationError) {
          logger.error('Error creating add edge visualization node:', visualizationError);
        }
      }
      
      // Create the edge
      const now = new Date();
      const edgeId = `edge_${ulid()}`;
      
      const edgeMetadata: EdgeMetadataSchema = {
        schemaVersion: '1.0.0',
        type: 'knowledge_graph_edge',
        edgeType: type,
        source: sourceId,
        target: targetId,
        strength,
        namespace: this.namespace,
        bidirectional: false,
        created: now.toISOString(),
        lastUpdated: now.toISOString(),
        ...metadata
      };
      
      // Store edge using memory service
      const { memoryService } = await getMemoryServices();
      
      await memoryService.addMemory({
        id: edgeId,
        type: StandardMemoryType.DOCUMENT,
        content: `${sourceId}-[${type}]->${targetId}`,
        metadata: edgeMetadata
      });
      
      // Update visualization with success
      if (visualization && visualizer && addEdgeId) {
        try {
          visualizer.updateNode(
            visualization,
            addEdgeId,
            {
              status: 'completed',
              data: {
                edgeId: edgeId,
                executionCompleted: Date.now(),
                durationMs: Date.now() - startTime,
                success: true
              }
            }
          );
          
          // Connect source and target nodes in visualization 
          visualizer.addEdge(
            visualization,
            sourceId,
            targetId,
            type.toLowerCase(),
            type
          );
        } catch (visualizationError) {
          logger.error('Error updating add edge visualization with result:', visualizationError);
        }
      }
      
      return edgeId;
    } catch (error) {
      logger.error('Error adding edge to knowledge graph:', error);
      
      // Update visualization with error
      if (visualization && visualizer && addEdgeId) {
        try {
          visualizer.updateNode(
            visualization,
            addEdgeId,
            {
              status: 'error',
              data: {
                error: error instanceof Error ? error.message : String(error),
                errorCode: 'ADD_EDGE_ERROR',
                executionCompleted: Date.now(),
                durationMs: Date.now() - startTime
              }
            }
          );
        } catch (visualizationError) {
          logger.error('Error updating add edge visualization with error:', visualizationError);
        }
      }
      
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
      const filter: Record<string, unknown> = {
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
        (filter.must as Array<Record<string, unknown>>).push({
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
        // Cast metadata to any type first to avoid TypeScript error, then to Record<string, unknown>
        const metadata = point.payload.metadata as unknown as Record<string, unknown>;
        
        if (!this.isValidNodeMetadata(metadata)) {
          console.error('Invalid node metadata structure:', metadata);
          continue;
        }
        
          try {
            const node: GraphNode = {
              id: point.id,
              type: metadata.nodeType as NodeType || NodeType.CONCEPT,
              label: metadata.label as string || point.payload.text,
              created: new Date(metadata.created as string),
              lastUpdated: new Date(metadata.lastUpdated as string),
              importance: typeof metadata.importance === 'number' ? metadata.importance : 
                (metadata.importance ? this.importanceLevelToNumber(metadata.importance as ImportanceLevel) : 0.5),
              metadata: metadata,
              source: metadata.source as string | undefined,
              confidence: metadata.confidence as number | undefined,
              properties: metadata.properties as Record<string, string | number | boolean | null> | undefined
            };
            
            nodes.push(node);
          } catch (error) {
            console.error('Error parsing node data:', error);
        }
      }
      
      return nodes;
    } catch (error) {
      console.error('Error finding nodes in knowledge graph:', error);
      return [];
    }
  }
  
  /**
   * Type guard to check if an object is valid NodeMetadata
   */
  private isValidNodeMetadata(metadata: Record<string, unknown>): metadata is NodeMetadataSchema {
    return (
      metadata.type === 'knowledge_graph_node' &&
      typeof metadata.nodeType === 'string' &&
      typeof metadata.label === 'string' &&
      typeof metadata.namespace === 'string' &&
      metadata.created !== undefined &&
      metadata.lastUpdated !== undefined
    );
  }
  
  /**
   * Type guard to check if an object is valid EdgeMetadata
   */
  private isValidEdgeMetadata(metadata: Record<string, unknown>): metadata is EdgeMetadataSchema {
    return (
      metadata.type === 'knowledge_graph_edge' &&
      typeof metadata.edgeType === 'string' &&
      typeof metadata.source === 'string' &&
      typeof metadata.target === 'string' &&
      metadata.created !== undefined &&
      metadata.lastUpdated !== undefined
    );
  }
  
  /**
   * Convert ImportanceLevel to a numeric value
   */
  private importanceLevelToNumber(level: ImportanceLevel): number {
    return ImportanceConverter.levelToScore(level);
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
      const filters: Record<string, unknown>[] = [];
      
      if (direction === 'outgoing' || direction === 'both') {
        const outgoingFilter: Record<string, unknown> = {
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
        const incomingFilter: Record<string, unknown> = {
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
          for (const result of results) {
            // Cast metadata to any type first to avoid TypeScript error, then to Record<string, unknown>
            const metadata = result.point.payload.metadata as unknown as Record<string, unknown>;
            
            // Only process valid edge data
            if (this.isValidEdgeMetadata(metadata)) {
              const edge: GraphEdge = {
                id: result.point.id,
                source: metadata.source,
                target: metadata.target,
                type: metadata.edgeType as RelationType,
                strength: metadata.strength as number || 0.5,
                created: new Date(metadata.created),
                lastUpdated: new Date(metadata.lastUpdated),
                metadata: metadata,
                bidirectional: metadata.bidirectional as boolean || false,
                properties: metadata.properties as Record<string, string | number | boolean | null> | undefined
              };
          
              edges.push(edge);
            }
          }
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
  ): Promise<InferredEdge[]> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const inferences: InferredEdge[] = [];
      
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
    metadata: Record<string, unknown> = {}
  ): Promise<string> {
    // Determine strength/weight from metadata
    const weight = typeof metadata.weight === 'number' ? metadata.weight : 0.5;
    
    // Create a copy of metadata without the weight property
    const { weight: _, ...restMetadata } = metadata;
    
    // Call the existing addEdge method
    return this.addEdge(sourceId, targetId, relationshipType, weight, restMetadata);
  }
}

// Factory function - implements dependency injection pattern
export const createKnowledgeGraph = (namespace: string = 'chloe'): IKnowledgeGraph => {
  return new KnowledgeGraph(namespace);
}; 