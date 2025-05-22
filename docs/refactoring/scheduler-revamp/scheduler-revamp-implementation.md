# Scheduler System Revamp: Implementation Plan

## 🎯 Goal & Context

To refactor the DefaultSchedulerManager into a more modular, maintainable system that correctly handles task scheduling and execution according to the architecture guidelines. The current system has several issues:

1. Tasks are not being executed despite being in the queue (102 tasks with "No due tasks found")
2. Missing execution paths for tasks without explicit scheduling metadata
3. Multiple scheduler instances running simultaneously 
4. Excessive code complexity (2,400+ lines) with many unreferenced methods
5. Non-compliance with implementation guidelines (uses timestamp IDs, any types, etc.)
6. Inconsistent date/time parsing across the codebase

## 🔍 Key Discoveries

- **Task Execution Criteria Gap**: Tasks are only considered "due" if they have explicit `scheduledTime` or interval scheduling
- **No Priority-Based Fallback**: No mechanism to execute pending tasks based on priority when there's no explicit scheduling
- **Duplicate Schedulers**: Logs show multiple scheduler instances with different IDs all polling simultaneously
- **Overly Complex Implementation**: Current structure doesn't follow SRP and contains mixed responsibilities
- **Inconsistent Date/Time Parsing**: Different components use different approaches to parse dates and times

## 📝 Implementation Approach 

Follow these principles when implementing the revamp:

1. **Strictly adhere to IMPLEMENTATION_GUIDELINES.md**:
   - Replace (don't extend) legacy code
   - Use ULID instead of timestamp-based IDs
   - Enforce strict type safety (no 'any' types)
   - Follow interface-first design
   - Use dependency injection

2. **Split into focused components**:
   - TaskRegistry - Storage and retrieval of tasks
   - TaskScheduler - Scheduling logic and timing
   - TaskExecutor - Execution of tasks
   - SchedulerManager - Orchestration layer
   - DateTimeProcessor - Shared NLP for date/time parsing

3. **Implement diverse scheduling strategies**:
   - ExplicitTimeScheduling - For tasks with specific times
   - IntervalScheduling - For recurring tasks
   - PriorityBasedScheduling - Fallback for high-priority tasks

4. **Add proper diagnostics and monitoring**:
   - Task execution tracing
   - Performance metrics
   - Clear error states

## 📋 Implementation Phases

### Phase 1: Initial Setup & Design
- [x] Create interface definitions for all components
- [x] Design task scheduling strategies
- [x] Define new data models with proper typing
- [x] Create error hierarchy for scheduler errors
- [ ] Design test approach for new components
- [x] Design DateTimeProcessor interface and architecture

### Phase 2: Core Components Implementation
- [ ] Implement TaskRegistry with proper storage
- [ ] Implement scheduling strategies (explicit, interval, priority)
- [ ] Implement TaskScheduler with strategy support
- [ ] Implement TaskExecutor with robust execution handling
- [ ] Build ModularSchedulerManager orchestrator
- [ ] Implement DateTimeProcessor with NLP capabilities

### Phase 3: Testing & Validation
- [ ] Create unit tests for each component
- [ ] Add integration tests for component interactions
- [ ] Create performance tests for critical paths
- [ ] Add regression tests for existing functionality
- [ ] Test with real-world task scenarios
- [ ] Create comprehensive tests for DateTimeProcessor covering all date/time formats and expressions

### Phase 4: Integration & Deployment
- [ ] Create data migration utilities for existing tasks
- [ ] Add transition support for existing code
- [ ] Implement feature flags for gradual rollout
- [ ] Add monitoring and alerting
- [ ] Document new API and usage patterns
- [ ] Integrate DateTimeProcessor across existing codebase

### Phase 5: Cleanup & Optimization
- [ ] Remove deprecated code paths
- [ ] Optimize query patterns
- [ ] Improve caching strategy
- [ ] Fine-tune performance
- [ ] Complete documentation
- [ ] Audit codebase for any remaining custom date/time parsing logic

## ✅ Completed Tasks
*This section will be updated as tasks are completed*

- Created TaskRegistry interface with CRUD operations and query capabilities
- Created TaskScheduler interface with strategy-based scheduling support
- Created TaskExecutor interface for robust task execution
- Created SchedulerManager interface for system orchestration
- Defined DateTimeProcessor interface with NLP capabilities
- Created core data models: Task, TaskExecutionResult, TaskFilter, SchedulerConfig, SchedulerMetrics
- Implemented error hierarchy with SchedulerError, TaskRegistryError, and TaskExecutorError
- Designed scheduling strategies interface for implementing different scheduling approaches

## 📌 Next Steps
1. Design test approach for the new components
2. Implement TaskRegistry as the first component
3. Write unit tests for TaskRegistry
4. Implement basic scheduling strategies (explicit, interval, priority)
5. Implement DateTimeProcessor with NLP capabilities

## 🚧 TODO Items
- Define task filter interface for querying tasks
- Design database schema changes if needed
- Review current error handling approach
- Identify critical paths for performance optimization
- Investigate scheduler duplication issue
- Research best NLP libraries for date/time parsing
- Document all supported date/time formats and expressions

## 📊 Progress Tracking

```
Phase 1: [xxxxxxxxx ] 83%
Phase 2: [          ] 0%
Phase 3: [          ] 0%
Phase 4: [          ] 0%
Phase 5: [          ] 0%
```

## 📘 Implementation Details

### Task Scheduling Improvement

The core issue we need to fix is the task execution criteria. Currently, tasks are only executed when:

```typescript
// Current logic in getDueTasks()
if (scheduledTime) {
  // Parse the scheduled time (handle both Date objects and ISO strings)
  let taskTime: Date;
  
  if (scheduledTime instanceof Date) {
    taskTime = scheduledTime;
  } else if (typeof scheduledTime === 'string') {
    taskTime = new Date(scheduledTime);
  } else if (typeof scheduledTime === 'number') {
    taskTime = new Date(scheduledTime);
  } else {
    return false; // Invalid scheduledTime format
  }
  
  // Compare with current time
  return taskTime <= now;
}

// OR 

if (scheduleType === 'interval') {
  // Interval based logic
}
```

We need to add a third path for priority-based execution:

```typescript
// New logic to add
if (!scheduledTime && scheduleType !== 'interval' && 
    task.status === 'pending' && task.priority >= HIGH_PRIORITY_THRESHOLD) {
  return true; // High priority tasks are due even without scheduling
}
```

### Modular Structure

The new structure will separate concerns:

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

This follows the IMPLEMENTATION_GUIDELINES.md principle of breaking down large classes into focused components.

### Shared DateTimeProcessor with NLP

To ensure consistent date/time parsing across the codebase, we'll implement a sophisticated DateTimeProcessor component with natural language processing capabilities:

```typescript
interface DateTimeProcessor {
  /**
   * Parse a natural language date/time expression into a standardized Date object
   * @param expression The natural language expression to parse (e.g., "tomorrow", "next Tuesday", "in 3 days")
   * @param referenceDate Optional reference date (defaults to current time)
   * @returns The parsed Date object or null if parsing fails
   */
  parseNaturalLanguage(expression: string, referenceDate?: Date): Date | null;
  
  /**
   * Format a Date object into a standardized string representation
   * @param date The date to format
   * @param format Optional format specification
   * @returns Formatted date string
   */
  formatDate(date: Date, format?: string): string;
  
  /**
   * Calculate a new date based on an interval description
   * @param baseDate The starting date
   * @param interval The interval description (e.g., "2 days", "1 week", "3 months")
   * @returns The calculated Date object
   */
  calculateInterval(baseDate: Date, interval: string): Date;
  
  /**
   * Check if a date has passed relative to the current time or a reference time
   * @param date The date to check
   * @param referenceDate Optional reference date (defaults to current time)
   * @returns True if the date has passed
   */
  hasPassed(date: Date, referenceDate?: Date): boolean;
  
  /**
   * Generate a cron expression from a natural language description
   * @param expression Natural language expression for recurring schedule
   * @returns Valid cron expression
   */
  generateCronExpression(expression: string): string;
}
```

The DateTimeProcessor will support:

1. **Natural Language Parsing**: Process expressions like "tomorrow", "next Friday", "in 3 days", "end of month"
2. **Time Zone Handling**: Properly handle time zones and DST transitions
3. **Relative Expressions**: Handle relative time expressions like "in 2 hours" or "3 weeks from now"
4. **Recurring Schedules**: Parse expressions like "every Monday" or "first day of each month"
5. **Fuzzy Matching**: Handle slight variations in expression format
6. **Multilingual Support**: Eventually support multiple languages

The implementation will use a proven NLP library (such as Chrono.js or date-fns) with a standardized interface, ensuring all parts of the codebase handle dates and times consistently. 