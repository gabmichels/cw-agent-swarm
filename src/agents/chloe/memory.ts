import fs from 'fs';
import path from 'path';
import { AgentMemory } from '../../lib/memory';

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
  private initialized: boolean = false;

  constructor(options?: ChloeMemoryOptions) {
    this.agentId = options?.agentId || 'chloe';
    this.dataDir = options?.dataDir || path.join(process.cwd(), 'data', 'memory');
    this.memoryFile = options?.memoryFile || path.join(this.dataDir, 'memories.json');
    this.useExternalMemory = options?.useExternalMemory || false;
    this.externalMemory = options?.externalMemory;
  }

  /**
   * Initialize memory system
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('Initializing Chloe memory system...');
      
      // Create directory if it doesn't exist
      await this.ensureDirectoryExists(this.dataDir);
      
      // Initialize external memory if needed
      if (this.useExternalMemory && this.externalMemory) {
        await this.externalMemory.initialize();
      }
      
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
        
        console.log(`Loaded ${this.memories.size} memories`);
      } else {
        // Create empty memory file
        await this.saveMemories();
        console.log('Created new memory file');
      }
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing memory system:', error);
      return false;
    }
  }

  /**
   * Save memories to file
   */
  private async saveMemories(): Promise<void> {
    try {
      // Convert Map to array for JSON serialization
      const memoriesArray = Array.from(this.memories.values());
      fs.writeFileSync(this.memoryFile, JSON.stringify(memoriesArray, null, 2));
    } catch (error) {
      console.error('Error saving memories:', error);
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
    
    // Add to local memory
    this.memories.set(memoryId, newMemory);
    await this.saveMemories();
    
    // Add to external memory if enabled
    if (this.useExternalMemory && this.externalMemory) {
      const memoryText = this.formatMemoryForExternal(newMemory);
      await this.externalMemory.addMemory(memoryText);
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
   * Get high-importance memories
   */
  getHighImportanceMemories(): MemoryEntry[] {
    return Array.from(this.memories.values()).filter(memory => memory.importance === 'high');
  }

  /**
   * Get memories by category
   */
  getMemoriesByCategory(category: string): MemoryEntry[] {
    return Array.from(this.memories.values()).filter(memory => memory.category === category);
  }

  /**
   * Get memories by source
   */
  getMemoriesBySource(source: 'user' | 'chloe' | 'system'): MemoryEntry[] {
    return Array.from(this.memories.values()).filter(memory => memory.source === source);
  }

  /**
   * Get memories by tag
   */
  getMemoriesByTag(tag: string): MemoryEntry[] {
    return Array.from(this.memories.values()).filter(
      memory => memory.tags?.includes(tag)
    );
  }

  /**
   * Get recent memories, up to specified limit
   */
  getRecentMemories(limit: number = 10): MemoryEntry[] {
    return Array.from(this.memories.values())
      .sort((a, b) => b.created.getTime() - a.created.getTime())
      .slice(0, limit);
  }

  /**
   * Get relevant memories for a query, using external memory if available
   */
  async getRelevantMemories(query: string, limit: number = 5): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // If external memory is enabled, use it
    if (this.useExternalMemory && this.externalMemory) {
      try {
        const result = await this.externalMemory.getContext(query);
        if (result !== null) {
          return result;
        }
        // If null is returned, fall back to local memory
      } catch (error) {
        console.error('Error retrieving context from external memory:', error);
        // Fall back to local memory if external fails
      }
    }
    
    // Simple fallback implementation using local memory
    // In a real implementation, this could use more sophisticated matching
    const allMemories = Array.from(this.memories.values());
    
    // Prioritize high-importance memories
    const highImportanceMemories = allMemories.filter(memory => memory.importance === 'high');
    
    // Find memories that might be related to the query (very basic implementation)
    const queryWords = query.toLowerCase().split(/\s+/);
    
    const relevantMemories = allMemories.filter(memory => {
      const content = memory.content.toLowerCase();
      return queryWords.some(word => content.includes(word));
    });
    
    // Combine high importance and relevant memories, prioritizing high importance
    const combinedMemories = [...highImportanceMemories, ...relevantMemories]
      // Remove duplicates
      .filter((memory, index, self) => 
        index === self.findIndex(m => m.id === memory.id)
      )
      // Sort by creation date (newest first)
      .sort((a, b) => b.created.getTime() - a.created.getTime())
      .slice(0, limit);
    
    // Format the memories as a string
    if (combinedMemories.length === 0) {
      return "No relevant memories found.";
    }
    
    return combinedMemories.map(memory => {
      const importanceMarker = memory.importance === 'high' ? '[IMPORTANT] ' : '';
      return `${importanceMarker}${memory.category}: ${memory.content} (${memory.created.toISOString()})`;
    }).join('\n\n');
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
} 