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
  metadata?: {
    filePath?: string;
    title?: string;
    importance?: string;
    source?: string;
    category?: string;
    tags?: string[];
    [key: string]: unknown;
  };
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
   * Add a memory to the appropriate storage
   */
  async addMemory(
    content: string,
    type: ChloeMemoryType = 'MESSAGE',
    importance: ImportanceLevel = ImportanceLevel.MEDIUM,
    source: MemorySource = MemorySource.AGENT,
    context?: string,
    tags?: string[]
  ): Promise<MemoryEntry> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const memoryId = `memory_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // Apply standardized formatting to memory content if it doesn't already have it
    const timestamp = new Date().toISOString();
    let formattedContent = content;
    
    // Only format if it's not already formatted
    if (!this.isFormattedMemory(content)) {
      const typeLabel = type.toString().toUpperCase();
      formattedContent = `${typeLabel} [${timestamp}]: ${content}`;
    }
    
    const baseType = this.convertToBaseMemoryType(type);
    
    // Create the memory entry
    const newMemory: MemoryEntry = {
      id: memoryId,
      content: formattedContent,
      created: new Date(),
      category: type.toString(), // Use type as category for backward compatibility
      importance: importance as any, // Type cast to resolve type mismatch
      source,
      context,
      tags,
      type: baseType
    };
    
    // Add to server-side Qdrant (only when running server-side)
    if (typeof window === 'undefined') {
      await serverQdrant.addMemory(
        baseType as 'message' | 'thought' | 'document' | 'task',
        formattedContent,
        {
          category: type.toString(),
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
        tag: type.toString(),
        importance: importance,
        source: source,
        tags: tags
      });
    }
    
    console.log(`Added new memory: ${memoryId} - ${formattedContent.substring(0, 50)}...`);
    return newMemory;
  }

  /**
   * Check if a memory string is already in the standardized format
   */
  private isFormattedMemory(content: string): boolean {
    if (!content) return false;
    
    const formatRegex = /^(USER MESSAGE|MESSAGE|THOUGHT|REASONING TRAIL) \[([^\]]+)\]: (.+)$/;
    return formatRegex.test(content);
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
          );
          
          // Convert to memory entries - use type assertion with unknown to fix type mismatch
          return this.convertRecordsToMemoryEntries(records as unknown as ExternalMemoryRecord[]);
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
    limit: number = 5,
    types?: string[]
  ): Promise<MemoryEntry[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // If specific types are requested, use them, otherwise use default types
      const memoryTypes = types || [
        MemoryType.MESSAGE, 
        MemoryType.THOUGHT, 
        MemoryType.DOCUMENT,
        ChloeMemoryTypeEnum.STRATEGY,
        ChloeMemoryTypeEnum.PERSONA,
        ChloeMemoryTypeEnum.VISION,
        ChloeMemoryTypeEnum.PROCESS,
        ChloeMemoryTypeEnum.KNOWLEDGE
      ];
      
      let allRelevantMemories: MemoryEntry[] = [];
      
      // Search for each memory type
      for (const type of memoryTypes) {
        let baseType: MemoryType;
        let filter = {};
        
        // Determine if this is a base type or extended type
        if (Object.values(MemoryType).includes(type as MemoryType)) {
          baseType = type as MemoryType;
        } else {
          // For extended types, search in the document collection with metadata filter
          baseType = MemoryType.DOCUMENT;
          filter = { type };
        }
        
        // Perform the semantic search
        if (typeof window === 'undefined') {
          const records = await serverQdrant.searchMemory(
            baseType as QdrantMemoryType, 
            query, 
            { 
              limit: Math.ceil(limit / memoryTypes.length),
              filter
            }
          );
          
          // Convert to memory entries
          const entries = this.convertRecordsToMemoryEntries(records);
          allRelevantMemories = [...allRelevantMemories, ...entries];
        }
      }
      
      // Sort by relevance (if we had scores, but we don't currently)
      // For now, limit to the requested number
      return allRelevantMemories.slice(0, limit);
    } catch (error) {
      console.error('Error retrieving relevant memories:', error);
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
   * Extract clean content from a formatted memory string
   * Handles standardized formats like "TYPE [timestamp]: content"
   */
  private extractContentFromFormattedMemory(formattedString: string): string {
    if (!formattedString) return '';
    
    // Check if this is a formatted memory entry
    const formatRegex = /^(USER MESSAGE|MESSAGE|THOUGHT|REASONING TRAIL) \[([^\]]+)\]: (.+)$/;
    const match = formattedString.match(formatRegex);
    
    if (match && match.length >= 4) {
      // Return just the content part
      return match[3];
    }
    
    // If not a formatted entry, return as is
    return formattedString;
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
          const content = memory.content ? this.extractContentFromFormattedMemory(memory.content) : '';
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

  /**
   * Get relevant memories for a query, enriched with source file and tags information
   * @param query The search query
   * @param types Array of specific memory types to search
   * @param limit Maximum number of results to return
   * @returns Array of relevant memory entries with metadata
   */
  async getRelevantMemoriesByType(
    query: string,
    types: string[],
    limit: number = 10
  ): Promise<{
    entries: MemoryEntry[];
    sourceFiles: string[];
    typesFound: string[];
  }> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      if (!types || types.length === 0) {
        return { entries: [], sourceFiles: [], typesFound: [] };
      }
      
      // Retrieve relevant memories by type
      const relevantMemories = await this.getRelevantMemories(query, limit, types);
      
      // Extract unique source files and types for reporting
      const sourceFiles = Array.from(new Set(
        relevantMemories
          .filter(memory => memory.metadata && typeof memory.metadata === 'object')
          .filter(memory => memory.metadata && 'filePath' in memory.metadata && memory.metadata.filePath)
          .map(memory => memory.metadata?.filePath as string)
      ));
      
      const typesFound = Array.from(new Set(
        relevantMemories
          .filter(memory => memory.category)
          .map(memory => memory.category)
      ));
      
      return {
        entries: relevantMemories,
        sourceFiles,
        typesFound
      };
    } catch (error) {
      console.error('Error retrieving relevant memories by type:', error);
      return { entries: [], sourceFiles: [], typesFound: [] };
    }
  }
}