/**
 * BasicOpportunityProcessor.ts
 * 
 * Implements the OpportunityProcessor interface to convert opportunities into actionable tasks.
 */

import { 
  Opportunity, 
  OpportunityFilter,
  OpportunityPriority,
  OpportunityStatus,
  OpportunityType,
  TimeSensitivity
} from '../models/opportunity.model';

import {
  OpportunityProcessor,
  OpportunityProcessorConfig,
  ProcessingResult,
  BatchProcessingResult,
  OpportunityTaskMetadata
} from '../interfaces/OpportunityProcessor.interface';

import { OpportunityProcessingError } from '../errors/OpportunityError';
import { OpportunityRegistry } from '../interfaces/OpportunityRegistry.interface';

// Import from scheduler
import { 
  Task, 
  TaskStatus, 
  TaskScheduleType
} from '../../scheduler/models/Task.model';

/**
 * Task scheduler integration for the opportunity processor
 */
interface TaskSchedulerIntegration {
  /**
   * Create a task in the scheduler
   * @param task Task to create
   * @returns Promise resolving to the task ID
   */
  createTask(task: Partial<Task>): Promise<string>;
  
  /**
   * Create a task for a specific agent
   * @param task Task to create
   * @param agentId Agent ID to associate with the task
   * @returns Promise resolving to the task ID
   */
  createTaskForAgent(task: Partial<Task>, agentId: string): Promise<string>;
}

/**
 * Basic implementation of the OpportunityProcessor
 */
export class BasicOpportunityProcessor implements OpportunityProcessor {
  private initialized: boolean = false;
  private lastHealthCheck: Date = new Date();
  private config: Required<OpportunityProcessorConfig> = {
    maxTasksPerOpportunity: 1,
    defaultTaskPriority: '5',
    autoCompleteOpportunities: true,
    customRules: {}
  };
  
  /**
   * Constructor for the BasicOpportunityProcessor
   * @param registry OpportunityRegistry for updating opportunities
   * @param scheduler TaskScheduler integration for creating tasks
   */
  constructor(
    private registry: OpportunityRegistry,
    private scheduler: TaskSchedulerIntegration
  ) {}
  
  /**
   * Initialize the processor
   */
  async initialize(config?: OpportunityProcessorConfig): Promise<boolean> {
    if (config) {
      this.config = {
        maxTasksPerOpportunity: config.maxTasksPerOpportunity ?? this.config.maxTasksPerOpportunity,
        defaultTaskPriority: config.defaultTaskPriority ?? this.config.defaultTaskPriority,
        autoCompleteOpportunities: config.autoCompleteOpportunities ?? this.config.autoCompleteOpportunities,
        customRules: config.customRules ?? {}
      };
    }
    
    this.initialized = true;
    this.lastHealthCheck = new Date();
    return true;
  }
  
  /**
   * Ensure the processor is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new OpportunityProcessingError(
        'Processor not initialized',
        'PROCESSOR_NOT_INITIALIZED',
        { initialized: this.initialized }
      );
    }
  }
  
  /**
   * Process an opportunity
   */
  async processOpportunity(opportunity: Opportunity): Promise<ProcessingResult> {
    this.ensureInitialized();
    
    const startTime = Date.now();
    
    try {
      // Get task metadata from opportunity
      const taskMetadata = await this.generateTaskMetadata(opportunity);
      
      // Create task(s) from opportunity
      const taskIds = await this.createTasksFromOpportunity(opportunity, taskMetadata);
      
      // Mark opportunity as processed if auto-complete is enabled
      if (this.config.autoCompleteOpportunities && taskIds.length > 0) {
        const result = {
          successful: true,
          completedAt: new Date(),
          outcomeDescription: `Created ${taskIds.length} task(s)`,
          createdTaskIds: taskIds
        };
        
        await this.registry.updateOpportunityStatus(
          opportunity.id,
          OpportunityStatus.COMPLETED,
          result
        );
        
        // Update the opportunity with the result
        opportunity = {
          ...opportunity,
          status: OpportunityStatus.COMPLETED,
          result
        };
      }
      
      const executionTime = Date.now() - startTime;
      
      return {
        success: taskIds.length > 0,
        opportunity,
        taskIds,
        stats: {
          executionTimeMs: executionTime,
          processingDate: new Date()
        },
        details: {
          taskMetadata
        }
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // Mark opportunity as failed
      const failureResult = {
        successful: false,
        completedAt: new Date(),
        outcomeDescription: error instanceof Error ? error.message : String(error)
      };
      
      await this.registry.updateOpportunityStatus(
        opportunity.id,
        OpportunityStatus.FAILED,
        failureResult
      );
      
      // Update the opportunity with the failure
      opportunity = {
        ...opportunity,
        status: OpportunityStatus.FAILED,
        result: failureResult
      };
      
      return {
        success: false,
        opportunity,
        taskIds: [],
        error: error instanceof Error ? error.message : String(error),
        stats: {
          executionTimeMs: executionTime,
          processingDate: new Date()
        }
      };
    }
  }
  
  /**
   * Create task(s) from an opportunity
   */
  private async createTasksFromOpportunity(
    opportunity: Opportunity,
    metadata: OpportunityTaskMetadata
  ): Promise<string[]> {
    const taskIds: string[] = [];
    
    // Determine priority based on opportunity priority
    const priority = this.mapPriorityToTaskPriority(opportunity.priority);
    
    // Determine scheduled time based on time sensitivity
    const scheduledTime = this.getScheduledTimeFromSensitivity(opportunity.timeSensitivity);
    
    // Prepare task data
    const baseTaskData: Partial<Task> = {
      name: this.generateTaskName(opportunity),
      description: opportunity.description,
      scheduleType: scheduledTime ? TaskScheduleType.EXPLICIT : TaskScheduleType.PRIORITY,
      status: TaskStatus.PENDING,
      priority,
      scheduledTime,
      metadata: {
        opportunity: metadata,
        source: 'opportunity-processor',
        tags: ['opportunity', opportunity.type.toLowerCase(), opportunity.source.toLowerCase()]
      }
    };
    
    // Create the task for the agent
    const agentId = opportunity.context.agentId;
    const taskId = await this.scheduler.createTaskForAgent(baseTaskData, agentId);
    taskIds.push(taskId);
    
    return taskIds;
  }
  
  /**
   * Generate a task name from an opportunity
   */
  private generateTaskName(opportunity: Opportunity): string {
    return `${this.capitalizeFirstLetter(opportunity.type.replace(/_/g, ' '))}: ${opportunity.title}`;
  }
  
  /**
   * Capitalize the first letter of a string
   */
  private capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
  
  /**
   * Map opportunity priority to task priority (0-10 scale)
   */
  private mapPriorityToTaskPriority(priority: OpportunityPriority): number {
    const priorityMap: Record<OpportunityPriority, number> = {
      [OpportunityPriority.LOW]: 3,
      [OpportunityPriority.MEDIUM]: 5,
      [OpportunityPriority.HIGH]: 7,
      [OpportunityPriority.CRITICAL]: 10
    };
    
    return priorityMap[priority] || parseInt(this.config.defaultTaskPriority, 10);
  }
  
  /**
   * Determine scheduled time based on time sensitivity
   */
  private getScheduledTimeFromSensitivity(sensitivity: TimeSensitivity): Date | undefined {
    const now = new Date();
    
    switch (sensitivity) {
      case TimeSensitivity.IMMEDIATE:
        return now; // Execute immediately
        
      case TimeSensitivity.URGENT:
        // Schedule within the next hour
        return new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes
        
      case TimeSensitivity.IMPORTANT:
        // Schedule within the day
        return new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours
        
      case TimeSensitivity.STANDARD:
        // Schedule within next few days (use priority-based)
        return undefined;
        
      case TimeSensitivity.LONG_TERM:
        // Schedule based on priority
        return undefined;
        
      default:
        return undefined;
    }
  }
  
  /**
   * Process multiple opportunities in a batch
   */
  async processBatch(opportunities: Opportunity[]): Promise<BatchProcessingResult> {
    this.ensureInitialized();
    
    const startTime = Date.now();
    const results: ProcessingResult[] = [];
    
    for (const opportunity of opportunities) {
      const result = await this.processOpportunity(opportunity);
      results.push(result);
    }
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    
    const executionTime = Date.now() - startTime;
    
    return {
      success: failureCount === 0,
      results,
      successCount,
      failureCount,
      summary: `Processed ${results.length} opportunities: ${successCount} succeeded, ${failureCount} failed`,
      stats: {
        totalExecutionTimeMs: executionTime,
        processingDate: new Date()
      }
    };
  }
  
  /**
   * Process all opportunities matching a filter
   */
  async processMatchingOpportunities(
    filter: OpportunityFilter,
    limit?: number
  ): Promise<BatchProcessingResult> {
    this.ensureInitialized();
    
    // Combine filter with status = PENDING to only process pending opportunities
    const combinedFilter: OpportunityFilter = {
      ...filter,
      statuses: [OpportunityStatus.PENDING]
    };
    
    // Get opportunities to process
    const opportunities = await this.registry.findOpportunities(
      combinedFilter,
      { field: 'priority', direction: 'desc' }, // Process highest priority first
      limit
    );
    
    return this.processBatch(opportunities);
  }
  
  /**
   * Generate task metadata from an opportunity
   */
  async generateTaskMetadata(opportunity: Opportunity): Promise<OpportunityTaskMetadata> {
    this.ensureInitialized();
    
    return {
      opportunityId: opportunity.id,
      opportunityType: opportunity.type,
      priorityInfo: {
        originalPriority: opportunity.priority,
        calculatedPriority: this.mapPriorityToTaskPriority(opportunity.priority).toString(),
        confidenceScore: opportunity.score?.overall || opportunity.trigger.confidence
      },
      timeSensitivity: opportunity.timeSensitivity,
      context: {
        source: opportunity.source,
        agentId: opportunity.context.agentId,
        detectedAt: opportunity.detectedAt,
        trigger: {
          type: opportunity.trigger.type,
          source: opportunity.trigger.source
        },
        tags: opportunity.tags
      }
    };
  }
  
  /**
   * Check if processor is healthy
   */
  async getHealth(): Promise<{
    isHealthy: boolean;
    lastCheck: Date;
    details?: Record<string, unknown>;
  }> {
    this.lastHealthCheck = new Date();
    
    return {
      isHealthy: this.initialized,
      lastCheck: this.lastHealthCheck,
      details: {
        config: this.config
      }
    };
  }
} 