/**
 * Graph Repository Implementation
 * Provides data access for graph nodes and relationships
 */

import { 
  IGraphRepository,
  IGraphNode,
  IGraphRelationship,
  GraphNodeType,
  GraphRelationshipType,
  RelatedNodesOptions,
  NodeQuery,
  RelationshipQuery
} from './graph-types';
import { StructuredId, structuredIdToString } from '../../../types/structured-id';
import { GraphNodeError, GraphRelationshipError, GraphErrorCode } from './graph-errors';

/**
 * Type for ID generation function
 */
type IdGeneratorFn = (type: string) => StructuredId;

/**
 * In-memory implementation of IGraphRepository
 * In a production environment, this would be replaced with a database-backed implementation
 */
export class InMemoryGraphRepository implements IGraphRepository {
  private nodes: Map<string, IGraphNode> = new Map();
  private relationships: Map<string, IGraphRelationship> = new Map();
  
  constructor(
    private readonly generateId: IdGeneratorFn
  ) {}
  
  /**
   * Adds a node to the graph
   */
  async addNode(
    node: Omit<IGraphNode, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<IGraphNode> {
    const now = new Date();
    const id = this.generateId('node');
    
    const newNode: IGraphNode = {
      ...node,
      id,
      tags: node.tags || [],
      metadata: node.metadata || {},
      createdAt: now,
      updatedAt: now
    };
    
    this.nodes.set(structuredIdToString(id), newNode);
    return newNode;
  }
  
  /**
   * Gets a node by ID
   */
  async getNodeById(id: StructuredId): Promise<IGraphNode | null> {
    const node = this.nodes.get(structuredIdToString(id));
    return node || null;
  }
  
  /**
   * Updates a node
   */
  async updateNode(
    id: StructuredId, 
    updates: Partial<IGraphNode>
  ): Promise<IGraphNode | null> {
    const node = this.nodes.get(structuredIdToString(id));
    
    if (!node) {
      return null;
    }
    
    const updatedNode: IGraphNode = {
      ...node,
      ...updates,
      id: node.id, // Ensure ID isn't changed
      createdAt: node.createdAt, // Ensure creation date isn't changed
      updatedAt: new Date(), // Update modification time
      
      // Merge metadata rather than replace
      metadata: {
        ...node.metadata,
        ...(updates.metadata || {})
      },
      
      // Merge tags if provided
      tags: updates.tags || node.tags
    };
    
    this.nodes.set(structuredIdToString(id), updatedNode);
    return updatedNode;
  }
  
  /**
   * Deletes a node
   */
  async deleteNode(id: StructuredId): Promise<boolean> {
    const idStr = structuredIdToString(id);
    if (!this.nodes.has(idStr)) {
      return false;
    }
    
    // Delete all relationships involving this node
    for (const [relId, rel] of Array.from(this.relationships.entries())) {
      if (structuredIdToString(rel.sourceId) === idStr || structuredIdToString(rel.targetId) === idStr) {
        this.relationships.delete(relId);
      }
    }
    
    // Delete the node
    return this.nodes.delete(idStr);
  }
  
  /**
   * Adds a relationship to the graph
   */
  async addRelationship(
    relationship: Omit<IGraphRelationship, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<IGraphRelationship> {
    // Verify that source and target nodes exist
    if (!this.nodes.has(structuredIdToString(relationship.sourceId))) {
      throw new GraphRelationshipError(
        'Source node does not exist',
        structuredIdToString(relationship.sourceId),
        structuredIdToString(relationship.targetId),
        { sourceId: structuredIdToString(relationship.sourceId) }
      );
    }
    
    if (!this.nodes.has(structuredIdToString(relationship.targetId))) {
      throw new GraphRelationshipError(
        'Target node does not exist',
        structuredIdToString(relationship.sourceId),
        structuredIdToString(relationship.targetId),
        { targetId: structuredIdToString(relationship.targetId) }
      );
    }
    
    // Check for self-relationships
    if (structuredIdToString(relationship.sourceId) === structuredIdToString(relationship.targetId)) {
      throw new GraphRelationshipError(
        'Self-relationships are not allowed',
        structuredIdToString(relationship.sourceId),
        structuredIdToString(relationship.targetId),
        { errorCode: GraphErrorCode.SELF_RELATIONSHIP }
      );
    }
    
    const now = new Date();
    const id = this.generateId('rel');
    
    const newRelationship: IGraphRelationship = {
      ...relationship,
      id,
      strength: relationship.strength ?? 1.0,
      metadata: relationship.metadata || {},
      createdAt: now,
      updatedAt: now
    };
    
    this.relationships.set(structuredIdToString(id), newRelationship);
    return newRelationship;
  }
  
  /**
   * Gets a relationship by ID
   */
  async getRelationshipById(id: StructuredId): Promise<IGraphRelationship | null> {
    const relationship = this.relationships.get(structuredIdToString(id));
    return relationship || null;
  }
  
  /**
   * Updates a relationship
   */
  async updateRelationship(
    id: StructuredId, 
    updates: Partial<IGraphRelationship>
  ): Promise<IGraphRelationship | null> {
    const relationship = this.relationships.get(structuredIdToString(id));
    
    if (!relationship) {
      return null;
    }
    
    const updatedRelationship: IGraphRelationship = {
      ...relationship,
      ...updates,
      id: relationship.id, // Ensure ID isn't changed
      sourceId: relationship.sourceId, // Keep source node fixed
      targetId: relationship.targetId, // Keep target node fixed
      createdAt: relationship.createdAt, // Ensure creation date isn't changed
      updatedAt: new Date(), // Update modification time
      
      // Merge metadata rather than replace
      metadata: {
        ...relationship.metadata,
        ...(updates.metadata || {})
      }
    };
    
    this.relationships.set(structuredIdToString(id), updatedRelationship);
    return updatedRelationship;
  }
  
  /**
   * Deletes a relationship
   */
  async deleteRelationship(id: StructuredId): Promise<boolean> {
    return this.relationships.delete(structuredIdToString(id));
  }
  
  /**
   * Finds relationships between two nodes
   */
  async findRelationships(
    sourceId: StructuredId, 
    targetId: StructuredId
  ): Promise<IGraphRelationship[]> {
    const results: IGraphRelationship[] = [];
    
    for (const relationship of Array.from(this.relationships.values())) {
      const isSourceToTarget = 
        structuredIdToString(relationship.sourceId) === structuredIdToString(sourceId) && 
        structuredIdToString(relationship.targetId) === structuredIdToString(targetId);
      
      const isTargetToSource = 
        structuredIdToString(relationship.sourceId) === structuredIdToString(targetId) && 
        structuredIdToString(relationship.targetId) === structuredIdToString(sourceId);
      
      if (isSourceToTarget || isTargetToSource) {
        results.push(relationship);
      }
    }
    
    return results;
  }
  
  /**
   * Gets all nodes related to a node
   */
  async getRelatedNodes(
    nodeId: StructuredId, 
    options: RelatedNodesOptions = {}
  ): Promise<IGraphNode[]> {
    // Set default options
    const relatedOptions = {
      relationshipTypes: options.relationshipTypes || [],
      nodeTypes: options.nodeTypes || [],
      direction: options.direction || 'both',
      maxDepth: options.maxDepth || 1,
      limit: options.limit || 100
    };
    
    // Ensure the node exists
    if (!this.nodes.has(structuredIdToString(nodeId))) {
      throw new GraphNodeError(
        'Node does not exist',
        structuredIdToString(nodeId),
        { errorCode: GraphErrorCode.NODE_NOT_FOUND }
      );
    }
    
    const results = new Map<string, IGraphNode>();
    const visited = new Set<string>([structuredIdToString(nodeId)]);
    
    // Breadth-first search for related nodes
    const queue: Array<{ id: string; depth: number }> = [{ id: structuredIdToString(nodeId), depth: 0 }];
    
    while (queue.length > 0 && results.size < relatedOptions.limit) {
      const { id, depth } = queue.shift()!;
      
      if (depth >= relatedOptions.maxDepth) {
        continue;
      }
      
      // Find all relationships for this node
      for (const relationship of Array.from(this.relationships.values())) {
        // Check direction and types
        let relatedNodeId: string | null = null;
        
        if (relatedOptions.direction === 'outgoing' || relatedOptions.direction === 'both') {
          if (structuredIdToString(relationship.sourceId) === id) {
            relatedNodeId = structuredIdToString(relationship.targetId);
          }
        }
        
        if (relatedOptions.direction === 'incoming' || relatedOptions.direction === 'both') {
          if (structuredIdToString(relationship.targetId) === id) {
            relatedNodeId = structuredIdToString(relationship.sourceId);
          }
        }
        
        // Skip if no related node found or already visited
        if (!relatedNodeId || visited.has(relatedNodeId)) {
          continue;
        }
        
        // Check relationship type if specified
        if (
          relatedOptions.relationshipTypes.length > 0 && 
          !relatedOptions.relationshipTypes.includes(relationship.type)
        ) {
          continue;
        }
        
        // Get the related node
        const relatedNode = this.nodes.get(relatedNodeId);
        
        if (relatedNode) {
          // Check node type if specified
          if (
            relatedOptions.nodeTypes.length > 0 && 
            !relatedOptions.nodeTypes.includes(relatedNode.type)
          ) {
            continue;
          }
          
          // Add to results
          results.set(relatedNodeId, relatedNode);
          visited.add(relatedNodeId);
          
          // Add to queue for next depth
          queue.push({ id: relatedNodeId, depth: depth + 1 });
          
          // Check limit
          if (results.size >= relatedOptions.limit) {
            break;
          }
        }
      }
    }
    
    return Array.from(results.values());
  }
  
  /**
   * Finds nodes by query
   */
  async findNodes(query: NodeQuery): Promise<IGraphNode[]> {
    // Set defaults
    const nodeQuery = {
      types: query.types || [],
      tags: query.tags || [],
      labelContains: query.labelContains || '',
      createdAfter: query.createdAfter,
      createdBefore: query.createdBefore,
      limit: query.limit || 100,
      offset: query.offset || 0
    };
    
    // Filter nodes
    let filteredNodes = Array.from(this.nodes.values());
    
    // Filter by type
    if (nodeQuery.types.length > 0) {
      filteredNodes = filteredNodes.filter(node => 
        nodeQuery.types!.includes(node.type)
      );
    }
    
    // Filter by tags (match any tag)
    if (nodeQuery.tags.length > 0) {
      filteredNodes = filteredNodes.filter(node => 
        node.tags.some(tag => nodeQuery.tags!.includes(tag))
      );
    }
    
    // Filter by label
    if (nodeQuery.labelContains) {
      const lowerCaseLabel = nodeQuery.labelContains.toLowerCase();
      filteredNodes = filteredNodes.filter(node => 
        node.label.toLowerCase().includes(lowerCaseLabel)
      );
    }
    
    // Filter by creation date
    if (nodeQuery.createdAfter) {
      filteredNodes = filteredNodes.filter(node => 
        node.createdAt >= nodeQuery.createdAfter!
      );
    }
    
    if (nodeQuery.createdBefore) {
      filteredNodes = filteredNodes.filter(node => 
        node.createdAt <= nodeQuery.createdBefore!
      );
    }
    
    // Apply pagination
    return filteredNodes
      .slice(nodeQuery.offset, nodeQuery.offset + nodeQuery.limit);
  }
  
  /**
   * Finds relationships by query
   */
  async findRelationshipsByQuery(query: RelationshipQuery): Promise<IGraphRelationship[]> {
    // Set defaults
    const relationshipQuery = {
      types: query.types || [],
      sourceNodeId: query.sourceNodeId,
      targetNodeId: query.targetNodeId,
      minStrength: query.minStrength || 0,
      createdAfter: query.createdAfter,
      createdBefore: query.createdBefore,
      limit: query.limit || 100,
      offset: query.offset || 0
    };
    
    // Filter relationships
    let filteredRelationships = Array.from(this.relationships.values());
    
    // Filter by type
    if (relationshipQuery.types.length > 0) {
      filteredRelationships = filteredRelationships.filter(rel => 
        relationshipQuery.types!.includes(rel.type)
      );
    }
    
    // Filter by source node
    if (relationshipQuery.sourceNodeId) {
      filteredRelationships = filteredRelationships.filter(rel => 
        structuredIdToString(rel.sourceId) === structuredIdToString(relationshipQuery.sourceNodeId!)
      );
    }
    
    // Filter by target node
    if (relationshipQuery.targetNodeId) {
      filteredRelationships = filteredRelationships.filter(rel => 
        structuredIdToString(rel.targetId) === structuredIdToString(relationshipQuery.targetNodeId!)
      );
    }
    
    // Filter by strength
    if (relationshipQuery.minStrength > 0) {
      filteredRelationships = filteredRelationships.filter(rel => 
        rel.strength >= relationshipQuery.minStrength!
      );
    }
    
    // Filter by creation date
    if (relationshipQuery.createdAfter) {
      filteredRelationships = filteredRelationships.filter(rel => 
        rel.createdAt >= relationshipQuery.createdAfter!
      );
    }
    
    if (relationshipQuery.createdBefore) {
      filteredRelationships = filteredRelationships.filter(rel => 
        rel.createdAt <= relationshipQuery.createdBefore!
      );
    }
    
    // Apply pagination
    return filteredRelationships
      .slice(relationshipQuery.offset, relationshipQuery.offset + relationshipQuery.limit);
  }
} 