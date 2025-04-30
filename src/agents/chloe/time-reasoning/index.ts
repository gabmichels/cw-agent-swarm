/**
 * Chloe Time Reasoning System
 * 
 * A comprehensive system for accurate task duration prediction and
 * dynamic resource allocation during execution.
 */

import { ChloeAgent } from '../core/agent';
import { TimePredictor } from './timePredictor';
import type { TimePredictionOptions, HistoricalDataOptions } from './timePredictor';
import { ResourceManager } from './resourceManager';
import type { ResourceManagerOptions, TaskResourceOptions } from './resourceManager';
import * as Types from './types';
import { ImportanceLevel } from '../../../constants/memory';

export { 
  TimePredictor,
  ResourceManager,
  Types
};

// Re-export types
export type { 
  TimePredictionOptions,
  HistoricalDataOptions,
  ResourceManagerOptions,
  TaskResourceOptions
};

/**
 * TimeReasoningSystem combines time prediction and resource management
 * into a unified system.
 */
export class TimeReasoningSystem {
  private agent: ChloeAgent;
  private timePredictor: TimePredictor;
  private resourceManager: ResourceManager;
  private initialized: boolean = false;

  constructor(
    agent: ChloeAgent, 
    timePredictorOptions?: HistoricalDataOptions,
    resourceManagerOptions?: ResourceManagerOptions
  ) {
    this.agent = agent;
    this.timePredictor = new TimePredictor(agent, timePredictorOptions);
    this.resourceManager = new ResourceManager(agent, resourceManagerOptions);
  }

  /**
   * Initialize the time reasoning system
   */
  public async initialize(): Promise<boolean> {
    try {
      // Initialize the time predictor
      await this.timePredictor.initialize();
      
      // Initialize the resource manager
      await this.resourceManager.initialize();
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize TimeReasoningSystem:', error);
      return false;
    }
  }

  /**
   * Get the time predictor
   */
  public getTimePredictor(): TimePredictor {
    return this.timePredictor;
  }

  /**
   * Get the resource manager
   */
  public getResourceManager(): ResourceManager {
    return this.resourceManager;
  }

  /**
   * Combined prediction and allocation for a task
   */
  public async predictAndAllocate(
    taskId: string,
    title: string,
    prediction: TimePredictionOptions,
    priority: ImportanceLevel,
    deadline?: Date
  ): Promise<{
    prediction: Types.TimePrediction;
    allocation: Types.ResourceAllocation | null;
  }> {
    if (!this.initialized) {
      throw new Error('TimeReasoningSystem not initialized');
    }
    
    // First predict the duration
    const timePrediction = this.timePredictor.predict(prediction);
    
    // Calculate resource requirements
    let cpuRequirement = 1.0; // Default to 1 CPU
    let memoryRequirement = 1024; // Default to 1GB
    
    // Adjust based on complexity
    switch (timePrediction.features.predictedComplexity) {
      case Types.TaskComplexity.TRIVIAL:
        cpuRequirement = 0.5;
        memoryRequirement = 256;
        break;
      case Types.TaskComplexity.SIMPLE:
        cpuRequirement = 1.0;
        memoryRequirement = 512;
        break;
      case Types.TaskComplexity.MODERATE:
        cpuRequirement = 1.5;
        memoryRequirement = 1024;
        break;
      case Types.TaskComplexity.COMPLEX:
        cpuRequirement = 2.0;
        memoryRequirement = 2048;
        break;
      case Types.TaskComplexity.VERY_COMPLEX:
        cpuRequirement = 3.0;
        memoryRequirement = 4096;
        break;
    }
    
    // Allocate resources
    const resourceAllocation = await this.resourceManager.allocateResources({
      taskId,
      title,
      requirements: {
        estimatedTimeMs: timePrediction.estimatedDurationMs,
        cpu: cpuRequirement,
        memory: memoryRequirement,
        priority,
        preemptible: priority !== ImportanceLevel.CRITICAL
      },
      deadline,
      priority,
      progressReportInterval: Math.max(5000, Math.min(30000, timePrediction.estimatedDurationMs / 10))
    });
    
    return {
      prediction: timePrediction,
      allocation: resourceAllocation
    };
  }

  /**
   * Record task execution and update models
   */
  public recordTaskCompletion(
    taskId: string,
    successful: boolean,
    actualExecutionData: Partial<Types.TaskExecutionData>
  ): void {
    // First complete the resource allocation
    this.resourceManager.completeTaskExecution(taskId, successful);
    
    // Get the allocation for this task
    const allocations = this.resourceManager.getAllocations({ taskId });
    if (allocations.length === 0) {
      console.warn(`No allocation found for task ${taskId}`);
      return;
    }
    
    const allocation = allocations[0];
    
    // Get the task progress
    const progress = this.resourceManager.getTaskProgress(taskId);
    
    // Combine with the actual data
    const executionData: Types.TaskExecutionData = {
      taskId,
      taskType: actualExecutionData.taskType || 'unknown',
      taskTitle: actualExecutionData.taskTitle || 'Unknown Task',
      description: actualExecutionData.description || '',
      toolsUsed: actualExecutionData.toolsUsed || [],
      parameters: actualExecutionData.parameters || {},
      startTime: allocation.startTime,
      endTime: allocation.endTime || new Date(),
      durationMs: allocation.endTime ? 
        allocation.endTime.getTime() - allocation.startTime.getTime() : 
        new Date().getTime() - allocation.startTime.getTime(),
      contextualFeatures: {
        systemLoad: this.resourceManager.getSystemCapacity().scheduledCapacity,
        concurrentTasks: this.resourceManager.getAllocations({ status: 'in_progress' }).length,
        ...actualExecutionData.contextualFeatures
      },
      tags: actualExecutionData.tags || [],
      actualComplexity: actualExecutionData.actualComplexity || Types.TaskComplexity.MODERATE,
      predictedDuration: allocation.allocatedTime
    };
    
    // Record in the time predictor
    this.timePredictor.recordTaskExecution(executionData);
  }

  /**
   * Log task progress 
   */
  public updateTaskProgress(
    taskId: string,
    percentComplete: number,
    statusMessage: string,
    completedMilestone?: string
  ): boolean {
    return this.resourceManager.updateTaskProgress(
      taskId,
      percentComplete,
      statusMessage,
      completedMilestone
    );
  }
} 