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

## 📋 **PHASE 1: AGGRESSIVE MESSAGE PROCESSING EXTRACTION** 
**Target: -2,000+ lines (Massive Impact)**

> **🔥 STRATEGIC DECISION**: Instead of gradual configuration extraction, we're taking an aggressive approach to extract the entire message processing pipeline in one surgical move. This will deliver immediate massive value with clear architectural boundaries.

### 1.1 Create Core Processing Architecture

- [ ] **Create `AgentMessageProcessor` class**
  - [ ] File: `src/agents/shared/processing/AgentMessageProcessor.ts`
  - [ ] Extract entire `processUserInput()` method (818 lines)
  - [ ] Extract entire `getLLMResponse()` method (267 lines)
  - [ ] Extract `checkSocialMediaCommand()` and related social media logic
  - [ ] Extract command routing and orchestration logic
  - [ ] Implement proper dependency injection
  - [ ] Follow <100 LOC per method rule (break into smaller methods)

- [ ] **Create `AgentResponseFormatter` class**
  - [ ] File: `src/agents/shared/formatting/AgentResponseFormatter.ts`
  - [ ] Extract `formatWorkspaceResponse()` method
  - [ ] Extract `generateSocialMediaResponse()` and related methods
  - [ ] Extract `applyUnifiedFormatting()` method
  - [ ] Extract all response building and formatting logic
  - [ ] Implement platform-specific formatting strategies
  - [ ] Add response validation and error handling

- [ ] **Create `AgentOrchestrator` class**
  - [ ] File: `src/agents/shared/orchestration/AgentOrchestrator.ts`
  - [ ] Extract manager coordination logic
  - [ ] Extract service integration logic
  - [ ] Extract error handling orchestration
  - [ ] Extract resource tracking coordination
  - [ ] Implement service lifecycle management

### 1.2 Message Processing Pipeline Architecture

- [ ] **Design processing pipeline**
  - [ ] Define `MessageProcessingPipeline` interface
  - [ ] Implement pipeline stages: Parse → Route → Execute → Format → Respond
  - [ ] Add pipeline middleware support for extensibility
  - [ ] Include error handling and recovery at each stage
  - [ ] Support async processing and timeouts

- [ ] **Create command routing system**
  - [ ] Define `CommandRouter` interface
  - [ ] Implement intelligent command detection and routing
  - [ ] Support priority-based command selection
  - [ ] Add fallback command handling
  - [ ] Include command validation and preprocessing

- [ ] **Implement response formatting pipeline**
  - [ ] Define `ResponseFormattingPipeline` interface
  - [ ] Support multiple output formats (text, structured, etc.)
  - [ ] Implement platform-specific optimizations
  - [ ] Add response validation and quality checks
  - [ ] Include response caching and optimization

### 1.3 Transform DefaultAgent into Thin Facade

- [ ] **Refactor DefaultAgent to delegation pattern**
  ```typescript
  export class DefaultAgent {
    private messageProcessor: AgentMessageProcessor;
    private responseFormatter: AgentResponseFormatter;
    private orchestrator: AgentOrchestrator;

    async processUserInput(message: string, options?: MessageProcessingOptions): Promise<AgentResponse> {
      return this.messageProcessor.processMessage(message, options);
    }

    async getLLMResponse(message: string, options?: GetLLMResponseOptions): Promise<AgentResponse> {
      return this.messageProcessor.getLLMResponse(message, options);
    }
    
    // All other methods become simple delegation
  }
  ```

- [ ] **Maintain public API compatibility**
  - [ ] Ensure all existing method signatures unchanged
  - [ ] Preserve all existing behavior and responses
  - [ ] Maintain error handling patterns
  - [ ] Keep backward compatibility for all consumers

- [ ] **Implement dependency injection**
  - [ ] Inject processors through constructor
  - [ ] Use factory pattern for processor creation
  - [ ] Support configuration-driven processor selection
  - [ ] Enable processor swapping for testing

### 1.4 State Management and Data Flow

- [ ] **Design clean data flow**
  - [ ] Define clear interfaces between components
  - [ ] Implement immutable data structures where possible
  - [ ] Add proper state management for async operations
  - [ ] Include context passing between processing stages

- [ ] **Handle shared state carefully**
  - [ ] Identify shared state dependencies
  - [ ] Implement proper state synchronization
  - [ ] Add state validation and consistency checks
  - [ ] Include state recovery mechanisms

### 1.5 Testing & Validation

- [ ] **Create comprehensive processor tests**
  - [ ] Unit tests for `AgentMessageProcessor` (cover all 818 lines of logic)
  - [ ] Unit tests for `AgentResponseFormatter`
  - [ ] Unit tests for `AgentOrchestrator`
  - [ ] Integration tests for processor coordination
  - [ ] End-to-end tests for complete message processing pipeline

- [ ] **Create migration validation tests**
  - [ ] Test that all existing DefaultAgent tests still pass
  - [ ] Verify identical behavior for all message types
  - [ ] Check performance is maintained or improved
  - [ ] Validate memory usage hasn't increased
  - [ ] Test error handling preservation

- [ ] **Line count verification**
  - [ ] Measure DefaultAgent.ts line reduction
  - [ ] Target: ~2,400 lines (2,000+ line reduction - MASSIVE IMPACT)
  - [ ] Document actual reduction achieved
  - [ ] Verify new architecture files are properly sized (<500 lines each)

### 1.6 Expected Benefits

**Immediate Benefits:**
- ✅ **Massive complexity reduction**: DefaultAgent becomes simple facade
- ✅ **Clear separation of concerns**: Each processor has single responsibility
- ✅ **Improved testability**: Can test message processing logic in isolation
- ✅ **Better extensibility**: New features go into specific processors
- ✅ **Enhanced maintainability**: Much easier to understand and modify

**Long-term Benefits:**
- ✅ **Plugin architecture ready**: Processors can be swapped/extended
- ✅ **Performance optimization**: Can optimize individual processors
- ✅ **Parallel development**: Teams can work on different processors
- ✅ **Future-proof**: New message types/formats easy to add

---

## 📋 **PHASE 2: CONFIGURATION EXTRACTION & CLEANUP**
**Target: -400 lines**

> **📝 NOTE**: With the massive message processing extraction complete, Phase 2 focuses on cleaning up the remaining complexity through configuration extraction and utility consolidation.

### 2.1 Create Configuration Architecture

- [ ] **Create `DefaultAgentConfiguration` class**
  - [ ] File: `src/agents/shared/config/DefaultAgentConfiguration.ts`
  - [ ] Extract remaining `DefaultAgentConfig` interface complexity
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

### 2.2 Extract Remaining Utility Methods

- [ ] **Create `AgentUtilityService`**
  - [ ] File: `src/agents/shared/services/AgentUtilityService.ts`
  - [ ] Extract helper methods scattered throughout DefaultAgent
  - [ ] Extract validation utilities
  - [ ] Extract common operations
  - [ ] Extract token estimation and text processing utilities

- [ ] **Create `AgentStateManager`**
  - [ ] File: `src/agents/shared/state/AgentStateManager.ts`
  - [ ] Extract agent state management logic
  - [ ] Implement state validation and consistency
  - [ ] Add state persistence and recovery
  - [ ] Include state synchronization mechanisms

### 2.3 Consolidate Initialization Logic

- [ ] **Create `AgentInitializationService`**
  - [ ] File: `src/agents/shared/initialization/AgentInitializationService.ts`
  - [ ] Extract complex initialization logic from DefaultAgent
  - [ ] Implement initialization phases and validation
  - [ ] Add initialization rollback capabilities
  - [ ] Include dependency resolution and service setup

- [ ] **Simplify DefaultAgent constructor and initialize()**
  - [ ] Use configuration classes and services
  - [ ] Remove inline initialization complexity
  - [ ] Maintain initialization order and compatibility
  - [ ] Preserve error handling patterns

### 2.4 Testing & Validation

- [ ] **Create configuration and utility tests**
  - [ ] Unit tests for `DefaultAgentConfiguration`
  - [ ] Unit tests for `AgentUtilityService`
  - [ ] Unit tests for `AgentStateManager`
  - [ ] Unit tests for `AgentInitializationService`
  - [ ] Integration tests for configuration factory

- [ ] **Validate DefaultAgent functionality**
  - [ ] Run full test suite - all tests must pass
  - [ ] Performance benchmark - no degradation
  - [ ] Memory usage check - no increases
  - [ ] Integration test with real agent creation

- [ ] **Line count verification**
  - [ ] Measure DefaultAgent.ts line reduction
  - [ ] Target: ~2,000 lines (400 line reduction from Phase 1 result)
  - [ ] Document actual reduction achieved

---

## 📋 **PHASE 3: PLUGIN ARCHITECTURE & FINAL OPTIMIZATION**
**Target: -600 lines (reach ~1,000-1,400 lines)**

> **🎯 FINAL PHASE**: Transform DefaultAgent into a clean, maintainable facade with plugin architecture for maximum extensibility and future-proofing.

### 3.1 Create Plugin System Architecture

- [ ] **Create plugin infrastructure**
  - [ ] File: `src/agents/shared/plugins/AgentPlugin.ts`
  - [ ] Define `AgentPlugin` interface
  - [ ] Define `PluginContext` interface
  - [ ] Define `PluginLifecycle` interface
  - [ ] Apply strict typing (no `any` types)

- [ ] **Create plugin manager**
  - [ ] File: `src/agents/shared/plugins/AgentPluginManager.ts`
  - [ ] Implement plugin registration system
  - [ ] Implement plugin discovery and loading
  - [ ] Add plugin lifecycle management
  - [ ] Include plugin dependency resolution
  - [ ] Handle plugin failures gracefully

### 3.2 Convert Features to Plugins

- [ ] **Create `ACGPlugin`**
  - [ ] File: `src/agents/shared/plugins/ACGPlugin.ts`
  - [ ] Extract ACG integration logic into plugin
  - [ ] Implement plugin lifecycle hooks
  - [ ] Add ACG configuration management
  - [ ] Include ACG error handling

- [ ] **Create `ErrorManagementPlugin`**
  - [ ] File: `src/agents/shared/plugins/ErrorManagementPlugin.ts`
  - [ ] Extract error management logic into plugin
  - [ ] Implement error handling strategies
  - [ ] Add error classification and recovery
  - [ ] Include error reporting and notifications

- [ ] **Create `VisualizationPlugin`**
  - [ ] File: `src/agents/shared/plugins/VisualizationPlugin.ts`
  - [ ] Extract visualization logic into plugin
  - [ ] Implement visualization tracking
  - [ ] Add visualization lifecycle management
  - [ ] Include visualization failure handling

- [ ] **Create `DelegationPlugin`**
  - [ ] File: `src/agents/shared/plugins/DelegationPlugin.ts`
  - [ ] Extract multi-agent delegation logic into plugin
  - [ ] Implement capability registration
  - [ ] Add delegation request handling
  - [ ] Include delegation result processing

### 3.3 Implement Dependency Injection Container

- [ ] **Create DI container**
  - [ ] File: `src/agents/shared/di/AgentServiceContainer.ts`
  - [ ] Implement service registration and resolution
  - [ ] Add dependency injection patterns
  - [ ] Include service lifecycle management
  - [ ] Support configuration-driven service creation

- [ ] **Refactor DefaultAgent for DI**
  - [ ] Use DI container for service creation
  - [ ] Remove manual dependency management
  - [ ] Implement constructor injection
  - [ ] Add service lifecycle coordination

### 3.4 Final Code Optimization

- [ ] **Remove redundant code**
  - [ ] Eliminate duplicate logic
  - [ ] Remove unused imports and methods
  - [ ] Clean up dead code paths
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

### 3.5 Testing & Validation

- [ ] **Create plugin system tests**
  - [ ] Unit tests for plugin infrastructure
  - [ ] Integration tests for plugin manager
  - [ ] Plugin lifecycle tests
  - [ ] Plugin dependency resolution tests
  - [ ] Plugin error handling tests

- [ ] **Create DI container tests**
  - [ ] Unit tests for service container
  - [ ] Service registration and resolution tests
  - [ ] Service lifecycle tests
  - [ ] Configuration-driven service creation tests

- [ ] **Final comprehensive validation**
  - [ ] Run all DefaultAgent tests
  - [ ] Run all integration tests
  - [ ] Run all end-to-end tests
  - [ ] Verify performance benchmarks
  - [ ] Validate memory usage

- [ ] **Final line count verification**
  - [ ] Measure final DefaultAgent.ts line count
  - [ ] Target: ~1,000-1,400 lines (from ~4,400 lines)
  - [ ] Document total reduction achieved (~3,000+ lines extracted)
  - [ ] Verify all functionality preserved

---

## 📋 **PHASE 4: DOCUMENTATION & MAINTENANCE SETUP**
**Target: Complete architecture documentation and future-proofing**

> **📚 COMPLETION PHASE**: Establish comprehensive documentation, maintenance guidelines, and architectural guardrails to prevent future complexity creep.

### 4.1 Architecture Documentation

- [ ] **Create DefaultAgent V3 comprehensive guide**
  - [ ] File: `src/agents/shared/README.md`
  - [ ] Document new architecture overview
  - [ ] Explain component relationships and data flow
  - [ ] Provide usage examples and best practices
  - [ ] Include troubleshooting guide and FAQ

- [ ] **Update DefaultAgent.ts header documentation**
  - [ ] Add reference to architecture documentation
  - [ ] Include LLM-specific modification instructions
  - [ ] Document architectural boundaries and rules
  - [ ] Reference plugin development guidelines

- [ ] **Create component documentation**
  - [ ] Document `AgentMessageProcessor` architecture
  - [ ] Document `AgentResponseFormatter` capabilities
  - [ ] Document `AgentOrchestrator` responsibilities
  - [ ] Document plugin system architecture

### 4.2 Development Guidelines & Standards

- [ ] **Create feature addition protocol**
  - [ ] Document how to add new features without modifying DefaultAgent
  - [ ] Define plugin creation process and standards
  - [ ] Establish code review requirements and checklists
  - [ ] Include comprehensive testing requirements

- [ ] **Create architectural guardrails**
  - [ ] Set up automated line count monitoring (DefaultAgent max 1,500 lines)
  - [ ] Create complexity monitoring and alerts
  - [ ] Implement architectural tests to prevent violations
  - [ ] Add refactoring triggers and guidelines

- [ ] **Establish maintenance procedures**
  - [ ] Create regular architecture review process
  - [ ] Define technical debt identification and resolution
  - [ ] Establish performance monitoring and benchmarks
  - [ ] Include dependency update and security procedures

### 4.3 Developer Experience Tools

- [ ] **Create development utilities**
  - [ ] Plugin generator scripts and templates
  - [ ] Service template generators
  - [ ] Configuration validators and helpers
  - [ ] Testing utilities and mock factories

- [ ] **Update development documentation**
  - [ ] Update contributing guidelines for new architecture
  - [ ] Document new architectural patterns and principles
  - [ ] Provide migration guides for existing features
  - [ ] Include best practices and anti-patterns

### 4.4 Quality Assurance & Monitoring

- [ ] **Establish quality gates**
  - [ ] Automated testing requirements for all changes
  - [ ] Performance regression detection
  - [ ] Code complexity monitoring
  - [ ] Architecture compliance validation

- [ ] **Create monitoring dashboards**
  - [ ] DefaultAgent complexity metrics
  - [ ] Plugin system health monitoring
  - [ ] Performance and resource usage tracking
  - [ ] Error rate and recovery monitoring

### 4.5 Future-Proofing Strategy

- [ ] **Define extension points**
  - [ ] Document how to extend message processing
  - [ ] Define response formatting extension patterns
  - [ ] Establish plugin development standards
  - [ ] Create integration patterns for new services

- [ ] **Plan evolution strategy**
  - [ ] Define criteria for architectural changes
  - [ ] Establish backwards compatibility requirements
  - [ ] Plan for plugin ecosystem growth
  - [ ] Include migration strategies for major changes

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
- [ ] Phase 1: Aggressive Message Processing Extraction (0%)
- [ ] Phase 2: Configuration Extraction & Cleanup (0%)
- [ ] Phase 3: Plugin Architecture & Final Optimization (0%)
- [ ] Phase 4: Documentation & Maintenance Setup (0%)

### Line Count Progress
- **Current**: ~4,400 lines (estimated with recent additions)
- **Phase 1 Target**: ~2,400 lines (-2,000+ lines - MASSIVE IMPACT)
- **Phase 2 Target**: ~2,000 lines (-400 lines)
- **Phase 3 Target**: ~1,000-1,400 lines (-600 lines)
- **Final Target**: ~1,000-1,400 lines (~3,000+ lines extracted total)

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
