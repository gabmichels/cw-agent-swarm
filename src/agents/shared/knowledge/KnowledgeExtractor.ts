/**
 * Knowledge Extractor
 * 
 * Utility class for extracting knowledge from text content and adding it to a knowledge graph.
 * Implements text analysis to identify entities, concepts, and relationships.
 */

import {
  KnowledgeGraph,
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeNodeType,
  KnowledgeEdgeType,
  KnowledgeExtractionOptions,
  KnowledgeExtractionResult
} from './interfaces/KnowledgeGraph.interface';

/**
 * Configuration options for the KnowledgeExtractor
 */
export interface KnowledgeExtractorConfig {
  /**
   * Minimum confidence threshold for extraction (0-1)
   */
  minConfidence?: number;
  
  /**
   * Maximum number of nodes to extract
   */
  maxNodes?: number;
  
  /**
   * Maximum number of edges to extract
   */
  maxEdges?: number;
  
  /**
   * Node types to extract
   */
  nodeTypes?: KnowledgeNodeType[];
  
  /**
   * Edge types to extract
   */
  edgeTypes?: KnowledgeEdgeType[];
  
  /**
   * Whether to automatically add extracted knowledge to the graph
   */
  autoAddToGraph?: boolean;
  
  /**
   * Confidence threshold above which nodes are considered high-confidence
   */
  highConfidenceThreshold?: number;
}

/**
 * Default configuration for the KnowledgeExtractor
 */
const DEFAULT_CONFIG: KnowledgeExtractorConfig = {
  minConfidence: 0.5,
  maxNodes: 50,
  maxEdges: 100,
  nodeTypes: Object.values(KnowledgeNodeType),
  edgeTypes: Object.values(KnowledgeEdgeType),
  autoAddToGraph: true,
  highConfidenceThreshold: 0.8
};

/**
 * Result of a single entity extraction
 */
interface ExtractedEntity {
  type: KnowledgeNodeType;
  label: string;
  confidence: number;
  description?: string;
  tags?: string[];
  startIndex?: number;
  endIndex?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Result of a single relationship extraction
 */
interface ExtractedRelationship {
  type: KnowledgeEdgeType;
  sourceIndex: number;
  targetIndex: number;
  confidence: number;
  label?: string;
  strength?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Knowledge extraction error types
 */
export class KnowledgeExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KnowledgeExtractionError';
  }
}

/**
 * Knowledge extractor utility class
 * 
 * Extracts structured knowledge from text content to populate a knowledge graph
 */
export class KnowledgeExtractor {
  private config: KnowledgeExtractorConfig;
  
  /**
   * Create a new KnowledgeExtractor
   * 
   * @param graph Knowledge graph to work with
   * @param config Configuration options
   */
  constructor(
    private readonly graph: KnowledgeGraph,
    config?: Partial<KnowledgeExtractorConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Extract knowledge from text content
   * 
   * @param options Extraction options
   * @returns Extraction result
   */
  async extractKnowledge(options: KnowledgeExtractionOptions): Promise<KnowledgeExtractionResult> {
    const startTime = Date.now();
    
    // Apply configuration defaults
    const minConfidence = options.minConfidence ?? this.config.minConfidence;
    const maxNodes = options.maxNodes ?? this.config.maxNodes;
    const maxEdges = options.maxEdges ?? this.config.maxEdges;
    const nodeTypes = options.nodeTypes ?? this.config.nodeTypes;
    const edgeTypes = options.edgeTypes ?? this.config.edgeTypes;
    
    // Extract entities and relationships
    const { entities, relationships } = await this.analyzeContent(
      options.content,
      nodeTypes,
      edgeTypes,
      minConfidence,
      options.context
    );
    
    // Apply limits
    const filteredEntities = entities
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxNodes);
      
    const filteredRelationships = relationships
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxEdges)
      // Filter relationships to only include entities that weren't filtered out
      .filter(rel => 
        rel.sourceIndex < filteredEntities.length && 
        rel.targetIndex < filteredEntities.length
      );
    
    // Convert to knowledge nodes and edges
    const nodes: KnowledgeNode[] = [];
    const nodeIdMap: Map<number, string> = new Map();
    
    // Add nodes to graph if auto-add is enabled
    if (this.config.autoAddToGraph) {
      for (const entity of filteredEntities) {
        try {
          const nodeData: Omit<KnowledgeNode, 'id'> = {
            label: entity.label,
            type: entity.type,
            description: entity.description,
            tags: entity.tags,
            confidence: entity.confidence,
            source: options.source,
            properties: {
              extractedFrom: 'text',
              ...(entity.startIndex !== undefined && entity.endIndex !== undefined 
                ? { textSpan: `${entity.startIndex}-${entity.endIndex}` } 
                : {})
            },
            metadata: entity.metadata
          };
          
          const nodeId = await this.graph.addNode(nodeData);
          const node = await this.graph.getNode(nodeId);
          if (node) {
            nodes.push(node);
            const entityIndex = filteredEntities.indexOf(entity);
            nodeIdMap.set(entityIndex, nodeId);
          }
        } catch (error) {
          console.error('Error adding node to graph:', error);
        }
      }
      
      // Add edges to graph
      const edges: KnowledgeEdge[] = [];
      for (const relationship of filteredRelationships) {
        try {
          const sourceId = nodeIdMap.get(relationship.sourceIndex);
          const targetId = nodeIdMap.get(relationship.targetIndex);
          
          if (sourceId && targetId) {
            const edgeData: KnowledgeEdge = {
              from: sourceId,
              to: targetId,
              type: relationship.type,
              label: relationship.label,
              strength: relationship.strength ?? relationship.confidence,
              properties: {
                extractedFrom: 'text',
                confidence: relationship.confidence
              },
              metadata: relationship.metadata
            };
            
            await this.graph.addEdge(edgeData);
            edges.push(edgeData);
          }
        } catch (error) {
          console.error('Error adding edge to graph:', error);
        }
      }
      
      // Return the extraction result
      const processingTimeMs = Date.now() - startTime;
      
      return {
        nodes,
        edges,
        confidence: this.calculateOverallConfidence(filteredEntities, filteredRelationships),
        stats: {
          processingTimeMs,
          entityCount: nodes.length,
          relationshipCount: edges.length,
          avgConfidence: this.calculateAverageConfidence(filteredEntities, filteredRelationships)
        }
      };
    } else {
      // Just return the extracted data without adding to graph
      const nodes: KnowledgeNode[] = filteredEntities.map((entity, index) => ({
        id: `temp_${index}`,
        label: entity.label,
        type: entity.type,
        description: entity.description,
        tags: entity.tags,
        confidence: entity.confidence,
        source: options.source,
        properties: {
          extractedFrom: 'text',
          ...(entity.startIndex !== undefined && entity.endIndex !== undefined 
            ? { textSpan: `${entity.startIndex}-${entity.endIndex}` } 
            : {})
        },
        metadata: entity.metadata
      }));
      
      const edges: KnowledgeEdge[] = filteredRelationships.map(rel => ({
        from: `temp_${rel.sourceIndex}`,
        to: `temp_${rel.targetIndex}`,
        type: rel.type,
        label: rel.label,
        strength: rel.strength ?? rel.confidence,
        properties: {
          extractedFrom: 'text',
          confidence: rel.confidence
        },
        metadata: rel.metadata
      }));
      
      const processingTimeMs = Date.now() - startTime;
      
      return {
        nodes,
        edges,
        confidence: this.calculateOverallConfidence(filteredEntities, filteredRelationships),
        stats: {
          processingTimeMs,
          entityCount: nodes.length,
          relationshipCount: edges.length,
          avgConfidence: this.calculateAverageConfidence(filteredEntities, filteredRelationships)
        }
      };
    }
  }
  
  /**
   * Calculate the overall confidence of an extraction
   */
  private calculateOverallConfidence(
    entities: ExtractedEntity[], 
    relationships: ExtractedRelationship[]
  ): number {
    if (entities.length === 0) {
      return 0;
    }
    
    // Overall confidence is weighted average of entity and relationship confidences
    const entityConfidenceSum = entities.reduce((sum, entity) => sum + entity.confidence, 0);
    const entityConfidenceAvg = entityConfidenceSum / entities.length;
    
    if (relationships.length === 0) {
      return entityConfidenceAvg;
    }
    
    const relationshipConfidenceSum = relationships.reduce(
      (sum, rel) => sum + rel.confidence, 0
    );
    const relationshipConfidenceAvg = relationshipConfidenceSum / relationships.length;
    
    // Weight entity confidence higher (60%) than relationship confidence (40%)
    return entityConfidenceAvg * 0.6 + relationshipConfidenceAvg * 0.4;
  }
  
  /**
   * Calculate the average confidence of entities and relationships
   */
  private calculateAverageConfidence(
    entities: ExtractedEntity[], 
    relationships: ExtractedRelationship[]
  ): number {
    const totalItems = entities.length + relationships.length;
    if (totalItems === 0) {
      return 0;
    }
    
    const totalConfidence = entities.reduce((sum, entity) => sum + entity.confidence, 0) +
      relationships.reduce((sum, rel) => sum + rel.confidence, 0);
    
    return totalConfidence / totalItems;
  }
  
  /**
   * Analyze content to extract entities and relationships
   * 
   * This method uses a basic keyword and pattern matching approach as a placeholder.
   * In a real implementation, this would use more sophisticated NLP techniques.
   */
  private async analyzeContent(
    content: string,
    nodeTypes: KnowledgeNodeType[] = [],
    edgeTypes: KnowledgeEdgeType[] = [],
    minConfidence: number = 0.5,
    context?: Record<string, unknown>
  ): Promise<{
    entities: ExtractedEntity[];
    relationships: ExtractedRelationship[];
  }> {
    // This is a simplified implementation for demonstration
    // In a real system, this would use more sophisticated NLP and pattern recognition
    
    const entities: ExtractedEntity[] = [];
    const relationships: ExtractedRelationship[] = [];
    
    // Simple entity extraction based on common patterns
    
    // Concepts (typically noun phrases)
    if (nodeTypes.includes(KnowledgeNodeType.CONCEPT)) {
      const conceptPatterns = [
        /([A-Z][a-z]+ (?:of )?[A-Za-z]+(?: [A-Za-z]+)* (?:theory|concept|framework|approach|paradigm|model))/g,
        /([A-Z][a-z]+ (?:of )?[A-Za-z]+(?:[- ][A-Za-z]+){0,3})/g,
        /(?:concept of|idea of|notion of) ([A-Za-z]+(?: [A-Za-z]+){0,3})/g,
        /([A-Z][a-z]+(?: [A-Z]?[a-z]+){1,3})/g, // Match proper noun phrases like "Theory of Relativity"
        /([Mm]achine [Ll]earning|[Aa]rtificial [Ii]ntelligence|[Dd]eep [Ll]earning|[Nn]atural [Ll]anguage [Pp]rocessing)/g // Common AI concepts
      ];
      
      for (const pattern of conceptPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          if (match[1]) {
            entities.push({
              type: KnowledgeNodeType.CONCEPT,
              label: match[1].trim(),
              confidence: 0.7 + Math.random() * 0.2, // Simulated confidence
              startIndex: match.index,
              endIndex: match.index + match[0].length,
              tags: ['extracted', 'concept']
            });
          }
        }
      }
    }
    
    // Tools (things used to accomplish tasks)
    if (nodeTypes.includes(KnowledgeNodeType.TOOL)) {
      const toolPatterns = [
        /([A-Z][a-zA-Z0-9]+(?: [A-Z][a-zA-Z0-9]+)*) (?:tool|library|framework|platform|technology|API|language)/g,
        /using ([A-Z][a-zA-Z0-9]+(?: [A-Z][a-zA-Z0-9]+)*) to/g,
        /([A-Za-z]+(?: [A-Za-z]+){0,2}) (?:is|as) a (?:tool|language|framework|library)/ig,
        /([A-Za-z]+(?:Script|Lang|DB|Kit|.js|.ts))/g, // Common programming language/tool patterns
        /([Pp]ython|[Tt]ype[Ss]cript|[Jj]ava[Ss]cript|[Tt]esting frameworks?)/g // Common development tools
      ];
      
      for (const pattern of toolPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          if (match[1]) {
            entities.push({
              type: KnowledgeNodeType.TOOL,
              label: match[1].trim(),
              confidence: 0.75 + Math.random() * 0.15,
              startIndex: match.index,
              endIndex: match.index + match[0].length,
              tags: ['extracted', 'tool']
            });
          }
        }
      }
    }
    
    // Processes (sequences of actions)
    if (nodeTypes.includes(KnowledgeNodeType.PROCESS)) {
      const processPatterns = [
        /([A-Z][a-z]+ (?:[a-z]+ )*(?:process|procedure|method|technique|workflow))/g,
        /(?:process of|method of|approach to) ([A-Za-z]+(?: [A-Za-z]+){0,3})/g,
        /([a-z]+ (?:process|workflow|method|procedure))/ig,
        /([Dd]evelopment process|[Dd]eployment workflow|[Tt]raining process|[Dd]ata [Cc]leaning|[Tt]esting|[Dd]ebugging)/g // Common processes
      ];
      
      for (const pattern of processPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          if (match[1]) {
            entities.push({
              type: KnowledgeNodeType.PROCESS,
              label: match[1].trim(),
              confidence: 0.7 + Math.random() * 0.2,
              startIndex: match.index,
              endIndex: match.index + match[0].length,
              tags: ['extracted', 'process']
            });
          }
        }
      }
    }
    
    // Find relationships between the extracted entities
    if (entities.length >= 2) {
      // Simple proximity-based relationship extraction
      for (let i = 0; i < entities.length; i++) {
        for (let j = 0; j < entities.length; j++) {
          if (i === j) continue; // Skip self-relationships
          
          const entity1 = entities[i];
          const entity2 = entities[j];
          
          // Check if entities are close to each other (within 300 characters)
          const proximityDistance = Math.abs(
            (entity1.startIndex ?? 0) - (entity2.startIndex ?? 0)
          );
          
          if (proximityDistance < 300) { // Increased distance to catch more relationships
            // Extract the text between the entities to determine relationship type
            const startIdx = Math.min(
              (entity1.endIndex ?? 0),
              (entity2.endIndex ?? 0)
            );
            const endIdx = Math.max(
              (entity1.startIndex ?? 0),
              (entity2.startIndex ?? 0)
            );
            
            if (startIdx < endIdx) {
              const connectorText = content.substring(startIdx, endIdx).toLowerCase();
              
              let relationshipType: KnowledgeEdgeType | null = null;
              
              // Simple pattern matching for relationship type
              if (connectorText.includes('depend') || connectorText.includes('requires') || connectorText.includes('need')) {
                relationshipType = KnowledgeEdgeType.DEPENDS_ON;
              } else if (connectorText.includes('part of') || connectorText.includes('component of') || connectorText.includes('subset of')) {
                relationshipType = KnowledgeEdgeType.PART_OF;
              } else if (connectorText.includes('leads to') || connectorText.includes('results in') || connectorText.includes('causes')) {
                relationshipType = KnowledgeEdgeType.LEADS_TO;
              } else if (connectorText.includes('similar to') || connectorText.includes('like') || connectorText.includes('resembles')) {
                relationshipType = KnowledgeEdgeType.SIMILAR_TO;
              } else if (connectorText.includes('contradicts') || connectorText.includes('opposes') || connectorText.includes('disagrees')) {
                relationshipType = KnowledgeEdgeType.CONTRADICTS;
              } else if (connectorText.includes('supports') || connectorText.includes('confirms') || connectorText.includes('validates')) {
                relationshipType = KnowledgeEdgeType.SUPPORTS;
              } else if (connectorText.includes('used by') || connectorText.includes('utilized by') || connectorText.includes('employed by')) {
                relationshipType = KnowledgeEdgeType.USED_BY;
              } else if (connectorText.includes('derives from') || connectorText.includes('based on') || connectorText.includes('originates from')) {
                relationshipType = KnowledgeEdgeType.DERIVED_FROM;
              } else if (connectorText.includes('influences') || connectorText.includes('affects') || connectorText.includes('impacts')) {
                relationshipType = KnowledgeEdgeType.INFLUENCES;
              } else if (connectorText.includes('references') || connectorText.includes('refers to') || connectorText.includes('cites')) {
                relationshipType = KnowledgeEdgeType.REFERENCES;
              } else {
                // Try to infer relationship type from the entities themselves
                if (entity1.type === KnowledgeNodeType.PROCESS && entity2.type === KnowledgeNodeType.TOOL) {
                  relationshipType = KnowledgeEdgeType.USED_BY;
                } else if (entity1.type === KnowledgeNodeType.TOOL && entity2.type === KnowledgeNodeType.PROCESS) {
                  relationshipType = KnowledgeEdgeType.USED_BY;
                } else if (entity1.type === KnowledgeNodeType.CONCEPT && entity2.type === KnowledgeNodeType.CONCEPT) {
                  relationshipType = KnowledgeEdgeType.RELATED_TO;
                } else {
                  relationshipType = KnowledgeEdgeType.RELATED_TO;
                }
              }
              
              // Only add the relationship if it's in the allowed types
              if (edgeTypes.includes(relationshipType)) {
                // Relationship confidence is based on proximity and entity confidences
                const proximityFactor = Math.max(0, 1 - (proximityDistance / 300));
                const confidenceFactor = (entity1.confidence + entity2.confidence) / 2;
                const relationshipConfidence = proximityFactor * confidenceFactor;
                
                if (relationshipConfidence >= minConfidence) {
                  relationships.push({
                    type: relationshipType,
                    sourceIndex: i,
                    targetIndex: j,
                    confidence: relationshipConfidence,
                    label: this.generateRelationshipLabel(relationshipType),
                    strength: proximityFactor
                  });
                }
              }
            }
          }
        }
      }
    }
    
    // Filter out entities below the minimum confidence threshold
    const filteredEntities = entities.filter(entity => entity.confidence >= minConfidence);
    
    return {
      entities: filteredEntities,
      relationships
    };
  }
  
  /**
   * Generate a human-readable label for a relationship type
   */
  private generateRelationshipLabel(type: KnowledgeEdgeType): string {
    switch (type) {
      case KnowledgeEdgeType.RELATED_TO:
        return 'Related to';
      case KnowledgeEdgeType.DEPENDS_ON:
        return 'Depends on';
      case KnowledgeEdgeType.CONTRADICTS:
        return 'Contradicts';
      case KnowledgeEdgeType.SUPPORTS:
        return 'Supports';
      case KnowledgeEdgeType.USED_BY:
        return 'Used by';
      case KnowledgeEdgeType.REPORTED_BY:
        return 'Reported by';
      case KnowledgeEdgeType.PRODUCED_BY:
        return 'Produced by';
      case KnowledgeEdgeType.PART_OF:
        return 'Part of';
      case KnowledgeEdgeType.LEADS_TO:
        return 'Leads to';
      case KnowledgeEdgeType.SIMILAR_TO:
        return 'Similar to';
      case KnowledgeEdgeType.DERIVED_FROM:
        return 'Derived from';
      case KnowledgeEdgeType.INFLUENCES:
        return 'Influences';
      case KnowledgeEdgeType.CATEGORIZES:
        return 'Categorizes';
      case KnowledgeEdgeType.REFERENCES:
        return 'References';
      default:
        return 'Related to';
    }
  }
} 