import { MemoryType, ImportanceLevel } from '../../../constants/memory';
import { MemoryEntry, MemorySearchOptions, MemoryStats } from '../../../lib/shared/types/agentTypes';
import { KnowledgeGraphManager } from '../../implementations/memory/KnowledgeGraphManager';

/**
 * Interface for agent memory management
 */
export interface AgentMemory {
  /**
   * Initialize the memory system
   */
  initialize(): Promise<boolean>;

  /**
   * Add a new memory entry
   */
  addMemory(
    content: string,
    type: MemoryType,
    importance: ImportanceLevel,
    source: string,
    metadata?: Record<string, unknown>
  ): Promise<MemoryEntry>;

  /**
   * Search for memories
   */
  search(query: string, options?: MemorySearchOptions): Promise<MemoryEntry[]>;

  /**
   * Get recently modified memories
   */
  getRecentlyModifiedMemories(limit?: number): Promise<MemoryEntry[]>;

  /**
   * Get memory statistics
   */
  getStats(): Promise<MemoryStats>;

  /**
   * Clear all memories
   */
  clear(): Promise<void>;

  /**
   * Shutdown the memory system
   */
  shutdown(): Promise<void>;

  /**
   * Get the knowledge graph manager
   */
  getKnowledgeGraph(): KnowledgeGraphManager;

  /**
   * Add a memory to the knowledge graph
   */
  addMemoryToGraph(memory: MemoryEntry): Promise<void>;

  /**
   * Find related memories
   */
  findRelatedMemories(memoryId: string, limit?: number): Promise<MemoryEntry[]>;
} 