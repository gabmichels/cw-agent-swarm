import { QdrantVectorStore } from '@langchain/community/vectorstores/qdrant';
import { Document } from '@langchain/core/documents';
import { createQdrantVectorStore, searchVectorStore, addDocumentsToVectorStore } from './qdrant';

export interface MemoryOptions {
  collectionName?: string;
  url?: string;
  apiKey?: string;
}

// Memory manager for agent
export class AgentMemory {
  private vectorStore: QdrantVectorStore | null = null;
  private initialized = false;
  private collectionName: string;
  private url: string;
  private apiKey?: string;

  constructor(options: MemoryOptions = {}) {
    this.collectionName = options.collectionName || 'chloe_memory';
    this.url = options.url || process.env.QDRANT_URL || 'http://localhost:6333';
    this.apiKey = options.apiKey || process.env.QDRANT_API_KEY;
  }

  // Initialize the memory system
  async initialize(): Promise<boolean> {
    try {
      this.vectorStore = await createQdrantVectorStore({
        url: this.url,
        apiKey: this.apiKey,
        collectionName: this.collectionName,
      });
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize memory:', error);
      return false;
    }
  }

  // Add a memory to the vector store
  async addMemory(text: string, metadata: Record<string, any> = {}): Promise<boolean> {
    if (!this.initialized) await this.initialize();
    if (!this.vectorStore) return false;

    const timestamp = new Date().toISOString();
    const document = new Document({
      pageContent: text,
      metadata: {
        ...metadata,
        timestamp,
        source: 'agent_memory',
      },
    });

    const result = await addDocumentsToVectorStore(this.vectorStore, [document]);
    return result.success;
  }

  // Search memories by query
  async searchMemories(query: string, limit: number = 5): Promise<Document[]> {
    if (!this.initialized) await this.initialize();
    if (!this.vectorStore) return [];

    const result = await searchVectorStore(this.vectorStore, query, limit);
    return result.success && result.results ? result.results : [];
  }

  // Get contextual memories based on query
  async getContext(query: string, limit: number = 5): Promise<string> {
    const memories = await this.searchMemories(query, limit);
    if (memories.length === 0) return 'No relevant memories found.';

    return memories
      .map((doc) => {
        const { timestamp, source } = doc.metadata;
        return `[${timestamp || 'unknown time'}] [${source || 'unknown source'}]: ${doc.pageContent}`;
      })
      .join('\n\n');
  }
} 