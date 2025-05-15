/**
 * EnhancedReflectionManager.ts - Implementation of an enhanced reflection manager
 * 
 * This implementation properly follows the architecture guidelines by using
 * composition instead of inheritance, and maintains correct typing throughout.
 */

import { v4 as uuidv4 } from 'uuid';
import { AbstractBaseManager } from '../../base/managers/BaseManager';
import { AgentBase } from '../../base/AgentBase.interface';
import { ManagerType } from '../../base/managers/ManagerType';
import { 
  ReflectionManager, 
  ReflectionManagerConfig,
  Reflection,
  ReflectionInsight,
  ReflectionResult,
  ReflectionTrigger,
  ImprovementAction,
  ReflectionStrategy,
  KnowledgeGap,
  PerformanceMetrics
} from '../../base/managers/ReflectionManager.interface';
import { DefaultReflectionManager } from './DefaultReflectionManager';
import { createConfigFactory } from '../../config';
import { ReflectionManagerConfigSchema } from '../config/ReflectionManagerConfigSchema';
import { 
  ImprovementAreaType,
  ImprovementPriority,
  LearningOutcomeType,
  SelfImprovementPlan,
  LearningActivity,
  LearningOutcome,
  ImprovementProgressReport
} from '../interfaces/SelfImprovement.interface';
import {
  PeriodicTaskResult,
  PeriodicTaskStatus,
  PeriodicTaskType,
  PeriodicTask
} from '../../tasks/PeriodicTaskRunner.interface';
import { DefaultPeriodicTaskRunner } from '../../tasks/DefaultPeriodicTaskRunner';
import { ManagerHealth } from '../../base/managers/ManagerHealth';

/**
 * Interface for periodic reflection tasks 
 * Extends the PeriodicTask interface with reflection-specific parameters
 */
export interface PeriodicReflectionTask extends PeriodicTask {
  /** Task parameters specific to reflections */
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
 * Error class for enhanced reflection manager
 */
class EnhancedReflectionError extends Error {
  public readonly code: string;
  public readonly context: Record<string, unknown>;

  constructor(message: string, code = 'ENHANCED_REFLECTION_ERROR', context: Record<string, unknown> = {}) {
    super(message);
    this.name = 'EnhancedReflectionError';
    this.code = code;
    this.context = context;
  }
}

/**
 * Enhanced implementation of the ReflectionManager interface with self-improvement capabilities
 * and periodic reflection features.
 * 
 * This implementation uses composition rather than inheritance to leverage base functionality.
 */
export class EnhancedReflectionManager extends AbstractBaseManager implements ReflectionManager {
  // Use composition instead of inheritance
  private baseReflectionManager: ReflectionManager;
  
  // Configuration factory
  private configFactory = createConfigFactory(ReflectionManagerConfigSchema);
  
  // Self-improvement data structures
  private improvementPlans: Map<string, SelfImprovementPlan> = new Map();
  private learningActivities: Map<string, LearningActivity> = new Map();
  private learningOutcomes: Map<string, LearningOutcome> = new Map();
  
  // Periodic reflection task runner
  private periodicTaskRunner: DefaultPeriodicTaskRunner;
  
  // Maps to track periodic reflection tasks
  private reflectionTasks: Map<string, PeriodicReflectionTask> = new Map();
  
  // Logger for task runner
  protected logger: Console = console;
  
  // Override config type to use specific config type
  protected config!: ReflectionManagerConfig;
  
  /**
   * Create a new EnhancedReflectionManager
   */
  constructor(
    agent: AgentBase,
    config: Partial<ReflectionManagerConfig> = {}
  ) {
    super(
      `enhanced-reflection-manager-${uuidv4()}`,
      ManagerType.REFLECTION,
      agent,
      { enabled: true }
    );
    
    // Create default configuration with required values
    const defaultReflectionFrequency = {
      minIntervalMs: 60000, 
      interval: 3600000, 
      afterEachInteraction: false,
      afterErrors: true
    };
    
    const defaultConfig = {
      enabled: true,
      reflectionDepth: 'standard' as 'light' | 'standard' | 'deep',
      adaptiveBehavior: true,
      adaptationRate: 0.3,
      reflectionFrequency: defaultReflectionFrequency,
      persistReflections: true,
      maxHistoryItems: 100
    };
    
    // Merge the provided config with defaults, ensuring required fields exist
    const mergedConfig = {
      ...defaultConfig,
      ...config,
      reflectionFrequency: {
        ...defaultReflectionFrequency,
        ...(config.reflectionFrequency || {})
      }
    };
    
    // Validate and apply configuration
    this.config = this.configFactory.create(mergedConfig) as ReflectionManagerConfig;
    
    // Create the base reflection manager (composition instead of inheritance)
    this.baseReflectionManager = new DefaultReflectionManager(agent, this.config);
    
    // Initialize the task runner for periodic reflections
    this.periodicTaskRunner = new DefaultPeriodicTaskRunner({
      logger: this.logger,
      checkIntervalMs: 60000 // Check for due tasks every minute
    });
    
    // Set up default periodic reflection if enabled
    if (this.config.enablePeriodicReflections && this.config.periodicReflectionSchedule) {
      const scheduleStr = String(this.config.periodicReflectionSchedule);
      this.schedulePeriodicReflection(
        scheduleStr,
        {
          name: 'Default daily reflection',
          depth: this.config.reflectionDepth,
          focusAreas: []
        }
      ).catch(error => {
        console.error('Failed to schedule default periodic reflection:', error);
      });
    }
  }
  
  /**
   * Initialize the manager
   */
  async initialize(): Promise<boolean> {
    console.log(`[${this.managerId}] Initializing ${this.managerType} manager`);
    
    // First initialize the base reflection manager
    const baseInitialized = await this.baseReflectionManager.initialize();
    if (!baseInitialized) {
      return false;
    }
    
    // Set up any additional initialization for self-improvement and periodic reflections
    if (this.config.enableSelfImprovement) {
      try {
        await this.loadSelfImprovementData();
      } catch (error) {
        console.warn('Failed to load self-improvement data:', error);
      }
    }
    
    this._initialized = true;
    return true;
  }
  
  /**
   * Shutdown the manager
   */
  async shutdown(): Promise<void> {
    console.log(`[${this.managerId}] Shutting down ${this.managerType} manager`);
    
    // Stop the periodic task runner
    this.periodicTaskRunner.stop();
    
    // Persist self-improvement data if enabled
    if (this.config.enableSelfImprovement && this.config.persistReflections) {
      try {
        await this.persistSelfImprovementData();
      } catch (error) {
        console.warn('Failed to persist self-improvement data during shutdown:', error);
      }
    }
    
    // Call base shutdown
    await this.baseReflectionManager.shutdown();
    
    this._initialized = false;
  }
  
  /**
   * Reset the manager
   */
  async reset(): Promise<boolean> {
    console.log(`[${this.managerId}] Resetting ${this.managerType} manager`);
    
    // Reset base manager
    await this.baseReflectionManager.reset();
    
    // Reset enhanced data structures
    this.improvementPlans.clear();
    this.learningActivities.clear();
    this.learningOutcomes.clear();
    this.reflectionTasks.clear();
    
    return true;
  }
  
  /**
   * Load self-improvement data
   * In a real implementation, this would load from persistent storage
   */
  private async loadSelfImprovementData(): Promise<void> {
    // This is a stub - in a real implementation, this would load from storage
    console.log('Loading self-improvement data');
  }
  
  /**
   * Persist self-improvement data
   * In a real implementation, this would save to persistent storage
   */
  private async persistSelfImprovementData(): Promise<void> {
    // This is a stub - in a real implementation, this would save to storage
    console.log('Persisting self-improvement data');
  }
  
  // #region Delegate methods to base reflection manager
  
  /**
   * Reflect on agent's performance, operations, or a specific topic
   */
  async reflect(trigger: ReflectionTrigger, context?: Record<string, unknown>): Promise<ReflectionResult> {
    return this.baseReflectionManager.reflect(trigger, context);
  }
  
  /**
   * Get a reflection by ID
   */
  async getReflection(id: string): Promise<Reflection | null> {
    return this.baseReflectionManager.getReflection(id);
  }
  
  /**
   * Get all reflections with optional filtering
   */
  async getReflections(options?: {
    limit?: number;
    offset?: number;
    sortBy?: 'timestamp' | 'trigger';
    sortDirection?: 'asc' | 'desc';
  }): Promise<Reflection[]> {
    return this.baseReflectionManager.getReflections(options);
  }
  
  /**
   * Create a new reflection
   */
  async createReflection(reflection: Omit<Reflection, 'id' | 'timestamp'>): Promise<Reflection> {
    return this.baseReflectionManager.createReflection(reflection);
  }
  
  /**
   * List reflections with optional filtering
   */
  async listReflections(options?: {
    trigger?: ReflectionTrigger[];
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
    sortBy?: 'timestamp' | 'trigger';
    sortDirection?: 'asc' | 'desc';
  }): Promise<Reflection[]> {
    return this.baseReflectionManager.listReflections(options);
  }
  
  /**
   * Get an insight by ID
   */
  async getInsight(id: string): Promise<ReflectionInsight | null> {
    return this.baseReflectionManager.getInsight(id);
  }
  
  /**
   * Get all insights with optional filtering
   */
  async getInsights(options?: {
    reflectionId?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'timestamp' | 'confidence' | 'type';
    sortDirection?: 'asc' | 'desc';
  }): Promise<ReflectionInsight[]> {
    return this.baseReflectionManager.getInsights(options);
  }
  
  /**
   * Get current metrics
   */
  async getMetrics(): Promise<Record<string, number>> {
    return this.baseReflectionManager.getMetrics();
  }
  
  /**
   * Set improvement goals
   */
  async setImprovementGoals(goals: string[]): Promise<boolean> {
    return this.baseReflectionManager.setImprovementGoals(goals);
  }
  
  /**
   * Get improvement goals
   */
  async getImprovementGoals(): Promise<string[]> {
    return this.baseReflectionManager.getImprovementGoals();
  }
  
  /**
   * Create an improvement action
   */
  async createImprovementAction(
    action: Omit<ImprovementAction, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ImprovementAction> {
    return this.baseReflectionManager.createImprovementAction(action);
  }
  
  /**
   * Get an improvement action by ID
   */
  async getImprovementAction(actionId: string): Promise<ImprovementAction | null> {
    return this.baseReflectionManager.getImprovementAction(actionId);
  }
  
  /**
   * Update an improvement action
   */
  async updateImprovementAction(
    actionId: string,
    updates: Partial<Omit<ImprovementAction, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ImprovementAction> {
    return this.baseReflectionManager.updateImprovementAction(actionId, updates);
  }
  
  /**
   * List improvement actions with optional filtering
   */
  async listImprovementActions(options?: {
    status?: ImprovementAction['status'][];
    targetArea?: ImprovementAction['targetArea'][];
    priority?: ImprovementAction['priority'][];
    minExpectedImpact?: number;
    limit?: number;
    offset?: number;
    sortBy?: 'createdAt' | 'priority' | 'expectedImpact' | 'difficulty';
    sortDirection?: 'asc' | 'desc';
  }): Promise<ImprovementAction[]> {
    return this.baseReflectionManager.listImprovementActions(options);
  }
  
  /**
   * Register a reflection strategy
   */
  async registerReflectionStrategy(
    strategy: Omit<ReflectionStrategy, 'id'>
  ): Promise<ReflectionStrategy> {
    return this.baseReflectionManager.registerReflectionStrategy(strategy);
  }
  
  /**
   * Get a reflection strategy by ID
   */
  async getReflectionStrategy(strategyId: string): Promise<ReflectionStrategy | null> {
    return this.baseReflectionManager.getReflectionStrategy(strategyId);
  }
  
  /**
   * Update a reflection strategy
   */
  async updateReflectionStrategy(
    strategyId: string,
    updates: Partial<Omit<ReflectionStrategy, 'id'>>
  ): Promise<ReflectionStrategy> {
    return this.baseReflectionManager.updateReflectionStrategy(strategyId, updates);
  }
  
  /**
   * List reflection strategies with optional filtering
   */
  async listReflectionStrategies(options?: {
    trigger?: ReflectionTrigger[];
    enabled?: boolean;
    sortBy?: 'priority' | 'name';
    sortDirection?: 'asc' | 'desc';
  }): Promise<ReflectionStrategy[]> {
    return this.baseReflectionManager.listReflectionStrategies(options);
  }
  
  /**
   * Enable or disable a reflection strategy
   */
  async setReflectionStrategyEnabled(
    strategyId: string,
    enabled: boolean
  ): Promise<ReflectionStrategy> {
    return this.baseReflectionManager.setReflectionStrategyEnabled(strategyId, enabled);
  }
  
  /**
   * Identify knowledge gaps
   */
  async identifyKnowledgeGaps(options?: {
    fromRecentInteractions?: boolean;
    fromReflectionIds?: string[];
    maxGaps?: number;
    minImpactLevel?: number;
  }): Promise<KnowledgeGap[]> {
    return this.baseReflectionManager.identifyKnowledgeGaps(options);
  }
  
  /**
   * Get a knowledge gap by ID
   */
  async getKnowledgeGap(gapId: string): Promise<KnowledgeGap | null> {
    return this.baseReflectionManager.getKnowledgeGap(gapId);
  }
  
  /**
   * Update a knowledge gap
   */
  async updateKnowledgeGap(
    gapId: string,
    updates: Partial<Omit<KnowledgeGap, 'id' | 'identifiedAt'>>
  ): Promise<KnowledgeGap> {
    return this.baseReflectionManager.updateKnowledgeGap(gapId, updates);
  }
  
  /**
   * List knowledge gaps with optional filtering
   */
  async listKnowledgeGaps(options?: {
    status?: KnowledgeGap['status'][];
    priority?: KnowledgeGap['priority'][];
    minImpactLevel?: number;
    limit?: number;
    offset?: number;
    sortBy?: 'identifiedAt' | 'priority' | 'impactLevel';
    sortDirection?: 'asc' | 'desc';
  }): Promise<KnowledgeGap[]> {
    return this.baseReflectionManager.listKnowledgeGaps(options);
  }
  
  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(options?: {
    fromDate?: Date;
    toDate?: Date;
    compareToPrevious?: boolean;
    include?: string[];
  }): Promise<PerformanceMetrics> {
    return this.baseReflectionManager.getPerformanceMetrics(options);
  }
  
  /**
   * Adapt agent behavior based on reflections
   */
  async adaptBehavior(options?: {
    fromReflectionIds?: string[];
    adaptationRate?: number;
    targetAreas?: string[];
  }): Promise<boolean> {
    return this.baseReflectionManager.adaptBehavior();
  }
  
  /**
   * Get statistics about the reflection process
   */
  async getStats(): Promise<Record<string, unknown>> {
    return this.baseReflectionManager.getStats();
  }
  
  // #endregion Delegate methods to base reflection manager
  
  // #region Self-improvement methods
  
  /**
   * Create a self-improvement plan
   */
  async createImprovementPlan(
    plan: Omit<SelfImprovementPlan, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<SelfImprovementPlan> {
    const id = uuidv4();
    const now = new Date();
    
    const newPlan: SelfImprovementPlan = {
      ...plan,
      id,
      createdAt: now,
      updatedAt: now
    };
    
    this.improvementPlans.set(id, newPlan);
    return newPlan;
  }
  
  /**
   * Get a self-improvement plan by ID
   */
  async getImprovementPlan(planId: string): Promise<SelfImprovementPlan | null> {
    return this.improvementPlans.get(planId) || null;
  }
  
  /**
   * Update a self-improvement plan
   */
  async updateImprovementPlan(
    planId: string,
    updates: Partial<Omit<SelfImprovementPlan, 'id' | 'createdAt'>>
  ): Promise<SelfImprovementPlan> {
    const existingPlan = this.improvementPlans.get(planId);
    
    if (!existingPlan) {
      throw new EnhancedReflectionError(`Plan ${planId} not found`, 'PLAN_NOT_FOUND');
    }
    
    const updatedPlan: SelfImprovementPlan = {
      ...existingPlan,
      ...updates,
      updatedAt: new Date()
    };
    
    this.improvementPlans.set(planId, updatedPlan);
    return updatedPlan;
  }
  
  /**
   * List improvement plans
   */
  async listImprovementPlans(options: {
    status?: SelfImprovementPlan['status'][];
    priority?: ImprovementPriority[];
    area?: ImprovementAreaType[];
    minProgress?: number;
    maxProgress?: number;
  } = {}): Promise<SelfImprovementPlan[]> {
    let plans = Array.from(this.improvementPlans.values());
    
    // Apply filters
    if (options.status && options.status.length > 0) {
      plans = plans.filter(plan => options.status?.includes(plan.status));
    }
    
    if (options.priority && options.priority.length > 0) {
      plans = plans.filter(plan => options.priority?.includes(plan.priority));
    }
    
    if (options.area && options.area.length > 0) {
      plans = plans.filter(plan => 
        plan.targetAreas.some(area => options.area?.includes(area))
      );
    }
    
    if (options.minProgress !== undefined) {
      plans = plans.filter(plan => plan.progress >= options.minProgress!);
    }
    
    if (options.maxProgress !== undefined) {
      plans = plans.filter(plan => plan.progress <= options.maxProgress!);
    }
    
    // Sort by priority (highest first) then creation date (newest first)
    return plans.sort((a, b) => {
      // Sort by priority
      const priorityOrder = { 
        [ImprovementPriority.CRITICAL]: 0, 
        [ImprovementPriority.HIGH]: 1, 
        [ImprovementPriority.MEDIUM]: 2, 
        [ImprovementPriority.LOW]: 3 
      };
      
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      
      // Then by creation date (newest first)
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }
  
  /**
   * Create a learning activity
   */
  async createLearningActivity(
    activity: Omit<LearningActivity, 'id'>
  ): Promise<LearningActivity> {
    const id = uuidv4();
    
    const newActivity: LearningActivity = {
      ...activity,
      id
    };
    
    this.learningActivities.set(id, newActivity);
    
    // Update plan progress
    await this.updatePlanProgressFromActivities(activity.planId);
    
    return newActivity;
  }
  
  /**
   * Get a learning activity by ID
   */
  async getLearningActivity(activityId: string): Promise<LearningActivity | null> {
    return this.learningActivities.get(activityId) || null;
  }
  
  /**
   * Update a learning activity
   */
  async updateLearningActivity(
    activityId: string,
    updates: Partial<Omit<LearningActivity, 'id'>>
  ): Promise<LearningActivity> {
    const existingActivity = this.learningActivities.get(activityId);
    
    if (!existingActivity) {
      throw new EnhancedReflectionError(`Activity ${activityId} not found`, 'ACTIVITY_NOT_FOUND');
    }
    
    const updatedActivity: LearningActivity = {
      ...existingActivity,
      ...updates
    };
    
    this.learningActivities.set(activityId, updatedActivity);
    
    // Update plan progress if status has changed
    if (updates.status && updates.status !== existingActivity.status) {
      await this.updatePlanProgressFromActivities(existingActivity.planId);
    }
    
    return updatedActivity;
  }
  
  /**
   * List learning activities
   */
  async listLearningActivities(options: {
    planId?: string;
    status?: LearningActivity['status'][];
    type?: LearningActivity['type'][];
    area?: ImprovementAreaType[];
  } = {}): Promise<LearningActivity[]> {
    let activities = Array.from(this.learningActivities.values());
    
    // Apply filters
    if (options.planId) {
      activities = activities.filter(activity => activity.planId === options.planId);
    }
    
    if (options.status && options.status.length > 0) {
      activities = activities.filter(activity => options.status?.includes(activity.status));
    }
    
    if (options.type && options.type.length > 0) {
      activities = activities.filter(activity => options.type?.includes(activity.type));
    }
    
    if (options.area && options.area.length > 0) {
      activities = activities.filter(activity => options.area?.includes(activity.area));
    }
    
    // Sort by status (in progress first, then pending, then completed, then failed)
    return activities.sort((a, b) => {
      const statusOrder = {
        'in_progress': 0,
        'pending': 1,
        'completed': 2,
        'failed': 3
      };
      
      return statusOrder[a.status] - statusOrder[b.status];
    });
  }
  
  /**
   * Record a learning outcome
   */
  async recordLearningOutcome(
    outcome: Omit<LearningOutcome, 'id' | 'timestamp'>
  ): Promise<LearningOutcome> {
    const id = uuidv4();
    const timestamp = new Date();
    
    const newOutcome: LearningOutcome = {
      ...outcome,
      id,
      timestamp
    };
    
    this.learningOutcomes.set(id, newOutcome);
    return newOutcome;
  }
  
  /**
   * Get a learning outcome by ID
   */
  async getLearningOutcome(outcomeId: string): Promise<LearningOutcome | null> {
    return this.learningOutcomes.get(outcomeId) || null;
  }
  
  /**
   * Update a learning outcome
   */
  async updateLearningOutcome(
    outcomeId: string,
    updates: Partial<Omit<LearningOutcome, 'id' | 'timestamp'>>
  ): Promise<LearningOutcome> {
    const existingOutcome = this.learningOutcomes.get(outcomeId);
    
    if (!existingOutcome) {
      throw new EnhancedReflectionError(`Outcome ${outcomeId} not found`, 'OUTCOME_NOT_FOUND');
    }
    
    const updatedOutcome: LearningOutcome = {
      ...existingOutcome,
      ...updates
    };
    
    this.learningOutcomes.set(outcomeId, updatedOutcome);
    return updatedOutcome;
  }
  
  /**
   * List learning outcomes
   */
  async listLearningOutcomes(options: {
    planId?: string;
    type?: LearningOutcomeType[];
    area?: ImprovementAreaType[];
    minConfidence?: number;
    appliedToBehavior?: boolean;
  } = {}): Promise<LearningOutcome[]> {
    let outcomes = Array.from(this.learningOutcomes.values());
    
    // Apply filters
    if (options.planId) {
      outcomes = outcomes.filter(outcome => outcome.planId === options.planId);
    }
    
    if (options.type && options.type.length > 0) {
      outcomes = outcomes.filter(outcome => options.type?.includes(outcome.type));
    }
    
    if (options.area && options.area.length > 0) {
      outcomes = outcomes.filter(outcome => 
        outcome.affectedAreas.some(area => options.area?.includes(area))
      );
    }
    
    if (options.minConfidence !== undefined) {
      outcomes = outcomes.filter(outcome => outcome.confidence >= options.minConfidence!);
    }
    
    if (options.appliedToBehavior !== undefined) {
      outcomes = outcomes.filter(outcome => outcome.appliedToBehavior === options.appliedToBehavior);
    }
    
    // Sort by timestamp (newest first)
    return outcomes.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
  
  /**
   * Generate a progress report for an improvement plan
   */
  async generateProgressReport(
    planId: string,
    options: {
      includeActivities?: boolean;
      includeOutcomes?: boolean;
      includeMetrics?: boolean;
      includeRecommendations?: boolean;
    } = {}
  ): Promise<ImprovementProgressReport> {
    const plan = await this.getImprovementPlan(planId);
    
    if (!plan) {
      throw new EnhancedReflectionError(`Plan ${planId} not found`, 'PLAN_NOT_FOUND');
    }
    
    // Get activities for this plan
    const allActivities = await this.listLearningActivities({ planId });
    const activeActivities = allActivities.filter(a => a.status === 'in_progress' || a.status === 'pending');
    const completedActivities = allActivities.filter(a => a.status === 'completed');
    
    // Get outcomes for this plan
    const outcomes = await this.listLearningOutcomes({ planId });
    
    // Calculate progress by area
    const progressByArea: Record<ImprovementAreaType, number> = {} as Record<ImprovementAreaType, number>;
    
    // Initialize all areas to 0%
    for (const area of plan.targetAreas) {
      progressByArea[area] = 0;
    }
    
    // Calculate progress for each area
    for (const area of plan.targetAreas) {
      const areaActivities = allActivities.filter(a => a.area === area);
      if (areaActivities.length === 0) continue;
      
      const completed = areaActivities.filter(a => a.status === 'completed').length;
      progressByArea[area] = (completed / areaActivities.length) * 100;
    }
    
    // Generate metrics improvements
    const metricsImprovements: Record<string, { before: number; after: number }> = {};
    
    // Placeholder - in real implementation, would calculate actual metrics changes
    for (const metric of plan.successMetrics) {
      metricsImprovements[metric] = {
        before: 0.5,
        after: 0.7
      };
    }
    
    // Generate challenges
    const challenges: string[] = [];
    
    // Add failed activities as challenges
    const failedActivities = allActivities.filter(a => a.status === 'failed');
    for (const activity of failedActivities) {
      challenges.push(`Failed to complete activity: ${activity.name} in area ${activity.area}`);
    }
    
    // Generate recommendations
    const recommendations: string[] = [];
    
    // Add recommendations based on incomplete activities
    if (activeActivities.length > 0) {
      recommendations.push(`Focus on completing ${activeActivities.length} in-progress activities.`);
    }
    
    // Generate the report
    const report: ImprovementProgressReport = {
      planId,
      generatedAt: new Date(),
      overallProgress: plan.progress,
      progressByArea,
      activeActivities: options.includeActivities ? activeActivities : undefined,
      completedActivities: options.includeActivities ? completedActivities : undefined,
      outcomes: options.includeOutcomes ? outcomes : undefined,
      metricsImprovements: options.includeMetrics ? metricsImprovements : undefined,
      challenges,
      recommendations: options.includeRecommendations ? recommendations : undefined
    };
    
    return report;
  }
  
  /**
   * Apply learning outcomes to agent behavior
   */
  async applyLearningOutcomes(outcomeIds: string[]): Promise<boolean> {
    // Validate that all outcomes exist
    const outcomes: LearningOutcome[] = [];
    
    for (const outcomeId of outcomeIds) {
      const outcome = await this.getLearningOutcome(outcomeId);
      if (!outcome) {
        throw new EnhancedReflectionError(`Outcome ${outcomeId} not found`, 'OUTCOME_NOT_FOUND');
      }
      outcomes.push(outcome);
    }
    
    // In a real implementation, this would modify agent behavior
    // based on the learning outcomes. This is a placeholder.
    
    // Mark outcomes as applied
    for (const outcome of outcomes) {
      await this.updateLearningOutcome(outcome.id, {
        appliedToBehavior: true,
        appliedAt: new Date()
      });
    }
    
    // Call adapt behavior on base reflection manager as well
    await this.adaptBehavior({
      adaptationRate: this.config.adaptationRate
    });
    
    return true;
  }
  
  /**
   * Generate an improvement plan from reflections
   */
  async generateImprovementPlanFromReflections(
    reflectionIds: string[],
    options: {
      priorityThreshold?: ImprovementPriority;
      maxImprovements?: number;
      focusAreas?: ImprovementAreaType[];
    } = {}
  ): Promise<SelfImprovementPlan> {
    // Validate that all reflections exist
    const reflections: Reflection[] = [];
    
    for (const reflectionId of reflectionIds) {
      const reflection = await this.getReflection(reflectionId);
      if (!reflection) {
        throw new EnhancedReflectionError(`Reflection ${reflectionId} not found`, 'REFLECTION_NOT_FOUND');
      }
      reflections.push(reflection);
    }
    
    // Get all insights from these reflections
    const insights: ReflectionInsight[] = [];
    
    for (const reflection of reflections) {
      const reflectionInsights = await this.getInsights({ reflectionId: reflection.id });
      insights.push(...reflectionInsights);
    }
    
    // Filter insights by confidence
    const highConfidenceInsights = insights.filter(insight => insight.confidence >= 0.7);
    
    // In a real implementation, we would analyze the insights to identify
    // improvement areas, priorities, and activities. This is a placeholder.
    
    // Generate the plan
    const planId = uuidv4();
    const now = new Date();
    
    const targetAreas: ImprovementAreaType[] = options.focusAreas || [
      ImprovementAreaType.SKILL, 
      ImprovementAreaType.KNOWLEDGE
    ];
    
    // Create the plan
    const plan: SelfImprovementPlan = {
      id: planId,
      name: `Improvement Plan based on ${reflections.length} reflections`,
      description: `Generated from ${insights.length} insights (${highConfidenceInsights.length} high confidence)`,
      createdAt: now,
      updatedAt: now,
      startDate: now,
      endDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
      sourceReflectionIds: reflectionIds,
      targetAreas,
      status: 'active',
      priority: ImprovementPriority.HIGH,
      progress: 0,
      successMetrics: ['accuracy', 'efficiency', 'adaptability'],
      successCriteria: [
        'Improved performance in target areas',
        'Higher success rate in complex tasks'
      ]
    };
    
    // Store the plan
    this.improvementPlans.set(planId, plan);
    
    return plan;
  }
  
  /**
   * Update plan progress based on activities
   */
  private async updatePlanProgressFromActivities(planId: string): Promise<void> {
    const plan = await this.getImprovementPlan(planId);
    if (!plan) {
      return;
    }
    
    // Get all activities for this plan
    const activities = await this.listLearningActivities({ planId });
    
    if (activities.length === 0) {
      return;
    }
    
    // Calculate progress as the percentage of completed activities
    const completedCount = activities.filter(a => a.status === 'completed').length;
    const progress = completedCount / activities.length;
    
    // Update the plan
    await this.updateImprovementPlan(planId, { progress });
  }
  
  // #endregion Self-improvement methods
  
  // #region Periodic reflection methods
  
  /**
   * Schedule a periodic reflection
   */
  async schedulePeriodicReflection(
    scheduleStr: string,
    options: {
      name?: string;
      depth?: 'light' | 'standard' | 'deep';
      focusAreas?: string[];
      strategies?: string[];
      context?: Record<string, unknown>;
    }
  ): Promise<PeriodicReflectionTask> {
    if (!this._initialized) {
      throw new EnhancedReflectionError(
        'Cannot schedule reflection: Manager not initialized',
        'NOT_INITIALIZED'
      );
    }
    
    const taskId = uuidv4();
    const now = new Date();
    
    // Create the task with the proper PeriodicTask properties
    const task: PeriodicReflectionTask = {
      id: taskId,
      name: options.name || `Periodic Reflection ${taskId.substr(0, 8)}`,
      type: PeriodicTaskType.CUSTOM,
      nextRunTime: new Date(now.getTime() + 3600000), // Default to 1 hour from now
      status: PeriodicTaskStatus.PENDING,
      createdAt: now,
      updatedAt: now,
      enabled: true,
      parameters: {
        depth: options.depth || this.config.reflectionDepth,
        focusAreas: options.focusAreas || [],
        strategies: options.strategies || [],
        context: options.context || {}
      }
    };
    
    // Store the task in our internal map
    this.reflectionTasks.set(taskId, task);
    
    // Create a task handler function
    const taskHandler = async (): Promise<Record<string, unknown>> => {
      const result = await this.runPeriodicReflectionTask(taskId);
      return { 
        success: result.success,
        reflectionId: result.result && typeof result.result === 'object' ? 
          (result.result as Record<string, unknown>).reflectionId : undefined
      };
    };
    
    // In a real implementation, we would register with task runner
    // For now, log it and create a mock implementation
    console.log(`Scheduling periodic reflection task ${taskId} with schedule '${scheduleStr}'`);
    
    // Mock task registration for now until proper implementation
    setTimeout(() => {
      this.logger.log(`Running scheduled task ${taskId} as a demo`);
      taskHandler().catch(err => {
        this.logger.error(`Error running scheduled task ${taskId}:`, err);
      });
    }, 10000); // Run after 10 seconds as a demo
    
    return task;
  }
  
  /**
   * Get a periodic reflection task by ID
   */
  async getPeriodicReflectionTask(taskId: string): Promise<PeriodicReflectionTask | null> {
    return this.reflectionTasks.get(taskId) || null;
  }
  
  /**
   * Update a periodic reflection task
   */
  async updatePeriodicReflectionTask(
    taskId: string,
    updates: Partial<Omit<PeriodicReflectionTask, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<PeriodicReflectionTask> {
    const existingTask = this.reflectionTasks.get(taskId);
    
    if (!existingTask) {
      throw new EnhancedReflectionError(`Task ${taskId} not found`, 'TASK_NOT_FOUND');
    }
    
    const updatedTask: PeriodicReflectionTask = {
      ...existingTask,
      ...updates,
      updatedAt: new Date()
    };
    
    // Update the task in our map
    this.reflectionTasks.set(taskId, updatedTask);
    
    // In a real implementation, we would update the task in the task runner
    console.log(`Updated periodic reflection task ${taskId}`);
    
    return updatedTask;
  }
  
  /**
   * List periodic reflection tasks
   */
  async listPeriodicReflectionTasks(options: {
    enabled?: boolean;
    status?: PeriodicTaskStatus[];
    sortBy?: 'nextRunTime' | 'lastRunTime' | 'name';
    sortDirection?: 'asc' | 'desc';
  } = {}): Promise<PeriodicReflectionTask[]> {
    let tasks = Array.from(this.reflectionTasks.values());
    
    // Apply filters
    if (options.enabled !== undefined) {
      tasks = tasks.filter(task => task.enabled === options.enabled);
    }
    
    if (options.status && options.status.length > 0) {
      tasks = tasks.filter(task => options.status?.includes(task.status));
    }
    
    // Apply sorting
    if (options.sortBy) {
      tasks.sort((a, b) => {
        const direction = options.sortDirection === 'desc' ? -1 : 1;
        
        switch (options.sortBy) {
          case 'nextRunTime':
            if (!a.nextRunTime) return direction;
            if (!b.nextRunTime) return -direction;
            return direction * (a.nextRunTime.getTime() - b.nextRunTime.getTime());
            
          case 'lastRunTime':
            if (!a.lastRunTime) return direction;
            if (!b.lastRunTime) return -direction;
            return direction * (a.lastRunTime.getTime() - b.lastRunTime.getTime());
            
          case 'name':
            return direction * a.name.localeCompare(b.name);
            
          default:
            return 0;
        }
      });
    }
    
    return tasks;
  }
  
  /**
   * Run a periodic reflection task
   */
  async runPeriodicReflectionTask(
    taskId: string,
    options: {
      updateNextRunTime?: boolean;
      context?: Record<string, unknown>;
    } = {}
  ): Promise<PeriodicTaskResult> {
    const task = this.reflectionTasks.get(taskId);
    
    if (!task) {
      return {
        taskId,
        executionId: uuidv4(),
        success: false,
        error: `Task ${taskId} not found`,
        startTime: new Date(),
        endTime: new Date(),
        durationMs: 0,
        updatedTask: {
          id: taskId,
          name: 'Unknown Task',
          type: PeriodicTaskType.CUSTOM,
          status: PeriodicTaskStatus.FAILED,
          enabled: false,
          nextRunTime: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };
    }
    
    if (!task.enabled) {
      return {
        taskId,
        executionId: uuidv4(),
        success: false,
        error: `Task ${taskId} is disabled`,
        startTime: new Date(),
        endTime: new Date(),
        durationMs: 0,
        updatedTask: {
          ...task,
          status: PeriodicTaskStatus.SKIPPED
        }
      };
    }
    
    const startTime = new Date();
    const executionId = uuidv4();
    
    try {
      // Update task status
      task.status = PeriodicTaskStatus.RUNNING;
      task.lastRunTime = startTime;
      
      // Combine task context with additional context
      const context = {
        ...task.parameters.context,
        ...options.context,
        taskId,
        taskName: task.name,
        scheduled: true
      };
      
      // Run the reflection - convert trigger to the proper ReflectionTrigger enum
      const reflection = await this.reflect(ReflectionTrigger.PERIODIC, context);
      
      // Update task status
      task.status = PeriodicTaskStatus.COMPLETED;
      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();
      
      // Calculate next run time (in a real implementation)
      const nextRunTime = new Date(endTime.getTime() + 24 * 60 * 60 * 1000); // 1 day later
      task.nextRunTime = nextRunTime;
      
      // Create the result
      const result: PeriodicTaskResult = {
        success: reflection.success,
        taskId,
        executionId,
        startTime,
        endTime,
        durationMs,
        result: {
          reflectionId: reflection.id,
          insightCount: reflection.insights.length
        },
        updatedTask: {
          ...task,
          lastRunTime: endTime,
          nextRunTime
        }
      };
      
      // Update the task
      this.reflectionTasks.set(taskId, task);
      
      return result;
    } catch (error) {
      // Update task status
      task.status = PeriodicTaskStatus.FAILED;
      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();
      
      // Create the result
      const result: PeriodicTaskResult = {
        success: false,
        taskId,
        executionId,
        startTime,
        endTime,
        durationMs,
        error: error instanceof Error ? error.message : String(error),
        updatedTask: {
          ...task,
          lastRunTime: endTime,
          lastError: error instanceof Error ? error.message : String(error)
        }
      };
      
      // Update the task
      this.reflectionTasks.set(taskId, task);
      
      return result;
    }
  }
  
  /**
   * Enable or disable a periodic reflection task
   */
  async setPeriodicReflectionTaskEnabled(
    taskId: string,
    enabled: boolean
  ): Promise<PeriodicReflectionTask> {
    return this.updatePeriodicReflectionTask(taskId, { enabled });
  }
  
  /**
   * Delete a periodic reflection task
   */
  async deletePeriodicReflectionTask(taskId: string): Promise<boolean> {
    // Remove from our map
    const removed = this.reflectionTasks.delete(taskId);
    
    // In a real implementation, we would unregister from task runner
    console.log(`Deleted periodic reflection task ${taskId}`);
    
    return removed;
  }
  
  // #endregion Periodic reflection methods

  /**
   * Get manager health status
   */
  async getHealth(): Promise<ManagerHealth> {
    if (!this._initialized) {
      return {
        status: 'degraded',
        details: {
          lastCheck: new Date(),
          issues: [{
            severity: 'high',
            message: 'Enhanced reflection manager not initialized',
            detectedAt: new Date()
          }],
          metrics: {}
        }
      };
    }

    // Get base manager health
    const baseHealth = await this.baseReflectionManager.getHealth();
    
    // Get enhanced manager stats
    const stats = await this.getStats();
    const periodicTasks = await this.periodicTaskRunner.listPeriodicTasks();
    const runningTasks = periodicTasks.filter(t => t.status === PeriodicTaskStatus.RUNNING);
    const isRunning = runningTasks.length > 0;

    // Combine issues and metrics
    const issues = [
      ...baseHealth.details.issues,
      ...(this.config.enablePeriodicReflections && !isRunning ? [{
        severity: 'medium' as const,
        message: 'No periodic reflection tasks are currently running',
        detectedAt: new Date()
      }] : [])
    ];

    return {
      status: issues.some(i => i.severity === 'critical') ? 'unhealthy' :
             issues.some(i => i.severity === 'high') ? 'degraded' : 'healthy',
      details: {
        lastCheck: new Date(),
        issues,
        metrics: {
          ...baseHealth.details.metrics,
          ...stats,
          periodicTasks: {
            isRunning,
            totalTasks: periodicTasks.length,
            runningTasks: periodicTasks.filter(t => t.status === PeriodicTaskStatus.RUNNING).length,
            pendingTasks: periodicTasks.filter(t => t.status === PeriodicTaskStatus.PENDING).length,
            completedTasks: periodicTasks.filter(t => t.status === PeriodicTaskStatus.COMPLETED).length,
            failedTasks: periodicTasks.filter(t => t.status === PeriodicTaskStatus.FAILED).length
          },
          selfImprovement: {
            improvementPlans: this.improvementPlans.size,
            learningActivities: this.learningActivities.size,
            learningOutcomes: this.learningOutcomes.size
          }
        }
      }
    };
  }
} 