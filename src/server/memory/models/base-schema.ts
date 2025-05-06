/**
 * Base memory schema definitions
 */
import { BaseMetadata } from '../../../types/metadata';
import { ImportanceLevel } from '../../../constants/memory';
import { MemoryType } from '../config';

/**
 * Base memory schema with required fields
 * All memory types must include these fields
 */
export interface BaseMemorySchema {
  // Core fields
  id: string;
  text: string;
  timestamp: string;
  type: MemoryType;
  
  // Optional fields
  is_deleted?: boolean;
  
  // Metadata common across all memory types
  metadata: BaseMetadataSchema;
}

/**
 * Base metadata fields common across all memory types
 * Extends the core BaseMetadata interface with additional memory-specific fields
 */
export interface BaseMetadataSchema extends BaseMetadata {
  // Importance info (extends the base importance field from BaseMetadata)
  importance_score?: number;
  critical?: boolean;
  
  // Usage tracking
  usage_count?: number;
  last_used?: string;
  
  // Tags
  tags?: string[];
  tag_confidence?: number;
  
  // Causal relationships
  led_to?: CausalRelationship[];
  caused_by?: CausalRelationship;
  
  // Version info
  current?: boolean;
  previous_version_id?: string;
  editor_type?: 'human' | 'agent' | 'system';
  editor_id?: string;
}

/**
 * Causal relationship between memories
 */
export interface CausalRelationship {
  memoryId: string;
  description?: string;
  timestamp: string;
}

/**
 * Memory point as stored in the database
 * This wraps the memory schema with vector information
 */
export interface MemoryPoint<T extends BaseMemorySchema> {
  id: string;
  vector: number[];
  payload: T;
}

/**
 * Memory search result with score
 */
export interface MemorySearchResult<T extends BaseMemorySchema> {
  id: string;
  score: number;
  payload: T;
} 