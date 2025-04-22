import fs from 'fs';
import path from 'path';
import { AgentMemory, LanceDBMemory } from '../../lib/memory';

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
  dataDir?: string;
  memoryFile?: string;
  useExternalMemory?: boolean;
  externalMemory?: AgentMemory;
  useOpenAI?: boolean;
}

/**
 * Class to manage Chloe's memories with tagging and importance levels
 */
export class ChloeMemory {
  private memories: Map<string, MemoryEntry> = new Map();
  private agentId: string;
  private dataDir: string;
  private memoryFile: string;
  private useExternalMemory: boolean;
  private externalMemory?: AgentMemory;
  private lanceMemory: LanceDBMemory;
  private initialized: boolean = false;
  private legacyMode: boolean = false;

  constructor(options?: ChloeMemoryOptions) {
    this.agentId = options?.agentId || 'chloe';
    this.dataDir = options?.dataDir || path.join(process.cwd(), 'data', 'memory');
    this.memoryFile = options?.memoryFile || path.join(this.dataDir, 'memories.json');
    this.useExternalMemory = options?.useExternalMemory || false;
    this.externalMemory = options?.externalMemory;
    this.legacyMode = process.env.USE_LEGACY_MEMORY === 'true';
    
    // Initialize LanceDB memory for vector storage
    this.lanceMemory = new LanceDBMemory({
      dataDirectory: process.env.LANCEDB_DATA_DIR || path.join(process.cwd(), 'data', 'lance'),
      useOpenAI: options?.useOpenAI || process.env.USE_OPENAI_EMBEDDINGS === 'true'
    });
    
    console.log('ChloeMemory initialized with LanceDB backend');
  }

  /**
   * Initialize memory system
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('Initializing Chloe memory system...');
      
      // Initialize LanceDB memory
      await this.lanceMemory.initialize();
      
      // For backward compatibility, still handle JSON files if in legacy mode
      if (this.legacyMode) {
        // Create directory if it doesn't exist
        await this.ensureDirectoryExists(this.dataDir);
        
        // Load existing memories from file if it exists
        if (fs.existsSync(this.memoryFile)) {
          const memoryData = fs.readFileSync(this.memoryFile, 'utf-8');
          const parsedMemories = JSON.parse(memoryData);
          
          // Convert data to Memory objects and restore dates
          parsedMemories.forEach((memory: any) => {
            memory.created = new Date(memory.created);
            if (memory.expiresAt) memory.expiresAt = new Date(memory.expiresAt);
            this.memories.set(memory.id, memory);
          });
          
          console.log(`Loaded ${this.memories.size} memories from legacy storage`);
          
          // Migrate legacy memories to LanceDB
          console.log('Migrating legacy memories to LanceDB...');
          // Convert Map.values() to Array before iterating to avoid TypeScript iterator issues
          const memoryArray = Array.from(this.memories.values());
          for (const memory of memoryArray) {
            // Store as thought in LanceDB
            await this.lanceMemory.storeThought({
              text: memory.content,
              tag: memory.category,
              importance: memory.importance,
              source: memory.source
            });
          }
          console.log('Legacy memory migration complete');
        }
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
    
    // Add to LanceDB
    await this.lanceMemory.storeThought({
      text: content,
      tag: category,
      importance: importance,
      source: source
    });
    
    // For backwards compatibility, still update the Map and JSON file in legacy mode
    if (this.legacyMode) {
      this.memories.set(memoryId, newMemory);
      await this.saveMemories();
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
   * Get high-importance memories - now uses LanceDB
   */
  async getHighImportanceMemories(limit: number = 20): Promise<MemoryEntry[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const thoughts = await this.lanceMemory.getImportantThoughts('high', limit);
    
    // Convert from ThoughtRecord to MemoryEntry
    return thoughts.map(thought => ({
      id: thought.id,
      content: thought.text,
      created: new Date(thought.timestamp),
      category: thought.metadata.tag,
      importance: thought.metadata.importance as 'low' | 'medium' | 'high',
      source: thought.metadata.source as 'user' | 'chloe' | 'system',
      tags: []
    }));
  }

  /**
   * Get relevant memories for a query, using LanceDB
   */
  async getRelevantMemories(query: string, limit: number = 5): Promise<string[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Use LanceDB memory for semantic retrieval
    const results = await this.lanceMemory.searchMemory({
      query,
      limit
    });
    
    // If no results from LanceDB, try external memory if available
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
      if (result.type === 'thought') {
        const importance = result.metadata.importance;
        const importanceMarker = importance === 'high' ? '[IMPORTANT] ' : '';
        return `${importanceMarker}${result.metadata.tag}: ${result.text} (${new Date(result.timestamp).toISOString()})`;
      } else {
        return `${result.type}: ${result.text}`;
      }
    });
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`Created directory: ${dirPath}`);
    }
  }

  /**
   * Save memories to file - only used in legacy mode
   */
  private async saveMemories(): Promise<void> {
    if (!this.legacyMode) return;
    
    try {
      // Convert Map to array for JSON serialization
      const memoriesArray = Array.from(this.memories.values());
      fs.writeFileSync(this.memoryFile, JSON.stringify(memoriesArray, null, 2));
    } catch (error) {
      console.error('Error saving memories:', error);
    }
  }
} 