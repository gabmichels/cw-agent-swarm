# Agent ID Filtering PR Checklist

## Overview
This checklist should be used when reviewing PRs related to the agent ID filtering implementation in the scheduler system.

## Code Changes

### TaskFilter Interface
- [ ] Enhanced `TaskFilter` interface includes proper support for nested metadata filtering
- [ ] `agentId` property is properly typed with `id`, `namespace`, and `type` fields
- [ ] Documentation comments explain the purpose of each field

### ModularSchedulerManager
- [ ] Added `findTasksForAgent` method with proper error handling
- [ ] Added `createTaskForAgent` method with proper error handling
- [ ] Added `executeDueTasksForAgent` method with proper error handling
- [ ] All agent-specific methods are properly documented
- [ ] All agent-specific methods use the correct metadata structure

### MemoryTaskRegistry
- [ ] Updated filtering logic handles nested metadata objects correctly
- [ ] Properly handles multiple levels of nesting for complex metadata
- [ ] Maintains backward compatibility with existing filtering

### SchedulerFactory
- [ ] Added `createSchedulerManagerForAgent` factory function
- [ ] Factory function properly overrides methods to filter by agent ID
- [ ] Factory function correctly adds agent ID to created tasks
- [ ] Factory function handles the case when no agent ID is provided

## Tests

- [ ] Tests for `findTasksForAgent` verify correct filtering
- [ ] Tests for `createTaskForAgent` verify agent ID is properly added
- [ ] Tests for `executeDueTasksForAgent` verify only agent-specific tasks are executed
- [ ] Tests verify that agent-specific scheduler instances work correctly
- [ ] Tests cover edge cases (missing metadata, null values, etc.)

## Documentation

- [ ] Updated or created design documentation for agent ID filtering
- [ ] Created implementation plan with next steps
- [ ] Created migration guide with emphasis on using `createTaskForAgent`
- [ ] Documentation includes examples of proper agent ID usage

## Migration Support

- [ ] Created audit script to identify direct uses of `createTask`
- [ ] Added warnings or deprecation notices in `createTask` method
- [ ] Created helper functions for migrating existing tasks to include agent IDs

## Critical Requirements

- [ ] All new task creation MUST use `createTaskForAgent` instead of `createTask`
- [ ] All task filtering for agent-specific tasks MUST use `findTasksForAgent`
- [ ] All task execution for agent-specific tasks MUST use `executeDueTasksForAgent`
- [ ] Agent IDs MUST be stored in the correct nested metadata structure

## Review Questions

1. Are there any places where `createTask` is used directly instead of `createTaskForAgent`?
2. Does the implementation properly handle tasks without agent IDs for backward compatibility?
3. Is the filtering logic efficient for large numbers of tasks?
4. Are there clear migration paths for existing code?
5. Is the agent ID structure consistent across all components?
6. Are there appropriate error messages when agent ID is missing or invalid?

## Post-Merge Tasks

- [ ] Run the audit script to identify any remaining direct uses of `createTask`
- [ ] Update existing code to use agent-specific methods
- [ ] Monitor performance to ensure filtering efficiency
- [ ] Consider adding runtime warnings for tasks created without agent IDs 