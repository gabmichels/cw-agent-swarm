# Scheduler Migration Guide

This guide helps you migrate from `DefaultSchedulerManager` to the new modular scheduler system.

## Why Migrate?

The new `ModularSchedulerManager` offers several advantages:

1. **Enhanced Date/Time Processing** - Support for vague expressions like "urgent" and "soon"
2. **Modular Architecture** - Easily swap out components as needed
3. **Better Error Handling** - Comprehensive error handling and reporting
4. **Improved Type Safety** - Strict TypeScript typing throughout
5. **Enhanced Performance** - More efficient task scheduling
6. **Better Testability** - All components can be mocked and tested individually

## Migration Options

There are three options for migrating:

### Option 1: Simple Migration (Recommended)

Use the factory function to create a drop-in replacement:

```typescript
// Before:
import { DefaultSchedulerManager } from '../path/to/DefaultSchedulerManager';
const scheduler = new DefaultSchedulerManager();
await scheduler.initialize();

// After:
import { createSchedulerManager } from '../lib/scheduler/factories/SchedulerFactory';
const scheduler = await createSchedulerManager();
```

### Option 2: Use Migration Helper (For Legacy Code)

Use the deprecated helper function to maintain backward compatibility:

```typescript
// Before:
import { DefaultSchedulerManager } from '../path/to/DefaultSchedulerManager';
const scheduler = new DefaultSchedulerManager();
await scheduler.initialize();

// After:
import { createDefaultSchedulerManagerReplacement } from '../lib/scheduler/factories/SchedulerFactory';
const scheduler = await createDefaultSchedulerManagerReplacement();
```

### Option 3: Full Migration (For Complete Control)

Create and configure all components manually for full control:

```typescript
import { ModularSchedulerManager } from '../lib/scheduler/implementations/ModularSchedulerManager';
import { MemoryTaskRegistry } from '../lib/scheduler/implementations/registry/MemoryTaskRegistry';
import { StrategyBasedTaskScheduler } from '../lib/scheduler/implementations/scheduler/StrategyBasedTaskScheduler';
import { ExplicitTimeStrategy } from '../lib/scheduler/implementations/strategies/ExplicitTimeStrategy';
import { IntervalStrategy } from '../lib/scheduler/implementations/strategies/IntervalStrategy';
import { PriorityBasedStrategy } from '../lib/scheduler/implementations/strategies/PriorityBasedStrategy';
import { BasicTaskExecutor } from '../lib/scheduler/implementations/executor/BasicTaskExecutor';
import { BasicDateTimeProcessor } from '../lib/scheduler/implementations/datetime/BasicDateTimeProcessor';

// Create components
const dateTimeProcessor = new BasicDateTimeProcessor();
const registry = new MemoryTaskRegistry();
const explicitStrategy = new ExplicitTimeStrategy(dateTimeProcessor);
const intervalStrategy = new IntervalStrategy(dateTimeProcessor);
const priorityStrategy = new PriorityBasedStrategy();
const scheduler = new StrategyBasedTaskScheduler([
  explicitStrategy,
  intervalStrategy,
  priorityStrategy
]);
const executor = new BasicTaskExecutor();

// Create and initialize manager
const manager = new ModularSchedulerManager(
  registry,
  scheduler,
  executor,
  dateTimeProcessor,
  {
    enabled: true,
    enableAutoScheduling: true,
    schedulingInterval: 5000, // 5 seconds
    maxConcurrentTasks: 5,
    defaultPriority: 5
  }
);
await manager.initialize();
```

## API Differences

The `ModularSchedulerManager` implements the same `SchedulerManager` interface as `DefaultSchedulerManager`, so all core methods remain the same.

### Enhanced Functionality

The new scheduler supports additional features:

#### 1. Vague Temporal Expressions

```typescript
// Create a task with a vague temporal expression
const urgentTask = await scheduler.createTask({
  name: 'Urgent Task',
  description: 'This task should execute immediately',
  scheduleType: TaskScheduleType.EXPLICIT,
  scheduledTime: 'urgent', // Will be translated to current time with priority 10
  handler: async () => {
    console.log('Executing urgent task');
  },
  status: TaskStatus.PENDING
});
```

#### 2. Complex Expressions

```typescript
// Create a task with a complex temporal expression
const task = await scheduler.createTask({
  name: 'Future Task',
  description: 'This task should execute later',
  scheduleType: TaskScheduleType.EXPLICIT,
  scheduledTime: 'next week tuesday', // Will be translated to next Tuesday
  handler: async () => {
    console.log('Executing future task');
  },
  status: TaskStatus.PENDING
});
```

## Migration Checklist

1. ✅ Identify all locations where `DefaultSchedulerManager` is used
2. ✅ Choose the appropriate migration option for each location
3. ✅ Update imports to point to the new scheduler components
4. ✅ Test thoroughly to ensure tasks are being scheduled and executed correctly
5. ✅ Update any documentation or comments to reflect the new scheduler system

## Common Issues and Solutions

### Type Errors

If you encounter TypeScript errors, ensure you're using the correct imports and types:

```typescript
import { Task, TaskStatus, TaskScheduleType } from '../lib/scheduler/models/Task.model';
```

### Missing Dependencies

If you receive "Cannot find module" errors, check your import paths or install any missing dependencies.

### Scheduler Not Running

If the scheduler isn't running tasks automatically, ensure you've called `initialize()` and that auto-scheduling is enabled:

```typescript
const scheduler = await createSchedulerManager({
  enabled: true,
  enableAutoScheduling: true
});
```

## Need Help?

If you encounter any issues during migration, please refer to the full documentation or contact the development team for assistance. 