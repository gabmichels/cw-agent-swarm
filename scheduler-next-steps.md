# Scheduler Revamp: Next Steps

This document outlines the immediate next steps for completing the scheduler system revamp, focusing specifically on replacing existing DefaultSchedulerManager implementations and resolving TypeScript issues.

## 1. Replace DefaultSchedulerManager Implementations

### 1.1. Identify Usage Locations

Search for all instances of DefaultSchedulerManager across the codebase:

```powershell
# PowerShell search
Get-ChildItem -Recurse -Include "*.ts" | Select-String -Pattern "DefaultSchedulerManager"
```

Expected locations include:
- bootstrap-agent code
- service initialization files
- agent implementation files
- test files

### 1.2. Create Migration Plan

For each identified location:
1. Determine the scope of the change (isolated vs. dependent on other components)
2. Identify any custom configuration requirements
3. Determine if there are any DefaultSchedulerManager-specific features being used
4. Create a targeted migration plan for each location

### 1.3. Replace Implementations

For each identified location, replace the DefaultSchedulerManager with ModularSchedulerManager:

```typescript
// Before
import { DefaultSchedulerManager } from '../path/to/DefaultSchedulerManager';
const scheduler = new DefaultSchedulerManager();
await scheduler.initialize();

// After
import { createSchedulerManager } from '../lib/scheduler/factories/SchedulerFactory';
const scheduler = await createSchedulerManager();
```

### 1.4. Test Each Replacement

For each replaced implementation:
1. Verify that tasks are being scheduled correctly
2. Ensure that task execution works as expected
3. Test any vague temporal expressions for correct parsing
4. Verify that all integration points work correctly

### 1.5. Remove DefaultSchedulerManager

After all implementations have been replaced and tested:
1. Mark the DefaultSchedulerManager as deprecated
2. Add a migration notice in the file
3. Plan for eventual removal in a future release

## 2. Fix TypeScript Issues

### 2.1. Run TypeScript Compiler

Run the TypeScript compiler to identify all type errors:

```powershell
npx tsc
```

### 2.2. Categorize Issues

Group the identified issues by type:
1. Missing type definitions
2. Incompatible types (e.g., string vs. Date)
3. Module resolution issues
4. Interface implementation issues
5. Generic typing issues

### 2.3. Address Type Definition Issues

Update type definitions in scheduler components, particularly focusing on:
- Task model interfaces
- Scheduler interface implementations
- Strategy implementations
- Date/time processor implementation

### 2.4. Fix String vs. Date Type Issues

For the string-to-Date conversions in the scheduler, choose one of these approaches:
1. Update the interfaces to accept string | Date
2. Use type assertions where necessary
3. Create utility functions for conversion

### 2.5. Resolve Module and Import Issues

Fix any module resolution issues:
1. Correct import paths
2. Add missing exports
3. Ensure consistent module structure

### 2.6. Run Tests After Fixes

After each set of fixes:
1. Run TypeScript compiler again to verify fixes
2. Run unit tests to ensure functionality is preserved
3. Run integration tests to verify end-to-end functionality

## 3. Migration Validation

### 3.1. Create a Test Matrix

Create a test matrix covering:
1. All core scheduler functions
2. All vague temporal expressions
3. All complex date/time expressions
4. All scheduling strategies
5. Error handling scenarios

### 3.2. Verify Migration

For each migrated implementation:
1. Run through the test matrix
2. Verify that functionality matches or exceeds the previous implementation
3. Document any differences or enhancements

### 3.3. Monitor in Development

After the migration:
1. Monitor the scheduler performance in development environments
2. Collect feedback from developers using the new implementation
3. Address any issues that arise

## 4. Update Documentation

### 4.1. Update JSDoc Comments

Ensure all components have comprehensive JSDoc comments:
1. All interfaces and their methods
2. All implementation classes
3. All factory functions
4. All utility functions

### 4.2. Create Examples

Create additional examples demonstrating:
1. Complex scheduling scenarios
2. Integration with other system components
3. Common error handling patterns
4. Performance optimization techniques

### 4.3. Update API Documentation

Update the API documentation to reflect any changes:
1. Method signatures
2. Expected behavior
3. Error handling
4. Performance characteristics

## Timeline

| Task | Estimated Time | Priority |
|------|----------------|----------|
| Identify DefaultSchedulerManager usages | 1 day | High |
| Replace bootstrap-agent implementation | 2 days | High |
| Replace other implementations | 3-5 days | High |
| Run TypeScript compiler | 0.5 days | High |
| Fix critical type issues | 2-3 days | High |
| Fix remaining type issues | 3-5 days | Medium |
| Create and run test matrix | 2-3 days | Medium |
| Update documentation | 3-5 days | Medium |

## Conclusion

The scheduler revamp is entering its final phase. The core components are in place, and the focus now shifts to replacing existing implementations and ensuring type safety throughout the codebase. By following this plan, we will complete the transition to the new modular scheduler system and realize its full benefits. 