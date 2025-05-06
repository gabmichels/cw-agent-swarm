/**
 * Thought memory schema
 */
import { MemoryType } from '../config';
import { BaseMemorySchema, BaseMetadataSchema } from './base-schema';
import { ThoughtMetadata, CognitiveProcessType } from '../../../types/metadata';
import { createAgentId } from '../../../types/structured-id';

/**
 * Thought types
 */
export type ThoughtType = 'thought' | 'reflection' | 'planning' | 'reasoning' | 'analysis';

/**
 * Thought-specific metadata schema
 * Extends the BaseMetadataSchema with thought-specific fields from our ThoughtMetadata type
 */
export interface ThoughtMetadataSchema extends BaseMetadataSchema, Omit<ThoughtMetadata, keyof BaseMetadataSchema> {
  // Additional thought-specific fields
  relatedTo?: string[];
  reflectionType?: 'causal' | 'contextual' | 'counterfactual' | 'temporal';
  isInternalMessage?: boolean;
  notForChat?: boolean;
}

/**
 * Thought schema
 */
export interface ThoughtSchema extends BaseMemorySchema {
  type: MemoryType.THOUGHT;
  metadata: ThoughtMetadataSchema;
}

/**
 * Default values for thought schema
 */
export const THOUGHT_DEFAULTS: Partial<ThoughtSchema> = {
  type: MemoryType.THOUGHT,
  metadata: {
    schemaVersion: '1.0.0',
    source: 'agent',
    timestamp: Date.now(),
    intention: 'reasoning',
    isInternalMessage: true,
    notForChat: true,
    processType: CognitiveProcessType.THOUGHT,
    agentId: createAgentId('default-agent') // Default agent ID
  }
}; 