import { ExtractedEntity, EntityType } from './EntityExtractor';
import { ExtractedRelationship, RelationshipType } from './RelationshipExtractor';
import { IdGenerator } from '@/utils/ulid';

/**
 * Node in the entity graph
 */
export interface EntityNode {
  id: string;
  entity: ExtractedEntity;
  incomingRelationships: string[];
  outgoingRelationships: string[];
  metadata: {
    createdAt: string;
    lastUpdated: string;
    accessCount: number;
    importance: number;
  };
}

/**
 * Edge in the entity graph
 */
export interface EntityEdge {
  id: string;
  relationship: ExtractedRelationship;
  metadata: {
    createdAt: string;
    lastUpdated: string;
    accessCount: number;
    importance: number;
  };
}

/**
 * Graph traversal options
 */
export interface GraphTraversalOptions {
  maxDepth?: number;
  minConfidence?: number;
  relationshipTypes?: RelationshipType[];
  entityTypes?: EntityType[];
  sortBy?: 'confidence' | 'importance' | 'recency';
  limit?: number;
}

/**
 * Service for managing entity relationships in a graph structure
 */
export class EntityGraph {
  private nodes: Map<string, EntityNode>;
  private edges: Map<string, EntityEdge>;
  
  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
  }
  
  /**
   * Add an entity to the graph
   */
  addEntity(entity: ExtractedEntity): EntityNode {
    const node: EntityNode = {
      id: entity.id,
      entity,
      incomingRelationships: [],
      outgoingRelationships: [],
      metadata: {
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        accessCount: 0,
        importance: this.calculateEntityImportance(entity)
      }
    };
    
    this.nodes.set(entity.id, node);
    return node;
  }
  
  /**
   * Add a relationship to the graph
   */
  addRelationship(relationship: ExtractedRelationship): EntityEdge {
    // Create edge
    const edge: EntityEdge = {
      id: relationship.id,
      relationship,
      metadata: {
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        accessCount: 0,
        importance: this.calculateRelationshipImportance(relationship)
      }
    };
    
    this.edges.set(relationship.id, edge);
    
    // Update node connections
    const sourceNode = this.nodes.get(relationship.sourceEntityId);
    const targetNode = this.nodes.get(relationship.targetEntityId);
    
    if (sourceNode && targetNode) {
      sourceNode.outgoingRelationships.push(relationship.id);
      targetNode.incomingRelationships.push(relationship.id);
    }
    
    return edge;
  }
  
  /**
   * Get related entities for a given entity
   */
  getRelatedEntities(
    entityId: string,
    options: GraphTraversalOptions = {}
  ): ExtractedEntity[] {
    const {
      maxDepth = 2,
      minConfidence = 0.6,
      relationshipTypes = Object.values(RelationshipType),
      entityTypes = Object.values(EntityType),
      sortBy = 'confidence',
      limit = 10
    } = options;
    
    const visited = new Set<string>();
    const relatedEntities: ExtractedEntity[] = [];
    
    // Recursive traversal function
    const traverse = (currentId: string, depth: number) => {
      if (depth > maxDepth || visited.has(currentId)) {
        return;
      }
      
      visited.add(currentId);
      const node = this.nodes.get(currentId);
      
      if (!node) return;
      
      // Get all relationships
      const relationships = [
        ...node.outgoingRelationships.map(id => this.edges.get(id)),
        ...node.incomingRelationships.map(id => this.edges.get(id))
      ].filter((edge): edge is EntityEdge => !!edge);
      
      // Filter and process relationships
      for (const edge of relationships) {
        if (edge.relationship.confidence < minConfidence) continue;
        if (!relationshipTypes.includes(edge.relationship.type)) continue;
        
        const relatedId = edge.relationship.sourceEntityId === currentId
          ? edge.relationship.targetEntityId
          : edge.relationship.sourceEntityId;
          
        const relatedNode = this.nodes.get(relatedId);
        
        if (relatedNode && 
            entityTypes.includes(relatedNode.entity.type) &&
            !visited.has(relatedId)) {
          relatedEntities.push(relatedNode.entity);
          traverse(relatedId, depth + 1);
        }
      }
    };
    
    // Start traversal
    traverse(entityId, 0);
    
    // Sort and limit results
    return relatedEntities
      .sort((a, b) => {
        switch (sortBy) {
          case 'confidence':
            return b.confidence - a.confidence;
          case 'importance':
            return (this.nodes.get(b.id)?.metadata.importance ?? 0) -
                   (this.nodes.get(a.id)?.metadata.importance ?? 0);
          case 'recency':
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
          default:
            return 0;
        }
      })
      .slice(0, limit);
  }
  
  /**
   * Find paths between two entities
   */
  findPaths(
    startId: string,
    endId: string,
    options: GraphTraversalOptions = {}
  ): Array<{
    path: ExtractedEntity[];
    relationships: ExtractedRelationship[];
    confidence: number;
  }> {
    const {
      maxDepth = 3,
      minConfidence = 0.6,
      relationshipTypes = Object.values(RelationshipType)
    } = options;
    
    const paths: Array<{
      path: ExtractedEntity[];
      relationships: ExtractedRelationship[];
      confidence: number;
    }> = [];
    
    const visited = new Set<string>();
    
    // Recursive path finding function
    const findPath = (
      currentId: string,
      targetId: string,
      currentPath: ExtractedEntity[],
      currentRelationships: ExtractedRelationship[],
      depth: number
    ) => {
      if (depth > maxDepth || visited.has(currentId)) {
        return;
      }
      
      visited.add(currentId);
      const node = this.nodes.get(currentId);
      
      if (!node) return;
      
      currentPath.push(node.entity);
      
      if (currentId === targetId) {
        // Calculate path confidence as average of all relationships
        const confidence = currentRelationships.length > 0
          ? currentRelationships.reduce((sum, rel) => sum + rel.confidence, 0) / currentRelationships.length
          : 0;
          
        paths.push({
          path: [...currentPath],
          relationships: [...currentRelationships],
          confidence
        });
      } else {
        // Get all relationships
        const relationships = [
          ...node.outgoingRelationships.map(id => this.edges.get(id)),
          ...node.incomingRelationships.map(id => this.edges.get(id))
        ].filter((edge): edge is EntityEdge => !!edge);
        
        // Filter and traverse relationships
        for (const edge of relationships) {
          if (edge.relationship.confidence < minConfidence) continue;
          if (!relationshipTypes.includes(edge.relationship.type)) continue;
          
          const nextId = edge.relationship.sourceEntityId === currentId
            ? edge.relationship.targetEntityId
            : edge.relationship.sourceEntityId;
            
          if (!visited.has(nextId)) {
            findPath(
              nextId,
              targetId,
              [...currentPath],
              [...currentRelationships, edge.relationship],
              depth + 1
            );
          }
        }
      }
      
      visited.delete(currentId);
    };
    
    // Start path finding
    findPath(startId, endId, [], [], 0);
    
    // Sort paths by confidence
    return paths.sort((a, b) => b.confidence - a.confidence);
  }
  
  /**
   * Calculate initial importance score for an entity
   */
  private calculateEntityImportance(entity: ExtractedEntity): number {
    let importance = entity.confidence;
    
    // Boost importance based on type
    switch (entity.type) {
      case EntityType.PERSON:
      case EntityType.ORGANIZATION:
        importance *= 1.2;
        break;
      case EntityType.CONCEPT:
      case EntityType.GOAL:
        importance *= 1.1;
        break;
      case EntityType.TASK:
      case EntityType.ACTION:
        importance *= 1.05;
        break;
    }
    
    // Boost if has related entities
    if (entity.relatedEntities && entity.relatedEntities.length > 0) {
      importance *= (1 + 0.05 * entity.relatedEntities.length);
    }
    
    return Math.min(1, importance);
  }
  
  /**
   * Calculate initial importance score for a relationship
   */
  private calculateRelationshipImportance(relationship: ExtractedRelationship): number {
    let importance = relationship.confidence;
    
    // Boost importance based on type
    switch (relationship.type) {
      case RelationshipType.DEPENDS_ON:
      case RelationshipType.PART_OF:
        importance *= 1.2;
        break;
      case RelationshipType.CAUSES:
      case RelationshipType.IMPLEMENTS:
        importance *= 1.1;
        break;
      case RelationshipType.USES:
      case RelationshipType.CREATES:
        importance *= 1.05;
        break;
    }
    
    // Boost if has strength score
    if (relationship.strength) {
      importance *= (1 + 0.1 * relationship.strength);
    }
    
    return Math.min(1, importance);
  }
} 