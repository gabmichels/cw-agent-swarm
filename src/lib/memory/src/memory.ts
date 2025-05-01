import * as serverQdrant from '../../../server/qdrant';

// Define memory scopes as requested
export type MemoryScope = 'shortTerm' | 'longTerm' | 'inbox' | 'reflections';

// Define memory entry interface
export interface MemoryEntry {
  id: string;
  scope: MemoryScope;
  content: string;
  timestamp: number;
  tags?: string[];
  relevance?: number; // 0.0 to 1.0
  expiresAt?: number;
  sourceAgent?: string;
  contextId?: string; // delegationContextId or message thread
  namespace?: string;
  // Preserve backward compatibility
  type?: string;
  category?: string;
  metadata?: Record<string, any>;
}

// Define memory search options
export interface MemorySearchOptions {
  limit?: number;
  filter?: Record<string, any>;
  tags?: string[];
  scope?: MemoryScope;
  minRelevance?: number;
  startTimestamp?: number;
  endTimestamp?: number;
}

// Define memory configuration interface
interface MemoryConfig {
  vectorStoreUrl?: string;
  apiKey?: string;
  defaultNamespace?: string;
  embeddingModel?: string;
}

/**
 * Memory API for agents - supports tiered memory scopes and relevance filtering
 */
export class Memory {
  private namespace: string;
  private isInitialized: boolean = false;
  private config: MemoryConfig;
  private memoryEntries: Map<string, MemoryEntry[]> = new Map();

  constructor(options: { namespace?: string, config?: MemoryConfig }) {
    this.namespace = options.namespace || 'default';
    this.config = options.config || {
      vectorStoreUrl: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
      defaultNamespace: 'default',
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
    };
    
    // Initialize memory store
    this.memoryEntries.set(this.namespace, []);
    
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
   * Add a memory entry with scope
   */
  async write(entry: Partial<MemoryEntry>): Promise<MemoryEntry> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Add required fields if not provided
      const completeEntry: MemoryEntry = {
        id: entry.id || `memory_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        scope: entry.scope || 'shortTerm',
        content: entry.content || '',
        timestamp: entry.timestamp || Date.now(),
        tags: entry.tags || [],
        relevance: entry.relevance || 1.0,
        namespace: this.namespace,
        ...entry
      };
      
      // Store in local memory map
      const entries = this.memoryEntries.get(this.namespace) || [];
      entries.push(completeEntry);
      this.memoryEntries.set(this.namespace, entries);
      
      // Add to vector store for retrieval
      if (typeof window === 'undefined') {
        await serverQdrant.addMemory(
          // Use an appropriate type that matches the expected values
          (entry.type as "message" | "thought" | "document" | "task") || "document",
          entry.content || '',
          {
            scope: entry.scope,
            tags: entry.tags,
            relevance: entry.relevance,
            expiresAt: entry.expiresAt,
            sourceAgent: entry.sourceAgent,
            contextId: entry.contextId,
            namespace: this.namespace,
            ...entry.metadata
          }
        );
      }
      
      return completeEntry;
    } catch (error) {
      console.error('Error adding memory:', error);
      throw error;
    }
  }

  /**
   * Get all memory entries for an agent
   */
  getAll(agentId: string): MemoryEntry[] {
    const namespace = agentId || this.namespace;
    return this.memoryEntries.get(namespace) || [];
  }

  /**
   * Replace all memory entries for an agent
   */
  replaceAll(agentId: string, entries: MemoryEntry[]): void {
    const namespace = agentId || this.namespace;
    this.memoryEntries.set(namespace, entries);
  }

  /**
   * Get memory entries by scope
   */
  getByScope(agentId: string, scope: MemoryScope): MemoryEntry[] {
    const namespace = agentId || this.namespace;
    const entries = this.memoryEntries.get(namespace) || [];
    return entries.filter(entry => entry.scope === scope);
  }

  /**
   * Get relevant memory entries filtered by options
   */
  getRelevant(agentId: string, options: MemorySearchOptions = {}): MemoryEntry[] {
    const namespace = agentId || this.namespace;
    const entries = this.memoryEntries.get(namespace) || [];
    
    return entries
      .filter(entry => {
        // Filter by scope if provided
        if (options.scope && entry.scope !== options.scope) {
          return false;
        }
        
        // Filter by minimum relevance if provided
        if (options.minRelevance !== undefined && 
            (entry.relevance === undefined || entry.relevance < options.minRelevance)) {
          return false;
        }
        
        // Filter by tags if provided
        if (options.tags && options.tags.length > 0 && 
            (!entry.tags || !options.tags.some(tag => entry.tags?.includes(tag)))) {
          return false;
        }
        
        // Filter by timestamp range if provided
        if (options.startTimestamp && entry.timestamp < options.startTimestamp) {
          return false;
        }
        
        if (options.endTimestamp && entry.timestamp > options.endTimestamp) {
          return false;
        }
        
        return true;
      })
      // Sort by relevance (highest first)
      .sort((a, b) => (b.relevance || 0) - (a.relevance || 0))
      // Limit results if specified
      .slice(0, options.limit || entries.length);
  }

  /**
   * Search memories with semantic search
   */
  async searchMemory(query: string, options: MemorySearchOptions = {}): Promise<MemoryEntry[]> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const limit = options.limit || 5;
      
      // Prepare filter for Qdrant
      const filter: Record<string, any> = { 
        namespace: this.namespace,
        ...options.filter 
      };
      
      // Add scope filter if provided
      if (options.scope) {
        filter.scope = options.scope;
      }
      
      // Search with filters
      const results = await serverQdrant.searchMemory(null, query, { limit, filter });
      
      // Map to MemoryEntry format
      return results.map(result => ({
        id: result.id || `memory_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        scope: result.metadata?.scope || 'shortTerm',
        content: result.text || '',
        timestamp: result.metadata?.timestamp || Date.now(),
        tags: result.metadata?.tags || [],
        relevance: result.metadata?.relevance || 1.0, // Use metadata.relevance instead of score
        expiresAt: result.metadata?.expiresAt,
        sourceAgent: result.metadata?.sourceAgent,
        contextId: result.metadata?.contextId,
        namespace: result.metadata?.namespace || this.namespace,
      }));
    } catch (error) {
      console.error('Error searching memory:', error);
      return [];
    }
  }

  /**
   * Get the total number of memories
   */
  async getMessageCount(): Promise<number> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      if (typeof window === 'undefined') {
        const count = await serverQdrant.getMessageCount();
        return count;
      }
      
      const entries = this.memoryEntries.get(this.namespace) || [];
      return entries.length;
    } catch (error) {
      console.error('Error getting message count:', error);
      return 0;
    }
  }
  
  // Legacy method for backward compatibility
  async addMemory(content: string, metadata: Record<string, any> = {}): Promise<string> {
    const entry = await this.write({
      content,
      scope: metadata.scope || 'shortTerm',
      tags: metadata.tags,
      relevance: metadata.relevance,
      expiresAt: metadata.expiresAt,
      sourceAgent: metadata.sourceAgent,
      contextId: metadata.contextId,
      metadata
    });
    
    return entry.id;
  }
  
  // Legacy method for backward compatibility
  async getContext(query: string, options: { limit?: number } = {}): Promise<string[]> {
    const results = await this.searchMemory(query, options);
    return results.map(result => result.content);
  }
} 