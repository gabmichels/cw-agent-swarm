/**
 * Vector Database Adapter
 * 
 * Adapts the QdrantMemoryClient to implement the IVectorDatabaseClient interface
 * required by the QueryOptimizer.
 */

import { StructuredId } from '../../../../utils/ulid';
import { IMemoryClient } from './types';
import { IVectorDatabaseClient, DatabaseRecord } from '../base/types';
import { BaseMemorySchema, MemoryPoint } from '../../models';
import { FilterOptions } from '../base/types';

/**
 * Search results interface for vector database
 */
interface SearchResults {
  matches: Array<{
    id: string;
    score: number;
    payload: Record<string, unknown>;
  }>;
  totalCount: number;
}

/**
 * Adapter for QdrantMemoryClient to implement IVectorDatabaseClient
 */
export class VectorDatabaseAdapter implements IVectorDatabaseClient {
  /**
   * Constructor 
   * 
   * @param client The memory client to adapt
   */
  constructor(private readonly client: IMemoryClient) {}

  /**
   * Add a point to the vector database
   * 
   * @param collectionName Collection name
   * @param point Point data
   * @returns ID of the added point
   */
  async addPoint(collectionName: string, point: DatabaseRecord): Promise<string> {
    // Adapt the DatabaseRecord to the format expected by QdrantMemoryClient
    const adaptedPoint: MemoryPoint<BaseMemorySchema> = {
      id: point.id,
      vector: point.vector,
      payload: {
        id: point.id,
        text: point.payload.text as string || '',
        timestamp: (point.payload.timestamp as string) || new Date().toISOString(),
        type: point.payload.type as any || 'unknown',
        metadata: point.payload.metadata as any || {}
      }
    };

    // Call the underlying client
    return this.client.addPoint(collectionName, adaptedPoint);
  }

  /**
   * Search for similar points in the vector database
   * 
   * @param collectionName Collection to search in
   * @param vector Embedding vector to search for
   * @param limit Maximum number of results
   * @param filter Optional filter conditions
   * @param scoreThreshold Minimum similarity score
   * @returns Search results
   */
  async search(
    collectionName: string,
    vector: number[],
    limit: number = 10,
    filter?: Record<string, any>,
    scoreThreshold?: number
  ): Promise<SearchResults> {
    const results = await this.client.searchPoints(collectionName, {
      vector,
      filter,
      limit,
      scoreThreshold
    });

    // Adapt the search results to the format expected by QueryOptimizer
    return {
      matches: results.map(result => ({
        id: result.id,
        score: result.score,
        payload: result.payload as unknown as Record<string, unknown>
      })),
      totalCount: results.length
    };
  }
  
  /**
   * Search points by vector similarity (required by IVectorDatabaseClient)
   * 
   * @param collectionName Collection to search in
   * @param vector Embedding vector to search for
   * @param options Search options
   * @returns Array of database records
   */
  async searchPoints(
    collectionName: string,
    vector: number[],
    options?: {
      limit?: number;
      scoreThreshold?: number;
      includeDeleted?: boolean;
      offset?: number;
    }
  ): Promise<DatabaseRecord[]> {
    const results = await this.client.searchPoints(collectionName, {
      vector,
      limit: options?.limit,
      scoreThreshold: options?.scoreThreshold
    });
    
    // Convert to DatabaseRecord format
    return results.map(result => ({
      id: result.id,
      vector: [],  // Client doesn't return vectors by default
      payload: result.payload as unknown as Record<string, unknown>
    }));
  }

  /**
   * Get points by IDs
   * 
   * @param collectionName Collection name
   * @param ids IDs of points to retrieve
   * @returns Array of database records
   */
  async getPoints(collectionName: string, ids: string[]): Promise<DatabaseRecord[]> {
    const points = await this.client.getPoints(collectionName, ids);
    
    // Convert to DatabaseRecord format
    return points.map(point => ({
      id: point.id,
      vector: point.vector,
      payload: point.payload as unknown as Record<string, unknown>
    }));
  }

  /**
   * Delete point from the vector database
   * 
   * @param collectionName Collection name
   * @param id ID of point to delete
   * @param options Delete options
   * @returns Whether deletion was successful
   */
  async deletePoint(
    collectionName: string,
    id: string,
    options?: { hardDelete?: boolean }
  ): Promise<boolean> {
    await this.client.deletePoint(collectionName, id, options);
    return true;
  }

  /**
   * Update a point in the vector database
   * 
   * @param collectionName Collection name
   * @param id ID of the point to update
   * @param updates Partial updates
   * @returns Boolean indicating success
   */
  async updatePoint(
    collectionName: string,
    id: string,
    updates: Partial<DatabaseRecord>
  ): Promise<boolean> {
    // Adapt the updates to the format expected by QdrantMemoryClient
    const adaptedUpdates: Partial<MemoryPoint<BaseMemorySchema>> = {};
    
    if (updates.vector) {
      adaptedUpdates.vector = updates.vector;
    }
    
    if (updates.payload) {
      adaptedUpdates.payload = {
        ...updates.payload as any
      };
    }

    // Call the underlying client
    await this.client.updatePoint(collectionName, id, adaptedUpdates);
    return true;
  }
} 