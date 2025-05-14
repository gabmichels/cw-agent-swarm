/**
 * ReflectionManager.interface.ts - Reflection Manager Interface
 * 
 * This file defines the reflection manager interface that provides self-reflection
 * and improvement capabilities for agents. It extends the base manager interface
 * with reflection-specific functionality.
 */

import { BaseManager, ManagerConfig } from './BaseManager';

/**
 * Configuration options for reflection managers
 */
export interface ReflectionManagerConfig extends ManagerConfig {
  /** Depth of reflection to perform */
  reflectionDepth?: 'light' | 'standard' | 'deep';
  
  /** Whether to enable adaptive behavior based on reflections */
  adaptiveBehavior?: boolean;
  
  /** Adaptation rate (0-1) for behavior changes */
  adaptationRate?: number;
  
  /** Reflection frequency settings */
  reflectionFrequency?: {
    /** Minimum interval between reflections in milliseconds */
    minIntervalMs?: number;
    
    /** Interval for regular reflections in milliseconds */
    interval?: number;
    
    /** Whether to reflect after each interaction */
    afterEachInteraction?: boolean;
    
    /** Whether to reflect after errors */
    afterErrors?: boolean;
  };
  
  /** Whether to persist reflections across sessions */
  persistReflections?: boolean;
  
  /** Maximum history items to maintain */
  maxHistoryItems?: number;
  
  /** Improvement goals */
  improvementGoals?: string[];
  
  /** Metrics to track for self-improvement */
  metricsToTrack?: string[];
}

/**
 * Reflection triggers
 */
export enum ReflectionTrigger {
  MANUAL = 'manual',
  SCHEDULED = 'scheduled',
  ERROR = 'error',
  INTERACTION = 'interaction',
  PERFORMANCE = 'performance',
  PERIODIC = 'periodic',
  INSIGHT = 'insight',
  FEEDBACK = 'feedback'
}

/**
 * Reflection structure
 */
export interface Reflection {
  /** Unique identifier for this reflection */
  id: string;
  
  /** When this reflection was created */
  timestamp: Date;
  
  /** What triggered this reflection */
  trigger: ReflectionTrigger;
  
  /** Context for this reflection */
  context: Record<string, unknown>;
  
  /** Depth of this reflection */
  depth: 'light' | 'standard' | 'deep';
  
  /** Insight IDs generated from this reflection */
  insights: string[];
  
  /** Performance metrics at the time of reflection */
  metrics: Record<string, unknown>;
}

/**
 * Reflection insight structure
 */
export interface ReflectionInsight {
  /** Unique identifier for this insight */
  id: string;
  
  /** ID of the parent reflection */
  reflectionId: string;
  
  /** When this insight was created */
  timestamp: Date;
  
  /** Type of insight */
  type: 'learning' | 'improvement' | 'warning' | 'error' | 'pattern';
  
  /** Insight content */
  content: string;
  
  /** Confidence in this insight (0-1) */
  confidence: number;
  
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Reflection result
 */
export interface ReflectionResult {
  /** Whether the reflection was successful */
  success: boolean;
  
  /** ID of the reflection */
  id: string;
  
  /** Insights generated */
  insights: ReflectionInsight[];
  
  /** Status message */
  message: string;
}

/**
 * Improvement action structure
 */
export interface ImprovementAction {
  /** Unique identifier for this action */
  id: string;
  
  /** Action title */
  title: string;
  
  /** Action description */
  description: string;
  
  /** Target area for improvement */
  targetArea: 'knowledge' | 'planning' | 'execution' | 'interaction' | 'learning' | 'tools';
  
  /** Action priority */
  priority: 'low' | 'medium' | 'high' | 'critical';
  
  /** Expected impact (0-1) */
  expectedImpact: number;
  
  /** Implementation difficulty (0-1) */
  difficulty: number;
  
  /** Status of this action */
  status: 'suggested' | 'accepted' | 'in_progress' | 'completed' | 'rejected';
  
  /** Implementation plan */
  implementationPlan?: string;
  
  /** Improvement metrics to track */
  metricsToTrack?: string[];
  
  /** When this action was created */
  createdAt: Date;
  
  /** When this action was last updated */
  updatedAt: Date;
}

/**
 * Reflection strategy structure
 */
export interface ReflectionStrategy {
  /** Unique identifier for this strategy */
  id: string;
  
  /** Strategy name */
  name: string;
  
  /** Strategy description */
  description: string;
  
  /** Reflection triggers that apply to this strategy */
  triggers: ReflectionTrigger[];
  
  /** Whether this strategy is enabled */
  enabled: boolean;
  
  /** Strategy priority (0-1) */
  priority: number;
  
  /** Query template for reflection */
  queryTemplate: string;
  
  /** Required context keys */
  requiredContext?: string[];
  
  /** Focus areas for this strategy */
  focusAreas?: string[];
}

/**
 * Knowledge gap structure
 */
export interface KnowledgeGap {
  /** Unique identifier for this gap */
  id: string;
  
  /** Gap description */
  description: string;
  
  /** When this gap was identified */
  identifiedAt: Date;
  
  /** Gap priority */
  priority: 'low' | 'medium' | 'high' | 'critical';
  
  /** Expected impact level (0-1) */
  impactLevel: number;
  
  /** Gap status */
  status: 'identified' | 'planned' | 'addressing' | 'resolved' | 'ignored';
  
  /** Knowledge domain */
  domain: string;
  
  /** Related reflections that identified this gap */
  relatedReflectionIds?: string[];
}

/**
 * Performance metrics structure
 */
export interface PerformanceMetrics {
  /** Time period for these metrics */
  period: {
    start: Date;
    end: Date;
  };
  
  /** Comparison to previous period */
  compareToPrevious?: {
    period: {
      start: Date;
      end: Date;
    };
    changes: Record<string, {
      previous: number;
      current: number;
      percentChange: number;
    }>;
  };
  
  /** Raw metrics data */
  metrics: Record<string, number>;
  
  /** Tracked trends */
  trends?: Record<string, Array<{
    timestamp: Date;
    value: number;
  }>>;
}

/**
 * Reflection manager interface
 */
export interface ReflectionManager extends BaseManager {
  /**
   * Reflect on agent's performance, operations, or a specific topic
   * @param trigger What triggered this reflection
   * @param context Optional context information
   * @returns Promise resolving to the reflection result
   */
  reflect(trigger: ReflectionTrigger, context?: Record<string, unknown>): Promise<ReflectionResult>;
  
  /**
   * Get a reflection by ID
   * @param id Reflection ID
   * @returns Promise resolving to the reflection or null if not found
   */
  getReflection(id: string): Promise<Reflection | null>;
  
  /**
   * Get all reflections with optional filtering
   * @param options Filter options
   * @returns Promise resolving to matching reflections
   */
  getReflections(options?: {
    limit?: number;
    offset?: number;
    sortBy?: 'timestamp' | 'trigger';
    sortDirection?: 'asc' | 'desc';
  }): Promise<Reflection[]>;
  
  /**
   * Create a new reflection
   * @param reflection Reflection to create (without ID and timestamp)
   * @returns Promise resolving to the created reflection
   */
  createReflection(reflection: Omit<Reflection, 'id' | 'timestamp'>): Promise<Reflection>;
  
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
   * Get an insight by ID
   * @param id Insight ID
   * @returns Promise resolving to the insight or null if not found
   */
  getInsight(id: string): Promise<ReflectionInsight | null>;
  
  /**
   * Get all insights with optional filtering
   * @param options Filter options
   * @returns Promise resolving to matching insights
   */
  getInsights(options?: {
    reflectionId?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'timestamp' | 'confidence' | 'type';
    sortDirection?: 'asc' | 'desc';
  }): Promise<ReflectionInsight[]>;
  
  /**
   * Get current metrics
   * @returns Promise resolving to current metrics
   */
  getMetrics(): Promise<Record<string, number>>;
  
  /**
   * Set improvement goals
   * @param goals Improvement goals to set
   * @returns Promise resolving to true if set successfully
   */
  setImprovementGoals(goals: string[]): Promise<boolean>;
  
  /**
   * Get improvement goals
   * @returns Promise resolving to current improvement goals
   */
  getImprovementGoals(): Promise<string[]>;
  
  /**
   * Create an improvement action
   * @param action Improvement action to create (without ID and timestamps)
   * @returns Promise resolving to the created action
   */
  createImprovementAction(
    action: Omit<ImprovementAction, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ImprovementAction>;
  
  /**
   * Get an improvement action by ID
   * @param actionId Action ID
   * @returns Promise resolving to the action or null if not found
   */
  getImprovementAction(actionId: string): Promise<ImprovementAction | null>;
  
  /**
   * Update an improvement action
   * @param actionId Action ID
   * @param updates Updates to apply
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
   * @param strategy Strategy to register (without ID)
   * @returns Promise resolving to the registered strategy
   */
  registerReflectionStrategy(
    strategy: Omit<ReflectionStrategy, 'id'>
  ): Promise<ReflectionStrategy>;
  
  /**
   * Get a reflection strategy by ID
   * @param strategyId Strategy ID
   * @returns Promise resolving to the strategy or null if not found
   */
  getReflectionStrategy(strategyId: string): Promise<ReflectionStrategy | null>;
  
  /**
   * Update a reflection strategy
   * @param strategyId Strategy ID
   * @param updates Updates to apply
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
   * @param strategyId Strategy ID
   * @param enabled Whether to enable or disable
   * @returns Promise resolving to the updated strategy
   */
  setReflectionStrategyEnabled(
    strategyId: string,
    enabled: boolean
  ): Promise<ReflectionStrategy>;
  
  /**
   * Identify knowledge gaps
   * @param options Options for gap identification
   * @returns Promise resolving to identified gaps
   */
  identifyKnowledgeGaps(options?: {
    fromRecentInteractions?: boolean;
    fromReflectionIds?: string[];
    maxGaps?: number;
    minImpactLevel?: number;
  }): Promise<KnowledgeGap[]>;
  
  /**
   * Get a knowledge gap by ID
   * @param gapId Gap ID
   * @returns Promise resolving to the gap or null if not found
   */
  getKnowledgeGap(gapId: string): Promise<KnowledgeGap | null>;
  
  /**
   * Update a knowledge gap
   * @param gapId Gap ID
   * @param updates Updates to apply
   * @returns Promise resolving to the updated gap
   */
  updateKnowledgeGap(
    gapId: string,
    updates: Partial<Omit<KnowledgeGap, 'id' | 'identifiedAt'>>
  ): Promise<KnowledgeGap>;
  
  /**
   * List knowledge gaps with optional filtering
   * @param options Filter options
   * @returns Promise resolving to matching gaps
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
   * @param options Options for metrics retrieval
   * @returns Promise resolving to performance metrics
   */
  getPerformanceMetrics(options?: {
    fromDate?: Date;
    toDate?: Date;
    compareToPrevious?: boolean;
    include?: string[];
  }): Promise<PerformanceMetrics>;
  
  /**
   * Adapt agent behavior based on reflections
   * @returns Promise resolving to true if adapted successfully
   */
  adaptBehavior(): Promise<boolean>;
  
  /**
   * Get statistics about the reflection process
   * @returns Promise resolving to reflection statistics
   */
  getStats(): Promise<Record<string, unknown>>;
} 