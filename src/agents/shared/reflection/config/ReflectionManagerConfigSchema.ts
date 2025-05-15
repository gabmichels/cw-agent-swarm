/**
 * Reflection Manager Configuration Schema
 * 
 * This module defines the configuration schema for reflection managers,
 * including validation rules and default values.
 */

import { ConfigSchema } from '../../../../lib/config/types';
import { ReflectionManagerConfig } from '../../../../lib/agents/base/managers/ReflectionManager';
import { ImprovementAreaType } from '../interfaces/SelfImprovement.interface';

type ReflectionDepth = 'light' | 'standard' | 'deep';

/**
 * Schema for reflection manager configuration
 */
export const ReflectionManagerConfigSchema: ConfigSchema<ReflectionManagerConfig> = {
  enabled: {
    type: 'boolean',
    required: true,
    default: true,
    description: 'Whether this manager is enabled'
  },
  
  reflectionFrequency: {
    type: 'object',
    required: true,
    properties: {
      interval: {
        type: 'number',
        required: true,
        default: 3600000, // 1 hour
        description: 'How often to perform reflections (in ms)'
      },
      afterEachInteraction: {
        type: 'boolean',
        required: true,
        default: false,
        description: 'Whether to reflect after each interaction'
      },
      afterErrors: {
        type: 'boolean',
        required: true,
        default: true,
        description: 'Whether to reflect after errors'
      },
      minIntervalMs: {
        type: 'number',
        required: true,
        default: 60000, // 1 minute
        description: 'Minimum time between reflections (in ms)'
      }
    },
    description: 'Settings for reflection frequency'
  },
  
  reflectionDepth: {
    type: 'enum',
    enum: ['light', 'standard', 'deep'] as ReflectionDepth[],
    required: true,
    default: 'standard' as ReflectionDepth,
    description: 'Depth/thoroughness level for reflections'
  },
  
  maxHistoryItems: {
    type: 'number',
    required: true,
    default: 100,
    description: 'Maximum reflection history items to maintain'
  },
  
  adaptiveBehavior: {
    type: 'boolean',
    required: true,
    default: true,
    description: 'Whether to adapt behavior based on reflections'
  },
  
  adaptationRate: {
    type: 'number',
    required: true,
    default: 0.3,
    min: 0,
    max: 1,
    description: 'How aggressively to change behavior based on reflections (0-1)'
  },
  
  metricsToTrack: {
    type: 'array',
    required: true,
    items: {
      type: 'string'
    },
    default: ['success', 'efficiency', 'satisfaction', 'errors'],
    description: 'Metrics to track for reflection'
  },
  
  improvementGoals: {
    type: 'array',
    required: true,
    items: {
      type: 'string'
    },
    default: [],
    description: 'Self-improvement goals'
  },
  
  persistReflections: {
    type: 'boolean',
    required: true,
    default: true,
    description: 'Whether to persist reflections across sessions'
  },
  
  enablePeriodicReflections: {
    type: 'boolean',
    required: true,
    default: false,
    description: 'Whether to enable periodic reflections'
  },
  
  periodicReflectionSchedule: {
    type: 'string',
    required: false,
    default: '0 0 * * *', // Daily at midnight
    description: 'Default periodic reflection schedule (cron expression or interval)'
  },
  
  enableSelfImprovement: {
    type: 'boolean',
    required: true,
    default: false,
    description: 'Whether to enable self-improvement capabilities'
  },
  
  defaultImprovementAreas: {
    type: 'array',
    required: false,
    items: {
      type: 'enum',
      enum: [
        ImprovementAreaType.KNOWLEDGE,
        ImprovementAreaType.SKILL,
        ImprovementAreaType.STRATEGY,
        ImprovementAreaType.BEHAVIOR,
        ImprovementAreaType.TOOL,
        ImprovementAreaType.PROCESS
      ]
    },
    default: [ImprovementAreaType.KNOWLEDGE, ImprovementAreaType.SKILL, ImprovementAreaType.BEHAVIOR],
    description: 'Default improvement areas to focus on'
  }
};

/**
 * Reflection manager configuration presets for different agent roles
 */
export const ReflectionManagerPresets: Record<string, Partial<ReflectionManagerConfig>> = {
  // Preset for agents focused on deep learning and improvement
  DEEP_LEARNER: {
    reflectionFrequency: {
      interval: 1800000,       // 30 minutes
      afterEachInteraction: false,
      afterErrors: true,
      minIntervalMs: 60000     // 1 minute
    },
    reflectionDepth: 'deep' as ReflectionDepth,
    maxHistoryItems: 500,
    adaptiveBehavior: true,
    adaptationRate: 0.4,
    metricsToTrack: ['success', 'efficiency', 'satisfaction', 'errors', 'custom'],
    persistReflections: true,
    enablePeriodicReflections: true,
    periodicReflectionSchedule: '0 */4 * * *', // Every 4 hours
    enableSelfImprovement: true,
    defaultImprovementAreas: [
      ImprovementAreaType.KNOWLEDGE,
      ImprovementAreaType.SKILL,
      ImprovementAreaType.STRATEGY,
      ImprovementAreaType.TOOL
    ]
  },
  
  // Preset for agents that need to be responsive
  RESPONSIVE: {
    reflectionFrequency: {
      interval: 7200000,       // 2 hours
      afterEachInteraction: false,
      afterErrors: true,
      minIntervalMs: 300000    // 5 minutes
    },
    reflectionDepth: 'light' as ReflectionDepth,
    maxHistoryItems: 50,
    adaptiveBehavior: true,
    adaptationRate: 0.2,
    metricsToTrack: ['success', 'satisfaction', 'errors'],
    persistReflections: true,
    enablePeriodicReflections: true,
    periodicReflectionSchedule: '0 0 * * *', // Once a day at midnight
    enableSelfImprovement: true,
    defaultImprovementAreas: [
      ImprovementAreaType.BEHAVIOR,
      ImprovementAreaType.STRATEGY
    ]
  },
  
  // Preset for agents with minimal self-reflection
  MINIMAL: {
    reflectionFrequency: {
      interval: 86400000,      // 24 hours
      afterEachInteraction: false,
      afterErrors: true,
      minIntervalMs: 3600000   // 1 hour
    },
    reflectionDepth: 'light',
    maxHistoryItems: 20,
    adaptiveBehavior: false,
    adaptationRate: 0.1,
    metricsToTrack: ['errors'],
    persistReflections: false,
    enablePeriodicReflections: false,
    enableSelfImprovement: false,
    defaultImprovementAreas: []
  },
  
  // Preset for error-focused learning
  ERROR_FOCUSED: {
    reflectionFrequency: {
      interval: 3600000,       // 1 hour
      afterEachInteraction: false,
      afterErrors: true,
      minIntervalMs: 30000     // 30 seconds
    },
    reflectionDepth: 'standard',
    maxHistoryItems: 200,
    adaptiveBehavior: true,
    adaptationRate: 0.5,
    metricsToTrack: ['errors', 'efficiency'],
    persistReflections: true,
    enablePeriodicReflections: true,
    periodicReflectionSchedule: '0 */12 * * *', // Twice a day
    enableSelfImprovement: true,
    defaultImprovementAreas: [
      ImprovementAreaType.PROCESS,
      ImprovementAreaType.STRATEGY
    ]
  },
  
  // New preset for continuous improvement agents
  CONTINUOUS_IMPROVER: {
    reflectionFrequency: {
      interval: 3600000,       // 1 hour
      afterEachInteraction: true,
      afterErrors: true,
      minIntervalMs: 60000     // 1 minute
    },
    reflectionDepth: 'deep',
    maxHistoryItems: 300,
    adaptiveBehavior: true,
    adaptationRate: 0.6,
    metricsToTrack: ['success', 'efficiency', 'satisfaction', 'errors', 'custom'],
    persistReflections: true,
    enablePeriodicReflections: true,
    periodicReflectionSchedule: '0 */2 * * *', // Every 2 hours
    enableSelfImprovement: true,
    defaultImprovementAreas: [
      ImprovementAreaType.KNOWLEDGE,
      ImprovementAreaType.SKILL,
      ImprovementAreaType.STRATEGY,
      ImprovementAreaType.BEHAVIOR,
      ImprovementAreaType.TOOL,
      ImprovementAreaType.PROCESS
    ]
  }
};

/**
 * Type for preset keys
 */
type ReflectionManagerPresetKey = keyof typeof ReflectionManagerPresets;

/**
 * Factory function to create a reflection manager configuration
 * @param preset Preset name or configuration object
 * @param overrides Configuration overrides
 * @returns The merged configuration
 */
export function createReflectionManagerConfig(
  preset: ReflectionManagerPresetKey | Partial<ReflectionManagerConfig> = 'DEEP_LEARNER',
  overrides: Partial<ReflectionManagerConfig> = {}
): ReflectionManagerConfig {
  // Get the preset configuration
  const presetConfig = typeof preset === 'string'
    ? ReflectionManagerPresets[preset]
    : preset;
  
  // Merge with base defaults and overrides
  const baseConfig: ReflectionManagerConfig = {
    enabled: true,
    reflectionFrequency: {
      interval: 3600000, // 1 hour
      afterEachInteraction: false,
      afterErrors: true,
      minIntervalMs: 60000 // 1 minute
    },
    reflectionDepth: 'standard' as ReflectionDepth,
    maxHistoryItems: 100,
    adaptiveBehavior: true,
    adaptationRate: 0.3,
    metricsToTrack: ['success', 'efficiency', 'satisfaction', 'errors'],
    improvementGoals: [],
    persistReflections: true,
    enablePeriodicReflections: false,
    enableSelfImprovement: false,
    defaultImprovementAreas: []
  };

  return {
    ...baseConfig,
    ...presetConfig,
    ...overrides
  } as ReflectionManagerConfig;
} 