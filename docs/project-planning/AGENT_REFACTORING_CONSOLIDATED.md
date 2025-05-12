# Consolidated Agent Architecture Refactoring Plan

## Executive Summary

Our agent architecture refactoring project aims to create a flexible, extensible framework that supports multiple agents with different capabilities, while decoupling from the Chloe-specific implementation. This consolidated plan merges multiple planning documents to create a coherent approach for implementation.

The core strategy leverages existing architecture components (`AgentBase`, `BaseManager`) to create a manager-based agent architecture with clear interfaces, type safety, and consistent patterns. This approach will allow us to support multiple agents with different capabilities while maintaining compatibility with existing code.

## Recent Progress (June 2024)

- **Interface Separation:**
  - Extracted `AgentBase` and `ManagersConfig` interfaces into their own files (`AgentBase.interface.ts`, `ManagersConfig.interface.ts`) for clarity and maintainability.
  - Renamed `AgentBase.ts` to `AbstractAgentBase.ts` to clearly distinguish the abstract class implementation from the interface.
- **Type Safety & Linting:**
  - All linter errors in base and shared agent code have been resolved.
  - All mock/test agents now fully implement the interface contract with no `any` types.
- **Testing:**
  - All tests in `src/agents/shared` (including base and capabilities) are passing, confirming the stability of the refactor and interface separation.
- **Documentation:**
  - Tracker and design documentation updated to reflect new file structure and interface-first approach.

## Current Status

| Component | Status | Progress |
|-----------|--------|----------|
| Base Interfaces | ✅ Complete | 100% |
| Abstract Base Classes | ✅ Complete | 100% |
| Manager Interfaces | ✅ Complete | 100% |
| Concrete Implementations | 🟡 In Progress | 95% |
| Implementation Migration | 🟡 In Progress | 98% |
| Testing & Validation | 🟡 In Progress | 45% |
| **Configuration System** | 🟡 In Progress | 80% |

### Core Architecture Components

| Component | Status | Notes |
|-----------|--------|-------|
| BaseManager Interface | ✅ Completed | Core manager interface defined |
| Manager Interfaces | ✅ Completed | All 8 manager interfaces implemented |
| AgentBase Interface | ✅ Completed | Core agent interface defined |
| Abstract Base Implementations | ✅ Completed | AbstractAgentBase and AbstractBaseManager implemented |
| Concrete Implementations | 🟡 In Progress | Six default implementations completed (DefaultToolManager, DefaultMemoryManager, DefaultPlanningManager, DefaultKnowledgeManager, DefaultSchedulerManager, DefaultQueryManager) |
| Implementation Migration | 🟡 In Progress | Memory system migration complete, query system complete, planning system in progress |
| Testing & Validation | 🟡 In Progress | Basic test suite implemented, expanding coverage |
| **ConfigFactory Implementation** | ✅ Completed | Core configuration factory with validation implemented |
| **Configuration Schemas** | 🟡 In Progress | Created schemas for Memory, Planning, Tool, and Knowledge managers |

### Code Modularization and Testing Plan (New Priority)

Several manager implementations have grown too large and need to be broken down into smaller, more focused components. This refactoring will improve maintainability, testability, and adherence to the Single Responsibility Principle.

#### Files Requiring Refactoring

1. **DefaultPlanAdaptationManager** (~2000 lines)
   - Current Status: 🟡 Needs immediate attention
   - Proposed Structure:
     ```
     src/server/planning/
     ├── managers/
     │   ├── DefaultPlanAdaptationManager.ts (core orchestration)
     │   ├── PlanOptimizationManager.ts ✅
     │   ├── PlanValidationManager.ts ✅
     │   └── PlanMetricsManager.ts ✅
     ├── strategies/
     │   ├── TimeOptimizationStrategy.ts ✅
     │   ├── ResourceOptimizationStrategy.ts ✅
     │   ├── ReliabilityOptimizationStrategy.ts ✅
     │   └── EfficiencyOptimizationStrategy.ts ✅
     ├── validators/
     │   ├── DependencyValidator.ts ✅
     │   ├── ResourceValidator.ts ✅
     │   └── PlanValidator.ts ✅
     ├── metrics/
     │   ├── AdaptationMetrics.ts ✅
     │   ├── OptimizationMetrics.ts ✅
     │   └── ValidationMetrics.ts
     └── utils/
         ├── PlanStepConverter.ts ✅
         ├── ResourceAnalyzer.ts ✅
         └── PlanMetricsCalculator.ts ✅
     ```

2. **InMemoryCacheManager** (~500 lines)
   - Current Status: 🟡 Needs attention
   - Proposed Structure:
     ```
     src/server/memory/services/cache/
     ├── managers/
     │   ├── InMemoryCacheManager.ts (core orchestration)
     │   └── CacheMetricsManager.ts
     ├── strategies/
     │   ├── AdaptiveTtlStrategy.ts
     │   ├── PriorityEvictionStrategy.ts
     │   └── CacheOptimizationStrategy.ts
     ├── validators/
     │   └── CacheEntryValidator.ts
     └── utils/
         ├── CacheEntryConverter.ts
         └── CacheMetricsCalculator.ts
     ```

3. **BatchOperationManager** (~400 lines)
   - Current Status: 🟡 Needs attention
   - Proposed Structure:
     ```
     src/server/memory/services/batch/
     ├── managers/
     │   ├── BatchOperationManager.ts (core orchestration)
     │   └── BatchMetricsManager.ts
     ├── strategies/
     │   ├── BatchOptimizationStrategy.ts
     │   └── BatchRetryStrategy.ts
     └── utils/
         ├── BatchOperationConverter.ts
         └── BatchMetricsCalculator.ts
     ```

#### Testing Implementation Plan

1. **Unit Testing Requirements**
   - Test coverage target: >95% for all refactored components
   - Each component should have its own test suite
   - Mock all dependencies
   - Test both success and error paths
   - Include performance benchmarks

2. **Integration Testing Requirements**
   - Test interactions between components
   - Verify data flow through the system
   - Test error propagation
   - Include end-to-end tests for critical paths

3. **Test Structure**
   ```
   src/server/__tests__/
   ├── planning/
   │   ├── managers/
   │   ├── strategies/
   │   ├── validators/
   │   └── metrics/
   ├── memory/
   │   ├── cache/
   │   └── batch/
   └── integration/
       ├── planning/
       └── memory/
   ```

#### Implementation Timeline

1. **Phase 1: Planning System Refactoring** (High Priority)
   - Week 1: Break down DefaultPlanAdaptationManager
   - Week 2: Implement unit tests
   - Week 3: Implement integration tests
   - Week 4: Performance testing and optimization

2. **Phase 2: Memory System Refactoring** (Medium Priority)
   - Week 5: Break down InMemoryCacheManager
   - Week 6: Break down BatchOperationManager
   - Week 7: Implement unit tests
   - Week 8: Implement integration tests

3. **Phase 3: Testing and Validation** (Ongoing)
   - Continuous integration testing
   - Performance benchmarking
   - Code coverage monitoring
   - Documentation updates

#### Success Criteria

1. **Code Quality**
   - No file exceeds 300 lines
   - Each class has a single responsibility
   - Clear interfaces between components
   - Comprehensive error handling
   - Type safety throughout

2. **Testing**
   - >95% code coverage
   - All critical paths tested
   - Performance benchmarks established
   - Integration tests passing
   - No regression in functionality

3. **Documentation**
   - Updated component diagrams
   - Clear interface documentation
   - Usage examples
   - Performance characteristics
   - Migration guides

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

### Phase 2: Manager Implementation Adaptation (95% Complete)

1. **Memory Management Adaptation (100% Complete)**
   - ✅ Created `ChloeMemoryManager` adapter
   - ✅ Implemented core memory operations
   - ✅ Created `DefaultMemoryManager` implementation
   - ✅ Implemented basic memory consolidation and pruning
   - ✅ Implemented thread identification
   - ✅ Implemented memory decay mechanism
   - ✅ Implemented advanced memory features:
     - ✅ Knowledge graph integration
     - ✅ Query expansion and clustering
     - ✅ Hybrid search capabilities
     - ✅ Version control system
     - ✅ Memory rollback functionality
   - 🟡 Testing and validation (in progress)
   - 🟡 Performance optimization (in progress)

2. **Query Management Adaptation (100% Complete)**
   - ✅ Created `QueryOptimizer` implementation
   - ✅ Implemented `QueryCache` with advanced features:
     - ✅ Type-safe caching with generics
     - ✅ Adaptive TTL based on query type
     - ✅ Partial result caching
     - ✅ Collection-based cache management
     - ✅ Tag-based cache invalidation
   - ✅ Implemented query optimization strategies:
     - ✅ Balanced strategy for general queries
     - ✅ High-quality strategy for complex queries
     - ✅ High-speed strategy for simple queries
     - ✅ Context-aware strategy with dynamic adjustment
   - ✅ Added query suggestion system
   - ✅ Implemented timeout handling
   - ✅ Added comprehensive error handling
   - 🟡 Testing and validation (in progress)
   - 🟡 Performance optimization (in progress)

3. **Planning Management Adaptation (95% Complete)**
   - ✅ Created `ChloePlanningManager` adapter
   - ✅ Implemented plan creation and execution
   - ✅ Plan adaptation and optimization now use modular system (DefaultPlanningManager)
   - ✅ Integrated DefaultPlanningManager into AgentBase (auto-registration and API exposure)
   - 🟡 Testing and validation (in progress, integration testing deprioritized for now)

4. **Scheduling Management Adaptation (✅ Completed)**
   - ✅ DefaultSchedulerManager and related scheduling components refactored and integrated
   - ✅ Type-safe, interface-first implementation
   - ✅ Fully compatible with new AgentBase architecture

5. **Adapter Patterns for Backward Compatibility**
   - ❌ Removed: Per implementation guidelines, no backward compatibility layers or legacy system bridges will be implemented. All code must follow the new architecture with a clean break from legacy patterns.

### Phase 2.5: Memory System Migration (In Progress - 90%)

### Priority Items (Next Steps)

#### Memory Type Implementation in Default Agent System

#### Core Memory Types
- ✅ MESSAGE - Basic message memories
- ✅ DOCUMENT - Document-based memories
- ✅ THOUGHT - Agent thought processes
- ✅ REFLECTION - Agent reflections
- ✅ INSIGHT - Agent insights
- ✅ TASK - Task-related memories

#### Knowledge Types
- ✅ FACT - Factual information
- ✅ KNOWLEDGE - General knowledge
- ✅ SYSTEM_LEARNING - System learning
- ✅ IDEA - Ideas and concepts
- ✅ SUMMARY - Summaries of information

#### Decision Types
- ✅ DECISION - Decision records
- ✅ FEEDBACK - Feedback records

#### Agent Interaction Types
- ✅ AGENT_MESSAGE - Direct agent messages
- ✅ AGENT_REQUEST - Agent requests
- ✅ AGENT_RESPONSE - Agent responses
- ✅ AGENT_TASK - Agent task assignments
- ✅ AGENT_KNOWLEDGE - Agent knowledge sharing
- ✅ AGENT_COLLABORATION - Agent collaboration records

#### System Types
- ✅ SYSTEM_EVENT - System events
- ✅ SYSTEM_COMMAND - System commands
- ✅ SYSTEM_STATUS - System status updates
- ✅ SYSTEM_ERROR - System errors

#### Version Control Types
- ✅ MEMORY_EDIT - Memory version history
  - ✅ Implemented version tracking system
  - ✅ Added edit metadata support
  - ✅ Integrated with memory update process
  - ✅ Added version history UI
  - ✅ Completed real version history implementation
  - 🟡 Memory rollback functionality (in progress)
  - 🟡 Diff visualization (in progress)
  - 🔴 Collaborative editing features (not started)

#### Implementation Tasks

1. **DefaultAgent Memory Manager Updates**
   - ✅ Add support for all memory types
   - ✅ Implement type-specific processing
   - ✅ Add memory type validation
   - ✅ Add memory categorization
   - ✅ Add version control support
   - ✅ Complete real version history implementation
   - ✅ Implement query expansion and clustering
   - ✅ Add hybrid search capabilities
   - ✅ Implement memory decay system
   - 🟡 Add memory rollback functionality

2. **Memory Storage Updates**
   - ✅ Update schema for all types
   - ✅ Add type-specific indices
   - ✅ Add version control tables
   - ✅ Add edit history storage
   - ✅ Optimize version history queries
   - 🟡 Add batch history operations

3. **Memory Processing Updates**
   - ✅ Add type-specific processing
   - ✅ Add version tracking
   - ✅ Add edit metadata handling
   - ✅ Add diff generation
   - ✅ Implement query expansion
   - ✅ Implement query clustering
   - ✅ Add hybrid search processing
   - 🟡 Enhance diff algorithm
   - 🔴 Add collaborative editing support

4. **Memory API Updates**
   - ✅ Add type-specific endpoints
   - ✅ Add version history endpoints
   - ✅ Add edit tracking
   - ✅ Add diff endpoints
   - ✅ Add hybrid search endpoints
   - ✅ Add query expansion endpoints
   - 🟡 Add rollback endpoints
   - 🟡 Add batch history endpoints

5. **Memory UI Updates**
   - ✅ Add type-specific displays
   - ✅ Add version history UI
   - ✅ Add edit metadata display
   - ✅ Add diff visualization
   - ✅ Add hybrid search UI
   - 🟡 Enhance version history UI
   - 🟡 Add memory comparison view
   - 🟡 Add rollback UI

### Next Steps

1. **Complete Memory System Testing (High Priority)**
   - Implement comprehensive unit tests for memory operations
   - Add integration tests for hybrid search
   - Test query expansion and clustering
   - Validate memory decay system
   - Test version control functionality

2. **Performance Optimization (High Priority)**
   - Optimize hybrid search performance
   - Implement caching for frequent queries
   - Add batch processing for memory operations
   - Optimize knowledge graph operations
   - Improve memory consolidation efficiency

3. **Planning System Completion (Medium Priority)**
   - Complete plan adaptation
   - Add plan optimization
   - Integrate with memory system
   - Add plan visualization

4. **Scheduling System Enhancement (Medium Priority)**
   - Complete resource management
   - Add scheduling optimization
   - Integrate with planning system
   - Add schedule visualization

### Deferred Tasks (Post-Release)

The following tasks have been deferred to post-release as they are not critical for core functionality:

1. **UI Enhancements**
   - Enhance diff visualization
   - Add collaborative editing features
   - Implement enhanced memory analytics

2. **Advanced Features**
   - Complex memory visualization
   - Advanced debugging tools
   - System diagnostics

### Recent Achievements

1. **Query System**
   - Successfully implemented comprehensive query optimization system
   - Added sophisticated caching with type safety and adaptive TTL
   - Implemented multiple optimization strategies
   - Added query suggestion capabilities
   - Implemented robust error handling
   - Added timeout management
   - Completed query system migration

2. **Memory System**
   - Successfully implemented comprehensive query expansion with domain-specific terms
   - Added dynamic category generation for memory clustering
   - Implemented hybrid search with semantic and keyword scoring
   - Added importance-based memory boosting
   - Implemented structured content detection
   - Added thread-based memory organization
   - Completed version control system implementation

3. **Search Capabilities**
   - Implemented hybrid search combining semantic and keyword matching
   - Added query expansion with domain-specific terms
   - Implemented dynamic query clustering
   - Added importance-based result boosting
   - Implemented structured content detection

### Current Focus Areas

1. **Testing and Validation**
   - Implementing comprehensive test suite
   - Validating query optimization strategies
   - Testing cache performance and invalidation
   - Verifying query suggestion accuracy
   - Testing timeout handling
   - Validating memory operations
   - Testing hybrid search performance
   - Verifying version control system
   - Testing memory decay system

2. **Performance Optimization**
   - Optimizing query execution
   - Improving cache hit rates
   - Enhancing query suggestion performance
   - Optimizing search performance
   - Implementing caching
   - Improving memory consolidation
   - Optimizing knowledge graph operations
   - Enhancing batch processing

3. **UI/UX Improvements**
   - Enhancing version history display
   - Improving memory visualization
   - Adding advanced search interface
   - Implementing memory analytics dashboard
   - Adding relationship visualization

### Phase 3: AgentBase Enhancement (🟡 In Progress)

> **Note:** All work in this phase strictly follows [IMPLEMENTATION_GUIDELINES.md]: interface-first design, strict type safety, no `any`, dependency injection, clean break from legacy, and test-driven development.

#### Implementation Plan
1. **Design Interfaces for Manager Registration and Initialization**
   - Define clear, type-safe interfaces for manager registration, lookup, and lifecycle management in AgentBase.
   - Ensure all manager interactions are discoverable and type-safe.
   - Document interface contracts and expected behaviors.
2. **Implement Standardized Manager Registration/Initialization**
   - Implement the designed interfaces in AgentBase.
   - Add unit tests for registration, lookup, and initialization logic.
3. **Type-Safe Manager Access**
   - Refactor manager access patterns to use the new interfaces.
   - Add compile-time checks for manager type safety.
4. **Manager Lifecycle Management**
   - Implement standardized init/shutdown for all managers via AgentBase.
   - Add error handling and lifecycle tests.
5. **Manager-First Core Functionality**
   - Refactor AgentBase to delegate core functions to managers where appropriate.
6. **Agent Memory Isolation and Routing**
   - Add support for agent-scoped memory isolation and simple routing.
7. **Documentation and Insights**
   - Update design docs and this tracker with implementation insights and lessons learned.

#### Tasks and Progress Tracker

| Task | Status | Progress |
|------|--------|----------|
| Standardize manager registration and initialization | ✅ Complete | 100% |
| Improve type-safety of manager interactions | ✅ Complete | 100% |
| Add manager lifecycle management (init/shutdown) | ✅ Complete | 100% |
| Delegate core functionality to managers (memory, planning) | ✅ Complete | 100% |
| **Interface separation & file renaming** | ✅ Complete | 100% |
| **Implement manager-first approach to core functionality** | ✅ Complete | 100% |
| **Configuration System Standardization** | 🟡 In Progress | 80% |
| Add basic agent memory isolation | ⏳ Not Started | 0% |
| Implement simple agent memory routing | ⏳ Not Started | 0% |

#### Implementation Insights (Updated)
- Interface-first design and file separation greatly improve maintainability and clarity.
- Abstract class (`AbstractAgentBase`) now only contains implementation logic, while interfaces are reusable and importable across the codebase.
- All tests passing after a major refactor is a strong indicator of architectural stability.
- Manager-first delegation is now fully implemented for all core manager types (Memory, Planning, Tool, Knowledge, Scheduler) providing a clean, consistent API for agent implementations.
- Each delegation method follows the same pattern: retrieve manager, check initialization, delegate the call, ensuring consistent error handling across the codebase.

#### Current Implementation Step
- **Implementing Configuration System Standardization for all manager types.**
  - ✅ Define structured schema interfaces for each manager configuration
  - ✅ Create validation logic for configuration with type-safety
  - ✅ Implement configuration inheritance and defaulting
  - ✅ Add runtime validation for configuration values
  - ✅ Create configuration presets for common agent types
  - 🟡 Add comprehensive test coverage for configuration handling (in progress)
  - ✅ Document configuration system design and usage patterns

### Phase 4: Configuration System (🟡 In Progress)

#### Configuration System Implementation Progress

The Configuration System implementation has made significant progress with the following components now complete:

1. **Core Configuration Framework:**
   - ✅ Created `ConfigValidator` interface and implementation
   - ✅ Implemented configuration error classes with detailed messages
   - ✅ Created `DefaultsProvider` interface and implementation
   - ✅ Implemented validation utilities for common types (numbers, strings, booleans, arrays, objects)
   - ✅ Added range validation, pattern validation, and enum validation
   - ✅ Created `ConfigFactory<T>` class with validation and defaulting support
   - ✅ Implemented different update strategies (MERGE, REPLACE, DEEP_MERGE)

2. **Manager-Specific Configurations:**
   - ✅ Defined `MemoryManagerConfigSchema` with validation rules
   - ✅ Defined `PlanningManagerConfigSchema` with validation rules
   - ✅ Defined `ToolManagerConfigSchema` with validation rules
   - ✅ Defined `KnowledgeManagerConfigSchema` with validation rules
   - ✅ Created role-specific presets for each manager type
   - ✅ Implemented factory functions for creating configurations with presets
   - 🟡 Integration with manager implementations (in progress)

3. **Documentation:**
   - ✅ Created comprehensive README with usage examples
   - ✅ Added example implementation demonstrating configuration creation, validation, and updates
   - ✅ Documented all configuration presets and their use cases
   - ✅ Added extension guide for creating new configuration schemas

#### Next Steps:

1. **Remaining Manager Configurations:**
   - Create `SchedulerManagerConfigSchema` with validation rules
   - Create `ReflectionManagerConfigSchema` with validation rules
   - Create `InputProcessorConfigSchema` with validation rules 
   - Create `OutputProcessorConfigSchema` with validation rules

2. **Integration and Testing:**
   - Update manager implementations to use the new configuration system
   - Add unit tests for validation logic
   - Add integration tests for configuration handling
   - Test configuration inheritance and composition

3. **Agent Configuration Orchestration:**
   - Implement `AgentConfigFactory` for orchestrating manager configs
   - Add capability-based configuration selection
   - Implement configuration dependency resolution
   - Create domain-specific configuration bundles

### Phase 5: Agent Registration Flow Enhancement (⏳ Not Started)

1. ⏳ Update the agent registration flow:
   - ⏳ Add UI support for manager configuration
   - ⏳ Implement template-based agent creation
   - ⏳ Create preset configurations for common agent types
   - ⏳ Add validation to ensure consistent agent configuration

### Phase 6: Testing and Validation (⏳ Not Started)

1. ⏳ Develop essential test suite:
   - ⏳ Unit tests for core memory operations
   - ⏳ Basic integration tests for agent memory isolation
   - ⏳ Simple performance tests for memory loading
   - ⏳ Basic UI tests for MemoryTab
   - ⏳ **Note:** Backward compatibility with legacy code is **not required** and should not be a goal, per implementation guidelines. All tests should target the new architecture only.

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

### MemoryTab Integration

The MemoryTab will be enhanced to support agent-scoped views:

```typescript
interface MemoryTabProps {
  // Existing props
  isLoadingMemories?: boolean;
  allMemories?: ExtendedMemoryItem[];
  onRefresh?: () => void;
  
  // New props for agent support
  selectedAgentId?: string;
  availableAgents?: string[];
  onAgentChange?: (agentId: string) => void;
  showAllMemories?: boolean;
  onViewChange?: (showAll: boolean) => void;
}

// MemoryTab component will use MemoryRouter for proper isolation
const MemoryTab: React.FC<MemoryTabProps> = ({
  selectedAgentId,
  availableAgents = [],
  onAgentChange,
  showAllMemories = false,
  onViewChange,
  // ... existing props
}) => {
  // Use MemoryRouter for agent-scoped access
  const { getAgentMemories, getAllMemories } = useMemoryRouter();
  
  // Load memories based on view mode
  const loadMemories = useCallback(async () => {
    if (showAllMemories) {
      return getAllMemories();
    }
    return selectedAgentId ? getAgentMemories(selectedAgentId) : [];
  }, [showAllMemories, selectedAgentId]);
  
  // ... rest of implementation
};
```

### Agent Memory Isolation

The memory system will use the existing MemoryRouter for proper isolation:

```typescript
// MemoryRouter already supports this
export class MemoryRouter {
  // ... existing code ...
  
  /**
   * Get memories for a specific agent
   */
  async getAgentMemories(agentId: string): Promise<MemoryEntry[]> {
    const scopes = this.getAccessibleScopes(agentId);
    return this.getMemoriesByScopes(scopes);
  }
  
  /**
   * Get all memories (when needed)
   */
  async getAllMemories(): Promise<MemoryEntry[]> {
    if (!this.options.enableSharedMemory) {
      throw new Error('Shared memory access is disabled');
    }
    return this.getMemoriesByScopes([this.options.defaultNamespace]);
  }
}
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

## Next Steps (Updated)

### 1. Implement Core Configuration Framework

**Immediate Focus** (Next 1-2 Weeks):
- Create the core configuration infrastructure:
  - `ConfigValidator` interface and implementation
  - `ConfigurationError` class
  - `DefaultsProvider` interface and implementation
- Implement validation utilities for common types
- Create the `ConfigFactory<T>` class with validation and defaulting
- Define common configuration types and interfaces

### 2. Implement Manager-Specific Configurations

**Short-term Focus** (Next 2-4 Weeks):
- Start with Memory and Planning manager configurations as they're most commonly used
- Define schema and validation rules for each
- Implement default providers and presets
- Add comprehensive testing for validation logic
- Update manager implementations to use the new configuration system

### 3. Expand Test Suite

**Continuous Priority**:
- Add unit tests for all validation rules and configuration factories
- Test error handling and edge cases
- Create integration tests that verify configuration changes during runtime
- Test configuration inheritance and composition

### 4. Documentation

**Ongoing**:
- Document the configuration system architecture
- Create comprehensive configuration guides for each manager type
- Add examples for common configuration scenarios
- Update architectural diagrams to reflect the new configuration system

### 5. Final Integration 

**Medium-term Goal** (4-6 Weeks):
- Implement agent configuration orchestration
- Add capability-based configuration selection
- Create domain-specific configuration bundles
- Implement configuration serialization and persistence

This updated plan focuses our efforts on the Configuration System, which is the next critical phase in our agent architecture refactoring. By completing this work, we'll provide a robust, type-safe foundation for all agent configuration needs, ensuring consistency, validation, and ease of use across the codebase.

## Implementation Timeline

### Phase 1: Foundation (Current)
- MemoryTab agent integration
- Basic performance optimization
- Essential testing
- Core system stability

### Phase 2: Cognitive Features (Next)
- Basic memory consolidation
- Simple relationship inference
- Basic memory decay
- Simple insight generation

### Phase 3: Advanced Features (Future)
- Complex memory visualization
- Advanced debugging tools
- Memory analytics
- System diagnostics 