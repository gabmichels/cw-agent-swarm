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
| 7. Migrate Chloe to Base Agent | ⭐ NEW | Week 6 | Critical |
| 8. Scheduler/Autonomy System Refactoring | ⭐ NEW | Week 6-7 | High |

**Overall Progress:** 85% - Two new critical phases identified: moving Chloe to be the base agent framework and refactoring the scheduler/autonomy system.

## Executive Summary

The current implementation of our agent system is tightly coupled to a specific agent named "Chloe". This creates several challenges:

1. New agents cannot leverage Chloe's sophisticated capabilities without code duplication
2. Agent-specific data (like markdown knowledge) is hardcoded into file paths
3. System prompts, capabilities, and configuration are not dynamic
4. The singleton pattern for Chloe prevents proper multi-agent support

After our initial audit and early implementation, we have determined that the most efficient approach is to use Chloe's implementation as the foundation for our generic agent architecture. This revised approach will:

1. Move Chloe's implementation to a shared base location
2. Generalize agent-specific references and configurations
3. Create a minimal version of Chloe that extends from this base implementation
4. Refactor the scheduler and autonomy systems to support multiple agents

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
| Rename agents/chloe to lib/agents/base | Move Chloe's implementation to a shared location | Critical | 🔄 Not Started |
| Generalize Chloe-specific references | Replace hardcoded "chloe" with configurable values | High | 🔄 Not Started |
| Create configuration system | Allow enabling/disabling specific managers | High | 🔄 Not Started |
| Create new minimal Chloe implementation | Extend from base agent with Chloe-specific configuration | Medium | 🔄 Not Started |
| Update import references | Update all imports throughout the codebase | High | 🔄 Not Started |
| Create agent capability toggling UI | Add UI controls for enabling/disabling agent capabilities | Medium | 🔄 Not Started |

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
   - Allow agents to selectively enable or disable specific managers
   - Provide reasonable defaults for all manager configurations
   - Implement fallbacks for disabled managers

4. **Configuration Inheritance**:
   - Define configuration inheritance system for agent types
   - Allow overriding of specific configuration values
   - Support capability-based configuration presets

5. **Agent Registration Integration**:
   - Update agent registration form to include manager configuration
   - Provide templates for common agent configurations
   - Add capability-based presets for manager settings

### Phase 8: Scheduler/Autonomy System Refactoring

| Task | Scope | Priority | Status |
|------|-------|----------|--------|
| Rename ChloeScheduler to AgentScheduler | Create generic scheduler class usable by any agent | High | 🔄 Not Started |
| Create SchedulerRegistry | Implement registry for managing multiple agent schedulers | High | 🔄 Not Started |
| Parameterize hardcoded values | Replace hardcoded "chloe" references with agent ID config | High | 🔄 Not Started |
| Create task templates based on capabilities | Define task templates based on agent capabilities | Medium | 🔄 Not Started |
| Implement per-agent cron job management | Ensure cron jobs are isolated per agent | Medium | 🔄 Not Started |

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

## Implementation Plan

### Phase 1: Agent Architecture Integration

| Task | Scope | Priority | Status |
|------|-------|----------|--------|
| Leverage existing `AgentBase` | Utilize the existing generic base agent implementation | High | ✅ Completed |
| Utilize `AgentFactory` | Use the existing factory for creating agent instances | High | ✅ Completed |
| Migrate ChloeAgent to extend AgentBase | Update ChloeAgent to inherit from AgentBase | High | ✅ Completed |
| Replace singleton pattern | Move from singleton to service-based agent management | High | ✅ Completed |

### Phase 2: Knowledge System Refactoring

| Task | Scope | Priority | Status |
|------|-------|----------|--------|
| Implement dynamic knowledge paths | Replace hardcoded knowledge paths with dynamic paths | High | ✅ Completed |
| Create markdown upload system | Develop file upload interface for agent-specific knowledge | Medium | ✅ Completed |
| Implement agent-specific storage | Create dedicated storage for each agent's knowledge files | Medium | ✅ Completed |
| Refactor MarkdownManager | Make MarkdownManager configurable and agent-agnostic | High | ✅ Completed |

#### Knowledge System Implementation

The knowledge system has been refactored to work with agent-specific knowledge without relying on hardcoded file paths:

1. **One-Time Processing**:
   - Markdown files are processed only during agent creation
   - Files are uploaded through a simple attachment interface
   - No dynamic reloading of markdown files after agent initialization

2. **Agent-Specific Storage**:
   - Each agent has dedicated storage for knowledge files
   - No shared directory structure is required
   - Files are tagged with agent ID for proper attribution

3. **Simplified Architecture**:
   - Removed dependency on fixed file paths
   - Eliminated hardcoded department values
   - Knowledge is loaded directly from agent configuration

4. **Batch Processing**:
   - Support for uploading multiple markdown files at once
   - Basic preview functionality before processing
   - Metadata tracking of knowledge sources

### Phase 3: Capability Configuration

| Task | Scope | Priority | Status |
|------|-------|----------|--------|
| Extract capability definitions | Move capability definitions to configuration | Medium | ✅ Completed |
| Use existing CapabilityRegistry | Leverage the existing capability registry | Medium | ✅ Completed |
| Create capability loading system | Develop dynamic capability loading based on agent config | High | ✅ Completed |
| Update memory structures | Ensure memory structures support multi-agent capabilities | Medium | ✅ Completed |

#### Capability System Implementation

The capability system defines what agents can do, what roles they can fulfill, and what knowledge domains they specialize in. We've implemented this system with the following components:

1. **Capability Types**:
   - Skills: Technical abilities (e.g., marketing_strategy, data_analysis)
   - Roles: Functional roles (e.g., cmo, researcher)
   - Domains: Knowledge areas (e.g., marketing, finance)
   - Tags: General categorization

2. **Proficiency Levels**:
   - Basic, Intermediate, Advanced, and Expert levels
   - Used to indicate how skilled an agent is in a particular capability

3. **Central Registry**:
   - Singleton registry for capability registration and discovery
   - Enables dynamic agent selection for tasks
   - Supports capability-based agent matching

4. **ID Standardization**:
   - Consistent ID format: `[type].[name]` (e.g., `skill.marketing_strategy`)
   - Makes capabilities easily categorizable and discoverable

5. **Implementation Strategy**:
   - Created generic capability system module with helper functions
   - Defined standardized capability interfaces and types
   - Created helper functions for capability registration and discovery 
   - Provided templates for common agent roles
   - Implemented UI for capability management

### Phase 3.5: Agent Persona Memory System

| Task | Scope | Priority | Status |
|------|-------|----------|--------|
| Define persona memory schema | Create memory structure and tagging for persona aspects | High | ✅ Completed |
| Create text input UI | Develop text input fields for persona aspects | Medium | ✅ Completed |
| Implement memory ingestion | Process persona texts as critical memories | Medium | ✅ Completed |
| Design persona templates | Create preset text templates for common personas | Medium | ✅ Completed |

#### Persona System Implementation

The persona system defines how agents communicate, behave, and present themselves, using the existing memory system:

1. **Memory-Based Approach**:
   - Uses existing memory system instead of modifying agent model
   - Structured text fields are ingested as critical memories
   - Fields include background, personality traits, communication style, preferences
   - Critical importance tag ensures consistent retrieval in context

2. **Text Input Fields**:
   - Dedicated text areas for each persona aspect
   - Simple attachments for uploading persona files
   - Template system for quick persona configuration
   - Preview showing how memories will be processed

3. **Integration With Memory System**:
   - Each text field becomes a separate memory entry
   - Appropriate tagging for easy retrieval (personality, background, communication)
   - Highest importance level ensures consistent inclusion in context
   - No changes to existing memory architecture required

4. **Implemented Features**:
   - UI component for persona configuration 
   - Template system with pre-defined personas
   - File upload capability for each persona aspect
   - Memory preview showing how persona will be processed
   - Responsive design with proper labeling and hints

### Phase 4: UI Registration Flow Enhancement

| Task | Scope | Priority | Status |
|------|-------|----------|--------|
| Enhance AgentRegistrationForm | Add additional fields for all agent configurations | High | ✅ Completed |
| Implement knowledge upload UI | Create UI for uploading markdown knowledge | Medium | ✅ Completed |
| Create capability selection UI | Develop UI for selecting from available capabilities | Medium | ✅ Completed |
| Add system prompt editor | Implement editor for customizing system prompts | High | ✅ Completed |
| Implement capability configuration table | Implement a four-column table layout for managing capabilities | Medium | ✅ Completed |
| Add Agent Persona Configuration | Add structured text fields for persona aspects | High | ✅ Completed |
| Add Manager Configuration UI | NEW: Add controls for enabling/disabling agent managers | High | 🔄 Not Started |

#### AgentRegistrationForm Enhancements

The `AgentRegistrationForm.tsx` has been enhanced with the following components:

1. **System Prompt Configuration**:
   - ✅ Added a rich text editor (`SystemPromptEditor.tsx`) for creating/editing system prompts
   - ✅ Added support for multiple system prompt templates
   - ✅ Implemented preview functionality for system prompts
   - ✅ Added file upload capability for system prompts

2. **Knowledge Configuration**:
   - ✅ Added simple file attachment interface (`KnowledgeUploader.tsx`) for uploading markdown knowledge files
   - ✅ Implemented processing of markdown files during agent creation
   - ✅ Added support for batch uploads of multiple markdown files
   - ✅ Added configuration for storing files in agent-specific storage
   - ✅ Implemented metadata tracking of knowledge sources
   - ✅ Added basic preview of markdown content before processing

3. **Capability Configuration Table**:
   - ✅ Implemented a four-column table layout (`AgentCapabilityManager.tsx`) for managing capabilities
   - ✅ Each capability row contains name, description, and proficiency level selector
   - ✅ Added add/remove controls for managing capabilities
   - ✅ Implemented automatic capability ID generation using pattern `[type].[name]`
   - ✅ Added preview showing derived capability configuration
   - ✅ Implemented capability template support to quickly populate from predefined sets

4. **Agent Persona Configuration**:
   - ✅ Added structured text fields (`AgentPersonaForm.tsx`) for persona aspects
   - ✅ Implemented file attachment options for each persona aspect
   - ✅ Set up processing of text fields as critical memory entries with appropriate tags
   - ✅ Added template options for quick persona configuration
   - ✅ Implemented memory preview showing how persona will be processed

5. **Integration and Type Safety**:
   - ✅ Integrated all components into the main `AgentRegistrationForm.tsx`
   - ✅ Implemented proper TypeScript interfaces for extended agent configuration
   - ✅ Added automatic conversion between extended and standard agent types
   - ✅ Ensured backward compatibility with existing API interfaces

### Phase 5: Testing & Validation

| Task | Scope | Priority | Status |
|------|-------|----------|--------|
| Create test suite for agent creation | Develop tests for creating different agent types | High | 🔄 Not Started |
| Test Chloe recreation | Verify Chloe can be fully recreated through the registration form | High | 🔄 Not Started |
| Performance testing | Ensure multi-agent support doesn't impact performance | Medium | 🔄 Not Started |
| Cross-agent interaction tests | Test interactions between different agent types | Medium | 🔄 Not Started |

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

## Testing & Validation

The testing phase will need to verify:

1. **Backward Compatibility**: Existing code that references Chloe continues to work
2. **Multi-Agent Support**: Multiple agents can be created with different configurations
3. **Manager Configuration**: Agents can selectively enable/disable different managers
4. **Scheduler Functionality**: Each agent can have its own scheduler with appropriate tasks
5. **Chloe Functionality**: The new minimal Chloe implementation retains all original functionality

## Completion Criteria

1. Chloe's implementation has been moved to `lib/agents/base`
2. A new minimal Chloe agent extends from the base implementation
3. All hardcoded references to "chloe" are replaced with configuration values
4. The scheduler system has been refactored to support multiple agents
5. The agent registration form supports all configuration options
6. Tests verify backward compatibility and proper functionality

## Next Steps

1. Begin implementation of Phase 7 (Move Chloe to Base)
2. Prepare for Phase 8 (Scheduler Refactoring)
3. Update the UI registration form to support the new configuration options
4. Create tests to verify the proper functioning of the new architecture
