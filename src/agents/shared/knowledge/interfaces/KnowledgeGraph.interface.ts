/**
 * Knowledge Graph Interface
 * 
 * This file defines interfaces for knowledge graph representation and operations,
 * enabling structured knowledge storage and retrieval.
 */

/**
 * Knowledge node types
 */
export enum KnowledgeNodeType {
  TASK = 'task',
  CONCEPT = 'concept',
  TREND = 'trend',
  TOOL = 'tool',
  STRATEGY = 'strategy',
  INSIGHT = 'insight',
  PROJECT = 'project',
  AGENT = 'agent',
  ENTITY = 'entity',
  PROCESS = 'process',
  RESOURCE = 'resource',
  METRIC = 'metric',
  EVENT = 'event',
  DECISION = 'decision'
}

/**
 * Knowledge edge types
 */
export enum KnowledgeEdgeType {
  RELATED_TO = 'related_to',
  DEPENDS_ON = 'depends_on',
  CONTRADICTS = 'contradicts',
  SUPPORTS = 'supports',
  USED_BY = 'used_by',
  REPORTED_BY = 'reported_by',
  PRODUCED_BY = 'produced_by',
  PART_OF = 'part_of',
  LEADS_TO = 'leads_to',
  SIMILAR_TO = 'similar_to',
  DERIVED_FROM = 'derived_from',
  INFLUENCES = 'influences',
  CATEGORIZES = 'categorizes',
  REFERENCES = 'references'
}

/**
 * Knowledge node interface
 */
export interface KnowledgeNode {
  /** Unique identifier for this node */
  id: string;
  
  /** Human-readable label */
  label: string;
  
  /** Node type */
  type: KnowledgeNodeType;
  
  /** Optional description */
  description?: string;
  
  /** Optional tags */
  tags?: string[];
  
  /** Optional creation timestamp */
  createdAt?: Date;
  
  /** Optional last updated timestamp */
  updatedAt?: Date;
  
  /** Importance score (0-1) */
  importance?: number;
  
  /** Confidence score (0-1) */
  confidence?: number;
  
  /** Source of this knowledge */
  source?: string;
  
  /** Additional properties */
  properties?: Record<string, string | number | boolean | null>;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Knowledge edge interface
 */
export interface KnowledgeEdge {
  /** Source node ID */
  from: string;
  
  /** Target node ID */
  to: string;
  
  /** Edge type */
  type: KnowledgeEdgeType;
  
  /** Optional human-readable label */
  label?: string;
  
  /** Edge strength (0-1) */
  strength?: number;
  
  /** Optional creation timestamp */
  createdAt?: Date;
  
  /** Optional last updated timestamp */
  updatedAt?: Date;
  
  /** Additional properties */
  properties?: Record<string, string | number | boolean | null>;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Knowledge graph path
 */
export interface KnowledgeGraphPath {
  /** Path ID */
  id: string;
  
  /** Edges in this path */
  edges: KnowledgeEdge[];
  
  /** Total path length */
  length: number;
  
  /** Total path strength (product of edge strengths) */
  totalStrength: number;
  
  /** Path metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Knowledge graph statistics
 */
export interface KnowledgeGraphStats {
  /** Total number of nodes */
  totalNodes: number;
  
  /** Total number of edges */
  totalEdges: number;
  
  /** Count of nodes by type */
  nodeTypes: Record<KnowledgeNodeType, number>;
  
  /** Count of edges by type */
  edgeTypes: Record<KnowledgeEdgeType, number>;
  
  /** Graph density */
  density: number;
  
  /** Average node degree */
  averageDegree: number;
  
  /** Most connected nodes */
  mostConnectedNodes: Array<{
    id: string;
    label: string;
    connections: number;
  }>;
}

/**
 * Knowledge graph search options
 */
export interface KnowledgeGraphSearchOptions {
  /** Node types to search for */
  nodeTypes?: KnowledgeNodeType[];
  
  /** Minimum relevance score (0-1) */
  minRelevance?: number;
  
  /** Maximum results to return */
  limit?: number;
  
  /** Offset for pagination */
  offset?: number;
  
  /** Include nodes with these tags */
  includeTags?: string[];
  
  /** Exclude nodes with these tags */
  excludeTags?: string[];
  
  /** Minimum importance score (0-1) */
  minImportance?: number;
  
  /** Minimum confidence score (0-1) */
  minConfidence?: number;
  
  /** Search in these properties */
  searchFields?: Array<'label' | 'description' | 'tags' | 'properties' | 'metadata'>;
  
  /** Include related nodes in results */
  includeRelated?: boolean;
  
  /** Maximum depth for related nodes */
  relatedDepth?: number;
}

/**
 * Knowledge graph query result
 */
export interface KnowledgeGraphQueryResult {
  /** Matching nodes */
  nodes: KnowledgeNode[];
  
  /** Relevant edges between nodes */
  edges: KnowledgeEdge[];
  
  /** Total result count (for pagination) */
  totalResults: number;
  
  /** Query execution time (ms) */
  executionTime: number;
  
  /** Query statistics */
  stats?: {
    nodeTypeBreakdown: Record<KnowledgeNodeType, number>;
    averageConfidence: number;
    averageImportance: number;
  };
}

/**
 * Knowledge graph traversal options
 */
export interface KnowledgeGraphTraversalOptions {
  /** Starting node ID */
  startNodeId: string;
  
  /** Edge types to traverse */
  edgeTypes?: KnowledgeEdgeType[];
  
  /** Node types to include */
  nodeTypes?: KnowledgeNodeType[];
  
  /** Maximum traversal depth */
  maxDepth?: number;
  
  /** Minimum edge strength to follow */
  minStrength?: number;
  
  /** Maximum nodes to retrieve */
  limit?: number;
  
  /** Traversal strategy */
  strategy?: 'breadth-first' | 'depth-first' | 'best-first';
  
  /** Direction of traversal */
  direction?: 'outgoing' | 'incoming' | 'both';
}

/**
 * Path finding options
 */
export interface PathFindingOptions {
  /** Starting node ID */
  startNodeId: string;
  
  /** Target node ID */
  targetNodeId: string;
  
  /** Edge types to traverse */
  edgeTypes?: KnowledgeEdgeType[];
  
  /** Maximum path length */
  maxLength?: number;
  
  /** Minimum edge strength */
  minStrength?: number;
  
  /** Maximum paths to find */
  maxPaths?: number;
  
  /** Path finding algorithm */
  algorithm?: 'shortest' | 'strongest' | 'all';
  
  /** Direction of traversal */
  direction?: 'outgoing' | 'incoming' | 'both';
}

/**
 * Knowledge extraction options
 */
export interface KnowledgeExtractionOptions {
  /** Content to extract knowledge from */
  content: string;
  
  /** Source identifier */
  source?: string;
  
  /** Node types to extract */
  nodeTypes?: KnowledgeNodeType[];
  
  /** Edge types to extract */
  edgeTypes?: KnowledgeEdgeType[];
  
  /** Minimum confidence for extraction */
  minConfidence?: number;
  
  /** Maximum nodes to extract */
  maxNodes?: number;
  
  /** Maximum edges to extract */
  maxEdges?: number;
  
  /** Context to help with extraction */
  context?: Record<string, unknown>;
}

/**
 * Knowledge extraction result
 */
export interface KnowledgeExtractionResult {
  /** Extracted nodes */
  nodes: KnowledgeNode[];
  
  /** Extracted edges */
  edges: KnowledgeEdge[];
  
  /** Overall extraction confidence */
  confidence: number;
  
  /** Extraction statistics */
  stats: {
    processingTimeMs: number;
    entityCount: number;
    relationshipCount: number;
    avgConfidence: number;
  };
}

/**
 * Graph intelligence options
 */
export interface GraphIntelligenceOptions {
  /** Node IDs to analyze */
  nodeIds?: string[];
  
  /** Types of insights to generate */
  insightTypes?: Array<'pattern' | 'anomaly' | 'trend' | 'gap' | 'recommendation'>;
  
  /** Minimum confidence for insights */
  minConfidence?: number;
  
  /** Maximum insights to generate */
  maxInsights?: number;
  
  /** Include explanations for insights */
  includeExplanations?: boolean;
  
  /** Specific focus for intelligence analysis */
  focus?: string;
}

/**
 * Graph insight interface
 */
export interface GraphInsight {
  /** Insight ID */
  id: string;
  
  /** Insight type */
  type: 'pattern' | 'anomaly' | 'trend' | 'gap' | 'recommendation';
  
  /** Insight title */
  title: string;
  
  /** Insight description */
  description: string;
  
  /** Related node IDs */
  relatedNodeIds: string[];
  
  /** Insight confidence (0-1) */
  confidence: number;
  
  /** Importance score (0-1) */
  importance: number;
  
  /** Creation timestamp */
  createdAt: Date;
  
  /** Explanation for this insight */
  explanation?: string;
  
  /** Action recommendations */
  recommendations?: string[];
  
  /** Supporting evidence */
  evidence?: string[];
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Inference options
 */
export interface InferenceOptions {
  /** Node ID to infer from */
  nodeId: string;
  
  /** Minimum confidence for inferences */
  minConfidence?: number;
  
  /** Relationship types to infer */
  relationshipTypes?: KnowledgeEdgeType[];
  
  /** Maximum inferences to generate */
  maxInferences?: number;
  
  /** Use transitive inference */
  useTransitiveInference?: boolean;
  
  /** Inference depth */
  inferenceDepth?: number;
}

/**
 * Inferred edge
 */
export interface InferredEdge extends KnowledgeEdge {
  /** Inference confidence */
  inferenceConfidence: number;
  
  /** Inference method */
  inferenceMethod: string;
  
  /** Source edges used for inference */
  sourceEdgeIds?: string[];
  
  /** Reasoning behind inference */
  reasoning?: string;
}

/**
 * Knowledge graph interface
 */
export interface KnowledgeGraph {
  /**
   * Initialize the knowledge graph
   * 
   * @returns Promise resolving to initialization success
   */
  initialize(): Promise<boolean>;
  
  /**
   * Add a node to the graph
   * 
   * @param node Node to add
   * @returns Promise resolving to the node ID
   */
  addNode(node: Omit<KnowledgeNode, 'id'>): Promise<string>;
  
  /**
   * Get a node by ID
   * 
   * @param id Node ID
   * @returns Promise resolving to the node or null if not found
   */
  getNode(id: string): Promise<KnowledgeNode | null>;
  
  /**
   * Find nodes matching a query
   * 
   * @param query Search query
   * @param options Search options
   * @returns Promise resolving to matching nodes
   */
  findNodes(query: string, options?: KnowledgeGraphSearchOptions): Promise<KnowledgeNode[]>;
  
  /**
   * Update a node
   * 
   * @param id Node ID
   * @param updates Node updates
   * @returns Promise resolving to success
   */
  updateNode(id: string, updates: Partial<KnowledgeNode>): Promise<boolean>;
  
  /**
   * Delete a node
   * 
   * @param id Node ID
   * @returns Promise resolving to success
   */
  deleteNode(id: string): Promise<boolean>;
  
  /**
   * Add an edge to the graph
   * 
   * @param edge Edge to add
   * @returns Promise resolving to the edge ID
   */
  addEdge(edge: KnowledgeEdge): Promise<string>;
  
  /**
   * Get edges for a node
   * 
   * @param nodeId Node ID
   * @param direction Edge direction
   * @param types Edge types
   * @returns Promise resolving to matching edges
   */
  getEdges(
    nodeId: string, 
    direction?: 'outgoing' | 'incoming' | 'both',
    types?: KnowledgeEdgeType[]
  ): Promise<KnowledgeEdge[]>;
  
  /**
   * Update an edge
   * 
   * @param from Source node ID
   * @param to Target node ID
   * @param type Edge type
   * @param updates Edge updates
   * @returns Promise resolving to success
   */
  updateEdge(
    from: string,
    to: string,
    type: KnowledgeEdgeType,
    updates: Partial<KnowledgeEdge>
  ): Promise<boolean>;
  
  /**
   * Delete an edge
   * 
   * @param from Source node ID
   * @param to Target node ID
   * @param type Edge type
   * @returns Promise resolving to success
   */
  deleteEdge(from: string, to: string, type?: KnowledgeEdgeType): Promise<boolean>;
  
  /**
   * Traverse the graph
   * 
   * @param options Traversal options
   * @returns Promise resolving to traversal result
   */
  traverse(options: KnowledgeGraphTraversalOptions): Promise<{
    nodes: KnowledgeNode[];
    edges: KnowledgeEdge[];
  }>;
  
  /**
   * Find paths between nodes
   * 
   * @param options Path finding options
   * @returns Promise resolving to found paths
   */
  findPaths(options: PathFindingOptions): Promise<KnowledgeGraphPath[]>;
  
  /**
   * Extract knowledge from content
   * 
   * @param options Extraction options
   * @returns Promise resolving to extraction result
   */
  extractKnowledge(options: KnowledgeExtractionOptions): Promise<KnowledgeExtractionResult>;
  
  /**
   * Generate insights from the graph
   * 
   * @param options Intelligence options
   * @returns Promise resolving to generated insights
   */
  generateInsights(options?: GraphIntelligenceOptions): Promise<GraphInsight[]>;
  
  /**
   * Infer new edges
   * 
   * @param options Inference options
   * @returns Promise resolving to inferred edges
   */
  inferEdges(options: InferenceOptions): Promise<InferredEdge[]>;
  
  /**
   * Get graph statistics
   * 
   * @returns Promise resolving to graph statistics
   */
  getStats(): Promise<KnowledgeGraphStats>;
  
  /**
   * Clear the graph
   * 
   * @returns Promise resolving to success
   */
  clear(): Promise<boolean>;
  
  /**
   * Build knowledge graph from various sources
   * 
   * @param options Build options
   * @returns Promise resolving to build result
   */
  buildGraph(options: {
    memories?: Array<{ id: string; content: string; metadata?: Record<string, unknown> }>;
    tasks?: Array<{ id: string; goal: string; subGoals?: any[]; status: string }>;
    documents?: Array<{ id: string; content: string; metadata?: Record<string, unknown> }>;
    conversations?: Array<{ id: string; messages: any[]; metadata?: Record<string, unknown> }>;
  }): Promise<{
    nodesAdded: number;
    edgesAdded: number;
    buildTimeMs: number;
  }>;
  
  /**
   * Get graph context for tasks/planning
   * 
   * @param topic Topic or goal to generate context for
   * @param options Context options
   * @returns Promise resolving to formatted context
   */
  getGraphContext(
    topic: string,
    options?: {
      maxNodes?: number;
      format?: 'text' | 'json' | 'markdown';
      includeRelevanceScores?: boolean;
      maxDepth?: number;
    }
  ): Promise<string>;
  
  /**
   * Get the graph visualization data
   * 
   * @returns Object containing nodes and edges for visualization
   */
  getVisualizationData(): {
    nodes: KnowledgeNode[];
    edges: KnowledgeEdge[];
  };
  
  /**
   * Shutdown the graph
   * 
   * @returns Promise resolving to shutdown success
   */
  shutdown(): Promise<boolean>;
} 