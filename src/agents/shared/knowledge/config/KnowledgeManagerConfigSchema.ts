/**
 * Knowledge Manager Configuration Schema
 * 
 * This module defines the configuration schema for knowledge managers,
 * including validation rules and default values.
 */

import { ConfigSchema } from '../../../../lib/config/types';
import { KnowledgeManagerConfig } from '../../../../lib/agents/base/managers/KnowledgeManager';

/**
 * Schema for knowledge manager configuration
 */
export const KnowledgeManagerConfigSchema: ConfigSchema<KnowledgeManagerConfig> = {
  enabled: {
    type: 'boolean',
    required: true,
    default: true,
    description: 'Whether the knowledge manager is enabled'
  },
  knowledgePaths: {
    type: 'array',
    items: {
      type: 'string'
    },
    default: [],
    description: 'Knowledge directories to load from'
  },
  department: {
    type: 'string',
    default: 'general',
    description: 'Department for domain-specific knowledge'
  },
  enableKnowledgeGraph: {
    type: 'boolean',
    default: true,
    description: 'Whether to enable knowledge graph construction'
  },
  enableAutoRefresh: {
    type: 'boolean',
    default: false,
    description: 'Whether to automatically refresh knowledge'
  },
  refreshIntervalMs: {
    type: 'number',
    min: 5000,             // Minimum 5 seconds
    max: 86400000,         // Maximum 24 hours
    default: 3600000,      // Default 1 hour
    description: 'Refresh interval in milliseconds'
  },
  maxKnowledgeEntries: {
    type: 'number',
    min: 1,
    max: 10000,
    default: 1000,
    description: 'Maximum knowledge entries to keep in memory'
  },
  enableGapIdentification: {
    type: 'boolean',
    default: true,
    description: 'Whether to enable knowledge gap identification'
  },
  allowRuntimeUpdates: {
    type: 'boolean',
    default: true,
    description: 'Whether to allow runtime knowledge updates'
  }
};

/**
 * Knowledge manager configuration presets for different agent roles
 */
export const KnowledgeManagerPresets = {
  // Preset for comprehensive knowledge management
  COMPREHENSIVE: {
    enableKnowledgeGraph: true,
    enableAutoRefresh: true,
    refreshIntervalMs: 1800000,   // 30 minutes
    maxKnowledgeEntries: 5000,
    enableGapIdentification: true,
    allowRuntimeUpdates: true
  },
  
  // Preset for minimal knowledge requirements
  MINIMAL: {
    enableKnowledgeGraph: false,
    enableAutoRefresh: false,
    maxKnowledgeEntries: 100,
    enableGapIdentification: false,
    allowRuntimeUpdates: true
  },
  
  // Preset for research-oriented agents
  RESEARCH_FOCUSED: {
    enableKnowledgeGraph: true,
    enableAutoRefresh: true,
    refreshIntervalMs: 1200000,   // 20 minutes
    maxKnowledgeEntries: 3000,
    enableGapIdentification: true,
    allowRuntimeUpdates: true
  },
  
  // Preset for static knowledge bases
  STATIC_KNOWLEDGE: {
    enableKnowledgeGraph: true,
    enableAutoRefresh: false,
    maxKnowledgeEntries: 2000,
    enableGapIdentification: false,
    allowRuntimeUpdates: false
  }
};

// Type for preset keys
type KnowledgeManagerPresetKey = keyof typeof KnowledgeManagerPresets;

/**
 * Factory function to create a knowledge manager configuration with a preset
 * @param preset Preset name or configuration object
 * @param overrides Configuration overrides
 * @returns The merged configuration
 */
export function createKnowledgeManagerConfig(
  preset: KnowledgeManagerPresetKey | Partial<KnowledgeManagerConfig> = 'COMPREHENSIVE',
  overrides: Partial<KnowledgeManagerConfig> = {}
): KnowledgeManagerConfig {
  // Get the preset configuration
  const presetConfig = typeof preset === 'string'
    ? KnowledgeManagerPresets[preset as KnowledgeManagerPresetKey]
    : preset;
  
  // Merge with base defaults and overrides
  const baseConfig: KnowledgeManagerConfig = {
    enabled: true,
    knowledgePaths: [],
    department: 'general',
    refreshIntervalMs: 3600000, // 1 hour
    maxKnowledgeEntries: 1000,
    allowRuntimeUpdates: true
  };

  return {
    ...baseConfig,
    ...presetConfig,
    ...overrides
  } as KnowledgeManagerConfig;
} 