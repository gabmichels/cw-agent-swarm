import { LanceDBMemory } from './lancedb';

/**
 * AgentMemory class provides a memory interface for agents, using LanceDB for storage
 */
export class AgentMemory {
  private agentId: string;
  private collectionName: string;
  private memory: LanceDBMemory;
  private initialized: boolean = false;

  constructor(config: { agentId: string; collectionName: string; useOpenAI?: boolean }) {
    this.agentId = config.agentId;
    this.collectionName = config.collectionName;
    
    // Initialize LanceDB memory
    this.memory = new LanceDBMemory({
      dataDirectory: process.env.LANCEDB_DATA_DIR || './data/lance',
      useOpenAI: config.useOpenAI || process.env.USE_OPENAI_EMBEDDINGS === 'true'
    });
    
    console.log(`Creating AgentMemory for ${this.agentId} with collection ${this.collectionName}`);
  }

  async initialize(): Promise<void> {
    console.log(`Initializing memory for ${this.agentId}`);
    await this.memory.initialize();
    this.initialized = true;
    return Promise.resolve();
  }

  async addMemory(text: string, metadata: any = {}): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    console.log(`Adding memory for ${this.agentId}: ${text.substring(0, 50)}...`);
    
    // Determine record type based on metadata
    if (metadata.role) {
      // It's a message
      await this.memory.storeMessage({
        role: metadata.role,
        content: text,
        userId: metadata.userId || this.agentId,
        sessionId: metadata.sessionId
      });
    } else if (metadata.tag) {
      // It's a thought
      await this.memory.storeThought({
        text,
        tag: metadata.tag,
        importance: metadata.importance || 'medium',
        source: metadata.source || this.agentId
      });
    } else if (metadata.title) {
      // It's a document
      await this.memory.storeDocument({
        title: metadata.title,
        content: text,
        tags: metadata.tags || [],
        source: metadata.source || 'unknown'
      });
    } else if (metadata.status) {
      // It's a task
      await this.memory.storeTask({
        description: text,
        status: metadata.status,
        priority: metadata.priority || 'medium',
        dueDate: metadata.dueDate
      });
    } else {
      // Default to thought if type is unclear
      await this.memory.storeThought({
        text,
        tag: 'general',
        importance: 'medium',
        source: this.agentId
      });
    }
  }

  async searchMemory(query: string, limit: number = 5): Promise<any[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    console.log(`Searching memory for ${this.agentId} with query: ${query}`);
    
    const results = await this.memory.searchMemory({
      query,
      limit
    });
    
    return results;
  }

  async getMemory(id: string): Promise<any> {
    console.log(`Getting memory ${id} for ${this.agentId}`);
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Directly searching by ID is not yet implemented
    // For now, we return an empty object
    return Promise.resolve({});
  }

  async getContext(query: string, limit: number = 5): Promise<string[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    console.log(`Getting context for ${this.agentId} with query: ${query}`);
    return this.memory.getContext(query, limit);
  }
  
  /**
   * Get recent messages from memory
   */
  async getRecentMessages(limit: number = 10): Promise<any[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    return this.memory.getRecentMessages(limit);
  }
  
  /**
   * Get important thoughts from memory
   */
  async getImportantThoughts(importance: 'medium' | 'high' = 'high', limit: number = 10): Promise<any[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    return this.memory.getImportantThoughts(importance, limit);
  }
} 