// Remove CommonJS require and @ts-ignore
import path from 'path';
import { AgentMemory } from '../../lib/memory';
// Use server-only Qdrant implementation
import * as serverQdrant from '../../server/qdrant';
import { 
  MemoryEntry as BaseMemoryEntry, 
  MemoryType, 
  MemorySource, 
  ImportanceLevel,
  MessageMemory,
  ThoughtMemory,
  isMessageMemory,
  isThoughtMemory
} from '../../lib/shared/types/agentTypes';
import { MemoryError } from '../../lib/errors/MemoryError';
import { handleError } from '../../lib/errors/errorHandler';

// Define a custom memory type that includes 'insight' for this implementation
export type ChloeMemoryType = MemoryType | 'insight' | 'execution_result' | 'plan' | 'performance_review' | 'search_result';

// Define internal type for compatibility with serverQdrant
type QdrantMemoryType = 'message' | 'thought' | 'document' | 'task';

export interface MemoryEntry extends BaseMemoryEntry {
  category: string;
  expiresAt?: Date;
  tags?: string[];
}

// Define external memory record interface
export interface ExternalMemoryRecord {
  id: string;
  text: string;
  timestamp: string;
  type: string;
  metadata: {
    category?: string;
    tag?: string;
    source?: string;
    importance?: string;
    tags?: string[];
    [key: string]: unknown;
  };
}

// Define memory search options
export interface MemorySearchOptions {
  limit?: number;
  filter?: Record<string, unknown>;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

// Define AgentMemory interface for external memory interactions
export interface ExtendedAgentMemory extends AgentMemory {
  searchSimilar?(query: string, limit: number): Promise<ExternalMemoryRecord[]>;
  getStats?(): Promise<{ messageCount: number; [key: string]: any }>;
}

export interface ChloeMemoryOptions {
  agentId?: string;
  useExternalMemory?: boolean;
  externalMemory?: ExtendedAgentMemory;
  useOpenAI?: boolean;
}

/**
 * Class to manage Chloe's memories with tagging and importance levels
 */
export class ChloeMemory {
  private agentId: string;
  private useExternalMemory: boolean;
  private externalMemory?: ExtendedAgentMemory;
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
      handleError(MemoryError.initFailed(
        'Error initializing memory system',
        { agentId: this.agentId },
        error instanceof Error ? error : undefined
      ));
      return false;
    }
  }

  /**
   * Add a new memory
   */
  async addMemory(
    content: string,
    type: ChloeMemoryType = 'message',
    importance: ImportanceLevel = 'medium',
    source: MemorySource = 'system',
    context?: string,
    tags?: string[]
  ): Promise<MemoryEntry> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const memoryId = `memory_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const baseType = this.convertToBaseMemoryType(type);
    const newMemory: MemoryEntry = {
      id: memoryId,
      content,
      created: new Date(),
      category: type, // Use type as category for backward compatibility
      importance,
      source,
      context,
      tags,
      type: baseType
    };
    
    // Add to server-side Qdrant (only when running server-side)
    if (typeof window === 'undefined') {
      await serverQdrant.addMemory(
        baseType as 'message' | 'thought' | 'document' | 'task',
        content,
        {
          category: type,
          importance,
          source,
          tags
        }
      );
    }
    
    // Add to external memory if enabled
    if (this.useExternalMemory && this.externalMemory) {
      const memoryText = this.formatMemoryForExternal(newMemory);
      await this.externalMemory.addMemory(memoryText, {
        tag: type,
        importance: importance,
        source: source,
        tags: tags
      });
    }
    
    console.log(`Added new memory: ${memoryId} - ${content.substring(0, 50)}...`);
    return newMemory;
  }

  /**
   * Convert ChloeMemoryType to a base MemoryType
   * This is a helper method to ensure type compatibility
   */
  private convertToBaseMemoryType(type: ChloeMemoryType): MemoryType {
    // If the type is already a base memory type, return it directly
    if (['message', 'thought', 'task', 'document'].includes(type as string)) {
      return type as MemoryType;
    }
    // Otherwise map to the closest base type
    switch (type) {
      case 'insight':
      case 'performance_review':
      case 'plan':
        return 'thought';
      case 'execution_result':
      case 'search_result':
        return 'document';
      default:
        return 'message';
    }
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
   */
  async getMemoriesByDateRange(
    type: MemoryType,
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
          const searchOptions: MemorySearchOptions = {
            limit,
            filter
          };
          
          // searchMemory expects (type, options) in this implementation
          const records = await this.externalMemory.searchMemory(
            type,
            searchOptions
          ) as ExternalMemoryRecord[];
          
          // Convert to memory entries
          return this.convertRecordsToMemoryEntries(records);
        } catch (error) {
          throw MemoryError.retrievalFailed(
            'Error searching external memory',
            { type, startDate: startDateISO, endDate: endDateISO, limit },
            error instanceof Error ? error : undefined
          );
        }
      }
      
      return [];
    } catch (error) {
      handleError(error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  /**
   * Convert external memory records to MemoryEntry objects
   */
  private convertRecordsToMemoryEntries(records: ExternalMemoryRecord[]): MemoryEntry[] {
    return records.map(record => ({
      id: record.id,
      content: record.text,
      created: new Date(record.timestamp),
      type: (record.type as MemoryType) || 'message',
      category: record.metadata.category || record.metadata.tag || record.type,
      source: (record.metadata.source as MemorySource) || 'system',
      importance: (record.metadata.importance as ImportanceLevel) || 'medium',
      tags: record.metadata.tags || []
    }));
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
          const messageOptions: MemorySearchOptions = {
            limit: Math.floor(limit / 2),
            filter
          };
          
          const thoughtOptions: MemorySearchOptions = {
            limit: Math.floor(limit / 2),
            filter
          };
          
          // searchMemory expects (type, options) in this implementation
          const messageRecords = await this.externalMemory.searchMemory(
            'message',
            messageOptions
          ) as ExternalMemoryRecord[];
          
          const thoughtRecords = await this.externalMemory.searchMemory(
            'thought',
            thoughtOptions
          ) as ExternalMemoryRecord[];
          
          // Combine records
          const records = [...messageRecords, ...thoughtRecords];
          
          // Convert to memory entries
          return this.convertRecordsToMemoryEntries(records);
        } catch (error) {
          console.error('Error searching external memory:', error);
          return [];
        }
      }

      // No records found if we don't have external memory
      return [];
    } catch (error) {
      console.error('Error getting high importance memories:', error);
      return [];
    }
  }

  /**
   * Get memories related to a query
   */
  async getRelevantMemories(query: string, limit: number = 5): Promise<MemoryEntry[]> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Use external memory if available
      if (this.externalMemory && typeof this.externalMemory.searchSimilar === 'function') {
        try {
          // searchSimilar expects (query, limit) in this implementation
          const records = await this.externalMemory.searchSimilar(
            query,
            limit
          ) as ExternalMemoryRecord[];
          
          // Convert to memory entries
          return this.convertRecordsToMemoryEntries(records);
        } catch (error) {
          handleError(MemoryError.retrievalFailed(
            'Error searching similar memories',
            { query, limit },
            error instanceof Error ? error : undefined
          ));
          
          // In case of error, try using server-side Qdrant directly
          if (typeof window === 'undefined') {
            // Pass limit as an array as expected by the API
            const results = await serverQdrant.search(query, [limit]);
            
            return results.map(result => ({
              id: `result_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
              content: result.text,
              created: new Date(),
              type: 'message',
              category: 'search_result',
              importance: 'medium',
              source: 'system',
              tags: ['search_result']
            }));
          }
          
          return [];
        }
      }
      
      // If external memory not available, try using server-side Qdrant directly
      if (typeof window === 'undefined') {
        // Pass limit as an array as expected by the API
        const results = await serverQdrant.search(query, [limit]);
        
        return results.map(result => ({
          id: `result_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          content: result.text,
          created: new Date(),
          type: 'message',
          category: 'search_result',
          importance: 'medium',
          source: 'system',
          tags: ['search_result']
        }));
      }
      
      return [];
    } catch (error) {
      handleError(MemoryError.retrievalFailed(
        'Error getting relevant memories',
        { query, limit },
        error instanceof Error ? error : undefined
      ));
      return [];
    }
  }

  /**
   * Get the total number of messages in memory
   */
  async getMessageCount(): Promise<number> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Use external memory if available
      if (this.externalMemory && typeof this.externalMemory.getStats === 'function') {
        try {
          const stats = await this.externalMemory.getStats();
          return stats.messageCount || 0;
        } catch (error) {
          handleError(MemoryError.retrievalFailed(
            'Error getting stats from external memory',
            { agentId: this.agentId },
            error instanceof Error ? error : undefined
          ));
          return 0;
        }
      }
      
      return 0;
    } catch (error) {
      handleError(MemoryError.retrievalFailed(
        'Error getting message count',
        { agentId: this.agentId },
        error instanceof Error ? error : undefined
      ));
      return 0;
    }
  }

  /**
   * Run a diagnostic check on the memory system
   */
  async diagnose(): Promise<{ status: string; messageCount: number }> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      const messageCount = await this.getMessageCount();
      
      return {
        status: this.initialized ? 'operational' : 'not_initialized',
        messageCount
      };
    } catch (error) {
      console.error('Error running memory diagnosis:', error);
      return {
        status: 'error',
        messageCount: 0
      };
    }
  }

  /**
   * Get recent strategic insights (specialized memory retrieval)
   */
  async getRecentStrategicInsights(limit: number = 5): Promise<{ insight: string; category: string }[]> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Build filter for insights
      const filter = {
        type: 'insight'
      };
      
      // Use external memory if available
      if (this.externalMemory) {
        try {
          const searchOptions: MemorySearchOptions = {
            limit,
            filter,
            sortBy: 'timestamp',
            sortDirection: 'desc'
          };
          
          // searchMemory expects (type, options) in this implementation
          const records = await this.externalMemory.searchMemory(
            'insight',
            searchOptions
          ) as ExternalMemoryRecord[];
          
          // Convert to simplified format
          return records.map(record => ({
            insight: record.text,
            category: record.metadata.category || record.metadata.tag || 'insight'
          }));
        } catch (error) {
          console.error('Error searching strategic insights:', error);
          return [];
        }
      }
      
      return [];
    } catch (error) {
      console.error('Error getting strategic insights:', error);
      return [];
    }
  }
} 