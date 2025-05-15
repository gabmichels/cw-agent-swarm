/**
 * Scheduler Manager Configuration Schema
 * 
 * This module defines the configuration schema for scheduler managers,
 * including validation rules and default values.
 */

import { ConfigSchema } from '../../../../lib/config/types';
import { SchedulerManagerConfig } from '../../../../lib/agents/base/managers/SchedulerManager';

/**
 * Schema for scheduler manager configuration
 */
export const SchedulerManagerConfigSchema: ConfigSchema<SchedulerManagerConfig & Record<string, unknown>> = {
  enabled: {
    type: 'boolean',
    required: true,
    default: true,
    description: 'Whether the scheduler manager is enabled'
  },
  enableAutoScheduling: {
    type: 'boolean',
    default: true,
    description: 'Whether to enable automatic task scheduling'
  },
  schedulingIntervalMs: {
    type: 'number',
    min: 1000,             // Minimum 1 second
    max: 3600000,          // Maximum 1 hour
    default: 60000,        // Default 1 minute
    description: 'Interval for checking scheduled tasks in milliseconds'
  },
  maxConcurrentTasks: {
    type: 'number',
    min: 1,
    max: 100,
    default: 10,
    description: 'Maximum number of concurrent tasks'
  },
  enableTaskPrioritization: {
    type: 'boolean',
    default: true,
    description: 'Whether to enable task prioritization'
  },
  enableTaskDependencies: {
    type: 'boolean',
    default: true,
    description: 'Whether to enable task dependencies'
  },
  enableTaskRetries: {
    type: 'boolean',
    default: true,
    description: 'Whether to enable task retries'
  },
  maxRetryAttempts: {
    type: 'number',
    min: 0,
    max: 10,
    default: 3,
    description: 'Maximum number of task retry attempts'
  },
  enableTaskTimeouts: {
    type: 'boolean',
    default: true,
    description: 'Whether to enable task timeouts'
  },
  defaultTaskTimeoutMs: {
    type: 'number',
    min: 1000,             // Minimum 1 second
    max: 3600000,          // Maximum 1 hour
    default: 300000,       // Default 5 minutes
    description: 'Default task timeout in milliseconds'
  },
  defaultPriority: {
    type: 'number',
    min: 0,
    max: 10,
    default: 5,
    description: 'Default task priority'
  },
  adaptiveScheduling: {
    type: 'boolean',
    default: false,
    description: 'Whether to use adaptive scheduling'
  },
  schedulingAlgorithm: {
    type: 'enum',
    enum: ['fifo', 'priority', 'deadline', 'resource-aware', 'custom'],
    default: 'priority',
    description: 'Default scheduling algorithm'
  },
  preemptionAggressiveness: {
    type: 'number',
    min: 0,
    max: 1,
    default: 0.5,
    description: 'How aggressively to preempt tasks (0-1)'
  },
  trackResourceUtilization: {
    type: 'boolean',
    default: true,
    description: 'Whether to track resource utilization'
  },
  trackDependencies: {
    type: 'boolean',
    default: true,
    description: 'Whether to track task dependencies'
  },
  enableBatching: {
    type: 'boolean',
    default: false,
    description: 'Whether to enable task batching'
  },
  maxBatchSize: {
    type: 'number',
    min: 1,
    max: 50,
    default: 5,
    description: 'Maximum batch size'
  },
  defaultDeadlineBufferMs: {
    type: 'number',
    min: 0,
    max: 86400000,        // Maximum 24 hours
    default: 300000,      // Default 5 minutes
    description: 'Default deadline buffer in milliseconds'
  },
  defaultPeriodicIntervalMs: {
    type: 'number',
    min: 1000,            // Minimum 1 second
    max: 86400000,        // Maximum 24 hours
    default: 3600000,     // Default 1 hour
    description: 'Default interval for periodic tasks in milliseconds'
  },
  persistTasks: {
    type: 'boolean',
    default: true,
    description: 'Whether to persist scheduled tasks across sessions'
  },
  resourceLimits: {
    type: 'object',
    properties: {
      maxCpuPercent: {
        type: 'number',
        min: 0,
        max: 100,
        default: 80,
        description: 'CPU utilization limit (0-100%)'
      },
      maxMemoryBytes: {
        type: 'number',
        min: 1000000,      // 1MB
        max: 8000000000,   // 8GB
        default: 1073741824, // 1GB
        description: 'Memory limit in bytes'
      },
      maxTokensPerMinute: {
        type: 'number',
        min: 10,
        max: 100000,
        default: 10000,
        description: 'Token rate limit per minute'
      },
      maxApiCallsPerMinute: {
        type: 'number',
        min: 1,
        max: 1000,
        default: 100,
        description: 'API call rate limit per minute'
      }
    },
    default: {
      maxCpuPercent: 80,
      maxMemoryBytes: 1073741824,
      maxTokensPerMinute: 10000,
      maxApiCallsPerMinute: 100
    },
    description: 'Resource limits for the scheduler'
  }
};

/**
 * Scheduler manager configuration presets for different agent roles
 */
export const SchedulerManagerPresets = {
  // Preset for agents that need high throughput scheduling
  HIGH_THROUGHPUT: {
    maxConcurrentTasks: 20,
    schedulingIntervalMs: 30000,     // 30 seconds
    enableTaskPrioritization: true,
    enableTaskDependencies: true,
    maxRetryAttempts: 2,
    defaultTaskTimeoutMs: 180000,    // 3 minutes
    schedulingAlgorithm: 'priority',
    adaptiveScheduling: true,
    preemptionAggressiveness: 0.7,
    enableBatching: true,
    maxBatchSize: 10,
    resourceLimits: {
      maxCpuPercent: 90,
      maxMemoryBytes: 2147483648,    // 2GB
      maxTokensPerMinute: 20000,
      maxApiCallsPerMinute: 200
    }
  },

  // Preset for agents that need reliable scheduling
  RELIABLE: {
    maxConcurrentTasks: 5,
    schedulingIntervalMs: 60000,     // 1 minute
    enableTaskPrioritization: true,
    enableTaskDependencies: true,
    maxRetryAttempts: 5,
    defaultTaskTimeoutMs: 600000,    // 10 minutes
    schedulingAlgorithm: 'priority',
    adaptiveScheduling: false,
    preemptionAggressiveness: 0.3,
    enableBatching: false,
    resourceLimits: {
      maxCpuPercent: 60,
      maxMemoryBytes: 1073741824,    // 1GB
      maxTokensPerMinute: 5000,
      maxApiCallsPerMinute: 50
    }
  },

  // Preset for agents that need to conserve resources
  CONSERVATIVE: {
    maxConcurrentTasks: 3,
    schedulingIntervalMs: 120000,    // 2 minutes
    enableTaskPrioritization: true,
    enableTaskDependencies: false,
    maxRetryAttempts: 1,
    defaultTaskTimeoutMs: 300000,    // 5 minutes
    schedulingAlgorithm: 'fifo',
    adaptiveScheduling: false,
    preemptionAggressiveness: 0.1,
    enableBatching: false,
    resourceLimits: {
      maxCpuPercent: 40,
      maxMemoryBytes: 536870912,     // 512MB
      maxTokensPerMinute: 2000,
      maxApiCallsPerMinute: 20
    }
  }
};

/**
 * Type for scheduler manager preset keys
 */
type SchedulerManagerPresetKey = keyof typeof SchedulerManagerPresets;

/**
 * Create a scheduler manager configuration with preset and overrides
 */
export function createSchedulerManagerConfig(
  preset: SchedulerManagerPresetKey | Partial<SchedulerManagerConfig> = 'HIGH_THROUGHPUT',
  overrides: Partial<SchedulerManagerConfig> = {}
): SchedulerManagerConfig {
  // Get preset configuration
  const presetConfig = typeof preset === 'string'
    ? SchedulerManagerPresets[preset]
    : preset;

  // Merge configurations
  return {
    ...SchedulerManagerConfigSchema,
    ...presetConfig,
    ...overrides
  } as SchedulerManagerConfig;
} 