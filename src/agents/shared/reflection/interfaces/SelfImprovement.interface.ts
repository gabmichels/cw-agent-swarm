/**
 * SelfImprovement.interface.ts
 * 
 * Defines interfaces and types for self-improvement capabilities
 * used by enhanced reflection managers.
 */

/**
 * Improvement area types
 */
export enum ImprovementAreaType {
  KNOWLEDGE = 'knowledge',
  SKILL = 'skill',
  STRATEGY = 'strategy',
  BEHAVIOR = 'behavior',
  TOOL = 'tool',
  PROCESS = 'process'
}

/**
 * Improvement priority levels
 */
export enum ImprovementPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Learning outcome types
 */
export enum LearningOutcomeType {
  KNOWLEDGE = 'knowledge',
  SKILL = 'skill',
  INSIGHT = 'insight',
  PATTERN = 'pattern',
  STRATEGY = 'strategy'
}

/**
 * Self-improvement plan structure
 */
export interface SelfImprovementPlan {
  /** Unique identifier */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Detailed description */
  description: string;
  
  /** When this plan was created */
  createdAt: Date;
  
  /** When this plan was last updated */
  updatedAt: Date;
  
  /** When this plan starts */
  startDate: Date;
  
  /** When this plan ends */
  endDate: Date;
  
  /** Reflection IDs that led to this plan */
  sourceReflectionIds: string[];
  
  /** Target improvement areas */
  targetAreas: ImprovementAreaType[];
  
  /** Current status */
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  
  /** Priority level */
  priority: ImprovementPriority;
  
  /** Current progress (0-1) */
  progress: number;
  
  /** Metrics used to measure success */
  successMetrics: string[];
  
  /** Criteria for determining success */
  successCriteria: string[];
}

/**
 * Learning activity structure
 */
export interface LearningActivity {
  /** Unique identifier */
  id: string;
  
  /** Associated plan ID */
  planId: string;
  
  /** Human-readable name */
  name: string;
  
  /** Detailed description */
  description: string;
  
  /** Activity type */
  type: 'study' | 'practice' | 'reflection' | 'experiment' | 'observation';
  
  /** Target improvement area */
  area: ImprovementAreaType;
  
  /** Current status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  
  /** Expected duration in milliseconds */
  expectedDurationMs?: number;
  
  /** Actual duration in milliseconds */
  actualDurationMs?: number;
  
  /** Learning resources */
  resources?: string[];
  
  /** Related learning activities */
  relatedActivities?: string[];
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Learning outcome structure
 */
export interface LearningOutcome {
  /** Unique identifier */
  id: string;
  
  /** Associated plan ID */
  planId: string;
  
  /** When this outcome was recorded */
  timestamp: Date;
  
  /** Outcome type */
  type: LearningOutcomeType;
  
  /** Outcome content */
  content: string;
  
  /** Source of this outcome */
  source: 'reflection' | 'activity' | 'practice' | 'observation' | 'feedback';
  
  /** Source ID (reflection ID, activity ID, etc.) */
  sourceId: string;
  
  /** Confidence level (0-1) */
  confidence: number;
  
  /** Areas affected by this outcome */
  affectedAreas: ImprovementAreaType[];
  
  /** Whether this outcome has been applied to agent behavior */
  appliedToBehavior: boolean;
  
  /** When this outcome was applied */
  appliedAt?: Date;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Improvement progress report structure
 */
export interface ImprovementProgressReport {
  /** Associated plan ID */
  planId: string;
  
  /** When this report was generated */
  generatedAt: Date;
  
  /** Overall progress (0-1) */
  overallProgress: number;
  
  /** Progress by area */
  progressByArea: Record<ImprovementAreaType, number>;
  
  /** Active activities */
  activeActivities?: LearningActivity[];
  
  /** Completed activities */
  completedActivities?: LearningActivity[];
  
  /** Learning outcomes */
  outcomes?: LearningOutcome[];
  
  /** Metrics improvements */
  metricsImprovements?: Record<string, { before: number; after: number }>;
  
  /** Challenges encountered */
  challenges: string[];
  
  /** Recommendations for further improvement */
  recommendations?: string[];
}

/**
 * Self-Improvement interface 
 * 
 * This interface defines methods for managing self-improvement
 * plans, activities, and outcomes.
 */
export interface SelfImprovement {
  /**
   * Create a self-improvement plan
   * @param plan Plan to create (without ID and timestamps)
   * @returns Promise resolving to the created plan
   */
  createImprovementPlan(
    plan: Omit<SelfImprovementPlan, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<SelfImprovementPlan>;
  
  /**
   * Get a self-improvement plan by ID
   * @param planId Plan ID to retrieve
   * @returns Promise resolving to the plan or null if not found
   */
  getImprovementPlan(planId: string): Promise<SelfImprovementPlan | null>;
  
  /**
   * Update a self-improvement plan
   * @param planId Plan ID to update
   * @param updates Updates to apply
   * @returns Promise resolving to the updated plan
   */
  updateImprovementPlan(
    planId: string,
    updates: Partial<Omit<SelfImprovementPlan, 'id' | 'createdAt'>>
  ): Promise<SelfImprovementPlan>;
  
  /**
   * List improvement plans with optional filtering
   * @param options Filter options
   * @returns Promise resolving to matching plans
   */
  listImprovementPlans(options?: {
    status?: SelfImprovementPlan['status'][];
    priority?: ImprovementPriority[];
    area?: ImprovementAreaType[];
    minProgress?: number;
    maxProgress?: number;
  }): Promise<SelfImprovementPlan[]>;
  
  /**
   * Create a learning activity
   * @param activity Activity to create (without ID)
   * @returns Promise resolving to the created activity
   */
  createLearningActivity(
    activity: Omit<LearningActivity, 'id'>
  ): Promise<LearningActivity>;
  
  /**
   * Get a learning activity by ID
   * @param activityId Activity ID to retrieve
   * @returns Promise resolving to the activity or null if not found
   */
  getLearningActivity(activityId: string): Promise<LearningActivity | null>;
  
  /**
   * Update a learning activity
   * @param activityId Activity ID to update
   * @param updates Updates to apply
   * @returns Promise resolving to the updated activity
   */
  updateLearningActivity(
    activityId: string,
    updates: Partial<Omit<LearningActivity, 'id'>>
  ): Promise<LearningActivity>;
  
  /**
   * List learning activities with optional filtering
   * @param options Filter options
   * @returns Promise resolving to matching activities
   */
  listLearningActivities(options?: {
    planId?: string;
    status?: LearningActivity['status'][];
    type?: LearningActivity['type'][];
    area?: ImprovementAreaType[];
  }): Promise<LearningActivity[]>;
  
  /**
   * Record a learning outcome
   * @param outcome Outcome to record (without ID and timestamp)
   * @returns Promise resolving to the recorded outcome
   */
  recordLearningOutcome(
    outcome: Omit<LearningOutcome, 'id' | 'timestamp'>
  ): Promise<LearningOutcome>;
  
  /**
   * Get a learning outcome by ID
   * @param outcomeId Outcome ID to retrieve
   * @returns Promise resolving to the outcome or null if not found
   */
  getLearningOutcome(outcomeId: string): Promise<LearningOutcome | null>;
  
  /**
   * Update a learning outcome
   * @param outcomeId Outcome ID to update
   * @param updates Updates to apply
   * @returns Promise resolving to the updated outcome
   */
  updateLearningOutcome(
    outcomeId: string,
    updates: Partial<Omit<LearningOutcome, 'id' | 'timestamp'>>
  ): Promise<LearningOutcome>;
  
  /**
   * List learning outcomes with optional filtering
   * @param options Filter options
   * @returns Promise resolving to matching outcomes
   */
  listLearningOutcomes(options?: {
    planId?: string;
    type?: LearningOutcomeType[];
    area?: ImprovementAreaType[];
    minConfidence?: number;
    appliedToBehavior?: boolean;
  }): Promise<LearningOutcome[]>;
  
  /**
   * Generate a progress report for an improvement plan
   * @param planId Plan ID to generate a report for
   * @param options Report options
   * @returns Promise resolving to the generated report
   */
  generateProgressReport(
    planId: string,
    options?: {
      includeActivities?: boolean;
      includeOutcomes?: boolean;
      includeMetrics?: boolean;
      includeRecommendations?: boolean;
    }
  ): Promise<ImprovementProgressReport>;
  
  /**
   * Apply learning outcomes to agent behavior
   * @param outcomeIds Outcome IDs to apply
   * @returns Promise resolving to true if successfully applied
   */
  applyLearningOutcomes(outcomeIds: string[]): Promise<boolean>;
  
  /**
   * Generate an improvement plan from reflections
   * @param reflectionIds Reflection IDs to analyze
   * @param options Plan generation options
   * @returns Promise resolving to the generated plan
   */
  generateImprovementPlanFromReflections(
    reflectionIds: string[],
    options?: {
      priorityThreshold?: ImprovementPriority;
      maxImprovements?: number;
      focusAreas?: ImprovementAreaType[];
    }
  ): Promise<SelfImprovementPlan>;
} 