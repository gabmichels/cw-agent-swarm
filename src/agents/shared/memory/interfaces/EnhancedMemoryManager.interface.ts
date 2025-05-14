/**
 * Enhanced Memory Manager Interface
 * 
 * This file defines an enhanced memory manager interface that extends
 * the base MemoryManager with cognitive memory capabilities.
 */

import { MemoryManager, MemoryEntry, MemoryManagerConfig } from '../../../../lib/agents/base/managers/MemoryManager';
import { CognitiveMemory, CognitivePatternType, CognitiveReasoningType, MemoryAssociation, MemorySynthesis, MemoryReasoning, FindAssociationsOptions, MemorySynthesisOptions, MemoryReasoningOptions } from './CognitiveMemory.interface';
import { ConversationSummarizer, ConversationSummaryOptions, ConversationSummaryResult } from './ConversationSummarization.interface';
import { MemoryVersion, MemoryChangeType, MemoryDiff, RollbackOptions, RollbackResult, BatchHistoryOptions, BatchHistoryResult } from './MemoryVersionHistory.interface';

/**
 * Enhanced memory manager configuration
 */
export interface EnhancedMemoryManagerConfig extends MemoryManagerConfig {
  /** Whether to enable cognitive memory capabilities */
  enableCognitiveMemory?: boolean;
  
  /** Whether to enable conversation summarization */
  enableConversationSummarization?: boolean;
  
  /** Maximum number of associations per memory */
  maxAssociationsPerMemory?: number;
  
  /** Whether to automatically discover associations */
  enableAutoAssociationDiscovery?: boolean;
  
  /** Minimum confidence score for automatic association discovery */
  autoAssociationMinScore?: number;
  
  /** Pattern types to use for automatic association discovery */
  autoAssociationPatternTypes?: CognitivePatternType[];
  
  /** Interval for automatic association discovery in milliseconds */
  autoAssociationIntervalMs?: number;
  
  /** Whether to enable memory version history */
  enableVersionHistory?: boolean;
  
  /** Maximum number of versions to keep per memory (0 = unlimited) */
  maxVersionsPerMemory?: number;
  
  /** Whether to create versions automatically on memory updates */
  autoCreateVersions?: boolean;
}

/**
 * Memory transformation options
 */
export interface MemoryTransformationOptions {
  /** Type of transformation to apply */
  transformationType: 'generalize' | 'specify' | 'reframe' | 'connect' | 'simplify';
  
  /** Maximum length of transformed content */
  maxLength?: number;
  
  /** Additional context for transformation */
  context?: string;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Enhanced memory entry with cognitive capabilities
 */
export interface EnhancedMemoryEntry extends MemoryEntry {
  /** Associated memories */
  associations?: MemoryAssociation[];
  
  /** Memory importance (0-1) */
  importance?: number;
  
  /** Memory novelty (0-1) */
  novelty?: number;
  
  /** Memory emotional valence (-1 to 1) */
  emotionalValence?: number;
  
  /** Memory categories/tags */
  categories?: string[];
  
  /** Whether this memory has been processed cognitively */
  cognitivelyProcessed?: boolean;
  
  /** When this memory was last cognitively processed */
  lastCognitiveProcessingTime?: Date;
  
  /** Version history information */
  versions?: {
    /** Current version ID */
    currentVersionId?: string;
    
    /** Number of available versions */
    versionCount?: number;
    
    /** When this memory was last versioned */
    lastVersionedAt?: Date;
  };
}

/**
 * Enhanced memory manager interface
 * 
 * Extends the base MemoryManager with cognitive memory capabilities and
 * conversation summarization.
 */
export interface EnhancedMemoryManager extends MemoryManager, CognitiveMemory, ConversationSummarizer {
  /**
   * Get enhanced memory entry
   * 
   * @param memoryId ID of the memory to retrieve
   * @returns Promise resolving to the enhanced memory entry
   */
  getEnhancedMemory(memoryId: string): Promise<EnhancedMemoryEntry | null>;
  
  /**
   * Transform a memory
   * 
   * @param memoryId ID of the memory to transform
   * @param options Transformation options
   * @returns Promise resolving to the transformed memory
   */
  transformMemory(memoryId: string, options: MemoryTransformationOptions): Promise<EnhancedMemoryEntry>;
  
  /**
   * Rate memory importance
   * 
   * @param memoryId ID of the memory to rate
   * @returns Promise resolving to the importance score (0-1)
   */
  rateMemoryImportance(memoryId: string): Promise<number>;
  
  /**
   * Rate memory novelty
   * 
   * @param memoryId ID of the memory to rate
   * @returns Promise resolving to the novelty score (0-1)
   */
  rateMemoryNovelty(memoryId: string): Promise<number>;
  
  /**
   * Analyze memory emotional content
   * 
   * @param memoryId ID of the memory to analyze
   * @returns Promise resolving to the emotional valence (-1 to 1)
   */
  analyzeMemoryEmotion(memoryId: string): Promise<number>;
  
  /**
   * Categorize memory
   * 
   * @param memoryId ID of the memory to categorize
   * @param options Categorization options
   * @returns Promise resolving to assigned categories
   */
  categorizeMemory(
    memoryId: string,
    options?: {
      maxCategories?: number;
      customCategories?: string[];
      minConfidence?: number;
    }
  ): Promise<string[]>;
  
  /**
   * Generate complete memory context
   * 
   * @param memoryId ID of the main memory
   * @param options Context generation options
   * @returns Promise resolving to the complete memory context
   */
  generateMemoryContext(
    memoryId: string,
    options?: {
      maxAssociatedMemories?: number;
      maxDepth?: number;
      includeReasoningPatterns?: boolean;
      includeSynthesis?: boolean;
    }
  ): Promise<{
    mainMemory: EnhancedMemoryEntry;
    associatedMemories: EnhancedMemoryEntry[];
    synthesis?: MemorySynthesis;
    reasoning?: MemoryReasoning;
  }>;
  
  /**
   * Process memory cognitively
   * 
   * @param memoryId ID of the memory to process
   * @param options Processing options
   * @returns Promise resolving when processing is complete
   */
  processMemoryCognitively(
    memoryId: string,
    options?: {
      processingTypes?: Array<'associations' | 'importance' | 'novelty' | 'emotion' | 'categorization'>;
      forceReprocess?: boolean;
    }
  ): Promise<EnhancedMemoryEntry>;
  
  /**
   * Batch process memories cognitively
   * 
   * @param memoryIds IDs of memories to process
   * @param options Processing options
   * @returns Promise resolving when processing is complete
   */
  batchProcessMemoriesCognitively(
    memoryIds: string[],
    options?: {
      processingTypes?: Array<'associations' | 'importance' | 'novelty' | 'emotion' | 'categorization'>;
      forceReprocess?: boolean;
      maxConcurrent?: number;
    }
  ): Promise<EnhancedMemoryEntry[]>;
  
  /**
   * Create a new version of a memory
   * 
   * @param memoryId ID of the memory
   * @param content Current content of the memory
   * @param changeType Type of change
   * @param metadata Additional metadata
   * @returns Promise resolving to the created version
   */
  createMemoryVersion(
    memoryId: string,
    content: string,
    changeType: MemoryChangeType,
    metadata?: Record<string, unknown>
  ): Promise<MemoryVersion>;
  
  /**
   * Get all versions of a memory
   * 
   * @param memoryId ID of the memory
   * @param options Query options
   * @returns Promise resolving to memory versions
   */
  getMemoryVersions(
    memoryId: string,
    options?: {
      limit?: number;
      offset?: number;
      sortDirection?: 'asc' | 'desc';
    }
  ): Promise<MemoryVersion[]>;
  
  /**
   * Get a specific version of a memory
   * 
   * @param memoryId ID of the memory
   * @param versionId ID of the version
   * @returns Promise resolving to the memory version
   */
  getMemoryVersion(
    memoryId: string,
    versionId: string
  ): Promise<MemoryVersion | null>;
  
  /**
   * Roll back a memory to a previous version
   * 
   * @param memoryId ID of the memory to roll back
   * @param options Rollback options
   * @returns Promise resolving to rollback result
   */
  rollbackMemoryToVersion(
    memoryId: string,
    options: RollbackOptions
  ): Promise<RollbackResult>;
  
  /**
   * Compare two versions of a memory
   * 
   * @param memoryId ID of the memory
   * @param firstVersionId ID of the first version
   * @param secondVersionId ID of the second version
   * @returns Promise resolving to the difference between versions
   */
  compareMemoryVersions(
    memoryId: string,
    firstVersionId: string,
    secondVersionId: string
  ): Promise<MemoryDiff>;
  
  /**
   * Perform batch operations on memory history
   * 
   * @param operation Operation to perform ('rollback', 'delete', etc.)
   * @param options Batch operation options
   * @returns Promise resolving to batch operation result
   */
  batchMemoryHistoryOperation(
    operation: string,
    options: BatchHistoryOptions
  ): Promise<BatchHistoryResult>;
} 