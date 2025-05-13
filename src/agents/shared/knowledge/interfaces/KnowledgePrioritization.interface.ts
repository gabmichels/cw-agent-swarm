/**
 * Knowledge Prioritization Interface
 * 
 * This file defines interfaces for knowledge prioritization and relevance scoring,
 * enabling agents to effectively manage and prioritize their knowledge acquisition and use.
 */

/**
 * Priority level for knowledge items
 */
export enum KnowledgePriorityLevel {
  CRITICAL = 'critical',      // Must be addressed immediately
  HIGH = 'high',              // Important to address soon
  MEDIUM = 'medium',          // Should be addressed when possible
  LOW = 'low',                // Can be addressed if time permits
  BACKGROUND = 'background'   // Address opportunistically as background task
}

/**
 * Relevance category for knowledge
 */
export enum KnowledgeRelevanceCategory {
  CORE = 'core',              // Central to agent's domain/purpose
  SUPPORTING = 'supporting',  // Supports core knowledge areas
  CONTEXTUAL = 'contextual',  // Provides useful context
  PERIPHERAL = 'peripheral',  // Related but not central
  TANGENTIAL = 'tangential'   // Minimally related to agent's purpose
}

/**
 * Priority factors that influence knowledge prioritization
 */
export enum PriorityFactor {
  RECENCY = 'recency',            // How recent the knowledge is
  FREQUENCY = 'frequency',        // How frequently it's used/encountered
  DOMAIN_RELEVANCE = 'domain_relevance', // Relevance to primary domain
  TASK_RELEVANCE = 'task_relevance',    // Relevance to current tasks
  GAP_FILLING = 'gap_filling',     // Addresses important knowledge gaps
  USER_INTEREST = 'user_interest',   // Aligned with user interests
  CONFIDENCE = 'confidence',       // Confidence in the knowledge
  IMPORTANCE = 'importance'        // Overall importance
}

/**
 * Priority scoring model for calculating priorities
 */
export interface PriorityScoringModel {
  /** Name of the model */
  name: string;
  
  /** Description of how the model works */
  description: string;
  
  /** Weight for each priority factor (0-1 scale) */
  factorWeights: Partial<Record<PriorityFactor, number>>;
  
  /** Adjustments based on relevance category */
  categoryAdjustments: Partial<Record<KnowledgeRelevanceCategory, number>>;
  
  /** Additional scoring parameters */
  parameters?: Record<string, unknown>;
  
  /** Version of the model */
  version: string;
}

/**
 * Knowledge item priority metadata
 */
export interface KnowledgePriorityInfo {
  /** Unique identifier */
  id: string;
  
  /** Reference to the knowledge item this applies to */
  knowledgeItemId: string;
  
  /** Computed priority score (0-100 scale) */
  priorityScore: number;
  
  /** Priority level classification */
  priorityLevel: KnowledgePriorityLevel;
  
  /** Relevance category */
  relevanceCategory: KnowledgeRelevanceCategory;
  
  /** Factor scores that contributed to final score */
  factorScores: Partial<Record<PriorityFactor, number>>;
  
  /** Explanation of priority calculation */
  explanation: string;
  
  /** Timestamp when priority was last calculated */
  lastCalculated: Date;
  
  /** Last updated timestamp */
  updatedAt: Date;
  
  /** Next scheduled recalculation date */
  nextRecalculation?: Date;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Prioritization request options
 */
export interface PrioritizationOptions {
  /** IDs of knowledge items to prioritize (if empty, prioritize all) */
  knowledgeItemIds?: string[];
  
  /** Scoring model to use */
  scoringModel?: PriorityScoringModel | string;
  
  /** Context to use for relevance calculations */
  context?: {
    /** Current task or goal */
    currentTask?: string;
    
    /** Current domain focus */
    domainFocus?: string;
    
    /** User interests */
    userInterests?: string[];
    
    /** Recent topics */
    recentTopics?: string[];
    
    /** Additional context */
    additionalContext?: Record<string, unknown>;
  };
  
  /** Additional options */
  options?: {
    /** Force recalculation even if recently calculated */
    forceRecalculation?: boolean;
    
    /** Minimum change threshold to store new priority */
    minChangeThreshold?: number;
    
    /** Whether to include explanation in results */
    includeExplanation?: boolean;
  };
}

/**
 * Result of a prioritization operation
 */
export interface PrioritizationResult {
  /** Prioritized knowledge items */
  prioritizedItems: KnowledgePriorityInfo[];
  
  /** Statistics about the prioritization */
  stats: {
    /** Number of items prioritized */
    itemsProcessed: number;
    
    /** Number of items with changed priorities */
    itemsChanged: number;
    
    /** Average priority score */
    averageScore: number;
    
    /** Distribution of priority levels */
    levelDistribution: Record<KnowledgePriorityLevel, number>;
    
    /** Processing time in milliseconds */
    processingTimeMs: number;
  };
  
  /** Timestamp of prioritization */
  timestamp: Date;
}

/**
 * Knowledge prioritization interface
 */
export interface KnowledgePrioritization {
  /**
   * Initialize the knowledge prioritization system
   * 
   * @returns Promise resolving to initialization success
   */
  initialize(): Promise<boolean>;
  
  /**
   * Register a priority scoring model
   * 
   * @param model Priority scoring model to register
   * @returns Promise resolving to the model ID
   */
  registerScoringModel(model: Omit<PriorityScoringModel, 'id'>): Promise<string>;
  
  /**
   * Get all registered scoring models
   * 
   * @returns Promise resolving to array of scoring models
   */
  getScoringModels(): Promise<PriorityScoringModel[]>;
  
  /**
   * Get a scoring model by name or ID
   * 
   * @param nameOrId Name or ID of the model
   * @returns Promise resolving to the scoring model or null if not found
   */
  getScoringModel(nameOrId: string): Promise<PriorityScoringModel | null>;
  
  /**
   * Prioritize knowledge items
   * 
   * @param options Prioritization options
   * @returns Promise resolving to prioritization result
   */
  prioritizeKnowledge(options: PrioritizationOptions): Promise<PrioritizationResult>;
  
  /**
   * Get priority info for a knowledge item
   * 
   * @param knowledgeItemId ID of the knowledge item
   * @returns Promise resolving to priority info or null if not found
   */
  getKnowledgePriority(knowledgeItemId: string): Promise<KnowledgePriorityInfo | null>;
  
  /**
   * Get priority info for multiple knowledge items
   * 
   * @param knowledgeItemIds IDs of knowledge items
   * @returns Promise resolving to map of knowledge item IDs to priority info
   */
  getKnowledgePriorities(knowledgeItemIds: string[]): Promise<Map<string, KnowledgePriorityInfo>>;
  
  /**
   * Set knowledge item relevance category
   * 
   * @param knowledgeItemId Knowledge item ID
   * @param category Relevance category
   * @param reason Optional reason for the categorization
   * @returns Promise resolving to success
   */
  setRelevanceCategory(
    knowledgeItemId: string,
    category: KnowledgeRelevanceCategory,
    reason?: string
  ): Promise<boolean>;
  
  /**
   * Manually adjust priority for a knowledge item
   * 
   * @param knowledgeItemId Knowledge item ID
   * @param adjustment Score adjustment (-100 to 100)
   * @param reason Reason for the adjustment
   * @param expiration Optional expiration date for the adjustment
   * @returns Promise resolving to new priority info
   */
  adjustPriority(
    knowledgeItemId: string,
    adjustment: number,
    reason: string,
    expiration?: Date
  ): Promise<KnowledgePriorityInfo>;
  
  /**
   * Get top priority knowledge items
   * 
   * @param count Number of items to return (default: 10)
   * @param filter Optional filter criteria
   * @returns Promise resolving to array of priority info items
   */
  getTopPriorityItems(
    count?: number,
    filter?: {
      minScore?: number;
      categories?: KnowledgeRelevanceCategory[];
      levels?: KnowledgePriorityLevel[];
    }
  ): Promise<KnowledgePriorityInfo[]>;
  
  /**
   * Schedule a prioritization job
   * 
   * @param schedule Cron-style schedule string
   * @param options Prioritization options
   * @returns Promise resolving to job ID
   */
  schedulePrioritization(
    schedule: string,
    options: PrioritizationOptions
  ): Promise<string>;
  
  /**
   * Cancel a scheduled prioritization job
   * 
   * @param jobId Job ID
   * @returns Promise resolving to success
   */
  cancelScheduledPrioritization(jobId: string): Promise<boolean>;
  
  /**
   * Get knowledge priority statistics
   * 
   * @returns Promise resolving to priority statistics
   */
  getPriorityStats(): Promise<{
    totalItems: number;
    averageScore: number;
    levelCounts: Record<KnowledgePriorityLevel, number>;
    categoryCounts: Record<KnowledgeRelevanceCategory, number>;
    topPriorityItems: Array<{ id: string; knowledgeItemId: string; score: number }>;
  }>;
  
  /**
   * Generate a knowledge priority report
   * 
   * @param format Report format
   * @returns Promise resolving to formatted report
   */
  generatePriorityReport(format: 'text' | 'markdown' | 'json'): Promise<string>;
  
  /**
   * Clear all priority data
   * 
   * @returns Promise resolving to success
   */
  clear(): Promise<boolean>;
  
  /**
   * Shutdown the knowledge prioritization system
   * 
   * @returns Promise resolving to shutdown success
   */
  shutdown(): Promise<boolean>;
} 