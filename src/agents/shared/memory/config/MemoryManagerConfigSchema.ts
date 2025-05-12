/**
 * Memory Manager Configuration Schema
 * 
 * This module defines the configuration schema for memory managers,
 * including validation rules and default values.
 */

import { ConfigSchema } from '../../../../lib/config/types';
import { MemoryManagerConfig } from '../../base/managers/MemoryManager';

/**
 * Schema for memory manager configuration
 */
export const MemoryManagerConfigSchema: ConfigSchema<MemoryManagerConfig> = {
  enabled: {
    type: 'boolean',
    required: true,
    default: true,
    description: 'Whether the memory manager is enabled'
  },
  enableAutoPruning: {
    type: 'boolean',
    default: true,
    description: 'Whether automatic memory pruning is enabled'
  },
  pruningIntervalMs: {
    type: 'number',
    min: 1000,            // Minimum 1 second
    max: 86400000,        // Maximum 24 hours
    default: 300000,      // Default 5 minutes
    description: 'Interval in milliseconds between automatic memory pruning operations'
  },
  maxShortTermEntries: {
    type: 'number',
    min: 1,
    max: 1000,
    default: 100,
    description: 'Maximum number of short-term memory entries to keep'
  },
  relevanceThreshold: {
    type: 'number',
    min: 0,
    max: 1,
    default: 0.2,
    description: 'Minimum relevance score for memories to be considered in search results'
  },
  enableAutoConsolidation: {
    type: 'boolean',
    default: true,
    description: 'Whether automatic memory consolidation is enabled'
  },
  consolidationIntervalMs: {
    type: 'number',
    min: 1000,            // Minimum 1 second
    max: 86400000,        // Maximum 24 hours
    default: 600000,      // Default 10 minutes
    description: 'Interval in milliseconds between automatic memory consolidation operations'
  },
  minMemoriesForConsolidation: {
    type: 'number',
    min: 1,
    max: 100,
    default: 5,
    description: 'Minimum number of memories needed to trigger consolidation'
  },
  forgetSourceMemoriesAfterConsolidation: {
    type: 'boolean',
    default: false,
    description: 'Whether to forget source memories after consolidation'
  },
  enableMemoryInjection: {
    type: 'boolean',
    default: true,
    description: 'Whether memory injection is enabled'
  },
  maxInjectedMemories: {
    type: 'number',
    min: 1,
    max: 100,
    default: 5,
    description: 'Maximum number of memories to inject into context'
  }
};

/**
 * Memory manager configuration presets for different agent roles
 */
export const MemoryManagerPresets = {
  // Preset for assistants that need to remember a lot of details
  DETAIL_ORIENTED: {
    maxShortTermEntries: 200,
    relevanceThreshold: 0.15,
    enableAutoConsolidation: true,
    minMemoriesForConsolidation: 3,
    maxInjectedMemories: 8
  },
  
  // Preset for agents that need to focus on recent information
  RECENCY_FOCUSED: {
    maxShortTermEntries: 50,
    relevanceThreshold: 0.3,
    enableAutoConsolidation: true,
    pruningIntervalMs: 180000, // 3 minutes
    maxInjectedMemories: 3
  },
  
  // Preset for minimalist agents with minimal memory usage
  MINIMAL: {
    maxShortTermEntries: 20,
    relevanceThreshold: 0.4,
    enableAutoConsolidation: false,
    enableAutoPruning: true,
    pruningIntervalMs: 120000, // 2 minutes
    maxInjectedMemories: 2
  },
  
  // Preset for comprehensive memory agents that remember almost everything
  COMPREHENSIVE: {
    maxShortTermEntries: 500,
    relevanceThreshold: 0.1,
    enableAutoConsolidation: true,
    consolidationIntervalMs: 300000, // 5 minutes
    minMemoriesForConsolidation: 2,
    maxInjectedMemories: 10
  }
};

/**
 * Factory function to create a memory manager configuration with a preset
 * @param preset Preset name or configuration object
 * @param overrides Configuration overrides
 * @returns The merged configuration
 */
export function createMemoryManagerConfig(
  preset: keyof typeof MemoryManagerPresets | Partial<MemoryManagerConfig> = 'DETAIL_ORIENTED',
  overrides: Partial<MemoryManagerConfig> = {}
): MemoryManagerConfig {
  // Get the preset configuration
  const presetConfig = typeof preset === 'string'
    ? MemoryManagerPresets[preset]
    : preset;
  
  // Merge with base defaults and overrides
  return {
    enabled: true,
    enableAutoPruning: true,
    pruningIntervalMs: 300000, // 5 minutes
    maxShortTermEntries: 100,
    relevanceThreshold: 0.2,
    enableAutoConsolidation: true,
    consolidationIntervalMs: 600000, // 10 minutes
    minMemoriesForConsolidation: 5,
    forgetSourceMemoriesAfterConsolidation: false,
    enableMemoryInjection: true,
    maxInjectedMemories: 5,
    ...presetConfig,
    ...overrides
  } as MemoryManagerConfig;
}