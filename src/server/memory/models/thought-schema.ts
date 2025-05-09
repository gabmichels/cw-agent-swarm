/**
 * Thought memory schema (legacy)
 * 
 * This is the legacy schema for thoughts - prefer using cognitive-process-schema.ts
 */
import { MemoryType } from '../config';
import { BaseMemorySchema } from './base-schema';
import { ThoughtMetadata, CognitiveProcessType } from '../../../types/metadata';
import { EntityNamespace, EntityType, createEnumStructuredId } from '../../../types/structured-id';

/**
 * Thought metadata schema (legacy)
 * 
 * Extends ThoughtMetadata directly since we've unified the base interfaces
 */
export interface ThoughtMetadataSchema extends ThoughtMetadata {
  // No additional fields needed as ThoughtMetadata already contains everything
}

/**
 * Thought schema (legacy)
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
    processType: CognitiveProcessType.THOUGHT,
    agentId: createEnumStructuredId(EntityNamespace.SYSTEM, EntityType.AGENT, 'default-agent')
  }
}; 