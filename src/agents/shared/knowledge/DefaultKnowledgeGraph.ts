/**
 * DefaultKnowledgeGraph
 * 
 * Default implementation of the KnowledgeGraph interface.
 * This implementation provides a memory-based knowledge graph with core operations.
 */

import { v4 as uuidv4 } from 'uuid';
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

/**
 * Default implementation of KnowledgeGraph interface
 */
export class DefaultKnowledgeGraph implements KnowledgeGraph {
  private nodes: Map<string, KnowledgeNode> = new Map();
  private edges: KnowledgeEdge[] = [];
  private initialized: boolean = false;
  private nodeTypeIndices: Map<KnowledgeNodeType, Set<string>> = new Map();
  private nodeTagIndices: Map<string, Set<string>> = new Map();

  /**
   * Initialize the knowledge graph
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    // Initialize all node type indices
    Object.values(KnowledgeNodeType).forEach(type => {
      this.nodeTypeIndices.set(type, new Set<string>());
    });
    
    this.initialized = true;
    return true;
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
    
    const now = new Date();
    const id = uuidv4();
    
    const newNode: KnowledgeNode = {
      ...node,
      id,
      createdAt: node.createdAt || now,
      updatedAt: now
    };
    
    this.nodes.set(id, newNode);
    
    // Update indices
    const typeIndex = this.nodeTypeIndices.get(newNode.type);
    if (typeIndex) {
      typeIndex.add(id);
    }
    
    if (newNode.tags) {
      newNode.tags.forEach(tag => {
        if (!this.nodeTagIndices.has(tag)) {
          this.nodeTagIndices.set(tag, new Set<string>());
        }
        this.nodeTagIndices.get(tag)?.add(id);
      });
    }
    
    return id;
  }

  /**
   * Get a node by ID
   */
  async getNode(id: string): Promise<KnowledgeNode | null> {
    this.ensureInitialized();
    return this.nodes.get(id) || null;
  }

  /**
   * Find nodes matching a query
   */
  async findNodes(query: string, options?: KnowledgeGraphSearchOptions): Promise<KnowledgeNode[]> {
    this.ensureInitialized();
    
    const normalizedQuery = query.toLowerCase();
    let nodes = Array.from(this.nodes.values());
    
    // Filter by type if specified
    if (options?.nodeTypes?.length) {
      nodes = nodes.filter(node => options.nodeTypes!.includes(node.type));
    }
    
    // Filter by tags if specified
    if (options?.includeTags?.length) {
      nodes = nodes.filter(node => 
        node.tags?.some(tag => options.includeTags!.includes(tag))
      );
    }
    
    if (options?.excludeTags?.length) {
      nodes = nodes.filter(node => 
        !node.tags?.some(tag => options.excludeTags!.includes(tag))
      );
    }
    
    // Filter by importance
    if (options?.minImportance !== undefined) {
      nodes = nodes.filter(node => 
        (node.importance || 0) >= (options.minImportance || 0)
      );
    }
    
    // Filter by confidence
    if (options?.minConfidence !== undefined) {
      nodes = nodes.filter(node => 
        (node.confidence || 0) >= (options.minConfidence || 0)
      );
    }
    
    // Search in relevant fields
    nodes = nodes.filter(node => {
      const searchFields = options?.searchFields || ['label', 'description', 'tags'];
      
      return searchFields.some(field => {
        switch (field) {
          case 'label':
            return node.label.toLowerCase().includes(normalizedQuery);
          case 'description':
            return node.description?.toLowerCase().includes(normalizedQuery);
          case 'tags':
            return node.tags?.some(tag => tag.toLowerCase().includes(normalizedQuery));
          case 'properties':
            return Object.values(node.properties || {}).some(
              value => String(value).toLowerCase().includes(normalizedQuery)
            );
          default:
            return false;
        }
      });
    });
    
    // Apply limit and offset
    if (options?.offset !== undefined && options?.limit !== undefined) {
      nodes = nodes.slice(options.offset, options.offset + options.limit);
    } else if (options?.limit !== undefined) {
      nodes = nodes.slice(0, options.limit);
    }
    
    return nodes;
  }

  /**
   * Update a node
   */
  async updateNode(id: string, updates: Partial<KnowledgeNode>): Promise<boolean> {
    this.ensureInitialized();
    
    const node = this.nodes.get(id);
    if (!node) {
      return false;
    }
    
    // Update tag indices if tags are being updated
    if (updates.tags && node.tags) {
      // Remove old tag associations
      node.tags.forEach(tag => {
        const tagIndex = this.nodeTagIndices.get(tag);
        if (tagIndex) {
          tagIndex.delete(id);
        }
      });
      
      // Add new tag associations
      updates.tags.forEach(tag => {
        if (!this.nodeTagIndices.has(tag)) {
          this.nodeTagIndices.set(tag, new Set<string>());
        }
        this.nodeTagIndices.get(tag)?.add(id);
      });
    }
    
    // Update type index if type is being updated
    if (updates.type && updates.type !== node.type) {
      // Remove from old type index
      const oldTypeIndex = this.nodeTypeIndices.get(node.type);
      if (oldTypeIndex) {
        oldTypeIndex.delete(id);
      }
      
      // Add to new type index
      const newTypeIndex = this.nodeTypeIndices.get(updates.type);
      if (newTypeIndex) {
        newTypeIndex.add(id);
      }
    }
    
    // Add a small delay to ensure updatedAt is definitely different from createdAt
    await new Promise(resolve => setTimeout(resolve, 5));
    
    // Create updated node
    const updatedNode: KnowledgeNode = {
      ...node,
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: new Date() // Force a new Date instance
    };
    
    this.nodes.set(id, updatedNode);
    return true;
  }

  /**
   * Delete a node
   */
  async deleteNode(id: string): Promise<boolean> {
    this.ensureInitialized();
    
    const node = this.nodes.get(id);
    if (!node) {
      return false;
    }
    
    // Remove from type index
    const typeIndex = this.nodeTypeIndices.get(node.type);
    if (typeIndex) {
      typeIndex.delete(id);
    }
    
    // Remove from tag indices
    if (node.tags) {
      node.tags.forEach(tag => {
        const tagIndex = this.nodeTagIndices.get(tag);
        if (tagIndex) {
          tagIndex.delete(id);
        }
      });
    }
    
    // Remove connected edges
    this.edges = this.edges.filter(edge => 
      edge.from !== id && edge.to !== id
    );
    
    // Remove the node
    this.nodes.delete(id);
    return true;
  }

  /**
   * Add an edge to the graph
   */
  async addEdge(edge: KnowledgeEdge): Promise<string> {
    this.ensureInitialized();
    
    // Check if nodes exist
    if (!this.nodes.has(edge.from)) {
      throw new NodeNotFoundError(edge.from);
    }
    
    if (!this.nodes.has(edge.to)) {
      throw new NodeNotFoundError(edge.to);
    }
    
    // Check if edge already exists
    const existingEdge = this.edges.find(e => 
      e.from === edge.from && e.to === edge.to && e.type === edge.type
    );
    
    if (existingEdge) {
      return `${edge.from}-${edge.to}-${edge.type}`;
    }
    
    const now = new Date();
    const newEdge: KnowledgeEdge = {
      ...edge,
      createdAt: edge.createdAt || now,
      updatedAt: now
    };
    
    this.edges.push(newEdge);
    return `${edge.from}-${edge.to}-${edge.type}`;
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
    
    if (!this.nodes.has(nodeId)) {
      throw new NodeNotFoundError(nodeId);
    }
    
    return this.edges.filter(edge => {
      // Filter by node and direction
      const matchesNode = (direction === 'outgoing' && edge.from === nodeId) ||
                          (direction === 'incoming' && edge.to === nodeId) ||
                          (direction === 'both' && (edge.from === nodeId || edge.to === nodeId));
      
      // Filter by type if specified
      const matchesType = !types?.length || types.includes(edge.type);
      
      return matchesNode && matchesType;
    });
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
    
    this.nodes.clear();
    this.edges = [];
    
    // Reset indices
    Object.values(KnowledgeNodeType).forEach(type => {
      this.nodeTypeIndices.set(type, new Set<string>());
    });
    
    this.nodeTagIndices.clear();
    
    return true;
  }

  /**
   * Get graph visualization data
   */
  getVisualizationData(): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } {
    this.ensureInitialized();
    
    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges
    };
  }

  /**
   * Shutdown the graph
   */
  async shutdown(): Promise<boolean> {
    if (!this.initialized) {
      return true;
    }
    
    // Perform cleanup
    this.nodes.clear();
    this.edges = [];
    this.nodeTypeIndices.clear();
    this.nodeTagIndices.clear();
    
    this.initialized = false;
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
    
    // Create an extractor instance with auto-add disabled (we'll handle adding ourselves)
    const extractor = new KnowledgeExtractor(this, { autoAddToGraph: false });
    
    // Use the extractor to analyze the content
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
    // Basic implementation - will be enhanced in future iterations
    return [];
  }

  async inferEdges(options: InferenceOptions): Promise<InferredEdge[]> {
    this.ensureInitialized();
    // Basic implementation - will be enhanced in future iterations
    return [];
  }

  async getStats(): Promise<KnowledgeGraphStats> {
    this.ensureInitialized();
    
    // Count nodes by type
    const nodeTypes = Object.values(KnowledgeNodeType).reduce((acc, type) => {
      acc[type] = this.nodeTypeIndices.get(type)?.size || 0;
      return acc;
    }, {} as Record<KnowledgeNodeType, number>);
    
    // Count edges by type
    const edgeTypes = Object.values(KnowledgeEdgeType).reduce((acc, type) => {
      acc[type] = this.edges.filter(edge => edge.type === type).length;
      return acc;
    }, {} as Record<KnowledgeEdgeType, number>);
    
    // Calculate node degrees
    const nodeDegrees = new Map<string, number>();
    for (const nodeId of Array.from(this.nodes.keys())) {
      const edges = this.edges.filter(edge => edge.from === nodeId || edge.to === nodeId);
      nodeDegrees.set(nodeId, edges.length);
    }
    
    // Find most connected nodes
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
    
    // Calculate average degree
    const totalNodes = this.nodes.size;
    const totalDegrees = Array.from(nodeDegrees.values()).reduce((sum, degree) => sum + degree, 0);
    const averageDegree = totalNodes > 0 ? totalDegrees / totalNodes : 0;
    
    // Calculate density
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
} 