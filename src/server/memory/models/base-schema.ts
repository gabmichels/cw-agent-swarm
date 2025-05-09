/**
 * Base memory schema definitions
 */
import { BaseMetadata, CausalRelationship } from '../../../types/metadata';
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
  metadata: BaseMetadata;
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