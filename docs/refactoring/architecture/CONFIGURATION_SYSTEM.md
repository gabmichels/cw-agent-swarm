# Agent Configuration System

## Overview

The Agent Configuration System provides a robust, type-safe framework for validating, managing, and orchestrating configuration across all agent managers. This document outlines the key components, patterns, and usage examples for developers working with the system.

## Key Components

### 1. Configuration Schema

Each manager defines a strongly-typed schema that describes its configuration structure, validation rules, and default values.

```typescript
// Example schema for a manager
export const MemoryManagerConfigSchema: ConfigSchema<MemoryManagerConfig> = {
  enabled: {
    type: 'boolean',
    required: true,
    default: true,
    description: 'Whether the memory manager is enabled'
  },
  maxHistoryItems: {
    type: 'number',
    min: 10,
    max: 1000,
    default: 100,
    description: 'Maximum number of history items to maintain'
  },
  // Additional properties...
};
```

### 2. Configuration Factory

Configuration factories validate and create properly typed configurations using the defined schemas.

```typescript
// Creating a configuration factory
const configFactory = createConfigFactory(MemoryManagerConfigSchema);

// Creating a validated configuration
const config = configFactory.create({
  maxHistoryItems: 250
});
```

### 3. Configuration Presets

Each manager can define presets for common use cases that can be easily applied.

```typescript
// Example preset usage
const config = createMemoryManagerConfig('HIGH_PERFORMANCE', {
  // Override specific properties
  maxHistoryItems: 500
});
```

### 4. Configuration Orchestration

The `AgentConfigOrchestrator` manages interdependencies between different manager configurations, ensuring consistency and compatibility.

```typescript
// Example orchestrator usage
const orchestrator = new AgentConfigOrchestrator(agent, agentConfigSchema);

// Register dependencies
orchestrator.registerDependencies(CommonConfigDependencies);

// Apply dependencies
orchestrator.applyDependencies();
```

### 5. Configuration Migration

The system supports versioned configurations and seamless migration between versions.

```typescript
// Creating a migration manager
const migrationManager = new ConfigMigrationManager<MyConfig>();

// Registering a migration
migrationManager.registerMigration({
  fromVersion: '1.0.0',
  toVersion: '1.1.0',
  migrate: (config) => {
    // Migration logic
    return {
      ...config,
      newProperty: 'defaultValue'
    };
  }
});
```

## Implementation Patterns

### Manager Implementation Pattern

All manager implementations follow a consistent pattern for configuration integration:

```typescript
export class DefaultExampleManager extends AbstractBaseManager implements ExampleManager {
  // Private configuration factory
  private configFactory = createConfigFactory(ExampleManagerConfigSchema);
  
  // Protected config with proper typing
  protected config: ExampleManagerConfig & Record<string, unknown>;
  
  constructor(agent: AgentBase, config: Partial<ExampleManagerConfig> = {}) {
    super(`example-manager-${uuidv4()}`, 'example', agent, { enabled: true });
    
    // Create and validate configuration
    this.config = this.configFactory.create({
      enabled: true,
      ...config
    }) as ExampleManagerConfig & Record<string, unknown>;
  }
  
  // Properly typed configuration update
  updateConfig<T extends ExampleManagerConfig>(config: Partial<T>): T {
    this.config = this.configFactory.create({
      ...this.config,
      ...config
    }) as ExampleManagerConfig & Record<string, unknown>;
    
    return this.config as unknown as T;
  }
}
```

### Cross-Property Validation

The system supports validation across multiple properties to ensure consistency:

```typescript
// Example cross-property validation
const validationResult = configFactory.validate(config, {
  crossValidations: [
    {
      properties: ['minValue', 'maxValue'],
      validate: (config) => (config.minValue ?? 0) <= (config.maxValue ?? 100),
      message: 'minValue must be less than or equal to maxValue'
    }
  ]
});
```

### Configuration Dependencies

Common dependencies are defined using a standard pattern:

```typescript
// Example configuration dependency
const dependency: ConfigDependency = {
  sourceManager: 'memory',
  sourceProperty: 'maxHistoryItems',
  targetManager: 'planning',
  targetProperty: 'contextWindowSize',
  required: false,
  transform: (value) => {
    // Transform the value as needed
    return Math.min(50, Math.floor(Number(value) / 2));
  }
};
```

## Usage Guidelines

### 1. Creating Manager Configurations

Always use the factory pattern and presets for creating manager configurations:

```typescript
// Recommended approach
const config = createMemoryManagerConfig('STANDARD', {
  maxHistoryItems: 200
});

// Alternative approach with direct factory
const config = configFactory.create({
  enabled: true,
  maxHistoryItems: 200
});
```

### 2. Updating Configurations

Use the manager's `updateConfig` method to ensure validation and proper type handling:

```typescript
// Update manager configuration
memoryManager.updateConfig({
  decayFactor: 0.8,
  maxHistoryItems: 150
});
```

### 3. Handling Configuration Errors

Always validate configurations and handle errors appropriately:

```typescript
try {
  const config = configFactory.create(userInput);
  // Use valid configuration
} catch (error) {
  if (error instanceof ConfigValidationError) {
    // Extract detailed validation errors
    for (const validationError of error.errors) {
      console.error(`${validationError.path}: ${validationError.message}`);
    }
  } else {
    console.error('Configuration error:', error);
  }
}
```

### 4. Manager Registration with Dependencies

Register managers with the agent and configure dependencies:

```typescript
// Configure agent with managers and dependencies
const agent = new AgentBase(/* options */);

// Register managers
agent.registerManager(new DefaultMemoryManager(agent, memoryConfig));
agent.registerManager(new DefaultPlanningManager(agent, planningConfig));

// Set up configuration orchestration
const orchestrator = new AgentConfigOrchestrator(agent, agentConfigSchema);
orchestrator.registerDependencies(CommonConfigDependencies);

// Initialize agent
await agent.initialize();

// Apply dependencies after initialization
orchestrator.applyDependencies();
```

## Configuration System Architecture

```
┌───────────────────────────────────┐
│          AgentBase                │
│                                   │
│  ┌───────────┐    ┌────────────┐  │
│  │ Manager 1 │    │ Manager 2  │  │
│  └───────────┘    └────────────┘  │
│        ▲               ▲          │
└────────┼───────────────┼──────────┘
         │               │
         │ config        │ config
         │               │
┌────────┼───────────────┼──────────┐
│  ┌─────┴─────┐   ┌─────┴──────┐   │
│  │ Schema 1  │   │ Schema 2   │   │
│  └───────────┘   └────────────┘   │
│                                   │
│  ┌───────────────────────────┐    │
│  │   ConfigOrchestrator      │    │
│  │                           │    │
│  │  ┌───────────────────┐    │    │
│  │  │ Dependencies      │    │    │
│  │  └───────────────────┘    │    │
│  └───────────────────────────┘    │
│                                   │
│  ┌───────────────────────────┐    │
│  │   MigrationManager        │    │
│  └───────────────────────────┘    │
│                                   │
│          Configuration System     │
└───────────────────────────────────┘
```

## Best Practices

1. **Schema-First Development**
   - Define schemas before implementing managers
   - Include validation rules, descriptions, and defaults
   - Document dependencies between properties

2. **Strong Typing**
   - Never use `any` in configuration types
   - Use proper interfaces for all config structures
   - Leverage TypeScript to catch configuration errors at compile time

3. **Separation of Concerns**
   - Keep schema definitions separate from implementation
   - Use factory pattern for configuration creation
   - Use orchestrator for dependency management

4. **Testing**
   - Test validation rules with edge cases
   - Verify preset behavior
   - Test cross-property validations and dependencies

5. **Documentation**
   - Document schema properties with clear descriptions
   - Provide examples for common use cases
   - Document dependencies between manager configurations

## Configuration System Evolution

The configuration system has evolved significantly during the agent refactoring project:

1. **Initial Design (Phase 1-2)**
   - Basic schema validation
   - Simple factory pattern
   - Loose typing

2. **Enhanced System (Phase 3-4)**
   - Strong typing
   - Defaulting and validation
   - Preset support
   - Update strategies

3. **Current System (Phase 5)**
   - Cross-property validation
   - Dependency orchestration
   - Configuration versioning and migration
   - Type-safe update patterns

4. **Future Directions**
   - UI-driven configuration
   - Runtime schema reflection
   - Advanced dependency resolution algorithms
   - Dynamic configuration adaptation

## Conclusion

The Configuration System provides a solid foundation for agent configuration management. By following the patterns and guidelines outlined in this document, developers can create robust, type-safe configurations that ensure consistency across the entire agent architecture. 