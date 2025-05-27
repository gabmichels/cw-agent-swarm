/**
 * TaskCreationInterfaces.ts - Interfaces for automatic task creation functionality
 * 
 * These interfaces define the contracts for the task creation components that were
 * moved from DefaultAgent to DefaultPlanningManager during Phase 1.7 cleanup.
 */

import { Task, TaskStatus } from '../../../../../scheduler/models/Task.model';

/**
 * Task priority levels (0-10, higher is more important)
 */
export enum TaskPriority {
  LOWEST = 1,
  LOW = 3,
  NORMAL = 5,
  HIGH = 7,
  HIGHEST = 9,
  CRITICAL = 10
}

/**
 * Configuration for task creation behavior
 */
export interface TaskCreationConfig {
  /** Whether automatic task creation is enabled */
  enabled: boolean;
  
  /** Confidence threshold for creating tasks (0-1) */
  confidenceThreshold: number;
  
  /** Maximum number of tasks to create per user input */
  maxTasksPerInput: number;
  
  /** Default priority for auto-created tasks */
  defaultPriority: TaskPriority;
  
  /** Keywords that indicate task creation intent */
  taskIndicatorKeywords: string[];
  
  /** Keywords that indicate urgency */
  urgencyKeywords: string[];
  
  /** Keywords that indicate scheduling */
  schedulingKeywords: string[];
}

/**
 * Result of task detection analysis
 */
export interface TaskDetectionResult {
  /** Whether a task should be created */
  shouldCreateTask: boolean;
  
  /** Confidence score (0-1) */
  confidence: number;
  
  /** Detected task indicators */
  indicators: TaskIndicator[];
  
  /** Reasoning for the decision */
  reasoning: string;
  
  /** Extracted task information */
  taskInfo?: ExtractedTaskInfo;
}

/**
 * Individual task indicator found in user input
 */
export interface TaskIndicator {
  /** Type of indicator */
  type: 'action_verb' | 'time_reference' | 'urgency_marker' | 'explicit_request';
  
  /** The text that triggered this indicator */
  text: string;
  
  /** Position in the input text */
  position: number;
  
  /** Confidence for this specific indicator */
  confidence: number;
}

/**
 * Information extracted from user input for task creation
 */
export interface ExtractedTaskInfo {
  /** Suggested task name */
  name: string;
  
  /** Task description */
  description: string;
  
  /** Detected priority */
  priority: TaskPriority;
  
  /** Scheduled time if detected */
  scheduledTime?: Date;
  
  /** Whether task is urgent */
  isUrgent: boolean;
  
  /** Extracted context/metadata */
  metadata: Record<string, unknown>;
}

/**
 * Options for priority analysis
 */
export interface PriorityAnalysisOptions {
  /** Context from previous messages */
  conversationContext?: string[];
  
  /** Current user's typical priority patterns */
  userPriorityPatterns?: Record<string, TaskPriority>;
  
  /** Time-based priority adjustments */
  timeBasedAdjustments?: boolean;
}

/**
 * Result of priority analysis
 */
export interface PriorityAnalysisResult {
  /** Determined priority */
  priority: TaskPriority;
  
  /** Confidence in the priority assignment */
  confidence: number;
  
  /** Factors that influenced the priority */
  factors: PriorityFactor[];
  
  /** Whether urgency was detected */
  isUrgent: boolean;
}

/**
 * Factor that influenced priority determination
 */
export interface PriorityFactor {
  /** Type of factor */
  type: 'keyword' | 'time_constraint' | 'context' | 'user_pattern';
  
  /** Description of the factor */
  description: string;
  
  /** Impact on priority (-1 to 1) */
  impact: number;
  
  /** Confidence in this factor */
  confidence: number;
}

/**
 * Options for scheduling analysis
 */
export interface SchedulingAnalysisOptions {
  /** Current time for relative calculations */
  currentTime?: Date;
  
  /** User's timezone */
  timezone?: string;
  
  /** User's typical schedule patterns */
  userSchedulePatterns?: Record<string, string>;
}

/**
 * Result of scheduling analysis
 */
export interface SchedulingAnalysisResult {
  /** Detected scheduled time */
  scheduledTime?: Date;
  
  /** Confidence in the scheduling */
  confidence: number;
  
  /** Type of time reference found */
  timeReferenceType?: 'absolute' | 'relative' | 'recurring';
  
  /** Original time expression from input */
  originalExpression?: string;
  
  /** Whether this is a recurring task */
  isRecurring: boolean;
  
  /** Recurrence pattern if applicable */
  recurrencePattern?: string;
}

/**
 * Interface for automatic task creation from user input
 */
export interface AutoTaskCreator {
  /**
   * Analyze user input and create tasks if appropriate
   */
  createTasksFromInput(
    userInput: string,
    context?: Record<string, unknown>
  ): Promise<TaskCreationResult[]>;
  
  /**
   * Configure task creation behavior
   */
  configure(config: Partial<TaskCreationConfig>): void;
  
  /**
   * Get current configuration
   */
  getConfig(): TaskCreationConfig;
}

/**
 * Interface for detecting task creation intent in user input
 */
export interface TaskDetector {
  /**
   * Analyze user input for task creation indicators
   */
  detectTaskIntent(
    userInput: string,
    context?: Record<string, unknown>
  ): Promise<TaskDetectionResult>;
  
  /**
   * Extract task information from user input
   */
  extractTaskInfo(
    userInput: string,
    context?: Record<string, unknown>
  ): Promise<ExtractedTaskInfo | null>;
}

/**
 * Interface for analyzing and determining task priority
 */
export interface PriorityAnalyzer {
  /**
   * Analyze user input to determine task priority
   */
  analyzePriority(
    userInput: string,
    options?: PriorityAnalysisOptions
  ): Promise<PriorityAnalysisResult>;
  
  /**
   * Determine if task is urgent based on input
   */
  detectUrgency(userInput: string): Promise<boolean>;
}

/**
 * Interface for analyzing scheduling information in user input
 */
export interface SchedulingAnalyzer {
  /**
   * Analyze user input for scheduling information
   */
  analyzeScheduling(
    userInput: string,
    options?: SchedulingAnalysisOptions
  ): Promise<SchedulingAnalysisResult>;
  
  /**
   * Parse natural language time expressions
   */
  parseTimeExpression(
    timeExpression: string,
    currentTime?: Date
  ): Promise<Date | null>;
}

/**
 * Result of task creation attempt
 */
export interface TaskCreationResult {
  /** Whether task creation was successful */
  success: boolean;
  
  /** Created task if successful */
  task?: Task;
  
  /** Error information if failed */
  error?: {
    message: string;
    code: string;
    details?: Record<string, unknown>;
  };
  
  /** Metadata about the creation process */
  metadata: {
    confidence: number;
    processingTime: number;
    detectionResults: TaskDetectionResult;
    priorityResults: PriorityAnalysisResult;
    schedulingResults: SchedulingAnalysisResult;
  };
} 