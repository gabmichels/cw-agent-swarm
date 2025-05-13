/**
 * Reflection Manager Interface
 * 
 * This file defines the reflection manager interface that provides self-evaluation,
 * improvement, and adaptation capabilities for agents. It extends the base manager interface
 * with reflection-specific functionality.
 */

import type { BaseManager, ManagerConfig } from './BaseManager';
import type { AgentBase } from '../../../../agents/shared/base/AgentBase.interface';
import type { 
  ImprovementAreaType,
  ImprovementPriority,
  LearningOutcomeType,
  SelfImprovementPlan,
  LearningActivity,
  LearningOutcome,
  ImprovementProgressReport,
  SelfImprovement
} from '../../../../agents/shared/reflection/interfaces/SelfImprovement.interface';
import type {
  PeriodicTask,
  PeriodicTaskType,
  PeriodicTaskStatus,
  PeriodicTaskResult
} from '../../../../agents/shared/tasks/PeriodicTaskRunner.interface';

/**
 * Configuration options for reflection managers
 */
export interface ReflectionManagerConfig extends ManagerConfig {
  /** Whether this manager is enabled */
  enabled: boolean;
  
  /** Reflection frequency settings */
  reflectionFrequency: {
    /** How often to perform reflections (in ms) */
    interval: number;
    
    /** Whether to reflect after each interaction */
    afterEachInteraction: boolean;
    
    /** Whether to reflect after errors */
    afterErrors: boolean;
    
    /** Minimum time between reflections (in ms) */
    minIntervalMs: number;
  };
  
  /** Reflection depth/thoroughness level */
  reflectionDepth: 'light' | 'standard' | 'deep';
  
  /** Maximum reflection history items to maintain */
  maxHistoryItems: number;
  
  /** Whether to adapt behavior based on reflections */
  adaptiveBehavior: boolean;
  
  /** How aggressively to change behavior based on reflections (0-1) */
  adaptationRate: number;
  
  /** Metrics to track for reflection */
  metricsToTrack: string[];
  
  /** Self-improvement goals */
  improvementGoals: string[];
  
  /** Whether to persist reflections across sessions */
  persistReflections: boolean;
  
  /** Whether to enable periodic reflections */
  enablePeriodicReflections: boolean;
  
  /** Default periodic reflection schedule (cron expression or interval) */
  periodicReflectionSchedule?: string;
  
  /** Whether to enable self-improvement capabilities */
  enableSelfImprovement: boolean;
  
  /** Default improvement areas to focus on */
  defaultImprovementAreas?: ImprovementAreaType[];
}

// Export existing types
export * from '../../../../agents/shared/reflection/interfaces/SelfImprovement.interface';

/**
 * Reflection trigger types
 */
export type ReflectionTrigger = 'scheduled' | 'error' | 'interaction' | 'manual' | 'periodic';

/**
 * Reflection insight interface
 */
export interface ReflectionInsight {
  /** Unique identifier */
  id: string;
  
  /** ID of the reflection that generated this insight */
  reflectionId: string;
  
  /** When the insight was generated */
  timestamp: Date;
  
  /** Type of insight */
  type: 'learning' | 'improvement' | 'pattern' | 'feedback';
  
  /** Insight content */
  content: string;
  
  /** Confidence level (0-1) */
  confidence: number;
  
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Reflection result interface
 */
export interface ReflectionResult {
  /** Whether reflection succeeded */
  success: boolean;
  
  /** Reflection ID if successful */
  id: string;
  
  /** Generated insights */
  insights: ReflectionInsight[];
  
  /** Result message */
  message: string;
}

/**
 * Reflection record
 */
export interface Reflection {
  /** Unique ID for the reflection */
  id: string;
  
  /** When the reflection was created */
  timestamp: Date;
  
  /** What triggered the reflection */
  trigger: ReflectionTrigger;
  
  /** Additional context for the reflection */
  context: Record<string, unknown>;
  
  /** Reflection depth used */
  depth: 'light' | 'standard' | 'deep';
  
  /** IDs of insights generated from this reflection */
  insights: string[];
  
  /** Metrics at the time of reflection */
  metrics: Record<string, number>;
}

/**
 * Self-improvement action interface
 */
export interface ImprovementAction {
  /** Unique ID for the improvement action */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Action description */
  description: string;
  
  /** When the action was created */
  createdAt: Date;
  
  /** When the action was last updated */
  updatedAt: Date;
  
  /** The target area for improvement */
  targetArea: 'knowledge' | 'skill' | 'strategy' | 'behavior' | 'process' | 'communication' | 'custom';
  
  /** Current status of this action */
  status: 'proposed' | 'approved' | 'in-progress' | 'completed' | 'rejected';
  
  /** Priority level */
  priority: 'low' | 'medium' | 'high';
  
  /** Expected impact (0-1) */
  expectedImpact: number;
  
  /** Implementation difficulty (0-1) */
  difficulty: number;
  
  /** Reflection IDs that led to this action */
  sourceReflectionIds: string[];
  
  /** Concrete steps to implement this action */
  implementationSteps?: string[];
  
  /** Success criteria */
  successCriteria?: string[];
  
  /** Dependencies on other actions */
  dependencies?: string[];
  
  /** Metrics to track progress */
  metricsToTrack?: string[];
  
  /** Actual impact assessment after implementation */
  actualImpact?: {
    score: number;
    notes: string;
    measuredAt: Date;
  };
}

/**
 * Knowledge gap interface
 */
export interface KnowledgeGap {
  /** Unique ID for the knowledge gap */
  id: string;
  
  /** Topic or area with insufficient knowledge */
  topic: string;
  
  /** Detailed description of the gap */
  description: string;
  
  /** When this gap was identified */
  identifiedAt: Date;
  
  /** Impact on performance (0-1) */
  impactLevel: number;
  
  /** Priority for addressing */
  priority: 'low' | 'medium' | 'high';
  
  /** Current status */
  status: 'identified' | 'researching' | 'addressed' | 'verified';
  
  /** Learning resources */
  resources?: Array<{
    title: string;
    url?: string;
    type: 'article' | 'documentation' | 'video' | 'course' | 'example' | 'other';
    priority: 'low' | 'medium' | 'high';
    status: 'not-started' | 'in-progress' | 'completed';
  }>;
  
  /** Reflections that identified this gap */
  sourceReflectionIds: string[];
  
  /** Knowledge acquisition plan */
  acquisitionPlan?: {
    steps: string[];
    timeline?: string;
    verificationMethod?: string;
  };
}

/**
 * Reflection strategy interface
 */
export interface ReflectionStrategy {
  /** Unique ID for the strategy */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Strategy description */
  description: string;
  
  /** Trigger type this strategy is used for */
  triggerType: ReflectionTrigger;
  
  /** When to apply this strategy */
  triggerConditions: Array<{
    type: 'error' | 'metric-threshold' | 'scheduled' | 'user-feedback' | 'custom';
    params?: Record<string, unknown>;
  }>;
  
  /** Steps to follow in this reflection */
  steps: string[];
  
  /** Required data for this reflection */
  requiredData: string[];
  
  /** Questions to consider */
  guidingQuestions: string[];
  
  /** Priority relative to other strategies */
  priority: number;
  
  /** Whether this strategy is enabled */
  enabled: boolean;
}

/**
 * Performance metrics interface for reflection
 */
export interface PerformanceMetrics {
  /** Time period these metrics cover */
  period: {
    start: Date;
    end: Date;
  };
  
  /** Success rate (0-1) */
  successRate: number;
  
  /** Task completion metrics */
  taskCompletion: {
    /** Number of tasks completed */
    completed: number;
    
    /** Number of tasks failed */
    failed: number;
    
    /** Average time to complete tasks in milliseconds */
    averageTimeMs: number;
  };
  
  /** Error metrics */
  errors: {
    /** Total error count */
    count: number;
    
    /** Errors by category */
    byCategory: Record<string, number>;
    
    /** Most common error */
    mostCommon?: {
      type: string;
      count: number;
    };
  };
  
  /** User satisfaction metrics (if available) */
  userSatisfaction?: {
    /** Average rating (0-1) */
    averageRating: number;
    
    /** Rating count */
    ratingCount: number;
    
    /** Positive feedback count */
    positiveCount: number;
    
    /** Negative feedback count */
    negativeCount: number;
  };
  
  /** Resource usage metrics */
  resourceUsage?: {
    /** Average token usage */
    averageTokens: number;
    
    /** Average processing time in milliseconds */
    averageProcessingTimeMs: number;
    
    /** API call count */
    apiCallCount: number;
  };
  
  /** Custom metrics */
  custom?: Record<string, number>;
}

/**
 * Periodic reflection task
 */
export interface PeriodicReflectionTask extends PeriodicTask {
  /** Reflection-specific parameters */
  parameters: {
    /** Reflection depth for this task */
    depth?: 'light' | 'standard' | 'deep';
    
    /** Areas to focus on */
    focusAreas?: string[];
    
    /** Specific strategies to apply */
    strategies?: string[];
    
    /** Additional context information */
    context?: Record<string, unknown>;
  };
}

/**
 * Reflection manager interface
 */
export interface ReflectionManager extends BaseManager, SelfImprovement {
  /**
   * Create a new reflection
   * @param reflection The reflection data to create
   * @returns Promise resolving to the created reflection
   */
  createReflection(
    reflection: Omit<Reflection, 'id' | 'timestamp'>
  ): Promise<Reflection>;
  
  /**
   * Get a reflection by ID
   * @param reflectionId The reflection ID to retrieve
   * @returns Promise resolving to the reflection or null if not found
   */
  getReflection(reflectionId: string): Promise<Reflection | null>;
  
  /**
   * List reflections with optional filtering
   * @param options Filter options
   * @returns Promise resolving to matching reflections
   */
  listReflections(options?: {
    trigger?: ReflectionTrigger[];
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
    sortBy?: 'timestamp' | 'trigger';
    sortDirection?: 'asc' | 'desc';
  }): Promise<Reflection[]>;
  
  /**
   * Perform a reflection based on recent events and performance
   * @param trigger What triggered the reflection
   * @param context Additional context for the reflection
   * @returns Promise resolving to the reflection result
   */
  reflect(
    trigger: ReflectionTrigger,
    context?: Record<string, unknown>
  ): Promise<ReflectionResult>;
  
  /**
   * Create an improvement action
   * @param action The improvement action to create
   * @returns Promise resolving to the created action
   */
  createImprovementAction(
    action: Omit<ImprovementAction, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ImprovementAction>;
  
  /**
   * Get an improvement action by ID
   * @param actionId The action ID to retrieve
   * @returns Promise resolving to the action or null if not found
   */
  getImprovementAction(actionId: string): Promise<ImprovementAction | null>;
  
  /**
   * Update an improvement action
   * @param actionId The action ID to update
   * @param updates The updates to apply
   * @returns Promise resolving to the updated action
   */
  updateImprovementAction(
    actionId: string,
    updates: Partial<Omit<ImprovementAction, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ImprovementAction>;
  
  /**
   * List improvement actions with optional filtering
   * @param options Filter options
   * @returns Promise resolving to matching actions
   */
  listImprovementActions(options?: {
    status?: ImprovementAction['status'][];
    targetArea?: ImprovementAction['targetArea'][];
    priority?: ImprovementAction['priority'][];
    minExpectedImpact?: number;
    limit?: number;
    offset?: number;
    sortBy?: 'createdAt' | 'priority' | 'expectedImpact' | 'difficulty';
    sortDirection?: 'asc' | 'desc';
  }): Promise<ImprovementAction[]>;
  
  /**
   * Register a reflection strategy
   * @param strategy The strategy to register
   * @returns Promise resolving to the registered strategy
   */
  registerReflectionStrategy(
    strategy: Omit<ReflectionStrategy, 'id'>
  ): Promise<ReflectionStrategy>;
  
  /**
   * Get a reflection strategy by ID
   * @param strategyId The strategy ID to retrieve
   * @returns Promise resolving to the strategy or null if not found
   */
  getReflectionStrategy(strategyId: string): Promise<ReflectionStrategy | null>;
  
  /**
   * Update a reflection strategy
   * @param strategyId The strategy ID to update
   * @param updates The updates to apply
   * @returns Promise resolving to the updated strategy
   */
  updateReflectionStrategy(
    strategyId: string,
    updates: Partial<Omit<ReflectionStrategy, 'id'>>
  ): Promise<ReflectionStrategy>;
  
  /**
   * List reflection strategies with optional filtering
   * @param options Filter options
   * @returns Promise resolving to matching strategies
   */
  listReflectionStrategies(options?: {
    trigger?: ReflectionTrigger[];
    enabled?: boolean;
    sortBy?: 'priority' | 'name';
    sortDirection?: 'asc' | 'desc';
  }): Promise<ReflectionStrategy[]>;
  
  /**
   * Enable or disable a reflection strategy
   * @param strategyId The strategy ID to update
   * @param enabled Whether the strategy should be enabled
   * @returns Promise resolving to the updated strategy
   */
  setReflectionStrategyEnabled(
    strategyId: string,
    enabled: boolean
  ): Promise<ReflectionStrategy>;
  
  /**
   * Identify knowledge gaps
   * @param options Knowledge gap identification options
   * @returns Promise resolving to identified knowledge gaps
   */
  identifyKnowledgeGaps(options?: {
    /** Base identification on recent interactions */
    fromRecentInteractions?: boolean;
    
    /** Base identification on specific reflections */
    fromReflectionIds?: string[];
    
    /** Maximum gaps to identify */
    maxGaps?: number;
    
    /** Minimum impact level (0-1) */
    minImpactLevel?: number;
  }): Promise<KnowledgeGap[]>;
  
  /**
   * Get a knowledge gap by ID
   * @param gapId The gap ID to retrieve
   * @returns Promise resolving to the knowledge gap or null if not found
   */
  getKnowledgeGap(gapId: string): Promise<KnowledgeGap | null>;
  
  /**
   * Update a knowledge gap
   * @param gapId The gap ID to update
   * @param updates The updates to apply
   * @returns Promise resolving to the updated knowledge gap
   */
  updateKnowledgeGap(
    gapId: string,
    updates: Partial<Omit<KnowledgeGap, 'id' | 'identifiedAt'>>
  ): Promise<KnowledgeGap>;
  
  /**
   * List knowledge gaps with optional filtering
   * @param options Filter options
   * @returns Promise resolving to matching knowledge gaps
   */
  listKnowledgeGaps(options?: {
    status?: KnowledgeGap['status'][];
    priority?: KnowledgeGap['priority'][];
    minImpactLevel?: number;
    limit?: number;
    offset?: number;
    sortBy?: 'identifiedAt' | 'priority' | 'impactLevel';
    sortDirection?: 'asc' | 'desc';
  }): Promise<KnowledgeGap[]>;
  
  /**
   * Get performance metrics
   * @param options Metrics retrieval options
   * @returns Promise resolving to performance metrics
   */
  getPerformanceMetrics(options?: {
    /** Time period start */
    fromDate?: Date;
    
    /** Time period end */
    toDate?: Date;
    
    /** Compare to previous period */
    compareToPrevious?: boolean;
    
    /** Specific metrics to include */
    include?: string[];
  }): Promise<PerformanceMetrics>;
  
  /**
   * Adapt agent behavior based on reflections
   * @param options Adaptation options
   * @returns Promise resolving to true if adaptation was successful
   */
  adaptBehavior(options?: {
    /** Base adaptation on specific reflections */
    fromReflectionIds?: string[];
    
    /** How aggressively to adapt (0-1, overrides config) */
    adaptationRate?: number;
    
    /** Target areas to adapt */
    targetAreas?: string[];
  }): Promise<boolean>;
  
  /**
   * Get statistics about the reflection process
   * @returns Promise resolving to reflection statistics
   */
  getStats(): Promise<{
    totalReflections: number;
    reflectionsByType: Record<string, number>;
    totalImprovementActions: number;
    actionsByStatus: Record<string, number>;
    totalKnowledgeGaps: number;
    gapsByStatus: Record<string, number>;
    lastReflectionTime?: Date;
    averageReflectionFrequencyMs?: number;
    topInsightTags?: Array<{tag: string; count: number}>;
  }>;
  
  /**
   * Schedule a periodic reflection
   * 
   * @param schedule When to run the reflection (cron expression or interval)
   * @param options Additional options for the reflection
   * @returns The created periodic reflection task
   */
  schedulePeriodicReflection(
    schedule: string,
    options: {
      name?: string;
      depth?: 'light' | 'standard' | 'deep';
      focusAreas?: string[];
      strategies?: string[];
      context?: Record<string, unknown>;
    }
  ): Promise<PeriodicReflectionTask>;
  
  /**
   * Get a periodic reflection task by ID
   * 
   * @param taskId ID of the task to retrieve
   * @returns The task or null if not found
   */
  getPeriodicReflectionTask(
    taskId: string
  ): Promise<PeriodicReflectionTask | null>;
  
  /**
   * Update a periodic reflection task
   * 
   * @param taskId ID of the task to update
   * @param updates Updates to apply
   * @returns Updated task
   */
  updatePeriodicReflectionTask(
    taskId: string,
    updates: Partial<Omit<PeriodicReflectionTask, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<PeriodicReflectionTask>;
  
  /**
   * List periodic reflection tasks
   * 
   * @param options Filter options
   * @returns Matching tasks
   */
  listPeriodicReflectionTasks(
    options?: {
      enabled?: boolean;
      status?: PeriodicTaskStatus[];
      sortBy?: 'nextRunTime' | 'lastRunTime' | 'name';
      sortDirection?: 'asc' | 'desc';
    }
  ): Promise<PeriodicReflectionTask[]>;
  
  /**
   * Execute a periodic reflection task immediately
   * 
   * @param taskId ID of the task to run
   * @param options Run options
   * @returns Task execution result
   */
  runPeriodicReflectionTask(
    taskId: string,
    options?: {
      updateNextRunTime?: boolean;
      context?: Record<string, unknown>;
    }
  ): Promise<PeriodicTaskResult>;
  
  /**
   * Enable or disable a periodic reflection task
   * 
   * @param taskId ID of the task to update
   * @param enabled Whether task should be enabled
   * @returns Updated task
   */
  setPeriodicReflectionTaskEnabled(
    taskId: string,
    enabled: boolean
  ): Promise<PeriodicReflectionTask>;
  
  /**
   * Delete a periodic reflection task
   * 
   * @param taskId ID of the task to delete
   * @returns Whether deletion was successful
   */
  deletePeriodicReflectionTask(
    taskId: string
  ): Promise<boolean>;
} 