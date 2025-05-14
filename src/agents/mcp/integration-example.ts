/**
 * integration-example.ts
 * 
 * Simplified example demonstrating how to use MCP to route tasks
 * based on capabilities and health.
 */

import { MCPRuntime, PlannedTask, SubAgent, TaskResult } from './MCPRuntime';
import { initializeMCP } from './index';

/**
 * Example of using MCP to route tasks
 */
async function mcpRoutingExample(): Promise<void> {
  try {
    // 1. Initialize the MCP (this registers all available agents)
    await initializeMCP();
    
    // 2. Define a task for MCP to route
    const researchTask: PlannedTask = {
      id: `task-${Date.now()}`,
      title: 'Research quantum computing advances',
      description: 'Find the latest advances in quantum computing from the past 6 months.',
      priority: 'medium',
      capabilities: ['research', 'web_search'],
      tags: ['research', 'quantum_computing', 'technology'],
      roles: ['researcher']
    };
    
    console.log(`MCP routing task: ${researchTask.title}`);
    
    // 3. Find the best agent for this task through MCP
    const selectedAgent = MCPRuntime.routeTask(researchTask);
    
    if (selectedAgent) {
      console.log(`Task routed to agent: ${selectedAgent.id}`);
      console.log(`Agent capabilities: ${selectedAgent.capabilities.join(', ')}`);
      
      try {
        // 4. Execute the task via MCP
        const result = await MCPRuntime.executeViaMCP(researchTask);
        console.log('Task executed successfully via MCP:', result);
      } catch (error) {
        console.error('Error executing task via MCP:', error);
      }
    } else {
      console.log('No suitable agent found for this task');
      
      // 5. Register a dynamic agent to handle this specific task
      console.log('Registering a dynamic agent for this task...');
      
      const dynamicAgent: SubAgent = {
        id: `dynamic-agent-${Date.now()}`,
        name: 'Dynamic Research Agent',
        description: 'Dynamically created agent for research tasks',
        capabilities: ['research', 'web_search'],
        roles: ['researcher'],
        tags: ['research', 'dynamic'],
        execute: async (task: PlannedTask): Promise<TaskResult> => {
          console.log(`[Dynamic Agent] Executing task: ${task.title}`);
          // This would normally call another agent implementation
          return {
            success: true,
            message: `Completed research on ${task.title}`,
            data: { result: `Simulated research results for ${task.description}` }
          };
        }
      };
      
      // Register the dynamic agent with MCP
      MCPRuntime.registerAgent(dynamicAgent);
      console.log(`Registered dynamic agent with id: ${dynamicAgent.id}`);
      
      // Try routing again
      const retryResult = await MCPRuntime.executeViaMCP(researchTask);
      console.log('Task executed with dynamic agent:', retryResult);
    }
    
    // 6. Example: Getting agent health and status
    const agentStatuses = MCPRuntime.getAgentHealthStatus();
    console.log('Agent Health Status:', agentStatuses);
    
    // 7. Example: Getting all registered agents
    const allAgents = MCPRuntime.getAllAgents();
    console.log(`Registered Agents (${allAgents.length}):`, 
      allAgents.map(a => `${a.id} (${a.status})`));
  } catch (error) {
    console.error('Error in MCP example:', error);
  }
}

/**
 * Example of tasks with different capabilities
 */
async function taskCapabilityExample(): Promise<void> {
  try {
    // Define tasks with different capability requirements
    const tasks: PlannedTask[] = [
      {
        id: 'task-research-1',
        title: 'Market Research for AI Products',
        description: 'Research the current market landscape for AI-powered productivity tools.',
        priority: 'high',
        capabilities: ['research', 'market_analysis'],
        tags: ['research', 'market', 'ai']
      },
      {
        id: 'task-content-1',
        title: 'Write Blog Post',
        description: 'Write a blog post about emerging AI technologies.',
        priority: 'medium',
        capabilities: ['content_creation', 'writing'],
        tags: ['content', 'blog', 'ai']
      }
    ];
    
    // Process each task and see which agent gets selected
    for (const task of tasks) {
      console.log(`\nRouting task: ${task.title}`);
      
      // Find the best agent for this task
      const agent = MCPRuntime.routeTask(task);
      
      if (agent) {
        console.log(`- Task routed to agent: ${agent.id}`);
        console.log(`- Agent capabilities: ${agent.capabilities.join(', ')}`);
      } else {
        console.log(`- No suitable agent found for task with capabilities: ${task.capabilities?.join(', ')}`);
      }
    }
  } catch (error) {
    console.error('Error in task capability example:', error);
  }
}

/**
 * Run the examples when this file is executed directly
 */
if (require.main === module) {
  console.log('Running MCP integration examples...');
  
  // Run examples
  mcpRoutingExample().then(() => {
    return taskCapabilityExample();
  }).then(() => {
    console.log('Examples completed');
  }).catch(error => {
    console.error('Error in examples:', error);
  });
} 