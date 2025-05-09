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
    // Use indexing with type assertion to avoid the "Property 'message' does not exist" error
    return (COLLECTION_NAMES as Record<string, string>)[type] || '';
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
        ? types.map(type => this.getCollectionNameForType(type as MemoryType))
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
} 