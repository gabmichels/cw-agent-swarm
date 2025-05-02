import * as serverQdrant from '../../../server/qdrant';
import { getLLM } from '../../core/llm';
import { ChatPromptTemplate } from '@langchain/core/prompts';

// Define memory scopes as requested
export type MemoryScope = 'shortTerm' | 'longTerm' | 'inbox' | 'reflections';

// Define structured memory types
export type MemoryKind = 'fact' | 'insight' | 'task' | 'message' | 'decision' | 'feedback';

// Define memory entry interface
export interface MemoryEntry {
  id: string;
  agentId?: string; // Agent that owns this memory
  scope: MemoryScope;
  kind?: MemoryKind; // Type of memory for structured access
  content: string;
  timestamp: number;
  tags?: string[];
  relevance?: number; // 0.0 to 1.0
  expiresAt?: number;
  sourceAgent?: string;
  contextId?: string; // delegationContextId or message thread
  namespace?: string;
  summaryOf?: string[]; // IDs of memories that were summarized to create this entry
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
  kind?: MemoryKind;
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
 * Suggests tags for memory content using a cheap LLM
 * @param content The memory content to generate tags for
 * @returns Array of suggested tags
 */
export async function suggestTags(content: string): Promise<string[]> {
  try {
    // Use the cheap LLM model for tag generation
    const model = getLLM({ useCheapModel: true });
    
    // Create a prompt to extract relevant tags
    const systemMessage = `Extract 3-5 relevant tags from the given text. 
    Return ONLY an array of lowercase, single-word or hyphenated tags in JSON format.
    Example: ["marketing", "user-feedback", "product", "strategy"]
    Do not include any explanation, just the JSON array of tags.`;
    
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", systemMessage],
      ["human", content]
    ]);
    
    // Get response from the model
    const chain = prompt.pipe(model);
    const response = await chain.invoke({});
    const responseText = response.content.toString().trim();
    
    // Parse the JSON array from the response
    try {
      // Handle cases where the model might include extra text
      const jsonMatch = responseText.match(/\[.*\]/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        const tags = JSON.parse(jsonStr);
        
        // Validate and clean tags
        return tags
          .filter((tag: string) => typeof tag === 'string' && tag.trim().length > 0)
          .map((tag: string) => tag.toLowerCase().trim());
      }
      return [];
    } catch (parseError) {
      console.error('Failed to parse tags from LLM response:', parseError);
      console.log('Raw response:', responseText);
      return [];
    }
  } catch (error) {
    console.error('Error suggesting tags:', error);
    return [];
  }
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

      // Auto-suggest tags if none provided for thoughts, reflections, or user messages
      const shouldSuggestTags = 
        (!entry.tags || entry.tags.length === 0) && 
        (entry.kind === 'insight' || 
         entry.kind === 'message' || 
         entry.type === 'thought' ||
         entry.type === 'reflection');
      
      let autoGeneratedTags: string[] = [];
      if (shouldSuggestTags && entry.content) {
        autoGeneratedTags = await suggestTags(entry.content);
        // Mark these tags as auto-generated in metadata
        if (autoGeneratedTags.length > 0) {
          if (!entry.metadata) {
            entry.metadata = {};
          }
          entry.metadata.autoGeneratedTags = true;
          entry.metadata.suggestedTags = autoGeneratedTags;
          
          // Don't add the tags automatically to the tags array
          // Instead, we'll store them in metadata and let the UI handle approval
        }
      }

      // Add required fields if not provided
      const completeEntry: MemoryEntry = {
        id: entry.id || `memory_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        scope: entry.scope || 'shortTerm',
        content: entry.content || '',
        timestamp: entry.timestamp || Date.now(),
        tags: entry.tags || [], // Don't add auto-generated tags yet
        relevance: entry.relevance || 1.0,
        namespace: this.namespace,
        agentId: entry.agentId || this.namespace,
        kind: entry.kind,
        summaryOf: entry.summaryOf,
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
            kind: entry.kind,
            tags: completeEntry.tags,
            relevance: entry.relevance,
            expiresAt: entry.expiresAt,
            sourceAgent: entry.sourceAgent,
            contextId: entry.contextId,
            agentId: entry.agentId || this.namespace,
            summaryOf: entry.summaryOf,
            namespace: this.namespace,
            autoGeneratedTags: autoGeneratedTags.length > 0,
            suggestedTags: autoGeneratedTags.length > 0 ? autoGeneratedTags : undefined,
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
   * Get memory entries by kind
   */
  getByKind(agentId: string, kind: MemoryKind): MemoryEntry[] {
    const namespace = agentId || this.namespace;
    const entries = this.memoryEntries.get(namespace) || [];
    return entries.filter(entry => entry.kind === kind);
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
        
        // Filter by kind if provided
        if (options.kind && entry.kind !== options.kind) {
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
      
      // Add kind filter if provided
      if (options.kind) {
        filter.kind = options.kind;
      }
      
      // Search with filters
      const results = await serverQdrant.searchMemory(null, query, { limit, filter });
      
      // Map to MemoryEntry format
      return results.map(result => ({
        id: result.id || `memory_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        scope: result.metadata?.scope || 'shortTerm',
        kind: result.metadata?.kind,
        content: result.text || '',
        timestamp: result.metadata?.timestamp || Date.now(),
        tags: result.metadata?.tags || [],
        relevance: result.metadata?.relevance || 1.0, // Use metadata.relevance instead of score
        expiresAt: result.metadata?.expiresAt,
        sourceAgent: result.metadata?.sourceAgent,
        contextId: result.metadata?.contextId,
        agentId: result.metadata?.agentId,
        summaryOf: result.metadata?.summaryOf,
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
  
  /**
   * Summarize text content using an LLM
   * This is a placeholder - in a real implementation,
   * this would use an actual LLM to generate a summary
   */
  static async summarizerTool(content: string): Promise<string> {
    // This would be replaced with an actual call to an LLM service
    console.log('Summarizing content:', content.substring(0, 100) + '...');
    
    // Simulating LLM response time
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Simple summarization logic for demo purposes
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length <= 2) return content;
    
    return `Summary of ${lines.length} items: ${lines[0]} and other related points.`;
  }
  
  // Legacy method for backward compatibility
  async addMemory(content: string, metadata: Record<string, any> = {}): Promise<string> {
    const entry = await this.write({
      content,
      scope: metadata.scope || 'shortTerm',
      kind: metadata.kind,
      tags: metadata.tags,
      relevance: metadata.relevance,
      expiresAt: metadata.expiresAt,
      sourceAgent: metadata.sourceAgent,
      contextId: metadata.contextId,
      summaryOf: metadata.summaryOf,
      metadata
    });
    
    return entry.id;
  }
  
  // Legacy method for backward compatibility
  async getContext(query: string, options: { limit?: number } = {}): Promise<string[]> {
    const results = await this.searchMemory(query, options);
    return results.map(result => result.content);
  }

  /**
   * Update tags for a memory entry
   * @param memoryId ID of the memory to update
   * @param tags New tags to set
   */
  async updateTags(memoryId: string, tags: string[]): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      // Update in local memory map
      const entries = this.memoryEntries.get(this.namespace) || [];
      const entryIndex = entries.findIndex(e => e.id === memoryId);
      
      if (entryIndex === -1) {
        console.error(`Memory entry with ID ${memoryId} not found`);
        return false;
      }
      
      // Update the tags
      entries[entryIndex].tags = tags;
      
      // If applicable, mark that auto-generated tags were approved
      if (entries[entryIndex].metadata?.autoGeneratedTags) {
        entries[entryIndex].metadata.tagsApproved = true;
        // Clear the suggestedTags from metadata now that they're approved
        delete entries[entryIndex].metadata.suggestedTags;
      }
      
      // Update the memory store
      this.memoryEntries.set(this.namespace, entries);
      
      // Update in vector store if we're server-side
      if (typeof window === 'undefined') {
        await serverQdrant.updateMemoryTags(memoryId, tags, true);
      }
      
      return true;
    } catch (error) {
      console.error('Error updating memory tags:', error);
      return false;
    }
  }
  
  /**
   * Remove suggested tags from a memory entry
   * @param memoryId ID of the memory to update
   */
  async rejectSuggestedTags(memoryId: string): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      // Update in local memory map
      const entries = this.memoryEntries.get(this.namespace) || [];
      const entryIndex = entries.findIndex(e => e.id === memoryId);
      
      if (entryIndex === -1) {
        console.error(`Memory entry with ID ${memoryId} not found`);
        return false;
      }
      
      // If this entry has auto-generated tags, mark them as rejected
      if (entries[entryIndex].metadata?.autoGeneratedTags) {
        entries[entryIndex].metadata.tagsRejected = true;
        // Remove the auto-generated tags flags
        delete entries[entryIndex].metadata.autoGeneratedTags;
        delete entries[entryIndex].metadata.suggestedTags;
      }
      
      // Update the memory store
      this.memoryEntries.set(this.namespace, entries);
      
      // Update in vector store if we're server-side
      if (typeof window === 'undefined') {
        await serverQdrant.updateMemoryMetadata(memoryId, {
          tagsRejected: true,
          autoGeneratedTags: false,
          suggestedTags: null
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error rejecting suggested tags:', error);
      return false;
    }
  }
} 