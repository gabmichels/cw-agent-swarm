# Agent E2E Testing Setup Guide

This document provides practical instructions for setting up and running the end-to-end tests outlined in the `AGENT_E2E_TESTING_PLAN.md`.

## Prerequisites

Before setting up the E2E tests, ensure you have the following:

1. Node.js (v14 or higher)
2. npm or yarn
3. Jest installed globally or as a dev dependency
4. TypeScript configured in your project

## Setting Up the Testing Environment

### 1. Create Testing Directory Structure

First, create the necessary directory structure for your tests:

```powershell
# Create main directories
New-Item -ItemType Directory -Path "tests/e2e" -Force
New-Item -ItemType Directory -Path "tests/e2e/agents" -Force 
New-Item -ItemType Directory -Path "tests/e2e/helpers" -Force
New-Item -ItemType Directory -Path "tests/e2e/fixtures" -Force
```

### 2. Configure Jest for E2E Tests

Create a Jest configuration file specifically for E2E tests:

```powershell
# Create Jest config for E2E tests
New-Item -ItemType File -Path "jest.config.e2e.js" -Force
```

Add the following content to the configuration file:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/e2e/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/e2e/helpers/setup.ts'],
  globalSetup: '<rootDir>/tests/e2e/helpers/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/e2e/helpers/globalTeardown.ts',
  testTimeout: 30000, // 30 seconds timeout for E2E tests
  verbose: true,
};
```

### 3. Create Test Helpers

Create the necessary helper files for test setup and teardown:

#### Global Setup

```powershell
# Create helper files
New-Item -ItemType File -Path "tests/e2e/helpers/globalSetup.ts" -Force
```

Add the following content:

```typescript
// tests/e2e/helpers/globalSetup.ts
import { createTestDatabase } from './testDatabase';

async function globalSetup() {
  console.log('Setting up E2E test environment...');
  
  // Create test database
  await createTestDatabase();
  
  // Set environment variables for testing
  process.env.NODE_ENV = 'test';
  process.env.TEST_DATABASE_URL = 'sqlite::memory:';
  process.env.DISABLE_EXTERNAL_API_CALLS = 'true';
  
  console.log('E2E test environment setup complete.');
}

export default globalSetup;
```

#### Global Teardown

```powershell
New-Item -ItemType File -Path "tests/e2e/helpers/globalTeardown.ts" -Force
```

Add the following content:

```typescript
// tests/e2e/helpers/globalTeardown.ts
import { cleanupTestDatabase } from './testDatabase';

async function globalTeardown() {
  console.log('Cleaning up E2E test environment...');
  
  // Clean up test database
  await cleanupTestDatabase();
  
  console.log('E2E test environment cleanup complete.');
}

export default globalTeardown;
```

#### Test Setup

```powershell
New-Item -ItemType File -Path "tests/e2e/helpers/setup.ts" -Force
```

Add the following content:

```typescript
// tests/e2e/helpers/setup.ts
import { DefaultAgentFactory } from '../../../src/agents/shared/factories/DefaultAgentFactory';

// Extend Jest matchers
expect.extend({
  toBeCompletedPlan(received) {
    const pass = received.status === 'COMPLETED';
    return {
      message: () => `expected plan to ${pass ? 'not ' : ''}be completed`,
      pass,
    };
  },
  toHaveValidMemoryId(received) {
    const pass = typeof received === 'string' && received.length > 0;
    return {
      message: () => `expected ${received} to ${pass ? 'not ' : ''}be a valid memory ID`,
      pass,
    };
  },
});

// Global test setup for each file
beforeAll(() => {
  jest.setTimeout(30000); // 30 seconds timeout
});

// Setup test agent factory
global.createTestAgentFactory = async () => {
  return new DefaultAgentFactory();
};

// Setup agent creation helper
global.createTestAgent = async (config) => {
  const factory = await global.createTestAgentFactory();
  return factory.createAgent({
    agentId: `test-agent-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    config: {
      // Default test configuration
      enableMemoryManager: true,
      enableToolManager: true,
      enablePlanningManager: true,
      // Override with custom config
      ...config,
    },
  });
};
```

#### Test Database Helper

```powershell
New-Item -ItemType File -Path "tests/e2e/helpers/testDatabase.ts" -Force
```

Add the following content:

```typescript
// tests/e2e/helpers/testDatabase.ts
// Simple in-memory database for testing

let testDatabase = {
  memories: new Map(),
  plans: new Map(),
  tools: new Map(),
  tasks: new Map(),
  agents: new Map(),
  messages: new Map(),
  resources: new Map(),
  workspaces: new Map(),
};

export async function createTestDatabase() {
  // Reset database to initial state
  testDatabase = {
    memories: new Map(),
    plans: new Map(),
    tools: new Map(),
    tasks: new Map(),
    agents: new Map(),
    messages: new Map(),
    resources: new Map(),
    workspaces: new Map(),
  };
  
  return testDatabase;
}

export async function cleanupTestDatabase() {
  // Clear all data
  testDatabase.memories.clear();
  testDatabase.plans.clear();
  testDatabase.tools.clear();
  testDatabase.tasks.clear();
  testDatabase.agents.clear();
  testDatabase.messages.clear();
  testDatabase.resources.clear();
  testDatabase.workspaces.clear();
}

export function getTestDatabase() {
  return testDatabase;
}
```

### 4. Create Test Fixtures

Create fixture files for common test data:

```powershell
New-Item -ItemType File -Path "tests/e2e/fixtures/memoryFixtures.ts" -Force
```

Add the following content:

```typescript
// tests/e2e/fixtures/memoryFixtures.ts
import { MemoryType } from '../../../src/agents/shared/types/MemoryTypes';

export const testMemories = [
  {
    type: MemoryType.THOUGHT,
    content: 'Test thought for memory retrieval',
    metadata: { importance: 'high', context: 'testing' }
  },
  {
    type: MemoryType.FACT,
    content: 'The sky is blue',
    metadata: { category: 'nature', importance: 'low' }
  },
  {
    type: MemoryType.KNOWLEDGE,
    content: 'TypeScript is a typed superset of JavaScript',
    metadata: { category: 'programming', importance: 'medium' }
  },
  {
    type: MemoryType.DOCUMENT,
    content: 'This is a test document for version history testing',
    metadata: { version: 1, category: 'documentation' }
  }
];
```

```powershell
New-Item -ItemType File -Path "tests/e2e/fixtures/planFixtures.ts" -Force
```

Add the following content:

```typescript
// tests/e2e/fixtures/planFixtures.ts
export const testPlans = [
  {
    goal: 'Summarize article',
    context: 'Need to extract key information from a news article',
    constraints: {
      timeLimit: 30,
      maxSteps: 3
    },
    steps: [
      {
        action: 'fetchArticle',
        parameters: { url: '{articleUrl}' }
      },
      {
        action: 'extractKeyPoints',
        parameters: { maxPoints: 5 }
      },
      {
        action: 'createSummary',
        parameters: { format: 'paragraph', maxLength: 200 }
      }
    ]
  },
  {
    goal: 'Research topic',
    context: 'Need to research a specific topic and collect information',
    constraints: {
      timeLimit: 120,
      maxSteps: 5
    },
    steps: [
      {
        action: 'searchTopic',
        parameters: { query: '{topic}', maxResults: 3 }
      },
      {
        action: 'collectInformation',
        parameters: { sourcesToUse: 'all', categories: ['main', 'details'] }
      },
      {
        action: 'organizeInformation',
        parameters: { structure: 'hierarchical' }
      },
      {
        action: 'validateInformation',
        parameters: { checkConsistency: true }
      },
      {
        action: 'createReport',
        parameters: { format: 'structured', includeReferences: true }
      }
    ]
  }
];
```

### 5. Create E2E Test Files

Based on the sample tests in the examples folder, create the actual E2E test files:

```powershell
# Create test files
New-Item -ItemType File -Path "tests/e2e/agents/AgentMemory.test.ts" -Force
New-Item -ItemType File -Path "tests/e2e/agents/AgentPlanning.test.ts" -Force
New-Item -ItemType File -Path "tests/e2e/agents/AgentCollaboration.test.ts" -Force
```

For each test file, adapt the examples to use the test helpers and fixtures.

### 6. Add NPM Script

Add a script to your package.json file to run the E2E tests:

```json
{
  "scripts": {
    "test:e2e": "jest --config jest.config.e2e.js"
  }
}
```

## Running the Tests

To run the E2E tests, use the following command:

```powershell
npm run test:e2e
```

To run a specific test file:

```powershell
npm run test:e2e -- tests/e2e/agents/AgentMemory.test.ts
```

To run in watch mode during development:

```powershell
npm run test:e2e -- --watch
```

## Best Practices for E2E Tests

When implementing and running E2E tests, follow these guidelines:

1. **Isolation**: Each test should be able to run independently
2. **Cleanup**: Always clean up resources created during tests
3. **Mock External Systems**: Use the mock system to avoid external API calls
4. **Timeouts**: Set appropriate timeouts for async operations
5. **Logging**: Include detailed logging to help debug test failures
6. **Retries**: Consider adding retry logic for flaky operations
7. **Deterministic IDs**: Use deterministic IDs for test resources where possible
8. **Performance**: Monitor test execution time and optimize slow tests

## Troubleshooting Common Issues

### Tests Timing Out

If tests are timing out, consider:
- Increasing the timeout value in Jest configuration
- Checking for hanging promises or unresolved async operations
- Adding more detailed logging to identify slow operations

### Database Connection Issues

If you encounter database connection issues:
- Ensure the test database setup is working correctly
- Check if the database is being properly cleaned between tests
- Verify that the test is using the test database URL

### Flaky Tests

For flaky tests:
- Add retry logic for operations that might occasionally fail
- Use more deterministic test data
- Ensure proper cleanup between tests
- Add more detailed assertions to isolate the issue

## Next Steps

After setting up the basic E2E testing framework, consider these enhancements:

1. **Test Coverage Analysis**: Add coverage reporting for E2E tests
2. **CI Integration**: Configure your CI system to run E2E tests
3. **Test Visualization**: Add a UI for visualizing test results
4. **Parallel Execution**: Set up parallel test execution for faster feedback
5. **Performance Testing**: Add performance benchmarks to the E2E tests

## Conclusion

This setup guide provides the foundation for implementing comprehensive E2E tests for the agent architecture. By following these instructions, you can create a robust testing system that validates the critical functionalities of your agents while avoiding the complexity of exhaustive integration testing.

Remember that E2E tests should focus on complete workflows and critical paths rather than trying to test every integration point. This approach gives you confidence in your system while maintaining reasonable test execution times and manageable test maintenance. 