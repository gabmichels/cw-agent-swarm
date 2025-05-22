# Scheduler Module

The Scheduler Module provides a flexible, robust system for scheduling and executing tasks within the application. It's designed to handle various scheduling strategies, manage task execution, and provide monitoring and metrics for the system.

## Architecture

The Scheduler Module follows a modular, component-based architecture with clear separation of concerns:

```
ModularSchedulerManager (orchestration)
├── TaskRegistry (storage)
├── TaskScheduler (scheduling)
│   ├── ExplicitTimeStrategy
│   ├── IntervalStrategy
│   └── PriorityBasedStrategy
├── TaskExecutor (execution)
└── DateTimeProcessor (shared)
```

### Core Components

1. **SchedulerManager**: Orchestrates all components and provides a unified API
2. **TaskRegistry**: Stores and retrieves tasks
3. **TaskScheduler**: Determines which tasks are due for execution
4. **TaskExecutor**: Executes tasks and handles errors
5. **DateTimeProcessor**: Handles date/time parsing with NLP capabilities

### Scheduling Strategies

The system supports multiple scheduling strategies:

1. **ExplicitTimeStrategy**: Executes tasks at specific scheduled times
2. **IntervalStrategy**: Executes tasks at regular intervals
3. **PriorityBasedStrategy**: Executes tasks based on priority when there's no explicit scheduling

## Usage Examples

### Basic Usage

```typescript
import { ModularSchedulerManager } from './implementations/ModularSchedulerManager';
import { MemoryTaskRegistry } from './implementations/registry/MemoryTaskRegistry';
import { StrategyBasedTaskScheduler } from './implementations/scheduler/StrategyBasedTaskScheduler';
import { BasicTaskExecutor } from './implementations/executor/BasicTaskExecutor';
import { ExplicitTimeStrategy } from './implementations/strategies/ExplicitTimeStrategy';
import { IntervalStrategy } from './implementations/strategies/IntervalStrategy';
import { PriorityBasedStrategy } from './implementations/strategies/PriorityBasedStrategy';
import { TaskScheduleType } from './models/Task.model';

// Create the components
const registry = new MemoryTaskRegistry();
const scheduler = new StrategyBasedTaskScheduler([
  new ExplicitTimeStrategy(),
  new IntervalStrategy(),
  new PriorityBasedStrategy(8) // High priority threshold = 8
]);
const executor = new BasicTaskExecutor();

// Create the scheduler manager
const schedulerManager = new ModularSchedulerManager(
  registry,
  scheduler,
  executor,
  {
    enabled: true,
    enableAutoScheduling: true,
    schedulingIntervalMs: 5000, // Check for due tasks every 5 seconds
    maxConcurrentTasks: 5
  }
);

// Initialize the scheduler
await schedulerManager.initialize();

// Create a task with explicit scheduling
const explicitTask = await schedulerManager.createTask({
  name: 'Send email notification',
  scheduleType: TaskScheduleType.EXPLICIT,
  scheduledTime: new Date('2023-06-15T10:00:00Z'),
  priority: 5,
  handler: async () => {
    // Task implementation
    console.log('Sending email notification...');
    // ...
  }
});

// Create a recurring task with interval scheduling
const intervalTask = await schedulerManager.createTask({
  name: 'Database backup',
  scheduleType: TaskScheduleType.INTERVAL,
  interval: {
    expression: '1d', // Daily
    executionCount: 0,
    maxExecutions: 30 // Run for 30 days
  },
  priority: 9,
  handler: async () => {
    // Task implementation
    console.log('Backing up database...');
    // ...
  }
});

// Create a priority-based task
const priorityTask = await schedulerManager.createTask({
  name: 'Process user request',
  scheduleType: TaskScheduleType.PRIORITY,
  priority: 8,
  handler: async (userId: string) => {
    // Task implementation
    console.log(`Processing request for user ${userId}...`);
    // ...
  },
  handlerArgs: ['user123']
});

// Execute a task immediately
await schedulerManager.executeTaskNow(explicitTask.id);

// Find tasks matching criteria
const highPriorityTasks = await schedulerManager.findTasks({ 
  minPriority: 8 
});

// Get scheduler metrics
const metrics = await schedulerManager.getMetrics();
console.log(`Total tasks: ${metrics.totalTasks}`);
console.log(`Running: ${metrics.isRunning}`);

// Stop the scheduler
await schedulerManager.stopScheduler();
```

## Date/Time Processing

The scheduler includes a sophisticated DateTimeProcessor for handling natural language date/time expressions. See `docs/refactoring/scheduler-revamp/datetime-processor-formats.md` for a complete list of supported formats and expressions.

Examples:

```typescript
import { BasicDateTimeProcessor } from './implementations/datetime/BasicDateTimeProcessor';

const dateProcessor = new BasicDateTimeProcessor();

// Parse natural language expressions
const tomorrow = dateProcessor.parseNaturalLanguage('tomorrow');
const nextMonday = dateProcessor.parseNaturalLanguage('next monday');
const inThreeHours = dateProcessor.parseNaturalLanguage('in 3 hours');

// Calculate intervals
const twoWeeksLater = dateProcessor.calculateInterval(new Date(), '2 weeks');

// Format dates
const formattedDate = dateProcessor.formatDate(new Date(), 'long');
```

## Error Handling

The scheduler provides a comprehensive error hierarchy:

1. **SchedulerError**: Base error class for all scheduler errors
2. **TaskRegistryError**: Errors related to task storage and retrieval
3. **TaskExecutorError**: Errors related to task execution

All errors include detailed information about the cause and context of the error.

## Metrics and Monitoring

The scheduler provides detailed metrics through the `getMetrics()` method, including:

- Task counts by status and schedule type
- Execution statistics
- Resource utilization
- Timing information

These metrics can be used for monitoring and alerting. 