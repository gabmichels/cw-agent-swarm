/**
 * Search service implementation
 */
import { COLLECTION_NAMES, DEFAULTS, MemoryFilter, MemoryType } from '../../config';
import { BaseMemorySchema, MemoryPoint } from '../../models';
import { handleMemoryError } from '../../utils';
import { IMemoryClient } from '../client/types';
import { EmbeddingService } from '../client/embedding-service';
import { EnhancedMemoryService } from '../multi-agent/enhanced-memory-service';
import { FilterBuilderOptions, HybridSearchOptions, SearchOptions, SearchResult, FilterOptions, MemoryContext, MemoryContextOptions, MemoryContextGroup, TypedMemoryContextGroup } from './types';
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
  private memoryService: EnhancedMemoryService;
  private queryOptimizer: IQueryOptimizer | null = null;
  
  /**
   * Helper method to safely get collection name from memory type
   */
  private getCollectionNameForType(type: MemoryType): string {
    // Handle both string and enum values by trying multiple lookup approaches
    let result = '';
    
    // First try direct lookup (for enum values)
    result = (COLLECTION_NAMES as Record<string, string>)[type] || '';
    
    // If not found and type is a string, try uppercase version (for string values)
    if (!result && typeof type === 'string') {
      const upperCaseType = type.toUpperCase();
      result = (COLLECTION_NAMES as Record<string, string>)[upperCaseType] || '';
    }
    
    // If still not found, try matching by enum values
    if (!result) {
      for (const [enumKey, collectionName] of Object.entries(COLLECTION_NAMES)) {
        if (enumKey.toLowerCase() === String(type).toLowerCase()) {
          result = collectionName;
          break;
        }
      }
    }
    
    return result;
  }
  
  /**
   * Create a new search service
   */
  constructor(
    client: IMemoryClient, 
    embeddingService: EmbeddingService,
    memoryService: EnhancedMemoryService,
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
    query: string | object,
    options: SearchOptions = {}
  ): Promise<SearchResult<T>[]> {
    try {
      const { types = [], limit = 10, filter } = options;
      
      // Handle case where query is an object or null/undefined (incorrect usage)
      if (query === null || query === undefined || typeof query !== 'string') {
        console.warn('Invalid query provided to search:', { 
          queryType: typeof query,
          queryValue: query,
          filter: options.filter
        });
        
        // Use filter-based approach when no valid query string is provided
        return await this.handleEmptyQuerySearch<T>(
          types.length > 0
            ? types.map(type => this.getCollectionNameForType(type as MemoryType)).filter(Boolean) as string[]
            : Object.values(COLLECTION_NAMES).filter(Boolean) as string[],
          filter,
          limit,
          options.offset || 0
        );
      }
      
      // Normalize and validate query
      const normalizedQuery = query.trim() || '';
      const isEmptyQuery = normalizedQuery.length === 0;
      
      // Log query information
      if (process.env.MEMORY_DEBUG === 'true') {
        console.debug(`Memory search - Query: "${normalizedQuery}", Empty: ${isEmptyQuery}, Types: ${types.join(', ') || 'all'}`);
      }
      
      // Check if this is a causal chain search request
      if (options.maxDepth !== undefined || options.direction || options.analyze) {
        // Handle causal chain search as a special case
        // For now, return regular search results since actual causal chain 
        // functionality will be implemented in a future update
        if (process.env.MEMORY_DEBUG === 'true') {
          console.debug('Causal chain search requested - using standard search as fallback');
        }
      }
      
      // If no specific types requested, search all collections
      const collectionsToSearch = types.length > 0
        ? types.map(type => this.getCollectionNameForType(type as MemoryType))
        : Object.values(COLLECTION_NAMES);
      
      // Filter out undefined collection names
      const validCollections = collectionsToSearch.filter(name => !!name) as string[];
      
      if (validCollections.length === 0) {
        console.warn('No valid collections to search');
        return [];
      }
      
      // If query is empty, use filter-based search instead of vector search
      if (isEmptyQuery) {
        if (process.env.MEMORY_DEBUG === 'true') {
          console.debug('Empty query detected, using filter-based search instead of vector search');
        }
        return await this.handleEmptyQuerySearch<T>(validCollections, filter, limit, options.offset || 0);
      }
      
      // If query optimizer is available and this is a single collection search,
      // use the optimizer for better performance
      if (this.queryOptimizer && types.length === 1) {
        try {
          const type = types[0] as MemoryType;
          const collectionName = this.getCollectionNameForType(type);
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
                query: normalizedQuery,
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
      const embeddingResult = await this.embeddingService.getEmbedding(normalizedQuery);
      const vector = embeddingResult.embedding; // Extract the actual vector array
      
      // Log if we're using a fallback embedding
      if (embeddingResult.usedFallback) {
        console.log(`Using fallback embedding for search: ${embeddingResult.model || 'unknown fallback'}`);
      }
      
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
            query: normalizedQuery, // Pass the normalized query for potential fallback
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
      // Log error and throw
      console.error('Search error:', error);
      throw handleMemoryError(error, 'search');
    }
  }
  
  /**
   * Handle searches with empty queries by using filter-based approach
   * @private
   */
  private async handleEmptyQuerySearch<T extends BaseMemorySchema>(
    collections: string[],
    filter?: MemoryFilter,
    limit: number = 10,
    offset: number = 0
  ): Promise<SearchResult<T>[]> {
    const results: SearchResult<T>[] = [];
    
    // If no collections to search, return empty results
    if (!collections || collections.length === 0) {
      return results;
    }
    
    // Enhanced logging for debugging
    if (process.env.MEMORY_DEBUG === 'true') {
      console.debug('Empty query search with filter:', JSON.stringify(filter));
    }
    
    // Special handling for task filters - check both places where task data might be stored
    if (filter && typeof filter === 'object') {
      // Check if this appears to be a task filter by looking for common patterns
      const isTaskFilter = 
        // Case 1: Explicit type field
        ('type' in filter && filter.type === 'task') || 
        // Case 2: Looking for specific status values typically used for tasks
        ('status' in filter && 
          (typeof filter.status === 'object' && 
           '$in' in filter.status && 
           Array.isArray(filter.status.$in) &&
           filter.status.$in.some((s: string) => ['pending', 'scheduled', 'in_progress'].includes(s))));
      
      if (isTaskFilter) {
        if (process.env.MEMORY_DEBUG === 'true') {
          console.debug('Detected task filter - enhancing to check both metadata and root paths');
        }
        
        // Create a more flexible filter that checks both possible locations of fields
        const enhancedFilter: any = { should: [] };
        
        // Add option to check status at root level
        if ('status' in filter) {
          const rootFilter: any = { must: [] };
          rootFilter.must.push({ key: 'type', match: { value: 'task' } });
          
          const statusValue = filter.status;
          if (Array.isArray(statusValue)) {
            rootFilter.must.push({ key: 'status', match: { any: statusValue } });
          } else if (typeof statusValue === 'object' && statusValue !== null && '$in' in statusValue) {
            rootFilter.must.push({ key: 'status', match: { any: statusValue.$in } });
          } else {
            rootFilter.must.push({ key: 'status', match: { value: statusValue } });
          }
          
          enhancedFilter.should.push(rootFilter);
        }
        
        // Add option to check status in metadata path
        if ('status' in filter) {
          const metadataFilter: any = { must: [] };
          metadataFilter.must.push({ key: 'metadata.type', match: { value: 'task' } });
          
          const statusValue = filter.status;
          if (Array.isArray(statusValue)) {
            metadataFilter.must.push({ key: 'metadata.status', match: { any: statusValue } });
          } else if (typeof statusValue === 'object' && statusValue !== null && '$in' in statusValue) {
            metadataFilter.must.push({ key: 'metadata.status', match: { any: statusValue.$in } });
          } else {
            metadataFilter.must.push({ key: 'metadata.status', match: { value: statusValue } });
          }
          
          enhancedFilter.should.push(metadataFilter);
        }
        
        if (process.env.MEMORY_DEBUG === 'true') {
          console.debug('Enhanced task filter:', JSON.stringify(enhancedFilter));
        }
        
        // Use the enhanced filter
        filter = enhancedFilter;
      }
    }
    
    // Validate filter before passing to client
    let qdrantFilter = undefined;
    if (filter) {
      try {
        // For task filters, we've already built a proper Qdrant filter above
        if (filter.should) {
          qdrantFilter = filter;
        } else {
          qdrantFilter = this.buildQdrantFilter(filter);
        }
        
        // Log the transformed filter for debugging
        if (process.env.MEMORY_DEBUG === 'true') {
          console.debug('Transformed filter for Qdrant:', JSON.stringify(qdrantFilter));
        }
        
        // If filter builds to empty object, set to undefined
        if (qdrantFilter && typeof qdrantFilter === 'object' && Object.keys(qdrantFilter).length === 0) {
          qdrantFilter = undefined;
        }
      } catch (error) {
        console.warn('Error building filter for empty query search:', error);
        // Continue with undefined filter
      }
    }
    
    // Search each collection using scrollPoints instead of vector search
    for (const collectionName of collections) {
      if (!collectionName) continue;
      
      try {
        // Check if collection exists
        const collectionExists = await this.client.collectionExists(collectionName);
        if (!collectionExists) {
          console.warn(`Collection ${collectionName} does not exist, skipping empty query search`);
          continue;
        }
        
        // Use scrollPoints with correct parameters (no sorting support in this method)
        const scrolledPoints = await this.client.scrollPoints<T>(
          collectionName,
          qdrantFilter,
          limit,
          offset
        );
        
        // Add type and collection info to results
        const type = this.getTypeFromCollectionName(collectionName);
        
        if (scrolledPoints.length > 0 && type) {
          if (process.env.MEMORY_DEBUG === 'true') {
            console.debug(`Found ${scrolledPoints.length} results in collection ${collectionName}`);
          }
          
          const mappedResults = scrolledPoints.map(point => ({
            point: point as MemoryPoint<T>,
            score: 1.0, // No relevance score for pure filtering
            type: type as MemoryType,
            collection: collectionName
          }));
          
          results.push(...mappedResults);
        }
      } catch (error) {
        console.error(`Error in empty query search for collection ${collectionName}:`, error);
        continue;
      }
    }
    
    return results;
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
    
    // Check if filter is empty
    if (!filter || (typeof filter === 'object' && Object.keys(filter).length === 0)) {
      return {};
    }
    
    // Convert to Qdrant filter format with proper field conditions
    const conditions: any[] = [];
    
    // Process filter entries
    Object.entries(filter).forEach(([key, value]) => {
      if (value === undefined) return;
      
      // Special handling for array values - convert to "any" match condition
      if (Array.isArray(value)) {
        if (process.env.MEMORY_DEBUG === 'true') {
          console.debug(`Converting array condition for key ${key}:`, value);
        }
        conditions.push({
          key,
          match: { any: value }
        });
      }
      // Handle metadata fields
      else if (key === 'metadata' && typeof value === 'object' && !Array.isArray(value)) {
        // Process each metadata field as separate condition
        Object.entries(value as Record<string, any>).forEach(([metaKey, metaValue]) => {
          const fullKey = `metadata.${metaKey}`;
          
          if (Array.isArray(metaValue)) {
            conditions.push({
              key: fullKey,
              match: { any: metaValue }
            });
          } else if (typeof metaValue === 'object' && metaValue !== null) {
            // Check for operator notation ($gt, $lt, etc)
            if ('$gt' in metaValue || '$gte' in metaValue || '$lt' in metaValue || '$lte' in metaValue) {
              conditions.push({
                key: fullKey,
                range: metaValue
              });
            } else if ('$in' in metaValue || '$nin' in metaValue || '$eq' in metaValue || '$ne' in metaValue) {
              if ('$in' in metaValue && Array.isArray(metaValue.$in)) {
                conditions.push({
                  key: fullKey,
                  match: { any: metaValue.$in }
                });
              } else {
                conditions.push({
                  key: fullKey,
                  match: metaValue
                });
              }
            } else if ('$contains' in metaValue || '$startsWith' in metaValue || '$endsWith' in metaValue) {
              conditions.push({
                key: fullKey,
                match: { text: metaValue }
              });
            } else {
              // Simple object value
              conditions.push({
                key: fullKey,
                match: { value: metaValue }
              });
            }
          } else {
            // Simple value
            conditions.push({
              key: fullKey,
              match: { value: metaValue }
            });
          }
        });
      }
      // Handle object values with operators
      else if (typeof value === 'object' && value !== null) {
        // Handle range conditions
        if ('$gt' in value || '$gte' in value || '$lt' in value || '$lte' in value) {
          conditions.push({
            key,
            range: value
          });
        } 
        // Handle match conditions with special care for $in operator
        else if ('$in' in value || '$nin' in value || '$eq' in value || '$ne' in value) {
          // Special handling for $in with array
          if ('$in' in value && Array.isArray(value.$in)) {
            if (process.env.MEMORY_DEBUG === 'true') {
              console.debug(`Converting $in condition for key ${key}:`, value.$in);
            }
            conditions.push({
              key,
              match: { any: value.$in }
            });
          } else {
            conditions.push({
              key,
              match: value
            });
          }
        }
        // Handle text conditions
        else if ('$contains' in value || '$startsWith' in value || '$endsWith' in value) {
          conditions.push({
            key,
            match: { text: value }
          });
        } 
        // Default to passing through the object
        else {
          conditions.push({
            key,
            match: { value }
          });
        }
      }
      // Simple value becomes a match condition
      else {
        conditions.push({
          key,
          match: { value }
        });
      }
    });
    
    // Return must clause with conditions
    return conditions.length > 0 ? { must: conditions } : {};
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
      const collectionName = this.getCollectionNameForType(type);
      
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
        const memType = type as MemoryType;
        const collectionName = this.getCollectionNameForType(memType);
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
            const collectionName = this.getCollectionNameForType(type);
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
        ? types.map((type: MemoryType) => this.getCollectionNameForType(type))
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
          let qdrantFilter;
          try {
            qdrantFilter = filter ? this.buildQdrantFilter(filter) : undefined;
            
            // Validate the filter
            if (qdrantFilter && typeof qdrantFilter === 'object' && Object.keys(qdrantFilter).length === 0) {
              qdrantFilter = undefined;
            }
          } catch (filterError) {
            console.warn(`Error building filter for collection ${collectionName}:`, filterError);
            // Continue with undefined filter
            qdrantFilter = undefined;
          }
          
          // Use scrollPoints with correct parameters (no sorting support in this method)
          const scrolledPoints = await this.client.scrollPoints<T>(
            collectionName,
            qdrantFilter,
            limit,
            offset
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

  /**
   * Retrieves a memory context with grouped related memories
   * 
   * @param options Memory context options
   * @returns Memory context with grouped memories
   * @throws Memory error if context retrieval fails
   */
  async getMemoryContext<T extends BaseMemorySchema>(
    options: MemoryContextOptions = {}
  ): Promise<MemoryContext<T>> {
    try {
      const {
        query = '',
        filter = {},
        types = [],
        maxMemoriesPerGroup = 5,
        maxTotalMemories = 20,
        includeSummary = false,
        minScore = 0.6,
        timeWeighted = false,
        numGroups = 3,
        includedGroups = [],
        groupingStrategy = 'topic'
      } = options;
      
      if (!query && Object.keys(filter).length === 0) {
        throw handleMemoryError(
          'Either query or filter must be provided for memory context retrieval',
          'VALIDATION_ERROR'
        );
      }
      
      // Generate a context ID based on query/filter
      const contextId = `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Step 1: Retrieve relevant memories
      let memories: SearchResult<T>[] = [];
      
      if (query) {
        // Get memories via semantic search if query provided
        memories = await this.search<T>(query, {
          types,
          filter,
          limit: maxTotalMemories,
          minScore
        });
      } else {
        // Otherwise use direct filtering
        memories = await this.filter<T>({
          types: types as MemoryType[],
          filter,
          limit: maxTotalMemories
        });
      }
      
      if (memories.length === 0) {
        // Return empty context if no memories found
        return {
          contextId,
          timestamp: Date.now(),
          groups: [],
          summary: includeSummary ? 'No relevant memories found.' : undefined
        };
      }
      
      // Apply time weighting if requested
      if (timeWeighted) {
        memories = this.applyTimeWeighting(memories);
      }
      
      // Step 2: Group memories based on selected strategy
      let groups: MemoryContextGroup<T>[] = [];
      
      switch (groupingStrategy) {
        case 'time':
          groups = this.groupMemoriesByTime(memories, numGroups);
          break;
        case 'type': {
          // Type grouping returns TypedMemoryContextGroup which is a subtype of MemoryContextGroup
          const typedGroups = this.groupMemoriesByType(memories);
          groups = typedGroups;
          break;
        }
        case 'custom':
          // Custom grouping would use includedGroups parameter
          groups = this.groupMemoriesByCustomCategories(memories, includedGroups);
          break;
        case 'topic':
        default:
          // Default to topic-based grouping
          groups = await this.groupMemoriesByTopic(memories, numGroups);
          break;
      }
      
      // Step 3: Limit memories per group
      groups = groups.map(group => ({
        ...group,
        memories: group.memories.slice(0, maxMemoriesPerGroup)
      }));
      
      // Order groups by relevance
      groups.sort((a, b) => b.relevance - a.relevance);
      
      // Step 4: Generate summary if requested
      let summary: string | undefined;
      if (includeSummary) {
        summary = await this.generateContextSummary(memories, query);
      }
      
      // Return the complete memory context
      return {
        contextId,
        timestamp: Date.now(),
        groups,
        summary,
        metadata: {
          query,
          totalMemoriesFound: memories.length,
          strategy: groupingStrategy
        }
      };
    } catch (error) {
      throw handleMemoryError(error, 'CONTEXT_ERROR');
    }
  }
  
  /**
   * Apply time-based weighting to memory relevance scores
   * Recent memories get boosted scores
   */
  private applyTimeWeighting<T extends BaseMemorySchema>(
    memories: SearchResult<T>[]
  ): SearchResult<T>[] {
    const now = Date.now();
    const DAY_MS = 86400000; // 24 hours in milliseconds
    const MAX_DAYS = 30; // Maximum days to consider for time weighting
    const TIME_WEIGHT = 0.3; // Weight of time factor (0-1)
    
    return memories.map(memory => {
      // Get memory timestamp
      const timestampStr = memory.point.payload.timestamp as unknown as string;
      const timestamp = parseInt(timestampStr, 10);
      
      if (isNaN(timestamp)) {
        return memory; // Return unchanged if timestamp invalid
      }
      
      // Calculate days difference
      const daysDiff = Math.min(MAX_DAYS, Math.max(0, (now - timestamp) / DAY_MS));
      
      // Calculate time decay factor (1.0 for newest, decreasing with age)
      const timeFactor = 1 - (daysDiff / MAX_DAYS);
      
      // Calculate weighted score
      const originalScore = memory.score;
      const timeWeightedScore = (originalScore * (1 - TIME_WEIGHT)) + (timeFactor * TIME_WEIGHT);
      
      // Return memory with adjusted score
      return {
        ...memory,
        score: timeWeightedScore
      };
    }).sort((a, b) => b.score - a.score); // Resort by new scores
  }
  
  /**
   * Group memories by time periods
   */
  private groupMemoriesByTime<T extends BaseMemorySchema>(
    memories: SearchResult<T>[],
    numGroups: number
  ): MemoryContextGroup<T>[] {
    // Sort memories by timestamp
    const sortedMemories = [...memories].sort((a, b) => {
      const aTime = parseInt(a.point.payload.timestamp as unknown as string, 10);
      const bTime = parseInt(b.point.payload.timestamp as unknown as string, 10);
      return bTime - aTime; // Descending order (newest first)
    });
    
    // Define time periods
    const now = Date.now();
    const DAY_MS = 86400000; // 24 hours in milliseconds
    
    const timeGroups: MemoryContextGroup<T>[] = [
      {
        name: 'Recent',
        description: 'Memories from the past 24 hours',
        memories: [],
        relevance: 1.0
      },
      {
        name: 'Past Week',
        description: 'Memories from the past week',
        memories: [],
        relevance: 0.8
      },
      {
        name: 'Past Month',
        description: 'Memories from the past month',
        memories: [],
        relevance: 0.6
      },
      {
        name: 'Older',
        description: 'Older memories',
        memories: [],
        relevance: 0.4
      }
    ];
    
    // Assign memories to time groups
    for (const memory of sortedMemories) {
      const timestamp = parseInt(memory.point.payload.timestamp as unknown as string, 10);
      if (isNaN(timestamp)) {
        continue; // Skip if timestamp invalid
      }
      
      const daysDiff = (now - timestamp) / DAY_MS;
      
      if (daysDiff < 1) {
        timeGroups[0].memories.push(memory);
      } else if (daysDiff < 7) {
        timeGroups[1].memories.push(memory);
      } else if (daysDiff < 30) {
        timeGroups[2].memories.push(memory);
      } else {
        timeGroups[3].memories.push(memory);
      }
    }
    
    // Filter out empty groups and limit to requested number
    return timeGroups
      .filter(group => group.memories.length > 0)
      .slice(0, numGroups);
  }
  
  /**
   * Group memories by their memory type
   */
  private groupMemoriesByType<T extends BaseMemorySchema>(
    memories: SearchResult<T>[]
  ): TypedMemoryContextGroup<T>[] {
    // Group by memory type
    const typeGroups = new Map<MemoryType, SearchResult<T>[]>();
    
    for (const memory of memories) {
      if (!typeGroups.has(memory.type)) {
        typeGroups.set(memory.type, []);
      }
      typeGroups.get(memory.type)!.push(memory);
    }
    
    // Create groups with descriptions
    const typeDescriptions: Partial<Record<MemoryType, string>> = {
      [MemoryType.MESSAGE]: 'Chat messages and conversations',
      [MemoryType.THOUGHT]: 'Internal thoughts and reflections',
      [MemoryType.DOCUMENT]: 'Documents and external content',
      [MemoryType.REFLECTION]: 'Deep reflections and analyses',
      [MemoryType.TASK]: 'Tasks and actions',
      [MemoryType.INSIGHT]: 'Insights and realizations',
      [MemoryType.MEMORY_EDIT]: 'Memory modifications',
      [MemoryType.ANALYSIS]: 'Detailed analysis records'
    };
    
    // Convert to array of groups
    return Array.from(typeGroups.entries())
      .map(([type, typeMemories]) => ({
        name: type.toString(),
        description: typeDescriptions[type] || `Memories of type ${type}`,
        memories: typeMemories,
        relevance: 0.9, // All types have equal relevance
        type // Add the type property explicitly
      }))
      .sort((a, b) => b.memories.length - a.memories.length); // Sort by number of memories
  }
  
  /**
   * Group memories by custom categories
   */
  private groupMemoriesByCustomCategories<T extends BaseMemorySchema>(
    memories: SearchResult<T>[],
    categories: string[]
  ): MemoryContextGroup<T>[] {
    if (categories.length === 0) {
      // Default to a single group if no categories provided
      return [{
        name: 'All Memories',
        description: 'All retrieved memories',
        memories,
        relevance: 1.0
      }];
    }
    
    // Create a group for each category
    const groups: MemoryContextGroup<T>[] = categories.map(category => ({
      name: category,
      description: `Memories related to ${category}`,
      memories: [],
      relevance: 0.9
    }));
    
    // Assign memories to categories based on content and metadata
    // This is a simple implementation; in practice, would use more sophisticated matching
    for (const memory of memories) {
      const text = memory.point.payload.text as string || '';
      const tags = (memory.point.payload.metadata?.tags || []) as string[];
      
      // Check each category
      for (let i = 0; i < categories.length; i++) {
        const category = categories[i].toLowerCase();
        
        // Check if category matches text or tags
        if (
          text.toLowerCase().includes(category) ||
          tags.some(tag => tag.toLowerCase().includes(category))
        ) {
          groups[i].memories.push(memory);
        }
      }
    }
    
    // Add an "Other" category for unmatched memories
    const categorizedMemoryIds = new Set(
      groups.flatMap(g => g.memories.map(m => m.point.id))
    );
    
    const uncategorizedMemories = memories.filter(
      m => !categorizedMemoryIds.has(m.point.id)
    );
    
    if (uncategorizedMemories.length > 0) {
      groups.push({
        name: 'Other',
        description: 'Memories not matching specific categories',
        memories: uncategorizedMemories,
        relevance: 0.5
      });
    }
    
    // Remove empty groups and return
    return groups.filter(group => group.memories.length > 0);
  }
  
  /**
   * Group memories by topic using embeddings similarity
   * This is more sophisticated than the other grouping methods and uses
   * clustering based on embedding vectors
   */
  private async groupMemoriesByTopic<T extends BaseMemorySchema>(
    memories: SearchResult<T>[],
    numGroups: number
  ): Promise<MemoryContextGroup<T>[]> {
    // For simplicity in this implementation, we'll use a basic approach
    // In a full implementation, this would use clustering algorithms
    
    // Use the first few memories as "centroids"
    const topMemories = memories.slice(0, Math.min(numGroups, memories.length));
    
    if (topMemories.length === 0) {
      return [];
    }
    
    // If only one group, return all memories
    if (topMemories.length === 1 || numGroups === 1) {
      return [{
        name: 'Relevant Memories',
        description: 'All memories related to the query',
        memories,
        relevance: 1.0
      }];
    }
    
    // Create initial groups from top memories
    const groups: MemoryContextGroup<T>[] = topMemories.map((memory, index) => {
      // Extract a topic name from the memory text
      const text = memory.point.payload.text as string || '';
      const topicName = this.extractTopicName(text, `Topic ${index + 1}`);
      
      return {
        name: topicName,
        description: this.generateTopicDescription(text),
        memories: [memory],
        relevance: 1.0 - (index * 0.1) // Decreasing relevance
      };
    });
    
    // Assign remaining memories to the closest group
    const remainingMemories = memories.slice(numGroups);
    
    for (const memory of remainingMemories) {
      let bestGroupIndex = 0;
      let bestSimilarity = -1;
      
      // Find the group with the most similar centroid
      for (let i = 0; i < groups.length; i++) {
        const centroid = groups[i].memories[0];
        const similarity = this.calculateTextSimilarity(
          memory.point.payload.text as string || '',
          centroid.point.payload.text as string || ''
        );
        
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestGroupIndex = i;
        }
      }
      
      // Add to best matching group
      groups[bestGroupIndex].memories.push(memory);
    }
    
    // Remove empty groups
    return groups.filter(group => group.memories.length > 0);
  }
  
  /**
   * Simple text similarity calculation based on word overlap
   * In a real implementation, this would use vector similarity
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\W+/).filter(w => w.length > 0));
    const words2 = new Set(text2.toLowerCase().split(/\W+/).filter(w => w.length > 0));
    
    if (words1.size === 0 || words2.size === 0) {
      return 0;
    }
    
    // Count common words
    let commonCount = 0;
    const words1Array = Array.from(words1);
    for (const word of words1Array) {
      if (words2.has(word)) {
        commonCount++;
      }
    }
    
    // Jaccard similarity: intersection / union
    return commonCount / (words1.size + words2.size - commonCount);
  }
  
  /**
   * Extract a topic name from text
   */
  private extractTopicName(text: string, fallback: string): string {
    // Simple heuristic: get first few words of text
    const words = text.split(/\W+/).filter(w => w.length > 0);
    
    if (words.length >= 2) {
      // Use first few words (capitalized)
      return words.slice(0, Math.min(3, words.length))
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    }
    
    return fallback;
  }
  
  /**
   * Generate a description for a topic based on sample text
   */
  private generateTopicDescription(text: string): string {
    if (!text || text.length === 0) {
      return 'Group of related memories';
    }
    
    // Use first sentence or truncate
    const firstSentence = text.split(/[.!?]/, 1)[0].trim();
    
    if (firstSentence.length < 100) {
      return `Memories related to: "${firstSentence}"`;
    }
    
    return `Memories related to: "${firstSentence.substring(0, 97)}..."`;
  }
  
  /**
   * Generate a summary for the entire memory context
   */
  private async generateContextSummary<T extends BaseMemorySchema>(
    memories: SearchResult<T>[],
    query: string
  ): Promise<string> {
    // In a real implementation, this would use an LLM to generate a summary
    // For this implementation, we'll create a simple summary
    
    const count = memories.length;
    let summary = `Found ${count} relevant ${count === 1 ? 'memory' : 'memories'}`;
    
    if (query) {
      summary += ` related to "${query}"`;
    }
    
    // Add memory types breakdown
    const typeCount = new Map<MemoryType, number>();
    for (const memory of memories) {
      typeCount.set(memory.type, (typeCount.get(memory.type) || 0) + 1);
    }
    
    if (typeCount.size > 1) {
      summary += ', including ';
      summary += Array.from(typeCount.entries())
        .map(([type, count]) => `${count} ${type}${count !== 1 ? 's' : ''}`)
        .join(', ');
    }
    
    // Add time range if available
    try {
      const timestamps = memories
        .map(m => parseInt(m.point.payload.timestamp as unknown as string, 10))
        .filter(t => !isNaN(t));
      
      if (timestamps.length > 0) {
        const oldest = new Date(Math.min(...timestamps));
        const newest = new Date(Math.max(...timestamps));
        
        summary += `, spanning from ${oldest.toLocaleDateString()} to ${newest.toLocaleDateString()}`;
      }
    } catch (e) {
      // Ignore timestamp errors
    }
    
    return summary;
  }

  /**
   * Get direct access to the underlying memory client
   */
  async getClient(): Promise<any> {
    if (!this.client) {
      throw new Error('Memory client not available');
    }
    
    console.log('Providing direct access to Qdrant client');
    return this.client;
  }

  /**
   * Get tasks by status directly from Qdrant
   * 
   * This specialized method bypasses the standard search approach to efficiently
   * retrieve tasks by their status.
   */
  async getTasksByStatus(
    statuses: string[] = ['pending', 'scheduled', 'in_progress']
  ): Promise<any[]> {
    try {
      // Get the collection name for tasks (cast string to MemoryType)
      const taskCollection = this.getCollectionNameForType('task' as unknown as MemoryType);

      // Use direct client access for more efficient retrieval
      if (!this.client) {
        console.log('Memory client not available for task retrieval');
        return [];
      }

      // First try: Use client's dedicated task method if available
      if (typeof (this.client as any).getTasksByStatus === 'function') {
        console.log(`Using client's dedicated getTasksByStatus method for ${taskCollection}`);
        return await (this.client as any).getTasksByStatus(taskCollection, statuses);
      }
      
      // Second try: Use direct Qdrant filter optimized for task retrieval
      try {
        console.log(`Using direct Qdrant filter to find tasks in ${taskCollection}`);
        
        // Filter for tasks with matching status
        const filter = {
          must: [
            {
              key: "type",
              match: {
                value: "task"
              }
            },
            {
              key: "status",
              match: {
                any: statuses
              }
            }
          ]
        };
        
        // Use client's scroll method with this filter
        if (typeof (this.client as any).scroll === 'function') {
          const scrollRequest = {
            filter,
            limit: 1000,
            with_payload: true
          };
          
          const response = await (this.client as any).scroll(taskCollection, scrollRequest);
          console.log(`Found ${response.points.length} tasks with direct filter`);
          
          // Format the points to match task structure
          return response.points.map((point: any) => {
            const payload = point.payload || {};
            return {
              id: String(point.id),
              title: payload.title || '',
              description: payload.description || '',
              type: payload.type || 'task',
              status: payload.status || 'pending',
              priority: payload.priority || 0,
              retryAttempts: payload.retryAttempts || 0,
              dependencies: payload.dependencies || [],
              metadata: payload.metadata || {},
              createdAt: payload.createdAt || new Date().toISOString(),
              updatedAt: payload.updatedAt || new Date().toISOString()
            };
          });
        }
      } catch (filterError) {
        console.warn(`Error using direct filter for tasks:`, filterError);
        // Continue to fallback approach
      }
      
      // Final try: Use standard search approach as fallback
      console.log(`Falling back to standard filter for tasks in ${taskCollection}`);
      
      // Standard approach: Build filter and use client search
      const filter = this.buildQdrantFilter({
        type: 'task',
        status: { $in: statuses }
      });
      
      const standardResponse = await (this.client as any).search(taskCollection, {
        vector: new Array(1536).fill(0.01), // Random vector
        filter,
        limit: 1000,
        with_payload: true
      });
      
      // Format the results to match task structure
      return standardResponse.map((result: any) => {
        const payload = result.payload || {};
        return {
          id: String(result.id),
          title: payload.title || '',
          description: payload.description || '',
          type: payload.type || 'task',
          status: payload.status || 'pending',
          priority: payload.priority || 0,
          retryAttempts: payload.retryAttempts || 0,
          dependencies: payload.dependencies || [],
          metadata: payload.metadata || {},
          createdAt: payload.createdAt || new Date().toISOString(),
          updatedAt: payload.updatedAt || new Date().toISOString()
        };
      });
    } catch (error) {
      console.error('Error getting tasks by status:', error);
      return [];
    }
  }
} 