/**
 * Implementation of QdrantCollectionManager for managing Qdrant collections
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { 
  IQdrantCollectionManager, 
  CollectionCreateOptions, 
  CollectionInfo 
} from './interfaces/qdrant-collection-manager.interface';
import { IQdrantConnection } from './interfaces/qdrant-connection.interface';
import { DEFAULTS } from '../../config';

// Type for field schema in Qdrant
type QdrantFieldSchema = 
  | 'keyword' 
  | 'integer' 
  | 'float' 
  | 'geo' 
  | 'text' 
  | 'bool' 
  | 'datetime';

/**
 * Implementation of QdrantCollectionManager
 */
export class QdrantCollectionManager implements IQdrantCollectionManager {
  private connection: IQdrantConnection | null = null;
  
  /**
   * Initialize the collection manager with a connection
   * @param connection Qdrant connection
   */
  async initialize(connection: IQdrantConnection): Promise<void> {
    this.connection = connection;
    
    // Test connection by checking if we can list collections
    try {
      await this.connection.executeWithClient(client => client.getCollections());
    } catch (error) {
      throw new Error(`Failed to initialize QdrantCollectionManager: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Create a new collection
   * @param options Collection creation options
   */
  async createCollection(options: CollectionCreateOptions): Promise<boolean> {
    if (!this.connection) {
      throw new Error('Collection manager not initialized');
    }
    
    try {
      // Check if collection already exists
      const exists = await this.collectionExists(options.name);
      if (exists) {
        console.warn(`Collection '${options.name}' already exists`);
        return false;
      }
      
      // Create collection
      await this.connection.executeWithClient(client => 
        client.createCollection(options.name, {
          vectors: {
            size: options.dimensions,
            distance: options.distance || 'Cosine'
          },
          optimizers_config: {
            ...(options.sharding && {
              indexing_threshold: options.sharding.shardNumber || 20000,
              ...(options.sharding.replicationFactor && {
                params: {
                  replication_factor: options.sharding.replicationFactor
                }
              })
            })
          }
        })
      );
      
      // Create initial indices if provided
      if (options.initialIndices && options.initialIndices.length > 0) {
        await this.createIndices(options.name, options.initialIndices);
      }
      
      return true;
    } catch (error) {
      console.error(`Failed to create collection '${options.name}':`, error);
      throw new Error(`Failed to create collection: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Check if a collection exists
   * @param collectionName Name of the collection
   */
  async collectionExists(collectionName: string): Promise<boolean> {
    if (!this.connection) {
      throw new Error('Collection manager not initialized');
    }
    
    try {
      const collections = await this.connection.executeWithClient(client => 
        client.getCollections()
      );
      
      return collections.collections.some(collection => 
        collection.name === collectionName
      );
    } catch (error) {
      console.error(`Failed to check if collection '${collectionName}' exists:`, error);
      throw new Error(`Failed to check collection existence: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get information about a collection
   * @param collectionName Name of the collection
   */
  async getCollectionInfo(collectionName: string): Promise<CollectionInfo | null> {
    if (!this.connection) {
      throw new Error('Collection manager not initialized');
    }
    
    try {
      // Check if collection exists
      const exists = await this.collectionExists(collectionName);
      if (!exists) {
        return null;
      }
      
      // Get collection info
      const info = await this.connection.executeWithClient(client => 
        client.getCollection(collectionName)
      );
      
      // Extract dimensions from vector configuration
      let dimensions = DEFAULTS.DIMENSIONS; // Default
      
      // Handle different Qdrant versions and their vector configuration formats
      if (info.config?.params?.vectors) {
        const vectorsConfig = info.config.params.vectors as Record<string, unknown>;
        
        // Check if vectors is a named map (newer Qdrant) or direct config (older Qdrant)
        if (typeof vectorsConfig === 'object' && !Array.isArray(vectorsConfig)) {
          // Try to extract from first vector namespace or use default dimensions
          const vectorNames = Object.keys(vectorsConfig);
          if (vectorNames.length > 0) {
            const firstVectorName = vectorNames[0];
            const firstVectorConfig = vectorsConfig[firstVectorName] as Record<string, unknown> | undefined;
            if (firstVectorConfig && typeof firstVectorConfig === 'object' && 'size' in firstVectorConfig) {
              dimensions = (firstVectorConfig.size as number) || DEFAULTS.DIMENSIONS;
            }
          }
        }
      }
      
      return {
        name: collectionName,
        dimensions,
        pointsCount: info.vectors_count || 0,
        createdAt: new Date()  // Qdrant API doesn't reliably provide creation time
      };
    } catch (error) {
      console.error(`Failed to get info for collection '${collectionName}':`, error);
      throw new Error(`Failed to get collection info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Create indices on a collection
   * @param collectionName Name of the collection
   * @param indices Indices to create
   */
  async createIndices(
    collectionName: string,
    indices: Array<{
      fieldName: string;
      fieldSchema: string;
    }>
  ): Promise<boolean> {
    if (!this.connection) {
      throw new Error('Collection manager not initialized');
    }
    
    try {
      // Check if collection exists
      const exists = await this.collectionExists(collectionName);
      if (!exists) {
        throw new Error(`Collection '${collectionName}' does not exist`);
      }
      
      // Create each index
      for (const index of indices) {
        const fieldSchema = this.mapSchemaType(index.fieldSchema);
        
        await this.connection.executeWithClient(client => 
          client.createPayloadIndex(
            collectionName,
            {
              field_name: index.fieldName,
              field_schema: fieldSchema
            }
          )
        );
      }
      
      return true;
    } catch (error) {
      console.error(`Failed to create indices for collection '${collectionName}':`, error);
      throw new Error(`Failed to create indices: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get the list of all collections
   */
  async listCollections(): Promise<string[]> {
    if (!this.connection) {
      throw new Error('Collection manager not initialized');
    }
    
    try {
      const collections = await this.connection.executeWithClient(client => 
        client.getCollections()
      );
      
      return collections.collections.map(collection => collection.name);
    } catch (error) {
      console.error('Failed to list collections:', error);
      throw new Error(`Failed to list collections: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Delete a collection
   * @param collectionName Name of the collection
   */
  async deleteCollection(collectionName: string): Promise<boolean> {
    if (!this.connection) {
      throw new Error('Collection manager not initialized');
    }
    
    try {
      // Check if collection exists
      const exists = await this.collectionExists(collectionName);
      if (!exists) {
        console.warn(`Collection '${collectionName}' does not exist`);
        return false;
      }
      
      // Delete collection
      await this.connection.executeWithClient(client => 
        client.deleteCollection(collectionName)
      );
      
      return true;
    } catch (error) {
      console.error(`Failed to delete collection '${collectionName}':`, error);
      throw new Error(`Failed to delete collection: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get the point count for a collection
   * @param collectionName Name of the collection
   * @param filter Optional filter to apply
   */
  async getPointCount(
    collectionName: string, 
    filter?: Record<string, unknown>
  ): Promise<number> {
    if (!this.connection) {
      throw new Error('Collection manager not initialized');
    }
    
    try {
      // Check if collection exists
      const exists = await this.collectionExists(collectionName);
      if (!exists) {
        throw new Error(`Collection '${collectionName}' does not exist`);
      }
      
      // If filter is provided, count with filter
      if (filter) {
        const countResult = await this.connection.executeWithClient(client => 
          client.count(collectionName, { filter })
        );
        
        return countResult.count;
      }
      
      // Otherwise get collection info for total count
      const info = await this.connection.executeWithClient(client => 
        client.getCollection(collectionName)
      );
      
      return info.vectors_count || 0;
    } catch (error) {
      console.error(`Failed to get point count for collection '${collectionName}':`, error);
      throw new Error(`Failed to get point count: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Map schema type from interface format to Qdrant format
   * @param schemaType Schema type from interface
   * @returns Qdrant schema type
   */
  private mapSchemaType(schemaType: string): QdrantFieldSchema {
    switch (schemaType.toLowerCase()) {
      case 'keyword':
        return 'keyword';
      case 'integer':
        return 'integer';
      case 'float':
        return 'float';
      case 'geo':
        return 'geo';
      case 'text':
        return 'text';
      case 'bool':
        return 'bool';
      case 'datetime':
        return 'datetime';
      default:
        throw new Error(`Unsupported schema type: ${schemaType}`);
    }
  }
} 