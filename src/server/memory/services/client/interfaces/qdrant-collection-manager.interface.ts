/**
 * Interface for QdrantCollectionManager to handle collection operations
 */

import { IQdrantConnection } from './qdrant-connection.interface';

/**
 * Options for creating a collection
 */
export interface CollectionCreateOptions {
  /**
   * Collection name
   */
  name: string;
  
  /**
   * Vector dimensions
   */
  dimensions: number;
  
  /**
   * Distance metric to use (defaults to "Cosine")
   */
  distance?: 'Cosine' | 'Euclid' | 'Dot';
  
  /**
   * Sharding configuration
   */
  sharding?: {
    /**
     * Number of shards to create
     */
    shardNumber?: number;
    
    /**
     * Replication factor
     */
    replicationFactor?: number;
  };
  
  /**
   * Initial field indices to create
   */
  initialIndices?: Array<{
    /**
     * Field name to index
     */
    fieldName: string;
    
    /**
     * Field schema type
     */
    fieldSchema: 'keyword' | 'integer' | 'float' | 'geo' | 'text' | 'bool' | 'datetime';
  }>;
}

/**
 * Information about a collection
 */
export interface CollectionInfo {
  /**
   * Collection name
   */
  name: string;
  
  /**
   * Vector dimensions
   */
  dimensions: number;
  
  /**
   * Number of points in the collection
   */
  pointsCount: number;
  
  /**
   * Collection creation timestamp
   */
  createdAt: Date;
}

/**
 * Interface for QdrantCollectionManager
 */
export interface IQdrantCollectionManager {
  /**
   * Initialize the collection manager with a connection
   * @param connection Qdrant connection
   */
  initialize(connection: IQdrantConnection): Promise<void>;
  
  /**
   * Create a new collection
   * @param options Collection creation options
   */
  createCollection(options: CollectionCreateOptions): Promise<boolean>;
  
  /**
   * Check if a collection exists
   * @param collectionName Name of the collection
   */
  collectionExists(collectionName: string): Promise<boolean>;
  
  /**
   * Get information about a collection
   * @param collectionName Name of the collection
   */
  getCollectionInfo(collectionName: string): Promise<CollectionInfo | null>;
  
  /**
   * Create indices on a collection
   * @param collectionName Name of the collection
   * @param indices Indices to create
   */
  createIndices(
    collectionName: string,
    indices: Array<{
      fieldName: string;
      fieldSchema: string;
    }>
  ): Promise<boolean>;
  
  /**
   * Get the list of all collections
   */
  listCollections(): Promise<string[]>;
  
  /**
   * Delete a collection
   * @param collectionName Name of the collection
   */
  deleteCollection(collectionName: string): Promise<boolean>;
  
  /**
   * Get the point count for a collection
   * @param collectionName Name of the collection
   * @param filter Optional filter to apply
   */
  getPointCount(
    collectionName: string, 
    filter?: Record<string, unknown>
  ): Promise<number>;
} 