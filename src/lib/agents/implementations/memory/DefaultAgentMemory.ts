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
  BaseMemorySchema
} from '../../shared/memory/types';
import { handleError } from '../../../errors/errorHandler';
import { getMemoryServices } from '../../../../server/memory/services';

/**
 * Hybrid search options
 */
interface HybridSearchOptions extends MemorySearchOptions {
  textWeight?: number;
  vectorWeight?: number;
  normalizeScores?: boolean;
}

/**
 * Default memory implementation
 */
export class DefaultAgentMemory implements AgentMemory {
  private memoryService!: MemoryService;
  private searchService!: SearchService;
  private agentId: string;
  private initialized: boolean = false;
  private lastConsolidation: Date | null = null;
  private lastPruning: Date | null = null;
  private totalConsolidated: number = 0;
  private totalPruned: number = 0;

  constructor(agentId: string) {
    this.agentId = agentId;
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
      return true;
    } catch (error) {
      handleError(MemoryError.initFailed(
        'Error initializing memory system',
        { agentId: this.agentId },
        error instanceof Error ? error : undefined
      ));
      return false;
    }
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
      handleError(MemoryError.shutdownFailed(
        'Error shutting down memory system',
        { agentId: this.agentId },
        error instanceof Error ? error : undefined
      ));
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
} 