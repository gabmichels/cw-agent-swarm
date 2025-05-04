# Memory System Testing Framework

This directory contains the testing framework for the standardized memory system. The tests are structured to verify functionality at different levels.

## Test Structure

- **Unit Tests**: Test individual components in isolation
- **Integration Tests**: Test multiple components working together
- **Performance Tests**: Measure system performance for key operations

## Test Utilities

We provide several utilities to facilitate testing:

- `MockMemoryClient`: In-memory implementation of the `IMemoryClient` interface
- `MockEmbeddingService`: Deterministic embedding generator
- `test-data-generator.ts`: Utilities to generate test data

## Running Tests

### Unit Tests

Run the unit tests to verify individual components function correctly:

```bash
npm test -- --testPathPattern="src/server/memory/testing/unit"
```

### Integration Tests

Integration tests require a running Qdrant instance. You can configure the connection details with environment variables:

```bash
# Configure test environment
export TEST_QDRANT_URL=http://localhost:6333
export TEST_OPENAI_API_KEY=your-api-key  # Optional, tests will be skipped if missing

# Run integration tests
npm test -- --testPathPattern="src/server/memory/testing/integration"
```

Integration tests will be automatically skipped if no OpenAI API key is provided.

### Performance Tests

Performance tests are disabled by default to avoid unnecessary resource usage. Enable them with environment variables:

```bash
# Enable performance tests
export RUN_PERFORMANCE_TESTS=true

# Optionally enable larger tests
export RUN_LARGE_PERFORMANCE_TESTS=true

# Run performance tests
npm test -- --testPathPattern="src/server/memory/testing/performance"
```

## Adding New Tests

### Unit Tests

1. Add new test files in `unit/`
2. Use the mock implementations for dependencies
3. Test one component at a time

Example:

```typescript
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { MemoryService } from '../../services/memory/memory-service';
import { MockMemoryClient } from '../utils/mock-memory-client';
import { MockEmbeddingService } from '../utils/mock-embedding-service';
import { MemoryType } from '../../config';

describe('MemoryService', () => {
  let mockClient: MockMemoryClient;
  let mockEmbeddingService: MockEmbeddingService;
  let memoryService: MemoryService;
  
  beforeEach(() => {
    mockClient = new MockMemoryClient();
    mockEmbeddingService = new MockEmbeddingService();
    
    // @ts-ignore - MockEmbeddingService needs to be compatible with EmbeddingService
    memoryService = new MemoryService(mockClient, mockEmbeddingService);
  });
  
  test('should add a memory', async () => {
    const result = await memoryService.addMemory({
      content: 'Test memory',
      type: MemoryType.MESSAGE
    });
    
    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();
  });
});
```

### Integration Tests

Integration tests verify that components work together correctly:

```typescript
import { describe, test, expect, beforeAll } from 'vitest';
import { MemoryService } from '../../services/memory/memory-service';
import { QdrantMemoryClient } from '../../services/client/qdrant-client';
import { EmbeddingService } from '../../services/client/embedding-service';
import { MemoryType } from '../../config';

describe('Memory Integration', () => {
  let client: QdrantMemoryClient;
  let memoryService: MemoryService;
  
  beforeAll(async () => {
    client = new QdrantMemoryClient({
      qdrantUrl: process.env.TEST_QDRANT_URL || 'http://localhost:6333'
    });
    
    const embeddingService = new EmbeddingService({
      openAIApiKey: process.env.TEST_OPENAI_API_KEY
    });
    
    memoryService = new MemoryService(client, embeddingService);
  });
  
  test('should store and retrieve memories', async () => {
    // Test code here
  });
});
```

### Performance Tests

Performance tests measure system efficiency:

```typescript
import { describe, test, beforeAll } from 'vitest';
import { measurePerformance } from '../utils/performance';
import { MemoryService } from '../../services/memory/memory-service';
import { MockMemoryClient } from '../utils/mock-memory-client';
import { MockEmbeddingService } from '../utils/mock-embedding-service';
import { MemoryType } from '../../config';
import { generateMemoryPoints } from '../utils/test-data-generator';

describe('Memory Performance', () => {
  test('should measure memory addition speed', async () => {
    const memories = generateMemoryPoints(100, MemoryType.MESSAGE);
    
    const { averageTime } = await measurePerformance(
      'Add 100 memories',
      async () => {
        // Add memories and measure time
      }
    );
    
    console.log(`Average time: ${averageTime}ms`);
  });
});
```

## Best Practices

1. **Isolation**: Unit tests should be isolated and not depend on external systems
2. **Deterministic**: Tests should be deterministic and repeatable
3. **Comprehensive**: Test both happy paths and error cases
4. **Performance**: Be mindful of test execution time, especially for unit tests
5. **Clean Up**: Always clean up test data after integration and performance tests 