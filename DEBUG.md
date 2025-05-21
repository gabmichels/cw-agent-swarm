# Debugging the Agent System

This document provides an overview of the debugging tools available for troubleshooting the agent system. These tools help you understand what's happening behind the scenes when agents aren't responding as expected.

## Available Debugging Commands

These commands are available through npm/pnpm:

| Command | Description |
|---------|-------------|
| `npm run dev:with-bootstrap:debug` | Start with bootstrap and enhanced debug logging |
| `npm run dev:with-mock` | Start with mock web search enabled (for testing without API keys) |
| `npm run bootstrap:debug` | Run bootstrap with debug logging (no web server) |
| `npm run debug` | Enable enhanced debug logging |
| `npm run monitor` | Monitor agent tasks in real-time |
| `npm run test:web-search` | Test web search functionality |

## Common Issues and Solutions

### No Agent Activity in Console

If you're experiencing issues where the agent system doesn't show any activity in the console:

1. Run `npm run monitor` to see if any tasks are being created but not processed
2. Check if autonomy mode is enabled through the monitor
3. Use `npm run dev:with-bootstrap:debug` to see detailed logs of all agent activities

### Web Searches Not Working

If the agent doesn't seem to be performing web searches:

1. Run `npm run test:web-search` to test if web search functionality is working
2. Check if your `APIFY_API_KEY` environment variable is set correctly
3. Try using `npm run dev:with-mock` to enable mock web searches that don't require API keys

## Debugging Tools Overview

### Enhanced Debug Mode (`enable-debug-mode.js`)

This script patches the core agent system to output detailed logs about:

- Agent task execution
- Autonomy system operations
- Web search activities
- Processing of opportunities

**Usage:**
```
npm run debug
```

### Task Monitor (`monitor-tasks.js`)

This real-time monitoring tool shows:

- All registered agents in the system
- Each agent's autonomy mode status (enabled/disabled)
- Active tasks for each agent
- Web search configuration status

**Usage:**
```
npm run monitor
```

### Web Search Tester (`test-web-search.js`)

Tests if the web search functionality is properly configured:

- Checks for required environment variables
- Tests a sample search query
- Displays search results if successful

**Usage:**
```
npm run test:web-search
```

### Mock Web Search (`mock-web-search.ts`)

Provides fallback search results when real web search fails:

- Generate realistic-looking search results
- Used automatically when `USE_MOCK_SEARCH=true` or in development mode
- Can be explicitly enabled with `npm run dev:with-mock`

### Bootstrap with Debug (`bootstrap-with-debug.js`)

Combines the bootstrap process with enhanced logging:

- Initializes agents from database
- Sets up the MCP agent system
- Enables detailed debug logging
- Can optionally start the Next.js server

**Usage:**
```
npm run bootstrap:debug        # Bootstrap only
npm run dev:with-bootstrap:debug  # Bootstrap and start Next.js
```

## Troubleshooting Specific Issues

### Agent Not Processing Strategy Guide Requests

If the agent isn't processing strategy guide requests, check:

1. Is the autonomy system enabled? Use `npm run monitor` to check
2. Are web searches working? Run `npm run test:web-search` to verify
3. Try with mock search enabled: `npm run dev:with-mock`

### Debugging Agent Execution

To see detailed logs of agent execution:

1. Run `npm run debug`
2. Look for logs with the `[AUTONOMY DEBUG]` prefix
3. Check web search logs with the `[WEB SEARCH DEBUG]` prefix

## Adding More Debug Information

If you need to add more debug information:

1. Edit `enable-debug-mode.js` to patch additional components
2. Use `console.debug`, `console.info`, etc. for properly formatted logs

## Environment Variables for Debugging

| Variable | Purpose |
|----------|---------|
| `DEBUG_LEVEL=verbose` | Enable verbose logging |
| `AGENT_DEBUG=true` | Enable agent debugging |
| `AUTONOMY_DEBUG=true` | Enable autonomy system debugging |
| `USE_MOCK_SEARCH=true` | Force use of mock web search | 