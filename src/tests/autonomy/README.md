# Autonomy Testing

This directory contains tests that verify the DefaultAgent's autonomous capabilities.

## Test Categories

### 1. Basic Setup Tests
- `phase1-basic-autonomy.test.ts` - Tests the basic agent setup and structure
- `basic-features.test.ts` - Tests simple agent features

### 2. Scheduler Tests
- `scheduler-polling.test.ts` - Tests the polling mechanism for scheduled tasks
- `scheduler-fix.test.ts` - Tests fixes to the scheduler implementation
- `self-initiation.test.ts` - Tests the agent's ability to self-initiate actions

### 3. Advanced Autonomy Tests
- `async-capabilities.test.ts` - Tests asynchronous task execution
- `real-agent-autonomy.test.ts` - Tests with minimal mocking to verify actual agent behavior
- `task-decomposition.test.ts` - Tests complex task breakdown
- `autonomy-capabilities.test.ts` - Tests specific autonomy capabilities

### 4. Tool Integration Tests
- `tool-integration.test.ts` - Tests integration with different tools

## Running Tests

Run all autonomy tests:
```
npx vitest run src/tests/autonomy
```

Run a specific test file:
```
npx vitest run src/tests/autonomy/scheduler-polling.test.ts
```

## Test Strategy

### Testing Approach

1. **Isolated Component Testing**: Test specific manager components in isolation
2. **Integration Testing**: Verify components work together
3. **End-to-End Testing**: Test complete autonomous workflows

### Mock Requirements

When writing autonomy tests, you'll need to mock:

1. **External APIs**: OpenAI, language models, etc.
2. **Network Requests**: Avoid real API calls
3. **Timers**: For testing scheduling without waiting
4. **File System**: For testing file operations

### Best Practices

1. **Mock OpenAI Properly**:
   ```typescript
   vi.mock('openai', async () => {
     return {
       default: { OpenAI: MockOpenAI },
       OpenAI: MockOpenAI
     };
   });
   ```

2. **Type Assertions for Managers**:
   ```typescript
   const schedulerManager = agent.getManager(ManagerType.SCHEDULER) as SchedulerManager | null;
   ```

3. **Verify Tasks are Due**:
   ```typescript
   // Cast to access the implementation-specific method
   const typedSchedulerManager = schedulerManager as unknown as { pollForDueTasks(): Promise<number> };
   const executedCount = await typedSchedulerManager.pollForDueTasks();
   ```

4. **Setting Polling Intervals**:
   - Use shorter intervals for testing (e.g., 100ms)
   - Longer intervals for production (e.g., 60000ms)

## Configuration Recommendations

When setting up a DefaultAgent for testing:

```typescript
const agent = new DefaultAgent({
  name: "TestAgent",
  enableMemoryManager: true,
  enableToolManager: true,
  enablePlanningManager: true,
  enableSchedulerManager: true,
  enableReflectionManager: true,
  // Configure shorter polling for testing
  schedulerConfig: {
    schedulingIntervalMs: 1000 // 1 second for testing
  }
});
```

## Project Status

All autonomy tests are now passing successfully. We have implemented a comprehensive testing suite that validates:

1. **Basic agent functionality** - Core capabilities like initialization, processing user input, and shutdown
2. **Asynchronous execution** - Testing scheduled tasks, task persistence, and autonomous task execution
3. **Task decomposition** - Validating the agent's ability to break down complex tasks into manageable steps
4. **Autonomy capabilities** - Testing deeper agent capabilities like memory, planning, and reflection

Each test implements proper mocking of dependencies, avoiding the need for real API keys or external services. The tests are designed to skip gracefully when specific capabilities aren't available in the agent implementation.

The test suite serves both as validation of existing functionality and as a roadmap for future development of the agent's autonomy features.

## Test Files

The autonomy test suite includes the following files:

1. **phase1-basic-autonomy.test.ts** - Initial test plan and mock implementation for basic autonomy capabilities
2. **basic-features.test.ts** - Tests for core DefaultAgent features with simple dependencies
3. **simple-agent.test.ts** - Tests for a simple DefaultAgent with properly mocked dependencies
4. **autonomy-capabilities.test.ts** - Comprehensive tests for specific autonomy capabilities
5. **real-agent.test.ts** - Tests the DefaultAgent with more realistic scenarios, properly mocked dependencies
6. **async-capabilities.test.ts** - Tests for asynchronous and scheduled task capabilities
7. **task-decomposition.test.ts** - Tests for complex task breakdown and execution capabilities

## Setup Files

The test infrastructure includes these setup files:

1. **setup/testEnv.ts** - Sets up a controlled test environment with mocked external services
2. **setup/testUtil.ts** - Provides utility functions for common test setup operations

## Approach

Our test approach uses multiple levels of abstraction:

1. **Basic Mocking** - For simpler tests, we mock essential dependencies
2. **Comprehensive Mocking** - For more complex tests, we mock OpenAI, langchain, and other external services
3. **Method Overrides** - We override specific methods like `processUserInput` to control test behavior
4. **Advanced Testing** - We use vi.useFakeTimers() for testing time-dependent behaviors
5. **Deep Autonomy Testing** - We test the agent's ability to operate without user intervention

## Autonomy Capabilities Tested

The tests validate these key capabilities:

1. **Basic Autonomy**
   - Processing user input
   - Maintaining conversation context

2. **Memory**
   - Storing and retrieving memories

3. **Asynchronous Operation**
   - Scheduling tasks for future execution
   - Running tasks without user intervention
   - Self-initiating tasks based on agent reflection

4. **Task Management**
   - Creating and managing tasks
   - Task persistence across agent restarts
   - Monitoring task status

5. **Task Decomposition**
   - Breaking complex tasks into subtasks
   - Tracking progress of multi-step tasks
   - Adapting plans during execution
   - Selecting appropriate tools for subtasks

6. **Planning**
   - Creating execution plans
   - Monitoring execution progress
   - Adapting plans based on new information

7. **Self-Reflection**
   - Evaluating performance
   - Learning from past interactions
   - Self-initiated actions

## Implementation Strategy

The test implementation follows these principles:

1. **Skip unavailable features** - Tests check if capabilities are available before testing them
2. **Proper dependency mocking** - External dependencies are mocked to avoid API key requirements
3. **Testing beyond I/O** - Tests focus on internal processes, not just inputs and outputs
4. **Controlled time** - Time-dependent tests use fake timers for deterministic results
5. **Persistence simulation** - Tests simulate task persistence across agent restarts

## Aligning with Autonomy Audit 

These tests directly address the capabilities outlined in the autonomy audit document:

1. **Self-initiation capabilities** - Tested in async-capabilities.test.ts
2. **Asynchronous task execution** - Tested in async-capabilities.test.ts  
3. **Task decomposition and execution** - Tested in task-decomposition.test.ts
4. **Tool integration validation** - Tested across multiple test files

## Future Improvements

1. Expand test coverage to include more complex scenarios
2. Add more detailed tests for tool usage and selection
3. Implement tests for multi-turn conversations
4. Add performance benchmarks for autonomy features
5. Create integration tests with real external systems
6. Test long-running autonomous operation 