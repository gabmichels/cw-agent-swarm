/**
 * Visualization Storage Service
 * 
 * This service provides dedicated database storage for agent thinking visualizations.
 * This is completely separate from the memory system, as visualizations are not memories.
 * 
 * It uses a dedicated database collection for visualizations, with appropriate indexes
 * to support efficient querying by chatId, messageId, userId, agentId, and requestId.
 */

import { ThinkingVisualization } from './types';
import { QdrantClient } from '@qdrant/js-client-rest';
import { v4 as uuidv4 } from 'uuid';

/**
 * Database collection name for visualizations
 */
export const VISUALIZATION_COLLECTION = 'thinking_visualizations';

/**
 * Interface for visualization storage service
 */
export interface VisualizationStorageService {
  /**
   * Initialize the storage service
   */
  initialize(): Promise<void>;
  
  /**
   * Save a visualization to storage
   * @param visualization The visualization to save
   * @returns The visualization ID
   */
  saveVisualization(visualization: ThinkingVisualization): Promise<string | null>;
  
  /**
   * Get visualizations for a chat
   * @param chatId The chat ID
   * @param messageId Optional message ID filter
   * @returns Array of visualizations
   */
  getVisualizations(chatId: string, messageId?: string): Promise<ThinkingVisualization[]>;
  
  /**
   * Get a specific visualization by ID
   * @param id The visualization ID
   * @returns The visualization or null if not found
   */
  getVisualization(id: string): Promise<ThinkingVisualization | null>;
  
  /**
   * Delete a visualization
   * @param id The visualization ID
   * @returns Whether the delete was successful
   */
  deleteVisualization(id: string): Promise<boolean>;
  
  /**
   * Close any open connections
   */
  shutdown(): Promise<void>;
}

/**
 * Direct implementation of VisualizationStorageService using QdrantClient
 * This avoids depending on the memory system, following proper separation of concerns
 */
export class QdrantVisualizationStorage implements VisualizationStorageService {
  private client: QdrantClient;
  private initialized = false;
  private collectionName: string;
  
  /**
   * Create a new QdrantVisualizationStorage
   * @param qdrantUrl URL of the Qdrant server
   * @param apiKey Optional API key for Qdrant
   * @param collectionName Custom collection name (defaults to VISUALIZATION_COLLECTION)
   */
  constructor(
    qdrantUrl: string = 'http://localhost:6333',
    apiKey?: string,
    collectionName: string = VISUALIZATION_COLLECTION
  ) {
    this.collectionName = collectionName;
    this.client = new QdrantClient({
      url: qdrantUrl,
      apiKey
    });
  }
  
  /**
   * Initialize the storage service
   * Creates the collection if it doesn't exist
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      console.log(`Initializing visualization storage with collection: ${this.collectionName}`);
      
      // Check if collection exists
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(c => c.name === this.collectionName);
      
      if (!exists) {
        console.log(`Collection ${this.collectionName} does not exist, creating it...`);
        
        // Create collection with a single dimension (we don't use vectors for search)
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: 1, // Dummy vector size since we don't use embeddings for visualizations
            distance: 'Dot',
          },
        });
        
        // Create indices for efficient querying
        await this.createIndices();
        console.log(`Created collection and indices for ${this.collectionName}`);
      } else {
        console.log(`Collection ${this.collectionName} already exists`);
      }
      
      this.initialized = true;
      console.log(`Visualization storage initialized successfully`);
    } catch (error) {
      this.initialized = false;
      console.error('Failed to initialize visualization storage:', error);
      throw new Error(`Failed to initialize visualization storage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Create indices on the collection
   */
  private async createIndices(): Promise<void> {
    const indices = [
      { field_name: 'chatId', field_schema: 'keyword' as const },
      { field_name: 'messageId', field_schema: 'keyword' as const },
      { field_name: 'userId', field_schema: 'keyword' as const },
      { field_name: 'agentId', field_schema: 'keyword' as const },
      { field_name: 'requestId', field_schema: 'keyword' as const },
      { field_name: 'timestamp', field_schema: 'integer' as const }
    ];
    
    console.log(`Creating ${indices.length} indices for visualization collection`);
    
    for (const index of indices) {
      try {
        await this.client.createPayloadIndex(this.collectionName, {
          field_name: index.field_name,
          field_schema: index.field_schema
        });
        console.log(`Created index on ${index.field_name}`);
      } catch (error) {
        console.error(`Error creating index on ${index.field_name}:`, error);
        // Continue with other indices even if one fails
      }
    }
  }
  
  /**
   * Save a visualization to storage
   * @param visualization The visualization to save
   * @returns The visualization ID
   */
  async saveVisualization(visualization: ThinkingVisualization): Promise<string | null> {
    try {
      if (!this.initialized) await this.initialize();
      
      // Ensure the visualization has an ID
      const id = visualization.id || uuidv4();
      
      // Create a dummy vector (we don't use vector search for visualizations)
      const dummyVector = [0.0];
      
      // Save visualization with its ID
      await this.client.upsert(this.collectionName, {
        wait: true,
        points: [
          {
            id,
            vector: dummyVector,
            payload: visualization as unknown as Record<string, unknown>
          }
        ]
      });
      
      return id;
    } catch (error) {
      console.error('Error saving visualization:', error);
      return null;
    }
  }
  
  /**
   * Get visualizations for a chat
   * @param chatId The chat ID
   * @param messageId Optional message ID filter
   * @returns Array of visualizations
   */
  async getVisualizations(chatId: string, messageId?: string): Promise<ThinkingVisualization[]> {
    try {
      if (!this.initialized) await this.initialize();
      
      // Build filter
      const filter: any = {
        must: [
          {
            key: 'chatId',
            match: {
              value: chatId
            }
          }
        ]
      };
      
      // Add messageId filter if provided
      if (messageId) {
        filter.must.push({
          key: 'messageId',
          match: {
            value: messageId
          }
        });
      }
      
      // Fetch from database using scroll to get all matching visualizations
      const response = await this.client.scroll(this.collectionName, {
        filter,
        limit: 100,
        with_payload: true,
        with_vector: false
      });
      
      // Extract visualizations from response
      return response.points
        .map(point => point.payload as unknown as ThinkingVisualization)
        .filter(viz => viz !== null);
    } catch (error) {
      console.error('Error getting visualizations:', error);
      return [];
    }
  }
  
  /**
   * Get a specific visualization by ID
   * @param id The visualization ID
   * @returns The visualization or null if not found
   */
  async getVisualization(id: string): Promise<ThinkingVisualization | null> {
    try {
      if (!this.initialized) await this.initialize();
      
      // Get the point by ID using the retrieve method
      const response = await this.client.retrieve(this.collectionName, {
        ids: [id],
        with_payload: true,
        with_vector: false
      });
      
      if (response.length === 0) {
        return null;
      }
      
      // Extract visualization from the retrieved point
      return response[0].payload as unknown as ThinkingVisualization;
    } catch (error) {
      console.error('Error getting visualization:', error);
      return null;
    }
  }
  
  /**
   * Delete a visualization
   * @param id The visualization ID
   * @returns Whether the delete was successful
   */
  async deleteVisualization(id: string): Promise<boolean> {
    try {
      if (!this.initialized) await this.initialize();
      
      // Delete the point directly using the delete method
      await this.client.delete(this.collectionName, {
        points: [id],
        wait: true
      });
      
      return true;
    } catch (error) {
      console.error('Error deleting visualization:', error);
      return false;
    }
  }
  
  /**
   * Close any open connections
   */
  async shutdown(): Promise<void> {
    this.initialized = false;
  }
}

/**
 * Factory function to create a visualization storage service
 */
export async function createVisualizationStorageService(): Promise<VisualizationStorageService> {
  const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
  const apiKey = process.env.QDRANT_API_KEY;
  
  const storage = new QdrantVisualizationStorage(qdrantUrl, apiKey);
  await storage.initialize();
  
  return storage;
} 