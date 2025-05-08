# Chloe Decoupling Project: Making Agent Architecture Generic

## Project Overview

This project aims to decouple the "Chloe" agent from our codebase to create a generic agent architecture. Currently, many agent capabilities and configurations are hardcoded specifically for Chloe, which prevents us from easily creating new agents with different configurations. The goal is to ensure that 100% of Chloe's functionality can be recreated through our `AgentRegistrationForm` without any hardcoded dependencies.

## Project Status

| Phase | Status | Timeline | Priority |
|-------|--------|----------|----------|
| 1. Audit of Hardcoded Elements | ✅ Completed | Week 1 | High |
| 2. Agent Initialization Refactoring | ✅ Completed | Week 2 | High |
| 3. Knowledge System Refactoring | 🔄 In Progress | Week 2-3 | High |
| 4. Capability Configuration | 🔄 Not Started | Week 3 | Medium |
| 5. UI Registration Flow Enhancement | 🔄 Not Started | Week 4 | Medium |
| 6. Testing & Validation | 🔄 Not Started | Week 4-5 | High |

**Overall Progress:** 50% - Phase 1 and 2 complete, Phase 3 partially completed (2/4 tasks).

## Executive Summary

The current implementation of our agent system is tightly coupled to a specific agent named "Chloe". This creates several challenges:

1. New agents cannot leverage Chloe's capabilities without code duplication
2. Agent-specific data (like markdown knowledge) is hardcoded into file paths
3. System prompts, capabilities, and configuration are not dynamic
4. The singleton pattern for Chloe prevents proper multi-agent support

This project will refactor our agent architecture to use a generic, configurable design that separates agent-specific data from the underlying implementation. The end goal is to create a flexible system where any agent (including Chloe) can be fully configured through the `AgentRegistrationForm` UI.

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

## Implementation Plan

### Phase 1: Agent Architecture Integration

| Task | Scope | Priority |
|------|-------|----------|
| Leverage existing `AgentBase` | Utilize the existing generic base agent implementation | High |
| Utilize `AgentFactory` | Use the existing factory for creating agent instances | High |
| Migrate ChloeAgent to extend AgentBase | Update ChloeAgent to inherit from AgentBase | High |
| Replace singleton pattern | Move from singleton to service-based agent management | High |

### Phase 2: Knowledge System Refactoring

| Task | Scope | Priority | Status |
|------|-------|----------|--------|
| Implement dynamic knowledge paths | Replace hardcoded knowledge paths with dynamic paths | High | ✅ Completed |
| Create knowledge upload system | Develop UI for uploading agent-specific knowledge | Medium | 🔄 Not Started |
| Implement agent profile storage | Create storage for agent-specific profiles and data | Medium | 🔄 Not Started |
| Refactor MarkdownManager | Make MarkdownManager configurable and agent-agnostic | High | ✅ Completed |

### Phase 3: Capability Configuration

| Task | Scope | Priority |
|------|-------|----------|
| Extract capability definitions | Move capability definitions to configuration | Medium |
| Use existing CapabilityRegistry | Leverage the existing capability registry | Medium |
| Create capability loading system | Develop dynamic capability loading based on agent config | High |
| Update memory structures | Ensure memory structures support multi-agent capabilities | Medium |

### Phase 4: UI Registration Flow Enhancement

| Task | Scope | Priority |
|------|-------|----------|
| Enhance AgentRegistrationForm | Add additional fields for all agent configurations | High |
| Implement knowledge upload UI | Create UI for uploading markdown knowledge | Medium |
| Create capability selection UI | Develop UI for selecting from available capabilities | Medium |
| Add system prompt editor | Implement editor for customizing system prompts | High |

#### AgentRegistrationForm Enhancements

The current `AgentRegistrationForm.tsx` lacks several critical fields needed to fully configure an agent. The following enhancements are needed:

1. **System Prompt Configuration**:
   - Add a rich text editor for creating/editing system prompts
   - Support for multiple system prompt templates
   - Preview functionality for system prompts

2. **Department Selection**:
   - Add a dropdown for department selection (Marketing, HR, Finance, etc.)
   - Allow custom department creation

3. **Knowledge Configuration**:
   - Add file upload functionality for markdown knowledge files
   - Directory structure visualization and management
   - Knowledge import from URLs or existing sources

4. **Advanced Parameters**:
   - Add sections for customInstructions
   - Add systemMessages array support
   - Add contextWindow configuration
   - Add tool permissions selection interface

5. **Agent Templates**:
   - Add a template selection dropdown
   - Provide preconfigured templates (including Chloe template)
   - Template preview functionality

6. **Capability Level Configuration**:
   - Add interface for setting capability levels
   - Provide visualization of capability strength

7. **Agent Relationships**:
   - Configure how the agent relates to other agents
   - Set up collaboration patterns

The form should include a comprehensive validation system to ensure all required fields are properly configured before agent creation.

### Phase 5: Testing & Validation

| Task | Scope | Priority |
|------|-------|----------|
| Create test suite for agent creation | Develop tests for creating different agent types | High |
| Test Chloe recreation | Verify Chloe can be fully recreated through the registration form | High |
| Performance testing | Ensure multi-agent support doesn't impact performance | Medium |
| Cross-agent interaction tests | Test interactions between different agent types | Medium |

## Key Changes Required

### 1. Refactor ChloeAgent to Extend AgentBase

```typescript
// BEFORE
export class ChloeAgent implements IAgent {
  readonly agentId: string = 'chloe';
  // ...
}

// AFTER
import { AgentBase } from '../../lib/agents/shared/base/AgentBase';

export class ChloeAgent extends AgentBase {
  constructor(options: AgentOptions) {
    super({
      config: {
        agentId: 'chloe',
        name: 'Chloe',
        description: 'CMO of Crowd Wisdom focused on marketing strategy',
        ...options.config
      },
      capabilityLevel: options.capabilityLevel || AgentCapabilityLevel.ADVANCED,
      toolPermissions: options.toolPermissions || []
    });
  }
}
```

### 2. Make Knowledge Paths Dynamic

```typescript
// BEFORE
private getAgentDirectories(): string[] {
  return [
    'data/knowledge/company',
    `data/knowledge/agents/${this.agentId}`,
    'data/knowledge/agents/shared',
    `data/knowledge/domains/${this.department}`,
    'data/knowledge/test'
  ];
}

// AFTER
private getAgentDirectories(): string[] {
  // Reuse implementation from AgentBase or KnowledgeManager
  return this.getDefaultDirectories();
}
```

### 3. Make System Prompts Configurable

```typescript
// BEFORE
this.config = {
  systemPrompt: SYSTEM_PROMPTS.CHLOE,
  model: 'gpt-4.1-2025-04-14',
  temperature: 0.7,
  maxTokens: 4000,
  ...(options?.config || {}),
};

// AFTER
// Leverage the AgentBase config constructor
super({
  config: {
    systemPrompt: options?.config?.systemPrompt || SYSTEM_PROMPTS.CHLOE,
    model: options?.config?.model || process.env.DEFAULT_MODEL || 'gpt-4.1-2025-04-14',
    temperature: options?.config?.temperature || 0.7,
    maxTokens: options?.config?.maxTokens || 4000,
    ...(options?.config || {})
  }
});
```

### 4. Replace Singleton Pattern

```typescript
// BEFORE
// Global instance (singleton)
let chloeInstance: ChloeAgent | null = null;

export async function getChloeInstance(): Promise<ChloeAgent> {
  if (chloeInstance) {
    return chloeInstance;
  }
  
  chloeInstance = new ChloeAgent();
  await chloeInstance.initialize();
  return chloeInstance;
}

// AFTER
// Use the existing AgentRegistry or adapt it
import { AgentRegistry } from '../../lib/agents/registry';

export async function getChloeInstance(): Promise<any> {
  return AgentRegistry.getAgent('chloe');
}
```

### 5. Update Manager Initialization

```typescript
// BEFORE
this.markdownManager = new MarkdownManager({
  memory: chloeMemory,
  agentId: this.agentId,
  department: 'marketing',
  logFunction: (message, data) => {
    this.taskLogger.logAction(`MarkdownManager: ${message}`, data);
  }
});

// AFTER
this.markdownManager = new MarkdownManager({
  memory: this.memory,
  agentId: this.agentId,
  department: this.config.department || 'marketing',
  knowledgePaths: this.config.knowledgePaths,
  logFunction: (message, data) => {
    this.taskLogger.logAction(`MarkdownManager: ${message}`, data);
  }
});
```

## Risk Analysis

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Regression in Chloe functionality | Medium | High | Create comprehensive test suite for current Chloe behavior before changes |
| Performance degradation | Low | Medium | Benchmark performance before and after changes |
| API compatibility issues | Medium | Medium | Create compatibility layers for existing code |
| Incomplete decoupling | Medium | High | Perform static analysis to identify all hardcoded references |
| Knowledge system disruption | High | High | Implement careful migration strategy for existing knowledge |
| Integration challenges with existing components | Medium | High | Create mapping between ChloeAgent and AgentBase interfaces |
| Form complexity overwhelming users | Medium | Medium | Design intuitive UI with progressive disclosure of advanced options |

## Backward Compatibility Plan

1. Create shim layers for existing Chloe imports
2. Implement backward compatibility for existing API endpoints
3. Create migration tool for moving from hardcoded to configurable agents
4. Provide conversion utilities for existing knowledge repositories
5. Map Chloe's specialized functionality to the generic AgentBase

## Success Criteria

1. Chloe can be fully recreated through the registration form with identical capabilities
2. Multiple agents can be created with different configurations
3. No hardcoded references to "chloe" remain in the codebase
4. All agent-specific data is stored in a structured, configurable format
5. Knowledge system supports different knowledge bases per agent
6. ChloeAgent works through the generic agent system with no loss of functionality 