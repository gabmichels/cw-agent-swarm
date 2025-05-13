/**
 * Self-Improvement Interface
 * 
 * This file defines interfaces for self-improvement capabilities
 * to be implemented by reflection managers.
 */

/**
 * Improvement area types
 */
export enum ImprovementAreaType {
  KNOWLEDGE = 'knowledge',
  SKILL = 'skill',
  PROCESS = 'process',
  PERFORMANCE = 'performance',
  STRATEGY = 'strategy',
  COMMUNICATION = 'communication'
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
  NEW_KNOWLEDGE = 'new_knowledge',
  REFINED_SKILL = 'refined_skill',
  IMPROVED_PROCESS = 'improved_process',
  CORRECTED_MISUNDERSTANDING = 'corrected_misunderstanding',
  ENHANCED_CAPABILITY = 'enhanced_capability'
}

/**
 * Self-improvement plan
 */
export interface SelfImprovementPlan {
  /** Unique ID for the plan */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** When the plan was created */
  createdAt: Date;
  
  /** When the plan was last updated */
  updatedAt: Date;
  
  /** Areas targeted for improvement */
  targetAreas: ImprovementAreaType[];
  
  /** Overall priority of the plan */
  priority: ImprovementPriority;
  
  /** Specific improvements to make */
  improvements: {
    area: ImprovementAreaType;
    description: string;
    priority: ImprovementPriority;
    expectedOutcome: string;
  }[];
  
  /** Success metrics to track */
  successMetrics: string[];
  
  /** Plan status */
  status: 'draft' | 'active' | 'completed' | 'abandoned';
  
  /** Expected completion timeline in days */
  timelineInDays: number;
  
  /** Plan source (what prompted the plan creation) */
  source: 'reflection' | 'feedback' | 'evaluation' | 'manual';
  
  /** Progress (0-100%) */
  progress: number;
}

/**
 * Learning activity for improvement
 */
export interface LearningActivity {
  /** Unique ID for the activity */
  id: string;
  
  /** Related improvement plan ID */
  planId: string;
  
  /** Human-readable name */
  name: string;
  
  /** Detailed description */
  description: string;
  
  /** Type of activity */
  type: 'study' | 'practice' | 'analyze' | 'experiment' | 'review';
  
  /** Related improvement area */
  area: ImprovementAreaType;
  
  /** Status of the activity */
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  
  /** Start time if in progress or completed */
  startTime?: Date;
  
  /** Completion time if completed */
  completionTime?: Date;
  
  /** Expected outcome from this activity */
  expectedOutcome: string;
  
  /** Actual outcome after completion */
  actualOutcome?: string;
  
  /** Resources used in this activity */
  resources?: string[];
  
  /** Success rating (0-100%) if completed */
  successRating?: number;
  
  /** Lessons learned */
  lessonsLearned?: string[];
}

/**
 * Learning outcome from improvement activities
 */
export interface LearningOutcome {
  /** Unique ID for the outcome */
  id: string;
  
  /** Related improvement plan ID */
  planId: string;
  
  /** Related activity IDs that led to this outcome */
  activityIds: string[];
  
  /** Type of learning outcome */
  type: LearningOutcomeType;
  
  /** Description of what was learned */
  description: string;
  
  /** When the outcome was recorded */
  timestamp: Date;
  
  /** Confidence in the outcome (0-100%) */
  confidence: number;
  
  /** How the outcome was validated */
  validationMethod?: string;
  
  /** Areas this outcome affects */
  affectedAreas: ImprovementAreaType[];
  
  /** Whether this outcome has been applied to behavior */
  appliedToBehavior: boolean;
  
  /** Impact rating after application (0-100%) */
  impactRating?: number;
}

/**
 * Progress report for improvement plans
 */
export interface ImprovementProgressReport {
  /** Plan ID */
  planId: string;
  
  /** Plan name */
  planName: string;
  
  /** Overall progress percentage */
  overallProgress: number;
  
  /** Progress by area */
  progressByArea: Record<ImprovementAreaType, number>;
  
  /** Active learning activities */
  activeActivities: LearningActivity[];
  
  /** Completed learning activities */
  completedActivities: LearningActivity[];
  
  /** Learning outcomes achieved */
  outcomes: LearningOutcome[];
  
  /** Metrics improvements */
  metricsImprovements: Record<string, { before: number; after: number }>;
  
  /** Challenges encountered */
  challenges: string[];
  
  /** Recommendations for adjustments */
  recommendations: string[];
  
  /** Report generation timestamp */
  timestamp: Date;
}

/**
 * Self-improvement capability interface
 */
export interface SelfImprovement {
  /**
   * Create a self-improvement plan
   * 
   * @param plan Plan details excluding ID and timestamps
   * @returns Created plan with ID and timestamps
   */
  createImprovementPlan(
    plan: Omit<SelfImprovementPlan, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<SelfImprovementPlan>;
  
  /**
   * Get a self-improvement plan by ID
   * 
   * @param planId Plan ID
   * @returns Plan or null if not found
   */
  getImprovementPlan(planId: string): Promise<SelfImprovementPlan | null>;
  
  /**
   * Update a self-improvement plan
   * 
   * @param planId Plan ID to update
   * @param updates Updates to apply
   * @returns Updated plan
   */
  updateImprovementPlan(
    planId: string,
    updates: Partial<Omit<SelfImprovementPlan, 'id' | 'createdAt'>>
  ): Promise<SelfImprovementPlan>;
  
  /**
   * List improvement plans
   * 
   * @param options Filtering options
   * @returns Matching plans
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
   * 
   * @param activity Activity details excluding ID
   * @returns Created activity with ID
   */
  createLearningActivity(
    activity: Omit<LearningActivity, 'id'>
  ): Promise<LearningActivity>;
  
  /**
   * Get a learning activity by ID
   * 
   * @param activityId Activity ID
   * @returns Activity or null if not found
   */
  getLearningActivity(activityId: string): Promise<LearningActivity | null>;
  
  /**
   * Update a learning activity
   * 
   * @param activityId Activity ID to update
   * @param updates Updates to apply
   * @returns Updated activity
   */
  updateLearningActivity(
    activityId: string,
    updates: Partial<Omit<LearningActivity, 'id'>>
  ): Promise<LearningActivity>;
  
  /**
   * List learning activities
   * 
   * @param options Filtering options
   * @returns Matching activities
   */
  listLearningActivities(options?: {
    planId?: string;
    status?: LearningActivity['status'][];
    type?: LearningActivity['type'][];
    area?: ImprovementAreaType[];
  }): Promise<LearningActivity[]>;
  
  /**
   * Record a learning outcome
   * 
   * @param outcome Outcome details excluding ID
   * @returns Recorded outcome with ID
   */
  recordLearningOutcome(
    outcome: Omit<LearningOutcome, 'id' | 'timestamp'>
  ): Promise<LearningOutcome>;
  
  /**
   * Get a learning outcome by ID
   * 
   * @param outcomeId Outcome ID
   * @returns Outcome or null if not found
   */
  getLearningOutcome(outcomeId: string): Promise<LearningOutcome | null>;
  
  /**
   * Update a learning outcome
   * 
   * @param outcomeId Outcome ID to update
   * @param updates Updates to apply
   * @returns Updated outcome
   */
  updateLearningOutcome(
    outcomeId: string,
    updates: Partial<Omit<LearningOutcome, 'id' | 'timestamp'>>
  ): Promise<LearningOutcome>;
  
  /**
   * List learning outcomes
   * 
   * @param options Filtering options
   * @returns Matching outcomes
   */
  listLearningOutcomes(options?: {
    planId?: string;
    type?: LearningOutcomeType[];
    area?: ImprovementAreaType[];
    minConfidence?: number;
    appliedToBehavior?: boolean;
  }): Promise<LearningOutcome[]>;
  
  /**
   * Generate an improvement progress report
   * 
   * @param planId Plan ID to report on
   * @param options Report options
   * @returns Generated report
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
   * Apply learning outcomes to adjust behavior
   * 
   * @param outcomeIds Outcome IDs to apply
   * @returns Whether application was successful
   */
  applyLearningOutcomes(outcomeIds: string[]): Promise<boolean>;
  
  /**
   * Generate a new improvement plan based on reflection insights
   * 
   * @param reflectionIds Reflection IDs to use as basis
   * @param options Plan generation options
   * @returns Generated plan
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