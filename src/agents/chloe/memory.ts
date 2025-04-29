// Remove CommonJS require and @ts-ignore
import path from 'path';
import { AgentMemory } from '../../lib/memory';
// Use server-only Qdrant implementation
import * as serverQdrant from '../../server/qdrant';
import { 
  MemoryEntry as BaseMemoryEntry,
  MessageMemory,
  ThoughtMemory,
  isMessageMemory,
  isThoughtMemory
} from '../../lib/shared/types/agentTypes';
import { MemoryError } from '../../lib/errors/MemoryError';
import { handleError } from '../../lib/errors/errorHandler';
// Import new constants
import { 
  MemoryType, 
  ChloeMemoryType as ChloeMemoryTypeEnum, 
  ImportanceLevel, 
  MemorySource 
} from '../../constants/memory';

// Define a custom memory type that includes 'insight' for this implementation
export type ChloeMemoryType = string;

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
  search?(query: string, limit: number): Promise<ExternalMemoryRecord[]>;
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
  private memoryStore: { entries: MemoryEntry[] } = { entries: [] }; // Add simple local memory store

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
    type: ChloeMemoryType = MemoryType.MESSAGE,
    importance: ImportanceLevel = ImportanceLevel.MEDIUM,
    source: MemorySource = MemorySource.SYSTEM,
    context?: string,
    tags?: string[]
  ): Promise<MemoryEntry> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const memoryId = `memory_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // We no longer need to check for specific patterns here since we've fixed the issue at the source
    // Each system now correctly specifies 'thought' vs 'message' type when adding memories
    
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
    if ([MemoryType.MESSAGE, MemoryType.THOUGHT, MemoryType.TASK, MemoryType.DOCUMENT].includes(type as any)) {
      return type as any;
    }
    // Otherwise map to the closest base type
    switch (type) {
      case ChloeMemoryTypeEnum.INSIGHT:
      case ChloeMemoryTypeEnum.PERFORMANCE_REVIEW:
      case ChloeMemoryTypeEnum.PLAN:
        return MemoryType.THOUGHT;
      case ChloeMemoryTypeEnum.EXECUTION_RESULT:
      case ChloeMemoryTypeEnum.SEARCH_RESULT:
        return MemoryType.DOCUMENT;
      default:
        return MemoryType.MESSAGE;
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
          console.error('Error retrieving memories from external memory:', error);
        }
      }
      
      // For server-side, use serverQdrant
      if (typeof window === 'undefined') {
        try {
          const typeStr = type.toString();
          const results = await serverQdrant.getAllMemoriesByType(
            typeStr as QdrantMemoryType
          );
          return this.convertRecordsToMemoryEntries(results);
        } catch (error) {
          console.error('Error retrieving memories from serverQdrant:', error);
        }
      }
      
      // Fallback to local in-memory storage
      return this.getLocalMemories(limit);
    } catch (error) {
      handleError(MemoryError.retrievalFailed(
        `Error retrieving memories by date range for type ${type}`,
        { startDate, endDate, limit },
        error instanceof Error ? error : undefined
      ));
      return [];
    }
  }

  /**
   * Convert external memory records to MemoryEntry objects
   */
  private convertRecordsToMemoryEntries(records: ExternalMemoryRecord[]): MemoryEntry[] {
    if (!records || !Array.isArray(records)) {
      return [];
    }
    
    return records.map(record => {
      try {
        const id = record.id;
        const content = record.text;
        const created = new Date(record.timestamp);
        const metadata = record.metadata || {};
        
        // Extract metadata fields with defaults
        const category = metadata.category || metadata.tag || record.type || 'unknown';
        const source = metadata.source || MemorySource.SYSTEM;
        
        // Convert importance to the enum type
        let importance: ImportanceLevel;
        if (metadata.importance === 'high') {
          importance = ImportanceLevel.HIGH;
        } else if (metadata.importance === 'low') {
          importance = ImportanceLevel.LOW;
        } else {
          importance = ImportanceLevel.MEDIUM;
        }
        
        const tags = Array.isArray(metadata.tags) ? metadata.tags : [];
        
        // Ensure type is a valid memory type
        let memType: MemoryType;
        if ([MemoryType.MESSAGE, MemoryType.THOUGHT, MemoryType.TASK, MemoryType.DOCUMENT].includes(record.type as MemoryType)) {
          memType = record.type as MemoryType;
        } else {
          memType = MemoryType.MESSAGE;
        }
        
        return {
          id,
          content,
          created,
          type: memType,
          category,
          source,
          importance,
          tags
        };
      } catch (error) {
        console.error('Error converting memory record:', error);
        // Return a minimal valid memory entry
        return {
          id: `error_${Date.now()}`,
          content: 'Error retrieving memory content',
          created: new Date(),
          type: MemoryType.MESSAGE,
          category: 'error',
          source: MemorySource.SYSTEM,
          importance: ImportanceLevel.LOW,
          tags: ['error', 'conversion_failed']
        };
      }
    });
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
      
      // Use server-side Qdrant implementation
      if (typeof window === 'undefined') {
        const filter = {
          metadata: {
            importance: ImportanceLevel.HIGH
          }
        };
        
        const results = await serverQdrant.searchMemory(null, "", { 
          limit, 
          filter 
        });
        return this.convertRecordsToMemoryEntries(results);
      }
      
      // Fallback to external memory if available
      if (this.useExternalMemory && this.externalMemory) {
        if (this.externalMemory.search) {
          const results = await this.externalMemory.search('importance: high', limit);
          return this.convertRecordsToMemoryEntries(results);
        }
      }
      
      // Fallback to in-memory implementation
      return this.memoryStore.entries
        .filter(entry => entry.importance === ImportanceLevel.HIGH)
        .sort((a, b) => b.created.getTime() - a.created.getTime())
        .slice(0, limit);
    } catch (error) {
      handleError(MemoryError.retrievalFailed(
        'Error retrieving high importance memories',
        { limit },
        error instanceof Error ? error : undefined
      ));
      return [];
    }
  }

  /**
   * Get relevant memories for a query
   */
  async getRelevantMemories(
    query: string,
    limit: number = 5
  ): Promise<MemoryEntry[]> {
    if (!this.initialized) {
      console.error("Memory not initialized");
      return [];
    }

    try {
      if (!this.externalMemory) {
        console.error("External memory not available");
        return [];
      }

      // Try to get relevant memories from external memory
      try {
        let matchingRecords: ExternalMemoryRecord[] = [];
        
        // Try searchSimilar first, then fall back to search if available
        if (typeof this.externalMemory.searchSimilar === 'function') {
          matchingRecords = await this.externalMemory.searchSimilar(query, limit);
        } else if (typeof this.externalMemory.search === 'function') {
          matchingRecords = await this.externalMemory.search(query, limit);
        } else {
          console.warn("Neither searchSimilar nor search methods are available on external memory");
        }
        
        console.log(`Found ${matchingRecords.length} relevant memories for query: ${query}`);
        
        // Convert the records to MemoryEntry format
        return this.convertRecordsToMemoryEntries(matchingRecords);
      } catch (searchError) {
        console.error("Error searching external memory:", searchError);
        // Return local memories as fallback
        return this.getLocalMemories(limit);
      }
    } catch (error) {
      console.error("Error retrieving relevant memories:", error);
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
      
      const filter = {
        metadata: {
          category: ChloeMemoryTypeEnum.INSIGHT
        }
      };
      
      let insights: MemoryEntry[] = [];
      
      // Use server-side Qdrant
      if (typeof window === 'undefined') {
        const results = await serverQdrant.searchMemory(
          null,
          "",
          { limit, filter }
        );
        insights = this.convertRecordsToMemoryEntries(results);
      }
      // Otherwise use external memory if available
      else if (this.useExternalMemory && this.externalMemory) {
        if (this.externalMemory.search) {
          const results = await this.externalMemory.search('category:insight', limit);
          insights = this.convertRecordsToMemoryEntries(results);
        }
      }
      // Otherwise use in-memory store
      else {
        insights = this.memoryStore.entries
          .filter(entry => entry.category === ChloeMemoryTypeEnum.INSIGHT)
          .sort((a, b) => b.created.getTime() - a.created.getTime())
          .slice(0, limit);
      }
      
      return insights.map(insight => ({
        insight: insight.content,
        category: insight.category
      }));
    } catch (error) {
      handleError(MemoryError.retrievalFailed(
        'Error retrieving strategic insights',
        { limit },
        error instanceof Error ? error : undefined
      ));
      return [];
    }
  }

  /**
   * Get relevant memories for a query
   * Returns an array of string format memory items
   */
  async getContext(query: string): Promise<string[]> {
    if (!this.initialized) {
      return [];
    }

    try {
      // Get relevant memories
      const relevantMemories = await this.getRelevantMemories(query, 5);
      
      // Convert to string format
      const formattedMemories = relevantMemories.map(memory => {
        try {
          // Use safe property access as the memory shape might vary
          const content = memory.content || '';
          const importance = memory.importance || 0;
          const category = memory.category || '';
          const created = memory.created || new Date();
          
          const importanceStr = importance ? `[Importance: ${importance}/10]` : '';
          const categoryStr = category ? `[${category}]` : '';
          const timestampStr = created ? `[${new Date(created).toLocaleString()}]` : '';
          
          return `${categoryStr} ${timestampStr} ${importanceStr} ${content}`.trim();
        } catch (formatError) {
          console.error('Error formatting memory:', formatError);
          // Return a simpler format if there's an error
          return typeof memory === 'object' && memory !== null 
            ? (memory.content || JSON.stringify(memory)) 
            : String(memory);
        }
      });
      
      return formattedMemories;
    } catch (error) {
      console.error('Error getting context from memory:', error);
      return [];
    }
  }

  /**
   * Get entries from local memory store
   */
  private getLocalMemories(limit: number = 5): MemoryEntry[] {
    return this.memoryStore.entries.slice(0, limit);
  }
}