# Agent Capability System

## Overview

The capability system provides a framework for agents to declare their abilities, specializations, and knowledge domains. This allows for:

- Capability-based agent discovery
- Intelligent task delegation based on required capabilities
- Fallback routing when optimal agents are unavailable
- Domain and role-based agent grouping

## Core Components

### Capability Registry

The central registry that maintains information about:
- All defined capabilities in the system
- Which agents have which capabilities
- Capability levels for each agent

### Agent Coordinator

Enhanced with capability-aware delegation:
- Matches tasks to the most suitable agent based on required capabilities
- Provides graceful fallback when optimal agents are unavailable
- Suggests alternative capabilities when exact matches aren't found

### AgentBase Extensions

Agents can now:
- Declare capabilities with proficiency levels
- Specify domains of expertise
- Define functional roles
- Discover and interact with other agents based on capabilities

## Capability Types

The system supports four types of capabilities:

1. **Skills** - Specific technical abilities (e.g., research, code generation)
2. **Roles** - Functional roles the agent can perform (e.g., researcher, developer)
3. **Domains** - Knowledge domains the agent specializes in (e.g., healthcare, finance)
4. **Tags** - General purpose tags for categorization

## Capability Levels

Each capability can be declared at one of four proficiency levels:

1. **Basic** - Minimal functionality
2. **Intermediate** - Standard level of proficiency
3. **Advanced** - High level of skill
4. **Expert** - Maximum level of expertise

## Using the Capability System

### Defining Capabilities

```typescript
// Define a capability
const researchCapability: Capability = {
  id: 'skill.research',
  name: 'Research',
  type: CapabilityType.SKILL,
  description: 'Ability to search for and synthesize information'
};

// Register with the capability registry
const registry = CapabilityRegistry.getInstance();
registry.registerCapability(researchCapability);
```

### Configuring an Agent with Capabilities

```typescript
// When creating an agent
const agentConfig: AgentBaseConfig = {
  agentId: 'researchAgent',
  capabilities: {
    skills: {
      'skill.research': CapabilityLevel.EXPERT,
      'skill.text_analysis': CapabilityLevel.ADVANCED
    },
    domains: ['domain.science', 'domain.healthcare'],
    roles: ['role.researcher']
  }
};

// Or add capabilities to an existing agent
agent.declareCapability('skill.data_analysis', CapabilityLevel.INTERMEDIATE);
agent.addDomain('domain.education');
agent.addRole('role.analyst');
```

### Delegating Tasks Using Capabilities

```typescript
// Delegate a task requiring specific capabilities
const result = await coordinator.delegateTask({
  taskId: 'research-task-1',
  goal: 'Research recent advances in quantum computing',
  requiredCapabilities: ['skill.research'],
  preferredCapabilities: ['skill.data_analysis'],
  requiredCapabilityLevels: {
    'skill.research': CapabilityLevel.ADVANCED
  },
  preferredDomain: 'domain.science',
  requestingAgentId: 'user'
});
```

### Discovering Agents by Capability

```typescript
// Find all agents with a specific capability
const researchAgents = coordinator.getAgentsWithCapability('skill.research');

// Get all capabilities for an agent
const agentCapabilities = coordinator.getAgentCapabilities('researchAgent');
```

## Capability-Based Matching Algorithm

The system uses a sophisticated matching algorithm that considers:

1. Required capabilities - Must have these to be considered
2. Capability levels - Must meet or exceed required levels
3. Preferred capabilities - Bonus for having these
4. Domain specialization - Bonus for expertise in relevant domains
5. Role fulfillment - Agents with required roles score higher
6. Health and availability - Only available agents are considered

This results in a match score (0-1) that determines the best agent for a task.

## Running the Capability Demo

To see the capability system in action, run:

```bash
npm run capability-demo
```

This demonstrates:
- Registering predefined capabilities
- Creating specialized agents
- Capability-based task delegation
- Fallback routing
- Capability discovery 