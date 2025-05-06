/**
 * Memory edit schema for version history
 */
import { MemoryType } from '../config';
import { BaseMemorySchema, BaseMetadataSchema } from './base-schema';

/**
 * Edit types
 */
export type EditType = 'create' | 'update' | 'delete';

/**
 * Editor types
 */
export type EditorType = 'human' | 'agent' | 'system';

/**
 * Memory edit-specific metadata
 */
export interface MemoryEditMetadataSchema extends BaseMetadataSchema {
  // Original memory reference
  original_memory_id: string;
  original_type: MemoryType;
  original_timestamp: string;
  
  // Edit info
  edit_type: EditType;
  editor_type: EditorType;
  editor_id?: string;
  diff_summary?: string;
  
  // Version chain
  current: boolean;
  
  // Special flag to prevent recursion
  _skip_logging?: boolean;
}

/**
 * Memory edit schema
 */
export interface MemoryEditSchema extends BaseMemorySchema {
  type: MemoryType.MEMORY_EDIT;
  metadata: MemoryEditMetadataSchema;
}

/**
 * Create default values for a memory edit
 * This is a function instead of a constant because required fields 
 * must be provided at creation time
 * 
 * @param originalMemoryId The ID of the original memory
 * @param originalType The type of the original memory
 * @param originalTimestamp The timestamp of the original memory
 * @returns Partial memory edit schema with defaults
 */
export function createMemoryEditDefaults(
  originalMemoryId: string,
  originalType: MemoryType,
  originalTimestamp: string
): Partial<MemoryEditSchema> {
  return {
    type: MemoryType.MEMORY_EDIT,
    metadata: {
      schemaVersion: "1.0.0",
      original_memory_id: originalMemoryId,
      original_type: originalType,
      original_timestamp: originalTimestamp,
      
      edit_type: 'create',
      editor_type: 'system',
      current: false,
      _skip_logging: true
    }
  };
} 