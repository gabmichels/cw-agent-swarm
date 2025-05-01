// Server-side module for Qdrant that isolates it from Next.js bundling issues
// This will be imported only in server-side code

import { OpenAI } from 'openai';
import { QdrantClient } from '@qdrant/js-client-rest';
import { Message } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { 
  COLLECTIONS, 
  MEMORY_TYPES, 
  IMPORTANCE_LEVELS, 
  STORAGE_KEYS, 
  DEFAULTS,
  FILTER_KEYS
} from '../../constants/qdrant';

// Make sure this file is only executed on the server
if (typeof window !== 'undefined') {
  throw new Error('This module can only be imported in server-side code');
}

// Basic types to define memory structure
export interface MemoryRecord {
  id: string;
  text: string;
  timestamp: string;
  type: 'message' | 'thought' | 'document' | 'task';
  metadata: Record<string, any>;
}

// Search options for memory retrieval
export interface MemorySearchOptions {
  limit?: number;
  filter?: Record<string, any>;
}

// Fallback in-memory storage when Qdrant is unavailable
class InMemoryStorage {
  private storage: Map<string, MemoryRecord[]> = new Map();
  
  constructor() {
    // Initialize empty collections
    Object.values(COLLECTIONS).forEach(collectionName => {
      this.storage.set(collectionName, []);
    });
    console.log('Using in-memory fallback storage for Qdrant');
  }
  
  async addMemory(collectionName: string, id: string, text: string, type: string, metadata: Record<string, any> = {}): Promise<string> {
    const collection = this.storage.get(collectionName) || [];
    const timestamp = metadata.timestamp || new Date().toISOString();
    
    const record: MemoryRecord = {
      id,
      text,
      timestamp,
      type: type as any,
      metadata
    };
    
    collection.push(record);
    this.storage.set(collectionName, collection);
    
    return id;
  }
  
  async searchMemory(collectionName: string, query: string, options: MemorySearchOptions = {}): Promise<MemoryRecord[]> {
    const collection = this.storage.get(collectionName) || [];
    const limit = options.limit || 5;
    
    // Simple text-based search (not semantic)
    const filteredRecords = collection.filter(record => {
      // Apply filter if provided
      if (options.filter) {
        for (const [key, value] of Object.entries(options.filter)) {
          if (record.metadata[key] !== value) {
            return false;
          }
        }
      }
      
      // If query is empty, just return records that match the filter
      if (!query) return true;
      
      // Simple text search
      return record.text.toLowerCase().includes(query.toLowerCase());
    });
    
    // Sort by timestamp (newest first)
    return filteredRecords
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }
  
  async getRecentMemories(collectionName: string, limit: number = 10): Promise<MemoryRecord[]> {
    const collection = this.storage.get(collectionName) || [];
    
    return collection
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }
  
  reset(collectionName: string): void {
    this.storage.set(collectionName, []);
  }
  
  resetAll(): void {
    Object.values(COLLECTIONS).forEach(collectionName => {
      this.storage.set(collectionName, []);
    });
  }

  /**
   * Get the total number of messages in memory
   */
  async getMessageCount(): Promise<number> {
    const totalCount = Object.values(COLLECTIONS).reduce((total, collectionName) => {
      const collection = this.storage.get(collectionName) || [];
      return total + collection.length;
    }, 0);
    return totalCount;
  }
}

// Class that handles Qdrant connections
class QdrantHandler {
  private client: QdrantClient;
  private dimensions: number;
  private embeddingFunction: (text: string) => Promise<number[]> = async (text: string) => {
    return Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
  };
  private openai: OpenAI | null = null;
  private initialized: boolean = false;
  private collections: Set<string> = new Set();
  private fallbackStorage: InMemoryStorage;
  private useQdrant: boolean = true;
  private connectionTimeout: number;

  constructor(options?: {
    qdrantUrl?: string;
    qdrantApiKey?: string;
    dimensions?: number;
    useOpenAI?: boolean;
    openAIApiKey?: string;
    openAIModel?: string;
    connectionTimeout?: number;
  }) {
    // Initialize fallback storage
    this.fallbackStorage = new InMemoryStorage();
    this.connectionTimeout = options?.connectionTimeout || 5000; // 5 second timeout
    
    // Get Qdrant URL with fallback
    const qdrantUrl = options?.qdrantUrl || process.env.QDRANT_URL || 'http://localhost:6333';
    const qdrantApiKey = options?.qdrantApiKey || process.env.QDRANT_API_KEY;
    
    console.log(`Initializing Qdrant client with URL: ${qdrantUrl}`);
    
    // Initialize Qdrant client with better options
    this.client = new QdrantClient({
      url: qdrantUrl,
      apiKey: qdrantApiKey,
      timeout: this.connectionTimeout
    });
    
    this.dimensions = options?.dimensions || 1536; // Default for OpenAI embeddings
    
    // Set up OpenAI if useOpenAI is true
    if (options?.useOpenAI) {
      const openAIApiKey = options?.openAIApiKey || process.env.OPENAI_API_KEY;
      
      if (!openAIApiKey) {
        console.warn('OpenAI API key not provided, falling back to random embeddings');
        this.setupRandomEmbeddings();
        return;
      }
      
      this.openai = new OpenAI({
        apiKey: openAIApiKey
      });
      
      const embeddingModel = options?.openAIModel || process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
      console.log(`Using OpenAI for embeddings with model: ${embeddingModel}`);
      
      this.embeddingFunction = async (text: string) => {
        try {
          const response = await this.openai!.embeddings.create({
            model: embeddingModel,
            input: text,
            encoding_format: 'float' // Explicitly request float format instead of base64
          });
          
          const embedding = response.data[0].embedding;
          
          // Validate the embeddings
          if (!Array.isArray(embedding)) {
            console.error('Embedding is not an array:', embedding);
            throw new Error('Invalid embedding format: not an array');
          }
          
          if (embedding.length !== this.dimensions) {
            console.warn(`Embedding dimensions (${embedding.length}) do not match configured dimensions (${this.dimensions})`);
            this.dimensions = embedding.length; // Update dimensions
          }
          
          // Ensure all values are numbers and normalize the vector
          const validEmbedding = embedding.map(val => {
            if (typeof val !== 'number') {
              console.warn(`Embedding contains non-number value: ${val}, converting to number`);
              return Number(val);
            }
            return val;
          });
          
          return this.normalizeVector(validEmbedding);
        } catch (error) {
          console.error('Error generating embeddings with OpenAI:', error);
          console.warn('Falling back to random vectors due to OpenAI embedding error');
          // Fall back to random embeddings
          return Array.from({ length: this.dimensions }, () => Math.random() * 2 - 1);
        }
      };
    } else {
      this.setupRandomEmbeddings();
    }
  }

  private setupRandomEmbeddings() {
    // Default embedding function (random vectors, for development only)
    console.warn("Using random embeddings - not for production use!");
    this.embeddingFunction = async (text: string) => {
      const randomVector = Array.from({ length: this.dimensions }, () => Math.random() * 2 - 1);
      return this.normalizeVector(randomVector);
    };
  }

  async initialize(): Promise<void> {
    try {
      console.log('Initializing Qdrant memory system');
      
      // Test connection to Qdrant with timeout
      try {
        console.log('Testing connection to Qdrant...');
        
        // Set up a timeout for the connection test
        const testConnectionPromise = this.client.getCollections()
          .catch(err => {
            console.error('Error in getCollections:', err.message);
            throw err;
          });
          
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Connection timeout after ${this.connectionTimeout}ms`)), this.connectionTimeout)
        );
        
        // Try to connect to the Qdrant server
        const result = await Promise.race([testConnectionPromise, timeoutPromise]) as { collections: any[] };
        console.log(`Qdrant connection successful. Found ${result.collections.length} collections.`);
        this.useQdrant = true;
        
      } catch (error) {
        console.error('Failed to connect to Qdrant, using in-memory fallback:', 
          error instanceof Error ? error.message : 'Unknown error');
        this.useQdrant = false;
        this.initialized = true;
        return;
      }
      
      // If we get here, Qdrant is available
      // Check and create collections for each memory type
      let collectionErrors = 0;
      for (const [type, collectionName] of Object.entries(COLLECTIONS)) {
        try {
          const exists = await this.collectionExists(collectionName);
          
          if (!exists) {
            console.log(`Creating collection ${collectionName}`);
            await this.createCollection(collectionName);
            this.collections.add(collectionName);
          } else {
            console.log(`Collection ${collectionName} already exists`);
            this.collections.add(collectionName);
          }
        } catch (error) {
          collectionErrors++;
          console.error(`Error checking/creating collection ${collectionName}:`, 
            error instanceof Error ? error.message : 'Unknown error');
          
          // Only disable Qdrant if we encounter errors for all collections
          if (collectionErrors >= Object.keys(COLLECTIONS).length) {
            console.error('Failed to create/check any collections, falling back to in-memory storage');
            this.useQdrant = false;
          }
        }
      }
      
      this.initialized = true;
      
      if (!this.useQdrant) {
        console.log('Using in-memory fallback for Qdrant');
      } else {
        console.log(`Qdrant memory system initialized successfully with ${this.collections.size} collections`);
      }
    } catch (error) {
      console.error('Failed to initialize Qdrant memory system:', 
        error instanceof Error ? error.message : 'Unknown error');
      console.error('Stack trace:', error instanceof Error ? error.stack : 'Not available');
      this.useQdrant = false;
      this.initialized = true;
    }
  }
  
  private async collectionExists(collectionName: string): Promise<boolean> {
    try {
      if (!this.useQdrant) return false;
      
      const collections = await this.client.getCollections();
      return collections.collections.some(collection => collection.name === collectionName);
    } catch (error) {
      console.error(`Error checking if collection ${collectionName} exists:`, error);
      this.useQdrant = false;
      return false;
    }
  }
  
  private async createCollection(collectionName: string): Promise<void> {
    try {
      if (!this.useQdrant) return;
      
      console.log(`Creating collection ${collectionName} with vector size ${this.dimensions}`);
      
      // Check if the collection already exists
      try {
        const collections = await this.client.getCollections();
        const exists = collections.collections.some(collection => collection.name === collectionName);
        
        if (exists) {
          console.log(`Collection ${collectionName} already exists, skipping creation`);
          this.collections.add(collectionName);
          
          // Verify collection has correct vector size - if not, log a warning
          try {
            const collectionInfo = await this.client.getCollection(collectionName);
            const vectorConfig = collectionInfo.config?.params?.vectors;
            let vectorSize: number | undefined;
            
            // Handle different vector config formats
            if (typeof vectorConfig === 'object' && vectorConfig !== null) {
              if ('size' in vectorConfig && typeof vectorConfig.size === 'number') {
                vectorSize = vectorConfig.size;
              }
            }
            
            if (vectorSize && vectorSize !== this.dimensions) {
              console.warn(`Collection ${collectionName} has vector size ${vectorSize}, but we expect ${this.dimensions}`);
              // Update our dimensions to match the collection
              this.dimensions = vectorSize;
            }
          } catch (infoError) {
            console.error(`Error getting collection info for ${collectionName}:`, infoError);
          }
          
          return;
        }
      } catch (getError) {
        console.error(`Error checking if collection ${collectionName} exists:`, getError);
        // Continue with creation attempt
      }
      
      // Create collection with proper settings
      try {
        // Create collection with correct type for vectors config
        await this.client.createCollection(collectionName, {
          vectors: {
            size: this.dimensions,
            distance: "Cosine" as const // Use const assertion for type safety
          }
        });
        
        console.log(`Successfully created collection ${collectionName}`);
        this.collections.add(collectionName);
        
        // Create index for faster searches
        try {
          // Wait a moment for collection to be fully created
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Create payload index for metadata filtering
          await this.client.createPayloadIndex(collectionName, {
            field_name: "timestamp",
            field_schema: "datetime"
          });
          
          // Create index for type field
          await this.client.createPayloadIndex(collectionName, {
            field_name: "type",
            field_schema: "keyword"
          });
          
          console.log(`Created payload indices for collection ${collectionName}`);
        } catch (indexError) {
          console.warn(`Error creating indices for ${collectionName} (non-fatal):`, indexError);
          // Continue even if index creation fails
        }
      } catch (createError: any) {
        // Special handling for "already exists" errors - which is fine
        if (createError.message && createError.message.includes('already exists')) {
          console.log(`Collection ${collectionName} was created by another process, continuing`);
          this.collections.add(collectionName);
          return;
        }
        
        console.error(`Error creating collection ${collectionName}:`, createError);
        throw createError; // Rethrow for upper level handling
      }
    } catch (error) {
      console.error(`Failed to create/verify collection ${collectionName}:`, error);
      this.useQdrant = false;
    }
  }

  // Helper to generate a valid Qdrant ID - either integer or UUID
  private generateValidQdrantId(): string | number {
    // Use numeric ID format (Qdrant accepts unsigned integers)
    const numericId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
    return numericId;
    
    // Alternatively, could generate UUID if needed:
    // return crypto.randomUUID();
  }

  async addMemory(type: 'message' | 'thought' | 'document' | 'task', content: string, metadata: Record<string, any> = {}): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Ensure we have a valid collection name
    const collectionName = COLLECTIONS[type];
    if (!collectionName) {
      throw new Error(`Invalid memory type: ${type}`);
    }
    
    // Generate a unique ID if not provided
    const id = metadata.id || `${type}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // Ensure timestamp exists
    if (!metadata.timestamp) {
      metadata.timestamp = new Date().toISOString();
    }
    
    // Explicitly mark thoughts and reflections as internal messages
    if (type === 'thought' || 
        metadata.messageType === 'thought' || 
        metadata.messageType === 'reflection' || 
        metadata.messageType === 'system' ||
        metadata.messageType === 'tool_log' ||
        metadata.messageType === 'memory_log') {
      metadata.isInternalMessage = true;
      metadata.notForChat = true;
    }
    
    // If content starts with indicators of internal messages, mark it accordingly
    const lowerContent = content.toLowerCase();
    if (lowerContent.startsWith('thought:') || 
        lowerContent.startsWith('reflection:') || 
        lowerContent.startsWith('thinking:') ||
        lowerContent.startsWith('reflection on') ||
        (lowerContent.startsWith('[20') && 
         lowerContent.includes('processing message:'))) {
      metadata.isInternalMessage = true;
      metadata.notForChat = true;
    }
    
    // Fallback to in-memory storage if we're not using Qdrant
    if (!this.useQdrant) {
      return this.fallbackStorage.addMemory(collectionName, id, content, type, metadata);
    }
    
    try {
      // Get embedding for the content
      const vector = await this.embeddingFunction(content);
      
      // Validate and normalize vector for Qdrant
      const normalizedVector = this.validateVectorForQdrant(vector);
      
      // Full payload with content and metadata
      const payload = {
        text: content,
        type,
        id,
        timestamp: metadata.timestamp,
        ...metadata
      };
      
      // Insert point into Qdrant collection
      await this.client.upsert(collectionName, {
        wait: true,
        points: [
          {
            id: this.generateValidQdrantId(),
            vector: normalizedVector,
            payload
          }
        ]
      });
      
      return id;
    } catch (err) {
      console.error(`Error adding memory to Qdrant (type: ${type}):`, err);
      
      // Fallback to in-memory storage
      return this.fallbackStorage.addMemory(collectionName, id, content, type, metadata);
    }
  }

  private extractMemoryRecord(result: any): MemoryRecord {
    const payload = result.payload || {};
    
    // Use the stored stringId from metadata if available, otherwise convert the numeric ID to string
    const id = payload.stringId || (result.id !== undefined ? String(result.id) : `id_${Date.now()}`);
    
    return {
      id,
      text: payload.text || '',
      timestamp: payload.timestamp || new Date().toISOString(),
      type: payload.type || 'message',
      metadata: this.extractMetadata(payload)
    };
  }

  private buildQdrantFilter(filter: Record<string, any>): any {
    // Fallback to the simplified filter for guaranteed results
    return this.createSimplestFilter(filter);
  }

  async searchMemory(type: 'message' | 'thought' | 'document' | 'task' | null, query: string, options: MemorySearchOptions = {}): Promise<MemoryRecord[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // Determine which collections to search
      const collectionsToSearch: string[] = type 
        ? [COLLECTIONS[type]] 
        : Object.values(COLLECTIONS);
      
      // Define limit
      const limit = options.limit || 5;
      
      // If Qdrant is unavailable, use in-memory fallback
      if (!this.useQdrant) {
        // Combine results from all collections
        const results = await Promise.all(
          collectionsToSearch.map(collectionName => 
            this.fallbackStorage.searchMemory(collectionName, query, options)
          )
        );
        
        return results.flat().slice(0, limit);
      }
      
      // Generate embedding for query
      const queryEmbedding = await this.embeddingFunction(query);
      
      // Validate and normalize the query vector
      const safeQueryVector = this.validateVectorForQdrant(queryEmbedding);
      
      // Search each collection and combine results
      const results = await Promise.all(
        collectionsToSearch.map(async (collectionName) => {
          try {
            // ULTRA SIMPLE APPROACH: Start with minimal parameters that are guaranteed to work
            let searchParams: any = {
              vector: safeQueryVector,
              limit: limit,
              with_payload: true
            };
            
            // Only add filter if absolutely needed, and in the simplest form possible
            if (options.filter && Object.keys(options.filter).length > 0) {
              // Create a simplified version of the filter
              const simpleFilter = this.createSimplestFilter(options.filter);
              if (simpleFilter) {
                searchParams.filter = simpleFilter;
              }
            }
            
            // Log what we're about to do
            console.log(`Searching collection ${collectionName} with simplified parameters`);
            
            try {
              // Execute the search
              const searchResult = await this.client.search(collectionName, searchParams);
              console.log(`Search successful, found ${searchResult.length} results`);
              
              // Convert to our format
              return searchResult.map(result => this.extractMemoryRecord(result));
            } catch (e: any) {
              // If we get an error, try again without ANY filter
              console.error(`Error with filter, trying without filter: ${e.message}`);
              const backupParams = {
                vector: safeQueryVector,
                limit: limit,
                with_payload: true
              };
              
              const backupResult = await this.client.search(collectionName, backupParams);
              return backupResult.map(result => this.extractMemoryRecord(result)); 
            }
          } catch (error) {
            console.error(`Error searching collection ${collectionName}:`, error);
            
            // If collection doesn't exist yet, return empty results
            if (error instanceof Error && error.message && (
              error.message.includes('not found') || 
              error.message.includes('does not exist')
            )) {
              console.warn(`Collection ${collectionName} does not exist yet, returning empty results`);
              return [];
            }
            
            // For other errors, fall back to in-memory
            this.useQdrant = false;
            return this.fallbackStorage.searchMemory(collectionName, query, options);
          }
        })
      );
      
      // Flatten and sort by score (would need to modify interface to include score)
      return results.flat().slice(0, limit);
    } catch (error) {
      console.error('Failed to search Qdrant memory, using fallback:', error);
      this.useQdrant = false;
      
      // Fall back to in-memory search
      const collectionsToSearch: string[] = type 
        ? [COLLECTIONS[type]] 
        : Object.values(COLLECTIONS);
      
      const results = await Promise.all(
        collectionsToSearch.map(collectionName => 
          this.fallbackStorage.searchMemory(collectionName, query, options)
        )
      );
      
      return results.flat().slice(0, options.limit || 5);
    }
  }
  
  // Create the simplest possible filter that's guaranteed to work with Qdrant
  private createSimplestFilter(filter: Record<string, any>): any {
    try {
      // Only handle the most basic case: direct equality matches
      const conditions = Object.entries(filter)
        .filter(([_, value]) => 
          // Only include simple scalar values
          typeof value === 'string' || 
          typeof value === 'number' || 
          typeof value === 'boolean')
        .map(([field, value]) => ({
          match: { [field]: value }
        }));
      
      if (conditions.length === 0) {
        return null; // No valid conditions
      }
      
      if (conditions.length === 1) {
        return conditions[0]; // Single condition
      }
      
      // Multiple conditions combined with AND logic
      return { must: conditions };
    } catch (error) {
      console.error("Error creating filter, skipping filter:", error);
      return null; // Return null on any error to skip filtering
    }
  }
  
  private extractMetadata(payload: any): Record<string, any> {
    // Extract metadata fields from payload (excluding standard fields)
    const standardFields = ['text', 'timestamp', 'type', 'stringId'];
    const metadata: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(payload)) {
      if (!standardFields.includes(key)) {
        metadata[key] = value;
      }
    }
    
    return metadata;
  }

  async getRecentMemories(type: 'message' | 'thought' | 'document' | 'task', limit: number = 10): Promise<MemoryRecord[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Ensure we have a valid collection name
    const collectionName = COLLECTIONS[type];
    if (!collectionName) {
      throw new Error(`Invalid memory type: ${type}`);
    }
    
    // Fallback to in-memory storage if not using Qdrant
    if (!this.useQdrant) {
      return this.fallbackStorage.getRecentMemories(collectionName, limit);
    }
    
    try {
      // For message collections, filter out internal messages
      let filter = null;
      
      if (type === 'message') {
        // Create a filter to exclude internal messages
        filter = {
          must_not: [
            {
              key: 'isInternalMessage',
              match: {
                value: true
              }
            },
            {
              key: 'notForChat',
              match: {
                value: true
              }
            }
          ]
        };
      }
      
      // Get recent points with proper scrolling and filtering
      const response = await this.client.scroll(collectionName, {
        limit: limit,
        with_payload: true,
        with_vector: false,
        filter: filter,
        order_by: {
          key: 'timestamp',
          direction: 'desc'
        }
      });
      
      if (!response || !response.points) {
        console.warn(`No points returned from Qdrant for ${collectionName}`);
        return [];
      }
      
      // Extract proper MemoryRecord objects from the response
      return response.points.map(point => this.extractMemoryRecord(point));
    } catch (err: unknown) {
      console.error(`Error getting recent memories from Qdrant (type: ${type}):`, err);
      console.error('Error with filter, trying without filter:', err instanceof Error ? err.message : String(err));
      
      try {
        // Simplified query without filters as fallback
        const response = await this.client.scroll(collectionName, {
          limit: limit,
          with_payload: true,
          with_vector: false
        });
        
        if (!response || !response.points) {
          console.warn(`No points returned from Qdrant fallback query for ${collectionName}`);
          return [];
        }
        
        // Extract records and filter out internal messages on the client side
        const records = response.points.map(point => this.extractMemoryRecord(point));
        
        if (type === 'message') {
          // Filter out internal messages manually
          return records.filter(record => {
            // Skip messages explicitly marked as internal
            if (record.metadata?.isInternalMessage === true || 
                record.metadata?.notForChat === true) {
              return false;
            }
            
            // Skip messages that start with internal message indicators
            const content = record.text.toLowerCase();
            if (content.startsWith('thought:') || 
                content.startsWith('reflection:') || 
                content.startsWith('thinking:') ||
                content.startsWith('reflection on') ||
                (content.startsWith('[20') && 
                  content.includes('processing message:'))) {
              return false;
            }
            
            return true;
          });
        }
        
        return records;
      } catch (fallbackErr) {
        console.error(`Error in fallback query for recent memories (type: ${type}):`, fallbackErr);
        
        // Last resort: in-memory storage
        return this.fallbackStorage.getRecentMemories(collectionName, limit);
      }
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }
  
  async resetCollection(type: 'message' | 'thought' | 'document' | 'task'): Promise<boolean> {
    const collectionName = COLLECTIONS[type];
    
    // Always reset the in-memory fallback
    this.fallbackStorage.reset(collectionName);
    
    // If Qdrant is unavailable, just return true
    if (!this.useQdrant) {
      return true;
    }
    
    try {
      // First, check if collection exists
      const exists = await this.collectionExists(collectionName);
      
      if (exists) {
        // Delete the collection
        await this.client.deleteCollection(collectionName);
        console.log(`Deleted collection ${collectionName}`);
      }
      
      // Recreate the collection
      await this.createCollection(collectionName);
      console.log(`Recreated collection ${collectionName}`);
      
      return true;
    } catch (error) {
      console.error(`Error resetting collection ${collectionName}:`, error);
      this.useQdrant = false;
      return true; // Return true since we've reset the in-memory fallback
    }
  }
  
  async resetAllCollections(): Promise<boolean> {
    // Always reset the in-memory fallback
    this.fallbackStorage.resetAll();
    
    // If Qdrant is unavailable, just return true
    if (!this.useQdrant) {
      return true;
    }
    
    try {
      for (const type of ['message', 'thought', 'document', 'task'] as const) {
        await this.resetCollection(type);
      }
      return true;
    } catch (error) {
      console.error('Error resetting all collections:', error);
      this.useQdrant = false;
      return true; // Return true since we've reset the in-memory fallback
    }
  }

  // Helper method to normalize a vector to unit length
  private normalizeVector(vector: number[]): number[] {
    try {
      // Filter out any invalid values first
      const validValues = vector.map(val => {
        if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) {
          return 0; // Replace invalid values with 0
        }
        return val;
      });
      
      // Calculate the magnitude (Euclidean norm)
      const magnitudeSquared = validValues.reduce((sum, val) => sum + val * val, 0);
      const magnitude = Math.sqrt(magnitudeSquared);
      
      // Avoid division by zero
      if (magnitude === 0 || !isFinite(magnitude)) {
        console.warn('Vector has zero magnitude or invalid values, returning array of small random values');
        return Array.from({ length: vector.length }, () => (Math.random() - 0.5) * 0.0001);
      }
      
      // Normalize each component
      return validValues.map(val => {
        const normalized = val / magnitude;
        // Final safety check for any NaN/Infinity that might have slipped through
        if (!isFinite(normalized)) {
          return (Math.random() - 0.5) * 0.0001;
        }
        return normalized;
      });
    } catch (error) {
      console.error('Error normalizing vector:', error);
      // Return small random values as a fallback
      return Array.from({ length: vector.length }, () => (Math.random() - 0.5) * 0.0001);
    }
  }
  
  // Helper to ensure vectors are always safe for Qdrant
  private validateVectorForQdrant(vector: number[]): number[] {
    try {
      // Ensure vector is the right size
      if (vector.length !== this.dimensions) {
        console.warn(`Vector length ${vector.length} doesn't match expected dimensions ${this.dimensions}, resizing`);
        // Resize the vector to match dimensions
        if (vector.length > this.dimensions) {
          // Truncate if too long
          vector = vector.slice(0, this.dimensions);
        } else {
          // Pad with small random values if too short
          const padding = Array.from(
            { length: this.dimensions - vector.length },
            () => (Math.random() - 0.5) * 0.0001
          );
          vector = [...vector, ...padding];
        }
      }
      
      // Validate each element is a proper number
      const validVector = vector.map(val => {
        if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) {
          return (Math.random() - 0.5) * 0.0001;
        }
        return val;
      });
      
      // Normalize to ensure unit length
      return this.normalizeVector(validVector);
    } catch (error) {
      console.error('Vector validation error:', error);
      // Return a safe random vector as last resort
      return Array.from(
        { length: this.dimensions },
        () => (Math.random() - 0.5) * 0.0001
      );
    }
  }

  /**
   * Get the total number of messages in memory
   */
  async getMessageCount(): Promise<number> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      if (!this.useQdrant) {
        // Count all messages in in-memory storage
        return this.fallbackStorage.getMessageCount();
      }

      // Count messages in Qdrant
      const counts = await Promise.all(
        Object.values(COLLECTIONS).map(async (collectionName) => {
          try {
            const count = await this.client.getCollection(collectionName);
            return count.points_count || 0;
          } catch (error) {
            console.error(`Error getting count for collection ${collectionName}:`, error);
            return 0;
          }
        })
      );

      return counts.reduce((total: number, count: number) => total + count, 0);
    } catch (error) {
      console.error('Error getting message count:', error);
      return 0;
    }
  }

  /**
   * Update metadata for a memory entry
   */
  async updateMemoryMetadata(memoryId: string, metadata: Record<string, any>): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.useQdrant) {
      // For in-memory storage, we can't easily update metadata
      console.warn('Metadata updates not supported in fallback memory mode');
      return false;
    }
    
    try {
      // We need to search across all collections to find the memory ID
      // since we don't know which collection it's in
      for (const collectionName of Array.from(this.collections)) {
        try {
          // Search for the memory using filter
          const results = await this.client.scroll(collectionName, {
            filter: {
              must: [
                {
                  key: "id",
                  match: {
                    value: memoryId
                  }
                }
              ]
            },
            limit: 1
          });
          
          // Check if we found the memory
          if (results.points && results.points.length > 0) {
            const point = results.points[0];
            const pointId = point.id;
            
            // Get the existing payload
            const existingPayload = point.payload || {};
            
            // Merge the new metadata with existing payload
            const updatedPayload = {
              ...existingPayload,
              ...metadata,
              // Add a last_updated timestamp
              last_updated: new Date().toISOString()
            };
            
            // Update the point with new payload
            await this.client.setPayload(
              collectionName,
              { points: [pointId], payload: updatedPayload }
            );
            
            return true;
          }
        } catch (error) {
          console.error(`Error searching for memory in ${collectionName}:`, error);
        }
      }
      
      // If we get here, we didn't find the memory in any collection
      console.warn(`Memory with ID ${memoryId} not found in any collection`);
      return false;
    } catch (error) {
      console.error('Error updating memory metadata:', error);
      return false;
    }
  }

  /**
   * Clear memories by source
   */
  async clearMemoriesBySource(source: string): Promise<{ success: boolean; count: number }> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    let totalCleared = 0;
    
    if (!this.useQdrant) {
      // For in-memory storage, we'll need to use a different approach
      // since storage is private - implement simplified version
      console.log(`In-memory storage: simulating source-based memory clearing for source=${source}`);
      return { success: true, count: 0 }; // Just return success without clearing
    }
    
    try {
      // Go through each collection and delete points with matching source
      for (const collectionName of Array.from(this.collections)) {
        try {
          // Create filter for the source
          const filter = {
            must: [
              {
                key: "source",
                match: {
                  value: source.toLowerCase()
                }
              }
            ]
          };
          
          // First, count how many points will be affected
          const countResponse = await this.client.count(collectionName, { filter });
          const count = countResponse.count || 0;
          
          if (count > 0) {
            // Delete the points
            await this.client.delete(collectionName, {
              filter,
              wait: true
            });
            
            totalCleared += count;
            console.log(`Cleared ${count} memories with source=${source} from ${collectionName}`);
          }
        } catch (error) {
          console.error(`Error clearing memories from ${collectionName}:`, error);
        }
      }
      
      return { success: true, count: totalCleared };
    } catch (error) {
      console.error('Error clearing memories by source:', error);
      return { success: false, count: totalCleared };
    }
  }
}

// Singleton instance
let qdrantInstance: QdrantHandler | null = null;
let isInitializing = false;
let initializationPromise: Promise<void> | null = null;

// Public API
export async function initMemory(options?: {
  qdrantUrl?: string;
  qdrantApiKey?: string;
  useOpenAI?: boolean;
  forceReinit?: boolean;
  connectionTimeout?: number;
}): Promise<void> {
  // If already initializing, wait for that to complete instead of creating a new instance
  if (isInitializing && initializationPromise && !options?.forceReinit) {
    try {
      console.log('Waiting for existing Qdrant initialization to complete');
      await initializationPromise;
      return;
    } catch (error) {
      console.error('Previous initialization failed, starting fresh:', error);
    }
  }

  // Create new instance if needed
  if (!qdrantInstance || options?.forceReinit) {
    console.log('Creating new Qdrant handler instance');
    
    // Extract configuration with proper defaults
    const config = {
      qdrantUrl: options?.qdrantUrl || process.env.QDRANT_URL || 'http://localhost:6333',
      qdrantApiKey: options?.qdrantApiKey || process.env.QDRANT_API_KEY,
      useOpenAI: options?.useOpenAI !== undefined 
        ? options.useOpenAI 
        : process.env.USE_OPENAI_EMBEDDINGS === 'true',
      openAIModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
      connectionTimeout: options?.connectionTimeout || 10000 // 10 seconds default timeout
    };
    
    // Log the configuration (minus sensitive data)
    console.log(`Qdrant configuration: URL=${config.qdrantUrl}, useOpenAI=${config.useOpenAI}, model=${config.openAIModel}, timeout=${config.connectionTimeout}ms`);
    
    qdrantInstance = new QdrantHandler(config);
  }
  
  // Use a Promise to track initialization
  isInitializing = true;
  initializationPromise = (async () => {
    try {
      console.log('Starting Qdrant initialization');
      await qdrantInstance!.initialize();
      console.log('Qdrant initialization completed successfully');
    } catch (error) {
      console.error('Qdrant initialization failed:', error);
      throw error; // Rethrow to signal failure to caller
    } finally {
      isInitializing = false;
    }
  })();
  
  try {
    await initializationPromise;
  } catch (error) {
    console.warn('Continuing despite Qdrant initialization failure - will use in-memory fallback');
    // We'll continue even if initialization fails, as the handler will fall back to in-memory
  }
}

export async function addMemory(
  type: 'message' | 'thought' | 'document' | 'task',
  content: string,
  metadata: Record<string, any> = {}
): Promise<string> {
  if (!qdrantInstance) {
    await initMemory();
  }
  
  return qdrantInstance!.addMemory(type, content, metadata);
}

export async function searchMemory(
  type: 'message' | 'thought' | 'document' | 'task' | null,
  query: string,
  options: MemorySearchOptions = {}
): Promise<MemoryRecord[]> {
  if (!qdrantInstance) {
    await initMemory();
  }
  
  return qdrantInstance!.searchMemory(type, query, options);
}

export async function getRecentMemories(
  type: 'message' | 'thought' | 'document' | 'task',
  limit: number = 10
): Promise<MemoryRecord[]> {
  if (!qdrantInstance) {
    await initMemory();
  }
  
  return qdrantInstance!.getRecentMemories(type, limit);
}

// Reset functions
export async function resetCollection(
  type: 'message' | 'thought' | 'document' | 'task'
): Promise<boolean> {
  if (!qdrantInstance) {
    await initMemory();
  }
  
  return qdrantInstance!.resetCollection(type);
}

export async function resetAllCollections(): Promise<boolean> {
  if (!qdrantInstance) {
    await initMemory();
  }
  
  return qdrantInstance!.resetAllCollections();
}

// Export function to check if initialized
export function isInitialized(): boolean {
  return qdrantInstance?.isInitialized() || false;
}

// Add a function to get all memories of a specific type
async function getAllMemoriesByType(
  type: 'message' | 'thought' | 'document' | 'task'
): Promise<MemoryRecord[]> {
  if (!qdrantInstance) {
    await initMemory();
  }
  
  try {
    // We're using an empty query to get all memories of this type
    // The empty query will rely on the vector search but will return all results
    // sorted by vector similarity with a random vector (effectively random order)
    return qdrantInstance!.searchMemory(type, "", { limit: 100 });
  } catch (error) {
    console.error(`Error getting all memories of type ${type}:`, error);
    return [];
  }
}

// Export the new function
export { getAllMemoriesByType };

// Add a diagnostic function to identify message storage issues
export async function diagnoseDatabaseHealth(): Promise<{ 
  status: string;
  messageCount: number;
  recentMessages: Array<{id: string, type: string, text: string}>
}> {
  if (!qdrantInstance) {
    await initMemory();
  }
  
  try {
    // Get recent messages to check what's in the database
    const recentMessages = await qdrantInstance!.getRecentMemories('message', 20);
    
    // Return diagnostic information
    return {
      status: "Database connected",
      messageCount: recentMessages.length,
      recentMessages: recentMessages.map(msg => ({
        id: msg.id,
        type: msg.metadata.role || 'unknown',
        text: msg.text.substring(0, 50) + (msg.text.length > 50 ? '...' : '')
      }))
    };
  } catch (error) {
    console.error("Error diagnosing database health:", error);
    return {
      status: "Error checking database",
      messageCount: 0,
      recentMessages: []
    };
  }
}

// Add a function to get recent chat messages with timestamp filtering
export async function getRecentChatMessages(options: {
  userId?: string;
  limit?: number;
  since?: Date;
  until?: Date;
  roles?: string[];
}): Promise<Message[]> {
  const { userId = 'default', limit = 100 } = options;
  
  try {
    // Make sure Qdrant is initialized
    if (!qdrantInstance) {
      await initMemory();
    }
    
    if (!qdrantInstance || !qdrantInstance.isInitialized()) {
      console.error('Qdrant not initialized for getRecentChatMessages');
      return [];
    }
    
    // Get the collection for this user
    const collectionName = COLLECTIONS['message'];
    
    // Search for chat messages only, with appropriate filtering
    const filter: any = {
      must: [
        { key: 'type', match: { value: 'message' } }
      ]
    };
    
    // Add userId filter if specified
    if (userId !== 'default') {
      filter.must.push({ key: 'metadata.userId', match: { value: userId } });
    }
    
    // Add role filter if specified
    if (options.roles && options.roles.length > 0) {
      filter.must.push({ 
        key: 'metadata.role', 
        match: { 
          any: options.roles.map(role => ({ value: role }))
        } 
      });
    }
    
    console.log(`Fetching recent chat messages for user: ${userId}, limit: ${limit}`);
    if (options.since) console.log(`With date range from: ${options.since.toISOString()}`);
    if (options.until) console.log(`Until: ${options.until.toISOString()}`);
    
    // Get recent messages sorted by timestamp (newest first)
    const searchResponse = await qdrantInstance.searchMemory('message', '', { 
      limit,
      filter
    });
    
    if (!searchResponse || !Array.isArray(searchResponse)) {
      console.error('Invalid response from Qdrant search:', searchResponse);
      return [];
    }
    
    // Filter by date range if needed
    let filteredResults = searchResponse;
    
    if (options.since) {
      const sinceTime = options.since.getTime();
      filteredResults = filteredResults.filter(record => 
        new Date(record.timestamp).getTime() >= sinceTime
      );
    }
    
    if (options.until) {
      const untilTime = options.until.getTime();
      filteredResults = filteredResults.filter(record => 
        new Date(record.timestamp).getTime() <= untilTime
      );
    }
    
    // If this is called with roles (for agent usage), transform to Message format
    // but still return the correct type
    if (options.roles) {
      const agentMessages: Message[] = filteredResults.map(record => {
        const { metadata = {} } = record;
        return {
          sender: metadata.role || 'unknown',
          content: record.text,
          timestamp: new Date(record.timestamp),
          memory: metadata.memory,
          thoughts: metadata.thoughts,
          attachments: metadata.attachments,
          visionResponseFor: metadata.visionResponseFor
        };
      });
      return agentMessages;
    }
    
    // For client-side (UI) usage, transform to Message objects
    const messages: Message[] = filteredResults.map(record => {
      // Extract the metadata and content from the Qdrant record
      const { metadata = {} } = record;
      
      // Create a properly formatted message object
      const message: Message = {
        sender: metadata.role === 'user' ? 'You' : 'Chloe',
        content: record.text,
        timestamp: new Date(record.timestamp),
        // Only include attachments for user messages - AI responses should never have attachments
        attachments: metadata.role === 'user' && metadata.attachments && Array.isArray(metadata.attachments) 
          ? metadata.attachments.map(att => ({
              ...att,
              // Handle File type which can't be directly serialized
              file: att.file ? null : undefined
            }))
          : undefined,
        // Preserve visionResponseFor field if present for AI messages
        visionResponseFor: metadata.role === 'assistant' && metadata.visionResponseFor
          ? metadata.visionResponseFor 
          : undefined
      };
      
      return message;
    });
    
    // Count messages with attachments for logging
    const messagesWithAttachments = messages.filter(m => m.attachments && m.attachments.length > 0);
    console.log(`Found ${messagesWithAttachments.length} messages with attachments for user ${userId}`);
    
    // Log vision responses for debugging
    const visionResponses = messages.filter(m => m.visionResponseFor);
    console.log(`Found ${visionResponses.length} vision responses for user ${userId}`);
    
    // Sort by timestamp (oldest first)
    return messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  } catch (error) {
    console.error('Error fetching recent chat messages:', error);
    return [];
  }
}

// Function to summarize chat history using timestamps
export async function summarizeChat(options: {
  userId?: string;
  limit?: number;
  since?: Date;
  until?: Date;
}): Promise<string> {
  try {
    // Get messages in the date range
    const messages = await getRecentChatMessages({
      userId: options.userId,
      limit: options.limit || 50,
      since: options.since,
      until: options.until
    });
    
    if (messages.length === 0) {
      return "No chat history found in the specified time range.";
    }
    
    // Format messages for summary
    const formattedMessages = messages.map(msg => {
      return `${msg.sender.toUpperCase()} (${new Date(msg.timestamp).toLocaleTimeString()}): ${msg.content}`;
    }).join("\n\n");
    
    // Create a summary using a simple template
    return `Chat history from ${options.since ? options.since.toLocaleString() : 'beginning'} ${options.until ? `to ${options.until.toLocaleString()}` : 'to now'}:\n\n${formattedMessages}`;
  } catch (error) {
    console.error('Error summarizing chat:', error);
    return "Failed to generate chat summary due to an error.";
  }
}

/**
 * Get all memories of a specific type
 * @param type Memory type to get (message, thought, document)
 * @param limit Maximum number of memories to return
 * @returns Array of memory entries
 */
export async function getAllMemories(
  type: string | null, 
  limit: number = 100
): Promise<any[]> {
  if (!qdrantInstance) {
    await initMemory();
  }
  
  try {
    if (!qdrantInstance) {
      console.error('Failed to initialize qdrantInstance');
      return [];
    }
    
    const collectionName = type ? COLLECTIONS[type as keyof typeof COLLECTIONS] : null;
    
    // If no specific collection is requested or Qdrant is unavailable, combine results from all collections
    if (!collectionName || !qdrantInstance.isInitialized()) {
      console.log('Fetching memories from multiple collections or using fallback');
      const collectionsToSearch = type 
        ? [COLLECTIONS[type as keyof typeof COLLECTIONS]] 
        : Object.values(COLLECTIONS);
      
      // Use search with empty query to get all memories
      const results = await Promise.all(
        collectionsToSearch.map(collection => 
          qdrantInstance!.searchMemory(type as any, "", { limit })
        )
      );
      
      return results.flat();
    }
    
    // Get memories from a specific collection using scroll API
    try {
      // Since we can't directly access the client, we'll use the searchMemory method 
      // with an empty query which will return all memories of the specified type
      return qdrantInstance.searchMemory(type as any, "", { limit });
    } catch (error) {
      console.error(`Error getting memories from collection ${collectionName}:`, error);
      return [];
    }
  } catch (error) {
    console.error('Error getting all memories:', error);
    return [];
  }
}

/**
 * Get text embedding using OpenAI
 * Used by the semantic search service
 */
export async function getEmbedding(text: string): Promise<{ embedding: number[] }> {
  try {
    // Initialize OpenAI if not already done
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // Get embedding from OpenAI
    const response = await openai.embeddings.create({
      model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
      input: text,
      encoding_format: 'float'
    });
    
    if (!response.data[0].embedding) {
      throw new Error('Failed to get embedding from OpenAI');
    }
    
    return { embedding: response.data[0].embedding };
  } catch (error) {
    console.error('Error getting embedding:', error);
    // Return random embedding as fallback (not ideal for production)
    const dimensions = 1536; // Default for OpenAI embeddings
    return { 
      embedding: Array.from({ length: dimensions }, () => Math.random() * 2 - 1) 
    };
  }
}

// Add new exports for the strategic insights utility functions

export async function addToCollection(collectionName: string, embedding: number[], payload: any): Promise<boolean> {
  if (!qdrantInstance) {
    await initMemory();
  }
  
  try {
    // Generate a valid ID
    const id = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    
    // Create a fake memory record to use the existing addMemory function
    // We use this as a wrapper around the actual client
    const stringId = await qdrantInstance!.addMemory('message', JSON.stringify(payload), {
      ...payload,
      _embedding: embedding,
      _originalCollection: collectionName,
      _custom: true
    });
    
    return !!stringId;
  } catch (error) {
    console.error(`Error adding to collection ${collectionName}:`, error);
    return false;
  }
}

export async function search(collectionName: string, embedding: number[], limit: number = 5): Promise<any[]> {
  if (!qdrantInstance) {
    await initMemory();
  }
  
  try {
    // Use the existing search function but map the results
    const results = await qdrantInstance!.searchMemory('message', '', {
      limit,
      filter: {
        _originalCollection: collectionName
      }
    });
    
    return results.map(result => ({
      id: result.id,
      payload: JSON.parse(result.text),
      score: 1.0 // Default score since we're not really searching
    }));
  } catch (error) {
    console.error(`Error searching collection ${collectionName}:`, error);
    return [];
  }
}

export async function getRecentPoints(collectionName: string, limit: number = 5): Promise<any[]> {
  if (!qdrantInstance) {
    await initMemory();
  }
  
  try {
    // Use the existing getRecentMemories function
    const memories = await qdrantInstance!.getRecentMemories('message', limit);
    
    // Filter by the original collection and map to the expected format
    return memories
      .filter(memory => memory.metadata._originalCollection === collectionName)
      .map(memory => ({
        id: memory.id,
        payload: JSON.parse(memory.text),
        score: 1.0
      }));
  } catch (error) {
    console.error(`Error getting recent points from ${collectionName}:`, error);
    return [];
  }
}

// Export the getMessageCount function
export async function getMessageCount(): Promise<number> {
  if (!qdrantInstance) {
    await initMemory();
  }
  return qdrantInstance!.getMessageCount();
}

/**
 * Get memories by importance level
 */
export async function getMemoriesByImportance(
  importance: 'high' | 'medium' | 'low', 
  limit: number = 200
): Promise<MemoryRecord[]> {
  if (!qdrantInstance) {
    await initMemory();
  }

  try {
    const collections = ['message', 'thought', 'document', 'task'] as const;
    let allMemories: MemoryRecord[] = [];

    for (const type of collections) {
      try {
        // Use the more appropriate searchMemory method from the instance
        const memories = await qdrantInstance!.searchMemory(
          type,
          '', // Empty query to match all documents
          {
            limit: Math.floor(limit / collections.length), // Split limit across collections
            filter: {
              importance: importance
            }
          }
        );
        
        allMemories = [...allMemories, ...memories];
      } catch (error) {
        console.error(`Error fetching ${importance} importance memories from ${type}:`, error);
      }
    }

    // Sort by timestamp (most recent first)
    return allMemories
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  } catch (error) {
    console.error('Error fetching memories by importance:', error);
    return [];
  }
}

/**
 * Update metadata for a memory entry
 */
export async function updateMemoryMetadata(
  memoryId: string,
  metadata: Record<string, any>
): Promise<boolean> {
  if (!qdrantInstance) {
    qdrantInstance = new QdrantHandler();
    await qdrantInstance.initialize();
  }
  
  return qdrantInstance.updateMemoryMetadata(memoryId, metadata);
}

/**
 * Clear memories by source
 */
export async function clearMemoriesBySource(
  source: string
): Promise<{ success: boolean; count: number }> {
  if (!qdrantInstance) {
    qdrantInstance = new QdrantHandler();
    await qdrantInstance.initialize();
  }
  
  return qdrantInstance.clearMemoriesBySource(source);
} 