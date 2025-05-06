# Metadata Refactoring Test Plan

## Overview

This document outlines the testing strategy for the memory metadata refactoring project. It defines the test scope, test levels, test types, and test cases to ensure the refactored code meets the required quality standards and doesn't introduce regressions.

## Test Scope

The testing will cover:

1. Core type definitions in `src/types/metadata.ts`
2. Structured identifier system in `src/types/structured-id.ts`
3. Factory functions in `src/server/memory/services/helpers/metadata-helpers.ts`
4. Memory service wrappers in `src/server/memory/services/memory/memory-service-wrappers.ts`
5. Schema implementations in `src/server/memory/models/`
6. Integration with message creation/consumption points (proxy.ts, AgentBase.ts, etc.)
7. End-to-end memory operations

## Test Levels

### Unit Tests

Unit tests will focus on isolated components or functions to ensure they work correctly in isolation.

### Integration Tests

Integration tests will focus on the interaction between components to ensure they work correctly together.

### End-to-End Tests

End-to-end tests will simulate real-world scenarios to ensure the system works correctly as a whole.

## Test Types

### Functional Tests

Ensure that functions and components meet the specified requirements.

### Type Safety Tests

Ensure that TypeScript's type system correctly catches type errors.

### Performance Tests

Measure the performance impact of the refactoring.

### Regression Tests

Ensure that existing functionality continues to work correctly after changes.

## Test Cases

### Unit Tests

#### Type Definitions Tests

1. **Test BaseMetadata validation**
   - Verify that a valid BaseMetadata object passes validation
   - Verify that an invalid BaseMetadata object fails validation
   - Verify that importance levels are correctly validated

2. **Test ThreadInfo validation**
   - Verify that a valid ThreadInfo object passes validation
   - Verify that an invalid ThreadInfo object fails validation
   - Verify that position must be a non-negative number

3. **Test MessageMetadata validation**
   - Verify that a valid MessageMetadata object passes validation
   - Verify that an invalid MessageMetadata object fails validation
   - Verify that required fields are correctly enforced

4. **Test CognitiveProcessMetadata validation**
   - Verify that valid ThoughtMetadata passes validation
   - Verify that valid ReflectionMetadata passes validation
   - Verify that required fields are correctly enforced
   - Verify that process type is correctly validated

5. **Test DocumentMetadata validation**
   - Verify that a valid DocumentMetadata object passes validation
   - Verify that an invalid DocumentMetadata object fails validation
   - Verify that source field is correctly validated

6. **Test TaskMetadata validation**
   - Verify that a valid TaskMetadata object passes validation
   - Verify that an invalid TaskMetadata object fails validation
   - Verify that status and priority are correctly validated

#### Structured ID Tests

1. **Test createUserId**
   - Verify that a valid user ID is created
   - Verify that the namespace is set correctly
   - Verify that the type is set correctly

2. **Test createAgentId**
   - Verify that a valid agent ID is created
   - Verify that the namespace is set correctly
   - Verify that the type is set correctly

3. **Test createChatId**
   - Verify that a valid chat ID is created
   - Verify that the namespace is set correctly
   - Verify that the type is set correctly

4. **Test parseStructuredId**
   - Verify that a valid string ID is parsed correctly
   - Verify that an invalid string ID returns null
   - Verify that namespace, type, and id are extracted correctly
   - Verify that an optional version is parsed correctly

#### Factory Function Tests

1. **Test createThreadInfo**
   - Verify that a valid ThreadInfo object is created
   - Verify that id and position are set correctly
   - Verify that parentId is optional

2. **Test createMessageMetadata**
   - Verify that a valid MessageMetadata object is created
   - Verify that required fields are set correctly
   - Verify that optional fields are handled correctly
   - Verify that the schema version is set correctly

3. **Test createThoughtMetadata**
   - Verify that a valid ThoughtMetadata object is created
   - Verify that process type is set to THOUGHT
   - Verify that agentId is set correctly
   - Verify that the schema version is set correctly

4. **Test createDocumentMetadata**
   - Verify that a valid DocumentMetadata object is created
   - Verify that source is set correctly
   - Verify that agentId is set correctly
   - Verify that the schema version is set correctly

5. **Test createTaskMetadata**
   - Verify that a valid TaskMetadata object is created
   - Verify that title, status, and priority are set correctly
   - Verify that agentId is set correctly
   - Verify that the schema version is set correctly

#### Memory Service Wrapper Tests

1. **Test addMessageMemory**
   - Verify that a message is added correctly
   - Verify that metadata is created correctly
   - Verify that the memory service is called with correct parameters

2. **Test addCognitiveProcessMemory**
   - Verify that a cognitive process is added correctly
   - Verify that metadata is created correctly
   - Verify that the memory service is called with correct parameters

3. **Test addDocumentMemory**
   - Verify that a document is added correctly
   - Verify that metadata is created correctly
   - Verify that the memory service is called with correct parameters

4. **Test addTaskMemory**
   - Verify that a task is added correctly
   - Verify that metadata is created correctly
   - Verify that the memory service is called with correct parameters

5. **Test search functions**
   - Verify that messages can be searched
   - Verify that cognitive processes can be searched
   - Verify that documents can be searched
   - Verify that tasks can be searched
   - Verify that search criteria are applied correctly

### Integration Tests

1. **Test memory service integration**
   - Verify that memory service wrappers correctly interact with the memory service
   - Verify that memory types are correctly set
   - Verify that schema validation works at service level

2. **Test thread handling**
   - Verify that a thread can be created
   - Verify that messages can be added to an existing thread
   - Verify that thread positions are incremented correctly
   - Verify that parent-child relationships are handled correctly

3. **Test multi-agent support**
   - Verify that messages with different agents are handled correctly
   - Verify that agent-to-agent communication works correctly
   - Verify that sender and receiver agents are set correctly

4. **Test user message handling**
   - Verify that user messages are stored correctly
   - Verify that user IDs are handled correctly
   - Verify that attachments are stored correctly

5. **Test agent message handling**
   - Verify that agent messages are stored correctly
   - Verify that agent IDs are handled correctly
   - Verify that message types are handled correctly

6. **Test internal message handling**
   - Verify that internal messages are stored correctly
   - Verify that internal message types are handled correctly
   - Verify that internal messages are filtered correctly

### End-to-End Tests

1. **Test message conversation flow**
   - Verify that a full conversation can be stored and retrieved
   - Verify that thread relationships are maintained
   - Verify that user and agent messages are correctly associated

2. **Test agent reasoning flow**
   - Verify that thoughts, reflections, and insights can be stored and retrieved
   - Verify that cognitive processes are correctly associated with an agent
   - Verify that cognitive processes are correctly associated with a context

3. **Test document handling flow**
   - Verify that documents can be stored and retrieved
   - Verify that document metadata is correctly stored
   - Verify that documents can be searched by content and metadata

4. **Test task management flow**
   - Verify that tasks can be stored and retrieved
   - Verify that task status changes are correctly handled
   - Verify that task assignments are correctly handled

5. **Test API endpoint interaction**
   - Verify that API endpoints correctly use the new metadata structure
   - Verify that API responses include the correct metadata
   - Verify that API requests correctly handle the metadata

### Performance Tests

1. **Memory retrieval performance**
   - Measure the average time to retrieve a memory
   - Measure the impact of the new metadata structure on retrieval time
   - Measure the impact of structured IDs on retrieval performance

2. **Memory storage performance**
   - Measure the average time to store a memory
   - Measure the impact of the new metadata structure on storage time
   - Measure the impact of metadata validation on storage performance

3. **Search performance**
   - Measure the average time to search for memories
   - Measure the impact of the new metadata structure on search time
   - Measure the impact of structured IDs on search performance

4. **Memory footprint**
   - Measure the average size of a memory with the new metadata structure
   - Compare with the average size of a memory with the old metadata structure
   - Measure the impact on database size

### Regression Tests

1. **API compatibility**
   - Verify that existing API endpoints continue to work correctly
   - Verify that API responses have the expected structure
   - Verify that API clients can handle the new metadata structure

2. **UI compatibility**
   - Verify that UI components correctly display metadata
   - Verify that UI components correctly handle structured IDs
   - Verify that UI components correctly handle thread relationships

3. **Agent functionality**
   - Verify that agents can store and retrieve memories
   - Verify that agents can access memory across sessions
   - Verify that agents can correctly handle threads

4. **Legacy code compatibility**
   - Verify that legacy code that consumes metadata continues to work
   - Verify that legacy code that creates metadata continues to work
   - Identify and document any breaking changes

## Test Environment

### Development Environment

- Local development environment with mock memory services
- Unit tests run with Jest
- Type checks run with TypeScript compiler

### Staging Environment

- Staging environment with real memory services
- Integration tests run with Jest or Cypress
- End-to-end tests run with Cypress or Playwright

### Production Environment

- Production environment with real memory services
- Performance monitoring
- Error tracking

## Testing Tools

- Jest for unit and integration tests
- TypeScript compiler for type safety tests
- Cypress or Playwright for end-to-end tests
- Performance monitoring tools (to be determined)

## Test Data

- Mock data for unit tests
- Synthetic data for integration tests
- Representative data for end-to-end tests
- Production-like data for performance tests

## Test Execution

### Unit Tests

Unit tests will be run:
- Automatically on each commit
- Before pull request merge
- As part of continuous integration

### Integration Tests

Integration tests will be run:
- Before pull request merge
- As part of continuous integration
- Before deployment to staging

### End-to-End Tests

End-to-end tests will be run:
- Before deployment to staging
- Before deployment to production
- After deployment to production (smoke tests)

### Performance Tests

Performance tests will be run:
- Before deployment to production
- After deployment to production (with limited scope)
- Periodically to monitor performance trends

## Test Reporting

- Unit and integration test results will be reported in the CI/CD pipeline
- End-to-end test results will be reported in the CI/CD pipeline
- Performance test results will be reported in a dashboard
- Test coverage will be reported as part of the CI/CD pipeline

## Success Criteria

The testing will be considered successful if:

1. All unit tests pass
2. All integration tests pass
3. All end-to-end tests pass
4. Performance meets or exceeds pre-refactoring baselines
5. No new bugs are introduced
6. Test coverage meets or exceeds pre-refactoring levels
7. No regressions are detected in existing functionality

## Test Schedule

| Test Type | When | Duration | Responsible |
|-----------|------|----------|-------------|
| Unit Tests | Continuous | Minutes | Developers |
| Integration Tests | Pre-merge | Hours | Developers |
| End-to-End Tests | Pre-deployment | Hours | QA Team |
| Performance Tests | Pre-production | Days | Performance Team |
| Regression Tests | Pre-production | Days | QA Team |

## Risks and Mitigations

| Risk | Description | Mitigation |
|------|-------------|------------|
| Type Errors | Refactoring may introduce type errors | Comprehensive type safety tests |
| Performance Impact | New metadata structure may impact performance | Performance tests before and after |
| Breaking Changes | Refactoring may break existing code | Comprehensive regression tests |
| Data Migration | Existing data may not be compatible | Migration scripts and validation |
| Test Coverage | Tests may not cover all scenarios | Code review and test coverage analysis | 