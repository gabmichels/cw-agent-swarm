/**
 * Thought memory schema
 */
import { MemoryType } from '../config';
import { BaseMemorySchema, BaseMetadataSchema } from './base-schema';

/**
 * Thought types
 */
export type ThoughtType = 'thought' | 'reflection' | 'planning' | 'reasoning' | 'analysis';

/**
 * Thought-specific metadata
 */
export interface ThoughtMetadataSchema extends BaseMetadataSchema {
  // Type of thought
  messageType: ThoughtType;
  
  // Always internal for thoughts
  isInternalMessage: boolean;
  notForChat: boolean;
  
  // Agent that generated the thought
  agentId?: string;
  
  // Related memories
  relatedTo?: string[];
  
  // Reflection type for specialized reflections
  reflectionType?: 'causal' | 'contextual' | 'counterfactual' | 'temporal';
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
    messageType: 'thought',
    isInternalMessage: true,
    notForChat: true
  }
}; 