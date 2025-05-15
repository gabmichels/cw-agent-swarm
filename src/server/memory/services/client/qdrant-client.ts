/**
 * Qdrant memory client implementation
 */
import { QdrantClient } from '@qdrant/js-client-rest';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULTS, MemoryErrorCode } from '../../config';
import { BaseMemorySchema, MemoryPoint, MemorySearchResult } from '../../models';
import { handleMemoryError } from '../../utils';
import { ClientStatus, DeleteOptions, IMemoryClient, MemoryClientOptions, SearchQuery } from './types';
import { EmbeddingService } from './embedding-service';

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
      
      // Insert point into Qdrant
      try {
        await this.client.upsert(collectionName, {
          wait: true,
          points: [
            {
              id: point.id,
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
                  id: point.id,
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
      
      // Get points from Qdrant using retrieve method
      try {
        const response = await this.client.retrieve(collectionName, {
          ids,
          with_payload: true,
          with_vector: true
        });
        
        // Transform response to MemoryPoint objects
        return response.map(point => {
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
            id: String(point.id),
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
      await this.initialize();
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
        const embeddingResult = await this.embeddingService.getEmbedding(query.query);
        vector = embeddingResult.embedding;
      }
      
      // Search with vector - ensure vector is always defined before calling search
      if (!vector) {
        // Create a proper dummy vector with the right dimensionality
        vector = new Array(DEFAULTS.DIMENSIONS).fill(0).map(() => Math.random() * 0.01);
        console.log(`Using dummy vector with ${vector.length} dimensions for search`);
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
      
      // Fallback to in-memory search
      const searchResults = this.fallbackStorage.searchPoints(
        collectionName,
        query.query || '',
        query.limit || DEFAULTS.DEFAULT_LIMIT
      );
      
      return searchResults.map(point => ({
        id: point.id,
        score: 1.0,
        payload: point.payload
      }));
    }
  }
  
  /**
   * Scroll through points
   */
  async scrollPoints<T extends BaseMemorySchema>(
    collectionName: string,
    filter?: any,
    limit?: number,
    offset?: number
  ): Promise<MemoryPoint<T>[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Check if the collection exists first
    try {
      const collectionExists = await this.collectionExists(collectionName);
      if (!collectionExists) {
        console.warn(`Collection ${collectionName} does not exist. Returning empty results for scroll operation.`);
        return [];
      }
    } catch (checkError) {
      console.warn(`Error checking if collection ${collectionName} exists:`, checkError);
      // Continue with the scroll attempt, as the collection might still be accessible
    }
    
    // Use fallback storage if Qdrant is not available
    if (!this.useQdrant) {
      const points = this.fallbackStorage.searchPoints(
        collectionName,
        '',
        limit || DEFAULTS.DEFAULT_LIMIT
      );
      
      return points;
    }
    
    try {
      // Create scroll parameters
      const scrollParams: any = {
        limit: limit || DEFAULTS.DEFAULT_LIMIT,
        offset: offset || 0,
        with_payload: true,
        with_vector: false
      };
      
      // Add filter if provided
      if (filter) {
        scrollParams.filter = this.buildQdrantFilter(filter);
      }
      
      // Add sorting by timestamp if available
      scrollParams.order_by = {
        key: 'timestamp',
        direction: 'desc'
      };
      
      // Get points
      try {
        const response = await this.client.scroll(collectionName, scrollParams);
        
        if (!response || !response.points) {
          return [];
        }
        
        // Transform to MemoryPoint objects
        return response.points.map(point => {
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
            id: String(point.id),
            vector,
            payload: point.payload as T
          };
        });
      } catch (scrollError) {
        // Handle 400 Bad Request errors, which can happen if the collection was recreated
        // without proper indices (like timestamp) needed for scrolling
        if (
          scrollError instanceof Error && 
          (scrollError.message.includes('400') || scrollError.message.includes('Bad Request'))
        ) {
          console.warn(`Bad request error during scroll on ${collectionName}. The collection might be new or missing indices. Trying alternative method...`);
          
          // Try to get points without sorting or scrolling
          try {
            // Use search with no vector instead of scroll
            const searchResponse = await this.client.search(collectionName, {
              vector: new Array(DEFAULTS.DIMENSIONS).fill(0), // Add dummy vector to satisfy type requirements
              limit: limit || DEFAULTS.DEFAULT_LIMIT,
              offset: offset || 0,
              filter: filter ? this.buildQdrantFilter(filter) : undefined,
              with_payload: true,
              with_vector: false
            });
            
            return searchResponse.map(result => ({
              id: String(result.id),
              // Empty vector since we didn't request it
              vector: [],
              payload: result.payload as T
            }));
          } catch (searchError) {
            console.warn(`Alternative method also failed for ${collectionName}:`, searchError);
            return [];
          }
        }
        
        // Handle 404 Not Found errors by returning empty array
        if (
          scrollError instanceof Error && 
          (scrollError.message.includes('404') || scrollError.message.includes('Not Found'))
        ) {
          console.warn(`Collection ${collectionName} not found during scroll. Returning empty results.`);
          return [];
        }
        
        // Rethrow other errors
        throw scrollError;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check if this is a "collection not found" error
      if (
        errorMessage.includes('not found') || 
        errorMessage.includes('404') || 
        errorMessage.includes('does not exist')
      ) {
        console.warn(`Collection ${collectionName} not found during scroll. Returning empty results.`);
        return [];
      }
      
      console.error(`Error scrolling in ${collectionName}:`, error);
      
      // Fallback to in-memory storage
      const points = this.fallbackStorage.searchPoints(
        collectionName,
        '',
        limit || DEFAULTS.DEFAULT_LIMIT
      );
      
      return points;
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
      await this.initialize();
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
        
        // Replace the point
        await this.client.upsert(collectionName, {
          wait: true,
          points: [
            {
              id,
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
        
        await this.client.setPayload(collectionName, {
          points: [id],
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
      // Delete from Qdrant
      await this.client.delete(collectionName, {
        points: [id],
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
      
      // Convert payload to standard record format
      const qdrantPoints = points.map(point => ({
          id: point.id,
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
    // Handle complex filters if provided
    if (filter.must || filter.should || filter.must_not) {
      // Already in Qdrant format
      return filter;
    }
    
    // Convert to Qdrant filter format
    const conditions = Object.entries(filter)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => {
        // Special handling for metadata fields
        if (key !== 'id' && key !== 'type' && !key.startsWith('metadata.')) {
          key = `metadata.${key}`;
        }
        
        // Handle different value types
        if (Array.isArray(value)) {
          return {
            key,
            match: { any: value }
          };
        } else if (typeof value === 'object' && value !== null) {
          // Range queries or custom operators
          return {
            key,
            range: value
          };
        } else {
          // Simple equality
          return {
            key,
            match: { value }
          };
        }
      });
    
    return conditions.length > 0 ? { must: conditions } : undefined;
  }
} 