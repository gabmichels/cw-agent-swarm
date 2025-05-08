# Multi-Agent System Integration Testing Guide

## Overview

This document describes the integration testing approach for the multi-agent system, with a focus on WebSocket communication and agent-to-agent interactions. These tests validate that the various components of the system work together correctly in real-world scenarios.

## Testing Approach

Our integration testing follows these key principles:

1. **End-to-End Communication Testing**: Tests cover the full communication path from client connections through WebSocket server to notification delivery.
2. **Multi-Agent Scenarios**: Tests simulate realistic multi-agent collaboration scenarios.
3. **Failure Recovery**: Tests verify that the system recovers gracefully from disconnections and failures.
4. **Concurrent Operations**: Tests validate correct behavior during concurrent message processing.
5. **Performance Validation**: Tests ensure the WebSocket system handles multiple subscribers efficiently.

## Test Environment

Integration tests run in a controlled environment with:

- A local HTTP server running on a test port
- Socket.IO for client-server communication
- In-memory implementations of key services (no database dependencies)
- Vitest as the test framework
- Mock data for agents, chats, and messages

## Key Test Cases

### WebSocket Core Functionality

1. **Basic Connectivity**: Verifies clients can connect and receive server events
2. **Chat Subscription**: Tests subscribing/unsubscribing to chat events
3. **Agent Subscription**: Tests subscribing/unsubscribing to agent updates
4. **Message Receipt**: Verifies messages are delivered to all relevant subscribers
5. **System Notifications**: Tests system-wide notification delivery

### Agent Collaboration Scenarios

1. **Task Delegation Flow**: Tests complete workflows with multiple specialized agents
   - Task assignment from user to initial agent
   - Task delegation between agents
   - Status updates during processing
   - Result delivery back to user
   
2. **Agent Reconnection**: Tests chat continuity during agent disconnection/reconnection
   - Message delivery to remaining agents when one agent disconnects
   - Proper reconnection and subscription restoration
   - Continued message flow after reconnection

3. **Concurrent Operations**: Tests ordering guarantees during rapid messages exchange
   - Message order preservation during concurrent agent activities
   - Correct message delivery to all subscribers
   - Performance under load

## Test Implementation

The integration tests are implemented in two primary test files:

1. **Multi-Agent WebSocket Integration Tests** (`multi-agent-integration.test.ts`)
   - Focuses on basic WebSocket functionality
   - Tests notification routing to subscribers
   - Verifies message delivery to correct recipients
   
2. **Agent Collaboration Integration Tests** (`agent-collaboration-integration.test.ts`)
   - Tests complex multi-agent collaboration scenarios
   - Simulates task delegation between specialized agents
   - Validates agent disconnection and reconnection handling
   - Tests concurrent message processing

## Test Data

Tests use mock implementations of the following data:

- **Specialized Agents**: Research Agent, Analysis Agent, Summary Agent
- **Collaborative Chat**: A shared workspace for agent collaboration
- **Task-Oriented Messages**: Messages with task metadata for delegation

```typescript
// Example of mock specialized agent
const researchAgent = createMockAgent('agent_research', 'Research Agent', ['research', 'information_retrieval']);

// Example of mock collaborative chat
const collaborativeChat = createMockChat(
  'chat_collab', 
  'Collaborative Research Project',
  ['agent_research', 'agent_analysis', 'agent_summary', 'user_admin']
);

// Example of mock task message
const taskMessage = {
  id: 'msg_1',
  chatId: collaborativeChat.id.toString(),
  senderId: 'user_admin',
  senderType: 'user',
  content: {
    text: 'Please research the latest developments in multi-agent systems.',
    task: {
      id: 'task_research_topic',
      type: 'request',
      assignedTo: researchAgent.id.toString()
    }
  },
  timestamp: Date.now()
};
```

## Running the Tests

Integration tests can be run using the Vitest test runner:

```bash
npm run test:integration
```

Or for specific test files:

```bash
npm run test -- src/server/websocket/__tests__/multi-agent-integration.test.ts
npm run test -- src/server/websocket/__tests__/agent-collaboration-integration.test.ts
```

## Test Design Patterns

The tests follow several design patterns for effective integration testing:

1. **Isolated Test Servers**: Each test suite creates its own HTTP/WebSocket server on unique ports
2. **Client Factory Pattern**: Helper function to create and track client sockets
3. **Mock Event Handlers**: Vi mock functions to track event receipt and assertions
4. **Controlled Timing**: Small delays to ensure events are processed sequentially
5. **Connection Pool Cleanup**: Proper teardown of all connections after each test

## Common Issues and Troubleshooting

1. **Socket Connection Failures**: Ensure ports are not in use by other tests/processes
2. **Race Conditions**: Add appropriate delays between operations
3. **Timeout Issues**: Increase test timeouts for complex scenarios
4. **Memory Leaks**: Check for unclosed sockets or unsubscribed listeners

## Future Test Expansion

Additional integration tests should be developed to cover:

1. Authorization and authentication with the WebSocket server
2. Load testing with high message volumes
3. Real database integration (not just in-memory mocks)
4. Edge cases around error handling and recovery
5. UI component integration with WebSocket events

## Best Practices

When writing new integration tests, follow these best practices:

1. Keep tests independent - each test should be able to run in isolation
2. Clean up all resources (sockets, servers) after tests complete
3. Use realistic mock data that reflects actual system behavior
4. Test both happy paths and edge cases
5. Separate setup code from assertions for readability
6. Add descriptive comments explaining the purpose of each test
7. Use appropriate timeouts for asynchronous operations

## Conclusion

The integration tests validate the critical WebSocket communication layer that enables agent-to-agent interaction. These tests provide confidence that the multi-agent system can support complex collaboration workflows, handle disconnections gracefully, and maintain message ordering even during concurrent operations.

By thoroughly testing these scenarios before UI integration, we reduce the risk of discovering issues later in the development process when they would be more costly to fix. 