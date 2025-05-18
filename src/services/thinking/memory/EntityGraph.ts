import { ExtractedEntity, EntityType } from './EntityExtractor';
import { ExtractedRelationship, RelationshipType } from './RelationshipExtractor';
import { IdGenerator } from '@/utils/ulid';
import { ImportanceCalculatorService } from '../../importance/ImportanceCalculatorService';
import { ImportanceCalculationMode } from '../../importance/ImportanceCalculatorService';

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
  
  constructor(
    private readonly importanceCalculator: ImportanceCalculatorService
  ) {
    this.nodes = new Map();
    this.edges = new Map();
  }
  
  /**
   * Add an entity to the graph
   */
  async addEntity(entity: ExtractedEntity): Promise<EntityNode> {
    // Create node
    const node: EntityNode = {
      id: entity.id,
      entity,
      incomingRelationships: [],
      outgoingRelationships: [],
      metadata: {
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        accessCount: 0,
        importance: await this.calculateEntityImportance(entity)
      }
    };
    
    this.nodes.set(entity.id, node);
    return node;
  }
  
  /**
   * Add a relationship to the graph
   */
  async addRelationship(relationship: ExtractedRelationship): Promise<EntityEdge> {
    // Create edge
    const edge: EntityEdge = {
      id: relationship.id,
      relationship,
      metadata: {
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        accessCount: 0,
        importance: await this.calculateRelationshipImportance(relationship)
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
  private async calculateEntityImportance(entity: ExtractedEntity): Promise<number> {
    const result = await this.importanceCalculator.calculateImportance({
      content: entity.value,
      contentType: 'entity',
      source: 'graph',
      tags: [entity.type],
      existingScore: entity.confidence
    }, ImportanceCalculationMode.RULE_BASED);

    return result.importance_score;
  }
  
  /**
   * Calculate initial importance score for a relationship
   */
  private async calculateRelationshipImportance(relationship: ExtractedRelationship): Promise<number> {
    const result = await this.importanceCalculator.calculateImportance({
      content: `${relationship.sourceEntityId} ${relationship.type} ${relationship.targetEntityId}`,
      contentType: 'relationship',
      source: 'graph',
      tags: [relationship.type],
      existingScore: relationship.confidence
    }, ImportanceCalculationMode.RULE_BASED);

    return result.importance_score;
  }
} 