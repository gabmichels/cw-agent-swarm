/**
 * AgentMonitorTest.ts - Example usage of the AgentMonitor
 * 
 * This file demonstrates how to use AgentMonitor for logging
 * different types of agent activities and events.
 */

import { AgentMonitor } from './AgentMonitor';

/**
 * Run a set of example logs to demonstrate AgentMonitor usage
 */
async function runAgentMonitorExample() {
  console.log('Starting AgentMonitor example...');
  
  // Clear any existing logs
  AgentMonitor.clear();
  
  // Example 1: Simple task completion
  AgentMonitor.log({
    agentId: 'researcher',
    taskId: 'task-abc123',
    eventType: 'task_end',
    status: 'success',
    timestamp: Date.now(),
    durationMs: 2400,
    delegationContextId: 'ctx-xyz789',
    tags: ['intel', 'summarization'],
  });
  
  // Example 2: Task delegation
  const delegationId = 'delegation-123';
  AgentMonitor.log({
    agentId: 'coordinator',
    taskId: 'task-def456',
    eventType: 'delegation',
    timestamp: Date.now(),
    delegationContextId: delegationId,
    tags: ['delegation', 'research'],
    metadata: {
      targetAgentId: 'researcher',
      priority: 'high'
    }
  });
  
  // Example 3: Tool usage
  const toolStartTime = Date.now();
  AgentMonitor.log({
    agentId: 'assistant',
    taskId: 'task-ghi789',
    eventType: 'tool_start',
    toolUsed: 'web_search',
    timestamp: toolStartTime,
    tags: ['tool', 'web'],
    metadata: {
      query: 'latest AI research papers'
    }
  });
  
  // Simulate tool execution time
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  AgentMonitor.log({
    agentId: 'assistant',
    taskId: 'task-ghi789',
    eventType: 'tool_end',
    toolUsed: 'web_search',
    status: 'success',
    timestamp: Date.now(),
    durationMs: Date.now() - toolStartTime,
    tags: ['tool', 'web'],
    metadata: {
      resultCount: 15
    }
  });
  
  // Example 4: Error handling
  AgentMonitor.log({
    agentId: 'planner',
    taskId: 'task-jkl012',
    eventType: 'error',
    status: 'failure',
    timestamp: Date.now(),
    errorMessage: 'Failed to connect to external API',
    tags: ['error', 'api'],
    metadata: {
      apiEndpoint: '/data/fetch',
      statusCode: 503
    }
  });
  
  // View all logs
  const allLogs = AgentMonitor.getLogs();
  console.log(`Total logs: ${allLogs.length}`);
  console.log('All logs:', JSON.stringify(allLogs, null, 2));
  
  // Filter logs by agent
  const researcherLogs = AgentMonitor.getLogs({ agentId: 'researcher' });
  console.log(`Researcher logs: ${researcherLogs.length}`);
  
  // Filter logs by event type
  const errorLogs = AgentMonitor.getLogs({ eventType: 'error' });
  console.log(`Error logs: ${errorLogs.length}`);
  
  // Get recent failures
  const recentFailures = AgentMonitor.getRecentFailures(2);
  console.log(`Recent failures: ${recentFailures.length}`);
  
  // Export logs to file
  await AgentMonitor.exportLogsToFile('./agent_logs.json');
  console.log('Logs exported to file');
  
  console.log('AgentMonitor example completed');
}

// Run the example if this file is executed directly
if (require.main === module) {
  runAgentMonitorExample().catch(console.error);
}

export { runAgentMonitorExample }; 