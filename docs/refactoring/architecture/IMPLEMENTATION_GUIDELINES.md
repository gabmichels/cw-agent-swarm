# Architecture Refactoring Implementation Guidelines

## Introduction

This document provides detailed guidelines for implementing the architecture refactoring project. It covers coding standards, testing requirements, documentation practices, and specific implementation approaches for each key component.

## General Implementation Principles

### 1. Clean Break from Legacy Code

- **REPLACE, DON'T EXTEND**: When encountering legacy code patterns, replace them entirely rather than extending or adapting them
- **NO BACKWARD COMPATIBILITY LAYERS**: Do not create compatibility layers to support old patterns
- **ELIMINATE ANTI-PATTERNS COMPLETELY**: Fully remove timestamp-based IDs, any types, and other flawed implementations
- **ONE-WAY MIGRATION**: Create one-time migration utilities for data, but don't maintain dual-support
- **DELETE AGGRESSIVELY**: Remove outdated code rather than commenting it out or conditionally executing it

### 2. Test-Driven Development

- Write tests before implementing changes
- Create both unit tests and integration tests for all components
- Ensure tests cover both happy paths and error scenarios
- Aim for >95% code coverage for refactored components
- Create performance tests for critical operations

### 3. Industry Best Practices

- **ULID/UUID FOR IDS**: Use ULID (Universally Unique Lexicographically Sortable Identifier) for all identifiers
- **STRICT TYPE SAFETY**: Never use 'any' type in TypeScript; create proper interfaces for all data structures
- **NO STRING LITERALS**: Replace magic strings with enums or constants; centralize shared constants
- **DEPENDENCY INJECTION**: Use constructor injection for all dependencies
- **INTERFACE-FIRST DESIGN**: Define interfaces before implementing classes
- **IMMUTABLE DATA**: Use immutable data patterns whenever possible
- **PURE FUNCTIONS**: Create pure functions without side effects
- **ERROR HANDLING**: Use proper error handling with custom error types

### 4. File Naming Conventions

**CONTEXT-AWARE NAMING**: Different file types serve different purposes and should follow appropriate conventions for their context

**Class and Service Files**: Use PascalCase for files that primarily export classes or services
- **Good**: `DefaultAgent.ts`, `UserService.ts`, `DatabaseProvider.ts`, `AgentManager.ts`
- **Purpose**: Clear correspondence between file names and class names

**Next.js App Router Files**: Follow Next.js conventions (lowercase)
- **Pages**: `page.tsx` (Next.js requirement)
- **Layouts**: `layout.tsx` (Next.js requirement)  
- **API Routes**: `route.ts` (Next.js requirement)
- **Loading/Error**: `loading.tsx`, `error.tsx` (Next.js requirement)
- **Not Found**: `not-found.tsx` (Next.js requirement)

**Module Index Files**: Use lowercase `index.ts`
- **Purpose**: Standard module entry point convention
- **Examples**: `src/agents/shared/index.ts`, `src/lib/database/index.ts`

**Utility and Script Files**: Use kebab-case for standalone utilities and scripts
- **Root Scripts**: `bootstrap-logger.js`, `bootstrap-on-startup.js` (executable scripts)
- **Utility Functions**: `id-conversion.ts`, `request-utils.ts`, `vector-utils.ts`
- **Purpose**: Distinguishes utilities from classes/services

**Test Files**: PascalCase base name + Test suffix
- **Unit Tests**: `UserServiceTest.ts`, `AgentManagerTest.ts`
- **Integration Tests**: `DefaultAgentIntegrationTest.ts`
- **Purpose**: Clear test identification while matching tested class

**Interface Files**: PascalCase base name + Interface suffix  
- **Examples**: `DatabaseProviderInterface.ts`, `AgentManagerInterface.ts`
- **Purpose**: Clear interface identification

**Type Definition Files**: PascalCase base name + Types suffix
- **Examples**: `AgentTypes.ts`, `WorkflowTypes.ts`, `FoundationTypes.ts`
- **Purpose**: Clear type definition identification

**Component Files (React)**: PascalCase for React components
- **Examples**: `ChatBubble.tsx`, `AgentCard.tsx`, `UserProfile.tsx`
- **Purpose**: Matches React component naming convention

**Configuration Files**: kebab-case or standard names
- **Examples**: `next.config.js`, `tsconfig.json`, `package.json`
- **Purpose**: Follow ecosystem standards

### File Naming Decision Tree

```
Is it a Next.js special file? → Use Next.js convention (page.tsx, layout.tsx, route.ts)
    ↓
Is it an index.ts? → Use lowercase index.ts
    ↓
Is it a root executable script? → Use kebab-case (bootstrap-logger.js)
    ↓  
Is it a React component? → Use PascalCase (ChatBubble.tsx)
    ↓
Is it a class/service? → Use PascalCase (UserService.ts)
    ↓
Is it a test file? → Use PascalCase + Test (UserServiceTest.ts)
    ↓
Is it an interface? → Use PascalCase + Interface (UserServiceInterface.ts)
    ↓
Is it types? → Use PascalCase + Types (UserTypes.ts)
    ↓
Is it a utility/helper? → Use kebab-case (request-utils.ts, id-conversion.ts)
```

### Migration Strategy - Refined

**High Priority (PascalCase)**:
- Class files: `bootstrapAgents.ts` → `BootstrapAgents.ts`
- Service files: `databaseAgentRegistration.ts` → `DatabaseAgentRegistration.ts`  
- Test files: `agent-log-test.ts` → `AgentLogTest.ts`
- Interface files: `AgentBase.interface.ts` → `AgentBaseInterface.ts`
- Type files: `foundation-types.ts` → `FoundationTypes.ts`

**Keep As-Is (Follow Conventions)**:
- Next.js files: `page.tsx`, `layout.tsx`, `route.ts` (framework requirement)
- Index files: `index.ts` (module convention)
- Root scripts: `bootstrap-logger.js` (executable script convention)
- Config files: `next.config.js`, `tsconfig.json` (ecosystem standard)

**Utility Files (kebab-case)**:
- Pure utilities: `request-utils.ts`, `id-conversion.ts`, `vector-utils.ts`
- Helper functions: `metadata-helpers.ts`, `filter-builder.ts`

### Benefits of Context-Aware Naming

1. **Framework Compliance**: Respects Next.js, React, and Node.js conventions
2. **Developer Intuition**: Files named according to their purpose and content
3. **Tool Compatibility**: Works with framework tooling and IDE expectations
4. **Consistency Within Context**: Similar file types follow the same pattern
5. **Ecosystem Alignment**: Matches industry standards for each file type

### 5. ID Generation Strategy (UUID vs ULID)

**Database Layer (Prisma Schema)**: Always use `@default(uuid())` for primary keys
- Prisma generates standard UUIDs for database storage
- Ensures compatibility with all database engines (PostgreSQL, SQLite, etc.)
- Provides foreign key consistency and relational integrity

**Application Layer (Services)**: Use ULID for business logic and tracking
- Generate ULIDs in services using `ulid()` function for sortable, time-ordered IDs
- Use ULID for request tracking, error logging, and business entities
- Provides chronological ordering and better debugging experience

**Conversion Layer**: Use utilities for cross-system compatibility
- `convertToQdrantId()` for Qdrant vector database (requires UUID format)
- `generateULID()` for application-level tracking and business logic
- Maintain both formats when needed for different system requirements

**Example Implementation**:
```typescript
// Database model (Prisma schema)
model ErrorLog {
  id String @id @default(uuid()) // Database uses UUID
  // other fields
}

// Service layer (Application code)
class ErrorService {
  async logError(error: BaseError): Promise<string> {
    const trackingId = ulid(); // Business logic uses ULID
    await this.db.errorLog.create({
      data: {
        // id auto-generated as UUID by Prisma
        trackingId, // Store ULID for business tracking
        // other fields
      }
    });
    return trackingId; // Return ULID for application use
  }
}
```

### 9. String Literals and Constants Management

**ELIMINATE MAGIC STRINGS**: Never use string literals directly in code logic; always use enums or constants

**Local Constants**: For values used only within a single file or class
```typescript
// Local constants for single-file usage
const LOCAL_CONFIG = {
  MAX_RETRY_ATTEMPTS: 3,
  DEFAULT_TIMEOUT: 5000,
  CACHE_PREFIX: 'user_session'
} as const;

// Local enum for single-file usage
enum LocalStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}
```

**Centralized Constants**: For values shared across multiple files, use centralized constant files in `src/constants/`
```typescript
// src/constants/agent.ts
export const AGENT_TYPES = {
  RESEARCH: 'research',
  COMMUNICATION: 'communication',
  ANALYSIS: 'analysis',
  WORKFLOW: 'workflow'
} as const;

export const AGENT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  ARCHIVED: 'archived'
} as const;

export type AgentType = typeof AGENT_TYPES[keyof typeof AGENT_TYPES];
export type AgentStatus = typeof AGENT_STATUS[keyof typeof AGENT_STATUS];
```

**Enums for Related Values**: Use enums for logically grouped constants with type safety
```typescript
// src/constants/workflow.ts
export enum WorkflowExecutionStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum WorkflowPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4
}
```

**API Constants**: Centralize API-related constants
```typescript
// src/constants/api.ts
export const API_ROUTES = {
  AGENTS: '/api/agents',
  WORKFLOWS: '/api/workflows',
  MEMORY: '/api/memory',
  KNOWLEDGE_GRAPH: '/api/knowledge-graph'
} as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
} as const;
```

**Database Constants**: Centralize database-related strings
```typescript
// src/constants/database.ts
export const COLLECTION_NAMES = {
  AGENTS: 'agents',
  MEMORIES: 'memories',
  KNOWLEDGE_NODES: 'knowledge_nodes',
  RELATIONSHIPS: 'relationships'
} as const;

export const INDEX_NAMES = {
  AGENT_TYPE: 'idx_agent_type',
  MEMORY_TIMESTAMP: 'idx_memory_timestamp',
  KNOWLEDGE_VECTOR: 'idx_knowledge_vector'
} as const;
```

**Usage Examples**:
```typescript
// BAD: Magic strings
if (agent.type === 'research') {
  // logic
}

// GOOD: Using constants
import { AGENT_TYPES } from '@/constants/agent';

if (agent.type === AGENT_TYPES.RESEARCH) {
  // logic
}

// BAD: Magic strings in API calls
const response = await fetch('/api/agents');

// GOOD: Using centralized constants
import { API_ROUTES } from '@/constants/api';

const response = await fetch(API_ROUTES.AGENTS);
```

**Validation with Constants**:
```typescript
// Type-safe validation using constants
import { AGENT_STATUS, AgentStatus } from '@/constants/agent';

function isValidAgentStatus(status: string): status is AgentStatus {
  return Object.values(AGENT_STATUS).includes(status as AgentStatus);
}

// Usage in validation
if (!isValidAgentStatus(inputStatus)) {
  throw new ValidationError(`Invalid agent status: ${inputStatus}`);
}
```

### 5. Performance Consciousness

- Optimize query patterns for Qdrant
- Implement efficient data structures for high-volume operations
- Use appropriate caching strategies
- Minimize database round-trips
- Consider memory usage and garbage collection

### 6. Don't overengineer

- Keep it simple
- Stick to the defined scope

### 7. No placeholder implementation
- Avoid placeholder implementations, aim for full implementations

### 8. Error Handling Integration

**Use Centralized Error Management**: All new implementations must integrate with the comprehensive error communication system documented in `@error-communication.md`

- **Never use silent failures**: All errors must be logged and communicated to users
- **Use structured error types**: Leverage the `BaseError` hierarchy and error classification system
- **Integrate with notifications**: Use `IErrorManagementService` for user communication and retry strategies
- **Follow error patterns**: Use established error types (`ToolExecutionError`, `WorkspacePermissionError`, etc.)
- **Enable anti-hallucination**: Ensure agents never claim success when actual failures occur

**Example Integration**:
```typescript
class YourService {
  constructor(
    private readonly errorManager: IErrorManagementService
  ) {}

  async yourMethod(): Promise<Result> {
    try {
      // Your business logic
      return await this.performOperation();
    } catch (error) {
      // Create structured error
      const structuredError = ErrorFactory.createToolExecutionError(
        error.message,
        { agentId: 'agent_123', operation: 'yourMethod' }
      );
      
      // Log and handle error (includes user notification and retry logic)
      await this.errorManager.logError(structuredError);
      
      // Re-throw or return appropriate result
      throw structuredError;
    }
  }
}
```

## Component-Specific Guidelines

### Memory System Implementation

#### ID Generation (ULID)

```typescript
// Example ULID implementation approach
import { ulid } from 'ulid';
import { StructuredId } from '../types/entity-identifier';

export class IdGenerator {
  static generate(prefix: string): StructuredId {
    const timestamp = new Date();
    const id = ulid(timestamp.getTime());
    return {
      id,
      prefix,
      timestamp,
      toString: () => `${prefix}_${id}`
    };
  }
  
  static parse(structuredId: string): StructuredId {
    // Parse implementation that handles the new format only
  }
}
```

#### Memory Service Wrappers

- Create abstract base classes for memory services
- Implement strong typing for all operations
- Add validation before all write operations
- Include comprehensive error handling
- Optimize query patterns for performance

```typescript
// Example memory service base class
export abstract class BaseMemoryService<T extends BaseEntity> {
  constructor(
    protected readonly collectionName: string,
    protected readonly memoryClient: QdrantClient,
    protected readonly validator: SchemaValidator<T>
  ) {}

  protected abstract mapToEntity(record: QdrantRecord): T;
  protected abstract mapFromEntity(entity: T): QdrantRecord;

  async create(entity: T): Promise<T> {
    this.validator.validate(entity);
    // Implementation
  }
  
  // Additional methods
}
```

### Error Handling Framework

- Create a hierarchy of custom error types
- Include context information in all errors
- Standardize error handling across the system
- Implement proper logging with structured data
- Add telemetry for error patterns

```typescript
// Example error hierarchy
export class AppError extends Error {
  constructor(
    message: string, 
    public readonly code: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class MemoryError extends AppError {
  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, `MEMORY_${code}`, context);
    this.name = 'MemoryError';
  }
}

// Additional error types
```

### Knowledge Graph Implementation

- Implement clean interfaces for graph operations
- Use strong typing for nodes and relationships
- Include validation for graph integrity
- Optimize traversal algorithms for performance
- Implement quantitative relationship scoring

```typescript
// Example graph interface
export interface GraphIntelligenceEngine {
  addNode(node: GraphNode): Promise<GraphNode>;
  addRelationship(relationship: GraphRelationship): Promise<GraphRelationship>;
  findPath(startNodeId: string, endNodeId: string, options: PathOptions): Promise<GraphPath[]>;
  discoverRelationships(nodeId: string, depth: number): Promise<GraphRelationship[]>;
  extractInsights(subjectIds: string[]): Promise<GraphInsight[]>;
}
```

### Modularization Approach

- Break down large classes into focused components
- Create clear interfaces between modules
- Use dependency injection for all components
- Minimize shared state
- Apply the Single Responsibility Principle

```typescript
// Example of decomposing a large class
// Instead of:
class ToolFallbackManager {
  // 500+ lines with multiple responsibilities
}

// Create focused classes:
class ToolRegistry {
  // Tool registration and lookup
}

class FallbackStrategy {
  // Fallback decision logic
}

class ToolExecutor {
  // Tool execution handling
}

class ToolFallbackOrchestrator {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly strategy: FallbackStrategy,
    private readonly executor: ToolExecutor
  ) {}
  
  // Orchestration logic
}
```

## Testing Requirements

### Unit Testing

- Test each class and function in isolation
- Use dependency injection to mock dependencies
- Test all error scenarios and edge cases
- Verify type constraints at compile time
- Test performance for critical operations

```typescript
// Example unit test
describe('IdGenerator', () => {
  it('should generate a valid ULID', () => {
    const id = IdGenerator.generate('TEST');
    expect(id.prefix).toBe('TEST');
    expect(id.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/); // ULID format
    expect(id.timestamp).toBeInstanceOf(Date);
    expect(id.toString()).toBe(`TEST_${id.id}`);
  });
  
  // Additional tests
});
```

### Integration Testing

- Test interactions between components
- Verify proper data flow through the system
- Test error propagation and handling
- Ensure components work together correctly
- Test with real dependencies when appropriate

### Performance Testing

- Create baseline performance metrics
- Implement automated performance tests
- Test with realistic data volumes
- Measure and optimize critical paths
- Verify performance improvements

## Documentation Requirements

### API Documentation

- Document all public APIs with TypeScript docstrings
- Include examples for common operations
- Document error scenarios and handling
- Specify performance characteristics
- Keep documentation in sync with implementation

```typescript
/**
 * Adds a new relationship between two nodes in the knowledge graph
 * 
 * @param relationship - The relationship to add
 * @returns The created relationship with populated metadata
 * @throws {GraphError} If either node doesn't exist or the relationship is invalid
 * 
 * @example
 * ```
 * const relationship = await graphEngine.addRelationship({
 *   sourceId: 'node1',
 *   targetId: 'node2', 
 *   type: 'DEPENDS_ON',
 *   weight: 0.8,
 *   metadata: { reason: 'explicit dependency' }
 * });
 * ```
 */
addRelationship(relationship: GraphRelationship): Promise<GraphRelationship>;
```

### Architecture Documentation

- Create component diagrams for all modules
- Document interactions between components
- Explain design decisions with rationales
- Include performance considerations
- Document optimization strategies

## Implementation Process

1. **Design First**: Create detailed designs with interfaces before implementation
2. **Test Second**: Write tests that verify requirements
3. **Implement Third**: Create the implementation according to the guidelines
4. **Validate Last**: Verify the implementation meets all requirements

Each component should be implemented in isolation, validated, and then integrated with the system. The refactoring should proceed component by component, prioritizing the highest impact areas first. 