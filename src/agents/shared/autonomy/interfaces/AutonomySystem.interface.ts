/**
 * AutonomySystem.interface.ts
 * 
 * Defines the interfaces for the agent autonomy system that enables self-directed
 * operation, scheduling, and proactive task management.
 */

import { PlanAndExecuteOptions, PlanAndExecuteResult, ScheduledTask } from '../../../../lib/shared/types/agentTypes';

/**
 * Configuration options for the autonomy system
 */
export interface AutonomySystemConfig {
  /** Enable autonomous mode on startup */
  enableAutonomyOnStartup?: boolean;
  
  /** Maximum number of concurrent autonomous tasks */
  maxConcurrentTasks?: number;
  
  /** Default category for agent-generated tasks */
  defaultCategory?: string;
  
  /** Capacity management settings */
  capacityManagement?: {
    /** Maximum daily hours to allocate */
    maxDailyHours?: number;
    
    /** Enable automatic task deferral when overloaded */
    enableAutoDeferral?: boolean;
    
    /** Task priority thresholds for deferral */
    deferralPriorityThreshold?: number;
  };
  
  /** Self-improvement settings */
  selfImprovement?: {
    /** Enable periodic self-reflection */
    enablePeriodicReflection?: boolean;
    
    /** Cron schedule for daily reflection */
    dailyReflectionSchedule?: string;
    
    /** Cron schedule for weekly reflection */
    weeklyReflectionSchedule?: string;
  };
  
  /** Task security and validation */
  security?: {
    /** Require approval for sensitive operations */
    requireApprovalForSensitiveOperations?: boolean;
    
    /** Restrict autonomous mode to safe domains */
    restrictToSafeDomains?: boolean;
    
    /** Safe domains for autonomous operation */
    safeDomains?: string[];
  };
}

/**
 * Status of the autonomy system
 */
export enum AutonomyStatus {
  /** System is active and operating autonomously */
  ACTIVE = 'active',
  
  /** System is initialized but not running autonomously */
  STANDBY = 'standby',
  
  /** System is paused temporarily */
  PAUSED = 'paused',
  
  /** System is stopped or has not been initialized */
  INACTIVE = 'inactive',
  
  /** System encountered an error */
  ERROR = 'error'
}

/**
 * Autonomy capability flags
 */
export interface AutonomyCapabilities {
  /** Can run without human intervention */
  fullAutonomy: boolean;
  
  /** Can generate new tasks based on goals */
  taskGeneration: boolean;
  
  /** Can make decisions within domain */
  domainDecisionMaking: boolean;
  
  /** Can perform self-improvement */
  selfImprovement: boolean;
  
  /** Can manage its own schedule */
  scheduleManagement: boolean;
  
  /** Can adapt to unexpected situations */
  adaptability: boolean;
}

/**
 * Diagnostic result for the autonomy system
 */
export interface AutonomyDiagnostics {
  /** Overall status of the system */
  status: AutonomyStatus;
  
  /** Memory subsystem diagnostics */
  memory: {
    status: 'operational' | 'degraded' | 'error';
    messageCount: number;
    utilizationPercent: number;
  };
  
  /** Scheduler subsystem diagnostics */
  scheduler: {
    status: 'operational' | 'degraded' | 'error';
    activeTasks: number;
    pendingTasks: number;
    capacityUtilization: number;
  };
  
  /** Planning subsystem diagnostics */
  planning: {
    status: 'operational' | 'degraded' | 'error';
    successRate: number;
    avgPlanTime: number;
  };
  
  /** System resource usage */
  resources: {
    cpuUtilization: number;
    memoryUtilization: number;
    apiCallsPerMinute: number;
  };
  
  /** Autonomy capabilities diagnostics */
  capabilities: AutonomyCapabilities;
  
  /** Any errors encountered during diagnostics */
  errors?: string[];
}

/**
 * Task usage statistics
 */
export interface TaskStatistics {
  /** Total tasks scheduled */
  totalTasks: number;
  
  /** Tasks successfully completed */
  successfulTasks: number;
  
  /** Tasks that failed */
  failedTasks: number;
  
  /** Tasks currently running */
  runningTasks: number;
  
  /** Tasks waiting to be executed */
  pendingTasks: number;
  
  /** Average task completion time in milliseconds */
  averageCompletionTimeMs: number;
  
  /** Task success rate (0-1) */
  successRate: number;
  
  /** Tasks by category */
  tasksByCategory: Record<string, number>;
  
  /** Total execution count */
  totalExecutions: number;
}

/**
 * Options for autonomous plan execution
 */
export interface AutonomousExecutionOptions extends PlanAndExecuteOptions {
  /** Maximum execution time in milliseconds */
  maxExecutionTimeMs?: number;
  
  /** Task category for logging and tracking */
  category?: string;
  
  /** Whether to record reasoning for actions */
  recordReasoning?: boolean;
  
  /** Whether the execution can create new tasks */
  canCreateTasks?: boolean;
  
  /** Whether the execution requires approval for sensitive operations */
  requireApproval?: boolean;
}

/**
 * Result of autonomous plan execution
 */
export interface AutonomousExecutionResult extends PlanAndExecuteResult {
  /** Tasks created during execution */
  createdTasks?: ScheduledTask[];
  
  /** Insights gained during execution */
  insights?: string[];
  
  /** Execution analytics */
  analytics?: {
    /** Total execution time in milliseconds */
    totalTimeMs: number;
    
    /** Number of steps executed */
    stepsExecuted: number;
    
    /** Resource consumption metrics */
    resourceUsage: {
      cpuTime: number;
      memoryBytes: number;
      apiCalls: number;
      tokenCount: number;
    };
  };
}

/**
 * The autonomy system interface
 */
export interface AutonomySystem {
  /**
   * Initialize the autonomy system
   * @returns Promise resolving to true if initialization was successful
   */
  initialize(): Promise<boolean>;
  
  /**
   * Shutdown the autonomy system
   */
  shutdown(): Promise<void>;
  
  /**
   * Get the current status of the autonomy system
   */
  getStatus(): AutonomyStatus;
  
  /**
   * Set the autonomy mode (enable/disable autonomous operation)
   * @param enabled Whether to enable autonomous mode
   */
  setAutonomyMode(enabled: boolean): Promise<boolean>;
  
  /**
   * Get the current autonomy mode
   * @returns True if autonomous mode is enabled
   */
  getAutonomyMode(): boolean;
  
  /**
   * Get the scheduled tasks managed by the autonomy system
   */
  getScheduledTasks(): ScheduledTask[];
  
  /**
   * Schedule a new task
   * @param task The task to schedule
   */
  scheduleTask(task: ScheduledTask): Promise<boolean>;
  
  /**
   * Run a task immediately
   * @param taskId ID of the task to run
   */
  runTask(taskId: string): Promise<boolean>;
  
  /**
   * Cancel a scheduled task
   * @param taskId ID of the task to cancel
   */
  cancelTask(taskId: string): Promise<boolean>;
  
  /**
   * Enable or disable a task
   * @param taskId ID of the task to update
   * @param enabled Whether the task should be enabled
   */
  setTaskEnabled(taskId: string, enabled: boolean): Promise<boolean>;
  
  /**
   * Run diagnostics on the autonomy system
   * @returns Diagnostic information about the system
   */
  diagnose(): Promise<AutonomyDiagnostics>;
  
  /**
   * Plan and execute a goal autonomously
   * @param options Options for autonomous execution
   */
  planAndExecute(options: AutonomousExecutionOptions): Promise<AutonomousExecutionResult>;
  
  /**
   * Run daily autonomous tasks
   * @returns True if tasks were executed successfully
   */
  runDailyTasks(): Promise<boolean>;
  
  /**
   * Run weekly reflection
   * @returns True if reflection was executed successfully
   */
  runWeeklyReflection(): Promise<boolean>;
  
  /**
   * Get statistics about task usage
   */
  getTaskStatistics(): Promise<TaskStatistics>;
  
  /**
   * Get the capabilities of the autonomy system
   */
  getCapabilities(): AutonomyCapabilities;
  
  /**
   * Generate a task based on a goal
   * @param goal The goal to generate a task for
   * @param options Options for task generation
   */
  generateTask(goal: string, options?: {
    schedule?: string;
    priority?: number;
    category?: string;
    tags?: string[];
  }): Promise<ScheduledTask | null>;
} 