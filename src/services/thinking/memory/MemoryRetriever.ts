import { getMemoryServices } from '../../../server/memory/services';
import { WorkingMemoryItem } from '../types';
import { ImportanceLevel } from '../../../constants/memory';
import { IdGenerator } from '../../../utils/ulid';
import { MemoryType } from '../../../server/memory/config/types';
import { SearchResult } from '../../../server/memory/services/search/types';
import { BaseMemorySchema } from '../../../server/memory/models';
import { extractQueryTags } from '../../../utils/queryTagExtractor';

// Constants for memory retrieval
const DEFAULT_MEMORY_LIMIT = 10;
const DEFAULT_IMPORTANCE_WEIGHT = 1.5;
const DEFAULT_SEMANTIC_WEIGHT = 1.0;
const DEFAULT_TAG_MATCH_WEIGHT = 0.8;
const DEFAULT_RECENCY_WEIGHT = 0.5;
const DEFAULT_CONTENT_VALUE_WEIGHT = 0.7;  // New: Content value scoring
const DEFAULT_LENGTH_WEIGHT = 0.3;         // New: Length scoring
const DEFAULT_USER_MESSAGE_WEIGHT = 0.4;   // New: User message preference

// Weight configuration for the scoring algorithm
export interface ScoringWeights {
  semanticWeight: number;
  importanceWeight: number;
  tagMatchWeight: number;
  recencyWeight: number;
  contentValueWeight: number;  // New: Content value (answers vs questions)
  lengthWeight: number;        // New: Message length bonus
  userMessageWeight: number;   // New: User vs agent message preference
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
  
  // Exclusion options
  excludeMessageIds?: string[];  // New: Exclude specific message IDs (e.g., current message being responded to)
  
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
    recencyWeight: DEFAULT_RECENCY_WEIGHT,
    contentValueWeight: DEFAULT_CONTENT_VALUE_WEIGHT,
    lengthWeight: DEFAULT_LENGTH_WEIGHT,
    userMessageWeight: DEFAULT_USER_MESSAGE_WEIGHT
  };
  
  /**
   * Current logging level
   */
  private logLevel: MemoryRetrievalLogLevel = MemoryRetrievalLogLevel.BASIC;
  
  /**
   * Retrieve relevant memories based on the query
   */
  async retrieveMemories(
    options: MemoryRetrievalOptions & { intentConfidence?: number }
  ): Promise<{
    memories: WorkingMemoryItem[];
    memoryIds: string[];
    fromWorkingMemoryOnly?: boolean;
  }> {
    try {
      // Set logging level for this retrieval operation
      this.logLevel = options.logLevel ?? MemoryRetrievalLogLevel.BASIC;
      
      // Log memory retrieval request
      this.log(MemoryRetrievalLogLevel.BASIC, 
        `🔍 Memory retrieval for query: "${options.query}" with user ID: ${options.userId}`);
      
      // Step 1: Check working memory first
      const workingMemoryResult = await this.checkWorkingMemoryFirst(options);
      
      // If working memory is sufficient, return it without querying the full memory store
      if (workingMemoryResult.sufficientConfidence && workingMemoryResult.memories.length > 0) {
        this.log(MemoryRetrievalLogLevel.BASIC, 
          `✅ Working memory is sufficient, skipping full memory retrieval`);
          
        // Log top memories if verbose
        if (this.logLevel >= MemoryRetrievalLogLevel.VERBOSE) {
          this.logTopMemories(workingMemoryResult.memories, 3);
        }
        
        return { 
          memories: workingMemoryResult.memories, 
          memoryIds: workingMemoryResult.memoryIds,
          fromWorkingMemoryOnly: true
        };
      }
      
      // Step 2: If working memory is not sufficient, query the full memory store
      // but exclude any IDs already found in working memory
      this.log(MemoryRetrievalLogLevel.BASIC, 
        `ℹ️ Working memory insufficient, proceeding to full memory retrieval`);
      
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
      
      // Add exclusion filter for working memory IDs to avoid duplicates
      const excludeIds = [...(workingMemoryResult.memoryIds || [])];
      
      // Add any specifically excluded message IDs (e.g., current message being responded to)
      if (options.excludeMessageIds && options.excludeMessageIds.length > 0) {
        excludeIds.push(...options.excludeMessageIds);
        this.log(MemoryRetrievalLogLevel.BASIC, 
          `🚫 Excluding ${options.excludeMessageIds.length} message IDs from retrieval: ${options.excludeMessageIds.join(', ')}`);
      }
      
      // Apply exclusion filter if we have IDs to exclude
      if (excludeIds.length > 0) {
        filter.must_not = [
          { key: "id", match: { any: excludeIds } }
        ];
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
        } : undefined,
        // CRITICAL FIX: Explicitly specify memory types to exclude tasks collection
        types: [MemoryType.MESSAGE, MemoryType.THOUGHT, MemoryType.REFLECTION, MemoryType.INSIGHT, MemoryType.DOCUMENT]
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
      
      // Combine working memory and standard memory results, avoiding duplicates
      if (workingMemoryResult.memories.length > 0) {
        const combinedMemories = [...workingMemoryResult.memories];
        const existingIds = new Set(workingMemoryResult.memoryIds);
        
        // Add non-duplicate memories from the regular retrieval
        for (const memory of memories) {
          if (!existingIds.has(memory.id)) {
            combinedMemories.push(memory);
            existingIds.add(memory.id);
          }
        }
        
        // Re-sort the combined memories by relevance score
        combinedMemories.sort((a, b) => 
          (b._relevanceScore || 0) - (a._relevanceScore || 0)
        );
        
        // Update memories and IDs
        memories = combinedMemories.slice(0, options.limit || DEFAULT_MEMORY_LIMIT);
        
        this.log(MemoryRetrievalLogLevel.BASIC, 
          `📊 Combined ${workingMemoryResult.memories.length} working memory items with ${memories.length - workingMemoryResult.memories.length} long-term memory items`);
      }
      
      // Log top memories
      if (this.logLevel >= MemoryRetrievalLogLevel.VERBOSE) {
        this.logTopMemories(memories, 3);
      }
      
      return { 
        memories, 
        memoryIds: memories.map(memory => memory.id)
      };
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
      recencyWeight: scoringWeights.recencyWeight ?? this.defaultWeights.recencyWeight,
      contentValueWeight: scoringWeights.contentValueWeight ?? 0.5,
      lengthWeight: scoringWeights.lengthWeight ?? 0.5,
      userMessageWeight: scoringWeights.userMessageWeight ?? 0.5
    };
    
    this.log(MemoryRetrievalLogLevel.VERBOSE, 
      `⚖️ Scoring weights: semantic=${weights.semanticWeight}, importance=${weights.importanceWeight}, ` +
      `tag=${weights.tagMatchWeight}, recency=${weights.recencyWeight}, ` +
      `contentValue=${weights.contentValueWeight}, length=${weights.lengthWeight}, userMessage=${weights.userMessageWeight}`);
    
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
      
      // Calculate content value score (0-1.0 range)
      const contentValueScore = this.calculateContentValueScore(memory.content);
      
      // Calculate length score (0-1.0 range)
      const lengthScore = this.calculateLengthScore(memory.content);
      
      // Calculate user message score (0-1.0 range)
      const userMessageScore = this.calculateUserMessageScore(memory.content);
      
      // Calculate final score using weighted formula
      const finalScore = 
        (semanticScore * weights.semanticWeight) +
        (importanceScore * weights.importanceWeight) +
        (tagMatchScore * weights.tagMatchWeight) +
        (recencyScore * weights.recencyWeight) +
        (contentValueScore * weights.contentValueWeight) +
        (lengthScore * weights.lengthWeight) +
        (userMessageScore * weights.userMessageWeight);
      
      // Normalize by sum of weights
      const weightSum = weights.semanticWeight + weights.importanceWeight + 
                       weights.tagMatchWeight + weights.recencyWeight +
                       weights.contentValueWeight + weights.lengthWeight +
                       weights.userMessageWeight;
                       
      const normalizedScore = finalScore / weightSum;
          
      // Log detailed scoring for verbose mode
      if (this.logLevel >= MemoryRetrievalLogLevel.DEBUG) {
        this.log(MemoryRetrievalLogLevel.DEBUG, 
          `🧮 Memory ${memory.id} scoring: ` +
          `semantic=${semanticScore.toFixed(2)}, ` +
          `importance=${importanceScore.toFixed(2)}, ` +
          `tags=${tagMatchScore.toFixed(2)}, ` +
          `recency=${recencyScore.toFixed(2)}, ` +
          `contentValue=${contentValueScore.toFixed(2)}, ` +
          `length=${lengthScore.toFixed(2)}, ` +
          `userMessage=${userMessageScore.toFixed(2)}, ` +
          `final=${normalizedScore.toFixed(4)}`);
      }
      
      return { 
        memory, 
        score: normalizedScore,
        components: {
          semanticScore,
          importanceScore,
          tagMatchScore,
          recencyScore,
          contentValueScore,
          lengthScore,
          userMessageScore
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
   * Retrieve the user's working memory (last 20 messages)
   */
  async getWorkingMemory(userId: string, excludeMessageIds?: string[]): Promise<WorkingMemoryItem[]> {
    try {
      const { memoryService, searchService } = await getMemoryServices();
      
      this.log(MemoryRetrievalLogLevel.BASIC, 
        `🧠 Retrieving working memory (last 20 messages) for user: ${userId}`);
      
      // Build filter for working memory with exclusions
      const filter: Record<string, any> = {
        must: [
          { key: "metadata.userId.id", match: { value: userId } }
        ]
      };
      
      // Add exclusion filter for specific message IDs if provided
      if (excludeMessageIds && excludeMessageIds.length > 0) {
        filter.must_not = [
          { key: "id", match: { any: excludeMessageIds } }
        ];
        this.log(MemoryRetrievalLogLevel.BASIC, 
          `🚫 Excluding ${excludeMessageIds.length} message IDs from working memory: ${excludeMessageIds.join(', ')}`);
      }
      
      // Use filter method instead of search with empty query for better results
      // This method is specifically designed for filtering without semantic search
      const filterOptions = {
        types: [MemoryType.MESSAGE], // Use proper MemoryType enum
        filter,
        limit: 20,
        sortBy: "metadata.timestamp", // Use string field name for sortBy
        sortOrder: "desc" as const // Sort newest first
      };
      
      // Use filter method which handles sorting properly for non-semantic searches
      const searchResults = await searchService.filter(filterOptions);
      
      this.log(MemoryRetrievalLogLevel.BASIC, 
        `📊 Retrieved ${searchResults.length} working memory items (recent messages)`);
      
      // Convert search results to working memory items
      const workingMemories: WorkingMemoryItem[] = [];
      
      for (const result of searchResults) {
        try {
          // Type assertion to work with the search result structure
          const resultData = result as unknown as {
            point: {
              id: string;
              payload: {
                content: string;
                text?: string; // Alternative field name
                metadata?: {
                  tags?: string[];
                  type?: string;
                  importance?: ImportanceLevel;
                  importance_score?: number;
                  contentSummary?: string;
                  timestamp?: number;
                  createdAt?: number;
                };
              };
            };
          };
          
          const memoryId = String(resultData.point?.id || IdGenerator.generate("memory"));
          const memoryType = String(resultData.point?.payload?.metadata?.type || 'message');
          const timestamp = resultData.point?.payload?.metadata?.timestamp || 
                         resultData.point?.payload?.metadata?.createdAt || 
                         Date.now();
          
          // Extract memory tags
          const memoryTags = Array.isArray(resultData.point?.payload?.metadata?.tags) 
            ? resultData.point.payload.metadata.tags 
            : [];
          
          // Get memory content - try multiple field names
          const payload = resultData.point?.payload as any;
          const content = String(payload?.content || payload?.text || '');
          
          // Skip empty content
          if (!content.trim()) {
            continue;
          }
          
          // Create a working memory item
          workingMemories.push({
            id: memoryId,
            type: memoryType as 'entity' | 'fact' | 'preference' | 'task' | 'goal' | 'message',
            content: content,
            tags: memoryTags,
            addedAt: new Date(timestamp),
            priority: 0,
            expiresAt: null,
            confidence: 1.0, // High confidence since these are recent messages
            userId: userId,
            _relevanceScore: 1.0, // Assign high relevance since these are recent
            metadata: {
              timestamp: timestamp,
              isWorkingMemory: true // Mark as working memory item
            }
          });
        } catch (itemError) {
          this.log(MemoryRetrievalLogLevel.ERROR, 
            `⚠️ Error processing working memory item:`, itemError);
        }
      }
      
      // If we didn't get results with the filter method, try a fallback approach
      if (workingMemories.length === 0) {
        this.log(MemoryRetrievalLogLevel.BASIC, 
          `🔄 Filter method returned no results, trying fallback approach`);
        
        // Fallback: Use search with proper SearchOptions format
        const searchOptions = {
          types: [MemoryType.MESSAGE],
          filter: {
            must: [
              { key: "metadata.userId.id", match: { value: userId } }
            ],
            // Add exclusion filter if we have message IDs to exclude
            ...(excludeMessageIds && excludeMessageIds.length > 0 ? {
              must_not: [
                { key: "id", match: { value: null, in: excludeMessageIds } }
              ]
            } : {})
          },
          limit: 20,
          sort: {
            field: "metadata.timestamp",
            direction: "desc" as const
          }
        };
        
        // Try with a minimal query to trigger semantic search
        const fallbackResults = await searchService.search("message", searchOptions);
        
        this.log(MemoryRetrievalLogLevel.BASIC, 
          `📊 Fallback search retrieved ${fallbackResults.length} working memory items`);
        
        // Process fallback results the same way
        for (const result of fallbackResults) {
          try {
            const resultData = result as unknown as {
              point: {
                id: string;
                payload: {
                  content: string;
                  text?: string;
                  metadata?: {
                    tags?: string[];
                    type?: string;
                    importance?: ImportanceLevel;
                    importance_score?: number;
                    contentSummary?: string;
                    timestamp?: number;
                    createdAt?: number;
                  };
                };
              };
            };
            
            const memoryId = String(resultData.point?.id || IdGenerator.generate("memory"));
            const memoryType = String(resultData.point?.payload?.metadata?.type || 'message');
            const timestamp = resultData.point?.payload?.metadata?.timestamp || 
                           resultData.point?.payload?.metadata?.createdAt || 
                           Date.now();
            
            const memoryTags = Array.isArray(resultData.point?.payload?.metadata?.tags) 
              ? resultData.point.payload.metadata.tags 
              : [];
            
            const payload = resultData.point?.payload as any;
            const content = String(payload?.content || payload?.text || '');
            
            if (!content.trim()) {
              continue;
            }
            
            workingMemories.push({
              id: memoryId,
              type: memoryType as 'entity' | 'fact' | 'preference' | 'task' | 'goal' | 'message',
              content: content,
              tags: memoryTags,
              addedAt: new Date(timestamp),
              priority: 0,
              expiresAt: null,
              confidence: 1.0,
              userId: userId,
              _relevanceScore: 1.0,
              metadata: {
                timestamp: timestamp,
                isWorkingMemory: true
              }
            });
          } catch (itemError) {
            this.log(MemoryRetrievalLogLevel.ERROR, 
              `⚠️ Error processing fallback memory item:`, itemError);
          }
        }
      }
      
      return workingMemories;
    } catch (error) {
      this.log(MemoryRetrievalLogLevel.ERROR, 
        `❌ Error retrieving working memory:`, error);
      return [];
    }
  }

  /**
   * Check working memory first before retrieving from full memory store
   * Uses intent confidence to determine if working memory is sufficient
   */
  async checkWorkingMemoryFirst(
    options: MemoryRetrievalOptions & { intentConfidence?: number }
  ): Promise<{
    memories: WorkingMemoryItem[];
    sufficientConfidence: boolean;
    memoryIds: string[];
  }> {
    try {
      // Get the confidence threshold from options or use default
      const confidenceThreshold = options.intentConfidence ?? 0.75;
      
      this.log(MemoryRetrievalLogLevel.BASIC, 
        `🔍 Checking working memory first with confidence threshold: ${confidenceThreshold}`);
      
      // Retrieve working memory
      const workingMemories = await this.getWorkingMemory(options.userId, options.excludeMessageIds);
      
      if (workingMemories.length === 0) {
        this.log(MemoryRetrievalLogLevel.BASIC, 
          `ℹ️ No working memory items found, proceeding to full memory retrieval`);
        return { 
          memories: [], 
          sufficientConfidence: false, 
          memoryIds: [] 
        };
      }
      
      // Extract query tags
      const queryTags = options.tags || await this.extractTagsFromQuery(options.query);
      
      // Score working memories against the query
      const scoredMemories = this.applyEnhancedScoring(
        workingMemories,
        options.query,
        queryTags,
        options.scoringWeights || {},
        options.importanceWeighting?.enabled !== false
      );
      
      // Get top memories
      const relevantMemories = scoredMemories.slice(0, options.limit || DEFAULT_MEMORY_LIMIT);
      
      // Check if top memory has high enough relevance
      const highestRelevance = relevantMemories.length > 0 ? 
        (relevantMemories[0]._relevanceScore || 0) : 0;
      
      // Determine if working memory is sufficient based on relevance and confidence
      const isWorkingMemorySufficient = 
        highestRelevance > 0.7 && 
        (options.intentConfidence || 0) > confidenceThreshold;
      
      this.log(MemoryRetrievalLogLevel.BASIC, 
        `📊 Working memory check results: found ${relevantMemories.length} relevant items, ` +
        `highest relevance: ${highestRelevance.toFixed(3)}, ` +
        `sufficient: ${isWorkingMemorySufficient}`);
      
      return {
        memories: relevantMemories,
        sufficientConfidence: isWorkingMemorySufficient,
        memoryIds: relevantMemories.map(memory => memory.id)
      };
    } catch (error) {
      this.log(MemoryRetrievalLogLevel.ERROR, 
        `❌ Error checking working memory:`, error);
      return { memories: [], sufficientConfidence: false, memoryIds: [] };
    }
  }

  /**
   * Calculate content value score - answers vs questions
   * Questions get lower scores, informative content gets higher scores
   */
  private calculateContentValueScore(content: string): number {
    if (!content) return 0.5;
    
    const lowerContent = content.toLowerCase().trim();
    
    // Strong question indicators - heavily penalize
    if (lowerContent.includes('can you repeat:') || 
        lowerContent.includes('what is our') || 
        lowerContent.includes('what are our') ||
        lowerContent.startsWith('can you ') ||
        lowerContent.startsWith('could you ') ||
        lowerContent.startsWith('would you ')) {
      return 0.1; // Very low score for obvious questions
    }
    
    // General question patterns - moderately penalize
    if (lowerContent.endsWith('?') || 
        lowerContent.includes('how do ') ||
        lowerContent.includes('where is ') ||
        lowerContent.includes('when will ') ||
        lowerContent.includes('why did ')) {
      return 0.3; // Low score for questions
    }
    
    // Value indicators - reward informative content
    if (lowerContent.includes('budget') && (lowerContent.includes('€') || lowerContent.includes('$') || /\d+/.test(lowerContent))) {
      return 1.0; // High score for budget information with numbers/currency
    }
    
    if (lowerContent.includes('total') && /\d+/.test(lowerContent)) {
      return 0.9; // High score for content with totals and numbers
    }
    
    if (/\d+/.test(lowerContent) && lowerContent.length > 50) {
      return 0.8; // Good score for longer content with numbers
    }
    
    // Default score for neutral content
    return 0.5;
  }

  /**
   * Calculate length score - longer messages often contain more valuable information
   */
  private calculateLengthScore(content: string): number {
    if (!content) return 0;
    
    const length = content.length;
    
    // Very short messages (under 50 chars) - likely not very informative
    if (length < 50) return 0.2;
    
    // Short messages (50-150 chars) - moderate value
    if (length < 150) return 0.4;
    
    // Medium messages (150-500 chars) - good value
    if (length < 500) return 0.7;
    
    // Long messages (500-1500 chars) - high value
    if (length < 1500) return 0.9;
    
    // Very long messages (1500+ chars) - very high value but cap at 1.0
    return 1.0;
  }

  /**
   * Calculate user message score - user messages often more valuable than agent responses
   */
  private calculateUserMessageScore(content: string): number {
    if (!content) return 0.5;
    
    // Check for patterns that indicate agent responses
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('i\'ve scheduled') ||
        lowerContent.includes('task will be processed') ||
        lowerContent.includes('here\'s how i\'d') ||
        lowerContent.includes('let me ') ||
        lowerContent.includes('i\'ll ') ||
        lowerContent.includes('fantastic—') ||
        lowerContent.includes('excellent!') ||
        lowerContent.includes('ready to ')) {
      return 0.3; // Lower score for agent-like responses
    }
    
    // Check for patterns that indicate user input
    if (lowerContent.includes('i am ') ||
        lowerContent.includes('we are ') ||
        lowerContent.includes('i have ') ||
        lowerContent.includes('we have ') ||
        lowerContent.includes('our ') ||
        lowerContent.includes('my ')) {
      return 0.8; // Higher score for user-like content
    }
    
    // Default neutral score
    return 0.5;
  }
} 