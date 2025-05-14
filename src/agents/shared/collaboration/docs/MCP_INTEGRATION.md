# MCP Integration with UI-Created Agents

The Multi-Agent Control Plane (MCP) provides a powerful orchestration layer for coordinating multiple agents. This document explains how to integrate MCP with agents that are created through the UI and stored in the database.

## Overview

When agents are created through the UI interface, they are stored in the database with their configurations. These agents still need to be registered with the MCP at runtime to participate in task routing and execution.

## Integration Steps

### 1. Agent Registration Hook

The key to integrating database agents with MCP is implementing a registration hook that runs when agents are loaded:

```typescript
// In your agent loader/startup code
async function loadAndRegisterAgents() {
  // 1. Load agents from the database
  const agents = await agentRepository.getAllActiveAgents();
  
  // 2. Register each agent with MCP
  for (const agentConfig of agents) {
    // Create an adapter that implements the SubAgent interface expected by MCP
    const mcpAgent = createMCPAgentAdapter(agentConfig);
    
    // Register with MCP
    MCPRuntime.registerAgent(mcpAgent);
    
    console.log(`Registered agent ${agentConfig.name} (${agentConfig.id}) with MCP`);
  }
}
```

### 2. Implementing the SubAgent Adapter

You need to create an adapter that converts your database agent into an MCP-compatible SubAgent:

```typescript
function createMCPAgentAdapter(agentConfig: AgentDatabaseEntity): SubAgent {
  return {
    id: agentConfig.id,
    name: agentConfig.name,
    description: agentConfig.description,
    capabilities: extractCapabilities(agentConfig),
    roles: extractRoles(agentConfig),
    tags: agentConfig.metadata.tags,
    execute: async (task: PlannedTask): Promise<TaskResult> => {
      // This is where you delegate to your actual agent implementation
      const agent = await agentFactory.getOrCreateAgent(agentConfig.id);
      
      try {
        // Convert the MCP task to your agent's task format
        const result = await agent.processTask({
          id: task.id,
          title: task.title,
          description: task.description,
          // ... other fields as needed
        });
        
        // Convert your agent's result to MCP's TaskResult format
        return {
          success: true,
          data: result,
          message: `Task ${task.title} completed successfully`
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          message: `Task ${task.title} failed`
        };
      }
    }
  };
}
```

### 3. Dynamic Agent Registration

When new agents are created or updated through the UI, you need to update the MCP registry:

```typescript
function onAgentCreated(newAgent: AgentDatabaseEntity) {
  // Create and register the agent with MCP
  const mcpAgent = createMCPAgentAdapter(newAgent);
  MCPRuntime.registerAgent(mcpAgent);
}

function onAgentUpdated(updatedAgent: AgentDatabaseEntity) {
  // Deregister the old version
  MCPRuntime.deregisterAgent(updatedAgent.id);
  
  // Register the updated version
  const mcpAgent = createMCPAgentAdapter(updatedAgent);
  MCPRuntime.registerAgent(mcpAgent);
}

function onAgentDeleted(agentId: string) {
  // Remove from MCP
  MCPRuntime.deregisterAgent(agentId);
}
```

### 4. Health Status Synchronization

To ensure MCP has accurate information about agent health, implement a periodic health check:

```typescript
async function syncAgentHealth() {
  // Get all registered agents from MCP
  const mcpAgents = MCPRuntime.getAllAgents();
  
  for (const agent of mcpAgents) {
    try {
      // Check the actual agent's health
      const health = await agentManager.checkAgentHealth(agent.id);
      
      if (health.status === 'unhealthy') {
        // Update MCP or possibly deregister the agent
        MCPRuntime.updateAgentStatus(agent.id, 'unhealthy');
      }
    } catch (error) {
      console.error(`Error checking health for agent ${agent.id}:`, error);
    }
  }
}
```

## Example Implementation with AgentBase

When using the AgentBase architecture, you can connect MCP with UI-created agents like this:

```typescript
// In your agent registration service
class AgentRegistrationService {
  async registerAgentWithMCP(agentId: string) {
    // 1. Get the agent from the database
    const agentConfig = await this.agentRepository.getById(agentId);
    if (!agentConfig) {
      throw new Error(`Agent with ID ${agentId} not found`);
    }
    
    // 2. Create or get the agent instance
    const agent = await this.agentFactory.createAgentFromConfig(agentConfig);
    
    // 3. Create the MCP adapter
    const mcpAdapter: SubAgent = {
      id: agentConfig.id.toString(),
      name: agentConfig.name,
      description: agentConfig.description || '',
      // Extract capabilities from the agent's configuration
      capabilities: agentConfig.capabilities.map(cap => cap.id),
      roles: agentConfig.metadata?.specialization || [],
      tags: agentConfig.metadata?.tags || [],
      execute: async (task: PlannedTask): Promise<TaskResult> => {
        try {
          // Create a plan based on the task
          const planResult = await agent.createPlan({
            goal: task.description,
            contexts: [task.title],
            tags: task.tags
          });
          
          // Execute the plan
          const executionResult = await agent.executePlan(planResult.planId);
          
          return {
            success: true,
            data: executionResult,
            message: `Executed plan for task: ${task.title}`
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            message: `Failed to execute task: ${task.title}`
          };
        }
      }
    };
    
    // 4. Register with MCP
    MCPRuntime.registerAgent(mcpAdapter);
    
    return { success: true, agentId };
  }
}
```

## Conclusion

By connecting agents created through the UI to the MCP system, you get:

1. **Capability-based routing**: Tasks are automatically routed to the most suitable agent
2. **Health monitoring**: MCP tracks agent health and avoids routing to unhealthy agents
3. **Workload balancing**: MCP can manage concurrent task execution across agents
4. **Centralized orchestration**: All agent coordination happens through a single system

Implementing this integration bridges the gap between your user-created agents and the powerful coordination features of the MCP system. 