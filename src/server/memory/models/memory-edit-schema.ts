/**
 * Memory edit schema for version history
 */
import { MemoryType } from '../config';
import { BaseMemorySchema } from './base-schema';
import { BaseMetadata } from '../../../types/metadata';

/**
 * Edit types
 */
export type EditType = 'create' | 'update' | 'delete';

/**
 * Editor types
 */
export type EditorType = 'agent' | 'system' | 'human';

/**
 * Memory edit metadata schema for tracking changes to memory
 */
export interface MemoryEditMetadataSchema extends BaseMetadata {
  // Link to the original memory being edited
  original_memory_id: string;
  original_type: MemoryType;
  original_timestamp: string;
  
  // Edit information
  edit_type: EditType;
  editor_type: EditorType;
  editor_id?: string;
  diff_summary?: string;
  
  // Version tracking
  current: boolean;
  previous_version_id?: string;
  
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