# Agent Capability System

## Overview

The Capability System provides a standardized way to define, register, and utilize agent capabilities across the multi-agent architecture. This system enables dynamic agent discovery, task delegation based on skills, and capability-driven architecture patterns.

## Key Concepts

### Capabilities

A capability represents a specific skill, domain knowledge, or role that an agent can possess. Capabilities have:

- **ID**: Unique identifier
- **Name**: Human-readable name
- **Type**: Category (skill, role, domain, or tag)
- **Level**: Optional proficiency level (basic, intermediate, advanced, expert)
- **Description**: Explanation of the capability
- **Dependencies**: Optional list of related capabilities

### Registry

The `CapabilityRegistry` is a singleton that maintains:

- Capability definitions
- Agent capabilities
- Agent domains and roles
- Methods for matching agents to required capabilities

### Capability Types

The system supports four types of capabilities:

1. **Skills**: Specific abilities an agent can perform (e.g., code_generation, data_analysis)
2. **Roles**: Functional roles an agent can fulfill (e.g., researcher, developer)
3. **Domains**: Knowledge areas an agent specializes in (e.g., software, finance)
4. **Tags**: General-purpose tags for categorization

### Capability Levels

Capabilities can have proficiency levels:

- `BASIC`: Minimal functionality
- `INTERMEDIATE`: Standard proficiency
- `ADVANCED`: High proficiency
- `EXPERT`: Maximum proficiency

#### Why Not Make Everything Expert Level?

Setting appropriate capability levels is crucial for several reasons:

1. **Accuracy and expectation management**: Setting all capabilities to expert creates unrealistic expectations. If users expect expert-level performance in all areas but the agent can't deliver, it damages trust and satisfaction.

2. **Task delegation**: In a multi-agent system, capability levels help determine which agent should handle specific tasks. If every agent claims expert-level in everything, the delegation system can't make meaningful distinctions.

3. **Specialization**: Real expertise requires specialization. An agent focused on marketing strategy might be an expert there, but only intermediate in technical SEO or data analytics. This realistic specialization makes the agent more credible.

4. **Progressive improvement**: Starting with realistic capability levels gives room for actual improvement. You can demonstrate agent growth over time by increasing capability levels based on real improvements.

5. **Resource allocation**: In technical terms, capability levels might affect how computational resources are allocated. Expert capabilities might receive more context space or processing priority compared to basic ones.

6. **Transparency**: Honest capability representation builds user trust. When users see a mix of capability levels that match actual performance, they develop appropriate trust in the areas marked as expert.

## Usage

### Importing

```typescript
// Import everything
import * as CapabilitySystem from '../shared/capability-system';

// Or import specific components
import { 
  CapabilityRegistry, 
  CapabilityType, 
  CapabilityLevel,
  registerAgentCapabilities
} from '../shared/capability-system';
```

### Registering Capabilities

```typescript
// Get the registry
const registry = CapabilityRegistry.getInstance();

// Register a new capability
registry.registerCapability({
  id: 'skill.marketing_strategy',
  name: 'Marketing Strategy',
  type: CapabilityType.SKILL,
  description: 'Ability to create and execute marketing strategies'
});

// Register predefined capabilities
import { registerPredefinedCapabilities } from '../shared/capability-system';
registerPredefinedCapabilities(registry);
```

### Registering Agent Capabilities

```typescript
// Option 1: Using registry directly
registry.registerAgentCapabilities(
  'chloe',
  {
    'skill.marketing_strategy': CapabilityLevel.EXPERT,
    'skill.content_creation': CapabilityLevel.ADVANCED,
    'skill.social_media': CapabilityLevel.ADVANCED
  },
  {
    preferredDomains: ['marketing', 'business'],
    primaryRoles: ['cmo', 'strategist']
  }
);

// Option 2: Using helper function
import { registerAgentCapabilities } from '../shared/capability-system';
registerAgentCapabilities(
  'chloe',
  {
    'skill.marketing_strategy': 'expert',
    'skill.content_creation': 'advanced',
    'skill.social_media': 'advanced'
  },
  {
    preferredDomains: ['marketing', 'business'],
    primaryRoles: ['cmo', 'strategist']
  }
);

// Register a single capability
import { registerAgentCapability } from '../shared/capability-system';
registerAgentCapability('chloe', 'skill.viral_marketing', 'advanced');
```

### Finding Agents with Capabilities

```typescript
// Find the best agent for a task
const bestAgent = registry.findBestAgentForTask({
  requiredCapabilities: ['skill.data_analysis', 'skill.visualization'],
  preferredCapabilities: ['skill.report_generation'],
  requiredLevels: {
    'skill.data_analysis': CapabilityLevel.ADVANCED
  },
  preferredDomain: 'finance',
  minMatchScore: 0.7
});

// Or using helper function
import { findAgentForTask } from '../shared/capability-system';
const bestAgent = findAgentForTask(
  ['skill.data_analysis', 'skill.visualization'],
  {
    preferredCapabilities: ['skill.report_generation'],
    requiredLevels: { 'skill.data_analysis': 'advanced' },
    preferredDomain: 'finance',
    minMatchScore: 0.7
  }
);

// Get all agents with a specific capability
const agents = registry.getAgentsWithCapability('skill.code_generation');

// Get all agents with a specific role
const analysts = registry.getAgentsWithRole('analyst');

// Get all agents in a domain
const financeAgents = registry.getAgentsInDomain('finance');
```

## Design Patterns

### Agent Configuration

Use the capability system to configure new agents:

```typescript
const agentConfig = {
  agentId: 'market_research_assistant',
  name: 'Market Research Assistant',
  description: 'Specialized in market research and competitive analysis',
  capabilities: {
    skills: {
      'market_research': 'expert',
      'competitor_analysis': 'advanced',
      'trend_spotting': 'advanced'
    },
    domains: ['marketing', 'business_intelligence'],
    roles: ['researcher', 'analyst']
  }
};

// When creating an agent, register its capabilities
const agent = new AgentBase(agentConfig);
registerAgentCapabilities(
  agentConfig.agentId,
  agentConfig.capabilities.skills,
  {
    preferredDomains: agentConfig.capabilities.domains,
    primaryRoles: agentConfig.capabilities.roles
  }
);
```

### Task Delegation

Use capabilities for dynamic task delegation:

```typescript
function delegateTask(task) {
  // Determine required capabilities based on task
  const requiredCapabilities = analyzeTaskRequirements(task);
  
  // Find best agent for the task
  const agentId = findAgentForTask(requiredCapabilities);
  
  if (agentId) {
    // Get agent and assign task
    const agent = AgentRegistry.getAgent(agentId);
    return agent.assignTask(task);
  } else {
    throw new Error('No suitable agent found for task');
  }
}
```

## Integration with AgentBase

The `AgentBase` class automatically registers capabilities during initialization:

```typescript
// Inside AgentBase.initialize()
if (this.capabilities && Object.keys(this.capabilities).length > 0) {
  const registry = CapabilityRegistry.getInstance();
  registry.registerAgentCapabilities(
    this.agentId,
    this.capabilities,
    {
      preferredDomains: this.domains,
      primaryRoles: this.roles
    }
  );
}
```

## Best Practices

1. **Define capabilities early**: Create standard capability definitions before agent implementation
2. **Be consistent with IDs**: Use consistent naming patterns (e.g., `skill.name`, `domain.area`)
3. **Set appropriate levels**: Don't overstate capability levels
4. **Register domain knowledge**: Include domains the agent specializes in
5. **Use for discovery**: Utilize capability matching for dynamic agent discovery
6. **Keep registry updated**: Update capabilities when agent functionality changes 