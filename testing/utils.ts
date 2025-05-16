/**
 * Testing utilities for memory system
 */
import { MemoryType } from '../src/server/memory/config';
import { BaseMemorySchema, MemoryPoint } from '../src/server/memory/models';
import { IMemoryClient } from '../src/server/memory/services/client/types';
import { EmbeddingService, EmbeddingResult } from '../src/server/memory/services/client/embedding-service';

/**
 * Create a mock embedding service that returns deterministic embeddings
 */
export class MockEmbeddingService extends EmbeddingService {
  /**
   * Generate a deterministic embedding based on content
   */
  async getEmbedding(text: string): Promise<EmbeddingResult> {
    // Generate a deterministic vector based on the text content
    const hash = this.simpleHash(text);
    const dimensions = 4; // Small dimension for testing
    
    const embedding = Array.from({ length: dimensions }, (_, i) => {
      // Generate a value between -1 and 1 based on the hash and position
      return (((hash + i) % 100) / 50) - 1;
    });
    
    return {
      embedding,
      model: 'mock-embedding-model',
      usedFallback: false
    };
  }
  
  /**
   * Generate batch embeddings (mock implementation)
   */
  async getBatchEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    
    for (const text of texts) {
      results.push(await this.getEmbedding(text));
    }
    
    return results;
  }
  
  /**
   * Simple string hash function for testing
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

/**
 * Mock memory client for testing
 */
export class MockMemoryClient implements IMemoryClient {
  // In-memory storage
  private collections: Map<string, Map<string, MemoryPoint<any>>> = new Map();
  private initialized: boolean = true;
  
  /**
   * Initialize the client
   */
  async initialize(): Promise<void> {
    this.initialized = true;
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
  async getStatus(): Promise<any> {
    return {
      initialized: this.initialized,
      connected: true,
      collectionsReady: Array.from(this.collections.keys()),
      usingFallback: false
    };
  }
  
  /**
   * Check if a collection exists
   */
  async collectionExists(collectionName: string): Promise<boolean> {
    return this.collections.has(collectionName);
  }
  
  /**
   * Create a collection
   */
  async createCollection(collectionName: string, dimensions: number): Promise<boolean> {
    if (!this.collections.has(collectionName)) {
      this.collections.set(collectionName, new Map());
    }
    return true;
  }
  
  /**
   * Add a point to a collection
   */
  async addPoint<T extends BaseMemorySchema>(
    collectionName: string,
    point: MemoryPoint<T>
  ): Promise<string> {
    if (!this.collections.has(collectionName)) {
      await this.createCollection(collectionName, point.vector.length);
    }
    
    const collection = this.collections.get(collectionName)!;
    collection.set(point.id, { ...point });
    
    return point.id;
  }
  
  /**
   * Get points by IDs
   */
  async getPoints<T extends BaseMemorySchema>(
    collectionName: string,
    ids: string[]
  ): Promise<MemoryPoint<T>[]> {
    if (!this.collections.has(collectionName)) {
      return [];
    }
    
    const collection = this.collections.get(collectionName)!;
    return ids
      .filter(id => collection.has(id))
      .map(id => ({ ...collection.get(id)! })) as MemoryPoint<T>[];
  }
  
  /**
   * Search for points
   */
  async searchPoints<T extends BaseMemorySchema>(
    collectionName: string,
    query: any
  ): Promise<any[]> {
    if (!this.collections.has(collectionName)) {
      return [];
    }
    
    const collection = this.collections.get(collectionName)!;
    const points = Array.from(collection.values());
    
    // Simple mock search - in a real implementation, this would do vector similarity
    return points.map(point => ({
      id: point.id,
      score: 0.9, // Mock score
      payload: point.payload
    }));
  }
  
  /**
   * Update a point
   */
  async updatePoint<T extends BaseMemorySchema>(
    collectionName: string,
    id: string,
    updates: Partial<MemoryPoint<T>>
  ): Promise<boolean> {
    if (!this.collections.has(collectionName)) {
      return false;
    }
    
    const collection = this.collections.get(collectionName)!;
    
    if (!collection.has(id)) {
      return false;
    }
    
    const point = collection.get(id)!;
    
    // Apply updates
    if (updates.vector) {
      point.vector = [...updates.vector];
    }
    
    if (updates.payload) {
      point.payload = {
        ...point.payload,
        ...updates.payload
      };
    }
    
    collection.set(id, point);
    return true;
  }
  
  /**
   * Delete a point
   */
  async deletePoint(
    collectionName: string,
    id: string,
    options?: any
  ): Promise<boolean> {
    if (!this.collections.has(collectionName)) {
      return false;
    }
    
    const collection = this.collections.get(collectionName)!;
    
    // Handle soft delete
    if (options?.hardDelete === false) {
      if (collection.has(id)) {
        const point = collection.get(id)!;
        point.payload.is_deleted = true;
        collection.set(id, point);
        return true;
      }
      return false;
    }
    
    // Hard delete
    return collection.delete(id);
  }
  
  /**
   * Add multiple points
   */
  async addPoints<T extends BaseMemorySchema>(
    collectionName: string,
    points: MemoryPoint<T>[]
  ): Promise<string[]> {
    const ids: string[] = [];
    
    for (const point of points) {
      const id = await this.addPoint(collectionName, point);
      ids.push(id);
    }
    
    return ids;
  }
  
  /**
   * Scroll through points (pagination)
   */
  async scrollPoints<T extends BaseMemorySchema>(
    collectionName: string,
    filter?: any,
    limit?: number,
    offset?: number
  ): Promise<MemoryPoint<T>[]> {
    if (!this.collections.has(collectionName)) {
      return [];
    }
    
    const collection = this.collections.get(collectionName)!;
    let points = Array.from(collection.values()) as MemoryPoint<T>[];
    
    // Apply offset and limit
    const start = offset || 0;
    const end = limit ? start + limit : undefined;
    
    return points.slice(start, end);
  }
  
  /**
   * Get count of points in a collection
   */
  async getPointCount(
    collectionName: string,
    filter?: any
  ): Promise<number> {
    if (!this.collections.has(collectionName)) {
      return 0;
    }
    
    return this.collections.get(collectionName)!.size;
  }
  
  /**
   * Clear all collections (for testing)
   */
  clearAll(): void {
    this.collections.clear();
  }

  /**
   * Get collection information
   */
  async getCollectionInfo(collectionName: string): Promise<{ 
    name: string; 
    dimensions: number; 
    pointsCount: number; 
    createdAt: Date 
  } | null> {
    if (!this.collections.has(collectionName)) {
      return null;
    }
    
    const collection = this.collections.get(collectionName)!;
    // Use the first point to get dimensions, or default to 1536
    const firstPoint = collection.size > 0 ? 
      Array.from(collection.values())[0] : 
      null;
    
    return {
      name: collectionName,
      dimensions: firstPoint?.vector.length || 1536,
      pointsCount: collection.size,
      createdAt: new Date()
    };
  }
}

/**
 * Generate test memory data
 */
export function generateTestMemory<T extends BaseMemorySchema>(
  type: MemoryType,
  content: string,
  overrides?: Partial<T>,
  id?: string
): MemoryPoint<T> {
  // Create a mock embedding vector
  const mockEmbeddingService = new MockEmbeddingService();
  const embeddingPromise = mockEmbeddingService.getEmbedding(content);
  
  // Generate a default memory point
  const memory: MemoryPoint<T> = {
    id: id || `test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    vector: [],
    payload: {
      id: id || `test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      text: content,
      timestamp: new Date().toISOString(),
      type,
      metadata: {
        importance: 'medium',
      }
    } as unknown as T
  };
  
  // Apply any overrides
  if (overrides) {
    memory.payload = {
      ...memory.payload,
      ...overrides
    } as T;
  }
  
  // Asynchronously set the vector (this is a simplification for testing)
  embeddingPromise.then(result => {
    memory.vector = result.embedding;
  });
  
  return memory;
}

/**
 * Generate a batch of test memories
 */
export function generateTestMemories<T extends BaseMemorySchema>(
  type: MemoryType,
  count: number,
  baseContent: string
): MemoryPoint<T>[] {
  const memories: MemoryPoint<T>[] = [];
  
  for (let i = 0; i < count; i++) {
    memories.push(
      generateTestMemory<T>(
        type,
        `${baseContent} ${i + 1}`,
        undefined,
        `test-${i + 1}`
      )
    );
  }
  
  return memories;
} 