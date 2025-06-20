/**
 * EnhancedIntelligenceService.ts - Phase 2.3 Enhanced Intelligence Features
 * 
 * This service provides advanced intelligence capabilities for the knowledge graph:
 * - Smart Relationship Discovery using vector similarity
 * - Context-Aware Search with relationship ranking
 * - Temporal relationship inference  
 * - Entity resolution and deduplication
 */

import { ulid } from 'ulid';
import { 
  KnowledgeNode, 
  KnowledgeEdge,
  KnowledgeNodeType,
  KnowledgeEdgeType,
  KnowledgeGraphSearchOptions,
  GraphInsight,
  GraphIntelligenceOptions
} from './interfaces/KnowledgeGraph.interface';
import { QdrantKnowledgeStore } from './QdrantKnowledgeStore';
import { DefaultKnowledgeGraph } from './DefaultKnowledgeGraph';

export interface EnhancedSearchResult {
  readonly node: KnowledgeNode;
  readonly relevanceScore: number;
  readonly relationshipContext: ReadonlyArray<RelationshipContext>;
  readonly temporalRelevance: number;
  readonly confidence: number;
}

export interface RelationshipContext {
  readonly relatedNode: KnowledgeNode;
  readonly relationship: KnowledgeEdge;
  readonly pathLength: number;
  readonly contextStrength: number;
}

export interface SmartRelationship {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly type: KnowledgeEdgeType;
  readonly discoveryMethod: 'vector_similarity' | 'temporal_pattern' | 'cross_domain' | 'analogical';
  readonly confidence: number;
  readonly evidence: ReadonlyArray<string>;
  readonly reasoning: string;
  readonly metadata: Record<string, unknown>;
}

export interface TemporalPattern {
  readonly id: string;
  readonly nodeIds: ReadonlyArray<string>;
  readonly pattern: 'sequential' | 'concurrent' | 'cyclical' | 'causal_chain';
  readonly timeRange: { start: Date; end: Date };
  readonly confidence: number;
  readonly description: string;
}

export interface EntityCluster {
  readonly id: string;
  readonly representativeNode: KnowledgeNode;
  readonly duplicateNodes: ReadonlyArray<KnowledgeNode>;
  readonly similarityScore: number;
  readonly mergeRecommendation: 'merge' | 'keep_separate' | 'needs_review';
  readonly reasoning: string;
}

export interface EnhancedIntelligenceConfig {
  readonly knowledgeGraph: DefaultKnowledgeGraph;
  readonly qdrantStore?: QdrantKnowledgeStore;
  readonly vectorSimilarityThreshold: number;
  readonly temporalWindowDays: number;
  readonly maxRelationshipDepth: number;
  readonly duplicateThreshold: number;
}

/**
 * Enhanced Intelligence Service for Phase 2.3 capabilities
 * Follows IMPLEMENTATION_GUIDELINES.md with ULID, strict typing, DI, and pure functions
 */
export class EnhancedIntelligenceService {
  private readonly config: EnhancedIntelligenceConfig;
  
  constructor(config: EnhancedIntelligenceConfig) {
    this.config = config;
  }

  /**
   * Smart Relationship Discovery - Find implicit connections using vector similarity
   */
  async discoverSmartRelationships(
    nodeId: string,
    options: {
      maxRelationships?: number;
      minConfidence?: number;
      discoveryMethods?: Array<'vector_similarity' | 'temporal_pattern' | 'cross_domain' | 'analogical'>;
    } = {}
  ): Promise<ReadonlyArray<SmartRelationship>> {
    const sourceNode = await this.config.knowledgeGraph.getNode(nodeId);
    if (!sourceNode) {
      return [];
    }

    const maxRelationships = options.maxRelationships || 10;
    const minConfidence = options.minConfidence || 0.6;
    const methods = options.discoveryMethods || ['vector_similarity', 'temporal_pattern', 'cross_domain'];
    
    const discoveredRelationships: SmartRelationship[] = [];

    // Method 1: Vector similarity-based discovery
    if (methods.includes('vector_similarity') && this.config.qdrantStore) {
      const vectorRelationships = await this.discoverVectorSimilarityRelationships(
        sourceNode, 
        maxRelationships
      );
      discoveredRelationships.push(...vectorRelationships);
    }

    // Method 2: Temporal pattern discovery
    if (methods.includes('temporal_pattern')) {
      const temporalRelationships = await this.discoverTemporalRelationships(
        sourceNode,
        maxRelationships
      );
      discoveredRelationships.push(...temporalRelationships);
    }

    // Method 3: Cross-domain linking
    if (methods.includes('cross_domain')) {
      const crossDomainRelationships = await this.discoverCrossDomainRelationships(
        sourceNode,
        maxRelationships
      );
      discoveredRelationships.push(...crossDomainRelationships);
    }

    // Method 4: Analogical reasoning
    if (methods.includes('analogical')) {
      const analogicalRelationships = await this.discoverAnalogicalRelationships(
        sourceNode,
        maxRelationships
      );
      discoveredRelationships.push(...analogicalRelationships);
    }

    // Filter by confidence and deduplicate
    return this.deduplicateAndRankRelationships(discoveredRelationships, minConfidence)
      .slice(0, maxRelationships);
  }

  /**
   * Context-Aware Search with relationship-aware ranking and query expansion
   */
  async enhancedSearch(
    query: string,
    options: KnowledgeGraphSearchOptions & {
      useQueryExpansion?: boolean;
      includeRelationshipContext?: boolean;
      temporalBoost?: boolean;
      maxRelationshipDepth?: number;
    } = {}
  ): Promise<ReadonlyArray<EnhancedSearchResult>> {
    let expandedQuery = query;
    
    // Query expansion using related concepts
    if (options.useQueryExpansion) {
      expandedQuery = await this.expandQuery(query);
    }

    // Get base search results
    const baseResults = await this.config.knowledgeGraph.findNodes(expandedQuery, options);
    
    // Enhance each result with relationship context and temporal relevance
    const enhancedResults: EnhancedSearchResult[] = [];
    
    for (const node of baseResults) {
      const relationshipContext = options.includeRelationshipContext 
        ? await this.getRelationshipContext(node, options.maxRelationshipDepth || 2)
        : [];
      
      const temporalRelevance = options.temporalBoost 
        ? this.calculateTemporalRelevance(node)
        : 0.5;
      
      const relevanceScore = this.calculateEnhancedRelevance(
        node, 
        query, 
        relationshipContext, 
        temporalRelevance
      );
      
      const confidence = this.calculateSearchConfidence(node, relationshipContext);
      
      enhancedResults.push({
        node,
        relevanceScore,
        relationshipContext,
        temporalRelevance,
        confidence
      });
    }

    // Sort by enhanced relevance score
    return enhancedResults
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, options.limit || 10);
  }

  /**
   * Temporal Relationship Inference - Discover time-based patterns
   */
  async inferTemporalRelationships(
    nodeIds: ReadonlyArray<string>,
    options: {
      timeWindow?: number; // days
      minPatternStrength?: number;
      patternTypes?: Array<'sequential' | 'concurrent' | 'cyclical' | 'causal_chain'>;
    } = {}
  ): Promise<ReadonlyArray<TemporalPattern>> {
    const timeWindow = options.timeWindow || this.config.temporalWindowDays;
    const minPatternStrength = options.minPatternStrength || 0.6;
    const patternTypes = options.patternTypes || ['sequential', 'concurrent', 'causal_chain'];
    
    const nodes = await Promise.all(
      nodeIds.map(id => this.config.knowledgeGraph.getNode(id))
    );
    const validNodes = nodes.filter((node): node is KnowledgeNode => node !== null);
    
    if (validNodes.length < 2) {
      return [];
    }

    const patterns: TemporalPattern[] = [];

    // Sequential patterns - nodes that appear in sequence
    if (patternTypes.includes('sequential')) {
      const sequentialPatterns = this.detectSequentialPatterns(validNodes, timeWindow);
      patterns.push(...sequentialPatterns);
    }

    // Concurrent patterns - nodes that appear at the same time
    if (patternTypes.includes('concurrent')) {
      const concurrentPatterns = this.detectConcurrentPatterns(validNodes, timeWindow);
      patterns.push(...concurrentPatterns);
    }

    // Causal chain patterns - nodes that form causal relationships
    if (patternTypes.includes('causal_chain')) {
      const causalPatterns = await this.detectCausalChainPatterns(validNodes);
      patterns.push(...causalPatterns);
    }

    // Cyclical patterns - nodes that repeat in cycles
    if (patternTypes.includes('cyclical')) {
      const cyclicalPatterns = this.detectCyclicalPatterns(validNodes, timeWindow);
      patterns.push(...cyclicalPatterns);
    }

    return patterns.filter(pattern => pattern.confidence >= minPatternStrength);
  }

  /**
   * Entity Resolution and Deduplication
   */
  async detectDuplicateEntities(
    options: {
      nodeTypes?: KnowledgeNodeType[];
      similarityThreshold?: number;
      checkFields?: Array<'label' | 'description' | 'tags' | 'properties'>;
    } = {}
  ): Promise<ReadonlyArray<EntityCluster>> {
    const similarityThreshold = options.similarityThreshold || this.config.duplicateThreshold;
    const checkFields = options.checkFields || ['label', 'description', 'tags'];
    
    // Get all nodes of specified types
    const searchOptions: KnowledgeGraphSearchOptions = {
      nodeTypes: options.nodeTypes,
      limit: 10000 // Get all nodes
    };
    
    const allNodes = await this.config.knowledgeGraph.findNodes('', searchOptions);
    
    if (allNodes.length < 2) {
      return [];
    }

    const clusters: EntityCluster[] = [];
    const processedNodes = new Set<string>();

    for (const node of allNodes) {
      if (processedNodes.has(node.id)) {
        continue;
      }

      const duplicates: KnowledgeNode[] = [];
      
      for (const otherNode of allNodes) {
        if (otherNode.id === node.id || processedNodes.has(otherNode.id)) {
          continue;
        }

        const similarity = this.calculateNodeSimilarity(node, otherNode, checkFields);
        
        if (similarity >= similarityThreshold) {
          duplicates.push(otherNode);
          processedNodes.add(otherNode.id);
        }
      }

      if (duplicates.length > 0) {
        const cluster: EntityCluster = {
          id: ulid(),
          representativeNode: node,
          duplicateNodes: duplicates,
          similarityScore: duplicates.length > 0 ? 
            duplicates.reduce((sum, dup) => sum + this.calculateNodeSimilarity(node, dup, checkFields), 0) / duplicates.length : 
            0,
          mergeRecommendation: this.getMergeRecommendation(node, duplicates),
          reasoning: this.generateMergeReasoning(node, duplicates, checkFields)
        };

        clusters.push(cluster);
        processedNodes.add(node.id);
      }
    }

    return clusters.sort((a, b) => b.similarityScore - a.similarityScore);
  }

  /**
   * Generate Advanced Insights using enhanced intelligence
   */
  async generateAdvancedInsights(
    options: GraphIntelligenceOptions = {}
  ): Promise<ReadonlyArray<GraphInsight>> {
    // TODO: Implement enhanced intelligence features
    return [];
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Discover relationships using vector similarity
   */
  private async discoverVectorSimilarityRelationships(
    sourceNode: KnowledgeNode,
    maxRelationships: number
  ): Promise<SmartRelationship[]> {
    if (!this.config.qdrantStore) {
      return [];
    }

    try {
      const searchQuery = `${sourceNode.label} ${sourceNode.description || ''}`;
      const results = await this.config.qdrantStore.searchNodes(searchQuery, {
        limit: maxRelationships * 2,
        scoreThreshold: this.config.vectorSimilarityThreshold
      });

      const relationships: SmartRelationship[] = [];

      for (const result of results) {
        if (result.node.id === sourceNode.id) continue;

        const relationship: SmartRelationship = {
          id: ulid(),
          from: sourceNode.id,
          to: result.node.id,
          type: this.inferRelationshipType(sourceNode, result.node),
          discoveryMethod: 'vector_similarity',
          confidence: result.score,
          evidence: [`Vector similarity score: ${result.score.toFixed(3)}`],
          reasoning: `High semantic similarity detected between "${sourceNode.label}" and "${result.node.label}"`,
          metadata: {
            vectorScore: result.score,
            sourceType: sourceNode.type,
            targetType: result.node.type
          }
        };

        relationships.push(relationship);
      }

      return relationships;
    } catch (error) {
      console.warn('Vector similarity relationship discovery failed:', error);
      return [];
    }
  }

  /**
   * Discover temporal relationships
   */
  private async discoverTemporalRelationships(
    sourceNode: KnowledgeNode,
    maxRelationships: number
  ): Promise<SmartRelationship[]> {
    const relationships: SmartRelationship[] = [];
    
    if (!sourceNode.createdAt) {
      return relationships;
    }

    // Find nodes created around the same time
    const timeWindow = this.config.temporalWindowDays * 24 * 60 * 60 * 1000; // Convert to milliseconds
    const startTime = new Date(sourceNode.createdAt.getTime() - timeWindow);
    const endTime = new Date(sourceNode.createdAt.getTime() + timeWindow);

    // This would need to be implemented with a proper temporal query
    // For now, return empty array as placeholder
    return relationships;
  }

  /**
   * Discover cross-domain relationships
   */
  private async discoverCrossDomainRelationships(
    sourceNode: KnowledgeNode,
    maxRelationships: number
  ): Promise<SmartRelationship[]> {
    const relationships: SmartRelationship[] = [];
    
    // Find nodes of different types that might be related
    const differentTypeNodes = await this.config.knowledgeGraph.findNodes('', {
      nodeTypes: Object.values(KnowledgeNodeType).filter(type => type !== sourceNode.type),
      limit: maxRelationships * 2
    });

    for (const node of differentTypeNodes) {
      if (this.hasConceptualSimilarity(sourceNode, node)) {
        const relationship: SmartRelationship = {
          id: ulid(),
          from: sourceNode.id,
          to: node.id,
          type: KnowledgeEdgeType.RELATED_TO,
          discoveryMethod: 'cross_domain',
          confidence: 0.6,
          evidence: [`Cross-domain relationship between ${sourceNode.type} and ${node.type}`],
          reasoning: `Conceptual similarity detected across different domains`,
          metadata: {
            sourceDomain: sourceNode.type,
            targetDomain: node.type
          }
        };

        relationships.push(relationship);
      }
    }

    return relationships.slice(0, maxRelationships);
  }

  /**
   * Discover analogical relationships
   */
  private async discoverAnalogicalRelationships(
    sourceNode: KnowledgeNode,
    maxRelationships: number
  ): Promise<SmartRelationship[]> {
    // Placeholder for analogical reasoning
    // This would require more sophisticated analysis
    return [];
  }

  /**
   * Deduplicate and rank relationships
   */
  private deduplicateAndRankRelationships(
    relationships: SmartRelationship[],
    minConfidence: number
  ): SmartRelationship[] {
    const uniqueRelationships = new Map<string, SmartRelationship>();

    for (const rel of relationships) {
      if (rel.confidence < minConfidence) continue;

      const key = `${rel.from}-${rel.to}-${rel.type}`;
      const existing = uniqueRelationships.get(key);

      if (!existing || rel.confidence > existing.confidence) {
        uniqueRelationships.set(key, rel);
      }
    }

    return Array.from(uniqueRelationships.values())
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Expand query using related concepts
   */
  private async expandQuery(query: string): Promise<string> {
    // Basic query expansion - in practice, this could use more sophisticated methods
    const relatedNodes = await this.config.knowledgeGraph.findNodes(query, { limit: 5 });
    
    const additionalTerms = relatedNodes
      .flatMap(node => node.tags || [])
      .filter((tag, index, arr) => arr.indexOf(tag) === index) // Unique tags
      .slice(0, 3);

    return `${query} ${additionalTerms.join(' ')}`;
  }

  /**
   * Get relationship context for a node
   */
  private async getRelationshipContext(
    node: KnowledgeNode,
    maxDepth: number
  ): Promise<RelationshipContext[]> {
    const context: RelationshipContext[] = [];
    
    try {
      const edges = await this.config.knowledgeGraph.getEdges(node.id, 'both');
      
      for (const edge of edges.slice(0, 5)) { // Limit to avoid performance issues
        const relatedNodeId = edge.from === node.id ? edge.to : edge.from;
        const relatedNode = await this.config.knowledgeGraph.getNode(relatedNodeId);
        
        if (relatedNode) {
          context.push({
            relatedNode,
            relationship: edge,
            pathLength: 1,
            contextStrength: edge.strength || 0.5
          });
        }
      }
    } catch (error) {
      console.warn('Failed to get relationship context:', error);
    }

    return context;
  }

  /**
   * Calculate temporal relevance
   */
  private calculateTemporalRelevance(node: KnowledgeNode): number {
    if (!node.createdAt) return 0.5;

    const now = new Date();
    const ageInDays = (now.getTime() - node.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    
    // More recent nodes are more relevant, with decay over time
    return Math.max(0.1, Math.exp(-ageInDays / 30)); // 30-day half-life
  }

  /**
   * Calculate enhanced relevance score
   */
  private calculateEnhancedRelevance(
    node: KnowledgeNode,
    query: string,
    relationshipContext: ReadonlyArray<RelationshipContext>,
    temporalRelevance: number
  ): number {
    const baseRelevance = this.config.knowledgeGraph.calculateRelevanceScore(node, query);
    const contextBoost = relationshipContext.length > 0 ? 0.2 : 0;
    const temporalBoost = temporalRelevance * 0.1;

    return Math.min(1.0, baseRelevance + contextBoost + temporalBoost);
  }

  /**
   * Calculate search confidence
   */
  private calculateSearchConfidence(
    node: KnowledgeNode,
    relationshipContext: ReadonlyArray<RelationshipContext>
  ): number {
    const nodeConfidence = node.confidence || 0.5;
    const contextConfidence = relationshipContext.length > 0 ? 
      relationshipContext.reduce((sum, ctx) => sum + ctx.contextStrength, 0) / relationshipContext.length : 
      0.5;

    return (nodeConfidence + contextConfidence) / 2;
  }

  /**
   * Detect sequential patterns
   */
  private detectSequentialPatterns(
    nodes: KnowledgeNode[],
    timeWindowDays: number
  ): TemporalPattern[] {
    // Placeholder implementation
    return [];
  }

  /**
   * Detect concurrent patterns
   */
  private detectConcurrentPatterns(
    nodes: KnowledgeNode[],
    timeWindowDays: number
  ): TemporalPattern[] {
    // Placeholder implementation
    return [];
  }

  /**
   * Detect causal chain patterns
   */
  private async detectCausalChainPatterns(
    nodes: KnowledgeNode[]
  ): Promise<TemporalPattern[]> {
    // Placeholder implementation
    return [];
  }

  /**
   * Detect cyclical patterns
   */
  private detectCyclicalPatterns(
    nodes: KnowledgeNode[],
    timeWindowDays: number
  ): TemporalPattern[] {
    // Placeholder implementation
    return [];
  }

  /**
   * Calculate node similarity
   */
  private calculateNodeSimilarity(
    node1: KnowledgeNode,
    node2: KnowledgeNode,
    checkFields: Array<'label' | 'description' | 'tags' | 'properties'>
  ): number {
    let totalScore = 0;
    let fieldCount = 0;

    if (checkFields.includes('label')) {
      totalScore += this.calculateTextSimilarity(node1.label, node2.label);
      fieldCount++;
    }

    if (checkFields.includes('description') && node1.description && node2.description) {
      totalScore += this.calculateTextSimilarity(node1.description, node2.description);
      fieldCount++;
    }

    if (checkFields.includes('tags') && node1.tags && node2.tags) {
      totalScore += this.calculateTagSimilarity(node1.tags, node2.tags);
      fieldCount++;
    }

    return fieldCount > 0 ? totalScore / fieldCount : 0;
  }

  /**
   * Calculate text similarity using simple Jaccard index
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Calculate tag similarity
   */
  private calculateTagSimilarity(tags1: string[], tags2: string[]): number {
    const set1 = new Set(tags1.map(tag => tag.toLowerCase()));
    const set2 = new Set(tags2.map(tag => tag.toLowerCase()));
    
    const intersection = new Set([...set1].filter(tag => set2.has(tag)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Get merge recommendation
   */
  private getMergeRecommendation(
    node: KnowledgeNode,
    duplicates: KnowledgeNode[]
  ): 'merge' | 'keep_separate' | 'needs_review' {
    // Simple heuristic - in practice, this would be more sophisticated
    const avgSimilarity = duplicates.reduce((sum, dup) => 
      sum + this.calculateNodeSimilarity(node, dup, ['label', 'description']), 0
    ) / duplicates.length;

    if (avgSimilarity > 0.9) return 'merge';
    if (avgSimilarity > 0.7) return 'needs_review';
    return 'keep_separate';
  }

  /**
   * Generate merge reasoning
   */
  private generateMergeReasoning(
    node: KnowledgeNode,
    duplicates: KnowledgeNode[],
    checkFields: string[]
  ): string {
    return `Found ${duplicates.length} potential duplicates for "${node.label}" based on ${checkFields.join(', ')} similarity`;
  }

  /**
   * Check conceptual similarity
   */
  private hasConceptualSimilarity(node1: KnowledgeNode, node2: KnowledgeNode): boolean {
    // Simple check based on shared tags
    if (!node1.tags || !node2.tags) return false;
    
    const commonTags = node1.tags.filter(tag => node2.tags?.includes(tag));
    return commonTags.length > 0;
  }

  /**
   * Infer relationship type between nodes
   */
  private inferRelationshipType(node1: KnowledgeNode, node2: KnowledgeNode): KnowledgeEdgeType {
    // Simple heuristic based on node types
    if (node1.type === KnowledgeNodeType.TASK && node2.type === KnowledgeNodeType.TOOL) {
      return KnowledgeEdgeType.USED_BY;
    }
    if (node1.type === KnowledgeNodeType.CONCEPT && node2.type === KnowledgeNodeType.CONCEPT) {
      return KnowledgeEdgeType.SIMILAR_TO;
    }
    
    return KnowledgeEdgeType.RELATED_TO;
  }
} 