/**
 * Enhanced Memory Manager Interface
 * 
 * This file defines an enhanced memory manager interface that extends
 * the base MemoryManager with cognitive memory capabilities.
 */

import { MemoryManager, MemoryEntry, MemoryManagerConfig } from '../../../../lib/agents/base/managers/MemoryManager';
import { CognitiveMemory, CognitivePatternType, CognitiveReasoningType, MemoryAssociation, MemorySynthesis, MemoryReasoning, FindAssociationsOptions, MemorySynthesisOptions, MemoryReasoningOptions } from './CognitiveMemory.interface';
import { ConversationSummarizer, ConversationSummaryOptions, ConversationSummaryResult } from './ConversationSummarization.interface';

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
} 