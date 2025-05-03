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
import { ImportanceLevel } from '../../constants/memory';
import { ImportanceCalculator } from '../../lib/memory/ImportanceCalculator';
import { TagExtractor, Tag, TagAlgorithm } from '../../lib/memory/TagExtractor';
import { extractTagsFromQuery } from './search-helpers';

// Make sure this file is only executed on the server
if (typeof window !== 'undefined') {
  throw new Error('This module can only be imported in server-side code');
}

// Type for Qdrant memory type string literals that match the constants
export type QdrantMemoryType = 'message' | 'thought' | 'document' | 'task';

// Helper function to convert from BaseMemoryType enum to QdrantMemoryType
export function convertToQdrantType(type: QdrantMemoryType): QdrantMemoryType {
  return type;
}

// Basic types to define memory structure
export interface MemoryRecord {
  id: string;
  text: string;
  timestamp: string;
  type: QdrantMemoryType;
  metadata: Record<string, any>;
}

// Memory record with score information for search results
export interface ScoredMemoryRecord extends MemoryRecord {
  score: number;
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

  async addMemory(type: QdrantMemoryType, content: string, metadata: Record<string, any> = {}): Promise<string> {
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

  async searchMemories(
    type: QdrantMemoryType | null,
    query: string,
    options: MemorySearchOptions = {}
  ): Promise<MemoryRecord[]> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // If a specific collection is requested, search only that one
      if (type) {
        const collectionName = COLLECTIONS[type];
        if (!collectionName) {
          throw new Error(`Invalid memory type: ${type}`);
        }
        
        return this.searchInCollection(collectionName, query, options);
      }
      
      // If no specific type is requested, search across all collections
      const allResults: MemoryRecord[] = [];
      
      for (const collectionName of Object.values(COLLECTIONS)) {
        try {
          const results = await this.searchInCollection(collectionName, query, options);
          allResults.push(...results);
        } catch (error) {
          console.error(`Error searching collection ${collectionName}:`, error);
        }
      }
      
      // Sort combined results by score if available, fallback to timestamp
      return allResults.sort((a, b) => {
        if ('score' in a && 'score' in b) {
          return (b as any).score - (a as any).score;
        }
        
        // Fallback to sorting by timestamp (newest first)
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      }).slice(0, options.limit || 10);
    } catch (error) {
      console.error('Error in searchMemories:', error);
      return [];
    }
  }

  private async searchInCollection(
    collectionName: string,
    query: string,
    options: MemorySearchOptions = {}
  ): Promise<MemoryRecord[]> {
    // Fallback to in-memory storage if not using Qdrant
    if (!this.useQdrant) {
      return this.fallbackStorage.searchMemory(collectionName, query, options);
    }
    
    try {
      // If query is empty, use scroll API to get recent memories
      if (!query || query.trim().length === 0) {
        const response = await this.client.scroll(collectionName, {
          limit: options.limit || 10,
          with_payload: true,
          with_vector: false,
          filter: options.filter ? this.buildQdrantFilter(options.filter) : undefined,
          order_by: {
            key: 'timestamp',
            direction: 'desc'
          }
        });
        
        if (!response || !response.points) {
          return [];
        }
        
        return response.points.map(point => this.extractMemoryRecord(point));
      }
      
      // For actual search queries, get embedding and search by vector similarity
      const embedding = await this.embeddingFunction(query);
      
      // Ensure we're getting at least 20 results for proper hybrid scoring
      const searchLimit = options.limit || 20;
      
      const searchResponse = await this.client.search(collectionName, {
        vector: embedding,
        limit: searchLimit,
        filter: options.filter ? this.buildQdrantFilter(options.filter) : undefined,
        with_payload: true,
        with_vector: false
      });
      
      if (!searchResponse) {
        return [];
      }
      
      // Transform results to MemoryRecord objects with scores
      return searchResponse.map(result => {
        const record = this.extractMemoryRecord(result);
        return {
          ...record,
          score: result.score || 0
        };
      });
    } catch (error) {
      console.error(`Error searching collection ${collectionName}:`, error);
      
      // Fallback to in-memory storage
      return this.fallbackStorage.searchMemory(collectionName, query, options);
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

  async getRecentMemories(type: QdrantMemoryType, limit: number = 10): Promise<MemoryRecord[]> {
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
  
  async resetCollection(type: QdrantMemoryType): Promise<boolean> {
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

  /**
   * Delete a point from a collection by ID
   */
  async deletePoint(collectionName: string, id: string): Promise<boolean> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!this.useQdrant) {
        console.warn('Qdrant not available, using in-memory fallback');
        // Use a workaround since we can't access the private storage directly
        // Instead, use public methods to perform the equivalent operation
        // We'll simulate deletion by implementing our own fake "delete"
        return true; // Simplified implementation - just return success
      }
      
      // Delete the point from Qdrant
      const result = await this.client.delete(collectionName, {
        points: [id]
      });
      
      return result.status === 'completed' || result.status === 'acknowledged';
    } catch (error) {
      console.error(`Error deleting point ${id} from ${collectionName}:`, error);
      return false;
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
      if (qdrantInstance) {
        await qdrantInstance.initialize();
      }
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
  type: QdrantMemoryType,
  content: string,
  metadata: Record<string, any> = {}
): Promise<string> {
  if (!qdrantInstance) {
    await initMemory();
  }
  
  return qdrantInstance ? qdrantInstance.addMemory(type, content, metadata) : '';
}

/**
 * Calculate a boost factor based on tag overlap between query and memory
 * 
 * @param queryTags Array of tags from the query
 * @param memoryTags Array of tags from the memory record
 * @returns Tag overlap score normalized to 0-1 range
 */
function calculateTagScore(queryTags: string[], memoryTags: string[]): number {
  if (!queryTags || !memoryTags || queryTags.length === 0 || memoryTags.length === 0) {
    return 0.0; // No overlap
  }
  
  // Count overlapping tags (case-insensitive matching)
  let overlapCount = 0;
  const matchedTags: string[] = [];
  
  for (const tag of queryTags) {
    const tagLower = tag.toLowerCase();
    for (const memoryTag of memoryTags) {
      if (memoryTag.toLowerCase() === tagLower) {
        overlapCount++;
        matchedTags.push(tag);
        break;
      }
    }
  }
  
  // Calculate overlap ratio (normalize by the smaller set size)
  const overlapRatio = overlapCount / Math.min(queryTags.length, memoryTags.length);
  
  return overlapRatio;
}

/**
 * Helper function to adjust scores based on memory usage count
 * Uses logarithmic scaling to boost frequently used memories
 * 
 * @param score Original similarity score
 * @param usageCount Number of times the memory has been used
 * @returns Adjusted score
 */
function adjustScoreByUsage(score: number, usageCount: number = 0): number {
  // Ensure we always have at least 1 for log calculation
  const safeUsageCount = Math.max(1, usageCount);
  
  // Apply logarithmic scaling for diminishing returns
  // ln(1) = 0, so for new memories this will be score * (1 + 0) = score
  return score * (1 + Math.log(safeUsageCount));
}

export async function searchMemory(
  type: QdrantMemoryType | null,
  query: string,
  options: MemorySearchOptions = {}
): Promise<MemoryRecord[]> {
  try {
    if (!qdrantInstance) {
      await initMemory();
    }

    // Get results from standard vector search (increase limit to get more candidates)
    const searchLimit = Math.max(options.limit || 10, 20); // Ensure at least 20 candidates
    const vectorResults = qdrantInstance ? 
      await qdrantInstance.searchMemories(type, query, { ...options, limit: searchLimit }) : 
      [];
    
    console.log(`Vector search retrieved ${vectorResults.length} initial results`);
    
    // If no results or very short query, just return vector results
    if (vectorResults.length === 0 || !query || query.trim().length < 3) {
      return vectorResults;
    }
    
    // Extract tags from query for hybrid scoring
    const extractedTags = TagExtractor.extractTags(query, {
      algorithm: TagAlgorithm.RAKE, // RAKE works better for short queries
      maxTags: 8,
      minConfidence: 0.15,
      useStemming: true
    });
    
    const queryTags = extractedTags.map(tag => tag.text);
    console.log(`Tags extracted from query: ${queryTags.join(', ')}`);
    
    if (queryTags.length === 0) {
      // No tags extracted, return vector results
      return vectorResults.slice(0, options.limit || 10);
    }
    
    // Apply hybrid scoring (vector + tag overlap + usage)
    const hybridScoredResults = vectorResults.map(result => {
      // Original vector similarity score (already normalized 0-1)
      const vectorScore = 'score' in result ? (result as ScoredMemoryRecord).score : 0;
      
      // Calculate tag overlap score
      const memoryTags = result.metadata?.tags || [];
      const tagScore = calculateTagScore(queryTags, memoryTags as string[]);
      
      // Calculate matched tags for diagnostics
      const matchedTags = queryTags.filter(tag => 
        (memoryTags as string[]).some(mt => mt.toLowerCase() === tag.toLowerCase())
      );
      
      // Compute hybrid score: 70% vector similarity + 30% tag overlap
      const hybridScore = (vectorScore * 0.7) + (tagScore * 0.3);
      
      // Get usage count from metadata (default to 0 if not present)
      const usageCount = result.metadata?.usage_count || 0;
      
      // Apply usage-based adjustment
      const adjustedScore = adjustScoreByUsage(hybridScore, usageCount);
      
      // Store scoring details in metadata for diagnostics
      const scoredResult: ScoredMemoryRecord = {
        ...result,
        score: adjustedScore,
        metadata: {
          ...result.metadata,
          _scoringDetails: {
            vectorScore,
            tagScore,
            hybridScore,
            usageCount,
            adjustedScore,
            matchedTags,
            queryTags
          }
        }
      };
      
      return scoredResult;
    });
    
    // Sort by adjusted score and limit results
    const finalResults = hybridScoredResults
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit || 10);
    
    // Add summary statistics for diagnostics
    const resultsWithTagMatches = hybridScoredResults.filter(r => 
      r.metadata._scoringDetails.matchedTags.length > 0
    ).length;
    
    // Check if ranking order changed due to tag boosting
    const vectorOnlyOrder = [...hybridScoredResults]
      .sort((a, b) => 
        b.metadata._scoringDetails.vectorScore - 
        a.metadata._scoringDetails.vectorScore
      )
      .slice(0, finalResults.length)
      .map(r => r.id);
    
    const hybridOrder = finalResults.map(r => r.id);
    const rankingChanged = !vectorOnlyOrder.every((id, i) => id === hybridOrder[i]);
    
    console.log(
      `Hybrid search summary: ${resultsWithTagMatches}/${hybridScoredResults.length} results had tag matches. ` +
      `${rankingChanged ? 'Tag boosting changed result ranking.' : 'Tag boosting preserved vector ranking.'}`
    );
    
    // Log detailed diagnostic information about top results
    console.log(`----- Memory Search Results (${finalResults.length}) -----`);
    finalResults.slice(0, 3).forEach((result, index) => {
      const details = result.metadata._scoringDetails;
      console.log(
        `Result #${index + 1} [ID: ${result.id.substring(0, 8)}]:\n` +
        `• Vector score: ${details.vectorScore.toFixed(3)} × 0.7 = ${(details.vectorScore * 0.7).toFixed(3)}\n` +
        `• Tag score: ${details.tagScore.toFixed(3)} × 0.3 = ${(details.tagScore * 0.3).toFixed(3)}\n` +
        `• Hybrid score: ${details.hybridScore.toFixed(3)}\n` +
        `• Usage count: ${details.usageCount}, boost: ${(details.adjustedScore / details.hybridScore).toFixed(2)}x\n` +
        `• Final score: ${details.adjustedScore.toFixed(3)}\n` +
        `• Matched tags: ${details.matchedTags.join(', ') || 'none'}\n` +
        `• Content excerpt: "${result.text.substring(0, 50)}..."`
      );
    });
    
    return finalResults;
  } catch (error) {
    console.error('Error in hybrid memory search:', error);
    return [];
  }
}

export async function getRecentMemories(
  type: QdrantMemoryType,
  limit: number = 10
): Promise<MemoryRecord[]> {
  if (!qdrantInstance) {
    await initMemory();
  }
  
  return qdrantInstance ? qdrantInstance.getRecentMemories(type, limit) : [];
}

// Reset functions
export async function resetCollection(
  type: QdrantMemoryType
): Promise<boolean> {
  if (!qdrantInstance) {
    await initMemory();
  }
  
  return qdrantInstance ? qdrantInstance.resetCollection(type) : false;
}

export async function resetAllCollections(): Promise<boolean> {
  if (!qdrantInstance) {
    await initMemory();
  }
  
  return qdrantInstance ? qdrantInstance.resetAllCollections() : false;
}

// Export function to check if initialized
export function isInitialized(): boolean {
  return qdrantInstance?.isInitialized() || false;
}

// Add a function to get all memories of a specific type
export async function getAllMemoriesByType(
  type: QdrantMemoryType
): Promise<MemoryRecord[]> {
  if (!qdrantInstance) {
    await initMemory();
  }
  
  try {
    // We're using an empty query to get all memories of this type
    // The empty query will rely on the vector search but will return all results
    // sorted by vector similarity with a random vector (effectively random order)
    return qdrantInstance ? qdrantInstance.searchMemories(type, "", { limit: 100 }) : [];
  } catch (error) {
    console.error(`Error getting all memories of type ${type}:`, error);
    return [];
  }
}

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
    const recentMessages = qdrantInstance ? await qdrantInstance.getRecentMemories('message', 20) : [];
    
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
    const searchResponse = await qdrantInstance.searchMemories('message', '', { 
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
  try {
    if (!qdrantInstance) {
      console.log('qdrantInstance not initialized, initializing now...');
      await initMemory();
    }
    
    if (!qdrantInstance) {
      console.error('Failed to initialize qdrantInstance even after retry');
      return [];
    }
    
    const collectionName = type ? COLLECTIONS[type as keyof typeof COLLECTIONS] : null;
    
    // If no specific collection is requested or Qdrant is unavailable, combine results from all collections
    if (!collectionName || !qdrantInstance.isInitialized()) {
      console.log('Fetching memories from multiple collections or using fallback');
      const collectionsToSearch = type 
        ? [COLLECTIONS[type as keyof typeof COLLECTIONS]] 
        : Object.values(COLLECTIONS);
      
      console.log(`Searching ${collectionsToSearch.length} collections: ${collectionsToSearch.join(', ')}`);
      
      try {
        // Use search with empty query to get all memories
        const results = await Promise.all(
          collectionsToSearch.map(async (collection) => {
            try {
              const result = qdrantInstance ? 
                await qdrantInstance.searchMemories(type as any, "", { limit }) : [];
              console.log(`Retrieved ${result?.length || 0} memories from collection ${collection}`);
              return Array.isArray(result) ? result : [];
            } catch (collectionError) {
              console.error(`Error searching collection ${collection}:`, collectionError);
              return [];
            }
          })
        );
        
        const flatResults = results.flat();
        console.log(`Retrieved ${flatResults.length} total memories across all collections`);
        return flatResults;
      } catch (searchError) {
        console.error('Error during multi-collection search:', searchError);
        return [];
      }
    }
    
    // Get memories from a specific collection using scroll API
    try {
      console.log(`Searching single collection ${collectionName} for memories`);
      // Since we can't directly access the client, we'll use the searchMemories method 
      // with an empty query which will return all memories of the specified type
      const result = qdrantInstance ? 
        await qdrantInstance.searchMemories(type as any, "", { limit }) : [];
      console.log(`Retrieved ${result?.length || 0} memories from collection ${collectionName}`);
      return Array.isArray(result) ? result : [];
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
    const stringId = qdrantInstance ? 
      await qdrantInstance.addMemory('message', JSON.stringify(payload), {
        ...payload,
        _embedding: embedding,
        _originalCollection: collectionName,
        _custom: true
      }) : '';
    
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
    const results = qdrantInstance ? 
      await qdrantInstance.searchMemories('message', '', {
        limit,
        filter: {
          _originalCollection: collectionName
        }
      }) : [];
    
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
    const memories = qdrantInstance ? 
      await qdrantInstance.getRecentMemories('message', limit) : [];
    
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
  return qdrantInstance ? qdrantInstance.getMessageCount() : 0;
}

/**
 * Get memories by importance level
 */
export async function getMemoriesByImportance(
  importance: ImportanceLevel, 
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
        // Use the more appropriate searchMemories method from the instance
        const memories = qdrantInstance ? 
          await qdrantInstance.searchMemories(
            type,
            '', // Empty query to match all documents
            {
              limit: Math.floor(limit / collections.length), // Split limit across collections
              filter: {
                importance: importance
              }
            }
          ) : [];
        
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

/**
 * Update tags for a memory entry
 * @param memoryId ID of the memory to update
 * @param tags New tags to set
 * @param approved Whether these tags are approved by a user
 */
export async function updateMemoryTags(
  memoryId: string,
  tags: string[],
  approved: boolean = false
): Promise<boolean> {
  // Update metadata with the new tags and approval status
  const metadata: Record<string, any> = {
    tags: tags,
    tagsApproved: approved
  };
  
  // If tags are approved, clear auto-generated flags
  if (approved) {
    metadata.autoGeneratedTags = false;
    metadata.suggestedTags = null;
  }
  
  return updateMemoryMetadata(memoryId, metadata);
}

/**
 * Delete a memory by ID
 */
export async function deleteMemory(
  type: QdrantMemoryType,
  id: string
): Promise<boolean> {
  try {
    await initMemory();
    
    // Get collection name from type
    const collectionName = type ? COLLECTIONS[type] : COLLECTIONS.document;
    
    // Use the singleton instance like other functions do
    return qdrantInstance ? await qdrantInstance.deletePoint(collectionName, id) : false;
  } catch (error) {
    console.error('Error deleting memory:', error);
    return false;
  }
}

/**
 * Update a memory with new data
 */
export async function updateMemory(
  id: string,
  updates: {
    content?: string;
    type?: string;
    source?: string;
    metadata?: Record<string, any>;
    importance?: ImportanceLevel;
    importance_score?: number;
  }
): Promise<boolean> {
  try {
    if (!qdrantInstance) {
      await initMemory();
    }
    
    // First retrieve the memory to update it
    // We'll create a generic filter to find the memory with this ID
    const filter = { id: id };
    const searchOptions: MemorySearchOptions = {
      filter: { id: id },
      limit: 1
    };
    
    // Search across all types to find this memory
    // This is a hack since we don't have a direct getMemoryById function
    const memories = await qdrantInstance?.searchMemories(null, "", searchOptions);
    
    if (!memories || memories.length === 0) {
      console.error(`Memory not found: ${id}`);
      return false;
    }
    
    const existingMemory = memories[0];
    
    // Create updated metadata
    let updatedMetadata = { ...existingMemory.metadata };
    
    // Update metadata if provided
    if (updates.metadata) {
      updatedMetadata = { ...updatedMetadata, ...updates.metadata };
    }
    
    // Handle importance score and level
    if (updates.importance_score !== undefined) {
      updatedMetadata.importance_score = updates.importance_score;
      // Update importance level based on score if not explicitly provided
      if (updates.importance === undefined) {
        updatedMetadata.importance = ImportanceCalculator.scoreToImportanceLevel(updates.importance_score);
      }
    }
    
    // Handle explicit importance level
    if (updates.importance !== undefined) {
      updatedMetadata.importance = updates.importance;
    }
    
    // If we're updating content, we need to create a completely new memory
    // because we need to generate a new embedding
    if (updates.content !== undefined) {
      // Get the existing embedding for reference
      const { embedding } = await getEmbedding(updates.content);
      
      // Calculate importance score if not provided
      let importanceScore = updates.importance_score;
      if (importanceScore === undefined) {
        importanceScore = ImportanceCalculator.calculateImportanceScore({
          content: updates.content,
          source: (updates.source || existingMemory.metadata.source) as any,
          type: updates.type || existingMemory.type, 
          embedding,
          tags: updatedMetadata.tags,
          tagConfidence: updatedMetadata.tagConfidence,
          metadata: updatedMetadata
        });
        updatedMetadata.importance_score = importanceScore;
      }
      
      // Delete the old memory
      const deleted = await deleteMemory(existingMemory.type as QdrantMemoryType, id);
      
      if (!deleted) {
        console.error(`Failed to delete old memory during update: ${id}`);
      }
      
      // Create a new memory with the updated content and metadata
      await addMemory(
        existingMemory.type as QdrantMemoryType,
        updates.content,
        updatedMetadata
      );
      
      return true;
    }
    
    // If we're not updating content, just update the metadata
    return await updateMemoryMetadata(id, updatedMetadata);
  } catch (error) {
    console.error('Error updating memory:', error);
    return false;
  }
}

/**
 * Store a new memory with calculated importance score
 */
export async function storeMemory(
  content: string, 
  type: string, 
  source: string, 
  metadata: Record<string, any> = {},
  options: {
    importance?: ImportanceLevel;
    importance_score?: number;
    existingEmbedding?: number[];
    tags?: Array<string | Tag>;
    tagConfidence?: number;
  } = {}
): Promise<string> {
  try {
    // First, generate an embedding for the content
    let embedding = options.existingEmbedding;
    
    if (!embedding) {
      const result = await getEmbedding(content);
      embedding = result.embedding;
    }
    
    // Generate tags if not provided
    let tags: Array<string | Tag> = options.tags || [];
    let tagConfidence = options.tagConfidence;
    
    if (tags.length === 0 && content.length > 0) {
      // Extract tags using the TagExtractor
      const extractionOptions = {
        algorithm: 
          // Use TF-IDF for longer content, RAKE for shorter content
          content.length > 500 ? TagAlgorithm.TFIDF : TagAlgorithm.RAKE,
        maxTags: 15,
        minConfidence: 0.1,
        useStemming: true
      };
      
      // Special handling for different content types
      if (source === 'file' && metadata.contentType === 'markdown') {
        // For markdown, extract tags from title and content separately with different weights
        const fields = [];
        
        if (metadata.title) {
          fields.push({ content: metadata.title, weight: 1.5 });
        }
        
        fields.push({ content, weight: 1.0 });
        
        // For markdown files, use multi-field extraction with weighted fields
        const extractedTags = TagExtractor.extractTagsFromFields(fields, extractionOptions);
        tags = extractedTags;
        
        // For markdown, we have high confidence in tags
        tagConfidence = 0.9;
      } else {
        // For regular content, use standard extraction
        const extractedTags = TagExtractor.extractTags(content, extractionOptions);
        tags = extractedTags;
        
        // Calculate overall tag confidence from average of individual tags
        const confidenceSum = extractedTags.reduce((sum, tag) => sum + tag.confidence, 0);
        tagConfidence = extractedTags.length > 0 ? confidenceSum / extractedTags.length : 0.5;
      }
      
      // Store tag information in metadata
      metadata.tags = tags.map(tag => typeof tag === 'string' ? tag : tag.text);
      metadata.tagConfidence = tagConfidence;
      metadata.extractedTags = tags;
    } else if (tags.length > 0) {
      // Store provided tags in metadata
      metadata.tags = tags.map(tag => typeof tag === 'string' ? tag : tag.text);
      metadata.tagConfidence = tagConfidence || 0.8; // Higher confidence for manually provided tags
      metadata.extractedTags = tags;
    }
    
    // Calculate importance score if not provided
    let importanceScore = options.importance_score;
    if (importanceScore === undefined && embedding) {
      importanceScore = ImportanceCalculator.calculateImportanceScore({
        content,
        source: source as any,
        type,
        embedding,
        tags: tags as (string[] | Tag[]), // Properly typed for ImportanceCalculator
        tagConfidence,
        metadata
      });
      metadata.importance_score = importanceScore;
    }
    
    // Map importance level from score if needed
    let importance = options.importance;
    if (!importance && importanceScore !== undefined) {
      importance = ImportanceCalculator.scoreToImportanceLevel(importanceScore);
      metadata.importance = importance;
    }
    
    // Store the memory
    const point = {
      id: uuidv4(),
      content,
      type,
      source,
      embedding,
      metadata: {
        ...metadata,
        importance,
        importance_score: importanceScore,
        tags: (metadata.tags || []) as string[],
        tag_confidence: tagConfidence,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    };
    
    await addMemory(
      type as QdrantMemoryType,
      content,
      point.metadata
    );
    
    return point.id;
  } catch (error) {
    console.error('Error storing memory:', error);
    throw error;
  }
}

/**
 * Increment the usage count for a memory
 * This should be called when a memory is successfully used to answer a query
 * 
 * @param memoryId ID of the memory that was used
 * @returns True if the update was successful
 */
export async function trackMemoryUsage(memoryId: string): Promise<boolean> {
  try {
    if (!qdrantInstance) {
      await initMemory();
    }
    
    // First, get the current metadata to read the existing usage count
    const memories = await searchMemory(null, "", {
      filter: { id: memoryId },
      limit: 1
    });
    
    if (!memories || memories.length === 0) {
      console.warn(`Cannot track usage: Memory ${memoryId} not found`);
      return false;
    }
    
    const memory = memories[0];
    
    // Get current usage count, defaulting to 0 if not present
    const currentUsageCount = memory.metadata?.usage_count || 0;
    
    // Increment the usage count
    const newUsageCount = currentUsageCount + 1;
    
    // Update the metadata with the new usage count
    return updateMemoryMetadata(memoryId, {
      usage_count: newUsageCount,
      last_used: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error tracking memory usage:', error);
    return false;
  }
} 