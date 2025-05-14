/**
 * Configuration System Tests
 * 
 * This file contains tests for the configuration system, including
 * validation, configuration creation, and preset handling.
 */

import { describe, it, expect } from 'vitest';
import { 
  createMemoryManagerConfig,
  createPlanningManagerConfig,
  createToolManagerConfig,
  createKnowledgeManagerConfig,
  createSchedulerManagerConfig,
  createConfigFactory,
  validateConfig,
  ConfigSchema
} from '../../config';

import { UpdateStrategy } from '../../../../lib/config/types';
import { ConfigValidationError } from '../../../../lib/config/errors';

// Memory Manager Config Tests
describe('Memory Manager Configuration', () => {
  it('should create valid config with default preset', () => {
    const config = createMemoryManagerConfig();
    expect(config).toBeDefined();
    expect(config.enabled).toBe(true);
  });

  it('should create valid config with MINIMAL preset', () => {
    const config = createMemoryManagerConfig('MINIMAL');
    expect(config).toBeDefined();
    expect(config.maxShortTermEntries).toBe(20);
    expect(config.relevanceThreshold).toBe(0.4);
  });

  it('should override preset values with custom values', () => {
    const config = createMemoryManagerConfig('MINIMAL', {
      maxShortTermEntries: 50
    });
    expect(config).toBeDefined();
    expect(config.maxShortTermEntries).toBe(50);
    expect(config.relevanceThreshold).toBe(0.4); // From preset
  });
});

// Planning Manager Config Tests
describe('Planning Manager Configuration', () => {
  it('should create valid config with default preset', () => {
    const config = createPlanningManagerConfig();
    expect(config).toBeDefined();
    expect(config.enabled).toBe(true);
  });

  it('should create valid config with MINIMAL_PLANNER preset', () => {
    const config = createPlanningManagerConfig('MINIMAL_PLANNER');
    expect(config).toBeDefined();
    expect(config.enableAutoPlanning).toBe(false);
    expect(config.enablePlanAdaptation).toBe(false);
  });
});

// Tool Manager Config Tests
describe('Tool Manager Configuration', () => {
  it('should create valid config with default preset', () => {
    const config = createToolManagerConfig();
    expect(config).toBeDefined();
    expect(config.enabled).toBe(true);
  });

  it('should create valid config with MINIMAL preset', () => {
    const config = createToolManagerConfig('MINIMAL');
    expect(config).toBeDefined();
    expect(config.trackToolPerformance).toBe(false);
    expect(config.maxToolRetries).toBe(0);
  });
});

// Scheduler Manager Config Tests
describe('Scheduler Manager Configuration', () => {
  it('should create valid config with default preset', () => {
    const config = createSchedulerManagerConfig();
    expect(config).toBeDefined();
    expect(config.enabled).toBe(true);
  });

  it('should create valid config with RESOURCE_CONSTRAINED preset', () => {
    const config = createSchedulerManagerConfig('RESOURCE_CONSTRAINED');
    expect(config).toBeDefined();
    expect(config.maxConcurrentTasks).toBe(3);
    expect(config.schedulingAlgorithm).toBe('resource-aware');
  });
});

// Config Factory Tests
describe('Config Factory', () => {
  interface TestConfig {
    enabled: boolean;
    name: string;
    count: number;
  }

  const testSchema: ConfigSchema<TestConfig & Record<string, unknown>> = {
    enabled: {
      type: 'boolean',
      required: true,
      default: true
    },
    name: {
      type: 'string',
      required: true,
      pattern: /^[a-zA-Z0-9-_]+$/
    },
    count: {
      type: 'number',
      min: 1,
      max: 100,
      default: 10
    }
  };

  const factory = createConfigFactory(testSchema);

  it('should create valid config with defaults', () => {
    const config = factory.create({
      name: 'test-config'
    });
    
    expect(config).toBeDefined();
    expect(config.enabled).toBe(true); // default
    expect(config.name).toBe('test-config');
    expect(config.count).toBe(10); // default
  });

  it('should throw on validation errors', () => {
    expect(() => {
      factory.create({
        name: 'invalid name with spaces'
      });
    }).toThrow();
  });

  it('should validate config correctly', () => {
    const validResult = factory.validate({
      name: 'valid-name',
      count: 50
    });
    
    expect(validResult.valid).toBe(true);
    
    const invalidResult = factory.validate({
      name: 'invalid name with spaces',
      count: 200 // Greater than max
    });
    
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors).toBeDefined();
    expect(invalidResult.errors?.length).toBeGreaterThan(0);
  });

  it('should update config correctly', () => {
    const original = factory.create({
      name: 'original-config'
    });
    
    const updated = factory.update(original, {
      count: 20
    });
    
    expect(updated.name).toBe('original-config');
    expect(updated.count).toBe(20);
  });

  it('should handle different update strategies', () => {
    const original = factory.create({
      name: 'original-config',
      count: 5
    });
    
    // REPLACE strategy should use defaults for unspecified fields
    const replaced = factory.update(
      original,
      { name: 'replaced-config' },
      UpdateStrategy.REPLACE
    );
    
    expect(replaced.name).toBe('replaced-config');
    expect(replaced.count).toBe(10); // Back to default
    
    // MERGE strategy preserves values
    const merged = factory.update(
      original,
      { name: 'merged-config' }
    );
    
    expect(merged.name).toBe('merged-config');
    expect(merged.count).toBe(5); // Preserved
  });
}); 