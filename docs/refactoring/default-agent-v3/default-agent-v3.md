# DefaultAgent V3 Refactoring Implementation Plan

> **⚠️ IMPORTANT FOR LLMs**: If you are an AI assistant modifying the DefaultAgent, **READ THIS DOCUMENT FIRST**: `docs/refactoring/default-agent-v3/default-agent-v3.md`

## 🎯 **PROJECT OVERVIEW**

**Goal**: Reduce DefaultAgent.ts from ~3,783 lines to ~1,000 lines while maintaining all functionality and preventing future architectural debt.

**Target Architecture**: Lean Agent Pattern with Command/Strategy patterns, Service Layer, and Plugin Architecture.

**Constraints**: 
- ✅ No breaking changes to public API
- ✅ All existing tests must pass
- ✅ Gradual, incremental refactoring
- ✅ Follow @IMPLEMENTATION_GUIDELINES.md principles
- ✅ Apply @arch-refactor-guidelines and @modular-code rules

## 🔍 **CURRENT STATE ANALYSIS**

### Major Issues Identified
1. **Massive Configuration Interface** (233 lines) - `DefaultAgentConfig` is enormous
2. **Monolithic Methods** - `processUserInput()` is ~818 lines, `getLLMResponse()` is ~267 lines
3. **Initialization Complexity** - `initialize()` method handles too many concerns
4. **Feature Creep** - ACG integration, error management, visualization, delegation all added directly
5. **Utility Methods** - Helper functions scattered throughout the class

### Test Coverage Status
- ✅ Basic functionality tests exist (`DefaultAgent.test.ts` - 386 lines)
- ❌ Missing comprehensive tests for `processUserInput` (818 lines of logic)
- ❌ Missing comprehensive tests for `getLLMResponse` (267 lines of logic)
- ❌ Missing tests for ACG integration functionality
- ❌ Missing tests for error management integration
- ❌ Missing tests for multi-agent delegation
- ❌ Missing tests for workspace integration

### Architecture Problems
- **Violation of Single Responsibility Principle**: DefaultAgent does everything
- **High Coupling**: Direct dependencies on many services
- **Low Cohesion**: Unrelated functionality mixed together
- **Poor Extensibility**: Adding features requires modifying the core class
- **Testing Difficulties**: Large methods are hard to test comprehensively

---

## 📋 **PHASE 0: PRE-REFACTORING VALIDATION**

### Test Coverage Analysis & Updates

- [ ] **Audit current DefaultAgent test coverage**
  - [ ] Analyze `src/agents/shared/__tests__/DefaultAgent.test.ts` (386 lines)
  - [ ] Check coverage for core methods: `processUserInput`, `getLLMResponse`, `think`
  - [ ] Document missing test scenarios
  - [ ] Verify integration tests in `DefaultAgent.integration.test.ts`

- [ ] **Update test files to match current implementation**
  - [ ] Add missing tests for `processUserInput` method (818 lines of logic)
  - [ ] Add missing tests for `getLLMResponse` method (267 lines of logic)
  - [ ] Add missing tests for `think` method delegation
  - [ ] Add tests for ACG integration functionality
  - [ ] Add tests for error management integration
  - [ ] Add tests for multi-agent delegation
  - [ ] Add tests for workspace integration

- [ ] **Establish baseline test suite**
  - [ ] Run all DefaultAgent tests and document current pass/fail status
  - [ ] Create regression test checklist
  - [ ] Set up automated test runner for continuous validation
  - [ ] Document expected test execution time baseline

- [ ] **Create comprehensive end-to-end test**
  - [ ] Test full agent lifecycle (init → process → shutdown)
  - [ ] Test all manager integrations
  - [ ] Test error scenarios and recovery
  - [ ] Test resource management and cleanup

### Architecture Documentation

- [ ] **Document current architecture**
  - [ ] Create component diagram of current DefaultAgent structure
  - [ ] Document all dependencies and their relationships
  - [ ] Map out all manager types and their responsibilities
  - [ ] Document configuration complexity (233-line interface)

- [ ] **Create refactoring safety checklist**
  - [ ] Define "definition of done" for each phase
  - [ ] Create rollback procedures for each phase
  - [ ] Document critical functionality that must be preserved
  - [ ] Establish performance benchmarks

---

## 📋 **PHASE 1: CONFIGURATION EXTRACTION** 
**Target: -200 lines**

### 1.1 Create Configuration Architecture

- [ ] **Create `DefaultAgentConfiguration` class**
  - [ ] File: `src/agents/shared/config/DefaultAgentConfiguration.ts`
  - [ ] Extract 233-line `DefaultAgentConfig` interface
  - [ ] Implement configuration validation
  - [ ] Add configuration merging with defaults
  - [ ] Apply ULID for configuration tracking
  - [ ] Follow <100 LOC per method rule

- [ ] **Create configuration sub-modules**
  - [ ] `ManagerConfiguration.ts` - Manager-specific configs
  - [ ] `ComponentConfiguration.ts` - Component-specific configs  
  - [ ] `ACGConfiguration.ts` - ACG-specific configs
  - [ ] `ErrorManagementConfiguration.ts` - Error handling configs
  - [ ] `VisualizationConfiguration.ts` - Visualization configs

- [ ] **Implement configuration factory pattern**
  - [ ] Create `ConfigurationFactory.ts`
  - [ ] Implement configuration builder pattern
  - [ ] Add configuration validation pipeline
  - [ ] Support environment-based configuration overrides

### 1.2 Update DefaultAgent to Use New Configuration

- [ ] **Refactor DefaultAgent constructor**
  - [ ] Replace inline configuration logic
  - [ ] Inject `DefaultAgentConfiguration` instance
  - [ ] Remove configuration-related private methods
  - [ ] Maintain backward compatibility

- [ ] **Update initialization process**
  - [ ] Use configuration classes in `initialize()` method
  - [ ] Remove configuration mapping logic
  - [ ] Simplify manager configuration setup

### 1.3 Testing & Validation

- [ ] **Create configuration tests**
  - [ ] Unit tests for `DefaultAgentConfiguration`
  - [ ] Integration tests for configuration factory
  - [ ] Validation tests for all configuration types
  - [ ] Migration tests for existing configurations

- [ ] **Validate DefaultAgent functionality**
  - [ ] Run full test suite - all tests must pass
  - [ ] Performance benchmark - no degradation
  - [ ] Memory usage check - no increases
  - [ ] Integration test with real agent creation

- [ ] **Line count verification**
  - [ ] Measure DefaultAgent.ts line reduction
  - [ ] Target: ~3,583 lines (200 line reduction)
  - [ ] Document actual reduction achieved

---

## 📋 **PHASE 2: COMMAND PATTERN IMPLEMENTATION**
**Target: -500 lines**

### 2.1 Create Command Infrastructure

- [ ] **Create base command interfaces**
  - [ ] File: `src/agents/shared/commands/AgentCommand.ts`
  - [ ] Define `AgentCommand` interface
  - [ ] Define `CommandContext` interface
  - [ ] Define `CommandResult` interface
  - [ ] Apply strict typing (no `any` types)

- [ ] **Create command processor**
  - [ ] File: `src/agents/shared/commands/AgentCommandProcessor.ts`
  - [ ] Implement command registration system
  - [ ] Implement command discovery and routing
  - [ ] Add command execution pipeline
  - [ ] Include error handling and recovery
  - [ ] Follow <100 LOC per method rule

### 2.2 Extract Processing Logic into Commands

- [ ] **Create `ScheduledTaskCommand`**
  - [ ] File: `src/agents/shared/commands/ScheduledTaskCommand.ts`
  - [ ] Extract scheduled task logic from `processUserInput`
  - [ ] Implement task creation and scheduling
  - [ ] Add proper error handling
  - [ ] Include comprehensive logging

- [ ] **Create `ExternalToolCommand`**
  - [ ] File: `src/agents/shared/commands/ExternalToolCommand.ts`
  - [ ] Extract external tool execution logic
  - [ ] Implement planning manager integration
  - [ ] Add tool delegation capabilities
  - [ ] Handle execution failures gracefully

- [ ] **Create `LLMResponseCommand`**
  - [ ] File: `src/agents/shared/commands/LLMResponseCommand.ts`
  - [ ] Extract direct LLM response logic
  - [ ] Implement context preparation
  - [ ] Add response formatting
  - [ ] Include thinking result integration

- [ ] **Create `WorkspaceCommand`**
  - [ ] File: `src/agents/shared/commands/WorkspaceCommand.ts`
  - [ ] Extract workspace integration logic
  - [ ] Implement ACG-enhanced processing
  - [ ] Add workspace result formatting
  - [ ] Handle workspace failures

### 2.3 Refactor DefaultAgent processUserInput

- [ ] **Simplify processUserInput method**
  - [ ] Replace 818-line method with command delegation
  - [ ] Keep orchestration logic only
  - [ ] Maintain all existing functionality
  - [ ] Preserve error handling behavior

- [ ] **Update request routing logic**
  - [ ] Use thinking results for command selection
  - [ ] Implement command priority system
  - [ ] Add fallback command handling
  - [ ] Maintain backward compatibility

### 2.4 Testing & Validation

- [ ] **Create command tests**
  - [ ] Unit tests for each command class
  - [ ] Integration tests for command processor
  - [ ] End-to-end tests for command execution
  - [ ] Error scenario tests for all commands

- [ ] **Validate processUserInput behavior**
  - [ ] Run existing processUserInput tests
  - [ ] Verify all processing paths work correctly
  - [ ] Check error handling preservation
  - [ ] Confirm response format consistency

- [ ] **Line count verification**
  - [ ] Measure DefaultAgent.ts line reduction
  - [ ] Target: ~3,083 lines (500 line reduction)
  - [ ] Document actual reduction achieved

---

## 📋 **PHASE 3: SERVICE LAYER EXTRACTION**
**Target: -400 lines**

### 3.1 Create Service Architecture

- [ ] **Create orchestration service**
  - [ ] File: `src/agents/shared/services/AgentOrchestrationService.ts`
  - [ ] Extract high-level orchestration logic
  - [ ] Implement service coordination
  - [ ] Add request lifecycle management
  - [ ] Include performance monitoring

- [ ] **Create visualization service**
  - [ ] File: `src/agents/shared/services/AgentVisualizationService.ts`
  - [ ] Extract visualization tracking logic
  - [ ] Implement visualization coordination
  - [ ] Add visualization lifecycle management
  - [ ] Handle visualization failures gracefully

- [ ] **Create delegation service wrapper**
  - [ ] File: `src/agents/shared/services/AgentDelegationService.ts`
  - [ ] Extract multi-agent delegation logic
  - [ ] Implement capability registration
  - [ ] Add delegation request handling
  - [ ] Include delegation result processing

### 3.2 Extract Complex Operations

- [ ] **Extract initialization logic**
  - [ ] Create `AgentInitializationService.ts`
  - [ ] Move complex initialization logic
  - [ ] Implement initialization phases
  - [ ] Add initialization validation
  - [ ] Include rollback capabilities

- [ ] **Extract error management logic**
  - [ ] Create `AgentErrorService.ts`
  - [ ] Move error handling orchestration
  - [ ] Implement error classification
  - [ ] Add error recovery strategies
  - [ ] Include error reporting

- [ ] **Extract utility methods**
  - [ ] Create `AgentUtilityService.ts`
  - [ ] Move helper methods
  - [ ] Implement utility functions
  - [ ] Add common operations
  - [ ] Include validation utilities

### 3.3 Refactor DefaultAgent Core Methods

- [ ] **Simplify getLLMResponse method**
  - [ ] Replace 267-line method with service calls
  - [ ] Keep API compatibility
  - [ ] Maintain response format
  - [ ] Preserve error handling

- [ ] **Simplify think method**
  - [ ] Replace complex logic with service delegation
  - [ ] Maintain thinking result format
  - [ ] Preserve fallback behavior
  - [ ] Keep timeout handling

- [ ] **Simplify initialization method**
  - [ ] Use initialization service
  - [ ] Maintain initialization order
  - [ ] Preserve error handling
  - [ ] Keep backward compatibility

### 3.4 Testing & Validation

- [ ] **Create service tests**
  - [ ] Unit tests for all services
  - [ ] Integration tests for service coordination
  - [ ] Service lifecycle tests
  - [ ] Service error handling tests

- [ ] **Validate core method behavior**
  - [ ] Run all existing tests
  - [ ] Verify method signatures unchanged
  - [ ] Check response format consistency
  - [ ] Confirm error handling preservation

- [ ] **Line count verification**
  - [ ] Measure DefaultAgent.ts line reduction
  - [ ] Target: ~2,683 lines (400 line reduction)
  - [ ] Document actual reduction achieved

---

## 📋 **PHASE 4: FINAL OPTIMIZATION & PLUGIN ARCHITECTURE**
**Target: -683 lines (reach ~1,000 lines)**

### 4.1 Code Optimization

- [ ] **Remove redundant code**
  - [ ] Eliminate duplicate logic
  - [ ] Remove unused imports
  - [ ] Clean up dead code
  - [ ] Optimize import statements

- [ ] **Consolidate remaining methods**
  - [ ] Group related functionality
  - [ ] Extract small utility functions
  - [ ] Simplify method signatures
  - [ ] Reduce method complexity

- [ ] **Apply modular-code rules**
  - [ ] Ensure no method exceeds 100 LOC
  - [ ] Split large methods into smaller ones
  - [ ] Apply single responsibility principle
  - [ ] Use dependency injection consistently

### 4.2 Plugin Architecture Implementation

- [ ] **Create plugin system**
  - [ ] File: `src/agents/shared/plugins/AgentPlugin.ts`
  - [ ] Define plugin interface
  - [ ] Implement plugin loader
  - [ ] Add plugin lifecycle management
  - [ ] Include plugin dependency resolution

- [ ] **Convert features to plugins**
  - [ ] Create `ACGPlugin.ts`
  - [ ] Create `ErrorManagementPlugin.ts`
  - [ ] Create `VisualizationPlugin.ts`
  - [ ] Create `DelegationPlugin.ts`

- [ ] **Update DefaultAgent for plugins**
  - [ ] Add plugin registration system
  - [ ] Implement plugin initialization
  - [ ] Add plugin configuration support
  - [ ] Include plugin error handling

### 4.3 Dependency Injection Container

- [ ] **Create DI container**
  - [ ] File: `src/agents/shared/di/AgentServiceContainer.ts`
  - [ ] Implement service registration
  - [ ] Add dependency resolution
  - [ ] Include lifecycle management
  - [ ] Support configuration injection

- [ ] **Refactor DefaultAgent for DI**
  - [ ] Use DI container for service creation
  - [ ] Remove manual dependency management
  - [ ] Implement constructor injection
  - [ ] Add service lifecycle coordination

### 4.4 Final Testing & Validation

- [ ] **Comprehensive test suite**
  - [ ] Run all DefaultAgent tests
  - [ ] Run all integration tests
  - [ ] Run all end-to-end tests
  - [ ] Verify performance benchmarks

- [ ] **Plugin system tests**
  - [ ] Test plugin loading and unloading
  - [ ] Test plugin dependencies
  - [ ] Test plugin error handling
  - [ ] Test plugin configuration

- [ ] **Final line count verification**
  - [ ] Measure final DefaultAgent.ts line count
  - [ ] Target: ~1,000 lines
  - [ ] Document total reduction achieved
  - [ ] Verify all functionality preserved

---

## 📋 **PHASE 5: DOCUMENTATION & MAINTENANCE**

### 5.1 Architecture Documentation

- [ ] **Create DefaultAgent V3 README**
  - [ ] File: `src/agents/shared/README.md`
  - [ ] Document new architecture
  - [ ] Explain component relationships
  - [ ] Provide usage examples
  - [ ] Include troubleshooting guide

- [ ] **Update DefaultAgent.ts header comment**
  - [ ] Add reference to architecture documentation
  - [ ] Include LLM-specific instructions
  - [ ] Document modification guidelines
  - [ ] Reference maintenance procedures

### 5.2 Maintenance Guidelines

- [ ] **Create feature addition protocol**
  - [ ] Document how to add new features
  - [ ] Define plugin creation process
  - [ ] Establish code review requirements
  - [ ] Include testing requirements

- [ ] **Create architectural guardrails**
  - [ ] Set up automated line count checks
  - [ ] Create complexity monitoring
  - [ ] Implement architectural tests
  - [ ] Add refactoring triggers

### 5.3 Developer Experience

- [ ] **Create development tools**
  - [ ] Plugin generator scripts
  - [ ] Service template generators
  - [ ] Configuration validators
  - [ ] Testing utilities

- [ ] **Update development documentation**
  - [ ] Update contributing guidelines
  - [ ] Document new architectural patterns
  - [ ] Provide migration guides
  - [ ] Include best practices

---

## 🚨 **CRITICAL SUCCESS CRITERIA**

### Functionality Preservation
- [ ] All existing public APIs work unchanged
- [ ] All existing tests pass without modification
- [ ] Performance is maintained or improved
- [ ] Memory usage is not increased

### Architecture Quality
- [ ] DefaultAgent.ts is under 1,200 lines
- [ ] No method exceeds 100 lines of code
- [ ] All components follow single responsibility principle
- [ ] Dependency injection is used throughout

### Maintainability
- [ ] New features can be added without modifying DefaultAgent
- [ ] Plugin system supports extensibility
- [ ] Configuration is externalized and manageable
- [ ] Code complexity is reduced

### Testing & Quality
- [ ] Test coverage is maintained or improved
- [ ] All integration tests pass
- [ ] Performance benchmarks are met
- [ ] Error handling is preserved

---

## 📊 **PROGRESS TRACKING**

### Phase Completion Status
- [ ] Phase 0: Pre-refactoring Validation (0%)
- [ ] Phase 1: Configuration Extraction (0%)
- [ ] Phase 2: Command Pattern Implementation (0%)
- [ ] Phase 3: Service Layer Extraction (0%)
- [ ] Phase 4: Final Optimization & Plugin Architecture (0%)
- [ ] Phase 5: Documentation & Maintenance (0%)

### Line Count Progress
- **Current**: 3,783 lines
- **Phase 1 Target**: 3,583 lines (-200)
- **Phase 2 Target**: 3,083 lines (-500)
- **Phase 3 Target**: 2,683 lines (-400)
- **Final Target**: ~1,000 lines (-2,783 total)

### Quality Gates
- [ ] All tests passing after each phase
- [ ] No performance degradation after each phase
- [ ] No breaking changes to public API
- [ ] Documentation updated after each phase

---

## 🔧 **ROLLBACK PROCEDURES**

Each phase includes rollback procedures:

1. **Git branch strategy**: Each phase in separate branch
2. **Backup procedures**: Full backup before each phase
3. **Test validation**: Comprehensive testing before merge
4. **Performance monitoring**: Benchmark validation required
5. **Rollback triggers**: Defined criteria for rollback decisions

---

**Remember**: This is a gradual, test-driven refactoring. Each phase must be completed successfully before proceeding to the next phase. All functionality must be preserved throughout the process.
