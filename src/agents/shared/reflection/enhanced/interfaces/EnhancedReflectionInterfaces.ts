/**
 * Enhanced Reflection System Interfaces
 * 
 * Core interfaces for the enhanced reflection system components.
 * Following @IMPLEMENTATION_GUIDELINES.md with strict typing and ULID identifiers.
 */

import { ulid } from 'ulid';
import { 
  ReflectionManager,
  Reflection,
  ReflectionInsight,
  ReflectionResult,
  ReflectionTrigger,
  ImprovementAction,
  ReflectionStrategy,
  KnowledgeGap,
  PerformanceMetrics
} from '../../../base/managers/ReflectionManager.interface';
import { PeriodicTask, PeriodicTaskResult, PeriodicTaskStatus } from '../../../tasks/PeriodicTaskRunner.interface';

// ============================================================================
// Core Enhanced Reflection Types
// ============================================================================

export interface EnhancedReflectionManager extends ReflectionManager {
  // Self-improvement plan management
  createImprovementPlan(plan: Omit<SelfImprovementPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<SelfImprovementPlan>;
  getImprovementPlan(planId: string): Promise<SelfImprovementPlan | null>;
  updateImprovementPlan(planId: string, updates: Partial<Omit<SelfImprovementPlan, 'id' | 'createdAt'>>): Promise<SelfImprovementPlan>;
  listImprovementPlans(options?: ImprovementPlanListOptions): Promise<SelfImprovementPlan[]>;
  
  // Learning activity management
  createLearningActivity(activity: Omit<LearningActivity, 'id'>): Promise<LearningActivity>;
  getLearningActivity(activityId: string): Promise<LearningActivity | null>;
  updateLearningActivity(activityId: string, updates: Partial<Omit<LearningActivity, 'id'>>): Promise<LearningActivity>;
  listLearningActivities(options?: LearningActivityListOptions): Promise<LearningActivity[]>;
  
  // Learning outcome management
  recordLearningOutcome(outcome: Omit<LearningOutcome, 'id' | 'timestamp'>): Promise<LearningOutcome>;
  getLearningOutcome(outcomeId: string): Promise<LearningOutcome | null>;
  updateLearningOutcome(outcomeId: string, updates: Partial<Omit<LearningOutcome, 'id' | 'timestamp'>>): Promise<LearningOutcome>;
  listLearningOutcomes(options?: LearningOutcomeListOptions): Promise<LearningOutcome[]>;
  
  // Periodic reflection management
  schedulePeriodicReflection(schedule: string, options: PeriodicReflectionOptions): Promise<PeriodicReflectionTask>;
  getPeriodicReflectionTask(taskId: string): Promise<PeriodicReflectionTask | null>;
  updatePeriodicReflectionTask(taskId: string, updates: Partial<Omit<PeriodicReflectionTask, 'id' | 'createdAt' | 'updatedAt'>>): Promise<PeriodicReflectionTask>;
  listPeriodicReflectionTasks(options?: PeriodicTaskListOptions): Promise<PeriodicReflectionTask[]>;
  runPeriodicReflectionTask(taskId: string, options?: TaskExecutionOptions): Promise<PeriodicTaskResult>;
  setPeriodicReflectionTaskEnabled(taskId: string, enabled: boolean): Promise<PeriodicReflectionTask>;
  deletePeriodicReflectionTask(taskId: string): Promise<boolean>;
  
  // Progress and analytics
  generateProgressReport(planId: string, options?: ProgressReportOptions): Promise<ImprovementProgressReport>;
  applyLearningOutcomes(outcomeIds: string[]): Promise<boolean>;
  generateImprovementPlanFromReflections(reflectionIds: string[], options?: PlanGenerationOptions): Promise<SelfImprovementPlan>;
}

// ============================================================================
// Self-Improvement Types
// ============================================================================

export enum ImprovementAreaType {
  KNOWLEDGE = 'knowledge',
  SKILL = 'skill', 
  BEHAVIOR = 'behavior',
  COMMUNICATION = 'communication',
  DECISION_MAKING = 'decision_making',
  PROBLEM_SOLVING = 'problem_solving',
  CREATIVITY = 'creativity',
  EFFICIENCY = 'efficiency',
  QUALITY = 'quality',
  COLLABORATION = 'collaboration'
}

export enum ImprovementPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export type LearningOutcomeType = 
  | 'knowledge_gained' 
  | 'skill_developed' 
  | 'behavior_changed' 
  | 'insight_discovered' 
  | 'pattern_recognized' 
  | 'strategy_learned';

export interface SelfImprovementPlan {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  startDate: Date;
  endDate: Date;
  sourceReflectionIds: string[];
  targetAreas: ImprovementAreaType[];
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  priority: ImprovementPriority;
  progress: number; // 0-1
  successMetrics: string[];
  successCriteria: string[];
  activities?: LearningActivity[];
  outcomes?: LearningOutcome[];
}

export interface LearningActivity {
  id: string;
  planId: string;
  name: string;
  description: string;
  type: 'reading' | 'practice' | 'experiment' | 'reflection' | 'discussion' | 'research' | 'training';
  area: ImprovementAreaType;
  status: 'planned' | 'in_progress' | 'completed' | 'skipped' | 'failed';
  priority: ImprovementPriority;
  estimatedDuration: number; // minutes
  actualDuration?: number; // minutes
  startDate?: Date;
  endDate?: Date;
  completedAt?: Date;
  resources: string[];
  prerequisites: string[];
  successCriteria: string[];
  notes?: string;
  metadata: Record<string, unknown>;
}

export interface LearningOutcome {
  id: string;
  planId: string;
  activityId?: string;
  type: LearningOutcomeType;
  area: ImprovementAreaType;
  description: string;
  timestamp: Date;
  confidence: number; // 0-1
  evidence: string[];
  appliedToBehavior: boolean;
  impactAssessment?: string;
  relatedInsightIds: string[];
  metadata: Record<string, unknown>;
}

// ============================================================================
// Periodic Reflection Types
// ============================================================================

export interface PeriodicReflectionTask extends PeriodicTask {
  parameters: {
    depth?: 'light' | 'standard' | 'deep';
    focusAreas?: string[];
    strategies?: string[];
    context?: Record<string, unknown>;
  };
}

export interface PeriodicReflectionOptions {
  name?: string;
  depth?: 'light' | 'standard' | 'deep';
  focusAreas?: string[];
  strategies?: string[];
  context?: Record<string, unknown>;
}

export interface TaskExecutionOptions {
  updateNextRunTime?: boolean;
  context?: Record<string, unknown>;
}

// ============================================================================
// Progress and Analytics Types
// ============================================================================

export interface ImprovementProgressReport {
  planId: string;
  generatedAt: Date;
  timeRange: {
    start: Date;
    end: Date;
  };
  overallProgress: number; // 0-1
  completedActivities: number;
  totalActivities: number;
  learningOutcomes: LearningOutcome[];
  keyInsights: string[];
  achievements: Achievement[];
  challenges: Challenge[];
  recommendations: string[];
  nextSteps: string[];
  metrics: ProgressMetrics;
}

export interface Achievement {
  title: string;
  description: string;
  achievedAt: Date;
  impact: string;
  category: string;
  evidence: string[];
}

export interface Challenge {
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  impact: string;
  suggestedActions: string[];
  identifiedAt: Date;
}

export interface ProgressMetrics {
  activitiesCompleted: number;
  activitiesInProgress: number;
  activitiesPlanned: number;
  averageActivityDuration: number;
  learningVelocity: number; // outcomes per week
  knowledgeRetention: number; // 0-1
  behaviorChangeRate: number; // 0-1
  overallEffectiveness: number; // 0-1
}

// ============================================================================
// List Options Types
// ============================================================================

export interface ImprovementPlanListOptions {
  status?: SelfImprovementPlan['status'][];
  priority?: ImprovementPriority[];
  area?: ImprovementAreaType[];
  minProgress?: number;
  maxProgress?: number;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'priority' | 'progress' | 'endDate';
  sortDirection?: 'asc' | 'desc';
}

export interface LearningActivityListOptions {
  planId?: string;
  status?: LearningActivity['status'][];
  type?: LearningActivity['type'][];
  area?: ImprovementAreaType[];
  priority?: ImprovementPriority[];
  limit?: number;
  offset?: number;
  sortBy?: 'startDate' | 'priority' | 'estimatedDuration';
  sortDirection?: 'asc' | 'desc';
}

export interface LearningOutcomeListOptions {
  planId?: string;
  activityId?: string;
  type?: LearningOutcomeType[];
  area?: ImprovementAreaType[];
  minConfidence?: number;
  appliedToBehavior?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'confidence' | 'type';
  sortDirection?: 'asc' | 'desc';
}

export interface PeriodicTaskListOptions {
  enabled?: boolean;
  status?: PeriodicTaskStatus[];
  sortBy?: 'nextRunTime' | 'lastRunTime' | 'name';
  sortDirection?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface ProgressReportOptions {
  includeActivities?: boolean;
  includeOutcomes?: boolean;
  includeMetrics?: boolean;
  includeRecommendations?: boolean;
  timeRange?: {
    start: Date;
    end: Date;
  };
}

export interface PlanGenerationOptions {
  priorityThreshold?: ImprovementPriority;
  maxImprovements?: number;
  focusAreas?: ImprovementAreaType[];
  timeframe?: {
    start: Date;
    end: Date;
  };
}

// ============================================================================
// Component Interfaces
// ============================================================================

export interface ImprovementPlanManager {
  createPlan(plan: Omit<SelfImprovementPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<SelfImprovementPlan>;
  getPlan(planId: string): Promise<SelfImprovementPlan | null>;
  updatePlan(planId: string, updates: Partial<Omit<SelfImprovementPlan, 'id' | 'createdAt'>>): Promise<SelfImprovementPlan>;
  listPlans(options?: ImprovementPlanListOptions): Promise<SelfImprovementPlan[]>;
  deletePlan(planId: string): Promise<boolean>;
  generatePlanFromReflections(reflectionIds: string[], options?: PlanGenerationOptions): Promise<SelfImprovementPlan>;
  calculateProgress(planId: string): Promise<number>;
  getStats(): PlanManagerStats;
  clear(): Promise<void>;
}

export interface LearningActivityManager {
  createActivity(activity: Omit<LearningActivity, 'id'>): Promise<LearningActivity>;
  getActivity(activityId: string): Promise<LearningActivity | null>;
  updateActivity(activityId: string, updates: Partial<Omit<LearningActivity, 'id'>>): Promise<LearningActivity>;
  listActivities(options?: LearningActivityListOptions): Promise<LearningActivity[]>;
  deleteActivity(activityId: string): Promise<boolean>;
  startActivity(activityId: string): Promise<LearningActivity>;
  completeActivity(activityId: string, notes?: string): Promise<LearningActivity>;
  getActivitiesForPlan(planId: string): Promise<LearningActivity[]>;
  getStats(): ActivityManagerStats;
  clear(): Promise<void>;
}

export interface LearningOutcomeManager {
  recordOutcome(outcome: Omit<LearningOutcome, 'id' | 'timestamp'>): Promise<LearningOutcome>;
  getOutcome(outcomeId: string): Promise<LearningOutcome | null>;
  updateOutcome(outcomeId: string, updates: Partial<Omit<LearningOutcome, 'id' | 'timestamp'>>): Promise<LearningOutcome>;
  listOutcomes(options?: LearningOutcomeListOptions): Promise<LearningOutcome[]>;
  deleteOutcome(outcomeId: string): Promise<boolean>;
  applyOutcomesToBehavior(outcomeIds: string[]): Promise<boolean>;
  getOutcomesForPlan(planId: string): Promise<LearningOutcome[]>;
  getOutcomesForActivity(activityId: string): Promise<LearningOutcome[]>;
  getStats(): OutcomeManagerStats;
  clear(): Promise<void>;
}

export interface PeriodicReflectionScheduler {
  scheduleTask(schedule: string, options: PeriodicReflectionOptions): Promise<PeriodicReflectionTask>;
  getTask(taskId: string): Promise<PeriodicReflectionTask | null>;
  updateTask(taskId: string, updates: Partial<Omit<PeriodicReflectionTask, 'id' | 'createdAt' | 'updatedAt'>>): Promise<PeriodicReflectionTask>;
  listTasks(options?: PeriodicTaskListOptions): Promise<PeriodicReflectionTask[]>;
  deleteTask(taskId: string): Promise<boolean>;
  setTaskEnabled(taskId: string, enabled: boolean): Promise<PeriodicReflectionTask>;
  getStats(): SchedulerStats;
  clear(): Promise<void>;
}

export interface ReflectionTaskExecutor {
  executeTask(taskId: string, options?: TaskExecutionOptions): Promise<PeriodicTaskResult>;
  executeTaskDirect(task: PeriodicReflectionTask, options?: TaskExecutionOptions): Promise<PeriodicTaskResult>;
  validateTaskParameters(task: PeriodicReflectionTask): Promise<boolean>;
  prepareExecutionContext(task: PeriodicReflectionTask, options?: TaskExecutionOptions): Promise<Record<string, unknown>>;
  getStats(): ExecutorStats;
}

export interface ProgressAnalyzer {
  generateReport(planId: string, options?: ProgressReportOptions): Promise<ImprovementProgressReport>;
  calculateOverallProgress(planId: string): Promise<number>;
  analyzeActivityProgress(planId: string): Promise<ActivityProgressAnalysis>;
  analyzeLearningEffectiveness(planId: string): Promise<LearningEffectivenessAnalysis>;
  identifyBottlenecks(planId: string): Promise<Bottleneck[]>;
  generateRecommendations(planId: string): Promise<string[]>;
  getStats(): AnalyzerStats;
}

// ============================================================================
// Statistics Types
// ============================================================================

export interface PlanManagerStats {
  totalPlans: number;
  activePlans: number;
  completedPlans: number;
  averageProgress: number;
  plansByPriority: Record<ImprovementPriority, number>;
  plansByArea: Record<ImprovementAreaType, number>;
  plansByStatus: Record<SelfImprovementPlan['status'], number>;
}

export interface ActivityManagerStats {
  totalActivities: number;
  completedActivities: number;
  inProgressActivities: number;
  averageDuration: number;
  activitiesByType: Record<LearningActivity['type'], number>;
  activitiesByArea: Record<ImprovementAreaType, number>;
  activitiesByStatus: Record<LearningActivity['status'], number>;
}

export interface OutcomeManagerStats {
  totalOutcomes: number;
  appliedOutcomes: number;
  averageConfidence: number;
  outcomesByType: Record<LearningOutcomeType, number>;
  outcomesByArea: Record<ImprovementAreaType, number>;
  behaviorChangeRate: number;
}

export interface SchedulerStats {
  totalTasks: number;
  enabledTasks: number;
  completedRuns: number;
  failedRuns: number;
  averageExecutionTime: number;
  nextScheduledRun?: Date;
}

export interface ExecutorStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  lastExecutionTime?: Date;
}

export interface AnalyzerStats {
  reportsGenerated: number;
  plansAnalyzed: number;
  averageReportGenerationTime: number;
  lastAnalysisTime?: Date;
}

// ============================================================================
// Analysis Result Types
// ============================================================================

export interface ActivityProgressAnalysis {
  planId: string;
  totalActivities: number;
  completedActivities: number;
  inProgressActivities: number;
  plannedActivities: number;
  overallProgress: number;
  progressByArea: Record<ImprovementAreaType, number>;
  progressByType: Record<LearningActivity['type'], number>;
  estimatedCompletion: Date;
  blockers: string[];
}

export interface LearningEffectivenessAnalysis {
  planId: string;
  totalOutcomes: number;
  appliedOutcomes: number;
  averageConfidence: number;
  effectivenessByArea: Record<ImprovementAreaType, number>;
  effectivenessByType: Record<LearningOutcomeType, number>;
  knowledgeRetention: number;
  behaviorChangeRate: number;
  learningVelocity: number;
  recommendations: string[];
}

export interface Bottleneck {
  type: 'activity' | 'resource' | 'skill' | 'time' | 'motivation';
  description: string;
  severity: 'low' | 'medium' | 'high';
  impact: string;
  suggestedSolutions: string[];
  affectedActivities: string[];
  identifiedAt: Date;
}

// ============================================================================
// Error Types
// ============================================================================

export class EnhancedReflectionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: Record<string, unknown> = {},
    public readonly recoverable: boolean = true,
    public readonly suggestions: string[] = []
  ) {
    super(message);
    this.name = 'EnhancedReflectionError';
  }
}

export class ImprovementPlanError extends EnhancedReflectionError {
  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {},
    recoverable: boolean = true,
    suggestions: string[] = []
  ) {
    super(message, `IMPROVEMENT_PLAN_${code}`, context, recoverable, suggestions);
    this.name = 'ImprovementPlanError';
  }
}

export class LearningActivityError extends EnhancedReflectionError {
  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {},
    recoverable: boolean = true,
    suggestions: string[] = []
  ) {
    super(message, `LEARNING_ACTIVITY_${code}`, context, recoverable, suggestions);
    this.name = 'LearningActivityError';
  }
}

export class PeriodicReflectionError extends EnhancedReflectionError {
  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {},
    recoverable: boolean = true,
    suggestions: string[] = []
  ) {
    super(message, `PERIODIC_REFLECTION_${code}`, context, recoverable, suggestions);
    this.name = 'PeriodicReflectionError';
  }
}

// ============================================================================
// Additional Scheduler Interfaces
// ============================================================================

export enum ScheduleFrequency {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  CUSTOM = 'custom'
}

export interface PeriodicReflectionConfig {
  name: string;
  description: string;
  frequency: ScheduleFrequency;
  interval: number; // milliseconds
  enabled: boolean;
  reflectionType: string;
  triggerConditions: string[];
  analysisDepth: 'basic' | 'detailed' | 'comprehensive';
  nextExecution?: Date;
}

export interface ReflectionSchedule extends PeriodicReflectionConfig {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  nextExecution: Date;
  lastExecution?: Date;
  executionCount: number;
  successCount: number;
}

export interface ScheduleListOptions {
  enabled?: boolean;
  frequency?: ScheduleFrequency[];
  reflectionType?: string[];
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'nextExecution' | 'frequency';
  sortDirection?: 'asc' | 'desc';
}

export interface ScheduleExecutionResult {
  scheduleId: string;
  executedAt: Date;
  success: boolean;
  reflectionId?: string;
  error?: string;
  duration: number;
  insights?: string[];
}

export interface ReflectionSchedulerStats {
  totalSchedules: number;
  activeSchedules: number;
  disabledSchedules: number;
  schedulesByFrequency: Record<ScheduleFrequency, number>;
  schedulesByType: Record<string, number>;
  totalExecutions: number;
  successfulExecutions: number;
  averageExecutionTime: number;
}

export class SchedulerError extends EnhancedReflectionError {
  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {},
    recoverable: boolean = true,
    suggestions: string[] = []
  ) {
    super(message, `SCHEDULER_${code}`, context, recoverable, suggestions);
    this.name = 'SchedulerError';
  }
} 