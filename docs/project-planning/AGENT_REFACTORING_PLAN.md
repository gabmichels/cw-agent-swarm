# Agent Architecture Refactoring Plan: Unified Approach

## Overview

After analyzing the codebase, we've determined that creating a new "BaseAgent" alongside the existing "AgentBase" would lead to duplication and confusion. Instead, we will enhance the existing `AgentBase` class to support a pluggable component architecture that allows Chloe and other agents to reuse core functionality while customizing specific behaviors.

## Progress Update (Phase 1 Started)

We have begun implementing this refactoring plan:

- ✅ Created BaseManager interface and AbstractBaseManager base class
- ✅ Created MemoryManager interface and AbstractMemoryManager base class
- ✅ Updated AgentBase with manager registration and management support
- ✅ Updated ChloeAgent to use the manager-based approach
- 🔄 Next steps: Implement concrete manager implementations

## Key Principles

1. **Enhance, don't replace**: We'll improve the existing `AgentBase` class rather than creating a parallel implementation
2. **Manager-based architecture**: Implement a flexible manager system that allows agents to selectively enable/disable different capabilities
3. **Configuration-driven**: Make all agent-specific values configurable
4. **Clean separation**: Provide clean separation between core agent functionality and agent-specific additions
5. **Backward compatibility**: Ensure existing code continues to work during the transition

## Current Architecture

The current system has these components:

- `src/agents/shared/base/AgentBase.ts`: Generic base agent with core functionality
- `src/agents/chloe/core/agent.ts`: Chloe-specific implementation that extends AgentBase
- `src/agents/chloe/scheduler.ts`: Chloe-specific scheduler implementation
- Various manager implementations throughout the codebase

## Refactoring Phases

### Phase 1: Enhance AgentBase with Manager Support (🔄 In Progress)

1. Update AgentBase to support a configurable manager system:
   - ✅ Add manager registration mechanism
   - ✅ Allow enabling/disabling specific managers
   - ✅ Create standardized interfaces for all manager types
   - ✅ Define a clear manager lifecycle (initialization, execution, shutdown)

2. Create abstract base manager classes:
   - ✅ `BaseManager` - foundation for all managers
   - ✅ `MemoryManager` - for memory operations
   - 🔄 `PlanningManager` - for planning and execution 
   - 🔄 `KnowledgeManager` - for knowledge operations
   - 🔄 `SchedulerManager` - for scheduling and autonomy
   - 🔄 `ReflectionManager` - for reflective capabilities
   - 🔄 `ToolManager` - for tool management

### Phase 2: Extract and Generalize Chloe's Managers (⏳ Not Started)

1. Refactor Chloe's implementation to use manager pattern:
   - 🔄 Extract memory management into `ChloeMemoryManager` (extends `MemoryManager`)
   - ⏳ Extract planning into `ChloePlanningManager` (extends `PlanningManager`)
   - ⏳ Extract scheduler into `ChloeSchedulerManager` (extends `SchedulerManager`)
   - ⏳ Extract other specialized components into appropriate managers

2. Create clean interfaces for all managers:
   - ✅ Updated ChloeAgent to look for managers
   - ⏳ Create concrete implementations of all manager interfaces

### Phase 3: Registry Implementation for Multi-Agent Support (⏳ Not Started)

1. Create `AgentRegistry` to manage multiple agent instances:
   - Registration mechanism for new agents
   - Lookup functionality for finding agents
   - Lifecycle management (initialization, shutdown)

2. Update scheduler implementation for multi-agent support:
   - Create `SchedulerRegistry` to track multiple schedulers
   - Isolate task scheduling per agent
   - Implement coordination mechanism for task management

### Phase 4: Configuration System (⏳ Not Started)

1. Create configuration schema for each manager type
2. Implement configuration validation
3. Add support for manager presets based on agent type/role
4. Create configuration inheritance system

### Phase 5: Agent Registration Flow Enhancement (⏳ Not Started)

1. Update registration form to support manager configuration
2. Create UI for enabling/disabling specific managers
3. Implement configuration validation
4. Add preset templates for common agent types

### Phase 6: Transition Chloe to New Architecture (🔄 In Progress)

1. ✅ Update Chloe to use the enhanced AgentBase with managers
2. 🔄 Configure appropriate managers for Chloe
3. ✅ Keep a thin Chloe-specific layer that includes marketing-specific capabilities
4. ⏳ Test to ensure identical functionality

## Implementation Details

### Enhanced AgentBase Implementation

We've updated AgentBase with manager support. Key additions include:

- Added managers Map to store registered managers
- Added registerManager/getManager methods
- Updated initialize/shutdown to handle managers
- Added manager-first approach to key methods like pruneMemory, consolidateMemory, planAndExecute

### Manager Interface Implementation

We've implemented the following manager interfaces:

- BaseManager - the core interface all managers implement
- MemoryManager - for memory operations

### Chloe Implementation

Updated ChloeAgent to use the enhanced AgentBase and properly configure needed managers.

## Next Steps

1. ✅ **Current Step**: Create remaining manager interfaces:
   - PlanningManager
   - KnowledgeManager
   - SchedulerManager
   - ReflectionManager
   - ToolManager

2. ⏳ **Next Step**: Extract Chloe's functionality into concrete manager implementations:
   - ChloeMemoryManager
   - ChloePlanningManager
   - ChloeSchedulerManager
   - ChloeReflectionManager
   - ChloeToolManager

3. ⏳ **Next Step**: Create manager factories and registry system:
   - MemoryManagerFactory
   - PlanningManagerFactory
   - AgentManagerRegistry

4. ⏳ **Next Step**: Update the agent registration flow to support manager configuration

## Migration Plan

1. ✅ Create the enhanced AgentBase with manager support
2. 🔄 Extract Chloe's functionality into appropriate managers
3. ✅ Create a minimal Chloe implementation that uses the manager-based approach
4. ⏳ Update existing code to use the new patterns
5. ⏳ Test extensively to ensure compatibility and functionality
6. ⏳ Gradually migrate other agents to the new architecture

## Testing Strategy

1. Test each manager in isolation
2. Test manager interactions
3. Verify Chloe's functionality remains identical
4. Test creating new agents with different configurations
5. Test agent registry and coordination
6. Monitor performance impact of the changes

## Benefits of This Approach

1. **Reduced duplication**: Uses the existing AgentBase rather than creating a parallel implementation
2. **Flexible architecture**: Managers can be enabled/disabled as needed
3. **Separation of concerns**: Each manager handles a specific aspect of agent behavior
4. **Configurable**: All agent-specific values come from configuration
5. **Scalable**: Supports multiple agents with different capabilities
6. **Future-proof**: New capabilities can be added as new managers

## Next Steps

1. Finalize the design of the manager interfaces
2. Implement the enhanced AgentBase with manager support
3. Begin extracting Chloe functionality into managers
4. Create testing framework for verifying compatibility 