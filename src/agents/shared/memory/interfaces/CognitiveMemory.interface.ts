/**
 * Cognitive Memory Interface
 * 
 * This file defines interfaces for advanced cognitive memory capabilities
 * that extend the standard memory system with more sophisticated operations
 * such as memory association, synthesis, and reasoning.
 */

/**
 * Types of cognitive memory patterns
 */
export enum CognitivePatternType {
  TEMPORAL = 'temporal',
  CAUSAL = 'causal',
  CORRELATIONAL = 'correlational',
  CONCEPTUAL = 'conceptual',
  PROCEDURAL = 'procedural',
  ANALOGICAL = 'analogical',
  CONTRASTIVE = 'contrastive',
  HIERARCHICAL = 'hierarchical'
}

/**
 * Types of cognitive memory reasoning
 */
export enum CognitiveReasoningType {
  INDUCTIVE = 'inductive',
  DEDUCTIVE = 'deductive',
  ABDUCTIVE = 'abductive',
  ANALOGICAL = 'analogical',
  COUNTERFACTUAL = 'counterfactual',
  CAUSAL = 'causal',
  PROBABILISTIC = 'probabilistic'
}

/**
 * Cognitive memory association strength
 */
export enum AssociationStrength {
  WEAK = 'weak',
  MODERATE = 'moderate',
  STRONG = 'strong',
  VERY_STRONG = 'very_strong'
}

/**
 * Cognitive memory association
 */
export interface MemoryAssociation {
  /** Unique identifier for this association */
  id: string;
  
  /** Source memory ID */
  sourceMemoryId: string;
  
  /** Target memory ID */
  targetMemoryId: string;
  
  /** Type of association */
  associationType: CognitivePatternType;
  
  /** Strength of the association */
  strength: AssociationStrength;
  
  /** Description of the association */
  description: string;
  
  /** When this association was created */
  createdAt: Date;
  
  /** Score or confidence of this association */
  score: number;
  
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Memory synthesis result
 */
export interface MemorySynthesis {
  /** Unique identifier for this synthesis */
  id: string;
  
  /** IDs of source memories that were synthesized */
  sourceMemoryIds: string[];
  
  /** Result of the synthesis */
  content: string;
  
  /** Type of pattern identified */
  patternType: CognitivePatternType;
  
  /** Confidence in the synthesis */
  confidence: number;
  
  /** When this synthesis was created */
  createdAt: Date;
  
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Memory reasoning result
 */
export interface MemoryReasoning {
  /** Unique identifier for this reasoning */
  id: string;
  
  /** IDs of memories used in this reasoning */
  memoryIds: string[];
  
  /** The reasoning prompt or question */
  prompt: string;
  
  /** The reasoning result */
  result: string;
  
  /** Type of reasoning performed */
  reasoningType: CognitiveReasoningType;
  
  /** Confidence in the reasoning result */
  confidence: number;
  
  /** When this reasoning was performed */
  createdAt: Date;
  
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Options for finding memory associations
 */
export interface FindAssociationsOptions {
  /** Type of association to find */
  associationType?: CognitivePatternType;
  
  /** Minimum association strength */
  minStrength?: AssociationStrength;
  
  /** Minimum confidence score */
  minScore?: number;
  
  /** Maximum number of associations to return */
  limit?: number;
  
  /** Only include associations created after this time */
  createdAfter?: Date;
  
  /** Additional metadata filters */
  metadata?: Record<string, unknown>;
}

/**
 * Options for memory synthesis
 */
export interface MemorySynthesisOptions {
  /** IDs of memories to synthesize */
  memoryIds: string[];
  
  /** Type of pattern to look for */
  patternType?: CognitivePatternType;
  
  /** Minimum confidence threshold */
  minConfidence?: number;
  
  /** Maximum length of synthesis result */
  maxLength?: number;
  
  /** Additional context for synthesis */
  context?: string;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Options for memory reasoning
 */
export interface MemoryReasoningOptions {
  /** IDs of memories to reason about */
  memoryIds: string[];
  
  /** Type of reasoning to perform */
  reasoningType: CognitiveReasoningType;
  
  /** The reasoning prompt or question */
  prompt: string;
  
  /** Maximum length of reasoning result */
  maxLength?: number;
  
  /** Minimum confidence threshold */
  minConfidence?: number;
  
  /** Additional context for reasoning */
  context?: string;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Cognitive memory capability interface
 */
export interface CognitiveMemory {
  /**
   * Create an association between two memories
   * 
   * @param sourceMemoryId ID of the source memory
   * @param targetMemoryId ID of the target memory
   * @param associationType Type of association
   * @param description Description of the association
   * @param options Additional options
   * @returns Promise resolving to the created association
   */
  createAssociation(
    sourceMemoryId: string,
    targetMemoryId: string,
    associationType: CognitivePatternType,
    description: string,
    options?: {
      strength?: AssociationStrength;
      score?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<MemoryAssociation>;
  
  /**
   * Find associations for a memory
   * 
   * @param memoryId ID of the memory to find associations for
   * @param options Search options
   * @returns Promise resolving to matching associations
   */
  findAssociations(
    memoryId: string,
    options?: FindAssociationsOptions
  ): Promise<MemoryAssociation[]>;
  
  /**
   * Discover associations between memories automatically
   * 
   * @param memoryIds IDs of memories to analyze
   * @param options Discovery options
   * @returns Promise resolving to discovered associations
   */
  discoverAssociations(
    memoryIds: string[],
    options?: {
      patternTypes?: CognitivePatternType[];
      minScore?: number;
      maxResults?: number;
    }
  ): Promise<MemoryAssociation[]>;
  
  /**
   * Synthesize patterns from multiple memories
   * 
   * @param options Synthesis options
   * @returns Promise resolving to synthesis result
   */
  synthesizeMemories(
    options: MemorySynthesisOptions
  ): Promise<MemorySynthesis>;
  
  /**
   * Perform reasoning across multiple memories
   * 
   * @param options Reasoning options
   * @returns Promise resolving to reasoning result
   */
  reasonAcrossMemories(
    options: MemoryReasoningOptions
  ): Promise<MemoryReasoning>;
  
  /**
   * Find similar memory patterns
   * 
   * @param patternType Type of pattern to find
   * @param options Search options
   * @returns Promise resolving to sets of memories with similar patterns
   */
  findSimilarPatterns(
    patternType: CognitivePatternType,
    options?: {
      minMemories?: number;
      maxMemories?: number;
      minConfidence?: number;
      limit?: number;
    }
  ): Promise<MemorySynthesis[]>;
  
  /**
   * Extract insights from memories
   * 
   * @param memoryIds IDs of memories to analyze
   * @param options Insight extraction options
   * @returns Promise resolving to extracted insights
   */
  extractInsights(
    memoryIds: string[],
    options?: {
      maxInsights?: number;
      minConfidence?: number;
      context?: string;
    }
  ): Promise<string[]>;
} 