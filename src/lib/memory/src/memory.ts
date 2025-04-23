import * as serverQdrant from '../../../server/qdrant';

// Define memory configuration interface
interface MemoryConfig {
  vectorStoreUrl?: string;
  apiKey?: string;
  defaultNamespace?: string;
  embeddingModel?: string;
}

/**
 * Memory API for agents - supports retrieval of relevant context
 */
export class Memory {
  private namespace: string;
  private isInitialized: boolean = false;
  private config: MemoryConfig;

  constructor(options: { namespace?: string, config?: MemoryConfig }) {
    this.namespace = options.namespace || 'default';
    this.config = options.config || {
      vectorStoreUrl: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
      defaultNamespace: 'default',
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
    };
    
    // Initialize Qdrant (server-side only)
    if (typeof window === 'undefined') {
      console.log(`Initializing memory for namespace: ${this.namespace}`);
      serverQdrant.initMemory({
        qdrantUrl: this.config.vectorStoreUrl,
        qdrantApiKey: this.config.apiKey,
        useOpenAI: process.env.USE_OPENAI_EMBEDDINGS === 'true'
      }).catch(err => {
        console.error('Failed to initialize memory:', err);
      });
    }
  }

  /**
   * Initialize memory
   */
  async initialize(): Promise<boolean> {
    try {
      if (typeof window === 'undefined') {
        await serverQdrant.initMemory({
          qdrantUrl: this.config.vectorStoreUrl,
          qdrantApiKey: this.config.apiKey,
          useOpenAI: true
        });
      }
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing memory:', error);
      return false;
    }
  }

  /**
   * Add a memory entry
   */
  async addMemory(content: string, metadata: Record<string, any> = {}): Promise<string> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      // Add namespace to metadata
      metadata.namespace = this.namespace;
      
      // Use document type by default
      return serverQdrant.addMemory('document', content, metadata);
    } catch (error) {
      console.error('Error adding memory:', error);
      throw error;
    }
  }

  /**
   * Get relevant context based on a query
   */
  async getContext(query: string, options: { limit?: number } = {}): Promise<string[]> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const limit = options.limit || 5;
      
      // Search with namespace filter
      const results = await serverQdrant.searchMemory(null, query, {
        limit,
        filter: { namespace: this.namespace }
      });
      
      if (results.length === 0) {
        return [];
      }
      
      // Format results as strings
      return results.map(result => result.text);
    } catch (error) {
      console.error('Error retrieving context:', error);
      return [];
    }
  }

  /**
   * Search memories
   */
  async searchMemory(query: string, options: { limit?: number } = {}): Promise<any[]> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const limit = options.limit || 5;
      
      // Search with namespace filter
      const results = await serverQdrant.searchMemory(null, query, {
        limit,
        filter: { namespace: this.namespace }
      });
      
      // Return the raw results
      return results;
    } catch (error) {
      console.error('Error searching memory:', error);
      return [];
    }
  }
} 