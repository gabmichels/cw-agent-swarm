/**
 * Input Processor Configuration Schema
 * 
 * This module defines the configuration schema for input processors,
 * including validation rules and default values.
 */

import { ConfigSchema } from '../../../../lib/config/types';
import { InputProcessorConfig } from '../../../../lib/agents/base/managers/InputProcessor';

/**
 * Schema for input processor configuration
 */
export const InputProcessorConfigSchema: ConfigSchema<InputProcessorConfig & Record<string, unknown>> = {
  enabled: {
    type: 'boolean',
    required: true,
    default: true,
    description: 'Whether the input processor is enabled'
  },
  supportedModalities: {
    type: 'array',
    items: {
      type: 'enum',
      enum: ['text', 'image', 'audio', 'video', 'file', 'structured']
    },
    default: ['text'],
    description: 'Input modalities supported by the processor'
  },
  maxInputSizeBytes: {
    type: 'number',
    min: 1024,           // Minimum 1KB
    max: 104857600,      // Maximum 100MB
    default: 1048576,    // Default 1MB
    description: 'Maximum input size in bytes'
  },
  preprocessingSteps: {
    type: 'array',
    items: {
      type: 'enum',
      enum: ['normalize', 'sanitize', 'trim', 'tokenize', 'extract_entities', 'custom']
    },
    default: ['normalize', 'sanitize', 'trim'],
    description: 'Input preprocessing steps to apply'
  },
  contentFilteringLevel: {
    type: 'enum',
    enum: ['none', 'low', 'medium', 'high'],
    default: 'medium',
    description: 'Content filtering level'
  },
  detectLanguage: {
    type: 'boolean',
    default: true,
    description: 'Whether to perform automatic language detection'
  },
  defaultLanguage: {
    type: 'string',
    default: 'en',
    description: 'Default input language'
  },
  allowStreaming: {
    type: 'boolean',
    default: true,
    description: 'Whether to allow streaming inputs'
  },
  processingTimeoutMs: {
    type: 'number',
    min: 100,            // Minimum 100ms
    max: 60000,          // Maximum 1 minute
    default: 5000,       // Default 5 seconds
    description: 'Timeout for input processing in milliseconds'
  },
  maintainHistory: {
    type: 'boolean',
    default: true,
    description: 'Whether to maintain input history'
  },
  maxHistoryItems: {
    type: 'number',
    min: 1,
    max: 1000,
    default: 100,
    description: 'Maximum history items to maintain'
  },
  sanitization: {
    type: 'object',
    properties: {
      removeHtml: {
        type: 'boolean',
        default: true,
        description: 'Whether to remove HTML'
      },
      removeScripts: {
        type: 'boolean',
        default: true,
        description: 'Whether to remove scripts'
      },
      removePii: {
        type: 'boolean',
        default: false,
        description: 'Whether to remove personal identifiable information'
      },
      customRules: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'Regex pattern or string to match'
            },
            replacement: {
              type: 'string',
              description: 'Replacement string'
            }
          }
        },
        default: [],
        description: 'Custom sanitization rules'
      }
    },
    default: {
      removeHtml: true,
      removeScripts: true,
      removePii: false,
      customRules: []
    },
    description: 'Sanitization options'
  }
};

/**
 * Input processor configuration presets for different agent roles
 */
export const InputProcessorPresets = {
  // Preset for comprehensive input processing
  COMPREHENSIVE: {
    supportedModalities: ['text', 'image', 'audio', 'video', 'file', 'structured'],
    maxInputSizeBytes: 10485760,  // 10MB
    preprocessingSteps: ['normalize', 'sanitize', 'trim', 'tokenize', 'extract_entities'],
    contentFilteringLevel: 'medium',
    detectLanguage: true,
    allowStreaming: true,
    processingTimeoutMs: 10000,   // 10 seconds
    maintainHistory: true,
    maxHistoryItems: 200,
    sanitization: {
      removeHtml: true,
      removeScripts: true,
      removePii: true,
      customRules: []
    }
  },
  
  // Preset for text-only processing
  TEXT_ONLY: {
    supportedModalities: ['text'],
    maxInputSizeBytes: 524288,    // 512KB
    preprocessingSteps: ['normalize', 'sanitize', 'trim'],
    contentFilteringLevel: 'medium',
    detectLanguage: true,
    allowStreaming: true,
    processingTimeoutMs: 3000,    // 3 seconds
    maintainHistory: true,
    maxHistoryItems: 100,
    sanitization: {
      removeHtml: true,
      removeScripts: true,
      removePii: false,
      customRules: []
    }
  },
  
  // Preset for minimal processing
  MINIMAL: {
    supportedModalities: ['text'],
    maxInputSizeBytes: 262144,    // 256KB
    preprocessingSteps: ['sanitize', 'trim'],
    contentFilteringLevel: 'low',
    detectLanguage: false,
    allowStreaming: false,
    processingTimeoutMs: 2000,    // 2 seconds
    maintainHistory: false,
    maxHistoryItems: 20,
    sanitization: {
      removeHtml: true,
      removeScripts: true,
      removePii: false,
      customRules: []
    }
  },
  
  // Preset for multi-modal processing
  MULTI_MODAL: {
    supportedModalities: ['text', 'image', 'audio'],
    maxInputSizeBytes: 5242880,   // 5MB
    preprocessingSteps: ['normalize', 'sanitize', 'trim', 'tokenize'],
    contentFilteringLevel: 'medium',
    detectLanguage: true,
    allowStreaming: true,
    processingTimeoutMs: 8000,    // 8 seconds
    maintainHistory: true,
    maxHistoryItems: 150,
    sanitization: {
      removeHtml: true,
      removeScripts: true,
      removePii: false,
      customRules: []
    }
  },
  
  // Preset for high security processing
  HIGH_SECURITY: {
    supportedModalities: ['text'],
    maxInputSizeBytes: 1048576,   // 1MB
    preprocessingSteps: ['normalize', 'sanitize', 'trim'],
    contentFilteringLevel: 'high',
    detectLanguage: true,
    allowStreaming: false,
    processingTimeoutMs: 5000,    // 5 seconds
    maintainHistory: true,
    maxHistoryItems: 50,
    sanitization: {
      removeHtml: true,
      removeScripts: true,
      removePii: true,
      customRules: []
    }
  }
};

// Type for preset keys
type InputProcessorPresetKey = keyof typeof InputProcessorPresets;

/**
 * Factory function to create an input processor configuration with a preset
 * @param preset Preset name or configuration object
 * @param overrides Configuration overrides
 * @returns The merged configuration
 */
export function createInputProcessorConfig(
  preset: InputProcessorPresetKey | Partial<InputProcessorConfig> = 'COMPREHENSIVE',
  overrides: Partial<InputProcessorConfig> = {}
): InputProcessorConfig {
  // Get the preset configuration
  const presetConfig = typeof preset === 'string'
    ? InputProcessorPresets[preset as InputProcessorPresetKey]
    : preset;
  
  // Merge with base defaults and overrides
  return {
    enabled: true,
    supportedModalities: ['text'],
    maxInputSizeBytes: 1048576,   // 1MB
    preprocessingSteps: ['normalize', 'sanitize', 'trim'],
    contentFilteringLevel: 'medium',
    detectLanguage: true,
    defaultLanguage: 'en',
    allowStreaming: true,
    processingTimeoutMs: 5000,    // 5 seconds
    maintainHistory: true,
    maxHistoryItems: 100,
    sanitization: {
      removeHtml: true,
      removeScripts: true,
      removePii: false,
      customRules: []
    },
    ...presetConfig,
    ...overrides
  } as InputProcessorConfig;
} 