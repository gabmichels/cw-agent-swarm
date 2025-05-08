/**
 * Graph Intelligence Engine Types
 * Defines the interfaces and types for the graph intelligence system
 */

import { StructuredId } from '../../../types/structured-id';
import { Result } from '../../../lib/errors/base';

/**
 * Graph node types
 */
export enum GraphNodeType {
  CONCEPT = 'concept',
  PERSON = 'person',
  ORGANIZATION = 'organization',
  EVENT = 'event',
  LOCATION = 'location',
  TOPIC = 'topic',
  TASK = 'task',
  INSIGHT = 'insight',
  TOOL = 'tool',
  PROJECT = 'project'
}

/**
 * Graph relationship types
 */
export enum GraphRelationshipType {
  RELATED_TO = 'related_to',
  DEPENDS_ON = 'depends_on',
  PART_OF = 'part_of',
  SIMILAR_TO = 'similar_to',
  INFLUENCES = 'influences',
  CAUSES = 'causes',
  CONTRADICTS = 'contradicts',
  SUPPORTS = 'supports',
  PRECEDES = 'precedes',
  FOLLOWS = 'follows',
  REFERENCES = 'references'
}

/**
 * Graph insight types
 */
export enum GraphInsightType {
  CENTRAL_CONCEPT = 'central_concept',
  KNOWLEDGE_GAP = 'knowledge_gap',
  UNEXPECTED_RELATIONSHIP = 'unexpected_relationship',
  EMERGING_PATTERN = 'emerging_pattern',
  CONTRADICTION = 'contradiction',
  REINFORCEMENT = 'reinforcement'
}

/**
 * Graph node interface
 */
export interface IGraphNode {
  id: StructuredId;
  label: string;
  type: GraphNodeType;
  description?: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Graph relationship interface
 */
export interface IGraphRelationship {
  id: StructuredId;
  sourceId: StructuredId;
  targetId: StructuredId;
  type: GraphRelationshipType;
  label?: string;
  strength: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Graph path result interface
 */
export interface IGraphPath {
  nodes: IGraphNode[];
  relationships: IGraphRelationship[];
  score: number;
  metadata: {
    pathLength: number;
    averageStrength: number;
  };
}

/**
 * Graph insight interface
 */
export interface IGraphInsight {
  id: StructuredId;
  type: GraphInsightType;
  summary: string;
  details: string;
  relevance: number;
  sourceNodes: StructuredId[];
  createdAt: Date;
}

/**
 * Options for path finding
 */
export interface PathOptions {
  maxDepth?: number;
  minStrength?: number;
  relationshipTypes?: GraphRelationshipType[];
  algorithm?: 'shortest' | 'strongest' | 'all';
}

/**
 * Knowledge extraction options
 */
export interface KnowledgeExtractionOptions {
  contextTags?: string[];
  confidenceThreshold?: number;
  maxConcepts?: number;
  extractEntities?: boolean;
  extractRelationships?: boolean;
  language?: string;
}

/**
 * Knowledge extraction result
 */
export interface KnowledgeExtractionResult {
  extractedNodes: IGraphNode[];
  extractedRelationships: IGraphRelationship[];
  confidence: number;
}

/**
 * Relationship discovery options
 */
export interface RelationshipDiscoveryOptions {
  nodeIds?: StructuredId[];
  confidenceThreshold?: number;
  maxRelationships?: number;
  relationshipTypes?: GraphRelationshipType[];
  algorithm?: 'similarity' | 'cooccurrence' | 'inference' | 'hybrid';
}

/**
 * Relationship discovery result
 */
export interface RelationshipDiscoveryResult {
  discoveredRelationships: IGraphRelationship[];
  confidence: number;
}

/**
 * Subgraph analysis options
 */
export interface SubgraphAnalysisOptions {
  includeRelationships?: boolean;
  includeMetrics?: boolean;
  maxDepth?: number;
}

/**
 * Subgraph analysis result
 */
export interface SubgraphAnalysisResult {
  centralNodes: IGraphNode[];
  bridges: IGraphRelationship[];
  clusters: {
    id: string;
    nodes: IGraphNode[];
    cohesion: number;
  }[];
  metrics: {
    density: number;
    avgPathLength: number;
    clusteringCoefficient: number;
  };
}

/**
 * Insight extraction options
 */
export interface InsightExtractionOptions {
  insightTypes?: GraphInsightType[];
  maxInsights?: number;
  minRelevance?: number;
  focusNodeIds?: StructuredId[];
}

/**
 * Node enrichment options
 */
export interface NodeEnrichmentOptions {
  dataSources?: string[];
  maxEnrichmentItems?: number;
  minConfidence?: number;
}

/**
 * Node enrichment result
 */
export interface NodeEnrichmentResult {
  enrichedNodes: IGraphNode[];
  addedMetadata: Record<string, Record<string, unknown>>;
}

/**
 * Graph Repository interface
 */
export interface IGraphRepository {
  /**
   * Adds a node to the graph
   */
  addNode(node: Omit<IGraphNode, 'id' | 'createdAt' | 'updatedAt'>): Promise<IGraphNode>;
  
  /**
   * Gets a node by ID
   */
  getNodeById(id: StructuredId): Promise<IGraphNode | null>;
  
  /**
   * Updates a node
   */
  updateNode(id: StructuredId, updates: Partial<IGraphNode>): Promise<IGraphNode | null>;
  
  /**
   * Deletes a node
   */
  deleteNode(id: StructuredId): Promise<boolean>;
  
  /**
   * Adds a relationship to the graph
   */
  addRelationship(relationship: Omit<IGraphRelationship, 'id' | 'createdAt' | 'updatedAt'>): Promise<IGraphRelationship>;
  
  /**
   * Gets a relationship by ID
   */
  getRelationshipById(id: StructuredId): Promise<IGraphRelationship | null>;
  
  /**
   * Updates a relationship
   */
  updateRelationship(id: StructuredId, updates: Partial<IGraphRelationship>): Promise<IGraphRelationship | null>;
  
  /**
   * Deletes a relationship
   */
  deleteRelationship(id: StructuredId): Promise<boolean>;
  
  /**
   * Finds relationships between two nodes
   */
  findRelationships(sourceId: StructuredId, targetId: StructuredId): Promise<IGraphRelationship[]>;
  
  /**
   * Gets all nodes related to a node
   */
  getRelatedNodes(nodeId: StructuredId, options?: RelatedNodesOptions): Promise<IGraphNode[]>;
  
  /**
   * Finds nodes by query
   */
  findNodes(query: NodeQuery): Promise<IGraphNode[]>;
  
  /**
   * Finds relationships by query
   */
  findRelationshipsByQuery(query: RelationshipQuery): Promise<IGraphRelationship[]>;
}

/**
 * Options for retrieving related nodes
 */
export interface RelatedNodesOptions {
  relationshipTypes?: GraphRelationshipType[];
  nodeTypes?: GraphNodeType[];
  direction?: 'outgoing' | 'incoming' | 'both';
  maxDepth?: number;
  limit?: number;
}

/**
 * Node query parameters
 */
export interface NodeQuery {
  types?: GraphNodeType[];
  tags?: string[];
  labelContains?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Relationship query parameters
 */
export interface RelationshipQuery {
  types?: GraphRelationshipType[];
  sourceNodeId?: StructuredId;
  targetNodeId?: StructuredId;
  minStrength?: number;
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
  offset?: number;
}

/**
 * NLP Service interface
 */
export interface INlpService {
  /**
   * Extract entities from text
   */
  extractEntities(text: string, options?: EntityExtractionOptions): Promise<ExtractedEntity[]>;
  
  /**
   * Extract relationships from text
   */
  extractRelationships(text: string, entities?: ExtractedEntity[], options?: RelationshipExtractionOptions): Promise<ExtractedRelationship[]>;
  
  /**
   * Calculate semantic similarity between concepts
   */
  calculateSimilarity(concept1: string, concept2: string): Promise<number>;
  
  /**
   * Extract the main topics from text
   */
  extractTopics(text: string, options?: TopicExtractionOptions): Promise<ExtractedTopic[]>;
}

/**
 * Entity extraction options
 */
export interface EntityExtractionOptions {
  types?: string[];
  confidenceThreshold?: number;
  maxEntities?: number;
  language?: string;
}

/**
 * Extracted entity
 */
export interface ExtractedEntity {
  text: string;
  type: string;
  startChar: number;
  endChar: number;
  confidence: number;
  metadata?: Record<string, unknown>;
}

/**
 * Relationship extraction options
 */
export interface RelationshipExtractionOptions {
  types?: string[];
  confidenceThreshold?: number;
  maxRelationships?: number;
}

/**
 * Extracted relationship
 */
export interface ExtractedRelationship {
  sourceEntity: ExtractedEntity;
  targetEntity: ExtractedEntity;
  type: string;
  confidence: number;
  text: string;
}

/**
 * Topic extraction options
 */
export interface TopicExtractionOptions {
  maxTopics?: number;
  minRelevance?: number;
}

/**
 * Extracted topic
 */
export interface ExtractedTopic {
  label: string;
  relevance: number;
  subtopics?: ExtractedTopic[];
}

/**
 * Vector Service interface
 */
export interface IVectorService {
  /**
   * Creates an embedding vector for text
   */
  createEmbedding(text: string): Promise<number[]>;
  
  /**
   * Calculates similarity between two vectors
   */
  calculateSimilarity(vector1: number[], vector2: number[]): number;
  
  /**
   * Searches for similar vectors
   */
  findSimilarVectors(vector: number[], options?: SimilarVectorOptions): Promise<SimilarVectorResult[]>;
}

/**
 * Similar vector search options
 */
export interface SimilarVectorOptions {
  maxResults?: number;
  minSimilarity?: number;
  filters?: Record<string, unknown>;
}

/**
 * Similar vector search result
 */
export interface SimilarVectorResult {
  id: string;
  similarity: number;
  metadata?: Record<string, unknown>;
}

/**
 * Graph Intelligence Engine interface
 */
export interface IGraphIntelligenceEngine {
  /**
   * Extracts knowledge from text content and adds it to the graph
   */
  extractKnowledge(content: string, options: KnowledgeExtractionOptions): Promise<Result<KnowledgeExtractionResult>>;
  
  /**
   * Discovers potentially missing relationships between existing nodes
   */
  discoverRelationships(options: RelationshipDiscoveryOptions): Promise<Result<RelationshipDiscoveryResult>>;
  
  /**
   * Finds paths between two nodes
   */
  findPaths(sourceId: StructuredId, targetId: StructuredId, options: PathOptions): Promise<Result<IGraphPath[]>>;
  
  /**
   * Analyzes the subgraph containing the specified nodes
   */
  analyzeSubgraph(nodeIds: StructuredId[], options: SubgraphAnalysisOptions): Promise<Result<SubgraphAnalysisResult>>;
  
  /**
   * Extracts insights from the graph
   */
  extractInsights(options: InsightExtractionOptions): Promise<Result<IGraphInsight[]>>;
  
  /**
   * Enriches nodes with additional information from external sources
   */
  enrichNodes(nodeIds: StructuredId[], options: NodeEnrichmentOptions): Promise<Result<NodeEnrichmentResult>>;
} 