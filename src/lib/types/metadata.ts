/**
 * Base metadata interface for all memory types
 */
export interface BaseMetadata {
  // Common metadata fields
  created_at?: string;
  updated_at?: string;
  tags?: string[];
  description?: string;
  source?: string;
  confidence?: number;
  importance?: number;
  status?: string;
  custom_fields?: Record<string, any>;
}

/**
 * Edit types for memory version history
 */
export type EditType = 'create' | 'update' | 'delete';

/**
 * Editor types for memory edits
 */
export type EditorType = 'system' | 'user' | 'agent';

/**
 * Memory edit metadata for tracking the history and version control of memories
 */
export interface MemoryEditMetadata extends BaseMetadata {
  // Link to original memory
  original_memory_id: string;
  original_type: string;
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