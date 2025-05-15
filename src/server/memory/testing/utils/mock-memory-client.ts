/**
 * Mock Memory Client for testing
 */
import { BaseMemorySchema, MemoryPoint, MemorySearchResult } from '../../models';
import { ClientStatus, DeleteOptions, IMemoryClient, SearchQuery } from '../../services/client/types';

/**
 * In-memory storage for the mock client
 */
class MemoryStorage {
  private collections: Map<string, Map<string, MemoryPoint<any>>> = new Map();
  
  /**
   * Add a point to a collection
   */
  addPoint<T extends BaseMemorySchema>(collectionName: string, point: MemoryPoint<T>): void {
    if (!this.collections.has(collectionName)) {
      this.collections.set(collectionName, new Map());
    }
    
    const collection = this.collections.get(collectionName)!;
    collection.set(point.id, point);
  }
  
  /**
   * Get points by IDs
   */
  getPoints<T extends BaseMemorySchema>(collectionName: string, ids: string[]): MemoryPoint<T>[] {
    if (!this.collections.has(collectionName)) {
      return [];
    }
    
    const collection = this.collections.get(collectionName)!;
    return ids
      .filter(id => collection.has(id))
      .map(id => collection.get(id) as MemoryPoint<T>);
  }
  
  /**
   * Get all points in a collection
   */
  getAllPoints<T extends BaseMemorySchema>(collectionName: string): MemoryPoint<T>[] {
    if (!this.collections.has(collectionName)) {
      return [];
    }
    
    const collection = this.collections.get(collectionName)!;
    return Array.from(collection.values()) as MemoryPoint<T>[];
  }
  
  /**
   * Update a point
   */
  updatePoint<T extends BaseMemorySchema>(
    collectionName: string, 
    id: string, 
    updates: Partial<MemoryPoint<T>>
  ): boolean {
    if (!this.collections.has(collectionName)) {
      return false;
    }
    
    const collection = this.collections.get(collectionName)!;
    
    if (!collection.has(id)) {
      return false;
    }
    
    const point = collection.get(id) as MemoryPoint<T>;
    
    // Create updated point with properly merged payload
    const updatedPoint: MemoryPoint<T> = {
      ...point,
      ...updates,
      payload: updates.payload ? {
        ...point.payload,
        ...updates.payload,
        metadata: {
          ...(point.payload.metadata || {}),
          ...(updates.payload.metadata || {})
        }
      } : point.payload
    };
    
    collection.set(id, updatedPoint);
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
   * Clear all collections
   */
  clear(): void {
    this.collections.clear();
  }
}

/**
 * Mock implementation of IMemoryClient for testing
 */
export class MockMemoryClient implements IMemoryClient {
  private storage: MemoryStorage;
  private initialized: boolean = false;
  private collections: Set<string> = new Set();
  
  constructor() {
    this.storage = new MemoryStorage();
    this.initialized = true;
  }
  
  /**
   * Initialize the mock client
   */
  async initialize(): Promise<void> {
    this.initialized = true;
  }
  
  /**
   * Check if initialized
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
      connected: true,
      collectionsReady: Array.from(this.collections),
      usingFallback: false
    };
  }
  
  /**
   * Check if collection exists
   */
  async collectionExists(collectionName: string): Promise<boolean> {
    return this.collections.has(collectionName);
  }
  
  /**
   * Create a collection
   */
  async createCollection(collectionName: string, dimensions: number): Promise<boolean> {
    this.collections.add(collectionName);
    return true;
  }
  
  /**
   * Add a point to a collection
   */
  async addPoint<T extends BaseMemorySchema>(
    collectionName: string,
    point: MemoryPoint<T>
  ): Promise<string> {
    // Ensure collection exists
    if (!this.collections.has(collectionName)) {
      await this.createCollection(collectionName, point.vector?.length || 1536);
    }
    
    this.storage.addPoint(collectionName, point);
    return point.id;
  }
  
  /**
   * Get points by IDs
   */
  async getPoints<T extends BaseMemorySchema>(
    collectionName: string,
    ids: string[]
  ): Promise<MemoryPoint<T>[]> {
    return this.storage.getPoints(collectionName, ids);
  }
  
  /**
   * Simple cosine similarity for testing
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  
  /**
   * Simple filter function
   */
  private matchesFilter(point: MemoryPoint<any>, filter: any): boolean {
    if (!filter) {
      return true;
    }
    
    // Check each filter condition
    for (const [key, value] of Object.entries(filter)) {
      // Handle metadata fields
      if (key.startsWith('metadata.')) {
        const metadataKey = key.substring('metadata.'.length);
        const metadata = point.payload.metadata || {};
        
        if (metadata[metadataKey] !== value) {
          return false;
        }
      } 
      // Handle text search
      else if (key === '$text') {
        const textValue = (value as any).$contains;
        if (!point.payload.text.includes(textValue)) {
          return false;
        }
      }
      // Handle other fields
      else if (point.payload[key] !== value) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Search points
   */
  async searchPoints<T extends BaseMemorySchema>(
    collectionName: string,
    query: SearchQuery
  ): Promise<MemorySearchResult<T>[]> {
    // Get all points in the collection
    const points = this.storage.getAllPoints<T>(collectionName);
    
    // Filter points based on the provided filter
    const filteredPoints = points.filter(point => this.matchesFilter(point, query.filter));
    
    // Calculate similarity scores if vector is provided
    let scoredPoints: Array<{point: MemoryPoint<T>, score: number}> = [];
    
    if (query.vector) {
      scoredPoints = filteredPoints.map(point => ({
        point,
        score: point.vector ? this.cosineSimilarity(query.vector!, point.vector) : 0
      }));
    } else {
      // Default score of 1.0 if no vector search
      scoredPoints = filteredPoints.map(point => ({
        point,
        score: 1.0
      }));
    }
    
    // Apply score threshold if provided
    if (query.scoreThreshold) {
      scoredPoints = scoredPoints.filter(item => item.score >= query.scoreThreshold!);
    }
    
    // Sort by score (descending)
    scoredPoints.sort((a, b) => b.score - a.score);
    
    // Apply limit and offset
    const start = query.offset || 0;
    const end = query.limit ? start + query.limit : undefined;
    scoredPoints = scoredPoints.slice(start, end);
    
    // Convert to search results
    return scoredPoints.map(item => ({
      id: item.point.id,
      score: item.score,
      payload: item.point.payload
    }));
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
    // Get all points in the collection
    const points = this.storage.getAllPoints<T>(collectionName);
    
    // Filter points based on the provided filter
    const filteredPoints = filter ? 
      points.filter(point => this.matchesFilter(point, filter)) : 
      points;
    
    // Apply limit and offset
    const start = offset || 0;
    const end = limit ? start + limit : undefined;
    return filteredPoints.slice(start, end);
  }
  
  /**
   * Update a point
   */
  async updatePoint<T extends BaseMemorySchema>(
    collectionName: string,
    id: string,
    updates: Partial<MemoryPoint<T>>
  ): Promise<boolean> {
    return this.storage.updatePoint(collectionName, id, updates);
  }
  
  /**
   * Delete a point
   */
  async deletePoint(
    collectionName: string,
    id: string,
    options?: DeleteOptions
  ): Promise<boolean> {
    // If soft delete, update the point instead
    if (options && !options.hardDelete) {
      const updatePayload = {
        is_deleted: true,
        deletion_time: new Date().toISOString(),
        ...options.metadata
      };
      
      return this.updatePoint(collectionName, id, {
        payload: updatePayload as any
      });
    }
    
    // Hard delete
    return this.storage.deletePoint(collectionName, id);
  }
  
  /**
   * Add multiple points
   */
  async addPoints<T extends BaseMemorySchema>(
    collectionName: string,
    points: MemoryPoint<T>[]
  ): Promise<string[]> {
    // Ensure collection exists
    if (!this.collections.has(collectionName)) {
      await this.createCollection(collectionName, points[0]?.vector?.length || 1536);
    }
    
    // Add each point
    for (const point of points) {
      this.storage.addPoint(collectionName, point);
    }
    
    return points.map(point => point.id);
  }
  
  /**
   * Count points
   */
  async getPointCount(
    collectionName: string,
    filter?: any
  ): Promise<number> {
    const points = this.storage.getAllPoints(collectionName);
    
    if (filter) {
      return points.filter(point => this.matchesFilter(point, filter)).length;
    }
    
    return points.length;
  }
  
  /**
   * Reset mock for testing
   */
  reset(): void {
    this.storage.clear();
    this.collections.clear();
  }
  
  async getCollectionInfo(collectionName: string): Promise<{ name: string; dimensions: number; pointsCount: number; createdAt: Date } | null> {
    return Promise.resolve({
      name: collectionName,
      dimensions: 1536,
      pointsCount: 0,
      createdAt: new Date()
    });
  }
} 