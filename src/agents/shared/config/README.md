# Agent Configuration System

The Agent Configuration System provides a robust, type-safe approach to managing configuration for agent managers and components. This system enables runtime validation, intelligent defaults, configuration presets, and more.

## Architecture

The configuration system consists of several key components:

1. **Configuration Schemas** - Type-safe definitions of configuration properties, their types, validation rules, and default values.
2. **Configuration Factory** - Creates validated configurations based on schemas.
3. **Configuration Validators** - Ensures configuration values meet defined constraints.
4. **Default Providers** - Supplies default values for missing configuration.
5. **Preset Providers** - Provides preset configurations for common use cases.

## Features

- **Type Safety**: All configurations are strictly typed with no use of `any`.
- **Validation**: Runtime validation of configuration values with helpful error messages.
- **Inheritance**: Support for configuration inheritance and overrides.
- **Defaulting**: Intelligent defaulting for missing configuration values.
- **Presets**: Pre-defined configurations for common agent roles and capabilities.
- **Extensibility**: Easy extension for new configuration properties.

## Usage Examples

### Creating Configuration with Presets

```typescript
import { createMemoryManagerConfig } from '../config';

// Create memory manager configuration with preset
const memoryConfig = createMemoryManagerConfig('COMPREHENSIVE', {
  maxShortTermEntries: 300,  // Override preset value
  relevanceThreshold: 0.3    // Override preset value
});
```

### Validating Configuration

```typescript
import { createConfigFactory } from '../config';
import type { MemoryManagerConfig } from '../../lib/agents/base/managers/MemoryManager';

// Create configuration factory with schema
const configFactory = createConfigFactory<MemoryManagerConfig & Record<string, unknown>>({
  enabled: {
    type: 'boolean',
    required: true,
    default: true
  },
  maxShortTermEntries: {
    type: 'number',
    min: 1,
    max: 1000,
    default: 100
  }
});

// Validate configuration
const result = configFactory.validate({
  enabled: true,
  maxShortTermEntries: 50
});

// Check validation result
if (result.valid) {
  console.log('Configuration is valid:', result.config);
} else {
  console.error('Validation errors:', result.errors);
}
```

### Creating and Updating Configuration

```typescript
// Create initial configuration
const config = configFactory.create({
  enabled: true,
  maxShortTermEntries: 50
});

// Update configuration
const updatedConfig = configFactory.update(
  config,
  { maxShortTermEntries: 100 }
);
```

## Available Presets

### Memory Manager Presets

- **DETAIL_ORIENTED**: For assistants that need to remember many details.
- **RECENCY_FOCUSED**: For agents that prioritize recent information.
- **MINIMAL**: For minimalist agents with minimal memory usage.
- **COMPREHENSIVE**: For agents that need to remember almost everything.

### Planning Manager Presets

- **THOROUGH_PLANNER**: For very deliberate and thorough planning.
- **ADAPTIVE_PLANNER**: For quick and adaptive planning.
- **MINIMAL_PLANNER**: For minimal planning requirements.
- **REALTIME_PLANNER**: For real-time planning capabilities.

### Tool Manager Presets

- **RELIABILITY_FOCUSED**: For high reliability with performance tracking.
- **PERFORMANCE_FOCUSED**: For fast tool execution.
- **MINIMAL**: For minimal tool usage.
- **EXPERIMENTAL**: For testing experimental features.

### Knowledge Manager Presets

- **COMPREHENSIVE**: For comprehensive knowledge management.
- **MINIMAL**: For minimal knowledge requirements.
- **RESEARCH_FOCUSED**: For research-oriented agents.
- **STATIC_KNOWLEDGE**: For static knowledge bases.

## Extending the System

To add a new configuration schema for a component:

1. Define a configuration interface extending `ManagerConfig`
2. Create a schema using `ConfigSchema<YourConfigType>`
3. Implement presets for common use cases
4. Create a factory function that leverages the schema and presets

Example:

```typescript
// 1. Define interface
export interface MyComponentConfig extends ManagerConfig {
  enabled: boolean;
  refreshIntervalMs?: number;
  // Other properties...
}

// 2. Create schema
export const MyComponentConfigSchema: ConfigSchema<MyComponentConfig> = {
  enabled: {
    type: 'boolean',
    required: true,
    default: true,
    description: 'Whether the component is enabled'
  },
  refreshIntervalMs: {
    type: 'number',
    min: 1000,
    max: 86400000,
    default: 60000,
    description: 'Refresh interval in milliseconds'
  }
  // Other properties...
};

// 3. Define presets
export const MyComponentPresets = {
  PRESET_A: { /* ... */ },
  PRESET_B: { /* ... */ }
};

// 4. Create factory function
export function createMyComponentConfig(
  preset: keyof typeof MyComponentPresets | Partial<MyComponentConfig>,
  overrides: Partial<MyComponentConfig> = {}
): MyComponentConfig {
  // Implementation...
}
``` 