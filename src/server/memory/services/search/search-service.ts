/**
 * Search service implementation
 */
import { COLLECTION_NAMES, DEFAULTS, MemoryType } from '../../config';
import { BaseMemorySchema, MemoryPoint } from '../../models';
import { handleMemoryError } from '../../utils';
import { IMemoryClient } from '../client/types';
import { EmbeddingService } from '../client/embedding-service';
import { MemoryService } from '../memory/memory-service';
import { FilterBuilderOptions, HybridSearchOptions, SearchOptions, SearchResult } from './types';

/**
 * Search service options
 */
export interface SearchServiceOptions {
  // Default timestamp function
  getTimestamp?: () => number;
}

/**
 * Service for searching across memory collections
 */
export class SearchService {
  private client: IMemoryClient;
  private embeddingService: EmbeddingService;
  private memoryService: MemoryService;
  
  /**
   * Create a new search service
   */
  constructor(
    client: IMemoryClient, 
    embeddingService: EmbeddingService,
    memoryService: MemoryService,
    options?: SearchServiceOptions
  ) {
    this.client = client;
    this.embeddingService = embeddingService;
    this.memoryService = memoryService;
  }
  
  /**
   * Search across all or specified memory types
   */
  async search<T extends BaseMemorySchema>(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult<T>[]> {
    try {
      // Generate embedding for the query
      const embeddingResult = await this.embeddingService.getEmbedding(query);
      const vector = embeddingResult.embedding;
      
      // Determine which types to search
      const types = options.types || Object.values(MemoryType);
      
      // Search each type and collect results
      const searchPromises = types.map(type => this.searchSingleType<T>(
        type,
        vector,
        query,
        options
      ));
      
      // Wait for all searches to complete
      const resultsArrays = await Promise.all(searchPromises);
      
      // Combine and sort results
      const combinedResults = resultsArrays.flat();
      const sortedResults = combinedResults.sort((a, b) => b.score - a.score);
      
      // Apply limit if specified
      const limit = options.limit || DEFAULTS.DEFAULT_LIMIT;
      return sortedResults.slice(0, limit);
    } catch (error) {
      console.error('Error searching memories:', error);
      throw handleMemoryError(error, 'search');
    }
  }
  
  /**
   * Search within a single memory type
   */
  private async searchSingleType<T extends BaseMemorySchema>(
    type: MemoryType,
    vector: number[],
    originalQuery: string,
    options: SearchOptions
  ): Promise<SearchResult<T>[]> {
    try {
      const collectionName = COLLECTION_NAMES[type];
      
      // Search the collection
      const results = await this.client.searchPoints<T>(collectionName, {
        vector,
        filter: options.filter,
        limit: options.limit || DEFAULTS.DEFAULT_LIMIT,
        offset: options.offset,
        includeVectors: options.includeVectors,
        scoreThreshold: options.minScore
      });
      
      // Transform to standardized search results
      return results.map(result => {
        // Create memory point from search result
        const point: MemoryPoint<T> = {
          id: result.id,
          vector: options.includeVectors ? [] : [], // Vector data is typically not included
          payload: result.payload
        };
        
        return {
          point,
          score: result.score,
          type,
          collection: collectionName
        };
      });
    } catch (error) {
      console.error(`Error searching in ${type}:`, error);
      return []; // Return empty array for this type instead of failing the entire search
    }
  }
  
  /**
   * Perform hybrid search (combining vector search and text search)
   */
  async hybridSearch<T extends BaseMemorySchema>(
    query: string,
    options: HybridSearchOptions = {}
  ): Promise<SearchResult<T>[]> {
    try {
      // Set default weights
      const textWeight = options.textWeight ?? 0.3;
      const vectorWeight = options.vectorWeight ?? 0.7;
      
      // Get vector search results
      const vectorResults = await this.search<T>(query, {
        ...options,
        limit: options.limit ? options.limit * 2 : DEFAULTS.DEFAULT_LIMIT * 2 // Get more results to rerank
      });
      
      // Get text search results (simple contains for now)
      const textSearchPromises = (options.types || Object.values(MemoryType)).map(type => {
        const collectionName = COLLECTION_NAMES[type];
        return this.client.scrollPoints<T>(
          collectionName,
          {
            ...options.filter,
            $text: { $contains: query }
          },
          options.limit ? options.limit * 2 : DEFAULTS.DEFAULT_LIMIT * 2
        );
      });
      
      const textResultsArrays = await Promise.all(textSearchPromises);
      const textPoints = textResultsArrays.flat();
      
      // Create map of vector results for quick lookup
      const vectorResultsMap = new Map<string, SearchResult<T>>();
      vectorResults.forEach(result => {
        vectorResultsMap.set(result.point.id, result);
      });
      
      // Create combined results with hybrid scoring
      const hybridResults: SearchResult<T>[] = [];
      
      // Process vector results first
      vectorResults.forEach(result => {
        hybridResults.push({
          ...result,
          score: result.score * vectorWeight // Apply vector weight
        });
      });
      
      // Process text results
      textPoints.forEach(point => {
        const id = point.id;
        
        // If already in vector results, blend scores
        if (vectorResultsMap.has(id)) {
          const existingResult = vectorResultsMap.get(id)!;
          const idx = hybridResults.findIndex(r => r.point.id === id);
          
          // Blend scores: existing vector score + text match score
          hybridResults[idx].score = (existingResult.score * vectorWeight) + textWeight;
        } else {
          // Add as new result with text match score only
          const type = point.payload.type as MemoryType;
          hybridResults.push({
            point,
            score: textWeight,
            type,
            collection: COLLECTION_NAMES[type]
          });
        }
      });
      
      // Normalize scores if requested
      if (options.normalizeScores) {
        const maxScore = Math.max(...hybridResults.map(r => r.score));
        hybridResults.forEach(result => {
          result.score = result.score / maxScore;
        });
      }
      
      // Sort by score and apply limit
      hybridResults.sort((a, b) => b.score - a.score);
      const limit = options.limit || DEFAULTS.DEFAULT_LIMIT;
      
      return hybridResults.slice(0, limit);
    } catch (error) {
      console.error('Error performing hybrid search:', error);
      throw handleMemoryError(error, 'hybridSearch');
    }
  }
  
  /**
   * Build a structured filter from options
   */
  buildFilter(options: FilterBuilderOptions): Record<string, any> {
    const filter: Record<string, any> = {};
    
    // Date range filter
    if (options.startDate || options.endDate) {
      const timeRange: Record<string, any> = {};
      
      if (options.startDate) {
        const startTime = options.startDate instanceof Date 
          ? options.startDate.getTime() 
          : options.startDate;
        
        timeRange.$gte = startTime;
      }
      
      if (options.endDate) {
        const endTime = options.endDate instanceof Date
          ? options.endDate.getTime()
          : options.endDate;
        
        timeRange.$lte = endTime;
      }
      
      filter.timestamp = timeRange;
    }
    
    // Types filter
    if (options.types && options.types.length > 0) {
      filter.type = options.types.length === 1 
        ? options.types[0] 
        : { $in: options.types };
    }
    
    // Metadata filters
    if (options.metadata && Object.keys(options.metadata).length > 0) {
      Object.entries(options.metadata).forEach(([key, value]) => {
        filter[`metadata.${key}`] = value;
      });
    }
    
    // Text contains filter
    if (options.textContains) {
      if (options.exactMatch) {
        filter.$text = options.caseSensitive
          ? { $eq: options.textContains }
          : { $eq_ignore_case: options.textContains };
      } else {
        filter.$text = options.caseSensitive
          ? { $contains: options.textContains }
          : { $contains_ignore_case: options.textContains };
      }
    }
    
    return filter;
  }
} 