import { getMemoryServices } from '@/server/memory/services';
import { WorkingMemoryItem, FileReference } from '../types';
import { ImportanceLevel } from '@/server/memory/config';
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
    'task': 1.0    // Tasks are standard weight
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
          // The actual structure may vary depending on your implementation
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
          
          // Create a working memory item
          memories.push({
            id: memoryId,
            type: memoryType as 'entity' | 'fact' | 'preference' | 'task' | 'goal',
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
            _relevanceScore: resultData.score || 0.5
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
    },
    queryTags?: string[]
  ): WorkingMemoryItem[] {
    // Default weights if not provided
    const priorityWeight = weightingOptions.priorityWeight ?? 1.0;
    const confidenceWeight = weightingOptions.confidenceWeight ?? 1.0;
    const useTypeWeights = weightingOptions.useTypeWeights ?? true;
    
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
      }
      
      // Apply tag-based boost if query tags are provided
      if (queryTags && queryTags.length > 0 && memory.tags && memory.tags.length > 0) {
        // Count matching tags
        const matchingTags = memory.tags.filter(tag => queryTags.includes(tag));
        if (matchingTags.length > 0) {
          // Boost based on number of matching tags
          const tagBoostFactor = 1.0 + (matchingTags.length / queryTags.length) * 0.5;
          score *= tagBoostFactor;
          
          // Log if there's a significant boost
          if (tagBoostFactor > 1.2) {
            console.log(`Boosted memory ${memory.id} by factor ${tagBoostFactor.toFixed(2)} due to ${matchingTags.length} matching tags`);
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
   * Get working memory for a user
   */
  async getWorkingMemory(userId: string): Promise<WorkingMemoryItem[]> {
    try {
      // This would be replaced with actual working memory retrieval
      // For now, return an empty array
      return [];
    } catch (error) {
      console.error('Error getting working memory:', error);
      return [];
    }
  }
} 