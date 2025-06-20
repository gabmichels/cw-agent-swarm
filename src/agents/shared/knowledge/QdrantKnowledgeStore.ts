/**
 * QdrantKnowledgeStore.ts - Vector storage backend for knowledge graph
 * 
 * This replaces the in-memory storage in DefaultKnowledgeGraph with
 * Qdrant vector database for semantic search and persistent storage.
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { OpenAI } from 'openai';
import { ulid } from 'ulid';
import { KnowledgeNode, KnowledgeEdge, KnowledgeNodeType, KnowledgeEdgeType } from './interfaces/KnowledgeGraph.interface';

// Initialize OpenAI client for embeddings (only if API key is available)
let openai: OpenAI | null = null;

if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
} else {
  console.warn('⚠️ OPENAI_API_KEY not found. QdrantKnowledgeStore will use mock embeddings for testing.');
}

export interface QdrantKnowledgeStoreConfig {
  qdrantUrl?: string;
  qdrantApiKey?: string;
  nodeCollectionName?: string;
  edgeCollectionName?: string;
  embeddingModel?: string;
  vectorDimensions?: number;
}

export interface VectorSearchOptions {
  limit?: number;
  scoreThreshold?: number;
  nodeTypes?: KnowledgeNodeType[];
  tags?: string[];
}

export interface VectorSearchResult {
  node: KnowledgeNode;
  score: number;
  vector?: number[];
}

/**
 * Qdrant-based vector storage for knowledge graph nodes and edges
 * Provides semantic search capabilities with confidence scoring
 */
export class QdrantKnowledgeStore {
  private client: QdrantClient;
  private config: Required<QdrantKnowledgeStoreConfig>;
  private initialized: boolean = false;

  constructor(config: QdrantKnowledgeStoreConfig = {}) {
    this.config = {
      qdrantUrl: config.qdrantUrl || process.env.QDRANT_URL || 'http://localhost:6333',
      qdrantApiKey: config.qdrantApiKey || process.env.QDRANT_API_KEY || '',
      nodeCollectionName: config.nodeCollectionName || 'knowledge_nodes',
      edgeCollectionName: config.edgeCollectionName || 'knowledge_edges', 
      embeddingModel: config.embeddingModel || 'text-embedding-3-small',
      vectorDimensions: config.vectorDimensions || 1536 // text-embedding-3-small dimensions
    };

    this.client = new QdrantClient({
      url: this.config.qdrantUrl,
      apiKey: this.config.qdrantApiKey || undefined
    });
  }

  /**
   * Initialize Qdrant collections for nodes and edges
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    try {
      // Create nodes collection if it doesn't exist
      await this.ensureCollection(
        this.config.nodeCollectionName,
        this.config.vectorDimensions,
        {
          type: { type: 'keyword' },
          tags: { type: 'keyword' },
          createdAt: { type: 'datetime' },
          updatedAt: { type: 'datetime' }
        }
      );

      // Create edges collection if it doesn't exist
      await this.ensureCollection(
        this.config.edgeCollectionName,
        this.config.vectorDimensions,
        {
          type: { type: 'keyword' },
          from: { type: 'keyword' },
          to: { type: 'keyword' },
          strength: { type: 'float' },
          createdAt: { type: 'datetime' }
        }
      );

      this.initialized = true;
      console.log(`✅ QdrantKnowledgeStore initialized with collections: ${this.config.nodeCollectionName}, ${this.config.edgeCollectionName}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize QdrantKnowledgeStore:', error);
      return false;
    }
  }

  /**
   * Ensure a collection exists with the specified schema
   */
  private async ensureCollection(
    name: string, 
    vectorSize: number, 
    payloadSchema: Record<string, any>
  ): Promise<void> {
    try {
      // Check if collection exists
      const collections = await this.client.getCollections();
      const existingCollection = collections.collections.find(c => c.name === name);

      if (!existingCollection) {
        // Create the collection
        await this.client.createCollection(name, {
          vectors: {
            size: vectorSize,
            distance: 'Cosine'
          }
        });

        // Create payload indices for efficient filtering
        for (const [fieldName, fieldConfig] of Object.entries(payloadSchema)) {
          await this.client.createPayloadIndex(name, {
            field_name: fieldName,
            field_schema: fieldConfig.type
          });
        }

        console.log(`✅ Created Qdrant collection: ${name}`);
      } else {
        console.log(`✅ Collection already exists: ${name}`);
      }
    } catch (error) {
      console.error(`❌ Error ensuring collection ${name}:`, error);
      throw error;
    }
  }

  /**
   * Add a knowledge node to Qdrant with vector embedding
   */
  async addNode(node: Omit<KnowledgeNode, 'id'>): Promise<string> {
    if (!this.initialized) {
      throw new Error('QdrantKnowledgeStore not initialized');
    }

    const nodeId = ulid();
    const now = new Date();

    try {
      // Generate embedding for the node content
      const embeddingText = `${node.label}\n${node.description || ''}`;
      const vector = await this.generateEmbedding(embeddingText);

      // Prepare the full node object with string timestamps for storage
      const fullNode: KnowledgeNode = {
        id: nodeId,
        ...node,
        createdAt: now,
        updatedAt: now
      };

      // Convert to storage format with string timestamps
      const storagePayload = {
        ...fullNode,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        vectorDimensions: vector.length
      };

      // Store in Qdrant
      const upsertData: any = {
        id: nodeId,
        payload: storagePayload
      };
      
      if (vector) {
        upsertData.vector = vector;
      }

      await this.client.upsert(this.config.nodeCollectionName, {
        wait: true,
        points: [upsertData]
      });

      console.log(`✅ Added node to Qdrant: ${nodeId} (${node.label})`);
      return nodeId;
    } catch (error) {
      console.error(`❌ Failed to add node to Qdrant:`, error);
      throw error;
    }
  }

  /**
   * Get a node by ID from Qdrant
   */
  async getNode(id: string): Promise<KnowledgeNode | null> {
    if (!this.initialized) {
      throw new Error('QdrantKnowledgeStore not initialized');
    }

    try {
      const result = await this.client.retrieve(this.config.nodeCollectionName, {
        ids: [id],
        with_payload: true
      });

      if (result.length === 0) {
        return null;
      }

      const point = result[0];
      const payload = point.payload as any;
      
      // Convert back to KnowledgeNode format
      const node: KnowledgeNode = {
        id: payload.id,
        label: payload.label,
        type: payload.type,
        description: payload.description,
        tags: payload.tags,
        createdAt: payload.createdAt ? new Date(payload.createdAt) : undefined,
        updatedAt: payload.updatedAt ? new Date(payload.updatedAt) : undefined,
        importance: payload.importance,
        confidence: payload.confidence,
        source: payload.source,
        properties: payload.properties,
        metadata: payload.metadata
      };
      
      return node;
    } catch (error) {
      console.error(`❌ Failed to get node from Qdrant: ${id}`, error);
      return null;
    }
  }

  /**
   * Search nodes using vector similarity search
   */
  async searchNodes(
    query: string, 
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchResult[]> {
    if (!this.initialized) {
      throw new Error('QdrantKnowledgeStore not initialized');
    }

    try {
      // Generate embedding for the query
      const queryVector = await this.generateEmbedding(query);

      // Build Qdrant filter conditions
      const filter: any = { must: [] };

      if (options.nodeTypes && options.nodeTypes.length > 0) {
        filter.must.push({
          key: 'type',
          match: { any: options.nodeTypes }
        });
      }

      if (options.tags && options.tags.length > 0) {
        filter.must.push({
          key: 'tags',
          match: { any: options.tags }
        });
      }

      // Perform vector search
      const searchResult = await this.client.search(this.config.nodeCollectionName, {
        vector: queryVector,
        limit: options.limit || 10,
        score_threshold: options.scoreThreshold || 0.6,
        filter: filter.must.length > 0 ? filter : undefined,
        with_payload: true,
        with_vector: false
      });

      // Convert to our result format
      return searchResult.map(point => {
        const payload = point.payload as any;
        const node: KnowledgeNode = {
          id: payload.id,
          label: payload.label,
          type: payload.type,
          description: payload.description,
          tags: payload.tags,
          createdAt: payload.createdAt ? new Date(payload.createdAt) : undefined,
          updatedAt: payload.updatedAt ? new Date(payload.updatedAt) : undefined,
          importance: payload.importance,
          confidence: payload.confidence,
          source: payload.source,
          properties: payload.properties,
          metadata: payload.metadata
        };
        
        return {
          node,
          score: point.score || 0
        };
      });
    } catch (error) {
      console.error(`❌ Failed to search nodes in Qdrant:`, error);
      throw error;
    }
  }

  /**
   * Update a node in Qdrant
   */
  async updateNode(id: string, updates: Partial<KnowledgeNode>): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('QdrantKnowledgeStore not initialized');
    }

    try {
      // Get the existing node
      const existingNode = await this.getNode(id);
      if (!existingNode) {
        return false;
      }

      // Merge updates with existing node
      const updatedNode: KnowledgeNode = {
        ...existingNode,
        ...updates,
        id, // Ensure ID doesn't change
        updatedAt: new Date()
      };

      // Generate new embedding if content changed
      let vector: number[] | undefined;
      if (updates.label || updates.description) {
        const embeddingText = `${updatedNode.label}\n${updatedNode.description || ''}`;
        vector = await this.generateEmbedding(embeddingText);
      }

      // Convert to storage format
      const storagePayload = {
        ...updatedNode,
        createdAt: updatedNode.createdAt?.toISOString(),
        updatedAt: updatedNode.updatedAt?.toISOString()
      };

      // Update in Qdrant
      const upsertData: any = {
        id,
        payload: storagePayload
      };
      
      if (vector) {
        upsertData.vector = vector;
      }

      await this.client.upsert(this.config.nodeCollectionName, {
        wait: true,
        points: [upsertData]
      });

      console.log(`✅ Updated node in Qdrant: ${id}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to update node in Qdrant: ${id}`, error);
      return false;
    }
  }

  /**
   * Delete a node from Qdrant
   */
  async deleteNode(id: string): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('QdrantKnowledgeStore not initialized');
    }

    try {
      await this.client.delete(this.config.nodeCollectionName, {
        wait: true,
        points: [id]
      });

      console.log(`✅ Deleted node from Qdrant: ${id}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to delete node from Qdrant: ${id}`, error);
      return false;
    }
  }

  /**
   * Add an edge to Qdrant with vector embedding of relationship description
   */
  async addEdge(edge: KnowledgeEdge): Promise<string> {
    if (!this.initialized) {
      throw new Error('QdrantKnowledgeStore not initialized');
    }

    const edgeId = ulid();
    const now = new Date();

    try {
      // Generate embedding for the edge description
      const embeddingText = `${edge.type}: ${edge.label || ''}`;
      const vector = await this.generateEmbedding(embeddingText);

      // Prepare the full edge object with string timestamps for storage
      const storagePayload = {
        id: edgeId,
        ...edge,
        createdAt: now.toISOString()
      };

      // Store in Qdrant
      await this.client.upsert(this.config.edgeCollectionName, {
        wait: true,
        points: [{
          id: edgeId,
          vector,
          payload: storagePayload
        }]
      });

      console.log(`✅ Added edge to Qdrant: ${edgeId} (${edge.from} -> ${edge.to})`);
      return edgeId;
    } catch (error) {
      console.error(`❌ Failed to add edge to Qdrant:`, error);
      throw error;
    }
  }

  /**
   * Get edges for a node from Qdrant
   */
  async getEdges(
    nodeId: string, 
    direction: 'outgoing' | 'incoming' | 'both' = 'both'
  ): Promise<KnowledgeEdge[]> {
    if (!this.initialized) {
      throw new Error('QdrantKnowledgeStore not initialized');
    }

    try {
      const filter: any = { must: [] };

      if (direction === 'outgoing') {
        filter.must.push({ key: 'from', match: { value: nodeId } });
      } else if (direction === 'incoming') {
        filter.must.push({ key: 'to', match: { value: nodeId } });
      } else {
        // Both directions
        filter.should = [
          { key: 'from', match: { value: nodeId } },
          { key: 'to', match: { value: nodeId } }
        ];
      }

      const searchResult = await this.client.scroll(this.config.edgeCollectionName, {
        filter,
        limit: 1000, // Reasonable limit for edges
        with_payload: true,
        with_vector: false
      });

      return searchResult.points.map(point => {
        const payload = point.payload as any;
        const edge: KnowledgeEdge = {
          from: payload.from,
          to: payload.to,
          type: payload.type,
          label: payload.label,
          strength: payload.strength,
          createdAt: payload.createdAt ? new Date(payload.createdAt) : undefined,
          updatedAt: payload.updatedAt ? new Date(payload.updatedAt) : undefined,
          properties: payload.properties,
          metadata: payload.metadata
        };
        return edge;
      });
    } catch (error) {
      console.error(`❌ Failed to get edges from Qdrant for node: ${nodeId}`, error);
      return [];
    }
  }

  /**
   * Get all nodes from Qdrant (for compatibility)
   */
  async getAllNodes(): Promise<KnowledgeNode[]> {
    if (!this.initialized) {
      throw new Error('QdrantKnowledgeStore not initialized');
    }

    try {
      const result = await this.client.scroll(this.config.nodeCollectionName, {
        limit: 10000, // Large limit for getting all nodes
        with_payload: true,
        with_vector: false
      });

      return result.points.map(point => {
        const payload = point.payload as any;
        const node: KnowledgeNode = {
          id: payload.id,
          label: payload.label,
          type: payload.type,
          description: payload.description,
          tags: payload.tags,
          createdAt: payload.createdAt ? new Date(payload.createdAt) : undefined,
          updatedAt: payload.updatedAt ? new Date(payload.updatedAt) : undefined,
          importance: payload.importance,
          confidence: payload.confidence,
          source: payload.source,
          properties: payload.properties,
          metadata: payload.metadata
        };
        return node;
      });
    } catch (error) {
      console.error(`❌ Failed to get all nodes from Qdrant:`, error);
      return [];
    }
  }

  /**
   * Get all edges from Qdrant (for compatibility)
   */
  async getAllEdges(): Promise<KnowledgeEdge[]> {
    if (!this.initialized) {
      throw new Error('QdrantKnowledgeStore not initialized');
    }

    try {
      const result = await this.client.scroll(this.config.edgeCollectionName, {
        limit: 10000, // Large limit for getting all edges
        with_payload: true,
        with_vector: false
      });

      return result.points.map(point => {
        const payload = point.payload as any;
        const edge: KnowledgeEdge = {
          from: payload.from,
          to: payload.to,
          type: payload.type,
          label: payload.label,
          strength: payload.strength,
          createdAt: payload.createdAt ? new Date(payload.createdAt) : undefined,
          updatedAt: payload.updatedAt ? new Date(payload.updatedAt) : undefined,
          properties: payload.properties,
          metadata: payload.metadata
        };
        return edge;
      });
    } catch (error) {
      console.error(`❌ Failed to get all edges from Qdrant:`, error);
      return [];
    }
  }

  /**
   * Clear all data from Qdrant collections
   */
  async clear(): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('QdrantKnowledgeStore not initialized');
    }

    try {
      // Delete all points from both collections
      await this.client.delete(this.config.nodeCollectionName, {
        wait: true,
        filter: {} // Empty filter deletes all
      });

      await this.client.delete(this.config.edgeCollectionName, {
        wait: true,
        filter: {} // Empty filter deletes all
      });

      console.log('✅ Cleared all data from Qdrant collections');
      return true;
    } catch (error) {
      console.error('❌ Failed to clear Qdrant collections:', error);
      return false;
    }
  }

  /**
   * Generate embedding using OpenAI (or mock for testing)
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      if (openai) {
        const response = await openai.embeddings.create({
          model: this.config.embeddingModel,
          input: text.substring(0, 8000) // Limit text length for embeddings
        });

        return response.data[0].embedding;
      } else {
        // Mock embedding for testing when OpenAI API key is not available
        console.log('🔧 Using mock embedding for testing');
        return this.generateMockEmbedding(text);
      }
    } catch (error) {
      console.error('❌ Failed to generate embedding, falling back to mock:', error);
      return this.generateMockEmbedding(text);
    }
  }

  /**
   * Generate a mock embedding based on text content (for testing)
   */
  private generateMockEmbedding(text: string): number[] {
    // Create a deterministic but varied mock embedding based on text content
    const hash = this.simpleHash(text);
    const embedding: number[] = [];
    
    for (let i = 0; i < this.config.vectorDimensions; i++) {
      // Use hash and index to create varied but deterministic values
      const value = Math.sin(hash + i * 0.1) * 0.5;
      embedding.push(value);
    }
    
    // Normalize the vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }

  /**
   * Simple hash function for generating deterministic mock embeddings
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    nodeCount: number;
    edgeCount: number;
    collections: { nodes: string; edges: string };
    vectorDimensions: number;
  }> {
    if (!this.initialized) {
      throw new Error('QdrantKnowledgeStore not initialized');
    }

    try {
      const nodeInfo = await this.client.getCollection(this.config.nodeCollectionName);
      const edgeInfo = await this.client.getCollection(this.config.edgeCollectionName);

      return {
        nodeCount: nodeInfo.points_count || 0,
        edgeCount: edgeInfo.points_count || 0,
        collections: {
          nodes: this.config.nodeCollectionName,
          edges: this.config.edgeCollectionName
        },
        vectorDimensions: this.config.vectorDimensions
      };
    } catch (error) {
      console.error('❌ Failed to get stats from Qdrant:', error);
      return {
        nodeCount: 0,
        edgeCount: 0,
        collections: {
          nodes: this.config.nodeCollectionName,
          edges: this.config.edgeCollectionName
        },
        vectorDimensions: this.config.vectorDimensions
      };
    }
  }

  /**
   * Shutdown the store
   */
  async shutdown(): Promise<boolean> {
    // Qdrant client doesn't need explicit shutdown
    this.initialized = false;
    console.log('✅ QdrantKnowledgeStore shutdown complete');
    return true;
  }
} 