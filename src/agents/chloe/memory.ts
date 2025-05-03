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
import { RerankerService } from './services/reranker';

// Define a custom memory type that includes 'insight' for this implementation
export type ChloeMemoryType = string;

// Define internal type for compatibility with serverQdrant
type QdrantMemoryType = 'message' | 'thought' | 'document' | 'task';

// Define pattern for detecting brand information
const BRAND_PATTERN = /\b(brand|company|organization)\s+(mission|vision|values|identity|info|information)\b/i;

export interface MemoryEntry extends Omit<BaseMemoryEntry, 'type'> {
  category: string;
  expiresAt?: Date;
  tags?: string[];
  type: ChloeMemoryType;
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
  private rerankerService: RerankerService | null = null;

  constructor(options?: ChloeMemoryOptions) {
    this.agentId = options?.agentId || 'chloe';
    this.useExternalMemory = options?.useExternalMemory || false;
    this.externalMemory = options?.externalMemory;
    
    // Initialize reranker service
    if (typeof window === 'undefined') {
      this.rerankerService = new RerankerService();
    }
    
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
    tags?: string[],
    metadata?: Record<string, any>
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
      type: baseType, // baseType is now a string which matches ChloeMemoryType
      metadata // Include provided metadata
    };
    
    // Add to server-side Qdrant (only when running server-side)
    if (typeof window === 'undefined') {
      // Convert baseType to the expected QdrantMemoryType
      const qdrantType = baseType as QdrantMemoryType;
      await serverQdrant.addMemory(
        qdrantType,
        formattedContent,
        {
          category: type.toString(),
          importance,
          source,
          tags,
          ...metadata, // Include all metadata fields directly in the metadata object
          // Ensure critical flag is set properly if importance is CRITICAL
          critical: metadata?.critical || importance === ImportanceLevel.CRITICAL
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
        tags: tags,
        ...metadata // Include metadata in external memory as well
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
  private convertToBaseMemoryType(type: ChloeMemoryType): string {
    // If the type is already a base memory type, return it directly
    if ([MemoryType.MESSAGE, MemoryType.THOUGHT, MemoryType.TASK, MemoryType.DOCUMENT].includes(type as any)) {
      return type;
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
        
        // Use the record type directly as a string
        const memType = record.type || MemoryType.MESSAGE;
        
        return {
          id,
          content,
          created,
          type: memType, // This is a string which matches ChloeMemoryType
          category,
          source: source as MemorySource, // Cast to ensure correct type
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
          type: MemoryType.MESSAGE, // This is a string which matches ChloeMemoryType
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
      
      console.log('Retrieving high importance memories');
      
      // Get memories with HIGH importance from Qdrant
      const highImportanceMemories: MemoryEntry[] = [];
      
      if (this.useExternalMemory && this.externalMemory) {
        const filter = {
          metadata: {
            importance: ImportanceLevel.HIGH
          }
        };
        
        if (typeof window === 'undefined') {
          const results = await serverQdrant.searchMemory(
            'thought' as QdrantMemoryType,
            "",
            { limit, filter }
          );
          
          const memories = this.convertRecordsToMemoryEntries(results);
          
          // Double-check importance to ensure correct filtering
          const filteredMemories = memories.filter(entry => String(entry.importance) === ImportanceLevel.HIGH);
          
          highImportanceMemories.push(...filteredMemories);
        }
      }
      
      // Fallback to external memory if available
      if (this.useExternalMemory && this.externalMemory) {
        if (this.externalMemory.search) {
          const results = await this.externalMemory.search('importance: high', limit);
          highImportanceMemories.push(...this.convertRecordsToMemoryEntries(results));
        }
      }
      
      // Fallback to in-memory implementation
      const inMemoryMemories = this.memoryStore.entries
        .filter(entry => String(entry.importance) === ImportanceLevel.HIGH)
        .sort((a, b) => b.created.getTime() - a.created.getTime())
        .slice(0, limit);
      
      highImportanceMemories.push(...inMemoryMemories);
      
      return highImportanceMemories.slice(0, limit);
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
   * Get relevant memories for a query with tag-based prioritization
   * @param query Search query
   * @param limit Maximum number of results to return
   * @param types Optional memory types to search
   * @param contextTags Optional tags from current context to prioritize matching memories
   * @param tagBoostFactor Optional factor to boost tag matches (default: 2)
   */
  async getRelevantMemories(
    query: string,
    limit: number = 5,
    types?: string[],
    contextTags?: string[],
    tagBoostFactor: number = 2
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
      
      // Determine if we have context tags to prioritize
      const hasContextTags = contextTags && contextTags.length > 0;
        
      // If we have context tags, increase the limit to ensure we get enough candidates
      // to filter by tag relevance
      const searchLimit = hasContextTags 
        ? Math.max(limit * 2, 10) // Double the limit or at least 10
        : limit;
      
      // Search for each memory type
      for (const type of memoryTypes) {
        let baseType: MemoryType;
        let filter: Record<string, any> = {};
        
        // Determine if this is a base type or extended type
        if (Object.values(MemoryType).includes(type as MemoryType)) {
          baseType = type as MemoryType;
        } else {
          // For extended types, search in the document collection with metadata filter
          baseType = MemoryType.DOCUMENT;
          filter = { type };
        }
        
        // If we have context tags, we can include them in the filter to get better matches
        // But we'll do our own post-processing to prioritize them
        if (hasContextTags) {
          // Use tags in filter only if tag-based search is specifically requested
          // We'll do a separate prioritization step later
          // Uncomment the next lines if you want direct tag filtering:
          /*
          // Add tags to filter, but don't require all (any match is good)
          filter.tags = contextTags;
          */
        }
        
        // Perform the semantic search
        if (typeof window === 'undefined') {
          const records = await serverQdrant.searchMemory(
            baseType as QdrantMemoryType, 
            query, 
            { 
              limit: Math.ceil(searchLimit / memoryTypes.length),
              filter
            }
          );
        
          // Convert to memory entries
          const entries = this.convertRecordsToMemoryEntries(records);
          allRelevantMemories = [...allRelevantMemories, ...entries];
        }
      }
      
      // If we have context tags, prioritize memories that have matching tags
      if (hasContextTags) {
        // Calculate a tag-match score for each memory
        const scoredMemories = allRelevantMemories.map(memory => {
          const memoryTags = memory.tags || [];
          const tagMatches = memoryTags.filter(tag => 
            contextTags!.includes(tag.toLowerCase())
          ).length;
          
          // Calculate score: 1 + (matchCount * boost / max possible matches)
          // This gives a balanced boost without overwhelming semantic matches
          const tagBoost = tagMatches > 0 
            ? 1 + (tagMatches * tagBoostFactor / contextTags!.length) 
            : 1;
            
          return {
            memory,
            score: tagBoost,
            tagMatches
          };
        });
        
        // Sort by score (highest first) and extract the memories
        allRelevantMemories = scoredMemories
          .sort((a, b) => {
            // First sort by tag matches
            if (b.tagMatches !== a.tagMatches) {
              return b.tagMatches - a.tagMatches;
            }
            // Then by score for same tag match count
            return b.score - a.score;
          })
          .map(item => item.memory);
      }
      
      // Dynamically adjust limit based on tag matches if contextTags are provided
      const effectiveLimit = hasContextTags 
        ? Math.min(
            // Return more results if we have good tag matches
            allRelevantMemories.filter(m => 
              m.tags?.some(tag => contextTags!.includes(tag.toLowerCase()))
            ).length + Math.ceil(limit / 2),
            limit * 2 // Don't exceed double the original limit
          )
        : limit;
      
      // Return the top N memories after tag-based prioritization
      return allRelevantMemories.slice(0, effectiveLimit);
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
      // Return just the content part without any "IMPORTANT! THOUGHT:" prefix
      let content = match[3];
      
      // Remove any "!IMPORTANT! THOUGHT:" or similar prefixes that might have been added
      content = content.replace(/^(!IMPORTANT!|IMPORTANT!)\s*(THOUGHT:)?\s*/i, '');
      content = content.replace(/^!IMPORTANT!\s+/i, ''); // Remove standalone !IMPORTANT! prefix
      
      return content;
    }
    
    // If not a formatted entry, return as is but still clean up prefixes
    let content = formattedString;
    
    // More aggressive prefix removal for unformatted content
    content = content.replace(/^(!IMPORTANT!|IMPORTANT!)\s*(THOUGHT:)?\s*/i, '');
    content = content.replace(/^!IMPORTANT!\s+/i, '');
    
    // Also check for uppercase variants
    content = content.replace(/^(IMPORTANT!|!IMPORTANT!)\s+/i, '');
    
    return content;
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

  /**
   * Enhanced memory retrieval with reranking - get relevant memories with hybrid approach
   * @param query User query to find relevant memories for
   * @param candidateLimit Number of initial candidates to retrieve
   * @param finalLimit Number of final results to return after reranking
   * @param options Additional options like debug mode
   * @returns Reranked relevant memory entries
   */
  async getEnhancedRelevantMemories(
    query: string,
    candidateLimit: number = 15,
    finalLimit: number = 5,
    options: {
      types?: string[];
      debug?: boolean;
      returnScores?: boolean;
      confidenceThreshold?: number;
      validateContent?: boolean;
      requireConfidence?: boolean;
    } = {}
  ): Promise<{
    entries: MemoryEntry[];
    hasConfidence: boolean;
    confidenceScore?: number;
    contentValid?: boolean;
    invalidReason?: string;
  }> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // Step 1: Get a broader set of candidates using vector search
      const candidates = await this.getRelevantMemories(
        query,
        candidateLimit,
        options.types
      );
      
      // If we don't have the reranker or we have few candidates, return as is
      if (!this.rerankerService) {
        return {
          entries: candidates.slice(0, finalLimit),
          hasConfidence: false
        };
      }
      
      // Step 2: Rerank the candidates with confidence threshold and validation
      const rerankedResult = await this.rerankerService.rerankWithConfidence(
        query, 
        candidates, 
        {
          debug: options.debug,
          returnScores: options.returnScores || true,
          confidenceThreshold: options.confidenceThreshold || 70,
          validateContent: options.validateContent || true
        }
      );
      
      // If caller requires confidence and it wasn't met, return empty results
      if (options.requireConfidence === true && !rerankedResult.confidenceThresholdMet) {
        return {
          entries: [],
          hasConfidence: false,
          confidenceScore: rerankedResult.topScore
        };
      }
      
      // Extract validation result if available
      let contentValid: boolean | undefined;
      let invalidReason: string | undefined;
      
      if (rerankedResult.validationResult) {
        contentValid = rerankedResult.validationResult.isValid;
        invalidReason = rerankedResult.validationResult.reason;
      }
      
      // Return the top results with confidence information
      return {
        entries: rerankedResult.entries.slice(0, finalLimit),
        hasConfidence: rerankedResult.confidenceThresholdMet,
        confidenceScore: rerankedResult.topScore,
        contentValid,
        invalidReason
      };
    } catch (error) {
      console.error('Error in enhanced memory retrieval:', error);
      
      // Fallback to regular retrieval if reranking fails
      const fallbackResults = await this.getRelevantMemories(query, finalLimit, options.types);
      return {
        entries: fallbackResults,
        hasConfidence: false
      };
    }
  }

  /**
   * Get brand identity information with high priority
   * This is a specialized method specifically for retrieving brand information
   * 
   * @returns Object containing structured brand information and raw memories
   */
  async getBrandIdentityInformation(): Promise<{
    mission?: string;
    vision?: string;
    values?: string[];
    targetAudience?: string;
    brandPersonality?: string[];
    uniqueValueProposition?: string;
    rawMemories: MemoryEntry[];
    hasConfidentData: boolean;
  }> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      console.log('Retrieving brand identity information...');
      
      // Get all memories with CRITICAL importance and PERSONA type
      const brandMemories = await this.getRelevantMemoriesByType(
        'brand identity mission vision values target audience personality', 
        [ChloeMemoryTypeEnum.PERSONA],
        20 // Get more entries to ensure we capture all brand components
      );
      
      // Get all memories tagged with brand-related tags
      const brandKeywords = [
        'brand',
        'identity', 
        'mission',
        'vision',
        'values',
        'target audience',
        'personality',
        'value proposition'
      ];
      
      // Also try a direct query for any memory with brand information
      const directQueryMemories = await this.getRelevantMemories(
        'brand identity mission vision values', 
        15,
        [ChloeMemoryTypeEnum.PERSONA, 'persona']
      );
      
      // Combine and deduplicate memories
      const allMemories = [...brandMemories.entries, ...directQueryMemories];
      const uniqueMemories: MemoryEntry[] = [];
      const seenIds = new Set<string>();
      
      for (const memory of allMemories) {
        if (!seenIds.has(memory.id)) {
          seenIds.add(memory.id);
          uniqueMemories.push(memory);
        }
      }
      
      // Filter memories to only include CRITICAL importance if we have enough
      const criticalMemories = uniqueMemories.filter(m => 
        String(m.importance) === ImportanceLevel.CRITICAL || 
        String(m.metadata?.importance) === ImportanceLevel.CRITICAL
      );
      
      const memoriesToUse = criticalMemories.length >= 3 ? criticalMemories : uniqueMemories;
      
      // Parse structured data from memory entries
      const result = {
        mission: '',
        vision: '',
        values: [] as string[],
        targetAudience: '',
        brandPersonality: [] as string[],
        uniqueValueProposition: '',
        rawMemories: memoriesToUse,
        hasConfidentData: criticalMemories.length >= 3
      };
      
      // Parse the memory content to extract structured information
      for (const memory of memoriesToUse) {
        const content = memory.content || '';
        
        // Mission
        if (
          (memory.metadata?.tags?.includes('mission') || 
           content.toLowerCase().includes('mission')) && 
          !result.mission
        ) {
          const missionMatch = content.match(/mission[: ]+(.*?)(?:\.|$)/i);
          if (missionMatch) {
            result.mission = missionMatch[1].trim();
          }
        }
        
        // Vision
        if (
          (memory.metadata?.tags?.includes('vision') || 
           content.toLowerCase().includes('vision')) && 
          !result.vision
        ) {
          const visionMatch = content.match(/vision[: ]+(.*?)(?:\.|$)/i);
          if (visionMatch) {
            result.vision = visionMatch[1].trim();
          }
        }
        
        // Values
        if (
          memory.metadata?.tags?.includes('values') || 
          content.toLowerCase().includes('values')
        ) {
          const valuesMatch = content.match(/values[: ]+(.*?)(?:\.|$)/i);
          if (valuesMatch) {
            const valuesStr = valuesMatch[1].trim();
            const values = valuesStr.split(/,|\|/).map(v => v.trim());
            for (const value of values) {
              if (value && !result.values.includes(value)) {
                result.values.push(value);
              }
            }
          }
        }
        
        // Target audience
        if (
          (memory.metadata?.tags?.includes('targetAudience') || 
           content.toLowerCase().includes('target audience')) && 
          !result.targetAudience
        ) {
          const audienceMatch = content.match(/target audience[: ]+(.*?)(?:\.|$)/i);
          if (audienceMatch) {
            result.targetAudience = audienceMatch[1].trim();
          }
        }
        
        // Brand personality
        if (
          memory.metadata?.tags?.includes('brandPersonality') || 
          content.toLowerCase().includes('brand personality') ||
          content.toLowerCase().includes('personality')
        ) {
          const personalityMatch = content.match(/personality[: ]+(.*?)(?:\.|$)/i);
          if (personalityMatch) {
            const personalityStr = personalityMatch[1].trim();
            const traits = personalityStr.split(/,|\|/).map(t => t.trim());
            for (const trait of traits) {
              if (trait && !result.brandPersonality.includes(trait)) {
                result.brandPersonality.push(trait);
              }
            }
          }
        }
        
        // Unique value proposition
        if (
          (memory.metadata?.tags?.includes('uniqueValueProposition') || 
           content.toLowerCase().includes('value proposition') ||
           content.toLowerCase().includes('unique selling')) && 
          !result.uniqueValueProposition
        ) {
          const uvpMatch = content.match(/value proposition[: ]+(.*?)(?:\.|$)/i);
          if (uvpMatch) {
            result.uniqueValueProposition = uvpMatch[1].trim();
          }
        }
      }
      
      console.log('Retrieved brand identity data with confidence:', result.hasConfidentData);
      return result;
    } catch (error) {
      console.error('Error retrieving brand identity information:', error);
      return {
        rawMemories: [],
        hasConfidentData: false
      };
    }
  }

  /**
   * Identify and categorize conversation threads based on topic and context
   * This helps group related messages together even if sent separately
   * 
   * @param query The current query to find related context
   * @param recentMessages Array of recent messages to analyze for thread continuity
   * @returns Object containing thread information and related memories
   */
  async identifyConversationThread(
    query: string,
    recentMessages: MemoryEntry[] = []
  ): Promise<{
    threadId?: string;
    threadTopic?: string;
    isPartOfThread: boolean;
    relatedMemories: MemoryEntry[];
    threadImportance: ImportanceLevel;
  }> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // If we don't have recent messages, get the last 10 messages
      let messagesForAnalysis = recentMessages;
      if (!messagesForAnalysis || messagesForAnalysis.length === 0) {
        // Get recent messages from memory
        const filter = {
          metadata: {
            category: MemoryType.MESSAGE
          }
        };
        
        if (typeof window === 'undefined') {
          const results = await serverQdrant.searchMemory(
            MemoryType.MESSAGE as QdrantMemoryType,
            "",
            { limit: 10, filter }
          );
          messagesForAnalysis = this.convertRecordsToMemoryEntries(results);
        }
      }
      
      // Sort messages by timestamp (newest first)
      messagesForAnalysis.sort((a, b) => 
        (b.created?.getTime() || 0) - (a.created?.getTime() || 0)
      );
      
      // Extract key topics from the current query
      const queryKeywords = this.extractKeyTerms(query);
      
      // Analyze recent messages for topical similarity
      let threadScore = 0;
      let threadKeywords: string[] = [];
      let threadMessages: MemoryEntry[] = [];
      
      // Find topical connections across recent messages
      for (const message of messagesForAnalysis) {
        const messageContent = message.content || '';
        const messageKeywords = this.extractKeyTerms(messageContent);
        
        // Calculate overlap between this message and query keywords
        const overlapWithQuery = this.calculateKeywordOverlap(
          queryKeywords, 
          messageKeywords
        );
        
        // If there's significant overlap with the query or growing thread keywords,
        // consider this message part of the thread
        const overlapWithThread = this.calculateKeywordOverlap(
          threadKeywords, 
          messageKeywords
        );
        
        if (overlapWithQuery > 0.3 || overlapWithThread > 0.25) {
          // This message is part of the thread
          threadMessages.push(message);
          
          // Add unique keywords to thread keywords
          threadKeywords = Array.from(new Set([...threadKeywords, ...messageKeywords]));
          
          // Increase thread score
          threadScore += 1;
        }
      }
      
      // Check if we found a significant thread (at least 2 connected messages)
      const isPartOfThread = threadScore >= 2;
      
      // If we found a thread, search for additional related memories
      let relatedMemories: MemoryEntry[] = [];
      if (isPartOfThread) {
        // Use thread keywords to find more related memories
        const threadKeywordsQuery = threadKeywords.slice(0, 10).join(' ');
        
        // Search for any memory related to the thread topic
        relatedMemories = await this.getRelevantMemories(
          threadKeywordsQuery,
          10,
          undefined,
          threadKeywords
        );
      }
      
      // Generate a thread ID and topic if we found a thread
      let threadId, threadTopic;
      if (isPartOfThread) {
        // Generate a stable thread ID based on top keywords
        const stableKeywords = [...threadKeywords].sort().slice(0, 5);
        threadId = `thread_${stableKeywords.join('_')}`;
        
        // Generate a thread topic - top 3-5 keywords
        threadTopic = threadKeywords.slice(0, Math.min(5, threadKeywords.length)).join(', ');
      }
      
      // Determine thread importance
      // More messages and higher relevance = higher importance
      let threadImportance = ImportanceLevel.MEDIUM;
      if (threadScore >= 5) {
        threadImportance = ImportanceLevel.HIGH;
      } else if (threadScore <= 2) {
        threadImportance = ImportanceLevel.LOW;
      }
      
      // For certain key topics, increase importance
      const highImportanceTopics = [
        'onboarding', 'strategy', 'mission', 'vision', 'brand', 'budget',
        'goal', 'target', 'priority', 'roadmap', 'metrics', 'performance',
        'analytics', 'resources', 'stakeholders'
      ];
      
      // Check if any high importance topics are in the thread keywords
      for (const topic of highImportanceTopics) {
        if (threadKeywords.includes(topic)) {
          // Elevate importance for critical business topics
          threadImportance = ImportanceLevel.HIGH;
          break;
        }
      }
      
      // Return thread information
      return {
        threadId,
        threadTopic,
        isPartOfThread,
        relatedMemories,
        threadImportance
      };
    } catch (error) {
      console.error('Error identifying conversation thread:', error);
      return {
        isPartOfThread: false,
        relatedMemories: [],
        threadImportance: ImportanceLevel.MEDIUM
      };
    }
  }
  
  /**
   * Extract key terms from text for semantic analysis
   * @param text The text to extract key terms from
   * @returns Array of key terms
   */
  private extractKeyTerms(text: string): string[] {
    if (!text) return [];
    
    // Convert to lowercase
    const lowercaseText = text.toLowerCase();
    
    // Split into words
    const words = lowercaseText.split(/\W+/);
    
    // Remove common stop words
    const stopWords = new Set([
      'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with',
      'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
      'I', 'you', 'he', 'she', 'it', 'we', 'they',
      'my', 'your', 'his', 'her', 'its', 'our', 'their',
      'this', 'that', 'these', 'those',
      'do', 'does', 'did', 'doing',
      'have', 'has', 'had', 'having',
      'can', 'could', 'will', 'would', 'should', 'shall',
      'not', 'no', 'yes', 'ok', 'okay'
    ]);
    
    // Filter out stop words and short words
    const keyTerms = words.filter(word => 
      word.length > 2 && !stopWords.has(word)
    );
    
    // Return unique key terms - convert to array first
    return Array.from(new Set(keyTerms));
  }
  
  /**
   * Calculate the overlap between two sets of keywords
   * @param keywords1 First set of keywords
   * @param keywords2 Second set of keywords
   * @returns Overlap score (0.0 to 1.0)
   */
  private calculateKeywordOverlap(keywords1: string[], keywords2: string[]): number {
    if (!keywords1.length || !keywords2.length) return 0;
    
    // Count matches
    const matches = keywords1.filter(kw => keywords2.includes(kw)).length;
    
    // Calculate Jaccard similarity: intersection / union
    // Create union set without using spread operator
    const unionSet = new Set<string>();
    keywords1.forEach(kw => unionSet.add(kw));
    keywords2.forEach(kw => unionSet.add(kw));
    
    return matches / unionSet.size;
  }
  
  /**
   * Determine the importance of a memory based on content analysis
   * More generic approach than just looking for brand information
   * 
   * @param content The memory content to analyze
   * @param context Optional context to help determine importance
   * @returns The appropriate importance level
   */
  determineMemoryImportance(
    content: string,
    context?: {
      category?: string;
      isThreadPart?: boolean;
      threadImportance?: ImportanceLevel;
      tags?: string[];
    }
  ): ImportanceLevel {
    // Default to medium importance
    let importance = ImportanceLevel.MEDIUM;
    
    // If this memory is part of an important thread, use the thread importance
    if (context?.isThreadPart && context.threadImportance) {
      return context.threadImportance;
    }
    
    // Check for high-priority content patterns
    const highPriorityPatterns = [
      // Business strategy terms
      /mission|vision|values|goals|objectives|strategy|roadmap/i,
      // Metrics and performance
      /metrics|kpi|targets|performance|analytics|growth|revenue/i,
      // Resource allocation
      /budget|resources|allocation|timeline|schedule|plan/i,
      // Stakeholders and relationships
      /stakeholder|board|executive|partner|client|customer|investor/i,
      // Operational critical information
      /critical|urgent|priority|important|deadline|milestone/i,
      // Onboarding and structured information
      /onboarding|section|overview|framework|structure|documentation/i
    ];
    
    // Content length often correlates with importance (for substantive content)
    const contentLength = content.length;
    if (contentLength > 500) {
      // Longer content is generally more substantive
      importance = ImportanceLevel.HIGH;
    } else if (contentLength < 100) {
      // Very short content is often less important
      importance = ImportanceLevel.LOW;
    }
    
    // Check for high-priority patterns
    for (const pattern of highPriorityPatterns) {
      if (pattern.test(content)) {
        importance = ImportanceLevel.HIGH;
        break;
      }
    }
    
    // Special case for critical onboarding information with structured data
    if (
      (/onboarding/i.test(content) && /section|part|component/i.test(content)) ||
      (content.includes('###') || content.includes('##')) // Markdown headings indicate structure
    ) {
      importance = ImportanceLevel.CRITICAL;
    }
    
    // Check category - some categories are inherently more important
    if (context?.category) {
      const highImportanceCategories = [
        'strategy', 'persona', 'vision', 'metrics', 'performance', 
        'onboarding', 'requirements', 'resources'
      ];
      
      if (highImportanceCategories.includes(context.category.toLowerCase())) {
        // Elevate to at least HIGH importance
        importance = String(importance) === ImportanceLevel.CRITICAL 
          ? ImportanceLevel.CRITICAL 
          : ImportanceLevel.HIGH;
      }
    }
    
    // Check tags - certain tags indicate higher importance
    if (context?.tags && context.tags.length > 0) {
      const criticalTags = ['critical', 'essential', 'priority', 'onboarding', 'core'];
      const hasHighPriorityTag = context.tags.some(tag => 
        criticalTags.includes(tag.toLowerCase())
      );
      
      if (hasHighPriorityTag) {
        importance = ImportanceLevel.CRITICAL;
      }
    }
    
    return importance;
  }

  /**
   * Enhance queries with key terms to improve recall
   * This helps find relevant content even when the exact query terms aren't used
   * 
   * @param query Original query
   * @returns Enhanced query with expanded terms
   */
  private expandQuery(query: string): string {
    if (!query || query.trim().length === 0) {
      return query;
    }
    
    // Extract key terms from the query
    const queryTerms = this.extractKeyTerms(query);
    
    // Don't expand very short queries as they're likely already focused
    if (queryTerms.length <= 2 && query.length < 15) {
      return query;
    }
    
    // Map of common terms and their related expansions to improve recall
    const expansionMap: Record<string, string[]> = {
      // Business concepts
      'mission': ['purpose', 'goal', 'aim', 'objective', 'vision'],
      'vision': ['mission', 'future', 'goal', 'aim', 'aspiration'],
      'values': ['principles', 'ethics', 'beliefs', 'culture', 'philosophy'],
      'strategy': ['plan', 'approach', 'roadmap', 'method', 'framework'],
      'brand': ['identity', 'image', 'reputation', 'presence', 'persona'],
      'customer': ['user', 'client', 'audience', 'consumer', 'buyer'],
      'market': ['industry', 'sector', 'niche', 'segment', 'domain'],
      'product': ['service', 'offering', 'solution', 'tool', 'application'],
      'competitors': ['competition', 'rivals', 'alternatives', 'market players'],
      'metrics': ['kpis', 'measurements', 'analytics', 'indicators', 'performance'],
      'growth': ['increase', 'expansion', 'scaling', 'development', 'advancement'],
      
      // Onboarding/documentation concepts
      'onboarding': ['introduction', 'setup', 'getting started', 'orientation'],
      'documentation': ['docs', 'guides', 'help', 'instructions', 'manuals'],
      'resources': ['assets', 'tools', 'materials', 'utilities'],
      'section': ['part', 'segment', 'component', 'module', 'portion'],
      
      // Marketing concepts
      'marketing': ['promotion', 'advertising', 'campaigns', 'outreach'],
      'audience': ['users', 'customers', 'clients', 'demographic', 'target market'],
      'content': ['material', 'media', 'assets', 'posts', 'articles'],
      'acquisition': ['growth', 'user acquisition', 'customer acquisition', 'lead generation'],
      'retention': ['loyalty', 'churn reduction', 'customer retention', 'engagement'],
      'engagement': ['interaction', 'participation', 'activity', 'involvement'],
      'conversion': ['sales', 'sign-ups', 'leads', 'purchases', 'transactions'],
      'funnel': ['pipeline', 'journey', 'process', 'stages', 'flow']
    };
    
    // Build expanded query
    let expandedTerms = new Set<string>();
    
    // Add original query terms
    queryTerms.forEach(term => expandedTerms.add(term));
    
    // Add expanded terms
    queryTerms.forEach(term => {
      const lowerTerm = term.toLowerCase();
      // If we have expansions for this term, add some of them
      if (expansionMap[lowerTerm]) {
        // Add up to 3 expansion terms to avoid diluting the query too much
        const expansionTerms = expansionMap[lowerTerm].slice(0, 3);
        expansionTerms.forEach(expansion => expandedTerms.add(expansion));
      }
    });
    
    // Combine original query with expanded terms
    const expandedQuery = `${query} ${Array.from(expandedTerms).join(' ')}`;
    
    console.log(`Expanded query: "${query}" → "${expandedQuery}"`);
    
    return expandedQuery;
  }

  /**
   * Improved memory retrieval using hybrid search (vector + keyword) and query expansion
   * @param query Search query to find relevant memories
   * @param limit Maximum number of results to return
   * @param options Additional search options
   */
  async getEnhancedMemoriesWithHybridSearch(
    query: string,
    limit: number = 10,
    options: {
      types?: string[];
      semanticWeight?: number;
      keywordWeight?: number;
      expandQuery?: boolean;
      requireAllKeywords?: boolean;
      minRelevanceScore?: number;
      useQueryClusters?: boolean;
    } = {}
  ): Promise<MemoryEntry[]> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Defaults for search weights
      const semanticWeight = options.semanticWeight || 0.7;
      const keywordWeight = options.keywordWeight || 0.3;
      
      // Extract key terms from the query
      const queryKeywords = this.extractKeyTerms(query);
      
      // Expand the query if needed (default to true)
      const shouldExpandQuery = options.expandQuery !== false;
      const queryForSearch = shouldExpandQuery ? this.expandQuery(query) : query;
      
      // Determine if we should use query clusters
      const useQueryClusters = options.useQueryClusters !== false && queryKeywords.length >= 3;
      
      // If using clusters, create sub-queries for different aspects
      const queryVariants = useQueryClusters 
        ? this.createQueryClusters(query, queryKeywords)
        : [queryForSearch];
      
      // Step 1: Get candidate memories using semantic search for each query variant
      let allCandidates: MemoryEntry[] = [];
      
      for (const queryVariant of queryVariants) {
        // Get more candidates than needed to ensure good coverage
        const candidateLimit = useQueryClusters 
          ? Math.ceil(limit * 1.5 / queryVariants.length) 
          : limit * 2;
        
        // Perform semantic search for this query variant
        const semanticResults = await this.getRelevantMemories(
          queryVariant,
          candidateLimit,
          options.types
        );
        
        // Add to candidates
        allCandidates = [...allCandidates, ...semanticResults];
      }
      
      // Deduplicate candidates
      const dedupedCandidates: MemoryEntry[] = [];
      const seenIds = new Set<string>();
      
      for (const memory of allCandidates) {
        if (!seenIds.has(memory.id)) {
          seenIds.add(memory.id);
          dedupedCandidates.push(memory);
        }
      }
      
      // Step 2: Calculate hybrid scores using both semantic and keyword matching
      const scoredMemories = dedupedCandidates.map(memory => {
        // Extract content
        const content = memory.content || '';
        
        // Count exact keyword matches
        let keywordMatches = 0;
        let keywordMatchCount = 0;
        
        if (queryKeywords.length > 0) {
          // Convert content to lowercase for case-insensitive matching
          const lowerContent = content.toLowerCase();
          
          // Count matches
          for (const keyword of queryKeywords) {
            const lowerKeyword = keyword.toLowerCase();
            // Use word boundary for more precise matching
            const regex = new RegExp(`\\b${lowerKeyword}\\b`, 'i');
            
            if (regex.test(lowerContent)) {
              keywordMatches += 1;
              
              // Count multiple occurrences (with diminishing returns)
              const matches = (lowerContent.match(new RegExp(regex, 'g')) || []).length;
              keywordMatchCount += Math.min(matches, 3); // Cap at 3 to avoid over-counting
            }
          }
        }
        
        // Calculate keyword score (0 to 1)
        let keywordScore = 0;
        if (queryKeywords.length > 0) {
          // If requiring all keywords, check if we matched all of them
          if (options.requireAllKeywords && keywordMatches < queryKeywords.length) {
            keywordScore = 0.1 * (keywordMatches / queryKeywords.length); // Small partial score
          } else {
            // Normal scoring - match proportion plus bonus for multiple occurrences
            keywordScore = 
              (keywordMatches / queryKeywords.length) * 0.7 + // Base score from proportion matched
              Math.min(keywordMatchCount / (queryKeywords.length * 2), 0.3); // Bonus for multiple matches
          }
        }
        
        // Get the semantic score if available, otherwise assign moderate score
        const rerankScore = memory.metadata?.rerankScore || 0.5;
        const semanticScore = typeof rerankScore === 'number' ? rerankScore : 0.5;
        
        // Compute combined score
        const combinedScore = (semanticScore * semanticWeight) + (keywordScore * keywordWeight);
        
        // Boost certain memory types that should be prioritized, like high-importance or structured content
        let boostFactor = 1.0;
        
        // Boost based on importance
        const importanceStr = String(memory.importance).toLowerCase();
        if (importanceStr === ImportanceLevel.CRITICAL) {
          boostFactor *= 1.25;
        } else if (importanceStr === ImportanceLevel.HIGH) {
          boostFactor *= 1.15;
        }
        
        // Boost messages with structured content (like documentation/onboarding sections)
        const hasStructure = 
          (memory.content || '').includes('##') || // Markdown headings
          /\d+\.\s+[\w\s]+/.test(memory.content || ''); // Numbered lists
          
        if (hasStructure) {
          boostFactor *= 1.1;
        }
        
        // Apply boost
        const finalScore = combinedScore * boostFactor;
        
        return {
          memory,
          score: finalScore,
          keywordScore,
          semanticScore,
          keywordMatches,
          boostFactor
        };
      });
      
      // Filter out memories with scores below minimum threshold (if specified)
      const minScore = options.minRelevanceScore || 0.1;
      const filteredMemories = scoredMemories.filter(item => item.score >= minScore);
      
      // Sort by score (highest first)
      filteredMemories.sort((a, b) => b.score - a.score);
      
      // Add scores to metadata for debugging
      const resultMemories = filteredMemories.slice(0, limit).map(item => {
        // Clone the memory to avoid modifying original objects
        const memory = { ...item.memory };
        
        // Ensure metadata exists
        if (!memory.metadata) {
          memory.metadata = {};
        }
        
        // Add scores to metadata
        memory.metadata.hybridScore = item.score.toFixed(2);
        memory.metadata.keywordScore = item.keywordScore.toFixed(2);
        memory.metadata.semanticScore = item.semanticScore.toFixed(2);
        memory.metadata.keywordMatches = item.keywordMatches;
        
        return memory;
      });
      
      console.log(`Hybrid search for "${query}" found ${resultMemories.length} results`);
      return resultMemories;
    } catch (error) {
      console.error('Error in hybrid memory search:', error);
      // Fallback to standard relevant memories
      return this.getRelevantMemories(query, limit, options.types);
    }
  }
  
  /**
   * Create multiple query variants to capture different aspects of a complex query
   * This improves recall by searching for different perspectives on the same topic
   */
  private createQueryClusters(query: string, queryKeywords: string[]): string[] {
    // If not enough keywords, just use the original query
    if (queryKeywords.length < 3) {
      return [query];
    }
    
    // Group similar keywords together to create focused sub-queries
    const clusters: string[][] = [];
    const usedKeywords = new Set<string>();
    
    // Create clusters based on semantic relatedness
    // Since we don't have true semantic relatedness, use common categories
    
    // For simplicity, use predefined categories
    const categories = [
      ['mission', 'vision', 'purpose', 'goals', 'values', 'beliefs'],
      ['strategy', 'plan', 'roadmap', 'approach', 'method', 'execution'],
      ['customers', 'users', 'audience', 'clients', 'demographics', 'personas'],
      ['product', 'service', 'offering', 'solution', 'features', 'benefits'],
      ['metrics', 'kpis', 'measurements', 'performance', 'analytics', 'data'],
      ['marketing', 'promotion', 'advertising', 'communication', 'messaging'],
      ['resources', 'assets', 'tools', 'materials', 'documentation']
    ];
    
    // Assign keywords to clusters
    for (const category of categories) {
      const matchingKeywords = queryKeywords.filter(kw => 
        !usedKeywords.has(kw) && 
        category.some(cat => kw.includes(cat) || cat.includes(kw))
      );
      
      if (matchingKeywords.length > 0) {
        clusters.push(matchingKeywords);
        matchingKeywords.forEach(kw => usedKeywords.add(kw));
      }
    }
    
    // Add remaining keywords to their own cluster
    const remainingKeywords = queryKeywords.filter(kw => !usedKeywords.has(kw));
    if (remainingKeywords.length > 0) {
      clusters.push(remainingKeywords);
    }
    
    // Ensure we have at least the original query
    if (clusters.length === 0) {
      return [query];
    }
    
    // Build query variants from clusters
    const queryVariants = clusters.map(cluster => {
      // Combine cluster keywords with some original query context
      return `${query.substring(0, 50)} ${cluster.join(' ')}`;
    });
    
    // Always include the original query
    if (!queryVariants.includes(query)) {
      queryVariants.unshift(query);
    }
    
    console.log(`Created ${queryVariants.length} query variants from "${query}"`);
    return queryVariants;
  }
  
  /**
   * Cleaner API: Get most relevant memories using our best retrieval strategy
   * @param query The query to search for
   * @param limit Maximum number of results to return
   * @param options Additional options to customize search
   */
  async getBestMemories(
    query: string,
    limit: number = 7,
    options: {
      types?: string[];
      expandQuery?: boolean;
      considerImportance?: boolean;
      requireKeywords?: boolean;
      debugScores?: boolean;
    } = {}
  ): Promise<MemoryEntry[]> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Configure search with good defaults
      const searchOptions = {
        types: options.types,
        semanticWeight: 0.7,
        keywordWeight: 0.3,
        expandQuery: options.expandQuery !== false, // Default to true
        requireAllKeywords: options.requireKeywords === true, // Default to false
        minRelevanceScore: 0.15,
        useQueryClusters: query.length > 20 // Only use query clusters for longer queries
      };
      
      // Use our hybrid search
      const memories = await this.getEnhancedMemoriesWithHybridSearch(
        query,
        limit * 2, // Get more candidates for additional filtering
        searchOptions
      );
      
      // Apply additional prioritization if needed
      if (options.considerImportance !== false) {
        // Ensure we include at least some high-importance memories if available
        const highImportanceMemories = memories.filter(m => {
          const impStr = String(m.importance).toLowerCase(); 
          return impStr === 'critical' || impStr === 'high';
        });
        
        const otherMemories = memories.filter(m => {
          const impStr = String(m.importance).toLowerCase();
          return impStr !== 'critical' && impStr !== 'high';
        });
        
        // If we have high importance memories, ensure they're included
        if (highImportanceMemories.length > 0) {
          // Reserve at least 1/3 of slots for high importance memories if available
          const highImportanceSlots = Math.min(
            Math.ceil(limit / 3),
            highImportanceMemories.length
          );
          
          // Fill remaining slots with other memories
          const otherSlots = limit - highImportanceSlots;
          
          // Combine results
          const results = [
            ...highImportanceMemories.slice(0, highImportanceSlots),
            ...otherMemories.slice(0, otherSlots)
          ];
          
          return results;
        }
      }
      
      // If no special handling needed, return the top memories
      return memories.slice(0, limit);
    } catch (error) {
      console.error('Error getting best memories:', error);
      // Fallback to standard method
      return this.getRelevantMemories(query, limit, options.types);
    }
  }

  /**
   * Format memory for prompt
   */
  formatMemoryForPrompt(memory: MemoryEntry, includeMetadata: boolean = false): string {
    // Add importance marker for high importance memories
    const importanceMarker = String(memory.importance) === ImportanceLevel.HIGH ? '!IMPORTANT! ' : '';
    
    // Format based on memory type
    const created = memory.created ? new Date(memory.created).toISOString() : new Date().toISOString();
    const date = created.split('T')[0];
    const time = created.split('T')[1].substring(0, 8);
    const timestamp = `${date} ${time}`;
    
    let formattedMemory = `${importanceMarker}[${timestamp}] ${memory.content}`;
    
    // Add metadata if requested
    if (includeMetadata && memory.metadata) {
      const metadataStr = Object.entries(memory.metadata)
        .filter(([key]) => !['filePath', 'rawContent'].includes(key))
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join(', ');
      
      if (metadataStr) {
        formattedMemory += `\nMetadata: ${metadataStr}`;
      }
    }
    
    return formattedMemory;
  }

  /**
   * Handle importance rating and extraction for incoming memories
   */
  processImportanceAndExtract(text: string, metadata: Record<string, any> = {}): { 
    text: string, 
    metadata: Record<string, any>,
    extracted: boolean
  } {
    // Start with no modification
    let modified = false;
    let modifiedText = text;
    
    // Structure for extracted data
    const extracted: Record<string, any> = {};
    
    // Check for brand info patterns
    if (BRAND_PATTERN.test(text)) {
      console.log('Brand information detected');
      extracted.brandInfo = true;
      
      // Set to CRITICAL importance
      metadata.importance = ImportanceLevel.CRITICAL;
      modified = true;
      
      // Extract structured components if available
      const missionMatch = text.match(/mission\s*:([^:]+)/i);
      const visionMatch = text.match(/vision\s*:([^:]+)/i);
      const valuesMatch = text.match(/values\s*:([^:]+)/i);
      
      if (missionMatch) extracted.mission = missionMatch[1].trim();
      if (visionMatch) extracted.vision = visionMatch[1].trim();
      if (valuesMatch) extracted.values = valuesMatch[1].trim();
    }
    
    // Special handling based on importance level
    if (metadata.importance) {
      if (String(metadata.importance) === ImportanceLevel.HIGH) {
        // High importance: Tag with relevant categories
        const categories = ['important', 'core', 'critical'];
        metadata.tags = [...(metadata.tags || []), ...categories];
        modified = true;
      } else if (String(metadata.importance) === ImportanceLevel.LOW) {
        // Low importance: Summarize to save space
        if (modifiedText.length > 500) {
          // In a real implementation, we might use a summarization service here
          modifiedText = modifiedText.substring(0, 500) + '... [summarized]';
          modified = true;
        }
      }
    }

    return {
      text: modifiedText,
      metadata: {
        ...metadata,
        ...extracted
      },
      extracted: Object.keys(extracted).length > 0 || modified
    };
  }
}