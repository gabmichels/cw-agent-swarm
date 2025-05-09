# Chloe Decoupling Project: Making Agent Architecture Generic

## Project Overview

This project aims to decouple the "Chloe" agent from our codebase to create a generic agent architecture. Currently, many agent capabilities and configurations are hardcoded specifically for Chloe, which prevents us from easily creating new agents with different configurations. The goal is to ensure that 100% of Chloe's functionality can be recreated through our `AgentRegistrationForm` without any hardcoded dependencies.

## Project Status

| Phase | Status | Timeline | Priority |
|-------|--------|----------|----------|
| 1. Audit of Hardcoded Elements | ✅ Completed | Week 1 | High |
| 2. Agent Initialization Refactoring | ✅ Completed | Week 2 | High |
| 3. Knowledge System Refactoring | ✅ Completed | Week 2-3 | High |
| 4. Capability Configuration | ✅ Completed | Week 3 | Medium |
| 5. UI Registration Flow Enhancement | ✅ Completed | Week 4 | Medium |
| 6. Testing & Validation | 🔄 Not Started | Week 4-5 | High |
| 3.5. Agent Persona Memory System | ✅ Completed | Week 5 | High |
| 7. Migrate Chloe to Base Agent | 🔄 In Progress (50%) | Week 6 | Critical |
| 8. Scheduler/Autonomy System Refactoring | 🔄 Planned | Week 6-7 | High |
| 9. Autonomy Capability Audit | ⏳ Not Started | Week 7 | Critical |
| 10. UI De-Chloefication | ⏳ Not Started | Week 7-8 | High |

**Overall Progress:** 80% - Manager-based architecture implemented. AgentBase now supports pluggable managers, and ChloeAgent updated to use the new pattern. Next steps: implement concrete manager classes and update remaining components.

## Executive Summary

The current implementation of our agent system is tightly coupled to a specific agent named "Chloe". This creates several challenges:

1. New agents cannot leverage Chloe's sophisticated capabilities without code duplication
2. Agent-specific data (like markdown knowledge) is hardcoded into file paths
3. System prompts, capabilities, and configuration are not dynamic
4. The singleton pattern for Chloe prevents proper multi-agent support
5. UI elements directly reference Chloe instead of using generic agent interfaces

After our initial audit and early implementation, we have determined that the most efficient approach is to use Chloe's implementation as the foundation for our generic agent architecture. This revised approach will:

1. Move Chloe's implementation to a shared base location
2. Generalize agent-specific references and configurations
3. Create a minimal version of Chloe that extends from this base implementation
4. Refactor the scheduler and autonomy systems to support multiple agents
5. Ensure all dynamically created agents have full autonomy capabilities
6. Update UI to use generic agent interfaces instead of Chloe-specific elements

## Audit of Hardcoded Elements

### Agent Identifiers

- Agent ID hardcoded as `"chloe"` in multiple places
- Global singleton references to `chloeAgent` in the global scope
- Direct imports from `agents/chloe` throughout the application

### Knowledge System

- Hardcoded markdown file paths in `data/knowledge/agents/chloe`
- Department hardcoded as `"marketing"` in the MarkdownManager
- Hardcoded knowledge directories in the agent initialization process

### System Prompts

- Hardcoded system prompt in `SYSTEM_PROMPTS.CHLOE` constant
- No dynamic prompt templates that can be customized per agent

### Capabilities

- Fixed set of capabilities in the agent implementation
- Hardcoded capability configurations in various managers

### Specialized Components

- `ChloeAgent` class with non-generic implementation
- Specialized managers like `MemoryManager` designed specifically for Chloe
- Singleton pattern for agent initialization in `getGlobalChloeAgent()`

### Scheduler/Autonomy System

- `ChloeScheduler` class with hardcoded references to Chloe
- Direct dependencies on Chloe-specific methods and properties
- Scheduled tasks specific to Chloe's marketing role

## Revised Implementation Plan

### Phase 7: Migrate Chloe to Base Agent

| Task | Scope | Priority | Status |
|------|-------|----------|--------|
| Create manager-based architecture | Enhance AgentBase with manager support | Critical | ✅ Completed |
| Create manager interfaces | Define interfaces for all agent capabilities | Critical | 🔄 In Progress |
| Generalize Chloe-specific references | Replace hardcoded "chloe" with configurable values | High | ✅ Completed |
| Create configuration system | Allow enabling/disabling specific managers | High | ✅ Completed |
| Create new minimal Chloe implementation | Extend from base agent with Chloe-specific configuration | Medium | ✅ Completed |
| Update import references | Update all imports throughout the codebase | High | 🔄 Not Started |
| Create agent capability toggling UI | Add UI controls for enabling/disabling agent capabilities | Medium | 🔄 Not Started |
| Preserve autonomy capabilities | Ensure all autonomy features are accessible to all agents | Critical | 🔄 In Progress |

#### Base Agent Implementation

Instead of refactoring individual components of Chloe, we'll take a more efficient approach by using Chloe as the template for our base agent:

1. **Directory Reorganization**:
   - Move `agents/chloe` to `lib/agents/base`
   - Create a new `agents/chloe` that extends from the base agent
   - Update all imports to reflect the new structure

2. **Generalized Implementation**:
   - Replace all hardcoded references to "chloe" with agent ID from configuration
   - Make role, department, and capability references configurable
   - Create configuration options for all managers and systems

3. **Manager System**:
   - Initially enable all managers for every agent (no pluggable manager system yet)
   - Provide reasonable defaults for all manager configurations
   - Implement fallbacks for edge cases

4. **Configuration Inheritance**:
   - Define configuration inheritance system for agent types
   - Allow overriding of specific configuration values
   - Support capability-based configuration presets

5. **Agent Registration Integration**:
   - Update agent registration form to include manager configuration
   - Provide templates for common agent configurations
   - Add capability-based presets for manager settings

6. **Full Autonomy Preservation**:
   - Ensure all nine autonomy components are included in the base agent
   - Maintain high-performing autonomy capabilities when migrating to generic architecture
   - Verify all autonomy features work with dynamically created agents

### Phase 8: Scheduler/Autonomy System Refactoring

| Task | Scope | Priority | Status |
|------|-------|----------|--------|
| Rename ChloeScheduler to AgentScheduler | Create generic scheduler class usable by any agent | High | 🔄 Not Started |
| Create SchedulerRegistry | Implement registry for managing multiple agent schedulers | High | 🔄 Not Started |
| Parameterize hardcoded values | Replace hardcoded "chloe" references with agent ID config | High | 🔄 Not Started |
| Create task templates based on capabilities | Define task templates based on agent capabilities | Medium | 🔄 Not Started |
| Implement per-agent cron job management | Ensure cron jobs are isolated per agent | Medium | 🔄 Not Started |
| Transfer execution outcome analysis | Move ExecutionOutcomeAnalyzer to base implementation | High | 🔄 Not Started |

#### Scheduler System Implementation

The scheduler system needs to be refactored to support multiple agents with different capabilities:

1. **Agent-Agnostic Scheduler**:
   - Rename `ChloeScheduler` to `AgentScheduler`
   - Replace hardcoded agent ID references with configurable values
   - Create a registry to track multiple schedulers

2. **Task Templates Based on Capabilities**:
   - Define task templates based on agent capabilities
   - Allow agents to have capability-specific scheduled tasks
   - Create a task matching system based on capability profiles

3. **Simplified Refactoring Approach**:
   - Make minimal changes to the existing code structure
   - Focus on parameterizing hardcoded values
   - Add a registry layer for multi-agent support

This simplified approach to the scheduler system refactoring aligns with the "move Chloe to base" approach by focusing on making the existing code more generic rather than reconstructing it from scratch.

### Phase 9: Autonomy Capability Audit

| Task | Scope | Priority | Status |
|------|-------|----------|--------|
| Audit Planning & Execution | Verify graph-based planning with execution tracing works for all agents | Critical | 🔄 Not Started |
| Audit Human Collaboration | Ensure context-aware collaboration protocols work for all agents | High | 🔄 Not Started |
| Audit Memory & Feedback | Confirm the refactored memory system works with all agent types | High | 🔄 Not Started |
| Audit Strategy & Prioritization | Verify StrategyUpdater works with the new agent architecture | High | 🔄 Not Started |
| Audit Knowledge Graph | Ensure domain-centric knowledge representation works for all agents | Medium | 🔄 Not Started |
| Audit Tool Routing | Confirm tool performance analysis works in the base implementation | Medium | 🔄 Not Started |
| Audit Time Reasoning | Verify duration tracking works for all agent types | Medium | 🔄 Not Started |
| Audit Self-Initiation | Ensure autonomous task scheduling works with all agent types | High | 🔄 Not Started |
| Audit Modularization | Confirm improved scalability carries over to the base implementation | Medium | 🔄 Not Started |

#### Autonomy Capability Implementation

To ensure all dynamically created agents have full autonomy capabilities, we need to audit and integrate the following components into the base agent implementation:

1. **Planning & Execution Autonomy**:
   - Integrate the graph-based planning engine into the base agent
   - Ensure ExecutionOutcomeAnalyzer is properly generalized
   - Maintain execution tracing with detailed outcome analysis

2. **Human Collaboration Layer**:
   - Preserve context-aware collaboration capabilities
   - Generalize collaboration protocols for all agent types
   - Maintain clarification question generation and approval requirements

3. **Memory & Feedback**:
   - Leverage the already refactored memory system
   - Ensure causal relationship tracking works for all agents
   - Maintain vendor-agnostic architecture with proper typing

4. **Strategy & Prioritization**:
   - Transfer StrategyUpdater to the base implementation
   - Preserve automated behavior modifier generation
   - Update interfaces to work with the new memory services

5. **Knowledge Graph Usage**:
   - Generalize the domain-centric knowledge representation
   - Transfer graph intelligence engine to the base implementation
   - Ensure proper knowledge bootstrapping for all agent types

6. **Tool Routing & Adaptation**:
   - Preserve tool performance analysis in the base implementation
   - Maintain adaptive selection based on execution outcomes
   - Update tool usage metrics storage for new memory architecture

7. **Time & Effort Reasoning**:
   - Ensure duration tracking works with all agent types
   - Maintain time-based pattern analysis capabilities
   - Leverage causal chain analysis for improved time reasoning

8. **Self-Initiation / Scheduler**:
   - Transfer autonomous task scheduling to the base implementation
   - Generalize opportunity detection for all agent types
   - Ensure proper initialization in the autonomy bootstrapping process

9. **Modularization & Scalability**:
   - Maintain the modular architecture in the base implementation
   - Ensure clean interfaces between components
   - Preserve separation of concerns for future extensibility

### Phase 10: UI De-Chloefication

| Task | Scope | Priority | Status |
|------|-------|----------|--------|
| Audit UI for Chloe references | Identify all Chloe-specific UI elements | High | 🔄 Not Started |
| Update welcome screen | Replace Chloe-specific content with generic agent UI | Medium | 🔄 Not Started |
| Replace Chloe initialization buttons | Convert to generic agent creation interfaces | High | 🔄 Not Started |
| Update agent selection interfaces | Ensure agent selection is dynamic and not Chloe-centric | Medium | 🔄 Not Started |
| Update documentation & help | Remove Chloe-specific terminology from user-facing docs | Medium | 🔄 Not Started |

#### UI De-Chloefication Plan

The current UI contains several Chloe-specific elements that need to be updated to support a multi-agent architecture:

1. **Welcome Screen Updates**:
   - Replace any Chloe-specific welcome text with generic agent platform messaging
   - Ensure the welcome screen properly highlights multi-agent capabilities
   - Update the primary CTA buttons to focus on agent creation rather than Chloe initialization

2. **Initialization Button Conversion**:
   - Replace any "Initialize Chloe" or "Chat with Chloe" buttons with generic "Create Agent" or "Select Agent" interfaces
   - Update button routing to go to agent creation/selection screens instead of directly to Chloe
   - Maintain consistent UI patterns for agent interactions

3. **Navigation Updates**:
   - Rename any navigation items from "Chloe" to agent-agnostic terms
   - Update sidebars or topbars to support multiple agents
   - Add agent selection components where appropriate

4. **Visual Identity**:
   - Replace any Chloe-specific icons or graphics with generic agent iconography
   - Create a visual system that can be customized per agent type
   - Update any agent avatars to support customization

5. **Messaging Updates**:
   - Update any hardcoded references to "Chloe" in UI messaging
   - Create a templating system for agent-specific messages
   - Ensure error messages and notifications use agent-agnostic language

6. **Example UI Updates**:

```tsx
// BEFORE: Welcome screen with Chloe-specific button
<div className="welcome-actions">
  <button 
    className="primary-button"
    onClick={initializeChloe}
  >
    Chat with Chloe
  </button>
</div>

// AFTER: Generic agent-centric welcome screen
<div className="welcome-actions">
  <Link href="/agents">
    <button className="primary-button">
      Create Agent
    </button>
  </Link>
  <Link href="/agents/select">
    <button className="secondary-button">
      Select Existing Agent
    </button>
  </Link>
</div>

// BEFORE: Hardcoded Chloe header
<header className="chat-header">
  <img src="/chloe-avatar.png" alt="Chloe" />
  <h2>Chatting with Chloe</h2>
</header>

// AFTER: Dynamic agent header
<header className="chat-header">
  <img src={agent.avatarUrl} alt={agent.name} />
  <h2>Chatting with {agent.name}</h2>
</header>
```

## Agent Registration Form Updates

The form should be enhanced to support the autonomy capabilities by including:

1. **Autonomy Level Configuration**:
   - Allow setting the overall autonomy level for the agent
   - Configure specific autonomy behaviors
   - Set task initiation thresholds

2. **Planning System Configuration**:
   - Set planning depth and strategy
   - Configure execution analysis sensitivity
   - Adjust collaboration thresholds

3. **Scheduler Configuration**:
   - Enable/disable self-initiated tasks
   - Set scheduler aggressiveness
   - Configure time windows for autonomous operation

## Key Changes Required

### 1. Move Chloe to Base Agent

```typescript
// BEFORE
// agents/chloe/core/agent.ts
export class ChloeAgent implements IAgent {
  readonly agentId: string = 'chloe';
  // ...
}

// AFTER
// lib/agents/base/agent.ts
export class BaseAgent implements IAgent {
  readonly agentId: string;
  readonly config: AgentConfig;
  readonly managers: Map<string, AgentManager> = new Map();
  
  constructor(options: BaseAgentOptions) {
    this.agentId = options.agentId;
    this.config = {
      ...DEFAULT_CONFIG,
      ...options.config
    };
    
    // Initialize only the managers enabled in configuration
    if (this.config.enableMemoryManager) {
      this.managers.set('memory', new MemoryManager({
        agent: this,
        config: this.config.memoryManagerConfig
      }));
    }
    
    // Similar for other managers...
  }
  
  // Common functionality shared by all agents...
}

// agents/chloe/index.ts (new minimal implementation)
export class ChloeAgent extends BaseAgent {
  constructor(options: ChloeAgentOptions = {}) {
    super({
      agentId: 'chloe',
      config: {
        // Enable all the managers Chloe currently uses
        enableMemoryManager: true,
        enablePlanningManager: true,
        enableKnowledgeManager: true,
        // Chloe-specific configurations
        department: 'marketing',
        role: 'cmo',
        // ...other Chloe-specific settings
        ...options.config
      }
    });
  }
  
  // Any Chloe-specific methods that aren't in BaseAgent...
}
```

### 2. Rename and Refactor Scheduler

```typescript
// BEFORE
// agents/chloe/scheduler.ts
export class ChloeScheduler {
  private agent: ExtendedChloeAgent;
  // ...
}

// AFTER
// lib/agents/base/scheduler.ts
export class AgentScheduler {
  private agent: IAgent;
  // ...
  
  constructor(agent: IAgent, options: AgentSchedulerOptions = {}) {
    this.agent = agent;
    // Initialize with agent-agnostic approach
    // ...
    
    // Register this scheduler in the registry
    SchedulerRegistry.registerScheduler(agent.agentId, this);
  }
}

// lib/agents/base/scheduler-registry.ts
export class SchedulerRegistry {
  private static schedulers = new Map<string, AgentScheduler>();
  
  static registerScheduler(agentId: string, scheduler: AgentScheduler): void {
    this.schedulers.set(agentId, scheduler);
  }
  
  static getScheduler(agentId: string): AgentScheduler | undefined {
    return this.schedulers.get(agentId);
  }
}
```

### 3. Task Template System

```typescript
// lib/agents/base/task-templates.ts
export const TASK_TEMPLATES: Record<string, AgentScheduledTask[]> = {
  MARKETING: [
    {
      id: 'market-scan',
      name: 'Market Scan',
      description: 'Scan the market for new trends and opportunities',
      schedule: '0 11 * * 2,5', // 11 AM Tuesday and Friday
      goalPrompt: 'Scan the market for new trends and opportunities',
      tags: ['market', 'research']
    },
    // Other marketing tasks...
  ],
  RESEARCH: [
    {
      id: 'trending-topics',
      name: 'Trending Topics',
      description: 'Research trending topics in the agent\'s domain',
      schedule: '0 14 * * 3', // 2 PM every Wednesday
      goalPrompt: 'Research trending topics in your field',
      tags: ['trending', 'research']
    },
    // Other research tasks...
  ],
  // Other capability-based task sets...
};

export function getTasksForCapabilities(capabilities: string[]): AgentScheduledTask[] {
  const tasks: AgentScheduledTask[] = [];
  
  // Add core tasks every agent should have
  tasks.push({
    id: 'memory-consolidation',
    name: 'Memory Consolidation',
    description: 'Consolidate memories and reinforce important connections',
    schedule: '0 2 * * *', // 2 AM every day
    goalPrompt: 'Consolidate memories and reinforce important connections',
    tags: ['memory', 'maintenance']
  });
  
  // Add capability-specific tasks
  if (capabilities.includes('marketing')) {
    tasks.push(...TASK_TEMPLATES.MARKETING);
  }
  
  if (capabilities.includes('research')) {
    tasks.push(...TASK_TEMPLATES.RESEARCH);
  }
  
  // Return all matched tasks
  return tasks;
}
```

### 4. Updated Agent Registration Form

The `AgentRegistrationForm` will need new sections for:

1. **Manager Configuration**: 
   - Enable/disable different manager types
   - Configure parameters for each enabled manager

2. **Scheduler Configuration**:
   - Enable/disable the scheduler system
   - Select task templates based on agent capabilities
   - Configure custom scheduled tasks

### 5. Preserve Autonomy Capabilities

```typescript
// lib/agents/base/core/planning-engine.ts
export class PlanningEngine {
  // Was previously tied directly to Chloe
  constructor(
    private agent: BaseAgent,
    private config: PlanningConfig = DEFAULT_PLANNING_CONFIG
  ) {
    // Initialize planning engine with agent reference
  }
  
  async createPlanForGoal(goal: string): Promise<ExecutionPlan> {
    // Create a graph-based plan for the given goal
    // No longer has hardcoded references to 'chloe'
  }
  
  // Other planning methods...
}

// lib/agents/base/analyzers/execution-outcome-analyzer.ts
export class ExecutionOutcomeAnalyzer {
  // Was previously in agents/chloe/analyzers
  constructor(
    private agent: BaseAgent,
    private memoryService: MemoryService
  ) {
    // Initialize analyzer with agent reference
  }
  
  async analyzeOutcome(
    execution: ExecutionTrace, 
    outcome: ExecutionOutcome
  ): Promise<OutcomeAnalysis> {
    // Analyze the execution outcome
    // Use the agent's agentId instead of hardcoded 'chloe'
    const memories = await this.memoryService.searchMemories({
      agentId: this.agent.agentId,
      // Other search parameters...
    });
    
    // Perform analysis...
  }
  
  // Other analyzer methods...
}
```

### 6. Update Autonomy Bootstrapping

```typescript
// lib/agents/base/autonomy/bootstrap.ts
export async function bootstrapAgentAutonomy(agent: BaseAgent): Promise<void> {
  // Initialize all autonomy components
  
  // Initialize scheduler if enabled
  if (agent.config.enableScheduler) {
    const scheduler = new AgentScheduler(agent);
    await scheduler.initialize();
    
    // Register standard task templates
    const capabilities = agent.getCapabilities();
    const taskTemplates = getTasksForCapabilities(capabilities);
    
    for (const task of taskTemplates) {
      await scheduler.registerTask(task);
    }
  }
  
  // Initialize strategy updater
  if (agent.config.enableStrategyUpdater) {
    const strategyUpdater = new StrategyUpdater(agent);
    await strategyUpdater.initialize();
  }
  
  // Initialize other autonomy components...
}
```

### 7. Update UI Components

```tsx
// BEFORE: Hardcoded Chloe initialization component
// components/ChloeInitializer.tsx
export const ChloeInitializer = () => {
  const initializeChloe = async () => {
    await fetch('/api/agents/chloe/initialize');
    router.push('/chat/chloe');
  };

  return (
    <button 
      className="chloe-button" 
      onClick={initializeChloe}
    >
      Initialize Chloe
    </button>
  );
};

// AFTER: Generic agent creation component
// components/AgentCreator.tsx
export const AgentCreator = () => {
  const router = useRouter();
  
  return (
    <div className="agent-actions">
      <Link href="/agents/create">
        <button className="agent-button">
          Create New Agent
        </button>
      </Link>
      <Link href="/agents">
        <button className="agent-button secondary">
          View All Agents
        </button>
      </Link>
    </div>
  );
};

// BEFORE: Chloe-specific chat interface
// pages/chat/chloe.tsx
export default function ChloeChatPage() {
  return (
    <div>
      <h1>Chat with Chloe</h1>
      <ChatInterface agentId="chloe" />
    </div>
  );
}

// AFTER: Dynamic agent chat interface
// pages/chat/[agentId].tsx
export default function AgentChatPage() {
  const { agentId } = useRouter().query;
  const { agent, isLoading } = useAgent(agentId as string);
  
  if (isLoading) return <Loading />;
  
  return (
    <div>
      <h1>Chat with {agent.name}</h1>
      <ChatInterface agentId={agentId as string} />
    </div>
  );
}
```

## Testing & Validation

The testing phase will need to verify:

1. **Backward Compatibility**: Existing code that references Chloe continues to work
2. **Multi-Agent Support**: Multiple agents can be created with different configurations
3. **Manager Configuration**: Agents can selectively enable/disable different managers
4. **Scheduler Functionality**: Each agent can have its own scheduler with appropriate tasks
5. **Chloe Functionality**: The new minimal Chloe implementation retains all original functionality
6. **Autonomy Functionality**: All nine autonomy components function properly with dynamically created agents
7. **UI Consistency**: The UI no longer contains Chloe-specific references and uses dynamic agent interfaces

## Completion Criteria

1. Chloe's implementation has been moved to `lib/agents/base`
2. A new minimal Chloe agent extends from the base implementation
3. All hardcoded references to "chloe" are replaced with configuration values
4. The scheduler system has been refactored to support multiple agents
5. The agent registration form supports all configuration options
6. Tests verify backward compatibility and proper functionality
7. All dynamically created agents have full autonomy capabilities identical to Chloe
8. The autonomy audit verifies each component functions correctly with the new architecture
9. The UI no longer contains any hardcoded references to Chloe
10. All agent interactions are done through generic agent interfaces

## Next Steps

1. Begin implementation of Phase 7 (Move Chloe to Base)
2. Prepare for Phase 8 (Scheduler Refactoring)
3. Update the UI registration form to support the new configuration options
4. Create tests to verify the proper functioning of the new architecture
5. Plan for autonomy capability audit to ensure no functionality is lost
6. Begin UI audit to identify all Chloe-specific references for removal
