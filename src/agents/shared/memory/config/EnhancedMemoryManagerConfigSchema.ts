/**
 * EnhancedMemoryManagerConfigSchema - Configuration schema for enhanced memory manager
 * 
 * This file defines the configuration schema for the EnhancedMemoryManager,
 * including validation rules, defaults, and property types.
 */

import { ConfigSchema } from '../../../../lib/config/types';
import { EnhancedMemoryManagerConfig } from '../interfaces/EnhancedMemoryManager.interface';
import { CognitivePatternType } from '../interfaces/CognitiveMemory.interface';

/**
 * Configuration schema for the EnhancedMemoryManager
 */
export const EnhancedMemoryManagerConfigSchema: ConfigSchema<EnhancedMemoryManagerConfig> = {
  enabled: {
    type: 'boolean',
    default: true,
    required: true
  },
  enableCognitiveMemory: {
    type: 'boolean',
    default: true,
    description: 'Whether to enable cognitive memory capabilities'
  },
  enableConversationSummarization: {
    type: 'boolean',
    default: true,
    description: 'Whether to enable conversation summarization'
  },
  maxAssociationsPerMemory: {
    type: 'number',
    default: 20,
    min: 1,
    max: 100,
    description: 'Maximum number of associations per memory'
  },
  enableAutoAssociationDiscovery: {
    type: 'boolean',
    default: false,
    description: 'Whether to automatically discover associations'
  },
  autoAssociationMinScore: {
    type: 'number',
    default: 0.7,
    min: 0,
    max: 1,
    description: 'Minimum confidence score for automatic association discovery'
  },
  autoAssociationPatternTypes: {
    type: 'array',
    items: {
      type: 'string',
      enum: Object.values(CognitivePatternType)
    },
    default: [CognitivePatternType.TEMPORAL, CognitivePatternType.CAUSAL],
    description: 'Pattern types to use for automatic association discovery'
  },
  autoAssociationIntervalMs: {
    type: 'number',
    default: 3600000, // 1 hour
    min: 1000,
    description: 'Interval for automatic association discovery in milliseconds'
  },
  enableVersionHistory: {
    type: 'boolean',
    default: true,
    description: 'Whether to enable memory version history'
  },
  maxVersionsPerMemory: {
    type: 'number',
    default: 10,
    min: 0,
    description: 'Maximum number of versions to keep per memory (0 = unlimited)'
  },
  autoCreateVersions: {
    type: 'boolean',
    default: true,
    description: 'Whether to create versions automatically on memory updates'
  },
  enableAutoPruning: {
    type: 'boolean',
    default: true,
    description: 'Whether to enable automatic memory pruning'
  },
  pruningIntervalMs: {
    type: 'number',
    default: 86400000, // 24 hours
    min: 1000,
    description: 'Interval for automatic pruning in milliseconds'
  },
  maxShortTermEntries: {
    type: 'number',
    default: 1000,
    min: 10,
    description: 'Maximum number of short-term memory entries'
  },
  relevanceThreshold: {
    type: 'number',
    default: 0.7,
    min: 0,
    max: 1,
    description: 'Minimum relevance threshold for memory search'
  },
  enableAutoConsolidation: {
    type: 'boolean',
    default: true,
    description: 'Whether to enable automatic memory consolidation'
  },
  consolidationIntervalMs: {
    type: 'number',
    default: 86400000, // 24 hours
    min: 1000,
    description: 'Interval for automatic consolidation in milliseconds'
  },
  minMemoriesForConsolidation: {
    type: 'number',
    default: 20,
    min: 2,
    description: 'Minimum number of memories required for consolidation'
  },
  forgetSourceMemoriesAfterConsolidation: {
    type: 'boolean',
    default: false,
    description: 'Whether to remove source memories after consolidation'
  }
}; 