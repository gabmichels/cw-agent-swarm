/**
 * Tool Manager Configuration Schema
 * 
 * This module defines the configuration schema for tool managers,
 * including validation rules and default values.
 */

import { ConfigSchema } from '../../../../lib/config/types';
import { ToolManagerConfig } from '../../../../lib/agents/base/managers/ToolManager';

/**
 * Schema for tool manager configuration
 */
export const ToolManagerConfigSchema: ConfigSchema<ToolManagerConfig & Record<string, unknown>> = {
  enabled: {
    type: 'boolean',
    required: true,
    default: true,
    description: 'Whether the tool manager is enabled'
  },
  trackToolPerformance: {
    type: 'boolean',
    default: true,
    description: 'Whether to track tool performance metrics'
  },
  defaultToolTimeoutMs: {
    type: 'number',
    min: 1000,             // Minimum 1 second
    max: 300000,           // Maximum 5 minutes
    default: 30000,        // Default 30 seconds
    description: 'Default tool execution timeout in milliseconds'
  },
  useAdaptiveToolSelection: {
    type: 'boolean',
    default: false,
    description: 'Whether to use adaptive tool selection'
  },
  maxToolRetries: {
    type: 'number',
    min: 0,
    max: 5,
    default: 1,
    description: 'Maximum number of retries for tool execution'
  }
};

/**
 * Tool manager configuration presets for different agent roles
 */
export const ToolManagerPresets = {
  // Preset for agents that need reliability and performance tracking
  RELIABILITY_FOCUSED: {
    trackToolPerformance: true,
    defaultToolTimeoutMs: 60000,   // 1 minute
    useAdaptiveToolSelection: true,
    maxToolRetries: 3
  },
  
  // Preset for agents that need fast tool execution
  PERFORMANCE_FOCUSED: {
    trackToolPerformance: true,
    defaultToolTimeoutMs: 15000,   // 15 seconds
    useAdaptiveToolSelection: true,
    maxToolRetries: 1
  },
  
  // Preset for minimal tool usage
  MINIMAL: {
    trackToolPerformance: false,
    defaultToolTimeoutMs: 20000,   // 20 seconds
    useAdaptiveToolSelection: false,
    maxToolRetries: 0
  },
  
  // Preset for experimental features
  EXPERIMENTAL: {
    trackToolPerformance: true,
    defaultToolTimeoutMs: 45000,   // 45 seconds
    useAdaptiveToolSelection: true,
    maxToolRetries: 2
  }
};

// Type for preset keys
type ToolManagerPresetKey = keyof typeof ToolManagerPresets;

/**
 * Factory function to create a tool manager configuration with a preset
 * @param preset Preset name or configuration object
 * @param overrides Configuration overrides
 * @returns The merged configuration
 */
export function createToolManagerConfig(
  preset: ToolManagerPresetKey | Partial<ToolManagerConfig> = 'RELIABILITY_FOCUSED',
  overrides: Partial<ToolManagerConfig> = {}
): ToolManagerConfig {
  // Get the preset configuration
  const presetConfig = typeof preset === 'string'
    ? ToolManagerPresets[preset as ToolManagerPresetKey]
    : preset;
  
  // Merge with base defaults and overrides
  return {
    enabled: true,
    trackToolPerformance: true,
    defaultToolTimeoutMs: 30000, // 30 seconds
    useAdaptiveToolSelection: false,
    maxToolRetries: 1,
    ...presetConfig,
    ...overrides
  } as ToolManagerConfig;
} 