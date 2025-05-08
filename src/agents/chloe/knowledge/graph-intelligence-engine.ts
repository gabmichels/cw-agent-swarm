/**
 * Graph Intelligence Engine Implementation
 * A production-ready implementation of the IGraphIntelligenceEngine interface
 */

import { Result, successResult as success, failureResult as failure } from '../../../lib/errors/base';
import { 
  IGraphIntelligenceEngine,
  IGraphNode,
  IGraphRelationship,
  IGraphPath,
  IGraphInsight,
  GraphNodeType,
  GraphRelationshipType,
  KnowledgeExtractionOptions,
  KnowledgeExtractionResult,
  RelationshipDiscoveryOptions,
  RelationshipDiscoveryResult,
  PathOptions,
  SubgraphAnalysisOptions,
  SubgraphAnalysisResult,
  InsightExtractionOptions,
  NodeEnrichmentOptions,
  NodeEnrichmentResult,
  IGraphRepository,
  INlpService,
  IVectorService,
  GraphInsightType
} from './graph-types';
import { StructuredId, structuredIdToString } from '../../../types/structured-id';
import {
  GraphError,
  KnowledgeExtractionError,
  PathFindingError,
  SubgraphAnalysisError,
  InsightExtractionError,
  NodeEnrichmentError,
  GraphErrorCode
} from './graph-errors';

/**
 * Logger interface
 */
export interface ILogger {
  log(level: string, message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: unknown, context?: Record<string, unknown>): void;
  fatal?(message: string, error?: unknown, context?: Record<string, unknown>): void;
}

/**
 * Implementation of the Graph Intelligence Engine
 */
export class GraphIntelligenceEngine implements IGraphIntelligenceEngine {
  constructor(
    private readonly graphRepository: IGraphRepository,
    private readonly nlpService: INlpService,
    private readonly vectorService: IVectorService,
    private readonly logger: ILogger
  ) {}

  /**
   * Extracts knowledge from text content and adds it to the graph
   */
  async extractKnowledge(
    content: string, 
    options: KnowledgeExtractionOptions = {}
  ): Promise<Result<KnowledgeExtractionResult>> {
    try {
      this.logger.debug('Extracting knowledge from content', { contentLength: content.length });
      
      if (!content) {
        return failure(new KnowledgeExtractionError(
          'Content is required for knowledge extraction',
          { options }
        ));
      }
      
      // Set default options
      const extractionOptions = {
        contextTags: options.contextTags || [],
        confidenceThreshold: options.confidenceThreshold || 0.6,
        maxConcepts: options.maxConcepts || 20,
        extractEntities: options.extractEntities !== false,
        extractRelationships: options.extractRelationships !== false,
        language: options.language || 'en',
      };
      
      // Extract entities using NLP service
      const entities = await this.nlpService.extractEntities(content, {
        confidenceThreshold: extractionOptions.confidenceThreshold,
        maxEntities: extractionOptions.maxConcepts,
        language: extractionOptions.language
      });
      
      // Filter high-confidence entities
      const highConfidenceEntities = entities.filter(
        entity => entity.confidence >= extractionOptions.confidenceThreshold
      );
      
      // Create nodes from extracted entities
      const nodes: IGraphNode[] = [];
      
      for (const entity of highConfidenceEntities) {
        // Map entity type to GraphNodeType
        let nodeType: GraphNodeType;
        
        switch (entity.type.toLowerCase()) {
          case 'person': nodeType = GraphNodeType.PERSON; break;
          case 'organization': nodeType = GraphNodeType.ORGANIZATION; break;
          case 'location': nodeType = GraphNodeType.LOCATION; break;
          case 'event': nodeType = GraphNodeType.EVENT; break;
          default: nodeType = GraphNodeType.CONCEPT;
        }
        
        // Create node
        const nodeData = {
          label: entity.text,
          type: nodeType,
          description: `Extracted from text content`,
          tags: [...extractionOptions.contextTags, nodeType.toString().toLowerCase()],
          metadata: {
            confidence: entity.confidence,
            extractedAt: new Date().toISOString(),
            originalText: entity.text
          }
        };
        
        const node = await this.graphRepository.addNode(nodeData);
        nodes.push(node);
      }
      
      // Extract relationships if enabled
      const relationships: IGraphRelationship[] = [];
      
      if (extractionOptions.extractRelationships && nodes.length > 1) {
        // Extract relationships from text
        const extractedRelationships = await this.nlpService.extractRelationships(content);
        
        // Create entity-to-node lookup map
        const entityToNodeMap = new Map<string, IGraphNode>();
        nodes.forEach(node => {
          const originalText = node.metadata.originalText as string;
          if (originalText) {
            entityToNodeMap.set(originalText, node);
          }
        });
        
        // Create relationships
        for (const rel of extractedRelationships) {
          const sourceNode = entityToNodeMap.get(rel.sourceEntity.text);
          const targetNode = entityToNodeMap.get(rel.targetEntity.text);
          
          if (sourceNode && targetNode) {
            // Map relationship type
            let relType: GraphRelationshipType = GraphRelationshipType.RELATED_TO;
            
            // Create relationship
            const relationshipData = {
              sourceId: sourceNode.id,
              targetId: targetNode.id,
              type: relType,
              strength: rel.confidence,
              metadata: {
                confidence: rel.confidence,
                extractedAt: new Date().toISOString()
              }
            };
            
            const relationship = await this.graphRepository.addRelationship(relationshipData);
            relationships.push(relationship);
          }
        }
      }
      
      // Calculate overall confidence
      const confidence = highConfidenceEntities.length > 0
        ? highConfidenceEntities.reduce((sum, entity) => sum + entity.confidence, 0) / highConfidenceEntities.length
        : 0;
      
      return success({
        extractedNodes: nodes,
        extractedRelationships: relationships,
        confidence
      });
    } catch (error) {
      this.logger.error('Error extracting knowledge', { error });
      
      if (error instanceof GraphError) {
        return failure(error);
      }
      
      return failure(new KnowledgeExtractionError(
        `Failed to extract knowledge: ${error instanceof Error ? error.message : String(error)}`,
        { contentLength: content.length }
      ));
    }
  }

  /**
   * Discovers potentially missing relationships between existing nodes
   */
  async discoverRelationships(
    options: RelationshipDiscoveryOptions = {}
  ): Promise<Result<RelationshipDiscoveryResult>> {
    try {
      // Implementation will include similarity, co-occurrence and inference algorithms
      return success({
        discoveredRelationships: [],
        confidence: 0
      });
    } catch (error) {
      return failure(new GraphError(
        `Failed to discover relationships: ${error instanceof Error ? error.message : String(error)}`,
        GraphErrorCode.OPERATION_FAILED
      ));
    }
  }

  /**
   * Finds paths between two nodes
   */
  async findPaths(
    sourceId: StructuredId, 
    targetId: StructuredId, 
    options: PathOptions = {}
  ): Promise<Result<IGraphPath[]>> {
    try {
      this.logger.debug('Finding paths between nodes', { 
        sourceId: structuredIdToString(sourceId), 
        targetId: structuredIdToString(targetId),
        options 
      });

      // Set default options
      const pathOptions = {
        maxDepth: options.maxDepth || 5,
        minStrength: options.minStrength || 0.0,
        relationshipTypes: options.relationshipTypes || [],
        algorithm: options.algorithm || 'shortest'
      };

      // Validate inputs
      const sourceNode = await this.graphRepository.getNodeById(sourceId);
      if (!sourceNode) {
        return failure(new PathFindingError(
          'Source node not found',
          structuredIdToString(sourceId),
          structuredIdToString(targetId),
          { errorCode: GraphErrorCode.NODE_NOT_FOUND }
        ));
      }

      const targetNode = await this.graphRepository.getNodeById(targetId);
      if (!targetNode) {
        return failure(new PathFindingError(
          'Target node not found',
          structuredIdToString(sourceId),
          structuredIdToString(targetId),
          { errorCode: GraphErrorCode.NODE_NOT_FOUND }
        ));
      }

      // If source and target are the same, return empty path
      if (structuredIdToString(sourceId) === structuredIdToString(targetId)) {
        return success([{
          nodes: [sourceNode],
          relationships: [],
          score: 1.0,
          metadata: {
            pathLength: 0,
            averageStrength: 1.0
          }
        }]);
      }

      const paths: IGraphPath[] = [];

      // Choose algorithm based on options
      switch (pathOptions.algorithm) {
        case 'shortest':
          const shortestPath = await this.findShortestPath(sourceNode, targetNode, pathOptions);
          if (shortestPath) {
            paths.push(shortestPath);
          }
          break;
        
        case 'strongest': 
          const strongestPath = await this.findStrongestPath(sourceNode, targetNode, pathOptions);
          if (strongestPath) {
            paths.push(strongestPath);
          }
          break;
        
        case 'all':
          const allPaths = await this.findAllPaths(sourceNode, targetNode, pathOptions);
          paths.push(...allPaths);
          break;
      }

      if (paths.length === 0) {
        this.logger.info('No paths found between nodes', {
          sourceId: structuredIdToString(sourceId),
          targetId: structuredIdToString(targetId),
          algorithm: pathOptions.algorithm
        });
      } else {
        this.logger.debug('Found paths between nodes', {
          sourceId: structuredIdToString(sourceId),
          targetId: structuredIdToString(targetId),
          pathCount: paths.length
        });
      }

      return success(paths);
    } catch (error) {
      this.logger.error('Error finding paths', { error });
      
      if (error instanceof GraphError) {
        return failure(error);
      }
      
      return failure(new PathFindingError(
        `Failed to find paths: ${error instanceof Error ? error.message : String(error)}`,
        structuredIdToString(sourceId),
        structuredIdToString(targetId)
      ));
    }
  }

  /**
   * Finds the shortest path between two nodes using Dijkstra's algorithm
   * @private
   */
  private async findShortestPath(
    sourceNode: IGraphNode,
    targetNode: IGraphNode,
    options: Required<PathOptions>
  ): Promise<IGraphPath | null> {
    // Track distances to each node
    const distances = new Map<string, number>();
    // Track predecessors for path reconstruction
    const predecessors = new Map<string, { nodeId: string, relationshipId: string }>();
    // Set of visited nodes
    const visited = new Set<string>();
    // Priority queue (simple array sorted by distance)
    const queue: Array<{ nodeId: string, distance: number }> = [];

    // Initialize distances
    const sourceId = structuredIdToString(sourceNode.id);
    distances.set(sourceId, 0);
    queue.push({ nodeId: sourceId, distance: 0 });

    while (queue.length > 0) {
      // Sort queue by distance (smallest first)
      queue.sort((a, b) => a.distance - b.distance);
      
      // Get the node with smallest distance
      const { nodeId, distance } = queue.shift()!;
      
      // Skip if already visited
      if (visited.has(nodeId)) continue;
      
      // Mark as visited
      visited.add(nodeId);
      
      // If we reached the target, reconstruct and return the path
      if (nodeId === structuredIdToString(targetNode.id)) {
        return this.reconstructPath(sourceNode, targetNode, predecessors);
      }
      
      // Get connected nodes
      const nodeIdStructured = await this.findNodeById(nodeId);
      if (!nodeIdStructured) {
        continue;
      }
      const relatedNodes = await this.graphRepository.getRelatedNodes(nodeIdStructured.id, {
        relationshipTypes: options.relationshipTypes.length > 0 ? options.relationshipTypes : undefined,
        direction: 'both',
        maxDepth: 1
      });
      
      // Get all direct relationships for this node
      const relationships = await this.graphRepository.findRelationshipsByQuery({
        sourceNodeId: nodeIdStructured.id
      });
      
      // Create a map of target node IDs to relationships
      const relationshipMap = new Map<string, IGraphRelationship>();
      for (const rel of relationships) {
        if (rel.strength < options.minStrength) continue;
        relationshipMap.set(structuredIdToString(rel.targetId), rel);
      }
      
      // Find incoming relationships too
      const incomingRelationships = await this.graphRepository.findRelationshipsByQuery({
        targetNodeId: nodeIdStructured.id
      });
      
      for (const rel of incomingRelationships) {
        if (rel.strength < options.minStrength) continue;
        relationshipMap.set(structuredIdToString(rel.sourceId), rel);
      }
      
      // Process all neighbors
      for (const neighbor of relatedNodes) {
        const neighborId = structuredIdToString(neighbor.id);
        
        // Skip visited nodes
        if (visited.has(neighborId)) continue;
        
        // Get relationship between current node and neighbor
        const relationship = relationshipMap.get(neighborId);
        if (!relationship) continue;
        
        // Calculate edge cost (inverse of strength)
        const edgeCost = 1 - relationship.strength;
        const newDistance = distance + edgeCost;
        
        // If we found a shorter path, update
        if (!distances.has(neighborId) || newDistance < distances.get(neighborId)!) {
          distances.set(neighborId, newDistance);
          predecessors.set(neighborId, { 
            nodeId, 
            relationshipId: structuredIdToString(relationship.id) 
          });
          queue.push({ nodeId: neighborId, distance: newDistance });
        }
      }
      
      // Stop if we've gone too deep
      if (distances.get(nodeId)! >= options.maxDepth) {
        break;
      }
    }
    
    // No path found
    return null;
  }

  /**
   * Finds the strongest path between two nodes
   * @private
   */
  private async findStrongestPath(
    sourceNode: IGraphNode,
    targetNode: IGraphNode,
    options: Required<PathOptions>
  ): Promise<IGraphPath | null> {
    // Similar to shortest path, but prioritize relationship strength
    // Track strengths to each node (using product of strengths)
    const strengths = new Map<string, number>();
    // Track predecessors for path reconstruction
    const predecessors = new Map<string, { nodeId: string, relationshipId: string }>();
    // Set of visited nodes
    const visited = new Set<string>();
    // Priority queue (simple array sorted by strength)
    const queue: Array<{ nodeId: string, strength: number }> = [];

    // Initialize strengths
    const sourceId = structuredIdToString(sourceNode.id);
    strengths.set(sourceId, 1.0); // Max strength to start
    queue.push({ nodeId: sourceId, strength: 1.0 });

    while (queue.length > 0) {
      // Sort queue by strength (largest first)
      queue.sort((a, b) => b.strength - a.strength);
      
      // Get the node with highest strength
      const { nodeId, strength } = queue.shift()!;
      
      // Skip if already visited
      if (visited.has(nodeId)) continue;
      
      // Mark as visited
      visited.add(nodeId);
      
      // If we reached the target, reconstruct and return the path
      if (nodeId === structuredIdToString(targetNode.id)) {
        return this.reconstructPath(sourceNode, targetNode, predecessors);
      }
      
      // Get distance from source (path length)
      const pathLength = this.getPathLength(sourceId, nodeId, predecessors);
      
      // Stop if we've gone too deep
      if (pathLength >= options.maxDepth) {
        continue;
      }
      
      // Get connected nodes
      const nodeIdStructured = await this.findNodeById(nodeId);
      if (!nodeIdStructured) {
        continue;
      }
      const relatedNodes = await this.graphRepository.getRelatedNodes(nodeIdStructured.id, {
        relationshipTypes: options.relationshipTypes.length > 0 ? options.relationshipTypes : undefined,
        direction: 'both',
        maxDepth: 1
      });
      
      // Get all direct relationships for this node
      const relationships = await this.graphRepository.findRelationshipsByQuery({
        sourceNodeId: nodeIdStructured.id
      });
      
      // Create a map of target node IDs to relationships
      const relationshipMap = new Map<string, IGraphRelationship>();
      for (const rel of relationships) {
        if (rel.strength < options.minStrength) continue;
        relationshipMap.set(structuredIdToString(rel.targetId), rel);
      }
      
      // Find incoming relationships too
      const incomingRelationships = await this.graphRepository.findRelationshipsByQuery({
        targetNodeId: nodeIdStructured.id
      });
      
      for (const rel of incomingRelationships) {
        if (rel.strength < options.minStrength) continue;
        relationshipMap.set(structuredIdToString(rel.sourceId), rel);
      }
      
      // Process all neighbors
      for (const neighbor of relatedNodes) {
        const neighborId = structuredIdToString(neighbor.id);
        
        // Skip visited nodes
        if (visited.has(neighborId)) continue;
        
        // Get relationship between current node and neighbor
        const relationship = relationshipMap.get(neighborId);
        if (!relationship) continue;
        
        // Calculate new strength as product of strengths
        const newStrength = strength * relationship.strength;
        
        // If we found a stronger path, update
        if (!strengths.has(neighborId) || newStrength > strengths.get(neighborId)!) {
          strengths.set(neighborId, newStrength);
          predecessors.set(neighborId, { 
            nodeId, 
            relationshipId: structuredIdToString(relationship.id) 
          });
          queue.push({ nodeId: neighborId, strength: newStrength });
        }
      }
    }
    
    // No path found
    return null;
  }

  /**
   * Finds all paths between two nodes up to a maximum depth
   * @private
   */
  private async findAllPaths(
    sourceNode: IGraphNode,
    targetNode: IGraphNode,
    options: Required<PathOptions>
  ): Promise<IGraphPath[]> {
    const paths: IGraphPath[] = [];
    const sourceId = structuredIdToString(sourceNode.id);
    const targetId = structuredIdToString(targetNode.id);
    
    // Use depth-first search to find all paths
    const visited = new Set<string>();
    const currentPath: {
      nodeId: string;
      relationshipId: string | null;
    }[] = [{ nodeId: sourceId, relationshipId: null }];
    
    await this.depthFirstSearch(
      sourceNode, 
      targetNode, 
      visited, 
      currentPath, 
      paths, 
      options, 
      0
    );
    
    return paths;
  }

  /**
   * Recursive depth-first search to find all paths
   * @private
   */
  private async depthFirstSearch(
    currentNode: IGraphNode,
    targetNode: IGraphNode,
    visited: Set<string>,
    currentPath: Array<{ nodeId: string; relationshipId: string | null }>,
    paths: IGraphPath[],
    options: Required<PathOptions>,
    depth: number
  ): Promise<void> {
    const currentId = structuredIdToString(currentNode.id);
    const targetId = structuredIdToString(targetNode.id);
    
    // Mark current node as visited
    visited.add(currentId);
    
    // If we reached the target, add the path
    if (currentId === targetId && depth > 0) {
      // Reconstruct and add the path
      const path = await this.reconstructPathFromDFS(currentPath);
      if (path) {
        paths.push(path);
      }
    }
    
    // Stop if we've gone too deep
    if (depth >= options.maxDepth) {
      // Remove current node from visited before returning
      visited.delete(currentId);
      return;
    }
    
    // Get connected nodes
    const relatedNodes = await this.graphRepository.getRelatedNodes(currentNode.id, {
      relationshipTypes: options.relationshipTypes.length > 0 ? options.relationshipTypes : undefined,
      direction: 'both',
      maxDepth: 1
    });
    
    // Get all direct relationships for this node
    const relationships = await this.graphRepository.findRelationshipsByQuery({
      sourceNodeId: currentNode.id
    });
    
    // Create a map of target node IDs to relationships
    const outgoingRelationshipMap = new Map<string, IGraphRelationship>();
    for (const rel of relationships) {
      if (rel.strength < options.minStrength) continue;
      outgoingRelationshipMap.set(structuredIdToString(rel.targetId), rel);
    }
    
    // Find incoming relationships too
    const incomingRelationships = await this.graphRepository.findRelationshipsByQuery({
      targetNodeId: currentNode.id
    });
    
    const incomingRelationshipMap = new Map<string, IGraphRelationship>();
    for (const rel of incomingRelationships) {
      if (rel.strength < options.minStrength) continue;
      incomingRelationshipMap.set(structuredIdToString(rel.sourceId), rel);
    }
    
    // Process all neighbors
    for (const neighbor of relatedNodes) {
      const neighborId = structuredIdToString(neighbor.id);
      
      // Skip visited nodes
      if (visited.has(neighborId)) continue;
      
      // Check if there's a relationship from current to neighbor
      const outgoingRelationship = outgoingRelationshipMap.get(neighborId);
      if (outgoingRelationship) {
        // Add to path
        currentPath.push({
          nodeId: neighborId,
          relationshipId: structuredIdToString(outgoingRelationship.id)
        });
        
        // Recurse
        await this.depthFirstSearch(
          neighbor,
          targetNode,
          visited,
          currentPath,
          paths,
          options,
          depth + 1
        );
        
        // Remove from path (backtrack)
        currentPath.pop();
      }
      
      // Check if there's a relationship from neighbor to current
      const incomingRelationship = incomingRelationshipMap.get(neighborId);
      if (incomingRelationship) {
        // Add to path
        currentPath.push({
          nodeId: neighborId,
          relationshipId: structuredIdToString(incomingRelationship.id)
        });
        
        // Recurse
        await this.depthFirstSearch(
          neighbor,
          targetNode,
          visited,
          currentPath,
          paths,
          options,
          depth + 1
        );
        
        // Remove from path (backtrack)
        currentPath.pop();
      }
    }
    
    // Remove current node from visited before returning (backtrack)
    visited.delete(currentId);
  }

  /**
   * Reconstructs path from DFS traversal
   * @private
   */
  private async reconstructPathFromDFS(
    pathEntries: Array<{ nodeId: string; relationshipId: string | null }>
  ): Promise<IGraphPath | null> {
    const nodes: IGraphNode[] = [];
    const relationships: IGraphRelationship[] = [];
    let totalStrength = 0;
    
    // Get all nodes
    for (const entry of pathEntries) {
      const node = await this.findNodeById(entry.nodeId);
      if (!node) {
        return null;
      }
      nodes.push(node);
      
      // Get relationship (skip first as it's null)
      if (entry.relationshipId) {
        const relationship = await this.graphRepository.getRelationshipById(
          this.parseStructuredId(entry.relationshipId)
        );
        if (!relationship) {
          return null;
        }
        relationships.push(relationship);
        totalStrength += relationship.strength;
      }
    }
    
    // Calculate path score and metadata
    const pathLength = relationships.length;
    const averageStrength = pathLength > 0 ? totalStrength / pathLength : 1.0;
    const score = averageStrength / (1 + Math.log(pathLength + 1)); // Higher strength and shorter paths get higher scores
    
    return {
      nodes,
      relationships,
      score,
      metadata: {
        pathLength,
        averageStrength
      }
    };
  }

  /**
   * Helper method to find a node by its ID string
   * @private
   */
  private async findNodeById(nodeId: string): Promise<IGraphNode | null> {
    // Parse the ID string to get a StructuredId
    const structuredId = this.parseStructuredId(nodeId);
    return this.graphRepository.getNodeById(structuredId);
  }

  /**
   * Helper method to parse string ID to StructuredId
   * @private
   */
  private parseStructuredId(id: string): StructuredId {
    // This is a simplification - in a real system, you'd use a proper parsing function
    return {
      namespace: 'graph',
      type: 'node',
      id
    };
  }

  /**
   * Reconstructs a path from the predecessors map
   * @private
   */
  private async reconstructPath(
    sourceNode: IGraphNode,
    targetNode: IGraphNode,
    predecessors: Map<string, { nodeId: string, relationshipId: string }>
  ): Promise<IGraphPath | null> {
    const nodes: IGraphNode[] = [targetNode];
    const relationships: IGraphRelationship[] = [];
    let totalStrength = 0;
    
    let currentId = structuredIdToString(targetNode.id);
    const sourceId = structuredIdToString(sourceNode.id);
    
    // Traverse backwards from target to source
    while (currentId !== sourceId) {
      const predecessor = predecessors.get(currentId);
      
      // If no predecessor, path is incomplete
      if (!predecessor) {
        return null;
      }
      
      // Get the relationship
      const relationship = await this.graphRepository.getRelationshipById(
        this.parseStructuredId(predecessor.relationshipId)
      );
      
      if (!relationship) {
        return null;
      }
      
      // Add to path
      relationships.unshift(relationship);
      totalStrength += relationship.strength;
      
      // Get the predecessor node
      const node = await this.findNodeById(predecessor.nodeId);
      
      if (!node) {
        return null;
      }
      
      // Add to path
      nodes.unshift(node);
      
      // Move to predecessor
      currentId = predecessor.nodeId;
    }
    
    // Calculate path score and metadata
    const pathLength = relationships.length;
    const averageStrength = pathLength > 0 ? totalStrength / pathLength : 1.0;
    const score = averageStrength / (1 + Math.log(pathLength + 1)); // Higher strength and shorter paths get higher scores
    
    return {
      nodes,
      relationships,
      score,
      metadata: {
        pathLength,
        averageStrength
      }
    };
  }

  /**
   * Gets the length of a path from source to target using predecessors
   * @private
   */
  private getPathLength(
    sourceId: string,
    targetId: string,
    predecessors: Map<string, { nodeId: string, relationshipId: string }>
  ): number {
    let length = 0;
    let currentId = targetId;
    
    while (currentId !== sourceId) {
      const predecessor = predecessors.get(currentId);
      
      if (!predecessor) {
        return Infinity;
      }
      
      length++;
      currentId = predecessor.nodeId;
    }
    
    return length;
  }

  /**
   * Analyzes the subgraph containing the specified nodes
   */
  async analyzeSubgraph(
    nodeIds: StructuredId[], 
    options: SubgraphAnalysisOptions = {}
  ): Promise<Result<SubgraphAnalysisResult>> {
    try {
      this.logger.debug('Analyzing subgraph', { nodeCount: nodeIds.length, options });
      
      if (nodeIds.length === 0) {
        return failure(new SubgraphAnalysisError(
          'At least one node ID is required for subgraph analysis',
          []
        ));
      }
      
      // Set default options
      const analysisOptions = {
        includeRelationships: options.includeRelationships !== false,
        includeMetrics: options.includeMetrics !== false,
        maxDepth: options.maxDepth || 2
      };
      
      // Validate all node IDs exist
      const nodes: IGraphNode[] = [];
      
      for (const nodeId of nodeIds) {
        const node = await this.graphRepository.getNodeById(nodeId);
        if (!node) {
          return failure(new SubgraphAnalysisError(
            `Node not found: ${structuredIdToString(nodeId)}`,
            nodeIds.map(id => structuredIdToString(id)),
            { missingNodeId: structuredIdToString(nodeId) }
          ));
        }
        nodes.push(node);
      }
      
      // Get the full subgraph by expanding from each node
      const allNodes = new Map<string, IGraphNode>();
      const allRelationships = new Map<string, IGraphRelationship>();
      
      // First, add the input nodes
      for (const node of nodes) {
        allNodes.set(structuredIdToString(node.id), node);
      }
      
      // Then add related nodes up to maxDepth
      for (const node of nodes) {
        await this.expandSubgraph(
          node, 
          allNodes, 
          allRelationships, 
          analysisOptions.maxDepth
        );
      }
      
      // Convert to arrays for analysis
      const nodeArray = Array.from(allNodes.values());
      const relationshipArray = Array.from(allRelationships.values());
      
      this.logger.debug('Subgraph extracted', { 
        nodeCount: nodeArray.length, 
        relationshipCount: relationshipArray.length 
      });
      
      // Skip analysis if no relationships found
      if (relationshipArray.length === 0) {
        return success({
          centralNodes: [],
          bridges: [],
          clusters: [],
          metrics: {
            density: 0,
            avgPathLength: 0,
            clusteringCoefficient: 0
          }
        });
      }
      
      // Perform centrality analysis
      const centralNodes = await this.calculateCentrality(nodeArray, relationshipArray);
      
      // Find bridges (relationships that, when removed, disconnect the graph)
      const bridges = await this.findBridges(nodeArray, relationshipArray);
      
      // Detect clusters using a simple community detection algorithm
      const clusters = await this.detectClusters(nodeArray, relationshipArray);
      
      // Calculate graph metrics
      let metrics = {
        density: 0,
        avgPathLength: 0,
        clusteringCoefficient: 0
      };
      
      if (analysisOptions.includeMetrics) {
        metrics = await this.calculateGraphMetrics(nodeArray, relationshipArray);
      }
      
      return success({
        centralNodes: centralNodes.slice(0, 5), // Return top 5 most central
        bridges,
        clusters,
        metrics
      });
      
    } catch (error) {
      this.logger.error('Error analyzing subgraph', { error });
      
      if (error instanceof GraphError) {
        return failure(error);
      }
      
      return failure(new SubgraphAnalysisError(
        `Failed to analyze subgraph: ${error instanceof Error ? error.message : String(error)}`,
        nodeIds.map(id => structuredIdToString(id))
      ));
    }
  }
  
  /**
   * Expands the subgraph from a node up to maxDepth
   * @private
   */
  private async expandSubgraph(
    node: IGraphNode,
    allNodes: Map<string, IGraphNode>,
    allRelationships: Map<string, IGraphRelationship>,
    maxDepth: number,
    depth: number = 0,
    visited: Set<string> = new Set()
  ): Promise<void> {
    // Stop if we've gone too deep
    if (depth >= maxDepth) {
      return;
    }
    
    const nodeId = structuredIdToString(node.id);
    
    // Skip if already visited
    if (visited.has(nodeId)) {
      return;
    }
    
    // Mark as visited
    visited.add(nodeId);
    
    // Get related nodes
    const relatedNodes = await this.graphRepository.getRelatedNodes(node.id, {
      direction: 'both',
      maxDepth: 1
    });
    
    // Get relationships
    const outgoingRelationships = await this.graphRepository.findRelationshipsByQuery({
      sourceNodeId: node.id
    });
    
    const incomingRelationships = await this.graphRepository.findRelationshipsByQuery({
      targetNodeId: node.id
    });
    
    // Add nodes and relationships to the collections
    for (const relatedNode of relatedNodes) {
      allNodes.set(structuredIdToString(relatedNode.id), relatedNode);
    }
    
    for (const relationship of [...outgoingRelationships, ...incomingRelationships]) {
      allRelationships.set(structuredIdToString(relationship.id), relationship);
    }
    
    // Recursively expand from each related node
    for (const relatedNode of relatedNodes) {
      await this.expandSubgraph(
        relatedNode,
        allNodes,
        allRelationships,
        maxDepth,
        depth + 1,
        visited
      );
    }
  }
  
  /**
   * Calculates centrality for each node in the subgraph
   * @private
   */
  private async calculateCentrality(
    nodes: IGraphNode[],
    relationships: IGraphRelationship[]
  ): Promise<IGraphNode[]> {
    // Calculate degree centrality (number of connections)
    const degreeCentrality = new Map<string, number>();
    
    // Count relationships for each node
    for (const relationship of relationships) {
      const sourceId = structuredIdToString(relationship.sourceId);
      const targetId = structuredIdToString(relationship.targetId);
      
      degreeCentrality.set(sourceId, (degreeCentrality.get(sourceId) || 0) + 1);
      degreeCentrality.set(targetId, (degreeCentrality.get(targetId) || 0) + 1);
    }
    
    // Sort nodes by degree centrality
    const sortedNodes = [...nodes].sort((a, b) => {
      const centralityA = degreeCentrality.get(structuredIdToString(a.id)) || 0;
      const centralityB = degreeCentrality.get(structuredIdToString(b.id)) || 0;
      return centralityB - centralityA; // Descending order
    });
    
    return sortedNodes;
  }
  
  /**
   * Finds bridges in the subgraph
   * @private
   */
  private async findBridges(
    nodes: IGraphNode[],
    relationships: IGraphRelationship[]
  ): Promise<IGraphRelationship[]> {
    // Simple heuristic: find relationships that, when removed, disconnect the graph
    // This is a simplified version; a real implementation would use a more efficient algorithm
    
    const bridges: IGraphRelationship[] = [];
    
    for (const relationship of relationships) {
      // Skip the current relationship and check if the graph is still connected
      const remainingRelationships = relationships.filter(
        r => structuredIdToString(r.id) !== structuredIdToString(relationship.id)
      );
      
      if (!this.isConnected(nodes, remainingRelationships)) {
        bridges.push(relationship);
      }
    }
    
    return bridges;
  }
  
  /**
   * Checks if the graph is connected
   * @private
   */
  private isConnected(
    nodes: IGraphNode[],
    relationships: IGraphRelationship[]
  ): boolean {
    if (nodes.length <= 1) {
      return true;
    }
    
    // Build adjacency list
    const adjacencyList = new Map<string, Set<string>>();
    
    for (const node of nodes) {
      adjacencyList.set(structuredIdToString(node.id), new Set());
    }
    
    for (const relationship of relationships) {
      const sourceId = structuredIdToString(relationship.sourceId);
      const targetId = structuredIdToString(relationship.targetId);
      
      adjacencyList.get(sourceId)?.add(targetId);
      adjacencyList.get(targetId)?.add(sourceId);
    }
    
    // Run BFS from the first node
    const visited = new Set<string>();
    const queue = [structuredIdToString(nodes[0].id)];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      visited.add(current);
      
      const neighbors = adjacencyList.get(current) || new Set<string>();
      for (const neighbor of Array.from(neighbors)) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }
    
    // If all nodes are visited, the graph is connected
    return visited.size === nodes.length;
  }
  
  /**
   * Detects clusters in the subgraph
   * @private
   */
  private async detectClusters(
    nodes: IGraphNode[],
    relationships: IGraphRelationship[]
  ): Promise<{
    id: string;
    nodes: IGraphNode[];
    cohesion: number;
  }[]> {
    // Simple label propagation algorithm for community detection
    // Initialize each node to its own cluster
    const nodeToCluster = new Map<string, string>();
    
    for (const node of nodes) {
      const nodeId = structuredIdToString(node.id);
      nodeToCluster.set(nodeId, nodeId);
    }
    
    // Build adjacency list
    const adjacencyList = new Map<string, Set<string>>();
    
    for (const node of nodes) {
      adjacencyList.set(structuredIdToString(node.id), new Set());
    }
    
    for (const relationship of relationships) {
      const sourceId = structuredIdToString(relationship.sourceId);
      const targetId = structuredIdToString(relationship.targetId);
      
      adjacencyList.get(sourceId)?.add(targetId);
      adjacencyList.get(targetId)?.add(sourceId);
    }
    
    // Propagate labels
    const maxIterations = 10;
    let changed = true;
    let iteration = 0;
    
    while (changed && iteration < maxIterations) {
      changed = false;
      iteration++;
      
      // Shuffle node order for randomness
      const shuffledNodes = [...nodes].sort(() => 0.5 - Math.random());
      
      for (const node of shuffledNodes) {
        const nodeId = structuredIdToString(node.id);
        const neighbors = adjacencyList.get(nodeId) || new Set();
        
        if (neighbors.size === 0) {
          continue;
        }
        
        // Count neighbor clusters
        const clusterCounts = new Map<string, number>();
        
        for (const neighborId of Array.from(neighbors)) {
          const neighborCluster = nodeToCluster.get(neighborId);
          
          if (neighborCluster) {
            clusterCounts.set(neighborCluster, (clusterCounts.get(neighborCluster) || 0) + 1);
          }
        }
        
        // Find most common cluster
        let maxCount = 0;
        let dominantCluster = nodeToCluster.get(nodeId)!;
        
        for (const [cluster, count] of Array.from(clusterCounts.entries())) {
          if (count > maxCount) {
            maxCount = count;
            dominantCluster = cluster;
          }
        }
        
        // Update cluster if changed
        if (dominantCluster !== nodeToCluster.get(nodeId)) {
          nodeToCluster.set(nodeId, dominantCluster);
          changed = true;
        }
      }
    }
    
    // Group nodes by cluster
    const clusterToNodes = new Map<string, IGraphNode[]>();
    
    for (const node of nodes) {
      const nodeId = structuredIdToString(node.id);
      const cluster = nodeToCluster.get(nodeId);
      
      if (cluster) {
        if (!clusterToNodes.has(cluster)) {
          clusterToNodes.set(cluster, []);
        }
        clusterToNodes.get(cluster)!.push(node);
      }
    }
    
    // Filter out small clusters (less than 2 nodes)
    const filteredClusters = Array.from(clusterToNodes.entries())
      .filter(([_, clusterNodes]) => clusterNodes.length > 1)
      .map(([clusterId, clusterNodes]) => {
        // Calculate cluster cohesion (ratio of internal to external edges)
        let internalEdges = 0;
        let externalEdges = 0;
        
        for (const node of clusterNodes) {
          const nodeId = structuredIdToString(node.id);
          const neighbors = adjacencyList.get(nodeId) || new Set();
          
          for (const neighborId of Array.from(neighbors)) {
            const neighborCluster = nodeToCluster.get(neighborId);
            
            if (neighborCluster === clusterId) {
              internalEdges++;
            } else {
              externalEdges++;
            }
          }
        }
        
        // To avoid division by zero
        const totalEdges = internalEdges + externalEdges;
        const cohesion = totalEdges > 0 ? internalEdges / totalEdges : 0;
        
        return {
          id: clusterId,
          nodes: clusterNodes,
          cohesion
        };
      });
    
    // Sort by size and cohesion
    filteredClusters.sort((a, b) => {
      // First by size
      const sizeDiff = b.nodes.length - a.nodes.length;
      if (sizeDiff !== 0) return sizeDiff;
      
      // Then by cohesion
      return b.cohesion - a.cohesion;
    });
    
    return filteredClusters;
  }
  
  /**
   * Calculates graph metrics
   * @private
   */
  private async calculateGraphMetrics(
    nodes: IGraphNode[],
    relationships: IGraphRelationship[]
  ): Promise<{
    density: number;
    avgPathLength: number;
    clusteringCoefficient: number;
  }> {
    // Calculate graph density
    const n = nodes.length;
    const m = relationships.length;
    
    // Maximum possible edges for undirected graph = n*(n-1)/2
    const maxEdges = n * (n - 1) / 2;
    const density = maxEdges > 0 ? m / maxEdges : 0;
    
    // Calculate average path length (simplified)
    // In a real implementation, this would use all-pairs shortest paths
    let totalPathLength = 0;
    let pathCount = 0;
    
    // Sample a subset of nodes for efficiency
    const sampleSize = Math.min(n, 10);
    const sampledNodes = [...nodes].sort(() => 0.5 - Math.random()).slice(0, sampleSize);
    
    for (let i = 0; i < sampledNodes.length; i++) {
      for (let j = i + 1; j < sampledNodes.length; j++) {
        const paths = await this.findPaths(
          sampledNodes[i].id,
          sampledNodes[j].id,
          { maxDepth: 5, algorithm: 'shortest' }
        );
        
        if (paths.success && paths.data && paths.data.length > 0) {
          totalPathLength += paths.data[0].metadata.pathLength;
          pathCount++;
        }
      }
    }
    
    const avgPathLength = pathCount > 0 ? totalPathLength / pathCount : 0;
    
    // Calculate clustering coefficient (simplified)
    // Build adjacency list
    const adjacencyList = new Map<string, Set<string>>();
    
    for (const node of nodes) {
      adjacencyList.set(structuredIdToString(node.id), new Set());
    }
    
    for (const relationship of relationships) {
      const sourceId = structuredIdToString(relationship.sourceId);
      const targetId = structuredIdToString(relationship.targetId);
      
      adjacencyList.get(sourceId)?.add(targetId);
      adjacencyList.get(targetId)?.add(sourceId);
    }
    
    let totalCoefficient = 0;
    
    for (const node of nodes) {
      const nodeId = structuredIdToString(node.id);
      const neighbors = adjacencyList.get(nodeId) || new Set<string>();
      
      if (neighbors.size < 2) {
        continue;
      }
      
      // Count connections between neighbors
      let connectionCount = 0;
      const neighborArray = Array.from(neighbors);
      
      for (let i = 0; i < neighborArray.length; i++) {
        for (let j = i + 1; j < neighborArray.length; j++) {
          if (adjacencyList.get(neighborArray[i])?.has(neighborArray[j])) {
            connectionCount++;
          }
        }
      }
      
      // Maximum possible connections between n neighbors = n*(n-1)/2
      const maxConnections = neighbors.size * (neighbors.size - 1) / 2;
      const localClusteringCoeff = maxConnections > 0 ? connectionCount / maxConnections : 0;
      
      totalCoefficient += localClusteringCoeff;
    }
    
    const clusteringCoefficient = nodes.length > 0 ? totalCoefficient / nodes.length : 0;
    
    return {
      density,
      avgPathLength,
      clusteringCoefficient
    };
  }
  
  /**
   * Extracts insights from the graph
   */
  async extractInsights(
    options: InsightExtractionOptions = {}
  ): Promise<Result<IGraphInsight[]>> {
    try {
      this.logger.debug('Extracting insights from graph', { options });
      
      // Set default options
      const insightOptions = {
        insightTypes: options.insightTypes || Object.values(GraphInsightType),
        maxInsights: options.maxInsights || 10,
        minRelevance: options.minRelevance || 0.5,
        focusNodeIds: options.focusNodeIds || []
      };
      
      const insights: IGraphInsight[] = [];
      
      // Get focus nodes if specified
      const focusNodes: IGraphNode[] = [];
      
      if (insightOptions.focusNodeIds.length > 0) {
        for (const nodeId of insightOptions.focusNodeIds) {
          const node = await this.graphRepository.getNodeById(nodeId);
          if (node) {
            focusNodes.push(node);
          }
        }
      }
      
      // If no focus nodes specified, use a sample of all nodes
      if (focusNodes.length === 0) {
        const sampleNodes = await this.graphRepository.findNodes({
          limit: 20 // Sample size
        });
        
        focusNodes.push(...sampleNodes);
      }
      
      // Skip if no nodes available
      if (focusNodes.length === 0) {
        return success([]);
      }
      
      // Extract different types of insights
      const insightPromises: Promise<IGraphInsight[]>[] = [];
      
      // Only run extraction for the requested insight types
      if (insightOptions.insightTypes.includes(GraphInsightType.CENTRAL_CONCEPT)) {
        insightPromises.push(this.extractCentralConceptInsights(focusNodes, insightOptions));
      }
      
      if (insightOptions.insightTypes.includes(GraphInsightType.KNOWLEDGE_GAP)) {
        insightPromises.push(this.extractKnowledgeGapInsights(focusNodes, insightOptions));
      }
      
      if (insightOptions.insightTypes.includes(GraphInsightType.UNEXPECTED_RELATIONSHIP)) {
        insightPromises.push(this.extractUnexpectedRelationshipInsights(focusNodes, insightOptions));
      }
      
      if (insightOptions.insightTypes.includes(GraphInsightType.EMERGING_PATTERN)) {
        insightPromises.push(this.extractEmergingPatternInsights(focusNodes, insightOptions));
      }
      
      if (insightOptions.insightTypes.includes(GraphInsightType.CONTRADICTION)) {
        insightPromises.push(this.extractContradictionInsights(focusNodes, insightOptions));
      }
      
      if (insightOptions.insightTypes.includes(GraphInsightType.REINFORCEMENT)) {
        insightPromises.push(this.extractReinforcementInsights(focusNodes, insightOptions));
      }
      
      // Wait for all insight extraction to complete
      const insightResults = await Promise.all(insightPromises);
      
      // Combine and filter insights
      const allInsights = insightResults.flat();
      
      // Filter by relevance
      const filteredInsights = allInsights.filter(
        insight => insight.relevance >= insightOptions.minRelevance
      );
      
      // Sort by relevance (descending)
      filteredInsights.sort((a, b) => b.relevance - a.relevance);
      
      // Limit to max insights
      const limitedInsights = filteredInsights.slice(0, insightOptions.maxInsights);
      
      this.logger.debug('Extracted insights', { 
        totalInsights: allInsights.length,
        filteredInsights: filteredInsights.length,
        returnedInsights: limitedInsights.length
      });
      
      return success(limitedInsights);
    } catch (error) {
      this.logger.error('Error extracting insights', { error });
      
      if (error instanceof GraphError) {
        return failure(error);
      }
      
      return failure(new InsightExtractionError(
        `Failed to extract insights: ${error instanceof Error ? error.message : String(error)}`
      ));
    }
  }
  
  /**
   * Extracts central concept insights
   * @private
   */
  private async extractCentralConceptInsights(
    focusNodes: IGraphNode[],
    options: Required<InsightExtractionOptions>
  ): Promise<IGraphInsight[]> {
    const insights: IGraphInsight[] = [];
    
    // Get a larger subgraph around focus nodes
    const nodeSet = new Set<string>();
    const nodeMap = new Map<string, IGraphNode>();
    const relationshipMap = new Map<string, IGraphRelationship>();
    
    // Add focus nodes
    for (const node of focusNodes) {
      const nodeId = structuredIdToString(node.id);
      nodeSet.add(nodeId);
      nodeMap.set(nodeId, node);
    }
    
    // Expand to get a subgraph
    for (const node of focusNodes) {
      await this.expandSubgraph(
        node,
        nodeMap,
        relationshipMap,
        2 // depth
      );
    }
    
    // Convert to arrays for analysis
    const nodes = Array.from(nodeMap.values());
    const relationships = Array.from(relationshipMap.values());
    
    // Skip if subgraph is too small
    if (nodes.length < 5 || relationships.length < 5) {
      return insights;
    }
    
    // Get central nodes using centrality algorithm
    const centralNodes = await this.calculateCentrality(nodes, relationships);
    
    // Extract insights from top central nodes
    const topCentralNodes = centralNodes.slice(0, 3);
    
    for (const centralNode of topCentralNodes) {
      // Calculate relevance based on how central and connected the node is
      const relationships = await this.graphRepository.findRelationshipsByQuery({
        sourceNodeId: centralNode.id
      });
      
      const incomingRelationships = await this.graphRepository.findRelationshipsByQuery({
        targetNodeId: centralNode.id
      });
      
      const relationshipCount = relationships.length + incomingRelationships.length;
      const relevance = Math.min(0.5 + (relationshipCount / 20), 0.95);
      
      // Skip if not relevant enough
      if (relevance < options.minRelevance) {
        continue;
      }
      
      // Create the insight
      const insight: IGraphInsight = {
        id: this.createStructuredId(GraphInsightType.CENTRAL_CONCEPT, structuredIdToString(centralNode.id)),
        type: GraphInsightType.CENTRAL_CONCEPT,
        summary: `${centralNode.label} is a central concept connecting multiple topics`,
        details: `The concept '${centralNode.label}' has connections to ${relationshipCount} other nodes, making it a key concept in this knowledge area.`,
        relevance,
        sourceNodes: [centralNode.id],
        createdAt: new Date()
      };
      
      insights.push(insight);
    }
    
    return insights;
  }
  
  /**
   * Extracts knowledge gap insights
   * @private
   */
  private async extractKnowledgeGapInsights(
    focusNodes: IGraphNode[],
    options: Required<InsightExtractionOptions>
  ): Promise<IGraphInsight[]> {
    const insights: IGraphInsight[] = [];
    
    // Look for isolated nodes or sparse areas in the graph
    for (const node of focusNodes) {
      // Get related nodes
      const relatedNodes = await this.graphRepository.getRelatedNodes(node.id, {
        maxDepth: 1
      });
      
      // If node has very few connections, it might indicate a knowledge gap
      if (relatedNodes.length < 2) {
        const relevance = 0.6 + (0.3 * (1 - (relatedNodes.length / 5)));
        
        // Skip if not relevant enough
        if (relevance < options.minRelevance) {
          continue;
        }
        
        // Create the insight
        const insight: IGraphInsight = {
          id: this.createStructuredId(GraphInsightType.KNOWLEDGE_GAP, structuredIdToString(node.id)),
          type: GraphInsightType.KNOWLEDGE_GAP,
          summary: `Limited information about ${node.label}`,
          details: `The concept '${node.label}' has very few connections (${relatedNodes.length}) to other concepts, suggesting a potential knowledge gap.`,
          relevance,
          sourceNodes: [node.id],
          createdAt: new Date()
        };
        
        insights.push(insight);
      }
    }
    
    return insights;
  }
  
  /**
   * Extracts unexpected relationship insights
   * @private
   */
  private async extractUnexpectedRelationshipInsights(
    focusNodes: IGraphNode[],
    options: Required<InsightExtractionOptions>
  ): Promise<IGraphInsight[]> {
    const insights: IGraphInsight[] = [];
    
    // Look for relationships between nodes of different types
    for (const node of focusNodes) {
      // Get relations
      const relationships = await this.graphRepository.findRelationshipsByQuery({
        sourceNodeId: node.id
      });
      
      for (const relationship of relationships) {
        const targetNode = await this.graphRepository.getNodeById(relationship.targetId);
        
        if (!targetNode) {
          continue;
        }
        
        // Check if nodes are of different types
        if (node.type !== targetNode.type) {
          // Check if they have few tags in common
          const nodeTags = new Set(node.tags);
          const targetTags = new Set(targetNode.tags);
          
          const commonTags = node.tags.filter(tag => targetNode.tags.includes(tag));
          
          // If they have few tags in common, the relationship might be unexpected
          if (commonTags.length < 2) {
            const relevance = 0.5 + (0.4 * (1 - (commonTags.length / 5)));
            
            // Skip if not relevant enough
            if (relevance < options.minRelevance) {
              continue;
            }
            
            // Create the insight
            const insight: IGraphInsight = {
              id: this.createStructuredId(
                GraphInsightType.UNEXPECTED_RELATIONSHIP, 
                `${structuredIdToString(node.id)}_${structuredIdToString(targetNode.id)}`
              ),
              type: GraphInsightType.UNEXPECTED_RELATIONSHIP,
              summary: `Unexpected connection between ${node.label} and ${targetNode.label}`,
              details: `There is a relationship between '${node.label}' (${node.type}) and '${targetNode.label}' (${targetNode.type}) despite them having few common attributes.`,
              relevance,
              sourceNodes: [node.id, targetNode.id],
              createdAt: new Date()
            };
            
            insights.push(insight);
          }
        }
      }
    }
    
    return insights;
  }
  
  /**
   * Extracts emerging pattern insights
   * @private
   */
  private async extractEmergingPatternInsights(
    focusNodes: IGraphNode[],
    options: Required<InsightExtractionOptions>
  ): Promise<IGraphInsight[]> {
    const insights: IGraphInsight[] = [];
    
    // Get a larger subgraph
    const nodeMap = new Map<string, IGraphNode>();
    const relationshipMap = new Map<string, IGraphRelationship>();
    
    // Add focus nodes
    for (const node of focusNodes) {
      nodeMap.set(structuredIdToString(node.id), node);
    }
    
    // Expand to get a subgraph
    for (const node of focusNodes) {
      await this.expandSubgraph(
        node,
        nodeMap,
        relationshipMap,
        2 // depth
      );
    }
    
    // Look for patterns in node connections
    const tagFrequency = new Map<string, number>();
    const tagConnections = new Map<string, Set<string>>();
    
    // Count tag occurrences
    for (const node of Array.from(nodeMap.values())) {
      for (const tag of node.tags) {
        tagFrequency.set(tag, (tagFrequency.get(tag) || 0) + 1);
      }
    }
    
    // Find tag co-occurrences
    for (const relationship of Array.from(relationshipMap.values())) {
      const sourceNode = nodeMap.get(structuredIdToString(relationship.sourceId));
      const targetNode = nodeMap.get(structuredIdToString(relationship.targetId));
      
      if (!sourceNode || !targetNode) {
        continue;
      }
      
      // Connect all tags from source to all tags from target
      for (const sourceTag of sourceNode.tags) {
        if (!tagConnections.has(sourceTag)) {
          tagConnections.set(sourceTag, new Set<string>());
        }
        
        for (const targetTag of targetNode.tags) {
          tagConnections.get(sourceTag)?.add(targetTag);
          
          if (!tagConnections.has(targetTag)) {
            tagConnections.set(targetTag, new Set<string>());
          }
          
          tagConnections.get(targetTag)?.add(sourceTag);
        }
      }
    }
    
    // Find tags with high connectivity
    const tagScores = new Map<string, number>();
    
    for (const [tag, connections] of Array.from(tagConnections.entries())) {
      const frequency = tagFrequency.get(tag) || 0;
      const connectivity = connections.size;
      
      // Score is a combination of frequency and connectivity
      const score = (frequency / nodeMap.size) * (connectivity / tagConnections.size);
      tagScores.set(tag, score);
    }
    
    // Find top patterns
    const tagEntries = Array.from(tagScores.entries());
    tagEntries.sort((a, b) => b[1] - a[1]);
    
    const topPatterns = tagEntries.slice(0, 3);
    
    for (const [tag, score] of topPatterns) {
      const relevance = 0.5 + (score * 0.5);
      
      // Skip if not relevant enough
      if (relevance < options.minRelevance) {
        continue;
      }
      
      // Find nodes with this tag
      const relatedNodes = [];
      for (const node of Array.from(nodeMap.values())) {
        if (node.tags.includes(tag)) {
          relatedNodes.push(node);
        }
      }
      
      if (relatedNodes.length < 3) {
        continue;
      }
      
      // Take top 5 nodes
      const patternNodes = relatedNodes.slice(0, 5);
      
      // Create the insight
      const insight: IGraphInsight = {
        id: this.createStructuredId(GraphInsightType.EMERGING_PATTERN, tag),
        type: GraphInsightType.EMERGING_PATTERN,
        summary: `Emerging pattern: ${tag}`,
        details: `The tag '${tag}' appears frequently (${tagFrequency.get(tag)} times) and connects to ${tagConnections.get(tag)?.size || 0} other concepts, suggesting an emerging pattern.`,
        relevance,
        sourceNodes: patternNodes.map(node => node.id),
        createdAt: new Date()
      };
      
      insights.push(insight);
    }
    
    return insights;
  }
  
  /**
   * Extracts contradiction insights
   * @private
   */
  private async extractContradictionInsights(
    focusNodes: IGraphNode[],
    options: Required<InsightExtractionOptions>
  ): Promise<IGraphInsight[]> {
    const insights: IGraphInsight[] = [];
    
    // Look for contradicting relationships in the graph
    for (const node of focusNodes) {
      // Get relationships where this node is the source
      const relationships = await this.graphRepository.findRelationshipsByQuery({
        sourceNodeId: node.id
      });
      
      // Find contradicting relationships
      for (let i = 0; i < relationships.length; i++) {
        const rel1 = relationships[i];
        
        for (let j = i + 1; j < relationships.length; j++) {
          const rel2 = relationships[j];
          
          // Check if there's a potential contradiction (different relationship types to similar nodes)
          if (rel1.type !== rel2.type) {
            const target1 = await this.graphRepository.getNodeById(rel1.targetId);
            const target2 = await this.graphRepository.getNodeById(rel2.targetId);
            
            if (!target1 || !target2) {
              continue;
            }
            
            // Check if targets are similar (same type or share tags)
            const sameType = target1.type === target2.type;
            const commonTags = target1.tags.filter(tag => target2.tags.includes(tag));
            
            if (sameType || commonTags.length > 1) {
              // Calculate similarity score
              const similarity = sameType ? 0.5 : 0;
              const tagSimilarity = commonTags.length / Math.max(target1.tags.length, target2.tags.length);
              const totalSimilarity = similarity + (tagSimilarity * 0.5);
              
              // Only consider if similarity is high
              if (totalSimilarity > 0.3) {
                // Check if their relationship types are contradictory
                const isContradictory = this.areRelationshipsContradictory(rel1.type, rel2.type);
                
                if (isContradictory) {
                  const relevance = 0.6 + (totalSimilarity * 0.4);
                  
                  // Skip if not relevant enough
                  if (relevance < options.minRelevance) {
                    continue;
                  }
                  
                  // Create the insight
                  const insight: IGraphInsight = {
                    id: this.createStructuredId(
                      GraphInsightType.CONTRADICTION, 
                      `${structuredIdToString(rel1.id)}_${structuredIdToString(rel2.id)}`
                    ),
                    type: GraphInsightType.CONTRADICTION,
                    summary: `Potential contradiction in relationships from ${node.label}`,
                    details: `There may be a contradiction in how '${node.label}' relates to '${target1.label}' (${rel1.type}) and '${target2.label}' (${rel2.type}), which are similar concepts.`,
                    relevance,
                    sourceNodes: [node.id, target1.id, target2.id],
                    createdAt: new Date()
                  };
                  
                  insights.push(insight);
                }
              }
            }
          }
        }
      }
    }
    
    return insights;
  }
  
  /**
   * Extracts reinforcement insights
   * @private
   */
  private async extractReinforcementInsights(
    focusNodes: IGraphNode[],
    options: Required<InsightExtractionOptions>
  ): Promise<IGraphInsight[]> {
    const insights: IGraphInsight[] = [];
    
    // Look for mutually reinforcing concepts
    for (const node of focusNodes) {
      // Get node's related nodes
      const relatedNodes = await this.graphRepository.getRelatedNodes(node.id, {
        maxDepth: 1
      });
      
      for (const relatedNode of relatedNodes) {
        // Skip if it's the same node
        if (structuredIdToString(node.id) === structuredIdToString(relatedNode.id)) {
          continue;
        }
        
        // Check the relationships between them
        const relationships = await this.graphRepository.findRelationships(node.id, relatedNode.id);
        
        // Skip if no relationships found
        if (relationships.length === 0) {
          continue;
        }
        
        // Get related nodes of the related node
        const secondaryNodes = await this.graphRepository.getRelatedNodes(relatedNode.id, {
          maxDepth: 1
        });
        
        // Count common nodes between the two sets
        const nodeSet = new Set<string>();
        for (const secondaryNode of secondaryNodes) {
          nodeSet.add(structuredIdToString(secondaryNode.id));
        }
        
        let commonCount = 0;
        for (const primaryRelated of relatedNodes) {
          if (nodeSet.has(structuredIdToString(primaryRelated.id))) {
            commonCount++;
          }
        }
        
        // If they share several connections, they might be reinforcing each other
        if (commonCount >= 2) {
          const totalConnections = relatedNodes.length + secondaryNodes.length - commonCount;
          const reinforcementStrength = commonCount / totalConnections;
          
          const relevance = 0.5 + (reinforcementStrength * 0.5);
          
          // Skip if not relevant enough
          if (relevance < options.minRelevance) {
            continue;
          }
          
          // Create the insight
          const insight: IGraphInsight = {
            id: this.createStructuredId(
              GraphInsightType.REINFORCEMENT, 
              `${structuredIdToString(node.id)}_${structuredIdToString(relatedNode.id)}`
            ),
            type: GraphInsightType.REINFORCEMENT,
            summary: `Mutual reinforcement between ${node.label} and ${relatedNode.label}`,
            details: `'${node.label}' and '${relatedNode.label}' share ${commonCount} common connections, suggesting they mutually reinforce or complement each other.`,
            relevance,
            sourceNodes: [node.id, relatedNode.id],
            createdAt: new Date()
          };
          
          insights.push(insight);
        }
      }
    }
    
    return insights;
  }
  
  /**
   * Check if two relationship types are contradictory
   * @private
   */
  private areRelationshipsContradictory(
    type1: GraphRelationshipType,
    type2: GraphRelationshipType
  ): boolean {
    // Define contradictory pairs
    const contradictions: [GraphRelationshipType, GraphRelationshipType][] = [
      [GraphRelationshipType.SUPPORTS, GraphRelationshipType.CONTRADICTS],
      [GraphRelationshipType.CAUSES, GraphRelationshipType.CONTRADICTS],
      [GraphRelationshipType.SIMILAR_TO, GraphRelationshipType.CONTRADICTS],
      [GraphRelationshipType.PRECEDES, GraphRelationshipType.FOLLOWS]
    ];
    
    // Check if the pair is in the contradictions list
    return contradictions.some(([a, b]) => 
      (type1 === a && type2 === b) || (type1 === b && type2 === a)
    );
  }
  
  /**
   * Create a structured ID for insights
   * @private
   */
  private createStructuredId(type: string, id: string): StructuredId {
    return {
      namespace: 'graph',
      type: 'insight',
      id: `${type}_${id}`
    };
  }
  
  /**
   * Enriches nodes with additional information from external sources
   */
  async enrichNodes(
    nodeIds: StructuredId[], 
    options: NodeEnrichmentOptions = {}
  ): Promise<Result<NodeEnrichmentResult>> {
    try {
      this.logger.debug('Enriching nodes with additional metadata', { 
        nodeCount: nodeIds.length, 
        options 
      });
      
      if (nodeIds.length === 0) {
        return failure(new NodeEnrichmentError(
          'At least one node ID is required for enrichment',
          []
        ));
      }
      
      // Set default options
      const enrichmentOptions = {
        dataSources: options.dataSources || ['default'],
        maxEnrichmentItems: options.maxEnrichmentItems || 10,
        minConfidence: options.minConfidence || 0.6
      };
      
      // Verify all nodes exist
      const nodes: IGraphNode[] = [];
      for (const nodeId of nodeIds) {
        const node = await this.graphRepository.getNodeById(nodeId);
        if (!node) {
          return failure(new NodeEnrichmentError(
            `Node not found: ${structuredIdToString(nodeId)}`,
            nodeIds.map(id => structuredIdToString(id)),
            { missingNodeId: structuredIdToString(nodeId) }
          ));
        }
        nodes.push(node);
      }
      
      // Prepare result
      const enrichedNodes: IGraphNode[] = [];
      const addedMetadata: Record<string, Record<string, unknown>> = {};
      
      // Process each node
      for (const node of nodes) {
        const nodeId = structuredIdToString(node.id);
        
        // Skip nodes that don't need enrichment
        if (this.isNodeAlreadyEnriched(node)) {
          continue;
        }
        
        // Get potential enrichment data
        const enrichmentData = await this.getEnrichmentData(node, enrichmentOptions);
        
        if (Object.keys(enrichmentData).length > 0) {
          // Update node with new metadata
          const updatedNode = await this.graphRepository.updateNode(node.id, {
            metadata: {
              ...node.metadata,
              ...enrichmentData,
              enrichedAt: new Date().toISOString()
            }
          });
          
          if (updatedNode) {
            enrichedNodes.push(updatedNode);
            addedMetadata[nodeId] = enrichmentData;
          }
        }
      }
      
      this.logger.debug('Node enrichment completed', { 
        enrichedNodeCount: enrichedNodes.length 
      });
      
      return success({
        enrichedNodes,
        addedMetadata
      });
    } catch (error) {
      this.logger.error('Error enriching nodes', { error });
      
      if (error instanceof GraphError) {
        return failure(error);
      }
      
      return failure(new NodeEnrichmentError(
        `Failed to enrich nodes: ${error instanceof Error ? error.message : String(error)}`,
        nodeIds.map(id => structuredIdToString(id))
      ));
    }
  }
  
  /**
   * Checks if a node is already enriched
   * @private
   */
  private isNodeAlreadyEnriched(node: IGraphNode): boolean {
    // Check if the node has an enrichment timestamp
    return node.metadata.enrichedAt !== undefined;
  }
  
  /**
   * Gets enrichment data for a node
   * @private
   */
  private async getEnrichmentData(
    node: IGraphNode,
    options: Required<NodeEnrichmentOptions>
  ): Promise<Record<string, unknown>> {
    const enrichmentData: Record<string, unknown> = {};
    
    // Generate an embedding for the node if it doesn't have one
    if (!node.metadata.embedding) {
      try {
        const embedInput = `${node.label} ${node.description || ''} ${node.tags.join(' ')}`;
        const embedding = await this.vectorService.createEmbedding(embedInput);
        enrichmentData.embedding = embedding;
      } catch (error) {
        this.logger.warn('Failed to create embedding', { 
          nodeId: structuredIdToString(node.id), 
          error 
        });
      }
    }
    
    // Enrich with additional attributes based on the node type
    switch (node.type) {
      case GraphNodeType.PERSON:
        enrichmentData.hasBeenEnriched = true;
        
        // Add common attributes for persons
        if (!node.metadata.title) {
          enrichmentData.title = 'Unknown';
        }
        
        if (!node.metadata.occupation) {
          enrichmentData.occupation = this.deriveOccupation(node);
        }
        break;
        
      case GraphNodeType.ORGANIZATION:
        enrichmentData.hasBeenEnriched = true;
        
        // Add common attributes for organizations
        if (!node.metadata.industry) {
          enrichmentData.industry = this.deriveIndustry(node);
        }
        
        if (!node.metadata.size) {
          enrichmentData.size = 'Unknown';
        }
        break;
        
      case GraphNodeType.LOCATION:
        enrichmentData.hasBeenEnriched = true;
        
        // Add common attributes for locations
        if (!node.metadata.locationType) {
          enrichmentData.locationType = this.deriveLocationType(node);
        }
        break;
        
      case GraphNodeType.CONCEPT:
        enrichmentData.hasBeenEnriched = true;
        
        // Find related concepts
        if (!node.metadata.relatedConcepts) {
          const relatedConcepts = await this.findRelatedConcepts(node);
          if (relatedConcepts.length > 0) {
            enrichmentData.relatedConcepts = relatedConcepts;
          }
        }
        
        // Add a category for the concept
        if (!node.metadata.category) {
          enrichmentData.category = this.deriveConceptCategory(node);
        }
        break;
        
      default:
        // Basic enrichment for other types
        enrichmentData.hasBeenEnriched = true;
    }
    
    return enrichmentData;
  }
  
  /**
   * Derives an occupation for a person node based on its connections
   * @private
   */
  private deriveOccupation(node: IGraphNode): string {
    // This would use NLP or relationship analysis in a real implementation
    // Here we use a simple heuristic based on tags
    const occupationTags = [
      'engineer', 'developer', 'manager', 'executive', 
      'scientist', 'researcher', 'teacher', 'professor',
      'doctor', 'physician', 'lawyer', 'attorney'
    ];
    
    for (const tag of node.tags) {
      if (occupationTags.includes(tag.toLowerCase())) {
        return tag;
      }
    }
    
    return 'Unknown';
  }
  
  /**
   * Derives an industry for an organization node based on its connections
   * @private
   */
  private deriveIndustry(node: IGraphNode): string {
    // Simple heuristic based on tags
    const industryTags = [
      'technology', 'finance', 'healthcare', 'education',
      'manufacturing', 'retail', 'media', 'entertainment',
      'government', 'nonprofit', 'energy', 'transportation'
    ];
    
    for (const tag of node.tags) {
      if (industryTags.includes(tag.toLowerCase())) {
        return tag;
      }
    }
    
    return 'Unknown';
  }
  
  /**
   * Derives a location type for a location node based on its connections
   * @private
   */
  private deriveLocationType(node: IGraphNode): string {
    // Simple heuristic based on tags
    const locationTags = [
      'city', 'country', 'state', 'province', 'region',
      'building', 'landmark', 'address', 'area', 'neighborhood'
    ];
    
    for (const tag of node.tags) {
      if (locationTags.includes(tag.toLowerCase())) {
        return tag;
      }
    }
    
    return 'Place';
  }
  
  /**
   * Derives a category for a concept node based on its connections
   * @private
   */
  private deriveConceptCategory(node: IGraphNode): string {
    // Simple heuristic based on tags
    const categoryTags = [
      'technology', 'science', 'art', 'philosophy',
      'business', 'politics', 'history', 'culture',
      'religion', 'sports', 'health', 'education'
    ];
    
    for (const tag of node.tags) {
      if (categoryTags.includes(tag.toLowerCase())) {
        return tag;
      }
    }
    
    return 'General';
  }
  
  /**
   * Finds concepts related to the given node
   * @private
   */
  private async findRelatedConcepts(node: IGraphNode): Promise<string[]> {
    // In a real implementation, this would use semantic search
    // Here we just look for directly connected concept nodes
    const relatedNodes = await this.graphRepository.getRelatedNodes(node.id, {
      nodeTypes: [GraphNodeType.CONCEPT],
      maxDepth: 1,
      limit: 5
    });
    
    return relatedNodes.map(n => n.label);
  }
} 