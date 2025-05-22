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
- [x] Implement TaskRegistry with proper storage
- [x] Implement scheduling strategies (explicit, interval, priority)
- [x] Implement TaskScheduler with strategy support
- [x] Implement TaskExecutor with robust execution handling
- [x] Build ModularSchedulerManager orchestrator
- [x] Implement DateTimeProcessor with NLP capabilities

### Phase 3: Testing & Validation
- [x] Create unit tests for each component
- [x] Run all tests and make sure they pass
- [x] Add integration tests for component interactions
- [x] Create migration tests to verify smooth transition from DefaultSchedulerManager
- [x] Test with real-world agent scenarios in tests/autonomy directory
- [x] Update existing scheduler tests to use the new implementation

### Phase 4: Integration & Deployment
- [ ] Migrate DefaultSchedulerManager instances to ModularSchedulerManager 
- [ ] Create data migration utilities for existing tasks
- [ ] Add transition support for existing code
- [ ] Implement feature flags for gradual rollout
- [ ] Add monitoring and alerting
- [ ] Document new API and usage patterns
- [ ] Integrate DateTimeProcessor across existing codebase

### Phase 5: Cleanup & Optimization
- [ ] Remove deprecated code paths
- [ ] Fix npx tsc linter issues
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
- Implemented MemoryTaskRegistry for in-memory task storage
- Implemented ExplicitTimeStrategy for tasks with specific scheduled times
- Implemented IntervalStrategy for recurring tasks
- Implemented PriorityBasedStrategy for priority-based task scheduling
- Implemented StrategyBasedTaskScheduler with strategy composition
- Implemented BasicTaskExecutor with proper error handling and concurrency control
- Implemented BasicDateTimeProcessor with NLP parsing capabilities
- Implemented ModularSchedulerManager orchestrator that brings all components together
- Documented supported date/time formats and expressions
- Created README.md with usage examples and documentation
- Created comprehensive unit tests for key components:
  - BasicDateTimeProcessor tests for date/time parsing and manipulation
  - MemoryTaskRegistry tests for CRUD operations and filtering
  - ModularSchedulerManager tests for task orchestration and scheduling
- Ran all tests and verified they pass with 59 successful test cases
- Created integration tests covering:
  - End-to-end task lifecycle testing
  - Natural language date processing
  - Task execution ordering
  - Factory method validation
- Created migration tests demonstrating:
  - Task migration from legacy to modern system
  - Execution of migrated tasks
  - Migration helper function implementation

**Phase 2 Completion Summary**:
Phase 2 has been completed successfully. All core components of the scheduler system have been implemented according to the design specifications. The implementation addresses the key issues identified in the original system:

1. Fixed task execution criteria gap by implementing multiple scheduling strategies
2. Added priority-based fallback for tasks without explicit scheduling
3. Ensured single scheduler instance through proper management
4. Reduced code complexity through modular component architecture
5. Implemented consistent date/time parsing with the DateTimeProcessor
6. Enforced strict type safety throughout the implementation
7. Used ULID for ID generation instead of timestamp-based IDs
8. Added comprehensive error handling with detailed error context

The next phase will focus on testing and validation of the implemented components.

**Phase 3 Completion Summary**:
Phase 3 has been completed successfully with comprehensive unit tests, integration tests, migration tests, and real-world agent tests implemented. The tests verify both the individual components and their interactions, ensuring that the scheduler system functions correctly as a whole. The migration tests provide a clear path for transitioning from the legacy DefaultSchedulerManager to the new ModularSchedulerManager implementation.

Key achievements in testing:
1. Created 59 passing unit tests for all major components
2. Implemented integration tests covering:
   - End-to-end task lifecycle testing
   - Natural language date processing
   - Task execution ordering
   - Factory method validation
3. Designed and implemented migration tests demonstrating:
   - Task migration from legacy to modern system
   - Execution of migrated tasks
   - Migration helper function implementation
4. Created real-world agent tests in tests/autonomy directory:
   - Verified ModularSchedulerManager works independently
   - Tested integration with agent functionality
   - Validated natural language scheduling in agent context
   - Confirmed autonomous task execution capabilities
5. Created a guide for updating existing scheduler tests:
   - Demonstrated how to convert DefaultSchedulerManager tests to ModularSchedulerManager
   - Documented key API differences and migration patterns
   - Provided before/after examples for common test scenarios
6. Implemented advanced scheduler tests:
   - Verified task polling works correctly
   - Tested different scheduling scenarios (explicit time, priority-only)
   - Validated task prioritization logic
   - Confirmed handling of complex task objects with nested metadata
   - Tested natural language scheduling capabilities
   - Verified compatibility with real-world task examples
7. Verified natural language processing capabilities
8. Tested task execution priorities and scheduling

All tests are passing, providing confidence in the reliability and correctness of the new scheduler system. The next phase will focus on integration with existing code and deployment of the new system.

## 📌 Next Steps
1. Start replacing DefaultSchedulerManager instances in the codebase
2. Document the migration process for other developers
3. Review code for any remaining issues or edge cases
4. Begin Phase 4: Integration & Deployment
5. Create data migration utilities for existing tasks
6. Implement proper agent ID filtering for tasks
7. Verify that all task creation code adds the correct agentId to tasks
8. Update the scheduler factory to support agent-specific task filtering
9. Add tests to verify agent ID filtering works correctly in multi-agent environments

## 🚧 TODO Items
- Define task filter interface for querying tasks (implemented as part of Task models)
- Design database schema changes if needed
- Review current error handling approach (implemented comprehensive error hierarchy)
- Identify critical paths for performance optimization
- Investigate scheduler duplication issue (addressed in ModularSchedulerManager)
- Research best NLP libraries for date/time parsing (implemented basic NLP in DateTimeProcessor)
- [x] Document all supported date/time formats and expressions
- Add agent ID filtering to ensure tasks are only executed by their intended agent
- Update task creation to store the actual agent ID instead of "default"
- Extend TaskFilter interface to support metadata filtering with agent ID

## 🔍 Identified Gaps

### Agent ID Filtering
The current implementation doesn't properly filter tasks by agent ID, which could lead to tasks being executed by unintended agents in a multi-agent system. Specific issues include:

1. **Task Creation**: When creating tasks, the agent ID is currently hardcoded as "default" in the metadata rather than using the actual agent ID:
   ```typescript
   metadata: {
     agentId: {
       namespace: "agent",
       type: "agent",
       id: "default" // Should be the actual agent ID
     }
   }
   ```

2. **Task Filtering**: There's no automatic filtering mechanism to ensure agents only execute their own tasks. The `findTasks()` method doesn't specifically handle agent-based filtering.

3. **Required Enhancements**:
   - Extend TaskFilter to support metadata filtering with agent ID
   - Add agent-specific methods like `findTasksForAgent(agentId)`
   - Ensure task creation stores the correct agent ID
   - Update the scheduler to automatically filter by agent ID during polling
   - Add tests to verify agent-specific task isolation

This gap needs to be addressed in Phase 4 to ensure proper task isolation in multi-agent environments.

## 📊 Progress Tracking

```
Phase 1: [xxxxxxxxxx] 100%
Phase 2: [xxxxxxxxxx] 100%
Phase 3: [xxxxxxxxxx] 100%
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

### Direct Migration Process

Since we're the only developer and want to migrate everything directly:

1. Identify all DefaultSchedulerManager usages
2. Replace each with the factory approach in a single sweep
3. Fix any TypeScript errors
4. Delete the DefaultSchedulerManager file once all usages are migrated
5. Run tests to verify everything works correctly 

### Testing Strategy

The testing approach for the scheduler system will focus on practical validation scenarios rather than exhaustive test coverage. We're prioritizing:

1. **Unit Testing (Completed)**
   - Basic component functionality verification
   - Data flow within individual components
   - Boundary cases and error handling

2. **Integration Testing**
   - Component interaction testing
   - Verify that ModularSchedulerManager properly orchestrates all subcomponents
   - Test the factory methods for creating scheduler instances

3. **Real-World Testing**
   - Leverage the existing tests/autonomy directory for real agent scenarios
   - Test the scheduler with typical agent workflows
   - Verify scheduling behaviors match expected patterns in production-like environments

4. **Migration Testing**
   - Create tests that validate the transition from DefaultSchedulerManager
   - Ensure backward compatibility with existing agent implementations
   - Verify that factory-created schedulers behave identically to legacy implementations

This approach focuses on validating the most critical aspects of the scheduler system with emphasis on the practical transition rather than exhaustive test coverage of all possible scenarios. 