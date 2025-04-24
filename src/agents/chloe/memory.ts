// Use CommonJS require for path
// @ts-ignore
const path = require('path');
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
  type?: string;
  timestamp?: string;
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
   * Get memories by date range and type
   * @param type Type of memory to retrieve (message, thought, document, task)
   * @param startDate Start date of range
   * @param endDate End date of range
   * @param limit Maximum number of memories to retrieve
   * @returns Array of memory entries in the specified range
   */
  async getMemoriesByDateRange(
    type: 'message' | 'thought' | 'document' | 'task',
    startDate: Date,
    endDate: Date,
    limit: number = 50
  ): Promise<MemoryEntry[]> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Convert dates to ISO strings for filtering
      const startDateISO = startDate.toISOString();
      const endDateISO = endDate.toISOString();
      
      // Build filter for date range
      const filter = {
        timestamp: {
          $gte: startDateISO,
          $lte: endDateISO
        }
      };
      
      // Use external memory if available
      if (this.externalMemory) {
        try {
          // Create a combined search options object
          const searchOptions = {
            limit,
            filter
          };
          
          // searchMemory expects (type, options) in this implementation
          const records = await this.externalMemory.searchMemory(
            type,
            searchOptions
          );
          
          // Convert to memory entries
          return records.map(record => ({
            id: record.id,
            content: record.text,
            created: new Date(record.timestamp),
            timestamp: record.timestamp,
            type: record.type as any,
            category: record.metadata.category || record.metadata.tag || type,
            source: record.metadata.source || 'system',
            importance: (record.metadata.importance || 'medium') as 'low' | 'medium' | 'high',
            tags: record.metadata.tags || []
          }));
        } catch (error) {
          console.error(`Error retrieving memories by date range from external memory:`, error);
          // Fall back to server-side implementation
        }
      }
      
      // Use server-side implementation
      if (typeof window === 'undefined') {
        try {
          const searchOptions = {
            limit,
            filter,
            type
          };
          const records = await serverQdrant.searchMemory(type, '', searchOptions);
          
          // Convert to memory entries
          return records.map(record => ({
            id: record.id,
            content: record.text,
            created: new Date(record.timestamp),
            timestamp: record.timestamp,
            type: record.type,
            category: record.metadata.category || record.metadata.tag || type,
            source: record.metadata.source || 'system',
            importance: (record.metadata.importance || 'medium') as 'low' | 'medium' | 'high',
            tags: record.metadata.tags || []
          }));
        } catch (error) {
          console.error(`Error retrieving memories by date range from server:`, error);
        }
      }
      
      // If we reach here, we have no available memory sources
      return [];
    } catch (error) {
      console.error('Error retrieving memories by date range:', error);
      return [];
    }
  }

  /**
   * Get high importance memories
   * @returns Array of high importance memory entries
   */
  async getHighImportanceMemories(limit: number = 20): Promise<MemoryEntry[]> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Build filter for importance
      const filter = {
        importance: 'high'
      };
      
      // Use external memory if available
      if (this.externalMemory) {
        try {
          // Create search options objects
          const messageOptions = {
            limit: Math.floor(limit / 2),
            filter
          };
          
          const thoughtOptions = {
            limit: Math.floor(limit / 2),
            filter
          };
          
          // searchMemory expects (type, options) in this implementation
          const messageRecords = await this.externalMemory.searchMemory(
            'message',
            messageOptions
          );
          
          const thoughtRecords = await this.externalMemory.searchMemory(
            'thought',
            thoughtOptions
          );
          
          // Combine records
          const records = [...messageRecords, ...thoughtRecords];
          
          // Convert to memory entries
          return records.map(record => ({
            id: record.id,
            content: record.text,
            created: new Date(record.timestamp),
            timestamp: record.timestamp,
            type: record.type as any,
            category: record.metadata.category || record.metadata.tag || record.type,
            source: record.metadata.source || 'system',
            importance: (record.metadata.importance || 'high') as 'low' | 'medium' | 'high',
            tags: record.metadata.tags || []
          }));
        } catch (error) {
          console.error(`Error retrieving high importance memories from external memory:`, error);
          // Fall back to server-side implementation
        }
      }
      
      // Use server-side implementation
      if (typeof window === 'undefined') {
        try {
          // Search for high importance memories across all memory types
          const messageOptions = {
            limit: Math.floor(limit / 2),
            filter
          };
          
          const messageRecords = await serverQdrant.searchMemory('message', '', messageOptions);
          const thoughtRecords = await serverQdrant.searchMemory('thought', '', messageOptions);
          
          // Combine records
          const records = [...messageRecords, ...thoughtRecords];
          
          // Convert to memory entries
          return records.map(record => ({
            id: record.id,
            content: record.text,
            created: new Date(record.timestamp),
            timestamp: record.timestamp,
            type: record.type,
            category: record.metadata.category || record.metadata.tag || record.type,
            source: record.metadata.source || 'system',
            importance: (record.metadata.importance || 'high') as 'low' | 'medium' | 'high',
            tags: record.metadata.tags || []
          }));
        } catch (error) {
          console.error(`Error retrieving high importance memories from server:`, error);
        }
      }
      
      // If we reach here, we have no available memory sources
      return [];
    } catch (error) {
      console.error('Error retrieving high importance memories:', error);
      return [];
    }
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