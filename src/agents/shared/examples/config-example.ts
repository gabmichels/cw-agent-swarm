/**
 * Configuration System Example
 * 
 * This file demonstrates how to use the agent configuration system to create,
 * validate, and manage configurations for different manager types.
 */

// Import configuration utilities and schemas
import {
  createMemoryManagerConfig,
  createPlanningManagerConfig,
  createToolManagerConfig,
  createKnowledgeManagerConfig,
  createConfigFactory,
  validateConfig
} from '../config';

import { UpdateStrategy } from '../../../lib/config/types';

// Import configuration types
import type { 
  MemoryManagerConfig 
} from '../../../lib/agents/base/managers/MemoryManager';
import type { 
  PlanningManagerConfig 
} from '../../../lib/agents/base/managers/PlanningManager';
import type { 
  ToolManagerConfig 
} from '../../../lib/agents/base/managers/ToolManager';
import type { 
  KnowledgeManagerConfig 
} from '../../../lib/agents/base/managers/KnowledgeManager';

/**
 * Example function to demonstrate configuration creation with presets
 */
function configurationExample(): void {
  console.log('=== Configuration System Example ===\n');

  // Create memory manager configuration with presets
  const memoryConfig = createMemoryManagerConfig('COMPREHENSIVE', {
    maxShortTermEntries: 300,  // Override specific property
    relevanceThreshold: 0.3    // Override specific property
  });
  
  console.log('Memory Manager Configuration (COMPREHENSIVE preset with overrides):');
  console.log(memoryConfig);
  console.log();
  
  // Create planning manager configuration using preset
  const planningConfig = createPlanningManagerConfig('ADAPTIVE_PLANNER');
  
  console.log('Planning Manager Configuration (ADAPTIVE_PLANNER preset):');
  console.log(planningConfig);
  console.log();
  
  // Create tool manager configuration with direct object
  const toolConfig = createToolManagerConfig({
    trackToolPerformance: true,
    defaultToolTimeoutMs: 20000,
    maxToolRetries: 2
  });
  
  console.log('Tool Manager Configuration (Custom overrides):');
  console.log(toolConfig);
  console.log();
  
  // Create knowledge manager configuration with minimal preset
  const knowledgeConfig = createKnowledgeManagerConfig('MINIMAL', {
    department: 'engineering'  // Override specific property
  });
  
  console.log('Knowledge Manager Configuration (MINIMAL preset with overrides):');
  console.log(knowledgeConfig);
  console.log();
}

/**
 * Example function to demonstrate configuration validation
 */
function validationExample(): void {
  console.log('=== Configuration Validation Example ===\n');
  
  // Valid configuration
  const validConfig: Partial<MemoryManagerConfig> = {
    enabled: true,
    maxShortTermEntries: 100,
    relevanceThreshold: 0.5
  };
  
  // Invalid configuration (violates constraints)
  const invalidConfig: Partial<MemoryManagerConfig> = {
    enabled: true,
    maxShortTermEntries: -5,         // Invalid: below minimum of 1
    relevanceThreshold: 1.5          // Invalid: above maximum of 1
  };
  
  // Create configuration factory for memory manager
  const memoryConfigFactory = createConfigFactory<MemoryManagerConfig & Record<string, unknown>>({
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
    },
    relevanceThreshold: {
      type: 'number',
      min: 0,
      max: 1,
      default: 0.2
    }
  });
  
  // Validate the valid configuration
  try {
    const result = memoryConfigFactory.validate(validConfig);
    console.log('Valid configuration validation result:');
    console.log(result);
    console.log();
  } catch (error) {
    console.error('Validation error:', error);
  }
  
  // Validate the invalid configuration
  try {
    const result = memoryConfigFactory.validate(invalidConfig);
    console.log('Invalid configuration validation result:');
    console.log(result);
    console.log();
  } catch (error) {
    console.error('Validation error:', error);
  }
  
  // Create a configuration with validation and defaults
  try {
    const config = memoryConfigFactory.create(validConfig);
    console.log('Created configuration with defaults:');
    console.log(config);
    console.log();
  } catch (error) {
    console.error('Creation error:', error);
  }
}

/**
 * Example function to demonstrate configuration updates
 */
function updateExample(): void {
  console.log('=== Configuration Update Example ===\n');
  
  // Create initial configuration
  const toolConfigFactory = createConfigFactory<ToolManagerConfig & Record<string, unknown>>({
    enabled: {
      type: 'boolean',
      required: true,
      default: true
    },
    trackToolPerformance: {
      type: 'boolean',
      default: false
    },
    defaultToolTimeoutMs: {
      type: 'number',
      min: 1000,
      max: 60000,
      default: 30000
    },
    maxToolRetries: {
      type: 'number',
      min: 0,
      max: 5,
      default: 1
    }
  });
  
  // Create initial configuration
  const initialConfig = toolConfigFactory.create({
    enabled: true,
    trackToolPerformance: false,
    defaultToolTimeoutMs: 15000
  });
  
  console.log('Initial configuration:');
  console.log(initialConfig);
  console.log();
  
  // Update with MERGE strategy (default)
  const mergeUpdated = toolConfigFactory.update(
    initialConfig,
    { trackToolPerformance: true }
  );
  
  console.log('Updated with MERGE strategy:');
  console.log(mergeUpdated);
  console.log();
  
  // Update with REPLACE strategy
  const replaceUpdated = toolConfigFactory.update(
    initialConfig,
    { trackToolPerformance: true },
    UpdateStrategy.REPLACE
  );
  
  console.log('Updated with REPLACE strategy:');
  console.log(replaceUpdated);
  console.log();
  
  // Update with DEEP_MERGE strategy (more important for nested objects)
  const deepMergeUpdated = toolConfigFactory.update(
    initialConfig,
    { 
      trackToolPerformance: true,
      defaultToolTimeoutMs: 20000
    },
    UpdateStrategy.DEEP_MERGE
  );
  
  console.log('Updated with DEEP_MERGE strategy:');
  console.log(deepMergeUpdated);
  console.log();
}

/**
 * Run all examples
 */
export function runConfigurationExamples(): void {
  configurationExample();
  validationExample();
  updateExample();
} 