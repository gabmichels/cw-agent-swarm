# Manager Implementation Guide

This document provides guidance on implementing manager classes using the new clean interfaces from the agent-manager refactoring.

## Implementation Pattern

All manager implementations should follow these patterns:

1. **Import from Interface Files**: Import types and interfaces from the `.interface.ts` files, not from the bridge export files.
2. **Extend AbstractBaseManager**: All concrete manager implementations should extend `AbstractBaseManager`.
3. **Implement Specific Interface**: Each implementation should implement its specific interface (e.g., `ReflectionManager`).
4. **Use Proper Type Annotations**: Use proper TypeScript typing for all properties and methods.
5. **Use ManagerType Enum**: Always use the `ManagerType` enum for manager type references.

## Implementation Template

Here's a template for implementing a manager:

```typescript
/**
 * DefaultXXXManager.ts - Default implementation of the XXX Manager
 * 
 * This file provides the default implementation of the XXX Manager interface
 * that provides XXX capabilities for agents.
 */

import { AbstractBaseManager } from '../../base/managers/BaseManager';
import { 
  XXXManager, 
  XXXManagerConfig,
  // Import other types from interface
} from '../../base/managers/XXXManager.interface';
import { ManagerType } from '../../base/managers/ManagerType';
import { AgentBase } from '../../base/AgentBase.interface';
import { v4 as uuidv4 } from 'uuid';

// Optional: Import config factory if needed
import { createConfigFactory } from '../../../lib/config/ConfigFactory';
import { XXXManagerConfigSchema } from '../config/XXXManagerConfigSchema';

/**
 * Default implementation of the XXX Manager
 */
export class DefaultXXXManager extends AbstractBaseManager implements XXXManager {
  // Private members specific to this manager
  private configFactory = createConfigFactory(XXXManagerConfigSchema);
  
  // Override config type to use specific config type
  protected config!: XXXManagerConfig;

  /**
   * Create a new DefaultXXXManager instance
   * 
   * @param agent - The agent this manager belongs to
   * @param config - Configuration options
   */
  constructor(
    agent: AgentBase,
    config: Partial<XXXManagerConfig> = {}
  ) {
    super(
      `xxx-manager-${uuidv4()}`,
      ManagerType.XXX,
      agent,
      { enabled: true }
    );
    
    // Validate and apply configuration with defaults
    this.config = this.configFactory.create({
      enabled: true,
      ...config
    }) as XXXManagerConfig;
  }

  /**
   * Initialize the manager
   */
  async initialize(): Promise<boolean> {
    console.log(`[${this.managerId}] Initializing ${this.managerType} manager`);
    this.initialized = true;
    return true;
  }

  /**
   * Shut down the manager
   */
  async shutdown(): Promise<void> {
    console.log(`[${this.managerId}] Shutting down ${this.managerType} manager`);
    // Clean up resources
  }

  // Implement all interface methods
  // ...
}
```

## Implementation Guidelines

### 1. Configuration Handling

- Use strongly typed configuration objects
- Initialize with default values
- Validate configurations when possible

### 2. Error Handling

- Create specialized error classes for each manager type
- Provide detailed error messages
- Use descriptive error codes

### 3. Logging

- Include meaningful logging throughout manager operations
- Log initialization, shutdown, and significant operations
- Include manager ID in log messages

### 4. Unit Testing

- Create comprehensive tests for each manager implementation
- Test initialization, configuration, and all public methods
- Mock dependencies for isolated testing

### 5. Documentation

- Document all public methods and properties
- Include examples in method documentation
- Document configuration options with descriptions

## Migration Steps

When migrating existing manager implementations:

1. Change imports to use the new interface files
2. Update class definition to implement the new clean interface
3. Fix any type mismatches between implementation and interface
4. Add any missing methods required by the interface
5. Remove any methods not part of the interface
6. Update tests to use the new interfaces

## Example: ReflectionManager

```typescript
import { AbstractBaseManager } from '../../base/managers/BaseManager';
import { 
  ReflectionManager,
  ReflectionManagerConfig,
  Reflection,
  ReflectionInsight,
  ReflectionResult,
  ReflectionTrigger
} from '../../base/managers/ReflectionManager.interface';
import { ManagerType } from '../../base/managers/ManagerType';
import { AgentBase } from '../../base/AgentBase.interface';
import { v4 as uuidv4 } from 'uuid';
import { createConfigFactory } from '../../../lib/config/ConfigFactory';
import { ReflectionManagerConfigSchema } from '../config/ReflectionManagerConfigSchema';

export class DefaultReflectionManager extends AbstractBaseManager implements ReflectionManager {
  private configFactory = createConfigFactory(ReflectionManagerConfigSchema);
  private reflections: Map<string, Reflection> = new Map();
  
  protected config!: ReflectionManagerConfig;

  constructor(agent: AgentBase, config: Partial<ReflectionManagerConfig> = {}) {
    super(`reflection-manager-${uuidv4()}`, ManagerType.REFLECTION, agent, { enabled: true });
    
    this.config = this.configFactory.create({
      enabled: true,
      ...config
    }) as ReflectionManagerConfig;
  }
  
  // Implementation of ReflectionManager interface methods...
}