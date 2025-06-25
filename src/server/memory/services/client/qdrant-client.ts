/**
 * Qdrant memory client implementation
 */
import { QdrantClient } from '@qdrant/js-client-rest';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULTS } from '../../config';
import { BaseMemorySchema, MemoryPoint, MemorySearchResult } from '../../models';
import { handleMemoryError } from '../../utils';
import { EmbeddingService } from './embedding-service';
import { ClientStatus, DeleteOptions, IMemoryClient, MemoryClientOptions, SearchQuery } from './types';

/**
 * In-memory fallback storage
 */
class InMemoryStorage {
  private collections: Map<string, Map<string, any>> = new Map();

  /**
   * Add a point to a collection
   */
  addPoint(collectionName: string, id: string, point: any): string {
    if (!this.collections.has(collectionName)) {
      this.collections.set(collectionName, new Map());
    }

    const collection = this.collections.get(collectionName)!;
    collection.set(id, point);

    return id;
  }

  /**
   * Get points by IDs
   */
  getPoints(collectionName: string, ids: string[]): any[] {
    if (!this.collections.has(collectionName)) {
      return [];
    }

    const collection = this.collections.get(collectionName)!;
    return ids
      .filter(id => collection.has(id))
      .map(id => collection.get(id));
  }

  /**
   * Search for points (simple text match)
   */
  searchPoints(collectionName: string, query: string, limit: number = 10): any[] {
    if (!this.collections.has(collectionName)) {
      return [];
    }

    const collection = this.collections.get(collectionName)!;
    const points = Array.from(collection.values());

    // Simple text search based on payload
    return points
      .filter(point => {
        const payload = point.payload || {};
        const text = payload.text || '';

        return query ? text.toLowerCase().includes(query.toLowerCase()) : true;
      })
      .slice(0, limit);
  }

  /**
   * Update a point
   */
  updatePoint(collectionName: string, id: string, updates: any): boolean {
    if (!this.collections.has(collectionName)) {
      return false;
    }

    const collection = this.collections.get(collectionName)!;

    if (!collection.has(id)) {
      return false;
    }

    const point = collection.get(id);
    collection.set(id, { ...point, ...updates });

    return true;
  }

  /**
   * Delete a point
   */
  deletePoint(collectionName: string, id: string): boolean {
    if (!this.collections.has(collectionName)) {
      return false;
    }

    const collection = this.collections.get(collectionName)!;
    return collection.delete(id);
  }

  /**
   * Get point count
   */
  getPointCount(collectionName: string): number {
    if (!this.collections.has(collectionName)) {
      return 0;
    }

    return this.collections.get(collectionName)!.size;
  }

  /**
   * Reset storage
   */
  reset(): void {
    this.collections.clear();
  }
}

/**
 * Qdrant memory client implementation
 */
export class QdrantMemoryClient implements IMemoryClient {
  private client: QdrantClient;
  private embeddingService: EmbeddingService;
  private initialized: boolean = false;
  private collections: Set<string> = new Set();
  private fallbackStorage: InMemoryStorage;
  private useQdrant: boolean = true;
  private connectionTimeout: number;
  private requestTimeout: number;

  /**
   * Create a new Qdrant memory client
   */
  constructor(options?: MemoryClientOptions) {
    // Set connection options
    const qdrantUrl = options?.qdrantUrl || process.env.QDRANT_URL || 'http://localhost:6333';
    const qdrantApiKey = options?.qdrantApiKey || process.env.QDRANT_API_KEY;
    this.connectionTimeout = options?.connectionTimeout || DEFAULTS.CONNECTION_TIMEOUT;
    this.requestTimeout = options?.requestTimeout || DEFAULTS.FETCH_TIMEOUT;

    // Initialize Qdrant client
    this.client = new QdrantClient({
      url: qdrantUrl,
      apiKey: qdrantApiKey,
      timeout: this.connectionTimeout
    });

    // Initialize embedding service
    this.embeddingService = new EmbeddingService({
      openAIApiKey: options?.openAIApiKey,
      embeddingModel: options?.embeddingModel,
      useRandomFallback: true
    });

    // Initialize fallback storage
    this.fallbackStorage = new InMemoryStorage();
  }

  /**
   * Get information about a collection
   */
  async getCollectionInfo(collectionName: string): Promise<{ name: string; dimensions: number; pointsCount: number; createdAt: Date } | null> {
    if (!this.initialized) {
      await this.initialize();
    }
    if (!this.useQdrant) {
      // Fallback: return null if not using Qdrant
      return null;
    }
    // Check if collection exists
    const exists = await this.collectionExists(collectionName);
    if (!exists) {
      return null;
    }
    // Get collection info from Qdrant
    const info = await this.client.getCollection(collectionName);
    let dimensions = 1536; // Default
    if (info.config?.params?.vectors) {
      const vectorsConfig = info.config.params.vectors as Record<string, unknown>;
      if (typeof vectorsConfig === 'object' && !Array.isArray(vectorsConfig)) {
        const vectorNames = Object.keys(vectorsConfig);
        if (vectorNames.length > 0) {
          const firstVectorName = vectorNames[0];
          const firstVectorConfig = vectorsConfig[firstVectorName] as Record<string, unknown> | undefined;
          if (firstVectorConfig && typeof firstVectorConfig === 'object' && 'size' in firstVectorConfig) {
            dimensions = (firstVectorConfig.size as number) || 1536;
          }
        }
      }
    }
    return {
      name: collectionName,
      dimensions,
      pointsCount: info.vectors_count || 0,
      createdAt: new Date()
    };
  }

  /**
   * Initialize the client
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing Qdrant memory client...');

      // Test connection to Qdrant
      try {
        const testConnectionPromise = this.client.getCollections();
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Connection timeout after ${this.connectionTimeout}ms`)), this.connectionTimeout)
        );

        const result = await Promise.race([testConnectionPromise, timeoutPromise]);
        this.useQdrant = true;
        console.log(`Qdrant connection successful. Found ${result.collections.length} collections.`);

        // Initialize collections set
        this.collections = new Set(result.collections.map(c => c.name));

        // Ensure all required methods are available
        if (typeof this.getCollectionInfo !== 'function') {
          console.error('getCollectionInfo method not properly initialized');
          throw new Error('Required methods not available');
        }

      } catch (error) {
        console.error('Failed to connect to Qdrant:', error);
        this.useQdrant = false;
        this.initialized = true;
        return;
      }

      this.initialized = true;
      console.log('Qdrant memory client initialized.');
    } catch (error) {
      console.error('Failed to initialize Qdrant memory client:', error);
      this.useQdrant = false;
      this.initialized = true;
      throw handleMemoryError(error, 'initialize');
    }
  }

  /**
   * Check if client is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get client status
   */
  async getStatus(): Promise<ClientStatus> {
    return {
      initialized: this.initialized,
      connected: this.useQdrant,
      collectionsReady: Array.from(this.collections),
      usingFallback: !this.useQdrant
    };
  }

  /**
   * Check if a collection exists
   */
  async collectionExists(collectionName: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.useQdrant) {
      return false;
    }

    try {
      const collections = await this.client.getCollections();
      return collections.collections.some(collection => collection.name === collectionName);
    } catch (error) {
      console.error(`Error checking if collection ${collectionName} exists:`, error);
      this.useQdrant = false;
      return false;
    }
  }

  /**
   * Create a collection
   */
  async createCollection(collectionName: string, dimensions: number): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.useQdrant) {
      return false;
    }

    try {
      // Check if collection exists
      const exists = await this.collectionExists(collectionName);

      if (exists) {
        this.collections.add(collectionName);
        return true;
      }

      // Create collection
      await this.client.createCollection(collectionName, {
        vectors: {
          size: dimensions,
          distance: "Cosine"
        }
      });

      // Create indices for timestamp and type
      await this.client.createPayloadIndex(collectionName, {
        field_name: "timestamp",
        field_schema: "datetime"
      });

      await this.client.createPayloadIndex(collectionName, {
        field_name: "type",
        field_schema: "keyword"
      });

      this.collections.add(collectionName);
      return true;
    } catch (error) {
      console.error(`Error creating collection ${collectionName}:`, error);
      return false;
    }
  }

  /**
   * Add a point to a collection
   */
  async addPoint<T extends BaseMemorySchema>(
    collectionName: string,
    point: MemoryPoint<T>
  ): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Generate ID if not provided
    if (!point.id) {
      point.id = uuidv4();
    }

    // Use fallback storage if Qdrant is not available
    if (!this.useQdrant) {
      return this.fallbackStorage.addPoint(collectionName, point.id, point);
    }

    try {
      // Ensure collection exists
      if (!this.collections.has(collectionName)) {
        const exists = await this.collectionExists(collectionName);

        if (!exists) {
          console.log(`Collection ${collectionName} does not exist, creating it now...`);
          const dimensions = point.vector?.length || DEFAULTS.DIMENSIONS;
          await this.createCollection(collectionName, dimensions);
        }
      }

      // Convert the payload to a standard record format for Qdrant
      // Using type assertion to handle the BaseMemorySchema conversion
      const recordPayload = { ...(point.payload as unknown as Record<string, unknown>) };

      // CRITICAL FIX: Convert ULID to UUID for Qdrant compatibility
      const qdrantPointId = this.convertToQdrantId(point.id);

      // Insert point into Qdrant
      try {
        await this.client.upsert(collectionName, {
          wait: true,
          points: [
            {
              id: qdrantPointId, // Use converted UUID instead of original ULID
              vector: point.vector,
              payload: recordPayload
            }
          ]
        });
      } catch (upsertError) {

        // Handle 404 Not Found errors by creating the collection and retrying
        if (
          upsertError instanceof Error &&
          (upsertError.message.includes('404') || upsertError.message.includes('Not Found'))
        ) {
          console.log(`Collection ${collectionName} not found during upsert, creating it now...`);
          const dimensions = point.vector?.length || DEFAULTS.DIMENSIONS;
          const created = await this.createCollection(collectionName, dimensions);

          if (created) {
            // Retry the upsert now that we've created the collection
            await this.client.upsert(collectionName, {
              wait: true,
              points: [
                {
                  id: qdrantPointId, // Use converted UUID instead of original ULID
                  vector: point.vector,
                  payload: recordPayload
                }
              ]
            });
          } else {
            throw new Error(`Failed to create collection ${collectionName}`);
          }
        } else {
          // Rethrow other errors
          throw upsertError;
        }
      }

      return point.id;
    } catch (error) {
      console.error(`Error adding point to ${collectionName}:`, error);

      // Fallback to in-memory storage
      return this.fallbackStorage.addPoint(collectionName, point.id, point);
    }
  }

  /**
   * Convert any ID format to Qdrant-compatible UUID format
   */
  private convertToQdrantId(id: string): string {
    if (id.match(/^[0-9A-HJKMNP-TV-Z]{26}$/)) {
      // This is a ULID, convert to UUID format using deterministic hash
      const crypto = require('crypto');
      const hash = crypto.createHash('md5').update(id).digest('hex');
      return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
    } else if (id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      // Already a UUID
      return id;
    } else {
      // Use hash of the ID to create a UUID for any other format
      const crypto = require('crypto');
      const hash = crypto.createHash('md5').update(id).digest('hex');
      return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
    }
  }

  /**
   * Get points by IDs
   */
  async getPoints<T extends BaseMemorySchema>(
    collectionName: string,
    ids: string[]
  ): Promise<MemoryPoint<T>[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Use fallback storage if Qdrant is not available
    if (!this.useQdrant) {
      return this.fallbackStorage.getPoints(collectionName, ids);
    }

    try {
      // Check if collection exists first
      if (!this.collections.has(collectionName)) {
        const exists = await this.collectionExists(collectionName);
        if (!exists) {
          console.log(`Collection ${collectionName} does not exist during getPoints, returning empty array`);
          return [];
        }
      }

      // CRITICAL FIX: Convert ULID IDs to UUID IDs for Qdrant retrieval
      const qdrantIds = ids.map(id => this.convertToQdrantId(id));

      // Get points from Qdrant using retrieve method
      try {
        const response = await this.client.retrieve(collectionName, {
          ids: qdrantIds,
          with_payload: true,
          with_vector: true
        });

        // Transform response to MemoryPoint objects and map UUIDs back to original IDs
        return response.map((point, index) => {
          // Ensure vector is an array and handle all possible types
          let vector: number[] = [];
          if (Array.isArray(point.vector)) {
            // Flatten if it's a nested array
            if (point.vector.length > 0 && Array.isArray(point.vector[0])) {
              vector = (point.vector as number[][]).flat();
            } else {
              vector = point.vector as number[];
            }
          }

          return {
            id: ids[index], // Use original ID instead of converted UUID
            vector,
            payload: point.payload as T
          };
        });
      } catch (retrieveError) {
        // Handle 404 Not Found errors by returning empty array
        if (
          retrieveError instanceof Error &&
          (retrieveError.message.includes('404') || retrieveError.message.includes('Not Found'))
        ) {
          console.log(`Collection ${collectionName} not found during retrieve, returning empty array`);
          return [];
        }
        throw retrieveError;
      }
    } catch (error) {
      console.error(`Error getting points from ${collectionName}:`, error);

      // Fallback to in-memory storage
      return this.fallbackStorage.getPoints(collectionName, ids);
    }
  }

  /**
   * Search for points
   */
  async searchPoints<T extends BaseMemorySchema>(
    collectionName: string,
    query: SearchQuery
  ): Promise<MemorySearchResult<T>[]> {
    if (!this.initialized) {
      console.log('Client not initialized in searchPoints, attempting to initialize...');
      try {
        await this.initialize();
      } catch (initError) {
        console.error('Failed to initialize client in searchPoints:', initError);
        // Continue with fallback storage instead of throwing
      }
    }

    // Check if the collection exists first
    try {
      const collectionExists = await this.collectionExists(collectionName);
      if (!collectionExists) {
        console.warn(`Collection ${collectionName} does not exist. Returning empty results.`);
        return [];
      }
    } catch (checkError) {
      console.warn(`Error checking if collection ${collectionName} exists:`, checkError);
      // Continue with the search attempt, as the collection might still be accessible
    }

    // Handle empty query for scrolling
    if (!query.query && !query.vector) {
      const points = await this.scrollPoints<T>(
        collectionName,
        query.filter,
        query.limit,
        query.offset
      );

      // Convert to search results format
      return points.map(point => ({
        id: point.id,
        score: 1.0, // Default score for non-semantic search
        payload: point.payload
      }));
    }

    // Use fallback storage if Qdrant is not available
    if (!this.useQdrant) {
      const searchResults = this.fallbackStorage.searchPoints(
        collectionName,
        query.query || '',
        query.limit || DEFAULTS.DEFAULT_LIMIT
      );

      return searchResults.map(point => ({
        id: point.id,
        score: 1.0, // Default score for in-memory search
        payload: point.payload
      }));
    }

    try {
      // Get embedding vector for the query if not provided
      let vector = query.vector;

      if (!vector && query.query) {
        try {
          const embeddingResult = await this.embeddingService.getEmbedding(query.query);
          vector = embeddingResult.embedding;
        } catch (embeddingError) {
          console.warn(`Error generating embedding for query: ${embeddingError}`);
          // Continue with fallback mechanism
        }
      }

      // Handle empty or invalid vector case properly
      if (!vector || vector.length === 0 || (query.query && query.query.trim() === '')) {
        console.log(`Empty or invalid vector detected for search in ${collectionName}. Using non-vector search fallback.`);

        // Use non-vector search approach - scroll points with filtering
        return await this.handleEmptyVectorSearch<T>(collectionName, query);
      }

      try {
        const searchResponse = await this.client.search(collectionName, {
          vector: vector,
          limit: query.limit || DEFAULTS.DEFAULT_LIMIT,
          offset: query.offset || 0,
          filter: query.filter ? this.buildQdrantFilter(query.filter) : undefined,
          with_payload: true,
          with_vector: true,
          score_threshold: query.scoreThreshold
        });

        // Transform results
        return searchResponse.map(result => ({
          id: String(result.id),
          score: result.score,
          payload: result.payload as T
        }));
      } catch (searchError) {
        // Handle 404 Not Found errors by returning empty array 
        if (
          searchError instanceof Error &&
          (searchError.message.includes('404') || searchError.message.includes('Not Found'))
        ) {
          console.warn(`Collection ${collectionName} not found during search. Returning empty results.`);
          return [];
        }
        throw searchError;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check if this is a "collection not found" error
      if (
        errorMessage.includes('not found') ||
        errorMessage.includes('404') ||
        errorMessage.includes('does not exist')
      ) {
        console.warn(`Collection ${collectionName} not found during search. Returning empty results.`);
        return [];
      }

      console.error(`Error searching in ${collectionName}:`, error);

      // Fallback to non-vector search
      return await this.handleEmptyVectorSearch<T>(collectionName, query);
    }
  }

  /**
   * Handle empty vector search cases with a proper fallback mechanism
   * @private
   */
  private async handleEmptyVectorSearch<T extends BaseMemorySchema>(
    collectionName: string,
    query: SearchQuery
  ): Promise<MemorySearchResult<T>[]> {
    try {
      // First try using scrollPoints as a fallback
      const scrollResults = await this.scrollPoints<T>(
        collectionName,
        query.filter,
        query.limit || DEFAULTS.DEFAULT_LIMIT,
        query.offset
      );

      if (scrollResults.length > 0) {
        return scrollResults.map(point => ({
          id: point.id,
          score: 0.5, // Default middle score for non-semantic results
          payload: point.payload
        }));
      }

      // If scroll returns nothing, try in-memory fallback
      const fallbackResults = this.fallbackStorage.searchPoints(
        collectionName,
        query.query || '',
        query.limit || DEFAULTS.DEFAULT_LIMIT
      );

      return fallbackResults.map(point => ({
        id: point.id,
        score: 0.5, // Default middle score
        payload: point.payload as T
      }));
    } catch (fallbackError) {
      console.error(`Fallback search error in ${collectionName}:`, fallbackError);
      // Return empty array as last resort
      return [];
    }
  }

  /**
   * Scroll through points in a collection with optional filtering
   */
  async scrollPoints<T extends BaseMemorySchema>(
    collectionName: string,
    filter?: any,
    limit?: number,
    offset?: number
  ): Promise<MemoryPoint<T>[]> {
    if (!this.initialized) {
      console.log('Client not initialized, attempting to initialize...');
      try {
        await this.initialize();
      } catch (initError) {
        console.error('Failed to initialize client:', initError);
        throw new Error('Qdrant client not initialized');
      }
    }

    if (!collectionName) {
      throw new Error('Collection name is required');
    }

    try {
      // Add special handling for task retrieval
      const isTaskRequest =
        collectionName.includes('task') ||
        (filter &&
          (typeof filter === 'object' &&
            (('type' in filter && filter.type === 'task') ||
              (filter.status && filter.status.$in &&
                Array.isArray(filter.status.$in) &&
                filter.status.$in.some((s: string) =>
                  ['pending', 'scheduled', 'in_progress'].includes(s)
                ))
            )
          )
        );

      // Log detailed information about this request at debug level only
      if (process.env.NODE_ENV === 'development' && process.env.QDRANT_DEBUG === 'true') {
        console.debug(`scrollPoints for collection ${collectionName}, isTaskRequest: ${isTaskRequest}`);
        console.debug(`Raw filter:`, JSON.stringify(filter, null, 2));
      }

      // For task requests, use a simplified approach to get all tasks
      if (isTaskRequest) {
        if (process.env.QDRANT_DEBUG === 'true') {
          console.debug(`Using simplified task retrieval approach`);
        }
        try {
          // Create a simplified search request focused on tasks
          const searchRequest = {
            limit: limit || 1000,
            offset: offset || 0,
            with_payload: true,
            with_vector: false,
            filter: {
              must: [
                {
                  key: "type",
                  match: { value: "task" }
                }
              ]
            }
          };

          // Execute simplified search
          if (process.env.QDRANT_DEBUG === 'true') {
            console.debug(`Executing simplified task search:`, JSON.stringify(searchRequest, null, 2));
          }
          const response = await this.client.scroll(collectionName, searchRequest);
          if (process.env.QDRANT_DEBUG === 'true') {
            console.debug(`Simplified task search found ${response.points.length} points`);
          }

          // Map points to memory format with type safety
          return response.points.map(point => {
            const payload = point.payload as Record<string, any>;
            const memoryPoint: any = {
              id: String(point.id),
              vector: Array.isArray(point.vector) ? point.vector : [],
              payload: payload,
              metadata: payload.metadata || {},
              content: payload.content || '',
              createdAt: payload.createdAt || new Date().toISOString(),
              updatedAt: payload.updatedAt || new Date().toISOString(),
            };

            // Copy all other payload fields to the root level
            Object.entries(payload).forEach(([key, value]) => {
              if (!['metadata', 'content', 'createdAt', 'updatedAt'].includes(key)) {
                memoryPoint[key] = value;
              }
            });

            return memoryPoint as MemoryPoint<T>;
          });
        } catch (taskError) {
          console.error(`Simplified task search failed:`, taskError);
          // Fall through to standard approach if simplified approach fails
        }
      }

      // Check if collection exists
      const exists = await this.collectionExists(collectionName);
      if (!exists) {
        return [];
      }

      // Validate and simplify filter if provided
      let validatedFilter = undefined;
      if (filter) {
        try {
          validatedFilter = this.validateAndFixFilter(filter);
          if (process.env.QDRANT_DEBUG === 'true') {
            console.debug(`Validated filter:`, JSON.stringify(validatedFilter, null, 2));
          }
        } catch (filterError) {
          console.error(`Filter validation failed:`, filterError);
          // Continue with undefined filter
        }
      }

      // Create scroll request
      const scrollRequest: any = {
        limit: limit || 10,
        offset: offset || 0,
        with_payload: true,
        with_vector: true
      };

      // Add filter if provided and valid
      if (validatedFilter) {
        scrollRequest.filter = validatedFilter;
      }

      // Execute scroll request
      if (process.env.QDRANT_DEBUG === 'true') {
        console.debug(`Executing standard scroll with request:`, JSON.stringify(scrollRequest, null, 2));
      }
      const response = await this.client.scroll(collectionName, scrollRequest);
      if (process.env.QDRANT_DEBUG === 'true') {
        console.debug(`Standard scroll found ${response.points.length} points`);
      }

      // Map points to memory format with proper typing
      return response.points.map(point => {
        const payload = point.payload as Record<string, any>;

        // Create basic memory point structure with all required fields
        const memoryPoint: any = {
          id: String(point.id),
          vector: Array.isArray(point.vector) ? point.vector : [],
          payload: payload,
          metadata: payload.metadata || {},
          content: payload.content || '',
          createdAt: payload.createdAt || new Date().toISOString(),
          updatedAt: payload.updatedAt || new Date().toISOString(),
        };

        // Add all other payload fields as additional properties
        Object.entries(payload).forEach(([key, value]) => {
          if (!['metadata', 'content', 'createdAt', 'updatedAt'].includes(key)) {
            memoryPoint[key] = value;
          }
        });

        return memoryPoint as MemoryPoint<T>;
      });
    } catch (error) {
      console.error(`Error in scrollPoints for collection ${collectionName}:`, error);

      // Return empty results for now to prevent errors, but don't block the entire system
      console.warn(`Scroll operation failed for ${collectionName}, returning empty results`);
      return [];
    }
  }

  /**
   * Update a point
   */
  async updatePoint<T extends BaseMemorySchema>(
    collectionName: string,
    id: string,
    updates: Partial<MemoryPoint<T>>
  ): Promise<boolean> {
    if (!this.initialized) {
      console.log('Client not initialized in updatePoint, attempting to initialize...');
      try {
        await this.initialize();
      } catch (initError) {
        console.error('Failed to initialize client in updatePoint:', initError);
        // Continue with fallback storage instead of throwing
      }
    }

    // Use fallback storage if Qdrant is not available
    if (!this.useQdrant) {
      return this.fallbackStorage.updatePoint(collectionName, id, updates);
    }

    try {
      // Special handling for vector updates
      if (updates.vector) {
        // Get the current point
        const points = await this.getPoints(collectionName, [id]);

        if (points.length === 0) {
          return false;
        }

        const point = points[0];

        // Create merged point
        const updatedPoint = {
          ...point,
          ...updates,
          payload: {
            ...point.payload,
            ...(updates.payload || {})
          }
        };

        // Convert the payload to a standard record format for Qdrant
        // Using type assertion to handle the BaseMemorySchema conversion
        const recordPayload = { ...(updatedPoint.payload as unknown as Record<string, unknown>) };

        // Replace the point - convert ID to UUID for Qdrant
        const qdrantId = this.convertToQdrantId(id);
        await this.client.upsert(collectionName, {
          wait: true,
          points: [
            {
              id: qdrantId,
              vector: updatedPoint.vector,
              payload: recordPayload
            }
          ]
        });

        return true;
      }

      // If only updating payload
      if (updates.payload) {
        // Convert the payload to a standard record format for Qdrant
        // Using type assertion to handle the BaseMemorySchema conversion
        const recordPayload = { ...(updates.payload as unknown as Record<string, unknown>) };

        // Convert ID to UUID for Qdrant
        const qdrantId = this.convertToQdrantId(id);
        await this.client.setPayload(collectionName, {
          points: [qdrantId],
          payload: recordPayload
        });

        return true;
      }

      return false;
    } catch (error) {
      console.error(`Error updating point in ${collectionName}:`, error);

      // Fallback to in-memory storage
      return this.fallbackStorage.updatePoint(collectionName, id, updates);
    }
  }

  /**
   * Delete a point
   */
  async deletePoint(
    collectionName: string,
    id: string,
    options?: DeleteOptions
  ): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Perform hard or soft delete
    const hardDelete = options?.hardDelete ?? true;

    // For soft delete, update metadata
    if (!hardDelete) {
      // Create a properly typed update payload
      const updatePayload: Record<string, unknown> = {
        is_deleted: true,
        deletion_time: new Date().toISOString(),
        ...options?.metadata
      };

      const updateResult = await this.updatePoint(collectionName, id, {
        payload: updatePayload as any
      });

      return updateResult;
    }

    // Hard delete

    // Use fallback storage if Qdrant is not available
    if (!this.useQdrant) {
      return this.fallbackStorage.deletePoint(collectionName, id);
    }

    try {
      // Delete from Qdrant - convert ID to UUID
      const qdrantId = this.convertToQdrantId(id);
      await this.client.delete(collectionName, {
        points: [qdrantId],
        wait: true
      });

      return true;
    } catch (error) {
      console.error(`Error deleting point from ${collectionName}:`, error);

      // Fallback to in-memory storage
      return this.fallbackStorage.deletePoint(collectionName, id);
    }
  }

  /**
   * Add multiple points in a batch
   */
  async addPoints<T extends BaseMemorySchema>(
    collectionName: string,
    points: MemoryPoint<T>[]
  ): Promise<string[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Generate IDs for points that don't have them
    points = points.map(point => {
      if (!point.id) {
        point.id = uuidv4();
      }
      return point;
    });

    // Use fallback storage if Qdrant is not available
    if (!this.useQdrant) {
      return Promise.all(
        points.map(point => this.fallbackStorage.addPoint(collectionName, point.id, point))
      );
    }

    try {
      // Ensure collection exists
      if (!this.collections.has(collectionName)) {
        const exists = await this.collectionExists(collectionName);

        if (!exists) {
          console.log(`Collection ${collectionName} does not exist, creating it now...`);
          // Use the vector dimensions from the first point with a vector
          const pointWithVector = points.find(p => p.vector && p.vector.length > 0);
          const dimensions = pointWithVector?.vector?.length || DEFAULTS.DIMENSIONS;
          await this.createCollection(collectionName, dimensions);
        }
      }

      // Convert payload to standard record format and convert IDs to UUIDs
      const qdrantPoints = points.map(point => ({
        id: this.convertToQdrantId(point.id),
        vector: point.vector,
        payload: { ...(point.payload as unknown as Record<string, unknown>) }
      }));

      // Batch insert into Qdrant
      try {
        await this.client.upsert(collectionName, {
          wait: true,
          points: qdrantPoints
        });
      } catch (upsertError) {
        // Handle 404 Not Found errors by creating the collection and retrying
        if (
          upsertError instanceof Error &&
          (upsertError.message.includes('404') || upsertError.message.includes('Not Found'))
        ) {
          console.log(`Collection ${collectionName} not found during batch upsert, creating it now...`);
          // Use the vector dimensions from the first point with a vector
          const pointWithVector = points.find(p => p.vector && p.vector.length > 0);
          const dimensions = pointWithVector?.vector?.length || DEFAULTS.DIMENSIONS;
          const created = await this.createCollection(collectionName, dimensions);

          if (created) {
            // Retry the upsert now that we've created the collection
            await this.client.upsert(collectionName, {
              wait: true,
              points: qdrantPoints
            });
          } else {
            throw new Error(`Failed to create collection ${collectionName}`);
          }
        } else {
          // Rethrow other errors
          throw upsertError;
        }
      }

      // Return the IDs
      return points.map(point => point.id);
    } catch (error) {
      console.error(`Error adding points to ${collectionName}:`, error);

      // Fallback to in-memory storage
      return Promise.all(
        points.map(point => this.fallbackStorage.addPoint(collectionName, point.id, point))
      );
    }
  }

  /**
   * Get point count
   */
  async getPointCount(
    collectionName: string,
    filter?: any
  ): Promise<number> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Use fallback storage if Qdrant is not available
    if (!this.useQdrant) {
      return this.fallbackStorage.getPointCount(collectionName);
    }

    try {
      // Count points in Qdrant
      const qdrantFilter = filter ? this.buildQdrantFilter(filter) : undefined;
      const response = await this.client.count(collectionName, { exact: true, filter: qdrantFilter });
      return response.count;
    } catch (error) {
      console.error(`Error counting points in ${collectionName}:`, error);

      // Fallback to in-memory storage
      return this.fallbackStorage.getPointCount(collectionName);
    }
  }

  /**
   * Convert a filter to Qdrant format
   */
  private buildQdrantFilter(filter: any): any {
    // Check if filter is empty or undefined
    if (!filter || (typeof filter === 'object' && Object.keys(filter).length === 0)) {
      return undefined;
    }

    // Handle complex filters if provided
    if (filter.must || filter.should || filter.must_not) {
      // Already in Qdrant format
      return filter;
    }

    // Convert to Qdrant filter format with proper field conditions
    const conditions: any[] = [];

    // Process filter entries into Qdrant's expected format
    Object.entries(filter).forEach(([key, value]) => {
      if (value === undefined) return;

      // Skip $text filters as they are not compatible with Qdrant
      if (key === '$text') {
        console.debug('Skipping $text filter as it is not compatible with Qdrant:', value);
        return;
      }

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Handle nested objects like metadata
        if (key === 'metadata' || key.startsWith('metadata.')) {
          // Process each nested field
          Object.entries(value as Record<string, any>).forEach(([nestedKey, nestedValue]) => {
            const fullKey = key === 'metadata' ? `metadata.${nestedKey}` : `${key}.${nestedKey}`;

            // Handle different value types for nested fields
            if (Array.isArray(nestedValue)) {
              conditions.push({
                key: fullKey,
                match: { any: nestedValue }
              });
            } else if (typeof nestedValue === 'object' && nestedValue !== null) {
              // Handle range queries or operators
              if ('$gt' in nestedValue || '$gte' in nestedValue || '$lt' in nestedValue || '$lte' in nestedValue) {
                conditions.push({
                  key: fullKey,
                  range: nestedValue
                });
              } else {
                conditions.push({
                  key: fullKey,
                  match: { value: nestedValue }
                });
              }
            } else {
              // Simple match condition
              conditions.push({
                key: fullKey,
                match: { value: nestedValue }
              });
            }
          });
        } else {
          // Handle range conditions - convert to valid Qdrant format
          if ('$gt' in value || '$gte' in value || '$lt' in value || '$lte' in value) {
            const rangeCondition: any = {};
            if ('$gt' in value) rangeCondition.gt = (value as any).$gt;
            if ('$gte' in value) rangeCondition.gte = (value as any).$gte;
            if ('$lt' in value) rangeCondition.lt = (value as any).$lt;
            if ('$lte' in value) rangeCondition.lte = (value as any).$lte;

            conditions.push({
              key,
              range: rangeCondition
            });
          }
          // Handle match conditions - convert to valid Qdrant format
          else if ('$in' in value || '$nin' in value || '$eq' in value || '$ne' in value) {
            if ('$in' in value) {
              conditions.push({
                key,
                match: { any: (value as any).$in }
              });
            } else if ('$nin' in value) {
              conditions.push({
                must_not: [{
                  key,
                  match: { any: (value as any).$nin }
                }]
              });
            } else if ('$eq' in value) {
              conditions.push({
                key,
                match: { value: (value as any).$eq }
              });
            } else if ('$ne' in value) {
              conditions.push({
                must_not: [{
                  key,
                  match: { value: (value as any).$ne }
                }]
              });
            }
          }
          // Handle text conditions - convert to valid Qdrant format
          else if ('$contains' in value || '$startsWith' in value || '$endsWith' in value) {
            // For text conditions, use the actual text value for matching
            // Qdrant doesn't support $contains directly, so extract the value
            if ('$contains' in value) {
              conditions.push({
                key,
                match: { value: (value as any).$contains }
              });
            } else if ('$startsWith' in value) {
              // For startsWith, use the value directly (exact match fallback)
              conditions.push({
                key,
                match: { value: (value as any).$startsWith }
              });
            } else if ('$endsWith' in value) {
              // For endsWith, use the value directly (exact match fallback)  
              conditions.push({
                key,
                match: { value: (value as any).$endsWith }
              });
            }
          }
          // Default to passing through the object
          else {
            // For other object values, create a match with the value
            conditions.push({
              key,
              match: { value }
            });
          }
        }
      }
      // Handle array values
      else if (Array.isArray(value)) {
        conditions.push({
          key,
          match: { any: value }
        });
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
    return conditions.length > 0 ? { must: conditions } : undefined;
  }

  /**
   * Execute a search as a fallback for failed scroll operations
   * 
   * @param collectionName Collection to search
   * @param searchParams Search parameters
   * @returns Array of search results
   */
  private async executeSearchFallback<T extends BaseMemorySchema>(
    collectionName: string,
    searchParams: {
      filter?: any;
      limit: number;
      offset: number;
      with_payload: boolean;
      with_vector: boolean;
    }
  ): Promise<MemoryPoint<T>[]> {
    try {
      // Use scroll instead of search to avoid vector issues
      const scrollRequest: any = {
        limit: searchParams.limit,
        offset: searchParams.offset,
        with_payload: searchParams.with_payload,
        with_vector: searchParams.with_vector
      };

      // Only add filter if it's valid after validation
      if (searchParams.filter) {
        try {
          const validatedFilter = this.validateAndFixFilter(searchParams.filter);
          if (validatedFilter) {
            // For extra safety, check if it contains field conditions formatted correctly
            if (this.isFilterStructureValid(validatedFilter)) {
              scrollRequest.filter = validatedFilter;
            } else {
              console.warn(`Filter structure is invalid for collection ${collectionName}, omitting filter:`,
                JSON.stringify(validatedFilter));
            }
          }
        } catch (filterError) {
          console.warn(`Failed to validate filter for ${collectionName}, omitting filter:`, filterError);
        }
      }

      // Execute the scroll instead of search (avoids vector dimension issues)
      const response = await this.client.scroll(collectionName, scrollRequest);

      if (!response || !response.points || response.points.length === 0) {
        console.warn(`Search fallback returned no points for ${collectionName}`);
        return [];
      }

      // Transform scroll results (scroll returns { points: [...] } format)
      return response.points.map((result: any) => ({
        id: String(result.id),
        vector: [],
        payload: result.payload as T
      }));
    } catch (error) {
      console.warn(`Search fallback operation failed for ${collectionName}:`, error);
      throw error; // Re-throw for caller to handle
    }
  }

  /**
   * Check if filter structure contains valid field conditions
   */
  private isFilterStructureValid(filter: any): boolean {
    if (!filter) return false;

    // Check top-level structure
    if (typeof filter !== 'object') return false;

    // Check if any clause exists
    const hasClause = filter.must || filter.should || filter.must_not;
    if (!hasClause) return false;

    // Validate clauses
    const validateClause = (clause: any[]): boolean => {
      if (!Array.isArray(clause) || clause.length === 0) return false;

      // Check each condition in the clause
      for (const condition of clause) {
        if (!this.isValidCondition(condition)) {
          return false;
        }
      }

      return true;
    };

    // Check all present clauses
    if (filter.must && !validateClause(filter.must)) return false;
    if (filter.should && !validateClause(filter.should)) return false;
    if (filter.must_not && !validateClause(filter.must_not)) return false;

    return true;
  }

  /**
   * Validate and fix a filter to ensure it's valid for Qdrant
   * 
   * @param filter The filter to validate
   * @returns A valid filter or undefined if invalid
   */
  private validateAndFixFilter(filter: any): any {
    // Handle null/undefined case
    if (filter === null || filter === undefined) {
      return undefined;
    }

    // Handle empty object case
    if (typeof filter === 'object' && Object.keys(filter).length === 0) {
      return undefined;
    }

    // Handle already valid Qdrant filter format
    if (filter.must || filter.should || filter.must_not) {
      // For each condition array, ensure it's valid
      if (filter.must && (!Array.isArray(filter.must) || filter.must.length === 0)) {
        delete filter.must;
      }

      if (filter.should && (!Array.isArray(filter.should) || filter.should.length === 0)) {
        delete filter.should;
      }

      if (filter.must_not && (!Array.isArray(filter.must_not) || filter.must_not.length === 0)) {
        delete filter.must_not;
      }

      // If no valid conditions remain, return undefined
      if (!filter.must && !filter.should && !filter.must_not) {
        return undefined;
      }

      // Validate each condition in arrays is properly formatted
      ['must', 'should', 'must_not'].forEach(clause => {
        if (filter[clause] && Array.isArray(filter[clause])) {
          // Make a copy to avoid modification while iterating
          const conditions = [...filter[clause]];
          filter[clause] = [];

          for (const condition of conditions) {
            // Check if condition has correct structure
            if (this.isValidCondition(condition)) {
              filter[clause].push(condition);
            } else if (typeof condition === 'object') {
              // Try to convert to proper format
              const fixedCondition = this.convertToProperCondition(condition);
              if (fixedCondition) {
                filter[clause].push(fixedCondition);
              }
            }
          }

          // If clause is now empty, remove it
          if (filter[clause].length === 0) {
            delete filter[clause];
          }
        }
      });

      return filter;
    }

    // Otherwise, use buildQdrantFilter to convert to proper format
    return filter;
  }

  /**
   * Check if a condition object has valid Qdrant structure
   */
  private isValidCondition(condition: any): boolean {
    // Check for standard field condition format
    if (condition.key && (condition.match || condition.range || condition.geo || condition.values_count)) {
      return true;
    }

    // Check for has_id condition
    if (condition.has_id && Array.isArray(condition.has_id)) {
      return true;
    }

    // Check for other special conditions
    if ('has_vector' in condition || 'is_empty' in condition || 'is_null' in condition) {
      return true;
    }

    return false;
  }

  /**
   * Try to convert an invalid condition to a valid one
   */
  private convertToProperCondition(condition: any): any | null {
    try {
      // Handle nested object with field conditions
      const keys = Object.keys(condition);
      if (keys.length === 1) {
        const key = keys[0];
        const value = condition[key];

        if (typeof value === 'object' && !Array.isArray(value)) {
          // This might be a field with complex condition
          return {
            key,
            match: { value }
          };
        } else if (Array.isArray(value)) {
          return {
            key,
            match: { any: value }
          };
        } else {
          return {
            key,
            match: { value }
          };
        }
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Extract detailed error information from an error object
   */
  private extractErrorDetails(error: any): any {
    if (!error) return 'No error details';

    try {
      // Extract data property which often contains API error details
      if (error.data) {
        return error.data;
      }

      // Extract response data if available
      if (error.response && error.response.data) {
        return error.response.data;
      }

      // Check for specific Qdrant error format
      if (error.message && typeof error.message === 'string') {
        try {
          // Sometimes error messages contain JSON
          if (error.message.includes('{') && error.message.includes('}')) {
            const jsonStart = error.message.indexOf('{');
            const jsonEnd = error.message.lastIndexOf('}') + 1;
            const jsonStr = error.message.substring(jsonStart, jsonEnd);
            return JSON.parse(jsonStr);
          }
        } catch (parseError) {
          // Ignore JSON parsing errors
        }
      }

      // Return as much information as possible
      return {
        message: error.message || 'Unknown error',
        name: error.name,
        stack: error.stack ? error.stack.split('\n').slice(0, 3).join('\n') : undefined
      };
    } catch (e) {
      return 'Error extracting details: ' + (e instanceof Error ? e.message : String(e));
    }
  }

  /**
   * Direct method to get tasks by status
   * Optimized method to retrieve tasks from a collection
   */
  async getTasksByStatus(
    collectionName: string,
    statuses: string[] = ['pending', 'scheduled', 'in_progress']
  ): Promise<any[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!collectionName) {
      throw new Error('Collection name is required');
    }

    console.log(`Direct task query on collection ${collectionName} for statuses: ${statuses.join(', ')}`);

    try {
      // Check if collection exists
      const exists = await this.collectionExists(collectionName);
      if (!exists) {
        console.log(`Collection ${collectionName} does not exist, returning empty task list`);
        return [];
      }

      // Try two different approaches to find tasks
      // Build a direct filter in Qdrant format
      // This simplifies filter construction by using the exact format Qdrant expects
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

      // Use the Qdrant client directly with the proper filter format
      const response = await this.client.scroll(collectionName, {
        filter,
        limit: 1000,
        with_payload: true,
        with_vector: false
      });

      console.log(`Found ${response.points.length} task points in ${collectionName}`);

      // Convert points to the expected format
      return response.points.map(point => {
        const payload = point.payload as Record<string, any>;

        // Construct a standardized task object
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
    } catch (error) {
      console.error(`Error in getTasksByStatus for ${collectionName}:`, error);
      return [];
    }
  }
} 