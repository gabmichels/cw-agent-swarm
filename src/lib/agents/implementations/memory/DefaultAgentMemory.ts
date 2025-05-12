/**
 * DefaultAgentMemory.ts - Default memory implementation
 * 
 * This file provides a default implementation of the AgentMemory interface
 * that can be used by any agent.
 */

import { AgentMemory } from '../../shared/memory/AgentMemory';
import { MemoryType, ImportanceLevel, MemorySource } from '../../../constants/memory';
import { 
  MemoryEntry, 
  MemorySearchOptions, 
  MemoryStats,
  MemoryService,
  SearchService,
  SearchResult,
  MemoryError,
  BaseMemorySchema,
  KnowledgeEdge,
  KnowledgeEdgeType,
  KnowledgeGraphManager,
  KnowledgeNode,
  KnowledgeNodeType
} from '../../shared/memory/types';
import { handleError } from '../../../errors/errorHandler';
import { getMemoryServices } from '../../../../server/memory/services';
import { MemoryDecayConfig, MemoryDecayResult, MemoryDecayStats } from '../../shared/memory/types';
import { KnowledgeGraphManager as KnowledgeGraphManagerImport } from './KnowledgeGraphManager';

/**
 * Hybrid search options
 */
interface HybridSearchOptions extends MemorySearchOptions {
  textWeight?: number;
  vectorWeight?: number;
  normalizeScores?: boolean;
}

/**
 * Query expansion configuration
 */
interface QueryExpansionConfig {
  enabled: boolean;
  maxExpansions: number;
  minQueryLength: number;
  expansionMap: Record<string, string[]>;
}

/**
 * Query clustering configuration
 */
interface QueryClusteringConfig {
  enabled: boolean;
  minKeywords: number;
  maxClusters: number;
  categories: string[][];
}

/**
 * Enhanced search options
 */
interface EnhancedSearchOptions extends MemorySearchOptions {
  semanticWeight?: number;
  keywordWeight?: number;
  expandQuery?: boolean;
  requireAllKeywords?: boolean;
  minRelevanceScore?: number;
  useQueryClusters?: boolean;
}

/**
 * Default memory implementation
 */
export class DefaultAgentMemory implements AgentMemory {
  private memoryService!: MemoryService;
  private searchService!: SearchService;
  private initialized: boolean = false;
  private lastConsolidation: Date | null = null;
  private lastPruning: Date | null = null;
  private totalConsolidated: number = 0;
  private totalPruned: number = 0;
  private decayConfig: MemoryDecayConfig;
  private decayStats: MemoryDecayStats;
  private knowledgeGraph: KnowledgeGraphManager;
  private agentId: string;
  private queryExpansionConfig: QueryExpansionConfig;
  private queryClusteringConfig: QueryClusteringConfig;

  constructor(agentId: string) {
    this.agentId = agentId;
    this.decayConfig = this.getDefaultDecayConfig();
    this.decayStats = this.getDefaultDecayStats();
    this.knowledgeGraph = new KnowledgeGraphManagerImport();
    this.queryExpansionConfig = {
      enabled: true,
      maxExpansions: 3,
      minQueryLength: 15,
      expansionMap: {
        // Business concepts
        'mission': ['purpose', 'goal', 'aim', 'objective', 'vision'],
        'vision': ['mission', 'future', 'goal', 'aim', 'aspiration'],
        'values': ['principles', 'ethics', 'beliefs', 'culture', 'philosophy'],
        'strategy': ['plan', 'approach', 'roadmap', 'method', 'framework'],
        'brand': ['identity', 'image', 'reputation', 'presence', 'persona'],
        'customer': ['user', 'client', 'audience', 'consumer', 'buyer'],
        'market': ['industry', 'sector', 'niche', 'segment', 'domain'],
        'product': ['service', 'offering', 'solution', 'tool', 'application'],
        'competitors': ['competition', 'rivals', 'alternatives', 'market players'],
        'metrics': ['kpis', 'measurements', 'analytics', 'indicators', 'performance'],
        'growth': ['increase', 'expansion', 'scaling', 'development', 'advancement'],
        
        // Onboarding/documentation concepts
        'onboarding': ['introduction', 'setup', 'getting started', 'orientation'],
        'documentation': ['docs', 'guides', 'help', 'instructions', 'manuals'],
        'resources': ['assets', 'tools', 'materials', 'utilities'],
        'section': ['part', 'segment', 'component', 'module', 'portion'],
        
        // Marketing concepts
        'marketing': ['promotion', 'advertising', 'campaigns', 'outreach'],
        'audience': ['users', 'customers', 'clients', 'demographic', 'target market'],
        'content': ['material', 'media', 'assets', 'posts', 'articles'],
        'acquisition': ['growth', 'user acquisition', 'customer acquisition', 'lead generation'],
        'retention': ['loyalty', 'churn reduction', 'customer retention', 'engagement'],
        'engagement': ['interaction', 'participation', 'activity', 'involvement'],
        'conversion': ['sales', 'sign-ups', 'leads', 'purchases', 'transactions'],
        'funnel': ['pipeline', 'journey', 'process', 'stages', 'flow']
      }
    };
    this.queryClusteringConfig = {
      enabled: true,
      minKeywords: 3,
      maxClusters: 5,
      categories: [
        ['mission', 'vision', 'purpose', 'goals', 'values', 'beliefs'],
        ['strategy', 'plan', 'roadmap', 'approach', 'method', 'execution'],
        ['customers', 'users', 'audience', 'clients', 'demographics', 'personas'],
        ['product', 'service', 'offering', 'solution', 'features', 'benefits'],
        ['metrics', 'kpis', 'measurements', 'performance', 'analytics', 'data'],
        ['marketing', 'promotion', 'advertising', 'communication', 'messaging'],
        ['resources', 'assets', 'tools', 'materials', 'documentation']
      ]
    };
  }

  private getDefaultDecayConfig(): MemoryDecayConfig {
    return {
      baseDecayRate: 0.1, // 10% decay per day
      typeDecayRates: {
        [MemoryType.MESSAGE]: 1.2, // Messages decay 20% faster
        [MemoryType.DOCUMENT]: 0.8, // Documents decay 20% slower
        [MemoryType.THOUGHT]: 1.0, // Thoughts decay at base rate
      },
      criticalImportanceLevel: ImportanceLevel.HIGH,
      decayStartDays: 7, // Start decay after 7 days
      maxDecayRate: 0.5, // Maximum 50% decay per day
      minDecayRate: 0.01, // Minimum 1% decay per day
    };
  }

  private getDefaultDecayStats(): MemoryDecayStats {
    return {
      totalProcessed: 0,
      criticalMemories: 0,
      decayedMemories: 0,
      averageDecayRate: 0,
      lastDecayCalculation: new Date(),
    };
  }

  /**
   * Initialize the memory system
   */
  async initialize(): Promise<boolean> {
    try {
      // Initialize memory services
      const services = await getMemoryServices();
      this.memoryService = services.memoryService as unknown as MemoryService;
      this.searchService = services.searchService as unknown as SearchService;
      
      this.initialized = true;

      // Initialize knowledge graph
      await this.knowledgeGraph.initialize();

      // Build initial graph from existing memories
      const memories = await this.memoryService.getAllMemories();
      await this.knowledgeGraph.buildGraphFromMemory(memories, []);

      return true;
    } catch (error) {
      handleError(MemoryError.initFailed('Failed to initialize memory system', { error: error instanceof Error ? error.message : String(error) }));
      return false;
    }
  }

  /**
   * Get the knowledge graph manager
   */
  getKnowledgeGraph(): KnowledgeGraphManager {
    return this.knowledgeGraph;
  }

  /**
   * Add a memory to the knowledge graph
   */
  async addMemoryToGraph(memory: MemoryEntry): Promise<void> {
    try {
      // Create memory node
      const memoryId = `memory-${memory.id}`;
      const label = memory.content.substring(0, 30) + (memory.content.length > 30 ? '...' : '');

      await this.knowledgeGraph.addNode({
        id: memoryId,
        label,
        type: 'concept',
        description: memory.content,
        metadata: {
          originalId: memory.id,
          type: memory.type,
          importance: memory.importance,
          ...memory.metadata
        }
      });

      // Find and connect to related memories
      const relatedMemories = await this.findRelatedMemories(memory.id);
      for (const related of relatedMemories) {
        const relatedId = `memory-${related.id}`;
        await this.knowledgeGraph.addEdge({
          from: memoryId,
          to: relatedId,
          type: 'related_to',
          label: 'Related memory'
        });
      }
    } catch (error) {
      handleError(MemoryError.initFailed('Failed to add memory to graph', { error: error instanceof Error ? error.message : String(error) }));
      throw error;
    }
  }

  /**
   * Find memories related to a specific memory
   */
  async findRelatedMemories(memoryId: string, limit: number = 5): Promise<MemoryEntry[]> {
    try {
      const memory = await this.memoryService.getMemory({ id: memoryId });
      if (!memory) {
        return [];
      }

      // Search for related memories
      const results = await this.searchService.search(
        memory.content,
        {
          limit: limit + 1, // +1 to exclude the original memory
          type: memory.type
        }
      );

      // Convert search results to memory entries
      const memoryEntries = await Promise.all(
        results.map(async (result: SearchResult<unknown>) => {
          const memory = await this.memoryService.getMemory({ id: result.id });
          return memory;
        })
      );

      // Filter out null values and the original memory
      return memoryEntries
        .filter((entry): entry is MemoryEntry => 
          entry !== null && entry.id !== memoryId
        )
        .slice(0, limit);
    } catch (error) {
      handleError(MemoryError.initFailed('Failed to find related memories', { error: error instanceof Error ? error.message : String(error) }));
      throw error;
    }
  }

  /**
   * Get insights about a memory
   */
  async getMemoryInsights(memoryId: string): Promise<{
    relatedConcepts: KnowledgeNode[];
    connections: KnowledgeEdge[];
    insights: string[];
  }> {
    try {
      const memoryNodeId = `memory-${memoryId}`;
      const node = await this.knowledgeGraph.getNode(memoryNodeId);
      if (!node) {
        return { relatedConcepts: [], connections: [], insights: [] };
      }

      // Get connected nodes
      const edges = await this.knowledgeGraph.getEdges(memoryNodeId);
      const connectedNodes = await Promise.all(
        edges.map((edge: KnowledgeEdge) => 
          this.knowledgeGraph.getNode(edge.from === memoryNodeId ? edge.to : edge.from)
        )
      );

      // Extract related concepts
      const relatedConcepts = connectedNodes
        .filter((node): node is KnowledgeNode => node !== null);

      // Generate insights
      const insights = [
        `Connected to ${relatedConcepts.length} related concepts`,
        `Has ${edges.length} total connections`,
        `Most common connection type: ${this.getMostCommonConnectionType(edges)}`
      ];

      return {
        relatedConcepts,
        connections: edges,
        insights
      };
    } catch (error) {
      handleError(MemoryError.initFailed('Failed to get memory insights', { error: error instanceof Error ? error.message : String(error) }));
      throw error;
    }
  }

  /**
   * Update relationships in the knowledge graph
   */
  async updateMemoryRelationships(
    memoryId: string,
    relatedMemoryIds: string[]
  ): Promise<void> {
    try {
      const memoryNodeId = `memory-${memoryId}`;

      // Get existing edges
      const existingEdges = await this.knowledgeGraph.getEdges(memoryNodeId);
      const existingRelatedIds = new Set(
        existingEdges.map((edge: KnowledgeEdge) => 
          edge.from === memoryNodeId ? edge.to : edge.from
        )
      );

      // Add new relationships
      for (const relatedId of relatedMemoryIds) {
        const relatedNodeId = `memory-${relatedId}`;
        if (!existingRelatedIds.has(relatedNodeId)) {
          await this.knowledgeGraph.addEdge({
            from: memoryNodeId,
            to: relatedNodeId,
            type: 'related_to',
            label: 'Related memory'
          });
        }
      }

      // Remove old relationships that are no longer valid
      for (const edge of existingEdges) {
        const relatedNodeId = edge.from === memoryNodeId ? edge.to : edge.from;
        const relatedId = relatedNodeId.replace('memory-', '');
        if (!relatedMemoryIds.includes(relatedId)) {
          await this.knowledgeGraph.deleteEdge(edge.from, edge.to);
        }
      }
    } catch (error) {
      handleError(MemoryError.initFailed('Failed to update memory relationships', { error: error instanceof Error ? error.message : String(error) }));
      throw error;
    }
  }

  /**
   * Get knowledge graph statistics
   */
  async getKnowledgeGraphStats(): Promise<{
    totalNodes: number;
    totalEdges: number;
    nodeTypes: Record<KnowledgeNodeType, number>;
    edgeTypes: Record<KnowledgeEdgeType, number>;
  }> {
    try {
      return await this.knowledgeGraph.getStats();
    } catch (error) {
      handleError(MemoryError.initFailed('Failed to get knowledge graph stats', { error: error instanceof Error ? error.message : String(error) }));
      throw error;
    }
  }

  /**
   * Get the most common connection type from edges
   */
  private getMostCommonConnectionType(edges: KnowledgeEdge[]): string {
    const typeCounts = new Map<string, number>();
    for (const edge of edges) {
      const count = typeCounts.get(edge.type) || 0;
      typeCounts.set(edge.type, count + 1);
    }

    let maxCount = 0;
    let mostCommon = 'unknown';
    for (const [type, count] of Array.from(typeCounts.entries())) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = type;
      }
    }

    return mostCommon;
  }

  /**
   * Add a new memory
   */
  async addMemory(
    content: string,
    type: MemoryType,
    importance: ImportanceLevel,
    source: MemorySource,
    metadata: Record<string, unknown> = {}
  ): Promise<MemoryEntry> {
    if (!this.initialized) {
      throw new MemoryError('Memory system not initialized', { agentId: this.agentId });
    }

    try {
      // Create memory entry
      const memory: MemoryEntry = {
        id: crypto.randomUUID(),
        content,
        type,
        importance,
        source,
        metadata,
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        accessCount: 0
      };

      // Store in memory service
      await this.memoryService.addMemory({
        id: memory.id,
        content: memory.content,
        type: memory.type,
        metadata: {
          ...memory.metadata,
          importance: memory.importance,
          source: memory.source,
          createdAt: memory.createdAt.toISOString(),
          lastAccessedAt: memory.lastAccessedAt.toISOString(),
          accessCount: memory.accessCount
        }
      });

      return memory;
    } catch (error) {
      throw new MemoryError(
        'Failed to add memory',
        { agentId: this.agentId, type, source },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Search for memories
   */
  async search(
    query: string,
    options: MemorySearchOptions = {}
  ): Promise<MemoryEntry[]> {
    if (!this.initialized) {
      throw new MemoryError('Memory system not initialized', { agentId: this.agentId });
    }

    try {
      // Search using search service
      const results = await this.searchService.search<BaseMemorySchema>(query, {
        limit: options.limit,
        type: options.type,
        metadata: options.metadata
      });

      // Convert results to MemoryEntry format
      return results.map(result => this.convertToMemoryEntry(result));
    } catch (error) {
      throw new MemoryError(
        'Failed to search memories',
        { agentId: this.agentId, query },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get recently modified memories
   */
  async getRecentlyModifiedMemories(limit: number = 10): Promise<MemoryEntry[]> {
    if (!this.initialized) {
      throw new MemoryError('Memory system not initialized', { agentId: this.agentId });
    }

    try {
      // Get recent memories from memory service
      const memories = await this.memoryService.getRecentMemories(limit);
      
      // Convert to MemoryEntry format
      return memories.map(memory => this.convertToMemoryEntry(memory));
    } catch (error) {
      throw new MemoryError(
        'Failed to get recent memories',
        { agentId: this.agentId },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get memory statistics
   */
  async getStats(): Promise<MemoryStats> {
    if (!this.initialized) {
      throw new MemoryError('Memory system not initialized', { agentId: this.agentId });
    }

    try {
      // Get stats from memory service
      const stats = await this.memoryService.getStats();
      
      return {
        totalMemories: stats.totalMemories,
        shortTermMemories: stats.shortTermMemories,
        longTermMemories: stats.longTermMemories,
        memoryUsageRatio: stats.memoryUsageRatio,
        averageMemorySize: stats.averageMemorySize,
        consolidationStats: {
          lastConsolidation: new Date(stats.consolidationStats.lastConsolidation),
          memoriesConsolidated: stats.consolidationStats.memoriesConsolidated
        },
        pruningStats: {
          lastPruning: new Date(stats.pruningStats.lastPruning),
          memoriesPruned: stats.pruningStats.memoriesPruned
        }
      };
    } catch (error) {
      throw new MemoryError(
        'Failed to get memory stats',
        { agentId: this.agentId },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Clear all memories
   */
  async clear(): Promise<void> {
    if (!this.initialized) {
      throw new MemoryError('Memory system not initialized', { agentId: this.agentId });
    }

    try {
      await this.memoryService.clearMemories();
    } catch (error) {
      throw new MemoryError(
        'Failed to clear memories',
        { agentId: this.agentId },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Shutdown the memory system
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      await this.memoryService.shutdown();
      this.initialized = false;
    } catch (error) {
      handleError(MemoryError.shutdownFailed('Error shutting down memory system', { agentId: this.agentId }, error instanceof Error ? error : undefined));
    }
  }

  /**
   * Convert search result to MemoryEntry
   */
  private convertToMemoryEntry(result: SearchResult<BaseMemorySchema>): MemoryEntry {
    return {
      id: result.id,
      content: result.content,
      type: result.type as MemoryType,
      importance: result.metadata.importance as ImportanceLevel,
      source: result.metadata.source as MemorySource,
      metadata: {
        ...result.metadata,
        createdAt: new Date(result.metadata.createdAt as string),
        lastAccessedAt: new Date(result.metadata.lastAccessedAt as string),
        accessCount: result.metadata.accessCount as number
      },
      createdAt: new Date(result.metadata.createdAt as string),
      lastAccessedAt: new Date(result.metadata.lastAccessedAt as string),
      accessCount: result.metadata.accessCount as number
    };
  }

  /**
   * Consolidate memories
   */
  async consolidateMemories(): Promise<void> {
    if (!this.initialized) {
      throw new MemoryError('Memory system not initialized', { agentId: this.agentId });
    }

    try {
      // Get recent memories
      const recentMemories = await this.getRecentlyModifiedMemories(100);
      
      if (recentMemories.length < 5) {
        return; // Not enough memories to consolidate
      }

      // Group memories by context/topic
      const groups = this.groupMemoriesByContext(recentMemories);
      
      // Consolidate each group
      for (const group of groups) {
        if (group.length < 2) continue;
        
        // Create consolidated memory
        const consolidatedMemory = await this.createConsolidatedMemory(group);
        
        // Add consolidated memory
        await this.addMemory(
          consolidatedMemory.content,
          consolidatedMemory.type,
          consolidatedMemory.importance,
          consolidatedMemory.source,
          {
            ...consolidatedMemory.metadata,
            originalMemoryIds: group.map(m => m.id)
          }
        );
        
        this.totalConsolidated++;
      }
      
      this.lastConsolidation = new Date();
    } catch (error) {
      throw new MemoryError(
        'Failed to consolidate memories',
        { agentId: this.agentId },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Prune memories
   */
  async pruneMemories(): Promise<void> {
    if (!this.initialized) {
      throw new MemoryError('Memory system not initialized', { agentId: this.agentId });
    }

    try {
      // Get all memories
      const memories = await this.getRecentlyModifiedMemories(1000);
      
      // Filter out important memories
      const toPrune = memories.filter(memory => 
        memory.importance === ImportanceLevel.LOW &&
        memory.accessCount < 3 &&
        Date.now() - memory.lastAccessedAt.getTime() > 7 * 24 * 60 * 60 * 1000 // 7 days
      );
      
      // Remove pruned memories
      for (const memory of toPrune) {
        await this.memoryService.clearMemories();
        this.totalPruned++;
      }
      
      this.lastPruning = new Date();
    } catch (error) {
      throw new MemoryError(
        'Failed to prune memories',
        { agentId: this.agentId },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Group memories by context
   */
  private groupMemoriesByContext(memories: MemoryEntry[]): MemoryEntry[][] {
    const groups: MemoryEntry[][] = [];
    const processed = new Set<string>();
    
    for (const memory of memories) {
      if (processed.has(memory.id)) continue;
      
      const group: MemoryEntry[] = [memory];
      processed.add(memory.id);
      
      // Find related memories
      for (const other of memories) {
        if (processed.has(other.id)) continue;
        
        if (this.areMemoriesRelated(memory, other)) {
          group.push(other);
          processed.add(other.id);
        }
      }
      
      if (group.length > 1) {
        groups.push(group);
      }
    }
    
    return groups;
  }

  /**
   * Check if two memories are related
   */
  private areMemoriesRelated(memory1: MemoryEntry, memory2: MemoryEntry): boolean {
    // Check if memories share similar content
    const similarity = this.calculateSimilarity(memory1.content, memory2.content);
    return similarity > 0.7; // 70% similarity threshold
  }

  /**
   * Calculate similarity between two strings
   */
  private calculateSimilarity(str1: string, str2: string): number {
    // Simple implementation using Levenshtein distance
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;
    
    const matrix: number[][] = [];
    
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    
    const distance = matrix[len1][len2];
    const maxLength = Math.max(len1, len2);
    return 1 - distance / maxLength;
  }

  /**
   * Create a consolidated memory from a group
   */
  private async createConsolidatedMemory(group: MemoryEntry[]): Promise<MemoryEntry> {
    // Combine content
    const content = group.map(m => m.content).join('\n\n');
    
    // Use highest importance level
    const importance = group.reduce((max, m) => 
      m.importance > max ? m.importance : max,
      ImportanceLevel.LOW
    );
    
    // Use most recent source
    const source = group.reduce((latest, m) => 
      m.lastAccessedAt > latest.lastAccessedAt ? m : latest
    ).source;
    
    // Combine metadata
    const metadata = group.reduce((combined, m) => ({
      ...combined,
      ...m.metadata
    }), {});
    
    return {
      id: crypto.randomUUID(),
      content,
      type: MemoryType.DOCUMENT,
      importance,
      source,
      metadata,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      accessCount: 0
    };
  }

  /**
   * Perform hybrid search combining vector and text search
   */
  async hybridSearch(
    query: string,
    options: HybridSearchOptions = {}
  ): Promise<MemoryEntry[]> {
    if (!this.initialized) {
      throw new MemoryError('Memory system not initialized', { agentId: this.agentId });
    }

    try {
      // Set default weights
      const textWeight = options.textWeight ?? 0.3;
      const vectorWeight = options.vectorWeight ?? 0.7;

      // Get vector search results
      const vectorResults = await this.search(query, {
        ...options,
        limit: options.limit ? options.limit * 2 : 20 // Get more results to rerank
      });

      // Get text search results
      const textResults = await this.search(query, {
        ...options,
        limit: options.limit ? options.limit * 2 : 20,
        metadata: {
          ...options.metadata,
          textSearch: true
        }
      });

      // Create map of vector results for quick lookup
      const vectorResultsMap = new Map<string, MemoryEntry>();
      vectorResults.forEach(result => {
        vectorResultsMap.set(result.id, result);
      });

      // Create combined results with hybrid scoring
      const hybridResults: MemoryEntry[] = [];

      // Process vector results first
      vectorResults.forEach(result => {
        hybridResults.push({
          ...result,
          metadata: {
            ...result.metadata,
            vectorScore: result.metadata.score as number * vectorWeight
          }
        });
      });

      // Process text results
      textResults.forEach(result => {
        const id = result.id;

        // If already in vector results, blend scores
        if (vectorResultsMap.has(id)) {
          const existingResult = vectorResultsMap.get(id)!;
          const idx = hybridResults.findIndex(r => r.id === id);

          // Blend scores
          const textScore = (result.metadata.score as number) * textWeight;
          const vectorScore = (existingResult.metadata.vectorScore as number) || 0;
          const blendedScore = textScore + vectorScore;

          hybridResults[idx] = {
            ...existingResult,
            metadata: {
              ...existingResult.metadata,
              textScore,
              vectorScore,
              score: blendedScore
            }
          };
        } else {
          // Add as new result with text match score only
          hybridResults.push({
            ...result,
            metadata: {
              ...result.metadata,
              textScore: (result.metadata.score as number) * textWeight,
              vectorScore: 0,
              score: (result.metadata.score as number) * textWeight
            }
          });
        }
      });

      // Normalize scores if requested
      if (options.normalizeScores) {
        const maxScore = Math.max(...hybridResults.map(r => r.metadata.score as number));
        hybridResults.forEach(result => {
          result.metadata.score = (result.metadata.score as number) / maxScore;
        });
      }

      // Sort by score and apply limit
      hybridResults.sort((a, b) => 
        (b.metadata.score as number) - (a.metadata.score as number)
      );

      return hybridResults.slice(0, options.limit || 10);
    } catch (error) {
      throw new MemoryError(
        'Failed to perform hybrid search',
        { agentId: this.agentId, query },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Identify if a query is part of an existing conversation thread
   */
  async identifyConversationThread(
    query: string,
    recentMessages: MemoryEntry[] = []
  ): Promise<{
    threadId?: string;
    threadTopic?: string;
    isPartOfThread: boolean;
    relatedMemories: MemoryEntry[];
    threadImportance: ImportanceLevel;
  }> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // If we have recent messages, try to find a matching thread
      if (recentMessages.length > 0) {
        console.log(`Analyzing ${recentMessages.length} recent messages for thread identification`);
        
        // Extract recent message IDs for reference
        const recentMessageIds = recentMessages.map(msg => msg.id);
        
        // Only look at message type memories
        const filteredMessages = recentMessages.filter(msg => 
          msg.type === MemoryType.MESSAGE
        );
        
        // Extract key topics from the current query
        const queryKeywords = this.extractKeyTerms(query);
        
        // Analyze recent messages for topical similarity
        let threadScore = 0;
        let threadKeywords: string[] = [];
        let threadMessages: MemoryEntry[] = [];
        
        // Find topical connections across recent messages
        for (const message of filteredMessages) {
          const messageContent = message.content || '';
          const messageKeywords = this.extractKeyTerms(messageContent);
          
          // Calculate overlap between this message and query keywords
          const overlapWithQuery = this.calculateKeywordOverlap(
            queryKeywords, 
            messageKeywords
          );
          
          // If there's significant overlap with the query or growing thread keywords,
          // consider this message part of the thread
          const overlapWithThread = this.calculateKeywordOverlap(
            threadKeywords, 
            messageKeywords
          );
          
          if (overlapWithQuery > 0.3 || overlapWithThread > 0.25) {
            // This message is part of the thread
            threadMessages.push(message);
            
            // Add unique keywords to thread keywords
            threadKeywords = Array.from(new Set([...threadKeywords, ...messageKeywords]));
            
            // Increase thread score
            threadScore += 1;
          }
        }
        
        // Check if we found a significant thread (at least 2 connected messages)
        const isPartOfThread = threadScore >= 2;
        
        // If we found a thread, search for additional related memories
        let relatedMemories: MemoryEntry[] = [];
        if (isPartOfThread) {
          // Use thread keywords to find more related memories
          const threadKeywordsQuery = threadKeywords.slice(0, 10).join(' ');
          
          // Search for any memory related to the thread topic
          relatedMemories = await this.getRelevantMemories(
            threadKeywordsQuery,
            10,
            undefined,
            threadKeywords
          );
        }
        
        // Generate a thread ID and topic if we found a thread
        let threadId, threadTopic;
        if (isPartOfThread) {
          // Generate a stable thread ID based on top keywords
          const stableKeywords = [...threadKeywords].sort().slice(0, 5);
          threadId = `thread_${stableKeywords.join('_')}`;
          
          // Generate a thread topic - top 3-5 keywords
          threadTopic = threadKeywords.slice(0, Math.min(5, threadKeywords.length)).join(', ');
        }
        
        // Determine thread importance
        // More messages and higher relevance = higher importance
        let threadImportance = ImportanceLevel.MEDIUM;
        if (threadScore >= 5) {
          threadImportance = ImportanceLevel.HIGH;
        } else if (threadScore <= 2) {
          threadImportance = ImportanceLevel.LOW;
        }
        
        // For certain key topics, increase importance
        const highImportanceTopics = [
          'onboarding', 'strategy', 'mission', 'vision', 'brand', 'budget',
          'goal', 'target', 'priority', 'roadmap', 'metrics', 'performance',
          'analytics', 'resources', 'stakeholders'
        ];
        
        // Check if any high importance topics are in the thread keywords
        for (const topic of highImportanceTopics) {
          if (threadKeywords.includes(topic)) {
            // Elevate importance for critical business topics
            threadImportance = ImportanceLevel.HIGH;
            break;
          }
        }
        
        // Return thread information
        return {
          threadId,
          threadTopic,
          isPartOfThread,
          relatedMemories,
          threadImportance
        };
      }
      
      // If no recent messages, return default thread information
      return {
        isPartOfThread: false,
        relatedMemories: [],
        threadImportance: ImportanceLevel.MEDIUM
      };
    } catch (error) {
      console.error('Error identifying conversation thread:', error);
      return {
        isPartOfThread: false,
        relatedMemories: [],
        threadImportance: ImportanceLevel.MEDIUM
      };
    }
  }

  /**
   * Extract key terms from text
   */
  private extractKeyTerms(text: string): string[] {
    // Convert to lowercase and remove punctuation
    const cleanText = text.toLowerCase().replace(/[^\w\s]/g, '');
    
    // Split into words and filter out common stop words
    const stopWords = new Set([
      'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
      'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
      'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
      'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what'
    ]);
    
    return cleanText
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  }

  /**
   * Calculate overlap between two sets of keywords
   */
  private calculateKeywordOverlap(keywords1: string[], keywords2: string[]): number {
    if (keywords1.length === 0 || keywords2.length === 0) {
      return 0;
    }
    
    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    
    // Count overlapping keywords
    let overlap = 0;
    for (const keyword of Array.from(set1)) {
      if (set2.has(keyword)) {
        overlap++;
      }
    }
    
    // Return overlap ratio
    return overlap / Math.max(set1.size, set2.size);
  }

  /**
   * Get relevant memories based on a query and optional filters
   */
  private async getRelevantMemories(
    query: string,
    limit: number = 10,
    type?: MemoryType,
    keywords?: string[]
  ): Promise<MemoryEntry[]> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Perform hybrid search
      const searchResults = await this.hybridSearch(query, {
        limit: limit * 2, // Get more results for better filtering
        type,
        metadata: keywords ? { keywords } : undefined
      });

      // Convert search results to memory entries and take only the requested limit
      return searchResults.slice(0, limit);
    } catch (error) {
      console.error('Error getting relevant memories:', error);
      return [];
    }
  }

  /**
   * Configure memory decay settings
   */
  async configureDecay(config: MemoryDecayConfig): Promise<void> {
    this.decayConfig = {
      ...this.decayConfig,
      ...config,
    };
  }

  /**
   * Calculate decay for a specific memory
   */
  async calculateMemoryDecay(memoryId: string): Promise<MemoryDecayResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const memory = await this.memoryService.getMemory({ id: memoryId });
    if (!memory) {
      throw new Error(`Memory not found: ${memoryId}`);
    }

    // Check if memory is critical
    const isCritical = memory.metadata?.critical === true;
    if (isCritical) {
      return {
        id: memoryId,
        newImportance: memory.importance,
        decayRate: 0,
        isCritical: true,
        daysSinceLastAccess: 0,
        accessCount: (memory.metadata?.accessCount as number) || 0,
      };
    }

    // Calculate days since last access
    const lastAccessedAt = memory.metadata?.lastAccessedAt as string || memory.createdAt.toISOString();
    const lastAccessed = new Date(lastAccessedAt);
    const now = new Date();
    const daysSinceLastAccess = Math.floor((now.getTime() - lastAccessed.getTime()) / (1000 * 60 * 60 * 24));

    // Skip decay if before start days
    if (daysSinceLastAccess < this.decayConfig.decayStartDays) {
      return {
        id: memoryId,
        newImportance: memory.importance,
        decayRate: 0,
        isCritical: false,
        daysSinceLastAccess,
        accessCount: (memory.metadata?.accessCount as number) || 0,
      };
    }

    // Calculate base decay rate
    let decayRate = this.decayConfig.baseDecayRate;

    // Apply type-specific multiplier
    const typeMultiplier = this.decayConfig.typeDecayRates[memory.type] || 1.0;
    decayRate *= typeMultiplier;

    // Apply importance-based adjustment
    const importanceMultiplier = this.getImportanceMultiplier(memory.importance);
    decayRate *= importanceMultiplier;

    // Apply access count adjustment
    const accessCount = (memory.metadata?.accessCount as number) || 0;
    const accessMultiplier = Math.max(0.5, 1 - (accessCount * 0.1)); // Reduce decay by 10% per access, up to 50%
    decayRate *= accessMultiplier;

    // Clamp decay rate
    decayRate = Math.min(
      this.decayConfig.maxDecayRate,
      Math.max(this.decayConfig.minDecayRate, decayRate)
    );

    // Calculate new importance
    const newImportance = this.calculateNewImportance(memory.importance, decayRate);

    return {
      id: memoryId,
      newImportance,
      decayRate,
      isCritical: false,
      daysSinceLastAccess,
      accessCount,
    };
  }

  /**
   * Apply decay to all memories
   */
  async applyMemoryDecay(): Promise<MemoryDecayStats> {
    if (!this.initialized) {
      await this.initialize();
    }

    const stats: MemoryDecayStats = {
      totalProcessed: 0,
      criticalMemories: 0,
      decayedMemories: 0,
      averageDecayRate: 0,
      lastDecayCalculation: new Date(),
    };

    try {
      // Get all memories
      const memories = await this.memoryService.getAllMemories();
      stats.totalProcessed = memories.length;

      let totalDecayRate = 0;
      let decayedCount = 0;

      // Process each memory
      for (const memory of memories) {
        const result = await this.calculateMemoryDecay(memory.id);
        
        if (result.isCritical) {
          stats.criticalMemories++;
          continue;
        }

        if (result.decayRate > 0) {
          // Update memory with new importance
          await this.memoryService.updateMemory({
            id: memory.id,
            importance: result.newImportance,
            metadata: {
              ...memory.metadata,
              lastDecayCalculation: new Date().toISOString(),
              decayRate: result.decayRate,
            },
          });

          totalDecayRate += result.decayRate;
          decayedCount++;
          stats.decayedMemories++;
        }
      }

      // Calculate average decay rate
      stats.averageDecayRate = decayedCount > 0 ? totalDecayRate / decayedCount : 0;

      // Update stats
      this.decayStats = stats;
      return stats;
    } catch (error) {
      console.error('Error applying memory decay:', error);
      throw error;
    }
  }

  /**
   * Mark a memory as critical to prevent decay
   */
  async markMemoryAsCritical(
    memoryId: string,
    reason: string
  ): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const memory = await this.memoryService.getMemory({ id: memoryId });
    if (!memory) {
      throw new Error(`Memory not found: ${memoryId}`);
    }

    await this.memoryService.updateMemory({
      id: memoryId,
      importance: this.decayConfig.criticalImportanceLevel,
      metadata: {
        ...memory.metadata,
        critical: true,
        criticalReason: reason,
        markedCriticalAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Get decay statistics
   */
  async getDecayStats(): Promise<MemoryDecayStats> {
    return this.decayStats;
  }

  /**
   * Get importance multiplier for decay calculation
   */
  private getImportanceMultiplier(importance: ImportanceLevel): number {
    switch (importance) {
      case ImportanceLevel.HIGH:
        return 0.5; // High importance memories decay 50% slower
      case ImportanceLevel.MEDIUM:
        return 1.0; // Medium importance memories decay at base rate
      case ImportanceLevel.LOW:
        return 1.5; // Low importance memories decay 50% faster
      default:
        return 1.0;
    }
  }

  /**
   * Calculate new importance level after decay
   */
  private calculateNewImportance(
    currentImportance: ImportanceLevel,
    decayRate: number
  ): ImportanceLevel {
    // If decay rate is very low, maintain current importance
    if (decayRate < 0.1) {
      return currentImportance;
    }

    // Calculate new importance based on decay rate
    switch (currentImportance) {
      case ImportanceLevel.HIGH:
        return decayRate > 0.3 ? ImportanceLevel.MEDIUM : ImportanceLevel.HIGH;
      case ImportanceLevel.MEDIUM:
        return decayRate > 0.3 ? ImportanceLevel.LOW : ImportanceLevel.MEDIUM;
      case ImportanceLevel.LOW:
        return ImportanceLevel.LOW; // Can't decay below LOW
      default:
        return currentImportance;
    }
  }

  /**
   * Expand a query with related terms to improve recall
   */
  private expandQuery(query: string): string {
    if (!this.queryExpansionConfig.enabled || !query || query.trim().length === 0) {
      return query;
    }
    
    // Extract key terms from the query
    const queryTerms = this.extractKeyTerms(query);
    
    // Don't expand very short queries as they're likely already focused
    if (queryTerms.length <= 2 && query.length < this.queryExpansionConfig.minQueryLength) {
      return query;
    }
    
    // Build expanded query
    let expandedTerms = new Set<string>();
    
    // Add original query terms
    queryTerms.forEach(term => expandedTerms.add(term));
    
    // Add expanded terms
    queryTerms.forEach(term => {
      const lowerTerm = term.toLowerCase();
      // If we have expansions for this term, add some of them
      if (this.queryExpansionConfig.expansionMap[lowerTerm]) {
        // Add up to maxExpansions terms to avoid diluting the query too much
        const expansionTerms = this.queryExpansionConfig.expansionMap[lowerTerm]
          .slice(0, this.queryExpansionConfig.maxExpansions);
        expansionTerms.forEach(expansion => expandedTerms.add(expansion));
      }
    });
    
    // Combine original query with expanded terms
    const expandedQuery = `${query} ${Array.from(expandedTerms).join(' ')}`;
    
    console.log(`Expanded query: "${query}" → "${expandedQuery}"`);
    
    return expandedQuery;
  }

  /**
   * Create multiple query variants to capture different aspects of a complex query
   */
  private createQueryClusters(query: string, queryKeywords: string[]): string[] {
    if (!this.queryClusteringConfig.enabled || queryKeywords.length < this.queryClusteringConfig.minKeywords) {
      return [query];
    }
    
    // Group similar keywords together to create focused sub-queries
    const clusters: string[][] = [];
    const usedKeywords = new Set<string>();
    
    // Assign keywords to clusters based on categories
    for (const category of this.queryClusteringConfig.categories) {
      const matchingKeywords = queryKeywords.filter(kw => 
        !usedKeywords.has(kw) && 
        category.some(cat => kw.includes(cat) || cat.includes(kw))
      );
      
      if (matchingKeywords.length > 0) {
        clusters.push(matchingKeywords);
        matchingKeywords.forEach(kw => usedKeywords.add(kw));
      }
    }
    
    // Add remaining keywords to their own cluster
    const remainingKeywords = queryKeywords.filter(kw => !usedKeywords.has(kw));
    if (remainingKeywords.length > 0) {
      clusters.push(remainingKeywords);
    }
    
    // Ensure we have at least the original query
    if (clusters.length === 0) {
      return [query];
    }
    
    // Build query variants from clusters
    const queryVariants = clusters.map(cluster => {
      // Combine cluster keywords with some original query context
      return `${query.substring(0, 50)} ${cluster.join(' ')}`;
    });
    
    // Always include the original query
    if (!queryVariants.includes(query)) {
      queryVariants.unshift(query);
    }
    
    // Limit the number of variants
    return queryVariants.slice(0, this.queryClusteringConfig.maxClusters);
  }

  /**
   * Get enhanced memories with hybrid search
   */
  async getEnhancedMemoriesWithHybridSearch(
    query: string,
    limit: number = 10,
    options: EnhancedSearchOptions = {}
  ): Promise<MemoryEntry[]> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Defaults for search weights
      const semanticWeight = options.semanticWeight || 0.7;
      const keywordWeight = options.keywordWeight || 0.3;
      
      // Extract key terms from the query
      const queryKeywords = this.extractKeyTerms(query);
      
      // Expand the query if needed (default to true)
      const shouldExpandQuery = options.expandQuery !== false;
      const queryForSearch = shouldExpandQuery ? this.expandQuery(query) : query;
      
      // Determine if we should use query clusters
      const useQueryClusters = options.useQueryClusters !== false && queryKeywords.length >= 3;
      
      // If using clusters, create sub-queries for different aspects
      const queryVariants = useQueryClusters 
        ? this.createQueryClusters(query, queryKeywords)
        : [queryForSearch];
      
      // Step 1: Get candidate memories using semantic search for each query variant
      let allCandidates: MemoryEntry[] = [];
      
      for (const queryVariant of queryVariants) {
        // Get more candidates than needed to ensure good coverage
        const candidateLimit = useQueryClusters 
          ? Math.ceil(limit * 1.5 / queryVariants.length) 
          : limit * 2;
        
        // Perform semantic search for this query variant
        const semanticResults = await this.search(
          queryVariant,
          {
            limit: candidateLimit,
            type: options.type,
            metadata: options.metadata
          }
        );
        
        // Add to candidates
        allCandidates = [...allCandidates, ...semanticResults];
      }
      
      // Deduplicate candidates
      const dedupedCandidates: MemoryEntry[] = [];
      const seenIds = new Set<string>();
      
      for (const memory of allCandidates) {
        if (!seenIds.has(memory.id)) {
          seenIds.add(memory.id);
          dedupedCandidates.push(memory);
        }
      }
      
      // Step 2: Calculate hybrid scores using both semantic and keyword matching
      const scoredMemories = dedupedCandidates.map(memory => {
        // Extract content
        const content = memory.content || '';
        
        // Count exact keyword matches
        let keywordMatches = 0;
        let keywordMatchCount = 0;
        
        if (queryKeywords.length > 0) {
          // Convert content to lowercase for case-insensitive matching
          const lowerContent = content.toLowerCase();
          
          // Count matches
          for (const keyword of queryKeywords) {
            const lowerKeyword = keyword.toLowerCase();
            // Use word boundary for more precise matching
            const regex = new RegExp(`\\b${lowerKeyword}\\b`, 'i');
            
            if (regex.test(lowerContent)) {
              keywordMatches += 1;
              
              // Count multiple occurrences (with diminishing returns)
              const matches = (lowerContent.match(new RegExp(regex, 'g')) || []).length;
              keywordMatchCount += Math.min(matches, 3); // Cap at 3 to avoid over-counting
            }
          }
        }
        
        // Calculate keyword score (0 to 1)
        let keywordScore = 0;
        if (queryKeywords.length > 0) {
          // If requiring all keywords, check if we matched all of them
          if (options.requireAllKeywords && keywordMatches < queryKeywords.length) {
            keywordScore = 0.1 * (keywordMatches / queryKeywords.length); // Small partial score
          } else {
            // Normal scoring - match proportion plus bonus for multiple occurrences
            keywordScore = 
              (keywordMatches / queryKeywords.length) * 0.7 + // Base score from proportion matched
              Math.min(keywordMatchCount / (queryKeywords.length * 2), 0.3); // Bonus for multiple matches
          }
        }
        
        // Get the semantic score if available, otherwise assign moderate score
        const rerankScore = memory.metadata?.rerankScore || 0.5;
        const semanticScore = typeof rerankScore === 'number' ? rerankScore : 0.5;
        
        // Compute combined score
        const combinedScore = (semanticScore * semanticWeight) + (keywordScore * keywordWeight);
        
        // Boost certain memory types that should be prioritized
        let boostFactor = 1.0;
        
        // Boost based on importance
        if (memory.importance === ImportanceLevel.CRITICAL) {
          boostFactor *= 1.25;
        } else if (memory.importance === ImportanceLevel.HIGH) {
          boostFactor *= 1.15;
        }
        
        // Boost messages with structured content
        const hasStructure = 
          (memory.content || '').includes('##') || // Markdown headings
          /\d+\.\s+[\w\s]+/.test(memory.content || ''); // Numbered lists
          
        if (hasStructure) {
          boostFactor *= 1.1;
        }
        
        // Apply boost
        const finalScore = combinedScore * boostFactor;
        
        return {
          memory,
          score: finalScore,
          keywordScore,
          semanticScore,
          keywordMatches,
          boostFactor
        };
      });
      
      // Filter out memories with scores below minimum threshold (if specified)
      const minScore = options.minRelevanceScore || 0.1;
      const filteredMemories = scoredMemories.filter(item => item.score >= minScore);
      
      // Sort by score (highest first)
      filteredMemories.sort((a, b) => b.score - a.score);
      
      // Add scores to metadata for debugging
      const resultMemories = filteredMemories.slice(0, limit).map(item => {
        // Clone the memory to avoid modifying original objects
        const memory = { ...item.memory };
        
        // Ensure metadata exists
        if (!memory.metadata) {
          memory.metadata = {};
        }
        
        // Add scores to metadata
        memory.metadata.hybridScore = item.score.toFixed(2);
        memory.metadata.keywordScore = item.keywordScore.toFixed(2);
        memory.metadata.semanticScore = item.semanticScore.toFixed(2);
        memory.metadata.keywordMatches = item.keywordMatches;
        
        return memory;
      });
      
      console.log(`Hybrid search for "${query}" found ${resultMemories.length} results`);
      return resultMemories;
    } catch (error) {
      console.error('Error in hybrid memory search:', error);
      // Fallback to standard search
      return this.search(query, { limit, type: options.type, metadata: options.metadata });
    }
  }

  /**
   * Get best memories considering importance and relevance
   */
  async getBestMemories(
    query: string,
    limit: number = 7,
    options: {
      types?: MemoryType[];
      expandQuery?: boolean;
      considerImportance?: boolean;
      requireKeywords?: boolean;
      debugScores?: boolean;
    } = {}
  ): Promise<MemoryEntry[]> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Configure search with good defaults
      const searchOptions: EnhancedSearchOptions = {
        type: options.types?.[0], // Use first type if array provided
        semanticWeight: 0.7,
        keywordWeight: 0.3,
        expandQuery: options.expandQuery !== false, // Default to true
        requireAllKeywords: options.requireKeywords === true, // Default to false
        minRelevanceScore: 0.15,
        useQueryClusters: query.length > 20 // Only use query clusters for longer queries
      };
      
      // Use our hybrid search
      const memories = await this.getEnhancedMemoriesWithHybridSearch(
        query,
        limit * 2, // Get more candidates for additional filtering
        searchOptions
      );
      
      // Filter by types if specified
      const filteredMemories = options.types 
        ? memories.filter(m => options.types!.includes(m.type))
        : memories;
      
      // Apply additional prioritization if needed
      if (options.considerImportance !== false) {
        // Ensure we include at least some high-importance memories if available
        const highImportanceMemories = filteredMemories.filter(m => 
          m.importance === ImportanceLevel.CRITICAL || 
          m.importance === ImportanceLevel.HIGH
        );
        
        const otherMemories = filteredMemories.filter(m => 
          m.importance !== ImportanceLevel.CRITICAL && 
          m.importance !== ImportanceLevel.HIGH
        );
        
        // If we have high importance memories, ensure they're included
        if (highImportanceMemories.length > 0) {
          // Reserve at least 1/3 of slots for high importance memories if available
          const highImportanceSlots = Math.min(
            Math.ceil(limit / 3),
            highImportanceMemories.length
          );
          
          // Fill remaining slots with other memories
          const otherSlots = limit - highImportanceSlots;
          
          // Combine results
          const results = [
            ...highImportanceMemories.slice(0, highImportanceSlots),
            ...otherMemories.slice(0, otherSlots)
          ];
          
          return results;
        }
      }
      
      // If no special handling needed, return the top memories
      return filteredMemories.slice(0, limit);
    } catch (error) {
      console.error('Error getting best memories:', error);
      // Fallback to standard method
      return this.search(query, { limit, type: options.types?.[0] });
    }
  }
} 