import { getMemoryServices } from '@/server/memory/services';
import { WorkingMemoryItem, FileReference } from '../types';
import { ImportanceLevel } from '@/constants/memory';
import { IdGenerator } from '@/utils/ulid';
import { SearchResult } from '@/server/memory/services/search/types';
import { BaseMemorySchema } from '@/server/memory/models';

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
    'message': 1.4 // Increase message importance to capture conversation history
  };
  
  /**
   * Message type weights for better conversational context
   */
  private messageTypeWeights: Record<string, number> = {
    'answer': 1.5,    // Answers to user questions are more important
    'question': 1.2,  // Questions provide context
    'statement': 1.0, // General statements
    'information': 1.4, // Information provided by users is important
    'budget': 1.8,    // Budget information is highly important
    'requirement': 1.7, // Requirements are important
    'constraint': 1.6  // Constraints are important
  };
  
  /**
   * Importance level weights for stronger prioritization
   */
  private importanceLevelWeights: Record<ImportanceLevel, number> = {
    [ImportanceLevel.CRITICAL]: 2.0,
    [ImportanceLevel.HIGH]: 1.5, 
    [ImportanceLevel.MEDIUM]: 1.2,
    [ImportanceLevel.LOW]: 1.0
  };
  
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
      const { searchService } = await getMemoryServices();
      
      // Create filter for memory search
      const filter: Record<string, any> = {
        must: [
          { key: "metadata.userId.id", match: { value: options.userId } }
        ]
      };
      
      // Add tag filters if provided
      if (options.tags && options.tags.length > 0) {
        console.log(`Applying tag filtering with tags: ${options.tags.join(', ')}`);
        filter.must.push({
          key: "metadata.tags",
          match: {
            value: options.tags,
            operator: "in"
          }
        });
      }
      
      // Define search options with proper typing
      const searchOptions = {
        filter,
        limit: options.limit || 10,
        includeMetadata: options.includeMetadata !== false,
        // Add similarity search if requested
        similaritySearch: options.semanticSearch ? { enabled: true } : undefined,
        // Add boost for tag matches if tags are provided
        boostParams: options.tags && options.tags.length > 0 ? {
          fields: [{ key: "metadata.tags", value: options.tags, factor: 1.5 }]
        } : undefined
      };
      
      // Perform search
      const searchResults = await searchService.search(options.query, searchOptions);
      
      console.log(`Retrieved ${searchResults.length} memories for thinking context`);
      
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
          const importanceScore = resultData.point?.payload?.metadata?.importance_score;
          const contentSummary = resultData.point?.payload?.metadata?.contentSummary;
          
          // Create a working memory item
          memories.push({
            id: memoryId,
            type: memoryType as 'entity' | 'fact' | 'preference' | 'task' | 'goal' | 'message',
            content: String(resultData.point?.payload?.content || ''),
            tags: Array.isArray(resultData.point?.payload?.metadata?.tags) 
              ? resultData.point.payload.metadata.tags 
              : [],
            addedAt: new Date(),
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
              message_type: memoryType === 'message' ? 
                (resultData.point?.payload?.metadata?.tags?.find(tag => 
                  ['answer', 'question', 'statement', 'information', 'budget', 'requirement', 'constraint'].includes(tag)
                ) || 'statement') : undefined
            }
          });
          
          memoryIds.push(memoryId);
        } catch (itemError) {
          console.error('Error processing memory item:', itemError);
        }
      }
      
      // Apply importance weighting if enabled
      if (options.importanceWeighting?.enabled) {
        memories = this.applyImportanceWeighting(memories, options.importanceWeighting, options.tags);
      }
      
      return { memories, memoryIds };
    } catch (error) {
      console.error('Error retrieving memories:', error);
      return { memories: [], memoryIds: [] };
    }
  }
  
  /**
   * Apply importance weighting to retrieved memories
   */
  private applyImportanceWeighting(
    memories: WorkingMemoryItem[], 
    weightingOptions: {
      priorityWeight?: number;
      confidenceWeight?: number;
      useTypeWeights?: boolean;
      importanceScoreWeight?: number;
    },
    queryTags?: string[]
  ): WorkingMemoryItem[] {
    // Default weights if not provided
    const priorityWeight = weightingOptions.priorityWeight ?? 1.0;
    const confidenceWeight = weightingOptions.confidenceWeight ?? 1.0;
    const useTypeWeights = weightingOptions.useTypeWeights ?? true;
    const importanceScoreWeight = weightingOptions.importanceScoreWeight ?? 1.5;
    
    // Enhanced keyword detection for query
    const queryWords = queryTags ? [...queryTags] : [];
    if (queryTags?.length === 0) {
      const queryText = queryTags?.join(' ') || '';
      ['budget', 'cost', 'money', 'price', 'financial', 'payment'].forEach(word => {
        if (queryText.toLowerCase().includes(word)) {
          queryWords.push('budget');
        }
      });
      
      // Add task-specific words to enhance task retrieval
      ['task', 'todo', 'due', 'deadline', 'complete', 'finish'].forEach(word => {
        if (queryText.toLowerCase().includes(word)) {
          queryWords.push('task');
        }
      });
    }
    
    // Calculate weighted scores for each memory
    const scoredMemories = memories.map(memory => {
      // Start with base relevance score (from semantic search)
      let score = memory._relevanceScore || 0.5;
      
      // Apply priority weighting
      score += (memory.priority / 10) * priorityWeight; // Normalize priority to 0-1 scale
      
      // Apply confidence weighting
      score *= (memory.confidence * confidenceWeight);
      
      // Apply type-based weighting if enabled
      if (useTypeWeights && this.typeWeights[memory.type]) {
        score *= this.typeWeights[memory.type];
        
        // Special boost for tasks if query is task-related
        if (memory.type === 'task' && queryWords.includes('task')) {
          score *= 1.5; // Extra boost for tasks when searching for tasks
        }
      }
      
      // Apply message type weighting for conversation context
      const messageType = memory.metadata?.message_type || memory.tags.find(tag => 
        Object.keys(this.messageTypeWeights).includes(tag.toLowerCase())
      );
      
      if (messageType && this.messageTypeWeights[messageType]) {
        score *= this.messageTypeWeights[messageType];
        
        // Extra boost for answers to questions as they're critical context
        if (messageType === 'answer') {
          score *= 1.3;
        }
        
        // Special handling for budget information if query is related to budget
        if (messageType === 'budget' && queryWords.includes('budget')) {
          score *= 2.0; // Significant boost for budget info when querying about budget
        }
      }
      
      // Apply importance weighting - prefer explicit score first, then level
      if (memory.metadata?.importance_score !== undefined) {
        // Exponential boost for high importance items (more dramatic effect)
        score *= Math.pow(1 + memory.metadata.importance_score, 2) * importanceScoreWeight;
      } 
      else if (memory.metadata?.importance) {
        // Type assertion to ensure it's a valid ImportanceLevel
        const importanceLevel = memory.metadata.importance as ImportanceLevel;
        const importanceFactor = this.importanceLevelWeights[importanceLevel] || 1.0;
        score *= importanceFactor;
      }
      
      // Apply tag-based boost if query tags are provided
      if (queryWords.length > 0 && memory.tags && memory.tags.length > 0) {
        // Count matching tags
        const matchingTags = memory.tags.filter(tag => queryWords.includes(tag));
        if (matchingTags.length > 0) {
          // Boost based on number of matching tags
          const tagBoostFactor = 1.0 + (matchingTags.length / queryWords.length) * 0.5;
          score *= tagBoostFactor;
          
          // Log if there's a significant boost
          if (tagBoostFactor > 1.2) {
            console.log(`Boosted memory ${memory.id} by factor ${tagBoostFactor.toFixed(2)} due to ${matchingTags.length} matching tags`);
          }
        }
      }
      
      // Content relevance boost based on content summary if available
      if (memory.metadata?.contentSummary && memory.metadata.contentSummary.length > 0) {
        // Check if content summary contains important topics related to query
        const summaryText = memory.metadata.contentSummary.toLowerCase();
        if (queryWords.some(word => summaryText.includes(word.toLowerCase()))) {
          score *= 1.5; // Significant boost for content that directly addresses the query
          
          // Extra boost for tasks with deadlines when querying for tasks
          if (memory.type === 'task' && 
              queryWords.includes('task') && 
              (summaryText.includes('deadline') || summaryText.includes('due'))) {
            score *= 1.3; // Additional boost for deadline-related tasks
          }
        }
      }
      
      return { memory, score };
    });
    
    // Sort by final score (descending)
    return scoredMemories
      .sort((a, b) => b.score - a.score)
      .map(item => item.memory);
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
      console.error('Error retrieving working memory:', error);
      return [];
    }
  }
} 