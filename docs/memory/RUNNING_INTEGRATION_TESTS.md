# Running Memory Integration Tests

This document provides instructions for running the memory system integration tests.

## Prerequisites

1. **OpenAI API Key**
   - You need a valid OpenAI API key for running the tests
   - The key can be set in the environment variable `OPENAI_API_KEY` or in the `.env` file

2. **Qdrant**
   - A running Qdrant instance is required for the tests
   - The default URL is `http://localhost:6333`
   - You can specify a different URL using the `TEST_QDRANT_URL` environment variable

## Configuration

1. **Create a .env file in the project root**
   ```
   OPENAI_API_KEY=your_api_key_here
   TEST_QDRANT_URL=http://localhost:6333  # Optional, defaults to this value
   ```

2. **Or set environment variables directly**
   ```bash
   # On Windows PowerShell
   $env:OPENAI_API_KEY="your_api_key_here"
   $env:TEST_QDRANT_URL="http://localhost:6333"  # Optional
   
   # On Linux/macOS
   export OPENAI_API_KEY="your_api_key_here"
   export TEST_QDRANT_URL="http://localhost:6333"  # Optional
   ```

## Running the Tests

### Option 1: Using the Test Runner Script (Recommended)

The test runner script automatically sets up required collections in Qdrant and runs the tests:

```bash
# Using npm
npm run memory:integration-tests

# Or directly
npx tsx src/server/memory/testing/run-memory-tests.ts
```

### Option 2: Running Tests Manually

#### Step 1: Set up collections
```bash
npx tsx src/server/memory/testing/setup-test-collections.ts
```

#### Step 2: Run the tests
```bash
# Run all memory integration tests
npx vitest --run src/server/memory/testing/integration

# Run a specific test file
npx vitest --run src/server/memory/testing/integration/memory-integration.test.ts
```

## Troubleshooting

### Common Issues

1. **API Key Issues**
   - Ensure your OpenAI API key is valid and has access to embeddings
   - Check that the API key is properly set in the `.env` file or environment variable

2. **Qdrant Connection Issues**
   - Verify that Qdrant is running at the specified URL
   - Check for any firewall or network issues

3. **Test Failures**
   - If tests fail due to invalid IDs, ensure you're using the latest test code with UUID-based IDs
   - If tests fail due to missing collections, run the setup script first

### Logs

Log output contains information about:
- API key loading
- Qdrant connection status
- Collection setup
- Test execution

## Test Implementation Details

Our implementation addresses the following challenges:

1. **UUID-based IDs**: All tests use UUID format for IDs to comply with Qdrant requirements
2. **Memory Type Mapping**: `EXECUTION_OUTCOME` and other special types are stored in `THOUGHT` collection with appropriate metadata
3. **Relationship Methods**: Mock implementations for relationship tracking functionality
4. **Collection Setup**: Automated setup of required collections before test execution

For more details on the implementation, see the [Integration Test Issues](./INTEGRATION_TEST_ISSUES.md) document.

## Skipped Tests

Several tests are currently marked with `.skip()` until known issues are resolved. See [Testing Results](./TESTING_RESULTS.md) for a complete list of skipped tests and their associated issues.

When running tests with the test runner script, you'll see a message indicating how many tests were skipped:

```
Tests completed with 5 skipped tests.
See docs/memory/TESTING_RESULTS.md for details on skipped tests.
```

To enable a skipped test, remove the `.skip` modifier from the test declaration:

```javascript
// Skipped test
test.skip('Should retrieve execution outcomes from standardized memory system', async () => {
  // Test code...
});

// Enabled test
test('Should retrieve execution outcomes from standardized memory system', async () => {
  // Test code...
});
``` 