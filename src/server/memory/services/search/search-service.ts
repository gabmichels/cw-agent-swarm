/**
 * Search service implementation
 */
import { COLLECTION_NAMES, DEFAULTS, MemoryFilter, MemoryType } from '../../config';
import { BaseMemorySchema, MemoryPoint } from '../../models';
import { handleMemoryError } from '../../utils';
import { IMemoryClient } from '../client/types';
import { EmbeddingService } from '../client/embedding-service';
import { MemoryService } from '../memory/memory-service';
import { FilterBuilderOptions, HybridSearchOptions, SearchOptions, SearchResult, FilterOptions } from './types';
import { IQueryOptimizer, QueryOptimizationStrategy } from '../query/types';
import { FilterOperator } from '../filters/types';

/**
 * Causal relationship type in memory metadata
 */
interface CausalRelationship {
  description: string;
  confidence: number;
  relationshipType: string;
}

/**
 * Causal chain memory item
 */
interface CausalChainItem {
  memory: {
    id: string;
    text: string;
  };
  relationship: CausalRelationship;
  depth: number;
}

/**
 * Causal chain result structure
 */
interface CausalChainResult {
  origin: {
    id: string;
    text: string;
  };
  causes: CausalChainItem[];
  effects: CausalChainItem[];
}

/**
 * Search service options
 */
export interface SearchServiceOptions {
  // Default timestamp function
  getTimestamp?: () => number;
  
  // Query optimizer
  queryOptimizer?: IQueryOptimizer;
}

/**
 * Service for searching across memory collections
 */
export class SearchService {
  private client: IMemoryClient;
  private embeddingService: EmbeddingService;
  private memoryService: MemoryService;
  private queryOptimizer: IQueryOptimizer | null = null;
  
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
    
    if (options?.queryOptimizer) {
      this.queryOptimizer = options.queryOptimizer;
    }
  }
  
  /**
   * Set the query optimizer for optimized searches
   * 
   * @param optimizer Query optimizer instance
   */
  setQueryOptimizer(optimizer: IQueryOptimizer): void {
    this.queryOptimizer = optimizer;
  }
  
  /**
   * Search across all or specified memory types
   */
  async search<T extends BaseMemorySchema>(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult<T>[]> {
    try {
      const { types = [], limit = 10, filter } = options;
      
      // Check if this is a causal chain search request
      if (options.maxDepth !== undefined || options.direction || options.analyze) {
        // Handle causal chain search as a special case
        // For now, return regular search results since actual causal chain 
        // functionality will be implemented in a future update
        console.log('Causal chain search requested - using standard search as fallback');
      }
      
      // If no specific types requested, search all collections
      const collectionsToSearch = types.length > 0
        ? types.map(type => COLLECTION_NAMES[type])
        : Object.values(COLLECTION_NAMES);
        
      // Filter out undefined collection names
      const validCollections = collectionsToSearch.filter(name => !!name) as string[];
      
      if (validCollections.length === 0) {
        console.warn('No valid collections to search');
        return [];
      }
      
      // If query optimizer is available and this is a single collection search,
      // use the optimizer for better performance
      if (this.queryOptimizer && types.length === 1) {
        try {
          const collectionName = COLLECTION_NAMES[types[0]];
          if (collectionName) {
            console.log(`Using query optimizer for ${collectionName}`);
            
            // Determine best optimization strategy
            const strategy = options.highQuality 
              ? QueryOptimizationStrategy.HIGH_QUALITY 
              : options.highSpeed 
                ? QueryOptimizationStrategy.HIGH_SPEED 
                : undefined; // Use default strategy
            
            // Execute optimized query
            const queryResponse = await this.queryOptimizer.query<T>(
              {
                query,
                collection: collectionName,
                limit,
                minScore: options.minScore
              },
              strategy
            );
            
            // Map query results to search results
            return queryResponse.results.map(item => {
              const type = this.getTypeFromCollectionName(collectionName);
              return {
                point: {
                  id: item.id as any,
                  vector: [],
                  payload: item.metadata as T
                },
                score: item.score,
                type: type as MemoryType,
                collection: collectionName
              };
            });
          }
        } catch (error) {
          console.warn('Query optimizer failed, falling back to standard search:', error);
          // Fall back to standard search
        }
      }
      
      // Standard search when optimizer is not available or failed
      
      // Get an embedding for the query
      const embeddingResult = await this.embeddingService.getEmbedding(query);
      const vector = embeddingResult.embedding; // Extract the actual vector array
      
      const results: SearchResult<T>[] = [];
      const missingCollections: string[] = [];
      
      // Search each collection
      for (const collectionName of validCollections) {
        if (!collectionName) continue;
        
        try {
          // Check if collection exists before searching
          const collectionExists = await this.client.collectionExists(collectionName);
          
          if (!collectionExists) {
            missingCollections.push(collectionName);
            console.warn(`Collection ${collectionName} does not exist, skipping search`);
            continue;
          }
          
          const collectionResults = await this.client.searchPoints<T>(collectionName, {
            vector,
            limit,
            filter: filter ? this.buildQdrantFilter(filter) : undefined
          });
          
          // Add type and collection info to results
          const type = this.getTypeFromCollectionName(collectionName);
          
          if (collectionResults.length > 0 && type) {
            const mappedResults = collectionResults.map(result => ({
              point: {
                id: result.id,
                vector: [],
                payload: result.payload
              } as MemoryPoint<T>,
              score: result.score,
              type: type as MemoryType,
              collection: collectionName
            }));
            
            results.push(...mappedResults);
          }
        } catch (error) {
          // Log error but continue with other collections
          const errorMessage = error instanceof Error ? error.message : String(error);
          const isNotFoundError = errorMessage.includes('not found') || 
                                 errorMessage.includes('404') || 
                                 errorMessage.includes('does not exist');
          
          if (isNotFoundError) {
            missingCollections.push(collectionName);
            console.warn(`Collection ${collectionName} not found or inaccessible, skipping search`);
          } else {
            console.error(`Error searching collection ${collectionName}:`, error);
          }
          continue;
        }
      }
      
      // If there were missing collections, log a warning but don't fail the search
      if (missingCollections.length > 0) {
        console.warn(`Skipped ${missingCollections.length} missing collections during search: ${missingCollections.join(', ')}`);
      }
      
      // Sort by score descending
      return results.sort((a, b) => b.score - a.score);
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }
  
  /**
   * Map from collection name back to memory type
   */
  private getTypeFromCollectionName(collectionName: string): MemoryType | null {
    for (const [type, name] of Object.entries(COLLECTION_NAMES)) {
      if (name === collectionName) {
        return type as MemoryType;
      }
    }
    return null;
  }
  
  /**
   * Build a Qdrant-compatible filter from our memory filter
   */
  private buildQdrantFilter(filter: MemoryFilter): Record<string, any> {
    // If filter is already in Qdrant format, return as is
    if (typeof filter === 'object' && (filter.must || filter.should || filter.must_not)) {
      return filter as Record<string, any>;
    }
    
    // Simple direct mapping for basic filters
    if (typeof filter === 'object') {
      const qdrantFilter: Record<string, any> = {};
      
      // Convert filter fields to Qdrant format
      Object.entries(filter).forEach(([key, value]) => {
        // Handle object values that might be complex conditions
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Handle range conditions
          if ('$gt' in value || '$gte' in value || '$lt' in value || '$lte' in value) {
            qdrantFilter[key] = { range: value };
          } 
          // Handle match conditions
          else if ('$in' in value || '$nin' in value || '$eq' in value || '$ne' in value) {
            qdrantFilter[key] = { match: value };
          }
          // Handle text conditions
          else if ('$contains' in value || '$startsWith' in value || '$endsWith' in value) {
            qdrantFilter[key] = { match: { text: value } };
          } 
          // Default to passing through the object
          else {
            qdrantFilter[key] = value;
          }
        } 
        // Simple value becomes a match condition
        else {
          qdrantFilter[key] = { match: { value } };
        }
      });
      
      // Wrap in must clause if there are conditions
      if (Object.keys(qdrantFilter).length > 0) {
        return { must: Object.entries(qdrantFilter).map(([key, value]) => ({ [key]: value })) };
      }
    }
    
    // Return original filter if we couldn't transform it
    return filter as Record<string, any>;
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
      
      if (!collectionName) {
        return []; // Skip invalid collections
      }
      
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
      
      // Get an embedding for the query
      const embeddingResult = await this.embeddingService.getEmbedding(query);
      const vector = embeddingResult.embedding;
      
      // Get vector search results
      const vectorResults = await this.search<T>(query, {
        ...options,
        limit: options.limit ? options.limit * 2 : DEFAULTS.DEFAULT_LIMIT * 2 // Get more results to rerank
      });
      
      // Get text search results (simple contains for now)
      const textSearchPromises = (options.types || Object.values(MemoryType)).map(type => {
        const collectionName = COLLECTION_NAMES[type];
        if (!collectionName) return Promise.resolve([]);
        
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
          if (type) {
            const collectionName = COLLECTION_NAMES[type];
            if (collectionName) {
              const newResult: SearchResult<T> = {
                point,
                score: textWeight,
                type,
                collection: collectionName
              };
              hybridResults.push(newResult);
            }
          }
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
  
  /**
   * Search for causal chain (causes and effects) related to a memory
   * 
   * This is a placeholder implementation that will be replaced with actual
   * causal chain functionality in a future update. For now, it simulates
   * the causal chain API to enable existing code to work.
   * 
   * @param memoryId ID of the memory to trace causal relations from
   * @param options Search options including direction and depth
   * @returns Structure with causes and effects (simulated for now)
   */
  async searchCausalChain<T extends BaseMemorySchema>(
    memoryId: string,
    options: {
      maxDepth?: number;
      direction?: 'forward' | 'backward' | 'both';
      analyze?: boolean;
    } = {}
  ): Promise<CausalChainResult> {
    // For now, we'll use a regular search to find related memories and simulate the causal chain
    try {
      // Get the origin memory
      const originMemory = await this.memoryService.getMemory({
        id: memoryId,
        type: MemoryType.MESSAGE // Default to message type, but will work with any type
      });
      
      if (!originMemory) {
        throw new Error(`Memory with ID ${memoryId} not found`);
      }
      
      // Safely extract the content from the memory result using any casting
      // This is necessary because TypeScript doesn't know about the content property
      const originContent = (originMemory as any).content || 'No content available';
      
      // Get related memories using the content as search query
      const relatedMemories = await this.search<T>(originContent, {
        limit: 10,
        types: [MemoryType.THOUGHT, MemoryType.MESSAGE]
      });
      
      // Create simulated causal chain result
      const result: CausalChainResult = {
        origin: {
          id: originMemory.id,
          text: originContent
        },
        causes: [],
        effects: []
      };
      
      // Simulated causal relationships
      // In future, these would be retrieved from actual causal relations in database
      // For now, we just split related memories in half for "causes" and "effects"
      const midPoint = Math.floor(relatedMemories.length / 2);
      
      // Create simulated causes
      for (let i = 0; i < midPoint && i < relatedMemories.length; i++) {
        const memory = relatedMemories[i];
        // Access content from payload since point.content doesn't exist directly
        const content = memory.point.payload?.text || 
                        (memory.point.payload as any)?.content || 
                        'No content available';
                       
        result.causes.push({
          memory: {
            id: memory.point.id,
            text: content
          },
          relationship: {
            description: `Potential cause related to ${originContent.substring(0, 20)}...`,
            confidence: 0.5 + (Math.random() * 0.3), // Random confidence between 0.5-0.8
            relationshipType: 'CORRELATED'
          },
          depth: 1
        });
      }
      
      // Create simulated effects
      for (let i = midPoint; i < relatedMemories.length; i++) {
        const memory = relatedMemories[i];
        // Access content from payload since point.content doesn't exist directly
        const content = memory.point.payload?.text || 
                        (memory.point.payload as any)?.content || 
                        'No content available';
                       
        result.effects.push({
          memory: {
            id: memory.point.id,
            text: content
          },
          relationship: {
            description: `Potential effect following ${originContent.substring(0, 20)}...`,
            confidence: 0.5 + (Math.random() * 0.3), // Random confidence between 0.5-0.8
            relationshipType: 'CORRELATED'
          },
          depth: 1
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error in causal chain search:', error);
      // Return empty result on error
      return {
        origin: {
          id: memoryId,
          text: 'Memory not found or error retrieving content'
        },
        causes: [],
        effects: []
      };
    }
  }

  /**
   * Filter memories without semantic search
   * Retrieves memories based on exact filtering criteria without embedding comparison
   */
  async filter<T extends BaseMemorySchema>(
    options: FilterOptions = {}
  ): Promise<SearchResult<T>[]> {
    try {
      const { 
        types = [], 
        limit = 50, 
        offset = 0,
        filter = {},
        sortBy = 'timestamp',
        sortOrder = 'desc'
      } = options;
      
      // If no specific types requested, search all collections
      const collectionsToSearch = types.length > 0
        ? types.map((type: MemoryType) => COLLECTION_NAMES[type])
        : Object.values(COLLECTION_NAMES);
        
      // Filter out undefined collection names
      const validCollections = collectionsToSearch.filter(Boolean) as string[];
      
      if (validCollections.length === 0) {
        console.warn('No valid collections to filter');
        return [];
      }
      
      const results: SearchResult<T>[] = [];
      const missingCollections: string[] = [];
      
      // Process each collection
      for (const collectionName of validCollections) {
        if (!collectionName) continue;
        
        try {
          // Check if collection exists before filtering
          const collectionExists = await this.client.collectionExists(collectionName);
          
          if (!collectionExists) {
            missingCollections.push(collectionName);
            console.warn(`Collection ${collectionName} does not exist, skipping filter`);
            continue;
          }
          
          // Convert the filter to Qdrant format
          const qdrantFilter = filter ? this.buildQdrantFilter(filter) : undefined;
          
          // Build scroll params including sort options
          const scrollParams: {
            filter?: Record<string, any>;
            limit: number;
            offset: number;
            with_payload: boolean;
            with_vector: boolean;
            order_by?: {
              key: string;
              direction: 'asc' | 'desc';
            };
          } = {
            filter: qdrantFilter,
            limit,
            offset,
            with_payload: true,
            with_vector: false
          };
          
          // Add sorting if specified
          if (sortBy) {
            scrollParams.order_by = {
              key: sortBy,
              direction: sortOrder
            };
          }
          
          // Use scroll API to get paginated results with sorting
          const scrolledPoints = await this.client.scrollPoints<T>(
            collectionName,
            scrollParams
          );
          
          if (scrolledPoints && scrolledPoints.length > 0) {
            const type = this.getTypeFromCollectionName(collectionName);
            
            if (type) {
              // Convert to search result format
              const collectionResults = scrolledPoints.map((point: MemoryPoint<T>) => ({
                point,
                score: 1.0, // No relevance score for pure filtering
                type: type as MemoryType,
                collection: collectionName
              }));
              
              results.push(...collectionResults);
            }
          }
        } catch (error) {
          console.error(`Error filtering collection ${collectionName}:`, error);
          // Continue with other collections despite errors
        }
      }
      
      // If we have missing collections and no results, throw error
      if (missingCollections.length > 0 && results.length === 0) {
        const errorMessage = `Collections not found: ${missingCollections.join(', ')}`;
        throw handleMemoryError(errorMessage, 'NOT_FOUND');
      }
      
      // Sort combined results if we searched multiple collections
      if (validCollections.length > 1 && sortBy) {
        results.sort((a, b) => {
          const aValue = a.point.payload[sortBy as keyof T];
          const bValue = b.point.payload[sortBy as keyof T];
          
          // Handle string comparisons
          if (typeof aValue === 'string' && typeof bValue === 'string') {
            return sortOrder === 'asc' 
              ? aValue.localeCompare(bValue) 
              : bValue.localeCompare(aValue);
          }
          
          // Handle numeric comparisons
          if (typeof aValue === 'number' && typeof bValue === 'number') {
            return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
          }
          
          // Handle date comparisons (stored as strings)
          if (sortBy === 'timestamp') {
            const aTime = parseInt(String(aValue), 10);
            const bTime = parseInt(String(bValue), 10);
            if (!isNaN(aTime) && !isNaN(bTime)) {
              return sortOrder === 'asc' ? aTime - bTime : bTime - aTime;
            }
          }
          
          return 0;
        });
      }
      
      // Apply the pagination at the combined results level if we had multiple collections
      if (validCollections.length > 1) {
        return results.slice(0, limit);
      }
      
      return results;
    } catch (error) {
      throw handleMemoryError(error, 'SEARCH_ERROR');
    }
  }
} 