/**
 * Re-exports from the canonical memory types source
 * 
 * @deprecated Import directly from src/server/memory/config/types.ts instead
 */

// Re-export enums and classes
export {
  MemoryType,
  ImportanceLevel,
  MemorySourceType,
  MemorySource,
  ExtendedMemorySource,
  MemoryErrorCode,
  MemoryError
} from '../server/memory/config/types';

// Re-export types
export type {
  MemoryCondition,
  MemoryFilter,
  SortOptions,
  CollectionConfig,
  ValidationResult
} from '../server/memory/config/types'; 