/**
 * Memory Transformation Interfaces
 * 
 * This file defines the interfaces for memory transformation operations.
 * Transformations allow memories to be processed, enhanced, restructured,
 * and analyzed in various ways.
 */

/**
 * Types of memory transformations
 */
export enum MemoryTransformationType {
  SUMMARIZATION = 'summarization',
  CATEGORIZATION = 'categorization',
  EXPANSION = 'expansion',
  ABSTRACTION = 'abstraction',
  DECOMPOSITION = 'decomposition',
  INTEGRATION = 'integration',
  EXTRACTION = 'extraction',
  REFINEMENT = 'refinement',
  EMOTION_ANALYSIS = 'emotion_analysis',
  IMPORTANCE_ANALYSIS = 'importance_analysis',
  NOVELTY_ANALYSIS = 'novelty_analysis',
  RELEVANCE_ANALYSIS = 'relevance_analysis',
  CUSTOM = 'custom'
}

/**
 * Transformation quality levels
 */
export enum TransformationQuality {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

/**
 * Base transformation options
 */
export interface BaseTransformationOptions {
  /** Type of transformation to perform */
  transformationType: MemoryTransformationType;
  
  /** Desired quality level for the transformation */
  qualityLevel?: TransformationQuality;
  
  /** Context to consider during transformation */
  context?: string;
  
  /** Maximum length of the transformation result */
  maxLength?: number;
  
  /** Minimum confidence required for transformation */
  minConfidence?: number;
  
  /** Additional parameters specific to the transformation type */
  parameters?: Record<string, unknown>;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Options for summarization transformation
 */
export interface SummarizationOptions extends BaseTransformationOptions {
  transformationType: MemoryTransformationType.SUMMARIZATION;
  
  /** Key points to include in the summary */
  includeKeyPoints?: boolean;
  
  /** Whether to preserve key emotions */
  preserveEmotion?: boolean;
  
  /** Format of the summary */
  format?: 'paragraph' | 'bullet_points' | 'key_value_pairs';
}

/**
 * Options for categorization transformation
 */
export interface CategorizationOptions extends BaseTransformationOptions {
  transformationType: MemoryTransformationType.CATEGORIZATION;
  
  /** Maximum number of categories to assign */
  maxCategories?: number;
  
  /** Custom categories to choose from */
  customCategories?: string[];
  
  /** Whether to include confidence scores */
  includeConfidence?: boolean;
}

/**
 * Options for expansion transformation
 */
export interface ExpansionOptions extends BaseTransformationOptions {
  transformationType: MemoryTransformationType.EXPANSION;
  
  /** Areas to focus on when expanding */
  focusAreas?: string[];
  
  /** How much to expand the memory (multiplier) */
  expansionFactor?: number;
  
  /** Whether to preserve the original structure */
  preserveStructure?: boolean;
}

/**
 * Options for extraction transformation
 */
export interface ExtractionOptions extends BaseTransformationOptions {
  transformationType: MemoryTransformationType.EXTRACTION;
  
  /** Types of elements to extract */
  extractionTargets: Array<
    'entities' | 
    'concepts' | 
    'facts' | 
    'opinions' | 
    'actions' | 
    'decisions' | 
    'questions' | 
    'custom'
  >;
  
  /** Format for the extracted elements */
  format?: 'json' | 'text' | 'structured';
  
  /** Custom extraction patterns */
  customPatterns?: string[];
}

/**
 * Options for integration transformation
 */
export interface IntegrationOptions extends BaseTransformationOptions {
  transformationType: MemoryTransformationType.INTEGRATION;
  
  /** IDs of memories to integrate */
  memoryIds: string[];
  
  /** How to resolve conflicts between memories */
  conflictResolution?: 'newest' | 'highest_confidence' | 'most_detailed' | 'synthesize';
}

/**
 * Result of a memory transformation
 */
export interface TransformationResult<T = unknown> {
  /** ID of the transformation */
  id: string;
  
  /** ID of the original memory */
  originalMemoryId: string;
  
  /** Type of transformation performed */
  transformationType: MemoryTransformationType;
  
  /** Transformed content */
  content: string;
  
  /** Structured data result (type depends on transformation) */
  structuredResult?: T;
  
  /** Confidence in the transformation */
  confidence: number;
  
  /** When the transformation was created */
  createdAt: Date;
  
  /** How long the transformation took in milliseconds */
  processingTimeMs: number;
  
  /** Whether the transformation was successful */
  success: boolean;
  
  /** Error message if transformation failed */
  errorMessage?: string;
  
  /** Options used for the transformation */
  options: BaseTransformationOptions;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Interface for memory transformation system
 */
export interface MemoryTransformationSystem {
  /**
   * Transform a memory
   * 
   * @param memoryId ID of the memory to transform
   * @param options Transformation options
   * @returns Promise resolving to transformation result
   */
  transformMemory<T = unknown>(
    memoryId: string,
    options: BaseTransformationOptions
  ): Promise<TransformationResult<T>>;
  
  /**
   * Transform a memory using summarization
   * 
   * @param memoryId ID of the memory to transform
   * @param options Summarization options
   * @returns Promise resolving to transformation result
   */
  summarizeMemory(
    memoryId: string,
    options?: Partial<SummarizationOptions>
  ): Promise<TransformationResult<string>>;
  
  /**
   * Transform a memory using categorization
   * 
   * @param memoryId ID of the memory to transform
   * @param options Categorization options
   * @returns Promise resolving to transformation result
   */
  categorizeMemory(
    memoryId: string,
    options?: Partial<CategorizationOptions>
  ): Promise<TransformationResult<string[]>>;
  
  /**
   * Transform a memory using expansion
   * 
   * @param memoryId ID of the memory to transform
   * @param options Expansion options
   * @returns Promise resolving to transformation result
   */
  expandMemory(
    memoryId: string,
    options?: Partial<ExpansionOptions>
  ): Promise<TransformationResult<string>>;
  
  /**
   * Extract elements from a memory
   * 
   * @param memoryId ID of the memory to transform
   * @param options Extraction options
   * @returns Promise resolving to transformation result
   */
  extractFromMemory<T = Record<string, unknown>>(
    memoryId: string,
    options: Partial<ExtractionOptions>
  ): Promise<TransformationResult<T>>;
  
  /**
   * Integrate multiple memories
   * 
   * @param options Integration options
   * @returns Promise resolving to transformation result
   */
  integrateMemories(
    options: IntegrationOptions
  ): Promise<TransformationResult<string>>;
  
  /**
   * Apply a transformation to multiple memories
   * 
   * @param memoryIds IDs of memories to transform
   * @param options Transformation options
   * @returns Promise resolving to transformation results
   */
  batchTransformMemories<T = unknown>(
    memoryIds: string[],
    options: BaseTransformationOptions
  ): Promise<TransformationResult<T>[]>;
  
  /**
   * Get transformation history for a memory
   * 
   * @param memoryId ID of the memory to get transformations for
   * @returns Promise resolving to transformation results
   */
  getTransformationHistory(
    memoryId: string
  ): Promise<TransformationResult[]>;
} 