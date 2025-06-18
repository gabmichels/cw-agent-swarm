/**
 * Thought memory schema (legacy)
 * 
 * This is the legacy schema for thoughts - prefer using cognitive-process-schema.ts
 */
import { MemoryType } from '../config';
import { BaseMemorySchema } from './base-schema';
import { ThoughtMetadata, CognitiveProcessType } from '../../../types/metadata';
import { EntityNamespace, EntityType, createEnumStructuredId, structuredIdToString } from '../../../types/structured-id';
import { z } from 'zod';
import { ImportanceLevel } from '../../../constants/memory';
import { generateSystemAgentId } from '../../../lib/core/id-generation';

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
    schemaVersion: "1.0.0",
    processType: CognitiveProcessType.THOUGHT,
    importance: ImportanceLevel.MEDIUM,
    agentId: generateSystemAgentId('default-agent'),
    timestamp: new Date().toISOString()
  }
}; 