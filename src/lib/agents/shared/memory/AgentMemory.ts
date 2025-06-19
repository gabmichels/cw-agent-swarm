/**
 * AgentMemory.ts - Core memory interface for agents
 * 
 * This file defines the core memory interface that all agent memory implementations
 * must follow. It provides a type-safe contract for memory operations.
 */

import { MemoryType, ImportanceLevel, MemorySource } from '@/server/memory/config/types';
import { 
  MemoryEntry, 
  MemorySearchOptions, 
  MemoryStats,
  MemoryDecayConfig,
  MemoryDecayStats,
  MemoryDecayResult,
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeNodeType,
  KnowledgeEdgeType,
  KnowledgeGraphManager,
  SearchResult,
  MemoryError,
  BaseMemorySchema
} from './types';
import { handleError } from '../../../errors/errorHandler';

/**
 * Core memory interface for agents
 */
export interface AgentMemory {
  /**
   * Initialize the memory system
   */
  initialize(): Promise<boolean>;
  
  /**
   * Add a new memory
   */
  addMemory(
    content: string,
    type: MemoryType,
    importance: ImportanceLevel,
    source: MemorySource,
    metadata?: Record<string, unknown>
  ): Promise<MemoryEntry>;
  
  /**
   * Search for memories
   */
  search(
    query: string,
    options?: MemorySearchOptions
  ): Promise<MemoryEntry[]>;
  
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
   * Configure memory decay settings
   */
  configureDecay(config: MemoryDecayConfig): Promise<void>;

  /**
   * Calculate decay for a specific memory
   */
  calculateMemoryDecay(memoryId: string): Promise<MemoryDecayResult>;

  /**
   * Apply decay to all memories
   */
  applyMemoryDecay(): Promise<MemoryDecayStats>;

  /**
   * Mark a memory as critical to prevent decay
   */
  markMemoryAsCritical(
    memoryId: string,
    reason: string
  ): Promise<void>;

  /**
   * Get decay statistics
   */
  getDecayStats(): Promise<MemoryDecayStats>;

  /**
   * Get the knowledge graph manager
   */
  getKnowledgeGraph(): KnowledgeGraphManager;

  /**
   * Add a memory entry to the knowledge graph
   */
  addMemoryToGraph(memory: MemoryEntry): Promise<void>;

  /**
   * Find memories related to a specific memory using the knowledge graph
   */
  findRelatedMemories(memoryId: string, limit?: number): Promise<MemoryEntry[]>;

  /**
   * Get insights about a memory from the knowledge graph
   */
  getMemoryInsights(memoryId: string): Promise<{
    relatedConcepts: KnowledgeNode[];
    connections: KnowledgeEdge[];
    insights: string[];
  }>;

  /**
   * Update relationships in the knowledge graph for a memory
   */
  updateMemoryRelationships(memoryId: string, relatedMemoryIds: string[]): Promise<void>;

  /**
   * Get statistics about the knowledge graph
   */
  getKnowledgeGraphStats(): Promise<{
    totalNodes: number;
    totalEdges: number;
    nodeTypes: Record<KnowledgeNodeType, number>;
    edgeTypes: Record<KnowledgeEdgeType, number>;
  }>;
} 