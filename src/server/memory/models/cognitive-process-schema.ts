/**
 * Cognitive Process Schema
 * 
 * This module defines the schemas for various cognitive processes like
 * thoughts, reflections, insights, planning, etc. It replaces the legacy
 * thought schema with a more comprehensive and strongly-typed structure.
 */

import { MemoryType } from '../config';
import { BaseMemorySchema } from './base-schema';
import { 
  CognitiveProcessMetadata, 
  ThoughtMetadata,
  ReflectionMetadata,
  InsightMetadata,
  PlanningMetadata,
  CognitiveProcessType
} from '../../../types/metadata';
import { StructuredId, createEnumStructuredId, EntityNamespace, EntityType, structuredIdToString } from '../../../types/structured-id';
import { z } from 'zod';
import { 
  ImportanceLevel
} from '../../../constants/memory';
import { MessageRole } from '../../../agents/shared/types/MessageTypes';
import { generateSystemAgentId } from '../../../lib/core/id-generation';

/**
 * Base cognitive process metadata schema
 * Extends CognitiveProcessMetadata directly since we're unifying the interfaces
 */
export interface CognitiveProcessMetadataSchema extends CognitiveProcessMetadata {
  // No additional fields needed as CognitiveProcessMetadata contains everything
}

/**
 * Thought metadata schema (specialized cognitive process)
 */
export interface ThoughtMetadataSchema extends CognitiveProcessMetadataSchema,
  Omit<ThoughtMetadata, keyof CognitiveProcessMetadataSchema> {
  // Thought-specific fields already included in ThoughtMetadata
}

/**
 * Reflection metadata schema (specialized cognitive process)
 */
export interface ReflectionMetadataSchema extends CognitiveProcessMetadataSchema,
  Omit<ReflectionMetadata, keyof CognitiveProcessMetadataSchema> {
  // Reflection-specific fields already included in ReflectionMetadata
}

/**
 * Insight metadata schema (specialized cognitive process)
 */
export interface InsightMetadataSchema extends CognitiveProcessMetadataSchema,
  Omit<InsightMetadata, keyof CognitiveProcessMetadataSchema> {
  // Insight-specific fields already included in InsightMetadata
}

/**
 * Planning metadata schema (specialized cognitive process)
 */
export interface PlanningMetadataSchema extends CognitiveProcessMetadataSchema,
  Omit<PlanningMetadata, keyof CognitiveProcessMetadataSchema> {
  // Planning-specific fields already included in PlanningMetadata
}

/**
 * Base cognitive process schema
 */
export interface CognitiveProcessSchema extends BaseMemorySchema {
  type: MemoryType;
  metadata: CognitiveProcessMetadataSchema;
}

/**
 * Thought schema
 */
export interface ThoughtSchema extends CognitiveProcessSchema {
  type: MemoryType.THOUGHT;
  metadata: ThoughtMetadataSchema;
}

/**
 * Reflection schema
 */
export interface ReflectionSchema extends CognitiveProcessSchema {
  type: MemoryType.REFLECTION;
  metadata: ReflectionMetadataSchema;
}

/**
 * Insight schema
 */
export interface InsightSchema extends CognitiveProcessSchema {
  type: MemoryType.INSIGHT;
  metadata: InsightMetadataSchema;
}

/**
 * Planning schema
 */
export interface PlanningSchema extends CognitiveProcessSchema {
  type: MemoryType.TASK;
  metadata: PlanningMetadataSchema;
}

// Default agent ID for system assistant
const DEFAULT_AGENT_ID = generateSystemAgentId('default-agent');

/**
 * Default values for thought schema
 */
export const THOUGHT_DEFAULTS: Partial<ThoughtSchema> = {
  type: MemoryType.THOUGHT,
  metadata: {
    schemaVersion: "1.0.0",
    processType: CognitiveProcessType.THOUGHT,
    agentId: DEFAULT_AGENT_ID
  }
};

/**
 * Default values for reflection schema
 */
export const REFLECTION_DEFAULTS: Partial<ReflectionSchema> = {
  type: MemoryType.REFLECTION,
  metadata: {
    schemaVersion: "1.0.0",
    processType: CognitiveProcessType.REFLECTION,
    agentId: DEFAULT_AGENT_ID
  }
};

/**
 * Default values for insight schema
 */
export const INSIGHT_DEFAULTS: Partial<InsightSchema> = {
  type: MemoryType.INSIGHT,
  metadata: {
    schemaVersion: "1.0.0",
    processType: CognitiveProcessType.INSIGHT,
    agentId: DEFAULT_AGENT_ID
  }
};

/**
 * Default values for planning schema
 */
export const PLANNING_DEFAULTS: Partial<PlanningSchema> = {
  type: MemoryType.TASK,
  metadata: {
    schemaVersion: "1.0.0",
    processType: CognitiveProcessType.PLANNING,
    agentId: DEFAULT_AGENT_ID
  }
};

// Default cognitive process metadata following our naming conventions
export const defaultCognitiveProcessMetadata = {
  schemaVersion: '1.0.0',
  processType: CognitiveProcessType.THOUGHT,
  contextId: 'default-context',
  timestamp: new Date().toISOString(),
  importance: ImportanceLevel.MEDIUM,
  agentId: DEFAULT_AGENT_ID
};

export const defaultThoughtMetadata = {
  schemaVersion: '1.0.0',
  processType: CognitiveProcessType.THOUGHT,
  contextId: 'thought-context',
  timestamp: new Date().toISOString(),
  importance: ImportanceLevel.MEDIUM,
  agentId: DEFAULT_AGENT_ID
};

export const defaultReflectionMetadata = {
  schemaVersion: '1.0.0',
  processType: CognitiveProcessType.REFLECTION,
  contextId: 'reflection-context',
  timestamp: new Date().toISOString(),
  importance: ImportanceLevel.MEDIUM,
  agentId: DEFAULT_AGENT_ID
};

export const defaultInsightMetadata = {
  schemaVersion: '1.0.0',
  processType: CognitiveProcessType.INSIGHT,
  contextId: 'insight-context',
  timestamp: new Date().toISOString(),
  importance: ImportanceLevel.MEDIUM,
  agentId: DEFAULT_AGENT_ID
}; 