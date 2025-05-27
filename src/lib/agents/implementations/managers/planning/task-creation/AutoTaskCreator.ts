/**
 * AutoTaskCreator.ts - Automatic task creation orchestrator
 * 
 * This component orchestrates the automatic creation of tasks from user input
 * by coordinating TaskDetector, PriorityAnalyzer, and SchedulingAnalyzer.
 */

import { 
  AutoTaskCreator as IAutoTaskCreator,
  TaskCreationConfig,
  TaskCreationResult,
  TaskDetectionResult,
  PriorityAnalysisResult,
  SchedulingAnalysisResult,
  TaskPriority 
} from '../interfaces/TaskCreationInterfaces';
import { Task, TaskStatus, TaskScheduleType } from '../../../../../scheduler/models/Task.model';
import { TaskDetector } from './TaskDetector';
import { PriorityAnalyzer } from './PriorityAnalyzer';
import { SchedulingAnalyzer } from './SchedulingAnalyzer';
import { ulid } from 'ulid';

/**
 * Default configuration for task creation
 */
const DEFAULT_CONFIG: TaskCreationConfig = {
  enabled: true,
  confidenceThreshold: 0.3,
  maxTasksPerInput: 3,
  defaultPriority: TaskPriority.NORMAL,
  taskIndicatorKeywords: [
    'create', 'schedule', 'remind', 'task', 'todo', 'plan', 'organize'
  ],
  urgencyKeywords: [
    'urgent', 'asap', 'immediately', 'critical', 'emergency', 'rush'
  ],
  schedulingKeywords: [
    'tomorrow', 'today', 'next week', 'monday', 'friday', 'at', 'by'
  ]
};

/**
 * Implementation of AutoTaskCreator interface
 */
export class AutoTaskCreator implements IAutoTaskCreator {
  private config: TaskCreationConfig;
  private taskDetector: TaskDetector;
  private priorityAnalyzer: PriorityAnalyzer;
  private schedulingAnalyzer: SchedulingAnalyzer;

  constructor(
    config?: Partial<TaskCreationConfig>,
    taskDetector?: TaskDetector,
    priorityAnalyzer?: PriorityAnalyzer,
    schedulingAnalyzer?: SchedulingAnalyzer
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.taskDetector = taskDetector || new TaskDetector();
    this.priorityAnalyzer = priorityAnalyzer || new PriorityAnalyzer();
    this.schedulingAnalyzer = schedulingAnalyzer || new SchedulingAnalyzer();
  }

  /**
   * Analyze user input and create tasks if appropriate
   */
  async createTasksFromInput(
    userInput: string,
    context?: Record<string, unknown>
  ): Promise<TaskCreationResult[]> {
    const startTime = Date.now();
    
    if (!this.config.enabled) {
      return [{
        success: false,
        error: {
          message: 'Task creation is disabled',
          code: 'TASK_CREATION_DISABLED',
          details: { enabled: false }
        },
        metadata: {
          confidence: 0,
          processingTime: Date.now() - startTime,
          detectionResults: {
            shouldCreateTask: false,
            confidence: 0,
            indicators: [],
            reasoning: 'Task creation disabled'
          },
          priorityResults: {
            priority: this.config.defaultPriority,
            confidence: 0,
            factors: [],
            isUrgent: false
          },
          schedulingResults: {
            confidence: 0,
            isRecurring: false
          }
        }
      }];
    }

    try {
      // Step 1: Detect task creation intent
      const detectionResults = await this.taskDetector.detectTaskIntent(userInput, context);
      
      if (!detectionResults.shouldCreateTask || 
          detectionResults.confidence < this.config.confidenceThreshold) {
        return [{
          success: false,
          error: {
            message: 'No task creation intent detected or confidence too low',
            code: 'NO_TASK_INTENT',
            details: { 
              confidence: detectionResults.confidence,
              threshold: this.config.confidenceThreshold
            }
          },
          metadata: {
            confidence: detectionResults.confidence,
            processingTime: Date.now() - startTime,
            detectionResults,
            priorityResults: {
              priority: this.config.defaultPriority,
              confidence: 0,
              factors: [],
              isUrgent: false
            },
            schedulingResults: {
              confidence: 0,
              isRecurring: false
            }
          }
        }];
      }

      // Step 2: Analyze priority
      const priorityResults = await this.priorityAnalyzer.analyzePriority(userInput, {
        conversationContext: context?.conversationHistory as string[],
        userPriorityPatterns: context?.userPriorityPatterns as Record<string, TaskPriority>,
        timeBasedAdjustments: true
      });

      // Step 3: Analyze scheduling
      const schedulingResults = await this.schedulingAnalyzer.analyzeScheduling(userInput, {
        currentTime: new Date(),
        timezone: context?.timezone as string,
        userSchedulePatterns: context?.userSchedulePatterns as Record<string, string>
      });

      // Step 4: Create the task
      const task = await this.createTask(
        detectionResults,
        priorityResults,
        schedulingResults,
        userInput,
        context
      );

      return [{
        success: true,
        task,
        metadata: {
          confidence: detectionResults.confidence,
          processingTime: Date.now() - startTime,
          detectionResults,
          priorityResults,
          schedulingResults
        }
      }];

    } catch (error) {
      return [{
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          code: 'TASK_CREATION_ERROR',
          details: { 
            originalError: error,
            userInput,
            context 
          }
        },
        metadata: {
          confidence: 0,
          processingTime: Date.now() - startTime,
          detectionResults: {
            shouldCreateTask: false,
            confidence: 0,
            indicators: [],
            reasoning: 'Error occurred during processing'
          },
          priorityResults: {
            priority: this.config.defaultPriority,
            confidence: 0,
            factors: [],
            isUrgent: false
          },
          schedulingResults: {
            confidence: 0,
            isRecurring: false
          }
        }
      }];
    }
  }

  /**
   * Configure task creation behavior
   */
  configure(config: Partial<TaskCreationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): TaskCreationConfig {
    return { ...this.config };
  }

  /**
   * Create a task from analysis results
   */
  private async createTask(
    detectionResults: TaskDetectionResult,
    priorityResults: PriorityAnalysisResult,
    schedulingResults: SchedulingAnalysisResult,
    userInput: string,
    context?: Record<string, unknown>
  ): Promise<Task> {
    const taskInfo = detectionResults.taskInfo;
    
    if (!taskInfo) {
      throw new Error('Task information not available from detection results');
    }

    // Generate unique task ID
    const taskId = ulid();
    
    // Determine final priority (use priority analysis result over task info)
    const priority = priorityResults.priority;
    
    // Determine scheduled time (use scheduling analysis result over task info)
    const scheduledTime = schedulingResults.scheduledTime || taskInfo.scheduledTime;
    
    // Create task metadata
    const metadata = {
      ...taskInfo.metadata,
      createdBy: 'AutoTaskCreator',
      createdAt: new Date().toISOString(),
      confidence: detectionResults.confidence,
      detectionIndicators: detectionResults.indicators,
      priorityFactors: priorityResults.factors,
      originalInput: userInput,
      context: context || {}
    };

    // Create the task
    const task: Task = {
      id: taskId,
      name: taskInfo.name,
      description: taskInfo.description,
      scheduleType: scheduledTime ? TaskScheduleType.EXPLICIT : TaskScheduleType.PRIORITY,
      handler: async () => {
        // Placeholder handler - this would be replaced by the actual task execution logic
        return { message: 'Task created by AutoTaskCreator', taskId };
      },
      status: TaskStatus.PENDING,
      priority: priority,
      scheduledTime: scheduledTime,
      metadata: {
        ...metadata,
        isUrgent: priorityResults.isUrgent || taskInfo.isUrgent
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return task;
  }

  /**
   * Validate task creation configuration
   */
  private validateConfig(): void {
    if (this.config.confidenceThreshold < 0 || this.config.confidenceThreshold > 1) {
      throw new Error('Confidence threshold must be between 0 and 1');
    }
    
    if (this.config.maxTasksPerInput < 1) {
      throw new Error('Max tasks per input must be at least 1');
    }
    
    if (!Object.values(TaskPriority).includes(this.config.defaultPriority)) {
      throw new Error('Invalid default priority');
    }
  }

  /**
   * Get component health status
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    components: Record<string, boolean>;
    errors: string[];
  }> {
    const errors: string[] = [];
    const components: Record<string, boolean> = {};

    try {
      this.validateConfig();
      components.config = true;
    } catch (error) {
      components.config = false;
      errors.push(`Config validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Test TaskDetector
    try {
      await this.taskDetector.detectTaskIntent('test input');
      components.taskDetector = true;
    } catch (error) {
      components.taskDetector = false;
      errors.push(`TaskDetector failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Test PriorityAnalyzer
    try {
      await this.priorityAnalyzer.analyzePriority('test input');
      components.priorityAnalyzer = true;
    } catch (error) {
      components.priorityAnalyzer = false;
      errors.push(`PriorityAnalyzer failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Test SchedulingAnalyzer
    try {
      await this.schedulingAnalyzer.analyzeScheduling('test input');
      components.schedulingAnalyzer = true;
    } catch (error) {
      components.schedulingAnalyzer = false;
      errors.push(`SchedulingAnalyzer failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const healthy = Object.values(components).every(status => status);

    return {
      healthy,
      components,
      errors
    };
  }
} 