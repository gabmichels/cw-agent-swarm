/**
 * Knowledge Gap Identification Interface
 * 
 * This file defines interfaces for knowledge gap identification, prioritization, and management,
 * enabling agents to systematically identify, track, and address gaps in their knowledge.
 */

import { ImportanceLevel } from '../../../../constants/memory';

/**
 * Knowledge gap detection confidence level
 */
export enum KnowledgeGapConfidenceLevel {
  LOW = 'low',           // Possibly a gap, but not certain
  MODERATE = 'moderate', // Likely a gap with reasonable confidence
  HIGH = 'high',         // Very confident this is a knowledge gap
  CERTAIN = 'certain'    // Definitely a knowledge gap
}

/**
 * Knowledge gap status
 */
export enum KnowledgeGapStatus {
  NEW = 'new',                  // Newly identified gap
  INVESTIGATING = 'investigating', // Currently being investigated
  IN_PROGRESS = 'in_progress',  // Gap is being addressed
  ADDRESSED = 'addressed',      // Gap has been filled
  DISMISSED = 'dismissed',      // Gap was determined to be invalid or unnecessary
  DEFERRED = 'deferred'         // Gap acknowledged but postponed
}

/**
 * Knowledge gap category
 */
export enum KnowledgeGapCategory {
  DOMAIN_KNOWLEDGE = 'domain_knowledge',  // Subject matter expertise
  TECHNICAL_SKILL = 'technical_skill',    // Technical abilities
  PROCESS_KNOWLEDGE = 'process_knowledge', // Understanding of processes
  CONTEXTUAL_KNOWLEDGE = 'contextual_knowledge', // Awareness of context
  STRATEGIC_KNOWLEDGE = 'strategic_knowledge', // Strategic understanding
  FACTUAL_KNOWLEDGE = 'factual_knowledge', // Specific facts
  CONCEPTUAL_KNOWLEDGE = 'conceptual_knowledge', // Understanding of concepts
  CUSTOM = 'custom'                        // Custom category
}

/**
 * Source of knowledge gap identification
 */
export enum KnowledgeGapSource {
  CONVERSATION = 'conversation',     // Identified during conversation
  TASK_EXECUTION = 'task_execution', // Identified during task execution
  REFLECTION = 'reflection',         // Identified during self-reflection
  EXPLICIT_FEEDBACK = 'explicit_feedback', // Explicitly pointed out
  ANALYSIS = 'analysis',             // Identified during analysis
  MONITORING = 'monitoring'          // Identified through monitoring
}

/**
 * Knowledge gap interface
 */
export interface KnowledgeGap {
  /** Unique identifier for this knowledge gap */
  id: string;
  
  /** Topic or subject of the gap */
  topic: string;
  
  /** Detailed description of the knowledge gap */
  description: string;
  
  /** Confidence that this is a real knowledge gap */
  confidence: number;
  
  /** Confidence level classification */
  confidenceLevel: KnowledgeGapConfidenceLevel;
  
  /** Importance of filling this gap (1-10) */
  importance: number;
  
  /** Importance level classification */
  importanceLevel: ImportanceLevel;
  
  /** Current status of this knowledge gap */
  status: KnowledgeGapStatus;
  
  /** Category of this knowledge gap */
  category: KnowledgeGapCategory | string;
  
  /** Source of this knowledge gap identification */
  source: KnowledgeGapSource;
  
  /** How many times this gap has been detected */
  frequency: number;
  
  /** Suggested actions to fill this gap */
  suggestedActions: string[];
  
  /** Related queries that could help research this topic */
  relatedQueries: string[];
  
  /** Creation timestamp */
  createdAt: Date;
  
  /** Last updated timestamp */
  updatedAt: Date;
  
  /** Related knowledge node IDs (if available) */
  relatedNodeIds?: string[];
  
  /** Additional properties */
  properties?: Record<string, string | number | boolean | null>;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Learning priority interface for knowledge gaps
 */
export interface LearningPriority {
  /** Unique identifier for this learning priority */
  id: string;
  
  /** Associated knowledge gap ID */
  knowledgeGapId: string;
  
  /** Priority score (0-10) */
  score: number;
  
  /** Reasoning behind this priority score */
  reasoning: string;
  
  /** Suggested learning sources */
  suggestedSources: string[];
  
  /** Current status */
  status: 'pending' | 'in_progress' | 'completed';
  
  /** Creation timestamp */
  createdAt: Date;
  
  /** Last updated timestamp */
  updatedAt: Date;
  
  /** Target completion date (if applicable) */
  targetCompletionDate?: Date;
  
  /** Actual completion date (if applicable) */
  completionDate?: Date;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Options for knowledge gap detection
 */
export interface KnowledgeGapDetectionOptions {
  /** Confidence threshold (0-1) */
  confidenceThreshold?: number;
  
  /** Maximum gaps to detect */
  maxGaps?: number;
  
  /** Categories to focus on */
  categories?: Array<KnowledgeGapCategory | string>;
  
  /** Include resolved gaps */
  includeResolved?: boolean;
  
  /** Minimum importance level */
  minImportance?: number;
  
  /** Additional context to help with detection */
  context?: Record<string, unknown>;
}

/**
 * Knowledge gap detection result
 */
export interface KnowledgeGapDetectionResult {
  /** Detected knowledge gaps */
  gaps: KnowledgeGap[];
  
  /** Overall confidence in the detection */
  overallConfidence: number;
  
  /** Detection timestamp */
  timestamp: Date;
  
  /** Detection statistics */
  stats: {
    /** Processing time in milliseconds */
    processingTimeMs: number;
    
    /** Number of gaps detected */
    detectedCount: number;
    
    /** Number of new gaps (not previously known) */
    newCount: number;
    
    /** Average confidence of detected gaps */
    avgConfidence: number;
    
    /** Average importance of detected gaps */
    avgImportance: number;
  };
}

/**
 * Options for analyzing content for knowledge gaps
 */
export interface ContentAnalysisOptions {
  /** Content to analyze */
  content: string;
  
  /** Content type */
  contentType: 'conversation' | 'document' | 'task_output' | 'feedback' | 'reflection';
  
  /** Detection options */
  detectionOptions?: KnowledgeGapDetectionOptions;
  
  /** Source identifier */
  source?: string;
  
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Knowledge gap identification interface
 */
export interface KnowledgeGapIdentification {
  /**
   * Initialize the knowledge gap identification system
   * 
   * @returns Promise resolving to initialization success
   */
  initialize(): Promise<boolean>;
  
  /**
   * Detect knowledge gaps in a conversation
   * 
   * @param conversation Conversation history to analyze
   * @param options Detection options
   * @returns Promise resolving to detection results
   */
  detectGapsInConversation(
    conversation: string | Array<{role: string; content: string}>,
    options?: KnowledgeGapDetectionOptions
  ): Promise<KnowledgeGapDetectionResult>;
  
  /**
   * Detect knowledge gaps in content
   * 
   * @param options Content analysis options
   * @returns Promise resolving to detection results
   */
  detectGapsInContent(
    options: ContentAnalysisOptions
  ): Promise<KnowledgeGapDetectionResult>;
  
  /**
   * Register a knowledge gap manually
   * 
   * @param gap Knowledge gap to register
   * @returns Promise resolving to the created gap ID
   */
  registerKnowledgeGap(
    gap: Omit<KnowledgeGap, 'id' | 'createdAt' | 'updatedAt' | 'frequency'>
  ): Promise<string>;
  
  /**
   * Get all knowledge gaps
   * 
   * @param filter Optional filter criteria
   * @returns Promise resolving to matching knowledge gaps
   */
  getAllKnowledgeGaps(
    filter?: {
      status?: KnowledgeGapStatus[];
      category?: Array<KnowledgeGapCategory | string>;
      minImportance?: number;
      minConfidence?: number;
      source?: KnowledgeGapSource[];
    }
  ): Promise<KnowledgeGap[]>;
  
  /**
   * Get a knowledge gap by ID
   * 
   * @param id Knowledge gap ID
   * @returns Promise resolving to the knowledge gap or null if not found
   */
  getKnowledgeGapById(id: string): Promise<KnowledgeGap | null>;
  
  /**
   * Update a knowledge gap
   * 
   * @param id Knowledge gap ID
   * @param updates Updates to apply
   * @returns Promise resolving to success
   */
  updateKnowledgeGap(
    id: string,
    updates: Partial<Omit<KnowledgeGap, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<boolean>;
  
  /**
   * Update a knowledge gap's status
   * 
   * @param id Knowledge gap ID
   * @param status New status
   * @param resolution Optional resolution note for addressed gaps
   * @returns Promise resolving to success
   */
  updateKnowledgeGapStatus(
    id: string,
    status: KnowledgeGapStatus,
    resolution?: string
  ): Promise<boolean>;
  
  /**
   * Delete a knowledge gap
   * 
   * @param id Knowledge gap ID
   * @returns Promise resolving to success
   */
  deleteKnowledgeGap(id: string): Promise<boolean>;
  
  /**
   * Generate learning priorities for knowledge gaps
   * 
   * @param options Optional prioritization options
   * @returns Promise resolving to generated learning priorities
   */
  generateLearningPriorities(
    options?: {
      knowledgeGapIds?: string[];
      recalculateAll?: boolean;
      maxPriorities?: number;
    }
  ): Promise<LearningPriority[]>;
  
  /**
   * Get all learning priorities
   * 
   * @param filter Optional filter criteria
   * @returns Promise resolving to matching learning priorities
   */
  getAllLearningPriorities(
    filter?: {
      status?: Array<'pending' | 'in_progress' | 'completed'>;
      minScore?: number;
      knowledgeGapIds?: string[];
    }
  ): Promise<LearningPriority[]>;
  
  /**
   * Get top learning priorities
   * 
   * @param limit Maximum number of priorities to return
   * @returns Promise resolving to top learning priorities
   */
  getTopLearningPriorities(limit?: number): Promise<LearningPriority[]>;
  
  /**
   * Get learning priorities for a knowledge gap
   * 
   * @param knowledgeGapId Knowledge gap ID
   * @returns Promise resolving to associated learning priorities
   */
  getLearningPrioritiesForGap(knowledgeGapId: string): Promise<LearningPriority[]>;
  
  /**
   * Update a learning priority
   * 
   * @param id Learning priority ID
   * @param updates Updates to apply
   * @returns Promise resolving to success
   */
  updateLearningPriority(
    id: string,
    updates: Partial<Omit<LearningPriority, 'id' | 'knowledgeGapId' | 'createdAt' | 'updatedAt'>>
  ): Promise<boolean>;
  
  /**
   * Update a learning priority's status
   * 
   * @param id Learning priority ID
   * @param status New status
   * @returns Promise resolving to success
   */
  updateLearningPriorityStatus(
    id: string,
    status: 'pending' | 'in_progress' | 'completed'
  ): Promise<boolean>;
  
  /**
   * Get knowledge gap statistics
   * 
   * @returns Promise resolving to knowledge gap statistics
   */
  getKnowledgeGapStats(): Promise<{
    totalGaps: number;
    activeGaps: number;
    addressedGaps: number;
    byCategory: Record<string, number>;
    byStatus: Record<KnowledgeGapStatus, number>;
    byImportance: Record<ImportanceLevel, number>;
    bySource: Record<KnowledgeGapSource, number>;
    topPriorities: Array<{id: string; topic: string; score: number}>;
  }>;
  
  /**
   * Run a comprehensive knowledge gap analysis
   * Analyzes various sources to identify knowledge gaps
   * 
   * @param options Analysis options
   * @returns Promise resolving to analysis results
   */
  runComprehensiveAnalysis(
    options?: {
      sources?: Array<'conversations' | 'documents' | 'tasks' | 'feedback' | 'reflections'>;
      timeframe?: {
        from: Date;
        to: Date;
      };
      maxResults?: number;
    }
  ): Promise<KnowledgeGapDetectionResult>;
  
  /**
   * Generate a knowledge gap report
   * 
   * @param format Report format
   * @returns Promise resolving to formatted report
   */
  generateKnowledgeGapReport(
    format: 'text' | 'markdown' | 'json'
  ): Promise<string>;
  
  /**
   * Clear all knowledge gaps and learning priorities
   * 
   * @returns Promise resolving to success
   */
  clear(): Promise<boolean>;
  
  /**
   * Shutdown the knowledge gap identification system
   * 
   * @returns Promise resolving to shutdown success
   */
  shutdown(): Promise<boolean>;
} 