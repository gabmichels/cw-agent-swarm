# Multi-Agent API Tests

This directory contains tests for the multi-agent API endpoints.

## Integration Tests

### Agent API Integration Test

The `agent-api-integration.test.ts` file contains an integration test for the agent creation and retrieval API endpoints. This test verifies that:

1. Agents can be successfully created via the API
2. The correct UUID conversion is applied when storing agents in Qdrant
3. Agents can be successfully retrieved via the API

To run this test:

1. Make sure your development server is running (`npm run dev`)
2. Run the test with: `npx ts-node tests/api/multi-agent/agent-api-integration.test.ts`

This test is designed to be run manually as needed to verify the agent persistence system is working correctly. 