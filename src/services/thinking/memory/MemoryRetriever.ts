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
  
  // Formatting options
  maxTokens?: number;
  includeMetadata?: boolean;
}

/**
 * Service for retrieving relevant memories during the thinking process
 */
export class MemoryRetriever {
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
        similaritySearch: options.semanticSearch ? { enabled: true } : undefined
      };
      
      // Perform search
      const searchResults = await searchService.search(options.query, searchOptions);
      
      console.log(`Retrieved ${searchResults.length} memories for thinking context`);
      
      // Convert search results to working memory items
      const memories: WorkingMemoryItem[] = [];
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
                };
              };
            };
            score: number;
          };
          
          const memoryId = String(resultData.point?.id || IdGenerator.generate("memory"));
          
          // Create a working memory item
          memories.push({
            id: memoryId,
            type: 'fact', // Default type for retrieved memories
            content: String(resultData.point?.payload?.content || ''),
            tags: Array.isArray(resultData.point?.payload?.metadata?.tags) 
              ? resultData.point.payload.metadata.tags 
              : [],
            addedAt: new Date(),
            priority: 1,
            expiresAt: null,
            confidence: resultData.score || 0.9,
            userId: options.userId
          });
          
          memoryIds.push(memoryId);
        } catch (itemError) {
          console.error('Error processing memory item:', itemError);
        }
      }
      
      return { memories, memoryIds };
    } catch (error) {
      console.error('Error retrieving memories:', error);
      return { memories: [], memoryIds: [] };
    }
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