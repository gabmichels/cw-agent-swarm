/**
 * Types for Chloe's Time Reasoning System
 */

import { ImportanceLevel } from '../../../constants/memory';

/**
 * Task execution data stored for time prediction
 */
export interface TaskExecutionData {
  taskId: string;
  taskType: string;
  taskTitle: string;
  description: string;
  toolsUsed: string[];
  parameters: Record<string, any>;
  startTime: Date;
  endTime: Date;
  durationMs: number;
  contextualFeatures?: {
    systemLoad?: number;
    concurrentTasks?: number;
    memorySize?: number;
    timeOfDay?: string;
    dayOfWeek?: number;
  };
  tags: string[];
  actualComplexity: TaskComplexity;
  predictedDuration?: number;
  durationAccuracy?: number;
}

/**
 * Time prediction result
 */
export interface TimePrediction {
  estimatedDurationMs: number;
  confidenceIntervalLow: number;
  confidenceIntervalHigh: number;
  confidenceScore: number; // 0.0 to 1.0
  predictionModel: string;
  features: {
    taskType: string;
    predictedComplexity: TaskComplexity;
    toolRequirements: string[];
    contextFactors: Record<string, any>;
  };
  explanation: string;
}

/**
 * Task complexity levels
 */
export enum TaskComplexity {
  TRIVIAL = 'trivial',
  SIMPLE = 'simple',
  MODERATE = 'moderate',
  COMPLEX = 'complex',
  VERY_COMPLEX = 'very_complex'
}

/**
 * Resource requirement specification
 */
export interface ResourceRequirements {
  estimatedTimeMs: number;
  cpu: number; // 0.0 to 1.0 representing percentage of CPU needed
  memory: number; // MB needed
  priority: ImportanceLevel;
  preemptible: boolean;
  concurrencyLimit?: number;
}

/**
 * Resource allocation record
 */
export interface ResourceAllocation {
  taskId: string;
  allocatedTime: number; // milliseconds
  allocatedCpu: number; // 0.0 to 1.0
  allocatedMemory: number; // MB
  startTime: Date;
  endTime?: Date;
  status: 'scheduled' | 'in_progress' | 'completed' | 'preempted';
  progress?: number; // 0.0 to 1.0
}

/**
 * System resource capacity
 */
export interface SystemCapacity {
  totalCpu: number; // Number of logical cores
  totalMemory: number; // MB
  availableCpu: number;
  availableMemory: number;
  scheduledCapacity: number; // 0.0 to 1.0
}

/**
 * Time prediction models
 */
export enum PredictionModelType {
  MOVING_AVERAGE = 'moving_average',
  MEDIAN = 'median',
  REGRESSION = 'regression',
  SIMILARITY = 'similarity',
  ENSEMBLE = 'ensemble'
}

/**
 * Progress report for tasks
 */
export interface TaskProgressReport {
  taskId: string;
  timestamp: Date;
  percentComplete: number;
  remainingTimeEstimate: number;
  statusMessage: string;
  milestones: {
    name: string;
    completed: boolean;
    timestamp?: Date;
  }[];
}

/**
 * Performance metrics
 */
export interface TimePerformanceMetrics {
  totalTasks: number;
  averageAccuracy: number;
  mape: number; // Mean Absolute Percentage Error
  overestimationRate: number;
  underestimationRate: number;
  predictionsByComplexity: Record<TaskComplexity, {
    count: number;
    averageAccuracy: number;
  }>;
  predictionsByTaskType: Record<string, {
    count: number;
    averageAccuracy: number;
  }>;
}

/**
 * Resource adjustment strategy
 */
export enum ResourceAdjustmentStrategy {
  PREEMPTIVE = 'preemptive',
  GRADUAL = 'gradual',
  REDISTRIBUTIVE = 'redistributive',
  DEADLINE_DRIVEN = 'deadline_driven'
} 