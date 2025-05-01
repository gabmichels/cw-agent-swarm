/**
 * integration-example.ts
 * 
 * Example demonstrating how to integrate the MCP with existing agents like Chloe
 * to route tasks based on capabilities and health.
 */

import { ChloeCoordinator } from '../chloe/ChloeCoordinator';
import { MCPRuntime, PlannedTask, TaskResult } from './MCPRuntime';
import { initializeMCP } from './index';

/**
 * Example of updating Chloe's delegation to use MCP
 */
async function chloeWithMCPExample(): Promise<void> {
  try {
    // 1. Initialize the MCP (this registers all agents)
    await initializeMCP();

    // 2. Create or get Chloe instance
    const chloe = new ChloeCoordinator({
      config: {
        agentId: 'chloe',
        name: 'Chloe',
        description: 'Chloe Coordinator Agent',
        model: 'gpt-4',
        temperature: 0.7
      }
    });
    
    // 3. Initialize Chloe
    await chloe.initialize();
    
    // 4. Define a task for Chloe to delegate
    const researchTask: PlannedTask = {
      id: `task-${Date.now()}`,
      title: 'Research quantum computing advances',
      description: 'Find the latest advances in quantum computing from the past 6 months.',
      priority: 'medium',
      capabilities: ['research', 'web_search'],
      tags: ['research', 'quantum_computing', 'technology'],
      roles: ['researcher']
    };
    
    console.log(`Delegating task: ${researchTask.title}`);
    
    // 5. Execute the task via MCP instead of directly
    try {
      // OLD WAY (direct delegation to specific agent)
      // const result = await chloe.delegateTask('research-agent-1', researchTask.description);
      
      // NEW WAY (using MCP for routing based on capabilities)
      const result = await MCPRuntime.executeViaMCP(researchTask);
      
      console.log('Task executed successfully via MCP:', result);
    } catch (error) {
      console.error('Error executing task via MCP:', error);
    }
    
    // 6. Example: Getting agent health and status
    const agentStatuses = MCPRuntime.getAgentHealthStatus();
    console.log('Agent Health Status:', agentStatuses);
    
    // 7. Example: Getting all registered agents
    const allAgents = MCPRuntime.getAllAgents();
    console.log(`Registered Agents (${allAgents.length}):`, 
      allAgents.map(a => `${a.id} (${a.status})`));
  } catch (error) {
    console.error('Error in MCP integration example:', error);
  }
}

/**
 * Example of routing a task based on capabilities
 */
async function taskRoutingExample(): Promise<void> {
  try {
    // First make sure MCP is initialized
    await initializeMCP();
    
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
        
        // Execute the task if desired
        // const result = await MCPRuntime.executeViaMCP(task);
        // console.log(`- Task result:`, result);
      } else {
        console.log(`- No suitable agent found for task with capabilities: ${task.capabilities?.join(', ')}`);
      }
    }
  } catch (error) {
    console.error('Error in task routing example:', error);
  }
}

/**
 * Run the examples when this file is executed directly
 */
if (require.main === module) {
  console.log('Running MCP integration examples...');
  
  // Run examples
  chloeWithMCPExample().then(() => {
    return taskRoutingExample();
  }).then(() => {
    console.log('Examples completed');
  }).catch(error => {
    console.error('Error in examples:', error);
  });
} 