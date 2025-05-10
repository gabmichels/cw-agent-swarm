# Consolidated Agent Architecture Refactoring Plan

## Executive Summary

Our agent architecture refactoring project aims to create a flexible, extensible framework that supports multiple agents with different capabilities, while decoupling from the Chloe-specific implementation. This consolidated plan merges multiple planning documents to create a coherent approach for implementation.

The core strategy leverages existing architecture components (`AgentBase`, `BaseManager`) to create a manager-based agent architecture with clear interfaces, type safety, and consistent patterns. This approach will allow us to support multiple agents with different capabilities while maintaining compatibility with existing code.

### Recent Progress

We have completed all manager interfaces and the first concrete implementation, `DefaultToolManager`, which follows the interface-first approach defined in our implementation guidelines. The `DefaultToolManager` implementation demonstrates key architecture patterns including:

- Strict type safety with no use of `any` types
- Comprehensive error handling with custom error types
- Efficient data structures with Map-based storage
- Proper lifecycle management (initialization, shutdown)
- Clean separation of interface and implementation

The insights from this implementation have been documented in `docs/implementation/MANAGER_IMPLEMENTATION_INSIGHTS.md` to guide future development work.

## Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| BaseManager Interface | ✅ Completed | Core manager interface defined |
| Manager Interfaces | ✅ Completed | All 8 manager interfaces implemented |
| AgentBase Interface | ✅ Completed | Core agent interface defined |
| Abstract Base Implementations | ✅ Completed | AbstractAgentBase and AbstractBaseManager implemented |
| Concrete Implementations | 🔄 In Progress (45%) | First default implementation completed (DefaultToolManager) |
| Implementation Migration | 🔄 In Progress (25%) | Began migration of Chloe implementation |
| Testing & Validation | ⏳ Not Started | To be done after implementation phase |

## Core Architecture Components

### Manager System

The refactoring uses a manager-based architecture with these core components:

1. **BaseManager**: Core interface all managers implement
2. **Specialized Managers**:
   - **MemoryManager**: Memory storage and retrieval
   - **KnowledgeManager**: Knowledge representation and access
   - **SchedulerManager**: Task scheduling and execution
   - **ReflectionManager**: Self-evaluation and improvement
   - **ToolManager**: Tool management and execution
   - **PlanningManager**: Goal planning and execution
   - **InputProcessor**: Input handling and preprocessing
   - **OutputProcessor**: Response generation and formatting

### Agent Base

The `AgentBase` provides core functionality including:
- Manager registration and lifecycle management
- Configuration handling
- Type-safe interfaces for all operations
- Standardized error handling

## Refactoring Strategy

### Phase 1: Manager Interface Standardization (✅ Completed)

1. ✅ Define consistent interfaces for all manager types:
   - ✅ `BaseManager` interface
   - ✅ `MemoryManager` interface
   - ✅ `KnowledgeManager` interface
   - ✅ `SchedulerManager` interface
   - ✅ `ReflectionManager` interface
   - ✅ `ToolManager` interface
   - ✅ `PlanningManager` interface
   - ✅ `InputProcessor` interface
   - ✅ `OutputProcessor` interface

2. ✅ Ensure all interfaces are type-safe with no use of `any`
3. ✅ Create consistent configuration interfaces for each manager type

### Phase 2: Manager Implementation Adaptation (🔄 In Progress - 45%)

1. 🔄 Adapt existing manager implementations to use standardized interfaces:
   - 🔄 Adapt existing memory management into `ChloeMemoryManager` (implements `MemoryManager`) - 30%
   - 🔄 Adapt existing planning into `ChloePlanningManager` (implements `PlanningManager`) - 20%
   - 🔄 Adapt existing scheduler into `ChloeSchedulerManager` (implements `SchedulerManager`) - 25%
   - 🔄 Create adapter patterns where necessary for backward compatibility - 15%

2. 🔄 Create default implementations for core managers - 25%:
   - 🔄 Create `DefaultMemoryManager` for generic memory management - 10%
   - 🔄 Create `DefaultPlanningManager` for generic planning capabilities - 0%
   - 🔄 Create `DefaultSchedulerManager` for generic scheduling capabilities - 0%
   - ✅ Create `DefaultToolManager` for generic tool management - 100%

3. ⏳ Implement type-safe error handling system - 0%
   - ⏳ Create hierarchy of error types for different manager types
   - ⏳ Implement consistent error reporting

4. 🔄 Clean up implementation to remove abstract classes and focus on interface-first design - 65%
   - ✅ Refactor interfaces to use strict typing with no `any` types
   - ✅ Remove abstract class implementations from interface files
   - 🔄 Fix circular dependencies between interface files - 75%
   - 🔄 Update imports to use correct paths - 80%

### Phase 3: AgentBase Enhancement (⏳ Not Started)

1. ⏳ Enhance the existing AgentBase with improved manager support:
   - ⏳ Standardize manager registration and initialization
   - ⏳ Improve type-safety of manager interactions
   - ⏳ Add manager lifecycle management (initialization, shutdown)
   - ⏳ Implement manager-first approach to core functionality

### Phase 4: Configuration System (⏳ Not Started)

1. ⏳ Create a standardized configuration system:
   - ⏳ Define structured configuration schemas for each manager type
   - ⏳ Implement configuration validation
   - ⏳ Add support for manager presets based on agent role/capabilities
   - ⏳ Create configuration inheritance system

### Phase 5: Agent Registration Flow Enhancement (⏳ Not Started)

1. ⏳ Update the agent registration flow:
   - ⏳ Add UI support for manager configuration
   - ⏳ Implement template-based agent creation
   - ⏳ Create preset configurations for common agent types
   - ⏳ Add validation to ensure consistent agent configuration

### Phase 6: Testing and Validation (⏳ Not Started)

1. ⏳ Develop comprehensive test suite
2. ⏳ Verify backward compatibility with existing code
3. ⏳ Performance testing to ensure no regressions
4. ⏳ Gradual rollout plan with feature flags

## Key Implementation Details

### ChloeAgent Integration

The refactoring will make ChloeAgent extend the enhanced AgentBase:

```typescript
// After refactoring
export class ChloeAgent extends AgentBase {
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
  
  // Chloe-specific methods that aren't in AgentBase
}
```

### Scheduler Refactoring

The scheduler refactoring will create an agent-agnostic implementation:

```typescript
export class AgentScheduler {
  private agent: BaseAgent;
  private tasks: AgentTask[];
  
  constructor(agent: BaseAgent, options: SchedulerOptions = {}) {
    this.agent = agent;
    this.tasks = options.tasks || [];
    
    // Register this scheduler
    SchedulerRegistry.registerScheduler(agent.getAgentId(), this);
  }
  
  // Methods for task scheduling, execution, etc.
}
```

### Task Template System

The refactoring will implement a capability-based task template system:

```typescript
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

### Agent Registration Form Enhancement

The registration form will be enhanced to support the manager-based architecture:

```tsx
const ManagerConfiguration = () => {
  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Manager Configuration</h2>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Memory Manager</h3>
            <p className="text-sm text-gray-400">Remembers conversations and important information</p>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="enableMemoryManager"
              name="config.enableMemoryManager"
              checked={formData.config.enableMemoryManager}
              onChange={handleChange}
              className="mr-2"
            />
            <label htmlFor="enableMemoryManager">Enable</label>
          </div>
        </div>
        
        {/* Configuration options for enabled manager */}
        {formData.config.enableMemoryManager && (
          <div className="ml-6 mt-2 space-y-3">
            {/* Memory manager specific options */}
          </div>
        )}
        
        {/* Similar sections for other managers */}
      </div>
    </div>
  );
};
```

## Implementation Guidelines

### Key Principles

1. **INTERFACE-FIRST DESIGN**: Define interfaces before implementing classes
2. **STRICT TYPE SAFETY**: Never use 'any' type in TypeScript; create proper interfaces for all data structures
3. **DEPENDENCY INJECTION**: Use constructor injection for all dependencies
4. **IMMUTABLE DATA**: Use immutable data patterns whenever possible
5. **ERROR HANDLING**: Use proper error handling with custom error types

### Manager Implementation Principles

1. Each manager should have a clear, focused responsibility
2. Managers should expose a consistent interface pattern
3. All managers should support proper lifecycle management (initialization, shutdown)
4. Configuration should drive manager behavior
5. Error handling should be consistent and comprehensive

### Testing Requirements

1. **Unit Testing**: Test each manager in isolation with mocked dependencies
2. **Integration Testing**: Test interactions between managers and the agent
3. **Compatibility Testing**: Verify existing code continues to function
4. **Performance Testing**: Ensure no performance regressions
5. **UI Testing**: Verify the registration form and agent interactions

## Next Steps

1. 🔄 Complete the implementation of concrete manager classes (45%)
   - ✅ Implement `DefaultToolManager` - Completed
   - ⏳ Implement `DefaultMemoryManager` - Next priority 
   - ⏳ Implement `DefaultPlanningManager`
   - ⏳ Implement `DefaultSchedulerManager`
2. ⏳ Enhance the AgentBase with full manager support
3. ⏳ Update Chloe to use the manager-based architecture
4. ⏳ Implement the enhanced agent registration form
5. ⏳ Develop comprehensive testing and validation
6. ⏳ Plan a gradual rollout strategy

## Benefits of This Approach

1. **Modular Architecture**: Easily add or remove capabilities through managers
2. **Type Safety**: Improved reliability through strong TypeScript interfaces
3. **Separation of Concerns**: Each manager handles a specific aspect of agent behavior
4. **Flexibility**: Support for multiple agents with different configurations
5. **Maintainability**: Consistent patterns make the code easier to understand and maintain
6. **Extensibility**: Easy to add new capabilities through additional managers 