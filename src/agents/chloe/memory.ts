import path from 'path';
import { AgentMemory } from '../../lib/memory';
// Use server-only Qdrant implementation
import * as serverQdrant from '../../server/qdrant';

export interface MemoryEntry {
  id: string;
  content: string;
  created: Date;
  category: string;
  importance: 'low' | 'medium' | 'high';
  source: 'user' | 'chloe' | 'system';
  context?: string;
  expiresAt?: Date;
  tags?: string[];
}

export interface ChloeMemoryOptions {
  agentId?: string;
  useExternalMemory?: boolean;
  externalMemory?: AgentMemory;
  useOpenAI?: boolean;
}

/**
 * Class to manage Chloe's memories with tagging and importance levels
 */
export class ChloeMemory {
  private agentId: string;
  private useExternalMemory: boolean;
  private externalMemory?: AgentMemory;
  private initialized: boolean = false;

  constructor(options?: ChloeMemoryOptions) {
    this.agentId = options?.agentId || 'chloe';
    this.useExternalMemory = options?.useExternalMemory || false;
    this.externalMemory = options?.externalMemory;
    
    // Server-side only initialization
    if (typeof window === 'undefined') {
      serverQdrant.initMemory({
        useOpenAI: options?.useOpenAI || process.env.USE_OPENAI_EMBEDDINGS === 'true'
      }).catch(error => {
        console.error('Error initializing server-side Qdrant:', error);
      });
    }
    
    console.log('ChloeMemory initialized with server-side Qdrant backend');
  }

  /**
   * Initialize memory system
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('Initializing Chloe memory system...');
      
      // Server-side only initialization
      if (typeof window === 'undefined') {
        // Initialize Qdrant memory through server module
        await serverQdrant.initMemory();
      }
      
      // Initialize external memory if needed
      if (this.useExternalMemory && this.externalMemory) {
        await this.externalMemory.initialize();
      }
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing memory system:', error);
      return false;
    }
  }

  /**
   * Add a new memory
   */
  async addMemory(
    content: string,
    category: string,
    importance: 'low' | 'medium' | 'high' = 'medium',
    source: 'user' | 'chloe' | 'system' = 'system',
    context?: string,
    tags?: string[]
  ): Promise<MemoryEntry> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const memoryId = `memory_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newMemory: MemoryEntry = {
      id: memoryId,
      content,
      created: new Date(),
      category,
      importance,
      source,
      context,
      tags
    };
    
    // Add to server-side Qdrant (only when running server-side)
    if (typeof window === 'undefined') {
      await serverQdrant.addMemory('thought', content, {
        category,
        importance,
        source,
        tags
      });
    }
    
    // Add to external memory if enabled
    if (this.useExternalMemory && this.externalMemory) {
      const memoryText = this.formatMemoryForExternal(newMemory);
      await this.externalMemory.addMemory(memoryText, {
        tag: category,
        importance: importance,
        source: source,
        tags: tags
      });
    }
    
    console.log(`Added new memory: ${memoryId} - ${content.substring(0, 50)}...`);
    return newMemory;
  }

  /**
   * Format memory for external storage
   */
  private formatMemoryForExternal(memory: MemoryEntry): string {
    const importanceMarker = memory.importance === 'high' ? '!IMPORTANT! ' : '';
    const tagsSection = memory.tags?.length ? `[Tags: ${memory.tags.join(', ')}] ` : '';
    
    return `${importanceMarker}${memory.category.toUpperCase()}: ${memory.content} ${tagsSection}(Source: ${memory.source}, Created: ${memory.created.toISOString()})`;
  }

  /**
   * Get high-importance memories - now uses server-side Qdrant
   */
  async getHighImportanceMemories(limit: number = 20): Promise<MemoryEntry[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Use server-side Qdrant (only when running server-side)
    if (typeof window === 'undefined') {
      try {
        const thoughts = await serverQdrant.searchMemory('thought', '', {
          limit,
          filter: { 'importance': 'high' }
        });
        
        // Convert from server Qdrant records to MemoryEntry
        return thoughts.map(thought => ({
          id: thought.id,
          content: thought.text,
          created: new Date(thought.timestamp),
          category: thought.metadata.category || thought.metadata.tag || 'thought',
          importance: thought.metadata.importance as 'low' | 'medium' | 'high',
          source: thought.metadata.source as 'user' | 'chloe' | 'system',
          tags: thought.metadata.tags || []
        }));
      } catch (error) {
        console.error('Error retrieving high importance memories:', error);
        return [];
      }
    }
    
    return [];
  }

  /**
   * Get relevant memories for a query, using server-side Qdrant
   */
  async getRelevantMemories(query: string, limit: number = 5): Promise<string[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Use server-side Qdrant for semantic retrieval
    if (typeof window === 'undefined') {
      try {
        const results = await serverQdrant.searchMemory(null, query, { limit });
        
        // If no results, try external memory if available
        if (results.length === 0 && this.useExternalMemory && this.externalMemory) {
          try {
            const externalResults = await this.externalMemory.getContext(query);
            if (externalResults && externalResults.length > 0) {
              return externalResults;
            }
          } catch (error) {
            console.error('Error retrieving context from external memory:', error);
          }
        }
        
        // Format the results as strings
        if (results.length === 0) {
          return ["No relevant memories found."];
        }
        
        return results.map(result => {
          const importance = result.metadata.importance;
          const importanceMarker = importance === 'high' ? '[IMPORTANT] ' : '';
          const category = result.metadata.category || result.metadata.tag || result.type;
          return `${importanceMarker}${category}: ${result.text} (${new Date(result.timestamp).toISOString()})`;
        });
      } catch (error) {
        console.error('Error searching memory:', error);
        return ["Error accessing memory."];
      }
    }
    
    return ["Memory search unavailable in browser environment."];
  }
} 