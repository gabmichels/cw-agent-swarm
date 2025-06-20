/**
 * DefaultKnowledgeGraph
 * 
 * Default implementation of the KnowledgeGraph interface.
 * This implementation provides a memory-based knowledge graph with core operations.
 */

import { v4 as uuidv4 } from 'uuid';
import { ulid } from 'ulid';
import {
  KnowledgeGraph,
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeNodeType,
  KnowledgeEdgeType,
  KnowledgeGraphPath,
  KnowledgeGraphSearchOptions,
  KnowledgeGraphTraversalOptions,
  PathFindingOptions,
  KnowledgeExtractionOptions,
  KnowledgeExtractionResult,
  GraphIntelligenceOptions,
  GraphInsight,
  InferenceOptions,
  InferredEdge,
  KnowledgeGraphStats,
  KnowledgeGraphQueryResult
} from './interfaces/KnowledgeGraph.interface';
import { KnowledgeExtractor } from './KnowledgeExtractor';
import { QdrantKnowledgeStore, VectorSearchResult } from './QdrantKnowledgeStore';
import { RelationshipInferenceWorkflow, RelationshipInferenceConfig } from './workflows/RelationshipInferenceWorkflow';
import { KnowledgeExtractionWorkflow, KnowledgeExtractionConfig } from './workflows/KnowledgeExtractionWorkflow';
// New LangGraph-based workflows
import { LangGraphKnowledgeExtractionWorkflow, LangGraphKnowledgeExtractionConfig } from './workflows/LangGraphKnowledgeExtractionWorkflow';
import { LangGraphRelationshipInferenceWorkflow, LangGraphRelationshipInferenceConfig } from './workflows/LangGraphRelationshipInferenceWorkflow';
import { EnhancedIntelligenceService, EnhancedIntelligenceConfig } from './EnhancedIntelligenceService';

/**
 * Error types for knowledge graph operations
 */
export class KnowledgeGraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KnowledgeGraphError';
  }
}

export class GraphNotInitializedError extends KnowledgeGraphError {
  constructor() {
    super('Knowledge graph has not been initialized');
  }
}

export class NodeNotFoundError extends KnowledgeGraphError {
  constructor(id: string) {
    super(`Node with id '${id}' not found`);
  }
}

export class EdgeNotFoundError extends KnowledgeGraphError {
  constructor(from: string, to: string, type?: KnowledgeEdgeType) {
    const typeStr = type ? ` with type '${type}'` : '';
    super(`Edge from '${from}' to '${to}'${typeStr} not found`);
  }
}

export interface DefaultKnowledgeGraphConfig {
  useQdrant?: boolean;
  qdrantConfig?: {
    qdrantUrl?: string;
    qdrantApiKey?: string;
    nodeCollectionName?: string;
    edgeCollectionName?: string;
  };
  // New configuration for LangGraph workflows
  openAIApiKey?: string;
  useLangGraph?: boolean; // Enable LangGraph workflows
  minConfidenceThreshold?: number;
  maxInferenceCandidates?: number;
  // Enhanced Intelligence features
  vectorSimilarityThreshold?: number;
  temporalWindowDays?: number;
  maxExtractionEntities?: number;
  maxExtractionRelationships?: number;
}

/**
 * Default implementation of KnowledgeGraph interface
 */
export class DefaultKnowledgeGraph implements KnowledgeGraph {
  private nodes: Map<string, KnowledgeNode> = new Map();
  private edges: KnowledgeEdge[] = [];
  private initialized: boolean = false;
  private nodeTypeIndices: Map<KnowledgeNodeType, Set<string>> = new Map();
  private nodeTagIndices: Map<string, Set<string>> = new Map();

  // New Qdrant vector storage
  private qdrantStore?: QdrantKnowledgeStore;
  private useQdrant: boolean = false;
  
  // LangGraph workflows
  private relationshipInferenceWorkflow?: RelationshipInferenceWorkflow;
  private knowledgeExtractionWorkflow?: KnowledgeExtractionWorkflow;
  // New LangGraph-based workflows
  private langGraphKnowledgeExtractionWorkflow?: LangGraphKnowledgeExtractionWorkflow;
  private langGraphRelationshipInferenceWorkflow?: LangGraphRelationshipInferenceWorkflow;
  private enhancedIntelligenceService?: EnhancedIntelligenceService;
  private config: DefaultKnowledgeGraphConfig;

  constructor(config: DefaultKnowledgeGraphConfig = {}) {
    this.config = config;
    this.useQdrant = config.useQdrant || false;
    
    if (this.useQdrant) {
      this.qdrantStore = new QdrantKnowledgeStore(config.qdrantConfig);
      console.log('🚀 DefaultKnowledgeGraph initialized with Qdrant vector storage');
    } else {
      console.log('📝 DefaultKnowledgeGraph initialized with in-memory storage');
    }
  }

  /**
   * Initialize the knowledge graph
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    try {
      if (this.useQdrant && this.qdrantStore) {
        const success = await this.qdrantStore.initialize();
        if (!success) {
          console.warn('⚠️ Qdrant initialization failed, falling back to in-memory storage');
          this.useQdrant = false;
          this.qdrantStore = undefined;
        }
      }

      // Initialize workflows - prefer LangGraph if enabled
      if (this.useQdrant && this.qdrantStore) {
        if (this.config.useLangGraph) {
          // Initialize LangGraph-based workflows
          const langGraphExtractionConfig: LangGraphKnowledgeExtractionConfig = {
            openAIApiKey: this.config.openAIApiKey || process.env.OPENAI_API_KEY,
            qdrantStore: this.qdrantStore,
            extractionModel: 'gpt-4',
            maxEntities: this.config.maxExtractionEntities || 25,
            maxRelationships: this.config.maxExtractionRelationships || 15,
            minConfidenceThreshold: this.config.minConfidenceThreshold || 0.6
          };
          
          this.langGraphKnowledgeExtractionWorkflow = new LangGraphKnowledgeExtractionWorkflow(langGraphExtractionConfig);
          console.log('🧠 LangGraph knowledge extraction workflow initialized');
          
          const langGraphInferenceConfig: LangGraphRelationshipInferenceConfig = {
            openAIApiKey: this.config.openAIApiKey || process.env.OPENAI_API_KEY,
            knowledgeStore: this.qdrantStore,
            minConfidenceThreshold: this.config.minConfidenceThreshold || 0.6,
            maxCandidates: this.config.maxInferenceCandidates || 20,
            embeddingModel: 'text-embedding-3-small'
          };
          
          this.langGraphRelationshipInferenceWorkflow = new LangGraphRelationshipInferenceWorkflow(langGraphInferenceConfig);
          console.log('🔬 LangGraph relationship inference workflow initialized');
        } else {
          // Initialize legacy workflows
          const workflowConfig: RelationshipInferenceConfig = {
            openAIApiKey: this.config.openAIApiKey || process.env.OPENAI_API_KEY,
            knowledgeStore: this.qdrantStore,
            minConfidenceThreshold: this.config.minConfidenceThreshold || 0.6,
            maxCandidates: this.config.maxInferenceCandidates || 20,
            embeddingModel: 'text-embedding-3-small'
          };
          
          this.relationshipInferenceWorkflow = new RelationshipInferenceWorkflow(workflowConfig);
          console.log('🧠 Legacy relationship inference workflow initialized');
          
          // Initialize Knowledge Extraction Workflow
          const extractionConfig: KnowledgeExtractionConfig = {
            openAIApiKey: this.config.openAIApiKey || process.env.OPENAI_API_KEY,
            qdrantStore: this.qdrantStore,
            extractionModel: 'gpt-4',
            maxEntities: this.config.maxExtractionEntities || 25,
            maxRelationships: this.config.maxExtractionRelationships || 15,
            minConfidenceThreshold: this.config.minConfidenceThreshold || 0.6
          };
          
          this.knowledgeExtractionWorkflow = new KnowledgeExtractionWorkflow(extractionConfig);
          console.log('🔬 Legacy knowledge extraction workflow initialized');
        }
        
        // Initialize Enhanced Intelligence Service
        const intelligenceConfig: EnhancedIntelligenceConfig = {
          knowledgeGraph: this,
          qdrantStore: this.qdrantStore,
          vectorSimilarityThreshold: this.config.vectorSimilarityThreshold || 0.7,
          temporalWindowDays: this.config.temporalWindowDays || 30,
          maxRelationshipDepth: 3,
          duplicateThreshold: 0.8
        };
        
        this.enhancedIntelligenceService = new EnhancedIntelligenceService(intelligenceConfig);
        console.log('🚀 Enhanced Intelligence Service initialized');
      }

      // Initialize all node type indices
      Object.values(KnowledgeNodeType).forEach(type => {
        this.nodeTypeIndices.set(type, new Set<string>());
      });
      
      this.initialized = true;
      const workflowType = this.config.useLangGraph ? 'LangGraph' : 'legacy';
      console.log(`✅ DefaultKnowledgeGraph initialized (${this.useQdrant ? `Qdrant + ${workflowType}` : 'in-memory'} mode)`);
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize DefaultKnowledgeGraph:', error);
      return false;
    }
  }

  /**
   * Ensure the graph is initialized
   * @throws {GraphNotInitializedError} If the graph is not initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new GraphNotInitializedError();
    }
  }

  /**
   * Add a node to the graph
   */
  async addNode(node: Omit<KnowledgeNode, 'id'>): Promise<string> {
    this.ensureInitialized();
    
    if (this.useQdrant && this.qdrantStore) {
      // Use Qdrant vector storage
      const nodeId = await this.qdrantStore.addNode(node);
      
      // Update local indices for fast filtering
      this.nodeTypeIndices.get(node.type)?.add(nodeId);
      if (node.tags) {
        for (const tag of node.tags) {
          if (!this.nodeTagIndices.has(tag)) {
            this.nodeTagIndices.set(tag, new Set<string>());
          }
          this.nodeTagIndices.get(tag)?.add(nodeId);
        }
      }
      
      return nodeId;
    } else {
      // Use in-memory storage (legacy)
      const nodeId = ulid();
      
      const fullNode: KnowledgeNode = {
        id: nodeId,
        ...node,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.nodes.set(nodeId, fullNode);
      
      // Update indices
      this.nodeTypeIndices.get(node.type)?.add(nodeId);
      if (node.tags) {
        for (const tag of node.tags) {
          if (!this.nodeTagIndices.has(tag)) {
            this.nodeTagIndices.set(tag, new Set<string>());
          }
          this.nodeTagIndices.get(tag)?.add(nodeId);
        }
      }

      return nodeId;
    }
  }

  /**
   * Get a node by ID
   */
  async getNode(id: string): Promise<KnowledgeNode | null> {
    this.ensureInitialized();

    if (this.useQdrant && this.qdrantStore) {
      return await this.qdrantStore.getNode(id);
    } else {
      return this.nodes.get(id) || null;
    }
  }

  /**
   * Find nodes matching a query
   */
  async findNodes(query: string, options?: KnowledgeGraphSearchOptions): Promise<KnowledgeNode[]> {
    this.ensureInitialized();
    
    if (this.useQdrant && this.qdrantStore) {
      // Use Qdrant vector search for semantic matching
      try {
        const results = await this.qdrantStore.searchNodes(query, {
          limit: options?.limit || 10,
          scoreThreshold: 0.6,
          nodeTypes: options?.nodeTypes,
          tags: options?.includeTags
        });

        return results.map(result => result.node);
      } catch (error) {
        console.error('❌ Qdrant search failed, falling back to in-memory search:', error);
        // Fall back to in-memory search
        return this.findNodesInMemory(query, options);
      }
    } else {
      return this.findNodesInMemory(query, options);
    }
  }

  /**
   * In-memory node search (legacy implementation)
   */
  private findNodesInMemory(query: string, options?: KnowledgeGraphSearchOptions): KnowledgeNode[] {
    const lowerQuery = query.toLowerCase();
    let candidateNodes: KnowledgeNode[] = [];

    // Get nodes by type filter
    if (options?.nodeTypes && options.nodeTypes.length > 0) {
      const nodeIds = new Set<string>();
      for (const nodeType of options.nodeTypes) {
        const typeNodeIds = this.nodeTypeIndices.get(nodeType) || new Set();
        typeNodeIds.forEach(id => nodeIds.add(id));
      }
      candidateNodes = Array.from(nodeIds).map(id => this.nodes.get(id)!).filter(Boolean);
    } else {
      candidateNodes = Array.from(this.nodes.values());
    }

    // Apply tag filter
    if (options?.includeTags && options.includeTags.length > 0) {
      candidateNodes = candidateNodes.filter(node => 
        node.tags && node.tags.some(tag => options.includeTags!.includes(tag))
      );
    }

    // Apply text search
    if (query.trim()) {
      candidateNodes = candidateNodes.filter(node => {
        const nodeText = `${node.label}\n${node.description || ''}`.toLowerCase();
        return nodeText.includes(lowerQuery);
      });
    }

    // Sort by relevance
    candidateNodes.sort((a, b) => {
      const aScore = this.calculateRelevanceScore(a, query);
      const bScore = this.calculateRelevanceScore(b, query);
      return bScore - aScore;
    });

    // Apply limit
    if (options?.limit) {
      candidateNodes = candidateNodes.slice(0, options.limit);
    }

    return candidateNodes;
  }

  /**
   * Update a node
   */
  async updateNode(id: string, updates: Partial<KnowledgeNode>): Promise<boolean> {
    this.ensureInitialized();
    
    if (this.useQdrant && this.qdrantStore) {
      return await this.qdrantStore.updateNode(id, updates);
    } else {
      // In-memory update
      const existingNode = this.nodes.get(id);
      if (!existingNode) {
        return false;
      }
      
      // Update indices if type or tags changed
      if (updates.type && updates.type !== existingNode.type) {
        this.nodeTypeIndices.get(existingNode.type)?.delete(id);
        this.nodeTypeIndices.get(updates.type)?.add(id);
      }
      
      if (updates.tags) {
        // Remove from old tag indices
        if (existingNode.tags) {
          for (const tag of existingNode.tags) {
            this.nodeTagIndices.get(tag)?.delete(id);
          }
        }
        // Add to new tag indices
        for (const tag of updates.tags) {
          if (!this.nodeTagIndices.has(tag)) {
            this.nodeTagIndices.set(tag, new Set<string>());
          }
          this.nodeTagIndices.get(tag)?.add(id);
        }
      }
      
      const updatedNode: KnowledgeNode = {
        ...existingNode,
        ...updates,
        id, // Ensure ID doesn't change
        updatedAt: new Date()
      };
      
      this.nodes.set(id, updatedNode);
      return true;
    }
  }

  /**
   * Delete a node
   */
  async deleteNode(id: string): Promise<boolean> {
    this.ensureInitialized();
    
    if (this.useQdrant && this.qdrantStore) {
      const success = await this.qdrantStore.deleteNode(id);
      if (success) {
        // Update local indices
        for (const nodeIds of this.nodeTypeIndices.values()) {
          nodeIds.delete(id);
        }
        for (const nodeIds of this.nodeTagIndices.values()) {
          nodeIds.delete(id);
        }
      }
      return success;
    } else {
      // In-memory deletion
      const node = this.nodes.get(id);
      if (!node) {
        return false;
      }
      
      // Remove from indices
      this.nodeTypeIndices.get(node.type)?.delete(id);
      if (node.tags) {
        for (const tag of node.tags) {
          this.nodeTagIndices.get(tag)?.delete(id);
        }
      }
      
      // Remove from nodes and edges
      this.nodes.delete(id);
      this.edges = this.edges.filter(edge => edge.from !== id && edge.to !== id);
      return true;
    }
  }

  /**
   * Add an edge to the graph
   */
  async addEdge(edge: KnowledgeEdge): Promise<string> {
    this.ensureInitialized();
    
    if (this.useQdrant && this.qdrantStore) {
      return await this.qdrantStore.addEdge(edge);
    } else {
      // In-memory edge storage
      this.edges.push(edge);
      return `${edge.from}-${edge.to}-${edge.type}`;
    }
  }

  /**
   * Get edges for a node
   */
  async getEdges(
    nodeId: string,
    direction: 'outgoing' | 'incoming' | 'both' = 'both',
    types?: KnowledgeEdgeType[]
  ): Promise<KnowledgeEdge[]> {
    this.ensureInitialized();
    
    if (this.useQdrant && this.qdrantStore) {
      const edges = await this.qdrantStore.getEdges(nodeId, direction);
      
      if (types && types.length > 0) {
        return edges.filter(edge => types.includes(edge.type));
      }
      return edges;
    } else {
      // In-memory edge filtering
      let filteredEdges = this.edges.filter(edge => {
        if (direction === 'outgoing') {
          return edge.from === nodeId;
        } else if (direction === 'incoming') {
          return edge.to === nodeId;
        } else {
          return edge.from === nodeId || edge.to === nodeId;
        }
      });

      if (types && types.length > 0) {
        filteredEdges = filteredEdges.filter(edge => types.includes(edge.type));
      }

      return filteredEdges;
    }
  }

  /**
   * Update an edge
   */
  async updateEdge(
    from: string,
    to: string,
    type: KnowledgeEdgeType,
    updates: Partial<KnowledgeEdge>
  ): Promise<boolean> {
    this.ensureInitialized();
    
    const index = this.edges.findIndex(edge => 
      edge.from === from && edge.to === to && edge.type === type
    );
    
    if (index === -1) {
      return false;
    }
    
    this.edges[index] = {
      ...this.edges[index],
      ...updates,
      from, // Ensure these don't change
      to,
      type,
      updatedAt: new Date()
    };
    
    return true;
  }

  /**
   * Delete an edge
   */
  async deleteEdge(
    from: string,
    to: string,
    type?: KnowledgeEdgeType
  ): Promise<boolean> {
    this.ensureInitialized();
    
    const initialLength = this.edges.length;
    
    this.edges = this.edges.filter(edge => {
      if (type) {
        return !(edge.from === from && edge.to === to && edge.type === type);
      }
      return !(edge.from === from && edge.to === to);
    });
    
    return this.edges.length < initialLength;
  }

  /**
   * Clear the graph
   */
  async clear(): Promise<boolean> {
    this.ensureInitialized();
    
    if (this.useQdrant && this.qdrantStore) {
      const success = await this.qdrantStore.clear();
      if (success) {
        // Clear local indices too
        for (const nodeIds of this.nodeTypeIndices.values()) {
          nodeIds.clear();
        }
        this.nodeTagIndices.clear();
      }
      return success;
    } else {
      // Clear in-memory storage
      this.nodes.clear();
      this.edges = [];
      for (const nodeIds of this.nodeTypeIndices.values()) {
        nodeIds.clear();
      }
      this.nodeTagIndices.clear();
      return true;
    }
  }

  /**
   * Get graph visualization data
   */
  getVisualizationData(): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } {
    this.ensureInitialized();
    
    if (this.useQdrant && this.qdrantStore) {
      // For Qdrant, we need to fetch data asynchronously
      // This method should be made async in the future
      console.warn('⚠️ getVisualizationData() with Qdrant requires async operation');
      return { nodes: [], edges: [] };
    } else {
      return {
        nodes: Array.from(this.nodes.values()),
        edges: this.edges
      };
    }
  }

  /**
   * Async version of getVisualizationData for Qdrant compatibility
   */
  async getVisualizationDataAsync(): Promise<{ nodes: KnowledgeNode[]; edges: KnowledgeEdge[] }> {
    this.ensureInitialized();

    if (this.useQdrant && this.qdrantStore) {
      const [nodes, edges] = await Promise.all([
        this.qdrantStore.getAllNodes(),
        this.qdrantStore.getAllEdges()
      ]);
      return { nodes, edges };
    } else {
      return {
        nodes: Array.from(this.nodes.values()),
        edges: this.edges
      };
    }
  }

  /**
   * Shutdown the graph
   */
  async shutdown(): Promise<boolean> {
    if (this.useQdrant && this.qdrantStore) {
      await this.qdrantStore.shutdown();
    }
    this.initialized = false;
    console.log(`✅ DefaultKnowledgeGraph shutdown complete (${this.useQdrant ? 'Qdrant' : 'in-memory'} mode)`);
    return true;
  }

  /**
   * Traverse the graph
   * 
   * @param options Traversal options
   * @returns Promise resolving to traversal result containing nodes and edges
   */
  async traverse(options: KnowledgeGraphTraversalOptions): Promise<{ nodes: KnowledgeNode[]; edges: KnowledgeEdge[] }> {
    this.ensureInitialized();
    
    // Validate start node exists
    const startNode = await this.getNode(options.startNodeId);
    if (!startNode) {
      throw new NodeNotFoundError(options.startNodeId);
    }
    
    // Use defaults if not specified
    const maxDepth = options.maxDepth ?? 3;
    const minStrength = options.minStrength ?? 0;
    const limit = options.limit ?? 100;
    const strategy = options.strategy ?? 'breadth-first';
    const direction = options.direction ?? 'both';
    
    // Nodes and edges we've visited
    const visitedNodeIds = new Set<string>([options.startNodeId]);
    const collectedNodes: KnowledgeNode[] = [startNode];
    const collectedEdges: KnowledgeEdge[] = [];
    
    // For tracking search state
    type QueueItem = {
      nodeId: string;
      depth: number;
      cumulativeStrength: number;
      path: string[];
    };
    
    // Initialize queue with start node
    let queue: QueueItem[] = [
      { 
        nodeId: options.startNodeId, 
        depth: 0, 
        cumulativeStrength: 1, 
        path: [options.startNodeId] 
      }
    ];
    
    // Filter function for edge types
    const matchesEdgeType = (edge: KnowledgeEdge): boolean => {
      return !options.edgeTypes?.length || options.edgeTypes.includes(edge.type);
    };
    
    // Filter function for node types
    const matchesNodeType = (node: KnowledgeNode): boolean => {
      return !options.nodeTypes?.length || options.nodeTypes.includes(node.type);
    };
    
    // Process the queue until it's empty or we've reached the limit
    while (queue.length > 0 && collectedNodes.length < limit) {
      let current: QueueItem;
      
      // Select next node based on traversal strategy
      if (strategy === 'depth-first') {
        current = queue.pop()!;
      } else if (strategy === 'best-first') {
        // Sort by cumulative strength and take the strongest
        queue.sort((a, b) => b.cumulativeStrength - a.cumulativeStrength);
        current = queue.shift()!;
      } else {
        // Default: breadth-first
        current = queue.shift()!;
      }
      
      // Skip if we're beyond max depth
      if (current.depth >= maxDepth) {
        continue;
      }
      
      // Get connected edges based on direction
      const connectedEdges = await this.getEdges(current.nodeId, direction);
      
      // Filter edges by type and strength
      const relevantEdges = connectedEdges.filter(edge => 
        matchesEdgeType(edge) && (edge.strength ?? 1) >= minStrength
      );
      
      // Process each edge and connected node
      for (const edge of relevantEdges) {
        // Determine the target node ID based on traversal direction
        const targetNodeId = edge.from === current.nodeId ? edge.to : edge.from;
        
        // Skip if we've already visited this node
        if (visitedNodeIds.has(targetNodeId)) {
          continue;
        }
        
        // Get the target node
        const targetNode = await this.getNode(targetNodeId);
        if (!targetNode) {
          continue; // Skip if node doesn't exist
        }
        
        // Skip if node type doesn't match
        if (!matchesNodeType(targetNode)) {
          continue;
        }
        
        // Add to visited set to avoid cycles
        visitedNodeIds.add(targetNodeId);
        
        // Collect the node and edge
        collectedNodes.push(targetNode);
        collectedEdges.push(edge);
        
        // Calculate new cumulative strength
        const edgeStrength = edge.strength ?? 1;
        const newCumulativeStrength = current.cumulativeStrength * edgeStrength;
        
        // Add to queue for further exploration
        queue.push({
          nodeId: targetNodeId,
          depth: current.depth + 1,
          cumulativeStrength: newCumulativeStrength,
          path: [...current.path, targetNodeId]
        });
      }
    }
    
    return {
      nodes: collectedNodes,
      edges: collectedEdges
    };
  }

  /**
   * Find paths between nodes
   * 
   * @param options Path finding options
   * @returns Promise resolving to found paths
   */
  async findPaths(options: PathFindingOptions): Promise<KnowledgeGraphPath[]> {
    this.ensureInitialized();
    
    // Validate start and target nodes exist
    const startNode = await this.getNode(options.startNodeId);
    if (!startNode) {
      throw new NodeNotFoundError(options.startNodeId);
    }
    
    const targetNode = await this.getNode(options.targetNodeId);
    if (!targetNode) {
      throw new NodeNotFoundError(options.targetNodeId);
    }
    
    // Use defaults if not specified
    const maxLength = options.maxLength ?? 5;
    const minStrength = options.minStrength ?? 0;
    const maxPaths = options.maxPaths ?? 5;
    const algorithm = options.algorithm ?? 'shortest';
    const direction = options.direction ?? 'both';
    
    // Data structures for path finding
    const paths: KnowledgeGraphPath[] = [];
    
    // For tracking search state
    type PathItem = {
      nodeId: string;
      path: string[];
      edges: KnowledgeEdge[];
      length: number;
      totalStrength: number;
    };
    
    // Queue for breadth-first search
    const queue: PathItem[] = [
      {
        nodeId: options.startNodeId,
        path: [options.startNodeId],
        edges: [],
        length: 0,
        totalStrength: 1
      }
    ];
    
    // Filter function for edge types
    const matchesEdgeType = (edge: KnowledgeEdge): boolean => {
      return !options.edgeTypes?.length || options.edgeTypes.includes(edge.type);
    };
    
    // Process the queue until it's empty or we've found enough paths
    while (queue.length > 0 && paths.length < maxPaths) {
      // Get the next item based on the algorithm
      let current: PathItem;
      
      if (algorithm === 'shortest') {
        // Sort by path length (ascending)
        queue.sort((a, b) => a.length - b.length);
        current = queue.shift()!;
      } else if (algorithm === 'strongest') {
        // Sort by total strength (descending)
        queue.sort((a, b) => b.totalStrength - a.totalStrength);
        current = queue.shift()!;
      } else {
        // All paths - breadth-first for completeness
        current = queue.shift()!;
      }
      
      // If we've reached the target, add this path to the results
      if (current.nodeId === options.targetNodeId) {
        // Only add this path if it's within the maxLength limit
        if (current.length <= maxLength) {
          paths.push({
            id: `path-${paths.length}`,
            edges: current.edges,
            length: current.length,
            totalStrength: current.totalStrength,
            metadata: {
              pathNodes: current.path
            }
          });
        }
        
        // For shortest path algorithm, we can stop after finding the first path
        if (algorithm === 'shortest' && paths.length >= 1) {
          break;
        }
        
        continue;
      }
      
      // Skip if we're beyond or at max path length
      if (current.length >= maxLength) {
        continue;
      }
      
      // Get connected edges based on direction
      const connectedEdges = await this.getEdges(current.nodeId, direction);
      
      // Filter edges by type and strength
      const relevantEdges = connectedEdges.filter(edge => 
        matchesEdgeType(edge) && (edge.strength ?? 1) >= minStrength
      );
      
      // Process each edge and connected node
      for (const edge of relevantEdges) {
        // Determine the target node ID based on traversal direction
        const nextNodeId = edge.from === current.nodeId ? edge.to : edge.from;
        
        // Skip if we've already visited this node in the current path (avoid cycles)
        if (current.path.includes(nextNodeId)) {
          continue;
        }
        
        // Calculate new total strength
        const edgeStrength = edge.strength ?? 1;
        const newTotalStrength = current.totalStrength * edgeStrength;
        
        // Add to queue for further exploration
        queue.push({
          nodeId: nextNodeId,
          path: [...current.path, nextNodeId],
          edges: [...current.edges, edge],
          length: current.length + 1,
          totalStrength: newTotalStrength
        });
      }
    }
    
    // Sort paths based on the algorithm
    if (algorithm === 'shortest') {
      paths.sort((a, b) => a.length - b.length);
    } else if (algorithm === 'strongest') {
      paths.sort((a, b) => b.totalStrength - a.totalStrength);
    }
    
    // Limit to maxPaths
    return paths.slice(0, maxPaths);
  }

  /**
   * Extract knowledge from content
   */
  async extractKnowledge(options: KnowledgeExtractionOptions): Promise<KnowledgeExtractionResult> {
    this.ensureInitialized();
    
    // Use LangGraph workflow if available
    if (this.langGraphKnowledgeExtractionWorkflow) {
      try {
        console.log('🧠 Starting LangGraph knowledge extraction');
        const startTime = Date.now();
        
        const result = await this.langGraphKnowledgeExtractionWorkflow.extractKnowledge(options);
        
        // Add extracted nodes and edges to the graph
        const addedNodes: KnowledgeNode[] = [];
        const addedEdges: KnowledgeEdge[] = [];
        
        // Add nodes
        for (const node of result.nodes) {
          try {
            const nodeId = await this.addNode(node);
            const addedNode = await this.getNode(nodeId);
            if (addedNode) {
              addedNodes.push(addedNode);
            }
          } catch (error) {
            console.warn('Failed to add extracted node:', error);
          }
        }
        
        // Add edges
        for (const edge of result.edges) {
          try {
            await this.addEdge(edge);
            addedEdges.push(edge);
          } catch (error) {
            console.warn('Failed to add extracted edge:', error);
          }
        }
        
        const executionTime = Date.now() - startTime;
        console.log(`✨ LangGraph extraction completed: ${addedNodes.length} nodes, ${addedEdges.length} edges in ${executionTime}ms`);
        
        return {
          nodes: addedNodes,
          edges: addedEdges,
          confidence: result.confidence,
          stats: {
            ...result.stats,
            entityCount: addedNodes.length,
            relationshipCount: addedEdges.length
          }
        };
      } catch (error) {
        console.error('❌ LangGraph knowledge extraction failed:', error);
        // Fall back to legacy extraction
      }
    }
    
    // Legacy extraction workflow
    if (this.knowledgeExtractionWorkflow) {
      try {
        console.log('🔬 Starting legacy knowledge extraction');
        const result = await this.knowledgeExtractionWorkflow.extractKnowledge(options);
        
        // Add extracted nodes and edges to the graph (same logic as above)
        const addedNodes: KnowledgeNode[] = [];
        const addedEdges: KnowledgeEdge[] = [];
        
        for (const node of result.nodes) {
          try {
            const nodeId = await this.addNode(node);
            const addedNode = await this.getNode(nodeId);
            if (addedNode) {
              addedNodes.push(addedNode);
            }
          } catch (error) {
            console.warn('Failed to add extracted node:', error);
          }
        }
        
        for (const edge of result.edges) {
          try {
            await this.addEdge(edge);
            addedEdges.push(edge);
          } catch (error) {
            console.warn('Failed to add extracted edge:', error);
          }
        }
        
        return {
          nodes: addedNodes,
          edges: addedEdges,
          confidence: result.confidence,
          stats: {
            ...result.stats,
            entityCount: addedNodes.length,
            relationshipCount: addedEdges.length
          }
        };
      } catch (error) {
        console.error('❌ Legacy knowledge extraction failed:', error);
      }
    }
    
    // Fallback to basic extractor
    console.log('📝 Using basic knowledge extraction');
    const extractor = new KnowledgeExtractor(this, { autoAddToGraph: false });
    const result = await extractor.extractKnowledge(options);
    
    // If extraction was successful and nodes were found, add them to the graph
    if (result.nodes.length > 0) {
      const addedNodes: KnowledgeNode[] = [];
      const nodeIdMap = new Map<string, string>();
      
      // Add all nodes first
      for (const node of result.nodes) {
        try {
          // If the node has a temporary ID (starting with 'temp_'), we need to create a real node
          if (node.id.startsWith('temp_')) {
            const nodeWithoutId = { ...node };
            delete (nodeWithoutId as any).id;
            
            const newNodeId = await this.addNode(nodeWithoutId);
            const addedNode = await this.getNode(newNodeId);
            
            if (addedNode) {
              addedNodes.push(addedNode);
              nodeIdMap.set(node.id, newNodeId);
            }
          }
        } catch (error) {
          console.error('Error adding extracted node to graph:', error);
        }
      }
      
      // Add all edges, mapping temporary IDs to real IDs
      const addedEdges: KnowledgeEdge[] = [];
      for (const edge of result.edges) {
        try {
          // Handle temporary IDs by mapping to real IDs
          const fromId = edge.from.startsWith('temp_') 
            ? nodeIdMap.get(edge.from)
            : edge.from;
            
          const toId = edge.to.startsWith('temp_')
            ? nodeIdMap.get(edge.to)
            : edge.to;
          
          if (fromId && toId) {
            const edgeToAdd = {
              ...edge,
              from: fromId,
              to: toId
            };
            
            await this.addEdge(edgeToAdd);
            addedEdges.push(edgeToAdd);
          }
        } catch (error) {
          console.error('Error adding extracted edge to graph:', error);
        }
      }
      
      // Return the updated result with actual graph nodes and edges
      return {
        nodes: addedNodes,
        edges: addedEdges,
        confidence: result.confidence,
        stats: {
          ...result.stats,
          entityCount: addedNodes.length,
          relationshipCount: addedEdges.length
        }
      };
    }
    
    return result;
  }

  async generateInsights(options?: GraphIntelligenceOptions): Promise<GraphInsight[]> {
    this.ensureInitialized();
    
    if (this.enhancedIntelligenceService) {
      try {
        console.log('🚀 Starting Enhanced Intelligence insights generation');
        const startTime = Date.now();
        
        const insights = await this.enhancedIntelligenceService.generateAdvancedInsights(options);
        
        const executionTime = Date.now() - startTime;
        console.log(`✨ Enhanced Intelligence completed: ${insights.length} insights generated in ${executionTime}ms`);
        
        return [...insights]; // Convert from readonly array
      } catch (error) {
        console.error('❌ Enhanced Intelligence insights generation failed:', error);
        // Fallback to basic implementation
        return [];
      }
    } else {
      console.log('📝 Enhanced Intelligence Service not available, returning basic insights');
      return [];
    }
  }

  async inferEdges(options: InferenceOptions): Promise<InferredEdge[]> {
    this.ensureInitialized();
    
    // Use LangGraph workflow if available
    if (this.langGraphRelationshipInferenceWorkflow) {
      try {
        console.log(`🧠 Starting LangGraph relationship inference for node: ${options.nodeId}`);
        const startTime = Date.now();
        
        const inferredEdges = await this.langGraphRelationshipInferenceWorkflow.inferRelationships(options);
        
        // Add inferred edges to the graph
        const addedEdges: InferredEdge[] = [];
        for (const edge of inferredEdges) {
          try {
            await this.addEdge(edge);
            addedEdges.push(edge);
            console.log(`✨ Added inferred relationship: ${edge.from} → ${edge.to} (confidence: ${edge.inferenceConfidence?.toFixed(2)})`);
          } catch (error) {
            console.warn(`⚠️ Failed to add inferred edge: ${edge.from} → ${edge.to}`, error);
          }
        }
        
        const executionTime = Date.now() - startTime;
        console.log(`🎯 LangGraph inference completed: ${addedEdges.length}/${inferredEdges.length} edges added in ${executionTime}ms`);
        
        return addedEdges;
      } catch (error) {
        console.error('❌ LangGraph relationship inference failed:', error);
        // Fall back to legacy workflow
      }
    }
    
    // Legacy workflow
    if (this.relationshipInferenceWorkflow) {
      try {
        console.log(`🔬 Starting legacy relationship inference for node: ${options.nodeId}`);
        const startTime = Date.now();
        
        const inferredEdges = await this.relationshipInferenceWorkflow.inferRelationships(options);
        
        // Add inferred edges to the graph
        const addedEdges: InferredEdge[] = [];
        for (const edge of inferredEdges) {
          try {
            await this.addEdge(edge);
            addedEdges.push(edge);
            console.log(`✨ Added inferred relationship: ${edge.from} → ${edge.to} (confidence: ${edge.inferenceConfidence?.toFixed(2)})`);
          } catch (error) {
            console.warn(`⚠️ Failed to add inferred edge: ${edge.from} → ${edge.to}`, error);
          }
        }
        
        const executionTime = Date.now() - startTime;
        console.log(`🎯 Legacy inference completed: ${addedEdges.length}/${inferredEdges.length} edges added in ${executionTime}ms`);
        
        return addedEdges;
      } catch (error) {
        console.error('❌ Legacy relationship inference failed:', error);
        // Fall back to basic implementation
      }
    }
    
    // Fallback to basic implementation
    console.log('📝 Using basic relationship inference');
    return this.basicInferEdges(options);
  }

  /**
   * Basic fallback relationship inference
   */
  private async basicInferEdges(options: InferenceOptions): Promise<InferredEdge[]> {
    const sourceNode = await this.getNode(options.nodeId);
    if (!sourceNode) {
      return [];
    }

    const inferredEdges: InferredEdge[] = [];
    const minConfidence = options.minConfidence || 0.5;
    const maxInferences = options.maxInferences || 5;

    // Find nodes with similar tags
    if (sourceNode.tags && sourceNode.tags.length > 0) {
      const candidates = await this.findNodes('', {
        includeTags: sourceNode.tags,
        nodeTypes: options.relationshipTypes ? undefined : undefined,
        limit: maxInferences * 2
      });

      for (const candidate of candidates) {
        if (candidate.id === sourceNode.id) continue;

        // Calculate simple tag-based similarity
        const commonTags = sourceNode.tags?.filter(tag => 
          candidate.tags?.includes(tag)
        ) || [];
        
        const confidence = Math.min(0.8, commonTags.length * 0.3 + 0.4);
        
        if (confidence >= minConfidence && inferredEdges.length < maxInferences) {
          const inferredEdge: InferredEdge = {
            from: sourceNode.id,
            to: candidate.id,
            type: KnowledgeEdgeType.RELATED_TO,
            label: 'Similar content',
            strength: confidence,
            inferenceConfidence: confidence,
            inferenceMethod: 'tag_similarity',
            reasoning: `Shared tags: ${commonTags.join(', ')}`,
            metadata: {
              commonTags,
              inferredAt: new Date().toISOString()
            }
          };

          inferredEdges.push(inferredEdge);
        }
      }
    }

    return inferredEdges;
  }

  async getStats(): Promise<KnowledgeGraphStats> {
    this.ensureInitialized();
    
    if (this.useQdrant && this.qdrantStore) {
      const qdrantStats = await this.qdrantStore.getStats();
      
      // Convert to our stats format
      const nodeTypes = Object.values(KnowledgeNodeType).reduce((acc, type) => {
        acc[type] = this.nodeTypeIndices.get(type)?.size || 0;
        return acc;
      }, {} as Record<KnowledgeNodeType, number>);
      
      const edgeTypes = Object.values(KnowledgeEdgeType).reduce((acc, type) => {
        acc[type] = 0; // Would need to query Qdrant for exact counts
        return acc;
      }, {} as Record<KnowledgeEdgeType, number>);

      return {
        totalNodes: qdrantStats.nodeCount,
        totalEdges: qdrantStats.edgeCount,
        nodeTypes,
        edgeTypes,
        density: qdrantStats.nodeCount > 0 ? qdrantStats.edgeCount / (qdrantStats.nodeCount * (qdrantStats.nodeCount - 1)) : 0,
        averageDegree: qdrantStats.nodeCount > 0 ? (qdrantStats.edgeCount * 2) / qdrantStats.nodeCount : 0,
        mostConnectedNodes: [] // Would need more complex query
      };
    } else {
      // In-memory stats (existing implementation)
      const nodeTypes = Object.values(KnowledgeNodeType).reduce((acc, type) => {
        acc[type] = this.nodeTypeIndices.get(type)?.size || 0;
        return acc;
      }, {} as Record<KnowledgeNodeType, number>);
      
      const edgeTypes = Object.values(KnowledgeEdgeType).reduce((acc, type) => {
        acc[type] = this.edges.filter(edge => edge.type === type).length;
        return acc;
      }, {} as Record<KnowledgeEdgeType, number>);
      
      const nodeDegrees = new Map<string, number>();
      for (const nodeId of Array.from(this.nodes.keys())) {
        const edges = this.edges.filter(edge => edge.from === nodeId || edge.to === nodeId);
        nodeDegrees.set(nodeId, edges.length);
      }
      
      const mostConnectedNodes = Array.from(nodeDegrees.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, connections]) => {
          const node = this.nodes.get(id)!;
          return {
            id,
            label: node.label,
            connections
          };
        });
      
      const totalNodes = this.nodes.size;
      const totalDegrees = Array.from(nodeDegrees.values()).reduce((sum, degree) => sum + degree, 0);
      const averageDegree = totalNodes > 0 ? totalDegrees / totalNodes : 0;
      
      const maxPossibleEdges = totalNodes * (totalNodes - 1);
      const density = maxPossibleEdges > 0 ? this.edges.length / maxPossibleEdges : 0;
      
      return {
        totalNodes,
        totalEdges: this.edges.length,
        nodeTypes,
        edgeTypes,
        density,
        averageDegree,
        mostConnectedNodes
      };
    }
  }

  async buildGraph(options: any): Promise<{ nodesAdded: number; edgesAdded: number; buildTimeMs: number }> {
    this.ensureInitialized();
    // Basic implementation - will be enhanced in future iterations
    return { nodesAdded: 0, edgesAdded: 0, buildTimeMs: 0 };
  }

  async getGraphContext(topic: string, options?: any): Promise<string> {
    this.ensureInitialized();
    // Basic implementation - will be enhanced in future iterations
    return '';
  }

  /**
   * Build graph from memory entries and tasks (compatibility method)
   */
  async buildGraphFromMemory(
    memories: Array<{ id: string; content: string; metadata?: any }> = [],
    tasks: Array<{ id: string; goal: string; subGoals?: any[]; status: string }> = []
  ): Promise<void> {
    this.ensureInitialized();

    try {
      // Add task nodes
      for (const task of tasks) {
        const taskNodeId = await this.addNode({
          label: task.goal,
          type: KnowledgeNodeType.TASK,
          description: task.goal,
          metadata: {
            originalId: task.id,
            status: task.status,
            subGoals: task.subGoals
          }
        });

        // Add task nodes for sub-goals
        if (task.subGoals) {
          for (const subGoal of task.subGoals) {
            const subTaskNodeId = await this.addNode({
              label: subGoal.goal,
              type: KnowledgeNodeType.TASK,
              description: subGoal.goal,
              metadata: {
                originalId: subGoal.id,
                parentId: task.id,
                status: subGoal.status
              }
            });

            // Connect sub-task to parent task
            await this.addEdge({
              from: taskNodeId,
              to: subTaskNodeId,
              type: KnowledgeEdgeType.DEPENDS_ON,
              label: 'Sub-task'
            });
          }
        }
      }

      // Add memory nodes
      for (const memory of memories) {
        const memoryNodeId = await this.addNode({
          label: memory.content.substring(0, 100),
          type: KnowledgeNodeType.CONCEPT,
          description: memory.content,
          metadata: {
            originalId: memory.id,
            ...memory.metadata
          }
        });

        // Connect memory to related tasks based on content similarity
        for (const task of tasks) {
          // Simple keyword-based relevance check
          const taskKeywords = task.goal.toLowerCase().split(/\s+/);
          const memoryText = memory.content.toLowerCase();
          const hasRelevantKeywords = taskKeywords.some(keyword => 
            keyword.length > 3 && memoryText.includes(keyword)
          );

          if (hasRelevantKeywords) {
            // Find the task node and connect
            const taskNodes = await this.findNodes(task.goal, { 
              nodeTypes: [KnowledgeNodeType.TASK],
              limit: 1 
            });
            
            if (taskNodes.length > 0) {
              await this.addEdge({
                from: memoryNodeId,
                to: taskNodes[0].id,
                type: KnowledgeEdgeType.RELATED_TO,
                label: 'Task memory',
                strength: 0.7
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error building graph from memory:', error);
      throw error;
    }
  }

  /**
   * Inject graph context into a planning prompt (compatibility method)
   */
  async injectGraphContextIntoPlan(goal: string, maxNodes: number = 5): Promise<string> {
    this.ensureInitialized();

    try {
      // Search for nodes related to the goal
      const relatedNodes = await this.findNodes(goal, {
        limit: maxNodes,
        nodeTypes: [KnowledgeNodeType.CONCEPT, KnowledgeNodeType.TASK, KnowledgeNodeType.INSIGHT]
      });

      if (relatedNodes.length === 0) {
        return '';
      }

      // Format context
      const contextParts = [
        '## Related Knowledge from Knowledge Graph',
        ...relatedNodes.map(node => 
          `- ${node.label} (${node.type}): ${node.description || 'No description'}`)
      ];

      return contextParts.join('\n');
    } catch (error) {
      console.error('Error injecting graph context into plan:', error);
      return '';
    }
  }

  /**
   * Get graph visualization data (compatibility method)
   */
  getGraphVisualizationData(): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } {
    return this.getVisualizationData();
  }

  /**
   * Node connections compatibility property
   * Returns a Map of node connections for backward compatibility
   */
  get nodeConnections(): Map<string, Set<string>> {
    const connections = new Map<string, Set<string>>();
    
    // Build connections map from edges
    for (const edge of this.edges) {
      if (!connections.has(edge.from)) {
        connections.set(edge.from, new Set());
      }
      if (!connections.has(edge.to)) {
        connections.set(edge.to, new Set());
      }
      
      connections.get(edge.from)!.add(edge.to);
      connections.get(edge.to)!.add(edge.from);
    }
    
    return connections;
  }

  /**
   * Calculate relevance score for a node against a query (compatibility method)
   */
  calculateRelevanceScore(node: KnowledgeNode, query: string): number {
    const lowerQuery = query.toLowerCase();
    const lowerLabel = node.label.toLowerCase();
    const lowerDescription = (node.description || '').toLowerCase();
    
    let score = 0;
    
    // Exact label match gets highest score
    if (lowerLabel === lowerQuery) {
      score += 10;
    } else if (lowerLabel.includes(lowerQuery)) {
      score += 5;
    }
    
    // Description match
    if (lowerDescription.includes(lowerQuery)) {
      score += 3;
    }
    
    // Tag match
    if (node.tags) {
      for (const tag of node.tags) {
        if (tag.toLowerCase().includes(lowerQuery)) {
          score += 2;
        }
      }
    }
    
    // Word-level matching
    const queryWords = lowerQuery.split(/\s+/).filter(word => word.length > 2);
    for (const word of queryWords) {
      if (lowerLabel.includes(word)) score += 1;
      if (lowerDescription.includes(word)) score += 0.5;
    }
    
    return score;
  }
} 