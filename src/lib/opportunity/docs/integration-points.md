# Opportunity Management System Integration Points

This document outlines the integration points between the Opportunity Management System and other system components, particularly the TaskScheduler and DateTimeProcessor.

## 1. TaskScheduler Integration

The Opportunity Management System needs to integrate with the TaskScheduler for converting detected opportunities into executable tasks and for scheduling opportunity-related activities.

### 1.1 OpportunityProcessor to TaskScheduler Integration

The `OpportunityProcessor` component is responsible for converting evaluated opportunities into actionable tasks. It will use the TaskScheduler in the following ways:

#### 1.1.1 Task Creation

```typescript
// Example integration in OpportunityProcessor implementation
import { SchedulerManager } from '../../../scheduler/interfaces/SchedulerManager.interface';
import { Task, TaskScheduleType, TaskStatus } from '../../../scheduler/models/Task.model';

export class StandardOpportunityProcessor implements OpportunityProcessor {
  constructor(
    private readonly schedulerManager: SchedulerManager
  ) {}
  
  async processOpportunity(opportunity: Opportunity): Promise<ProcessingResult> {
    try {
      // Convert opportunity to a task
      const task: Task = {
        id: '', // Will be assigned by scheduler
        name: `Opportunity: ${opportunity.title}`,
        description: opportunity.description,
        scheduleType: this.mapTimeSensitivityToScheduleType(opportunity.timeSensitivity),
        handler: async () => {
          // Task execution logic
          console.log(`Executing task for opportunity: ${opportunity.id}`);
          return { success: true };
        },
        handlerArgs: [],
        status: TaskStatus.PENDING,
        priority: this.mapOpportunityPriorityToTaskPriority(opportunity.priority),
        scheduledTime: this.determineScheduledTime(opportunity),
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          opportunityId: opportunity.id,
          opportunityType: opportunity.type,
          source: opportunity.source,
          agentId: opportunity.context.agentId,
          confidence: opportunity.trigger.confidence
        }
      };
      
      // Create the task for the specific agent
      const createdTask = await this.schedulerManager.createTask(task);
      
      return {
        success: true,
        opportunity,
        taskIds: [createdTask.id],
        stats: {
          executionTimeMs: 0,
          processingDate: new Date()
        }
      };
    } catch (error) {
      return {
        success: false,
        opportunity,
        taskIds: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  private mapTimeSensitivityToScheduleType(sensitivity: TimeSensitivity): TaskScheduleType {
    switch (sensitivity) {
      case TimeSensitivity.IMMEDIATE:
      case TimeSensitivity.URGENT:
      case TimeSensitivity.IMPORTANT:
        return TaskScheduleType.EXPLICIT;
      case TimeSensitivity.STANDARD:
      case TimeSensitivity.LONG_TERM:
        return TaskScheduleType.PRIORITY;
      default:
        return TaskScheduleType.PRIORITY;
    }
  }
  
  private mapOpportunityPriorityToTaskPriority(priority: OpportunityPriority): number {
    switch (priority) {
      case OpportunityPriority.CRITICAL: return 10;
      case OpportunityPriority.HIGH: return 8;
      case OpportunityPriority.MEDIUM: return 5;
      case OpportunityPriority.LOW: return 2;
      default: return 5;
    }
  }
  
  private determineScheduledTime(opportunity: Opportunity): Date | undefined {
    // For immediate and urgent opportunities, schedule them now or very soon
    switch (opportunity.timeSensitivity) {
      case TimeSensitivity.IMMEDIATE:
        return new Date();
      case TimeSensitivity.URGENT:
        const urgentDate = new Date();
        urgentDate.setHours(urgentDate.getHours() + 1);
        return urgentDate;
      default:
        return opportunity.validUntil;
    }
  }
}
```

#### 1.1.2 Task Query and Management

The `OpportunityManager` will also need to query tasks that were created from opportunities:

```typescript
// Example integration in OpportunityManager implementation
async findTasksForOpportunity(opportunityId: string): Promise<Task[]> {
  return this.schedulerManager.findTasks({
    metadata: {
      opportunityId: opportunityId
    }
  });
}

async cancelOpportunityTasks(opportunityId: string): Promise<boolean> {
  const tasks = await this.findTasksForOpportunity(opportunityId);
  
  for (const task of tasks) {
    task.status = TaskStatus.CANCELLED;
    await this.schedulerManager.updateTask(task);
  }
  
  return true;
}
```

### 1.2 OpportunityManager to TaskScheduler Integration for Polling

The `OpportunityManager` will use the TaskScheduler to set up recurring polls for opportunity sources:

```typescript
// Example integration in OpportunityManager implementation
async startPolling(): Promise<boolean> {
  if (this.isPolling) {
    return true;
  }
  
  // Create a polling task
  const pollingTask: Task = {
    id: '',
    name: 'Opportunity Source Polling',
    description: 'Regular polling of opportunity sources',
    scheduleType: TaskScheduleType.INTERVAL,
    handler: async () => {
      await this.pollOpportunitySources();
      return { success: true };
    },
    handlerArgs: [],
    status: TaskStatus.PENDING,
    priority: 5,
    interval: {
      expression: '15m', // Poll every 15 minutes
      executionCount: 0
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  const createdTask = await this.schedulerManager.createTask(pollingTask);
  this.pollingTaskId = createdTask.id;
  this.isPolling = true;
  
  return true;
}

async stopPolling(): Promise<boolean> {
  if (!this.isPolling || !this.pollingTaskId) {
    return true;
  }
  
  await this.schedulerManager.deleteTask(this.pollingTaskId);
  this.pollingTaskId = undefined;
  this.isPolling = false;
  
  return true;
}
```

## 2. DateTimeProcessor Integration

The DateTimeProcessor will be used for time-sensitive operations in the opportunity system, particularly for:

1. Determining time sensitivity of opportunities based on natural language
2. Parsing date expressions in opportunity descriptions
3. Computing expiration times for opportunities

### 2.1 OpportunityDetector to DateTimeProcessor Integration

```typescript
// Example integration in OpportunityDetector implementation
import { DateTimeProcessor } from '../../../scheduler/interfaces/DateTimeProcessor.interface';

export class StandardOpportunityDetector implements OpportunityDetector {
  constructor(
    private readonly dateTimeProcessor: DateTimeProcessor
  ) {}
  
  private extractTimeExpressions(content: string): { expression: string; index: number }[] {
    // Basic regex to find potential time expressions
    // This would be more sophisticated in a real implementation
    const timeRegexes = [
      /\b(today|tomorrow|yesterday|next week|next month)\b/gi,
      /\bin\s+(\d+)\s+(day|days|week|weeks|month|months)\b/gi,
      /\b(urgent|immediate|soon|later)\b/gi
    ];
    
    const results: { expression: string; index: number }[] = [];
    
    for (const regex of timeRegexes) {
      let match;
      while ((match = regex.exec(content)) !== null) {
        results.push({
          expression: match[0],
          index: match.index
        });
      }
    }
    
    return results;
  }
  
  async determineTimeSensitivity(content: string): Promise<TimeSensitivity> {
    const timeExpressions = this.extractTimeExpressions(content);
    
    // Evaluate each time expression
    for (const { expression } of timeExpressions) {
      // Check if it's a vague term
      const vagueResult = this.dateTimeProcessor.translateVagueTerm(expression);
      if (vagueResult) {
        const { priority } = vagueResult;
        
        // Map priority to time sensitivity
        if (priority >= 9) {
          return TimeSensitivity.IMMEDIATE;
        } else if (priority >= 7) {
          return TimeSensitivity.URGENT;
        } else if (priority >= 5) {
          return TimeSensitivity.IMPORTANT;
        } else if (priority >= 3) {
          return TimeSensitivity.STANDARD;
        } else {
          return TimeSensitivity.LONG_TERM;
        }
      }
      
      // Try to parse as a date expression
      const parsedDate = this.dateTimeProcessor.parseNaturalLanguage(expression);
      if (parsedDate) {
        const now = new Date();
        const hoursDifference = (parsedDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        
        // Map time difference to sensitivity
        if (hoursDifference <= 1) {
          return TimeSensitivity.IMMEDIATE;
        } else if (hoursDifference <= 4) {
          return TimeSensitivity.URGENT;
        } else if (hoursDifference <= 24) {
          return TimeSensitivity.IMPORTANT;
        } else if (hoursDifference <= 72) {
          return TimeSensitivity.STANDARD;
        } else {
          return TimeSensitivity.LONG_TERM;
        }
      }
    }
    
    // Default to standard if no time expressions are found
    return TimeSensitivity.STANDARD;
  }
}
```

### 2.2 OpportunityEvaluator to DateTimeProcessor Integration

```typescript
// Example integration in OpportunityEvaluator implementation
import { DateTimeProcessor } from '../../../scheduler/interfaces/DateTimeProcessor.interface';

export class StandardOpportunityEvaluator implements OpportunityEvaluator {
  constructor(
    private readonly dateTimeProcessor: DateTimeProcessor
  ) {}
  
  async determineTimeSensitivity(
    opportunity: Opportunity
  ): Promise<{
    timeSensitivity: TimeSensitivity;
    explanation: string;
  }> {
    // Extract time-related content from the opportunity
    const timeContext = [
      opportunity.title,
      opportunity.description,
      opportunity.trigger.content
    ].join(' ');
    
    // Look for time expressions
    let timeSensitivity = TimeSensitivity.STANDARD;
    let explanation = 'No specific time sensitivity detected.';
    
    // Check for vague terms like "urgent", "soon", etc.
    const vagueResult = this.dateTimeProcessor.translateVagueTerm(timeContext);
    if (vagueResult && vagueResult.date) {
      const { date, priority } = vagueResult;
      const now = new Date();
      
      // Determine sensitivity based on both the priority and the date
      if (priority >= 9) {
        timeSensitivity = TimeSensitivity.IMMEDIATE;
        explanation = 'Urgent language detected in opportunity content.';
      } else if (priority >= 7) {
        timeSensitivity = TimeSensitivity.URGENT;
        explanation = 'High priority language detected in opportunity content.';
      } else if (priority >= 5) {
        timeSensitivity = TimeSensitivity.IMPORTANT;
        explanation = 'Important language detected in opportunity content.';
      } else if (priority >= 3) {
        timeSensitivity = TimeSensitivity.STANDARD;
        explanation = 'Standard timing language detected in opportunity content.';
      } else {
        timeSensitivity = TimeSensitivity.LONG_TERM;
        explanation = 'Long-term language detected in opportunity content.';
      }
      
      // Further refine based on the computed date
      if (date && this.dateTimeProcessor.hasPassed(date)) {
        timeSensitivity = TimeSensitivity.IMMEDIATE;
        explanation = 'The target date has already passed.';
      } else if (date) {
        const hoursUntilDate = (date.getTime() - now.getTime()) / (1000 * 60 * 60);
        
        if (hoursUntilDate <= 1) {
          timeSensitivity = TimeSensitivity.IMMEDIATE;
          explanation = `Target time is within the next hour (${hoursUntilDate.toFixed(1)} hours).`;
        } else if (hoursUntilDate <= 4) {
          timeSensitivity = TimeSensitivity.URGENT;
          explanation = `Target time is coming soon (${hoursUntilDate.toFixed(1)} hours).`;
        } else if (hoursUntilDate <= 24) {
          timeSensitivity = TimeSensitivity.IMPORTANT;
          explanation = `Target time is within a day (${hoursUntilDate.toFixed(1)} hours).`;
        }
      }
    }
    
    return { timeSensitivity, explanation };
  }
}
```

## 3. Factory Design Pattern for Integration

To ensure proper dependency injection and composition, the opportunity system will use a factory pattern to create instances with appropriate dependencies:

```typescript
import { DateTimeProcessor } from '../../scheduler/interfaces/DateTimeProcessor.interface';
import { SchedulerManager } from '../../scheduler/interfaces/SchedulerManager.interface';
import { createSchedulerManager } from '../../scheduler/factories/SchedulerFactory';
import { OpportunityManager } from '../interfaces/OpportunityManager.interface';
import { ModularOpportunityManager } from '../implementations/manager/ModularOpportunityManager';
import { MemoryOpportunityRegistry } from '../implementations/registry/MemoryOpportunityRegistry';
import { StrategyBasedOpportunityDetector } from '../implementations/detector/StrategyBasedOpportunityDetector';
import { StandardOpportunityEvaluator } from '../implementations/evaluator/StandardOpportunityEvaluator';
import { StandardOpportunityProcessor } from '../implementations/processor/StandardOpportunityProcessor';

export async function createOpportunityManager(
  config?: Partial<OpportunityManagerConfig>,
  schedulerManager?: SchedulerManager,
  dateTimeProcessor?: DateTimeProcessor
): Promise<OpportunityManager> {
  // Create or use provided scheduler
  const scheduler = schedulerManager || await createSchedulerManager();
  
  // Get dateTimeProcessor from scheduler if not provided
  const dateTime = dateTimeProcessor || scheduler.getDateTimeProcessor();
  
  // Create registry
  const registry = new MemoryOpportunityRegistry();
  
  // Create detector with strategies
  const detector = new StrategyBasedOpportunityDetector(dateTime);
  
  // Create evaluator
  const evaluator = new StandardOpportunityEvaluator(dateTime);
  
  // Create processor
  const processor = new StandardOpportunityProcessor(scheduler);
  
  // Create and initialize the manager
  const manager = new ModularOpportunityManager(
    registry,
    detector,
    evaluator,
    processor
  );
  
  await manager.initialize(config);
  
  return manager;
}
```

## 4. Type Definitions for Integration

For proper type safety during integration, we'll need to extend the TaskMetadata interface to include opportunity-specific fields:

```typescript
// src/lib/scheduler/models/Task.model.ts
export interface TaskMetadata {
  // Existing fields...
  
  // Opportunity-specific fields
  opportunityId?: string;
  opportunityType?: string;
  opportunitySource?: string;
  opportunityConfidence?: number;
}
```

This ensures that tasks created from opportunities maintain the connection to their source opportunity and can be properly tracked and managed. 