# Chat Integration Tests

This directory contains integration tests for the chat functionality.

## Overview

These tests verify:

1. Direct chat creation and retrieval via the API
2. Automatic chat creation during agent creation
3. Proper chat storage in Qdrant
4. Retrieval by ID and by user/agent pair

## Running the Tests

To run all chat integration tests:

```bash
# Make sure your dev server is running
npm run dev

# In a separate terminal, run the tests
node tests/integration-tests/chat/index.js
```

To run specific tests:

```bash
# Test direct chat creation only
node tests/integration-tests/chat/direct-chat.test.js

# Test chat creation via agent creation only
node tests/integration-tests/chat/chat-creation.test.js
```

## Test Files

- `direct-chat.test.js` - Tests creating chats directly via the API and retrieving them
- `chat-creation.test.js` - Tests automatic chat creation when creating a new agent
- `index.js` - Runs all chat integration tests sequentially 