// Server-side module for Qdrant that isolates it from Next.js bundling issues
// This will be imported only in server-side code

import { OpenAI } from 'openai';
import { QdrantClient } from '@qdrant/js-client-rest';

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

export interface MemorySearchOptions {
  limit?: number;
  filter?: Record<string, any>;
}

// Collection names for different memory types
const COLLECTIONS = {
  message: 'message_memories',
  thought: 'thought_memories',
  document: 'document_memories',
  task: 'task_memories'
};

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
}

// Class that handles Qdrant connections
class QdrantHandler {
  private client: QdrantClient;
  private dimensions: number;
  private embeddingFunction: (text: string) => Promise<number[]>;
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
    
    // Initialize Qdrant client
    this.client = new QdrantClient({
      url: options?.qdrantUrl || process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: options?.qdrantApiKey || process.env.QDRANT_API_KEY,
      timeout: this.connectionTimeout
    });
    
    this.dimensions = options?.dimensions || 1536; // Default for OpenAI embeddings
    
    // Set up OpenAI if useOpenAI is true
    if (options?.useOpenAI) {
      this.openai = new OpenAI({
        apiKey: options?.openAIApiKey || process.env.OPENAI_API_KEY
      });
      
      this.embeddingFunction = async (text: string) => {
        try {
          const response = await this.openai!.embeddings.create({
            model: options?.openAIModel || 'text-embedding-3-small',
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
          
          // Ensure all values are numbers
          const validEmbedding = embedding.map(val => {
            if (typeof val !== 'number') {
              console.warn(`Embedding contains non-number value: ${val}, converting to number`);
              return Number(val);
            }
            return val;
          });
          
          return validEmbedding;
        } catch (error) {
          console.error('Error generating embeddings with OpenAI:', error);
          console.warn('Falling back to random vectors due to OpenAI embedding error');
          // Fall back to random embeddings
          return Array.from({ length: this.dimensions }, () => Math.random() * 2 - 1);
        }
      };
    } else {
      // Default embedding function (random vectors, for development only)
      console.warn("Using random embeddings - not for production use!");
      this.embeddingFunction = async (text: string) => {
        return Array.from({ length: this.dimensions }, () => Math.random() * 2 - 1);
      };
    }
  }

  async initialize(): Promise<void> {
    try {
      console.log('Initializing Qdrant memory system');
      
      // Test connection to Qdrant with timeout
      try {
        const testConnectionPromise = this.client.getCollections();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), this.connectionTimeout)
        );
        
        await Promise.race([testConnectionPromise, timeoutPromise]);
        this.useQdrant = true;
        console.log('Successfully connected to Qdrant');
      } catch (error) {
        console.error('Failed to connect to Qdrant, using in-memory fallback:', error);
        this.useQdrant = false;
        this.initialized = true;
        return;
      }
      
      // If we get here, Qdrant is available
      // Check and create collections for each memory type
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
          console.error(`Error checking/creating collection ${collectionName}:`, error);
          this.useQdrant = false;
        }
      }
      
      this.initialized = true;
      
      if (!this.useQdrant) {
        console.log('Using in-memory fallback for Qdrant');
      } else {
        console.log('Qdrant memory system initialized successfully');
      }
    } catch (error) {
      console.error('Failed to initialize Qdrant memory system:', error);
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
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(collection => collection.name === collectionName);
      
      if (exists) {
        console.log(`Collection ${collectionName} already exists, skipping creation`);
        this.collections.add(collectionName);
        return;
      }
      
      // Create collection with proper settings
      await this.client.createCollection(collectionName, {
        vectors: {
          size: this.dimensions,
          distance: 'Cosine'
        },
        optimizers_config: {
          default_segment_number: 2
        },
        replication_factor: 1
      });
      
      console.log(`Successfully created collection ${collectionName}`);
      this.collections.add(collectionName);
    } catch (error) {
      console.error(`Error creating collection ${collectionName}:`, error);
      this.useQdrant = false;
    }
  }

  async addMemory(type: 'message' | 'thought' | 'document' | 'task', content: string, metadata: Record<string, any> = {}): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // Create record ID
      const id = `${type}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      // Get collection name
      const collectionName = COLLECTIONS[type];
      
      // Add timestamp if not provided
      if (!metadata.timestamp) {
        metadata.timestamp = new Date().toISOString();
      }
      
      // If Qdrant is unavailable, use in-memory fallback
      if (!this.useQdrant) {
        return this.fallbackStorage.addMemory(collectionName, id, content, type, metadata);
      }
      
      // Generate embedding for Qdrant
      const embedding = await this.embeddingFunction(content);
      
      try {
        // Store the point in Qdrant - using 'points' format instead of 'batch' format
        const requestPayload = {
          wait: true,
          points: [
            {
              id: id,
              vector: embedding,
              payload: {
                text: content,
                timestamp: metadata.timestamp,
                type: type,
                ...metadata
              }
            }
          ]
        };
        
        // Debug log the request payload
        console.log(`Upserting point to Qdrant, id: ${id}, vector length: ${embedding.length}`);
        
        await this.client.upsert(collectionName, requestPayload);
        
        console.log(`Added ${type} to Qdrant memory: ${id}`);
        return id;
      } catch (error) {
        // If there's an error with the Qdrant upsert, log and use fallback
        console.error(`Error upserting to Qdrant: ${error instanceof Error ? error.message : String(error)}`);
        console.error(`Error details:`, error);
        this.useQdrant = false;
        return this.fallbackStorage.addMemory(collectionName, id, content, type, metadata);
      }
    } catch (error) {
      console.error(`Failed to add ${type} to Qdrant memory, using fallback:`, error);
      this.useQdrant = false;
      
      // Use fallback storage
      const id = `${type}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const collectionName = COLLECTIONS[type];
      
      if (!metadata.timestamp) {
        metadata.timestamp = new Date().toISOString();
      }
      
      return this.fallbackStorage.addMemory(collectionName, id, content, type, metadata);
    }
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
      
      // Define limit and filter
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
      
      // Build Qdrant filter from options
      const filter = options.filter ? this.buildQdrantFilter(options.filter) : undefined;
      
      // Search each collection and combine results
      const results = await Promise.all(
        collectionsToSearch.map(async (collectionName) => {
          try {
            // Create and execute search
            const searchResult = await this.client.search(collectionName, {
              vector: queryEmbedding,
              limit,
              filter,
              with_payload: true
            });
            
            // Convert to our format
            return searchResult.map(result => {
              const payload = result.payload as any;
              return {
                id: result.id as string,
                text: payload.text,
                timestamp: payload.timestamp,
                type: payload.type,
                metadata: this.extractMetadata(payload)
              };
            });
          } catch (error) {
            console.error(`Error searching collection ${collectionName}:`, error);
            this.useQdrant = false;
            
            // Fall back to in-memory search
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
  
  private buildQdrantFilter(filter: Record<string, any>): any {
    // Convert our filter format to Qdrant's filter format
    const conditions = Object.entries(filter).map(([key, value]) => {
      return { key, match: { value } };
    });
    
    if (conditions.length === 0) {
      return undefined;
    }
    
    if (conditions.length === 1) {
      return conditions[0];
    }
    
    return { must: conditions };
  }
  
  private extractMetadata(payload: any): Record<string, any> {
    // Extract metadata fields from payload (excluding standard fields)
    const standardFields = ['text', 'timestamp', 'type'];
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
    
    try {
      const collectionName = COLLECTIONS[type];
      
      // If Qdrant is unavailable, use in-memory fallback
      if (!this.useQdrant) {
        return this.fallbackStorage.getRecentMemories(collectionName, limit);
      }
      
      // In Qdrant, we need to use scroll API to get recent memories
      // Let's sort by timestamp in the query
      const result = await this.client.scroll(collectionName, {
        limit,
        with_payload: true,
        with_vector: false
      });
      
      const memories = result.points.map((point: any) => {
        const payload = point.payload;
        return {
          id: point.id as string,
          text: payload.text,
          timestamp: payload.timestamp,
          type: payload.type,
          metadata: this.extractMetadata(payload)
        };
      });
      
      // Sort by timestamp (newest first)
      return memories.sort((a, b) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      }).slice(0, limit);
    } catch (error) {
      console.error(`Failed to get recent ${type}s, using fallback:`, error);
      this.useQdrant = false;
      
      // Fall back to in-memory storage
      const collectionName = COLLECTIONS[type];
      return this.fallbackStorage.getRecentMemories(collectionName, limit);
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
}

// Singleton instance
let qdrantInstance: QdrantHandler | null = null;

// Public API
export async function initMemory(options?: {
  qdrantUrl?: string;
  qdrantApiKey?: string;
  useOpenAI?: boolean;
  forceReinit?: boolean;
  connectionTimeout?: number;
}): Promise<void> {
  if (!qdrantInstance || options?.forceReinit) {
    qdrantInstance = new QdrantHandler({
      qdrantUrl: options?.qdrantUrl || process.env.QDRANT_URL || 'http://localhost:6333',
      qdrantApiKey: options?.qdrantApiKey || process.env.QDRANT_API_KEY,
      useOpenAI: options?.useOpenAI || process.env.USE_OPENAI_EMBEDDINGS === 'true',
      openAIModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
      connectionTimeout: options?.connectionTimeout || 5000
    });
  }
  
  await qdrantInstance.initialize();
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