import { getMemoryServices } from '../../../server/memory/services';
import { WorkingMemoryItem, FileReference } from '../types';
import { ImportanceLevel } from '../../../constants/memory';
import { IdGenerator } from '../../../utils/ulid';
import { SearchResult } from '../../../server/memory/services/search/types';
import { BaseMemorySchema } from '../../../server/memory/models';
import { extractQueryTags } from '../../../utils/queryTagExtractor';

// Constants for memory retrieval
const DEFAULT_MEMORY_LIMIT = 10;
const DEFAULT_IMPORTANCE_WEIGHT = 1.5;
const DEFAULT_SEMANTIC_WEIGHT = 1.0;
const DEFAULT_TAG_MATCH_WEIGHT = 0.8;
const DEFAULT_RECENCY_WEIGHT = 0.5;

// Weight configuration for the scoring algorithm
export interface ScoringWeights {
  semanticWeight: number;
  importanceWeight: number;
  tagMatchWeight: number;
  recencyWeight: number;
}

/**
 * Debug level for memory retrieval logging
 */
export enum MemoryRetrievalLogLevel {
  NONE = 0,      // No logging
  ERROR = 1,     // Log errors only
  BASIC = 2,     // Basic info + errors
  VERBOSE = 3,   // Detailed info + scoring
  DEBUG = 4      // All debug information
}

export interface MemoryRetrievalOptions {
  // Basic retrieval parameters
  query: string;
  userId: string;
  limit?: number;
  
  // Advanced retrieval options
  semanticSearch?: boolean;
  tags?: string[];
  temporalWeight?: number;
  recencyWindow?: {
    days?: number;
    hours?: number;
  };
  
  // Importance weighting
  importanceWeighting?: {
    enabled: boolean;
    priorityWeight?: number;
    confidenceWeight?: number;
    useTypeWeights?: boolean;
    importanceScoreWeight?: number;
  };
  
  // Scoring weights
  scoringWeights?: Partial<ScoringWeights>;
  
  // Logging level
  logLevel?: MemoryRetrievalLogLevel;
  
  // Formatting options
  maxTokens?: number;
  includeMetadata?: boolean;
}

/**
 * Service for retrieving relevant memories during the thinking process
 */
export class MemoryRetriever {
  /**
   * Type-based importance weights
   */
  private typeWeights: Record<string, number> = {
    'goal': 2.0,   // Goals are highest priority
    'fact': 1.5,   // Facts are important for context
    'entity': 1.3, // Entities are key information
    'preference': 1.2, // User preferences are important
    'task': 1.0,   // Tasks are standard weight
    'message': 1.3 // Messages are important for context
  };
  
  /**
   * Default scoring weights
   */
  private defaultWeights: ScoringWeights = {
    semanticWeight: DEFAULT_SEMANTIC_WEIGHT,
    importanceWeight: DEFAULT_IMPORTANCE_WEIGHT,
    tagMatchWeight: DEFAULT_TAG_MATCH_WEIGHT,
    recencyWeight: DEFAULT_RECENCY_WEIGHT
  };
  
  /**
   * Current logging level
   */
  private logLevel: MemoryRetrievalLogLevel = MemoryRetrievalLogLevel.BASIC;
  
  /**
   * Retrieve relevant memories based on the query
   */
  async retrieveMemories(
    options: MemoryRetrievalOptions
  ): Promise<{
    memories: WorkingMemoryItem[];
    memoryIds: string[];
  }> {
    try {
      // Set logging level for this retrieval operation
      this.logLevel = options.logLevel ?? MemoryRetrievalLogLevel.BASIC;
      
      // Log memory retrieval request
      this.log(MemoryRetrievalLogLevel.BASIC, 
        `🔍 Memory retrieval for query: "${options.query}" with user ID: ${options.userId}`);
      
      // Get memory services
      const { searchService } = await getMemoryServices();
      
      // Extract query tags if not provided
      const queryTags = options.tags || await this.extractTagsFromQuery(options.query);
      
      if (queryTags.length > 0) {
        this.log(MemoryRetrievalLogLevel.BASIC, 
          `📌 Extracted tags from query: ${queryTags.join(', ')}`);
      }
      
      // Create filter for memory search
      const filter: Record<string, any> = {
        must: [
          { key: "metadata.userId.id", match: { value: options.userId } }
        ]
      };
      
      // Add tag filters if provided, but make them optional
      // Don't limit to only tag matches, allow semantic search to find relevant results too
      if (queryTags.length > 0) {
        this.log(MemoryRetrievalLogLevel.VERBOSE, 
          `🏷️ Applying flexible tag filtering with tags: ${queryTags.join(', ')}`);
        
        // For better retrieval, we'll avoid strict tag filtering in the query
        // and rely on our scoring algorithm to prioritize tag matches
        // This ensures we get a mix of tag-matched and semantically relevant results
      }
      
      // Define search options with proper typing
      const searchOptions = {
        filter,
        limit: (options.limit || DEFAULT_MEMORY_LIMIT) * 3, // Get more candidates for re-ranking
        includeMetadata: options.includeMetadata !== false,
        // Add similarity search if requested
        similaritySearch: options.semanticSearch !== false ? { enabled: true } : undefined,
        // Add boost for tag matches if tags are provided
        boostParams: queryTags.length > 0 ? {
          fields: [{ key: "metadata.tags", value: queryTags, factor: 1.5 }]
        } : undefined
      };
      
      // Perform search
      this.log(MemoryRetrievalLogLevel.VERBOSE, `🔎 Performing search with options:`, searchOptions);
      const searchResults = await searchService.search(options.query, searchOptions);
      
      this.log(MemoryRetrievalLogLevel.BASIC, 
        `📊 Retrieved ${searchResults.length} memory candidates for processing`);
      
      // Convert search results to working memory items
      let memories: WorkingMemoryItem[] = [];
      const memoryIds: string[] = [];
      
      // Process each search result
      for (const result of searchResults) {
        try {
          // Type assertion to work with the search result structure
          const resultData = result as unknown as {
            point: {
              id: string;
              payload: {
                content: string;
                metadata?: {
                  tags?: string[];
                  type?: string;
                  priority?: number;
                  confidence?: number;
                  importance?: ImportanceLevel;
                  importance_score?: number;
                  contentSummary?: string;
                  timestamp?: number;
                  createdAt?: number;
                };
              };
            };
            score: number;
          };
          
          const memoryId = String(resultData.point?.id || IdGenerator.generate("memory"));
          
          // Extract metadata for importance weighting
          const memoryType = String(resultData.point?.payload?.metadata?.type || 'fact');
          const priority = Number(resultData.point?.payload?.metadata?.priority || 5);
          const confidence = Number(resultData.point?.payload?.metadata?.confidence || 0.7);
          const importanceLevel = resultData.point?.payload?.metadata?.importance;
          const importanceScore = resultData.point?.payload?.metadata?.importance_score || 0.5;
          const contentSummary = resultData.point?.payload?.metadata?.contentSummary;
          const timestamp = resultData.point?.payload?.metadata?.timestamp || 
                           resultData.point?.payload?.metadata?.createdAt || 
                           Date.now();
          
          // Extract memory tags
          const memoryTags = Array.isArray(resultData.point?.payload?.metadata?.tags) 
            ? resultData.point.payload.metadata.tags 
            : [];
          
          // Get memory content - use type assertion to handle text field
          const payload = resultData.point?.payload as any;
          const content = String(payload?.content || payload?.text || '');
          
          // Create a working memory item
          memories.push({
            id: memoryId,
            type: memoryType as 'entity' | 'fact' | 'preference' | 'task' | 'goal' | 'message',
            content: content,
            tags: memoryTags,
            addedAt: new Date(timestamp),
            priority: priority,
            expiresAt: null,
            confidence: confidence,
            userId: options.userId,
            // Store original relevance score for ranking
            _relevanceScore: resultData.score || 0.5,
            // Store additional metadata including importance information
            metadata: {
              importance: importanceLevel,
              importance_score: importanceScore,
              contentSummary: contentSummary,
              timestamp: timestamp,
              // No need for message_type - we'll use tags for that
            }
          });
          
          memoryIds.push(memoryId);
        } catch (itemError) {
          this.log(MemoryRetrievalLogLevel.ERROR, 
            `⚠️ Error processing memory item:`, itemError);
        }
      }
      
      // Apply enhanced relevance scoring
      memories = this.applyEnhancedScoring(
        memories, 
        options.query,
        queryTags,
        options.scoringWeights || {},
        options.importanceWeighting?.enabled !== false
      );
      
      // Limit to requested number of memories
      memories = memories.slice(0, options.limit || DEFAULT_MEMORY_LIMIT);
      
      // Log top memories
      if (this.logLevel >= MemoryRetrievalLogLevel.VERBOSE) {
        this.logTopMemories(memories, 3);
      }
      
      return { memories, memoryIds };
    } catch (error) {
      this.log(MemoryRetrievalLogLevel.ERROR, `❌ Error retrieving memories:`, error);
      return { memories: [], memoryIds: [] };
    }
  }
  
  /**
   * Apply enhanced scoring algorithm to memories
   */
  private applyEnhancedScoring(
    memories: WorkingMemoryItem[], 
    query: string,
    queryTags: string[],
    scoringWeights: Partial<ScoringWeights>,
    useImportance: boolean
  ): WorkingMemoryItem[] {
    // Get final weights, using defaults for missing values
    const weights: ScoringWeights = {
      semanticWeight: scoringWeights.semanticWeight ?? this.defaultWeights.semanticWeight,
      importanceWeight: useImportance 
        ? (scoringWeights.importanceWeight ?? this.defaultWeights.importanceWeight)
        : 0,
      tagMatchWeight: scoringWeights.tagMatchWeight ?? this.defaultWeights.tagMatchWeight,
      recencyWeight: scoringWeights.recencyWeight ?? this.defaultWeights.recencyWeight
    };
    
    this.log(MemoryRetrievalLogLevel.VERBOSE, 
      `⚖️ Scoring weights: semantic=${weights.semanticWeight}, importance=${weights.importanceWeight}, ` +
      `tag=${weights.tagMatchWeight}, recency=${weights.recencyWeight}`);
    
    // Calculate timestamp for recency comparison (24 hours ago)
    const recentTimestamp = Date.now() - (24 * 60 * 60 * 1000);
    
    // Score each memory
    const scoredMemories = memories.map(memory => {
      // Start with base relevance score from semantic search
      let semanticScore = memory._relevanceScore || 0.5;
      
      // Calculate importance score (0-1.0 range)
      let importanceScore = 0;
      if (memory.metadata?.importance_score !== undefined) {
        importanceScore = memory.metadata.importance_score;
      } else if (memory.metadata?.importance) {
        // Convert importance level to score if only level is available
        switch(memory.metadata.importance) {
          case ImportanceLevel.CRITICAL: importanceScore = 1.0; break;
          case ImportanceLevel.HIGH: importanceScore = 0.75; break;
          case ImportanceLevel.MEDIUM: importanceScore = 0.5; break;
          case ImportanceLevel.LOW: importanceScore = 0.25; break;
          default: importanceScore = 0.5;
        }
      }
      
      // Apply type-based adjustment to importance
      if (this.typeWeights[memory.type]) {
        importanceScore *= this.typeWeights[memory.type];
        // Normalize back to 0-1 range
        importanceScore = Math.min(importanceScore, 1.0);
      }
      
      // Calculate tag match score
      const tagMatchScore = this.calculateTagMatchScore(memory.tags, queryTags);
      
      // Calculate recency score (0-1.0 range)
      const timestamp = memory.metadata?.timestamp || memory.addedAt.getTime();
      const recencyScore = timestamp > recentTimestamp ? 1.0 : 0.5;
      
      // Calculate final score using weighted formula
      const finalScore = 
        (semanticScore * weights.semanticWeight) +
        (importanceScore * weights.importanceWeight) +
        (tagMatchScore * weights.tagMatchWeight) +
        (recencyScore * weights.recencyWeight);
      
      // Normalize by sum of weights
      const weightSum = weights.semanticWeight + weights.importanceWeight + 
                       weights.tagMatchWeight + weights.recencyWeight;
                       
      const normalizedScore = finalScore / weightSum;
          
      // Log detailed scoring for verbose mode
      if (this.logLevel >= MemoryRetrievalLogLevel.DEBUG) {
        this.log(MemoryRetrievalLogLevel.DEBUG, 
          `🧮 Memory ${memory.id} scoring: ` +
          `semantic=${semanticScore.toFixed(2)}, ` +
          `importance=${importanceScore.toFixed(2)}, ` +
          `tags=${tagMatchScore.toFixed(2)}, ` +
          `recency=${recencyScore.toFixed(2)}, ` +
          `final=${normalizedScore.toFixed(4)}`);
      }
      
      return { 
        memory, 
        score: normalizedScore,
        components: {
          semanticScore,
          importanceScore,
          tagMatchScore,
          recencyScore
        }
      };
    });
    
    // Sort by final score (descending)
    return scoredMemories
      .sort((a, b) => b.score - a.score)
      .map(item => {
        // Store the final calculated score for reference
        item.memory._relevanceScore = item.score;
        return item.memory;
      });
  }

  /**
   * Calculate tag match score between memory tags and query tags
   */
  private calculateTagMatchScore(memoryTags: string[], queryTags: string[]): number {
    if (!queryTags.length || !memoryTags.length) return 0;
    
    // Count matching tags
    const matches = memoryTags.filter(tag => 
      queryTags.some(queryTag => 
        queryTag.toLowerCase() === tag.toLowerCase()
      )
    ).length;
    
    // Calculate score based on proportion of matching tags
    // Higher scores for higher proportion of matches
    const memoryTagCoverage = matches / memoryTags.length;
    const queryTagCoverage = matches / queryTags.length;
    
    // Blend the two perspectives
    return (memoryTagCoverage + queryTagCoverage) / 2;
  }
  
  /**
   * Extract possible tags from a query
   */
  private async extractTagsFromQuery(query: string): Promise<string[]> {
    try {
      // Use the tag extractor to get potential tags
      const extractionResult = await extractQueryTags(query);
      
      // Return extracted tags
      return extractionResult?.tags?.map(tag => tag.text.toLowerCase()) || [];
    } catch (error) {
      this.log(MemoryRetrievalLogLevel.ERROR, 
        `⚠️ Error extracting tags from query:`, error);
      return [];
    }
  }
  
  /**
   * Log top memories for debugging
   */
  private logTopMemories(memories: WorkingMemoryItem[], count: number): void {
    this.log(MemoryRetrievalLogLevel.VERBOSE, 
      `🏆 Top ${Math.min(count, memories.length)} memories by score:`);
    
    memories.slice(0, count).forEach((memory, index) => {
      const importanceStr = memory.metadata?.importance 
        ? `${memory.metadata.importance}(${memory.metadata.importance_score?.toFixed(2) || 'N/A'})` 
        : 'N/A';
      
      const contentPreview = memory.content.length > 50 
        ? `${memory.content.substring(0, 50)}...` 
        : memory.content;
      
      this.log(MemoryRetrievalLogLevel.VERBOSE, 
        `  ${index + 1}. ID: ${memory.id}, Score: ${memory._relevanceScore?.toFixed(4)}, ` +
        `Importance: ${importanceStr}, Tags: ${memory.tags.join(',') || 'none'}`);
      
      this.log(MemoryRetrievalLogLevel.VERBOSE, 
        `     Content: "${contentPreview}"`);
    });
  }
  
  /**
   * Conditional logging based on log level
   */
  private log(level: MemoryRetrievalLogLevel, message: string, data?: any): void {
    if (this.logLevel >= level) {
      if (data) {
        console.log(`[MemoryRetriever] ${message}`, data);
      } else {
        console.log(`[MemoryRetriever] ${message}`);
      }
    }
  }
  
  /**
   * Retrieve the user's working memory
   */
  async getWorkingMemory(userId: string): Promise<WorkingMemoryItem[]> {
    try {
      const { memoryService } = await getMemoryServices();
      
      // Implement this based on your storage mechanism
      // This is a placeholder for the actual implementation
      return [];
    } catch (error) {
      this.log(MemoryRetrievalLogLevel.ERROR, 
        `❌ Error retrieving working memory:`, error);
      return [];
    }
  }
} 