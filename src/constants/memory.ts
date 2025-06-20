/**
 * Client-safe re-exports from the canonical memory types source
 * 
 * This file provides a safe way for client-side components to import memory types
 * without directly importing server-side modules. All types come from the single
 * canonical source: src/server/memory/config/types.ts
 * 
 * NOTE FOR FUTURE DEVELOPERS:
 * - This is NOT technical debt or duplication
 * - This is the CORRECT architecture for client/server separation
 * - DO NOT create additional memory type files
 * - The canonical source is: src/server/memory/config/types.ts
 * - Client components should import from: @/constants/memory
 */

// Re-export enums and classes from canonical source
export {
  MemoryType,
  ImportanceLevel,
  MemorySourceType,
  MemorySource,
  ExtendedMemorySource,
  MemoryErrorCode,
  MemoryError,
  MemoryTypeCategory
} from '../server/memory/config/types';

// Re-export types from canonical source
export type {
  MemoryCondition,
  MemoryFilter,
  SortOptions,
  ValidationResult,
  MemoryTypeString
} from '../server/memory/config/types';

// Re-export helper functions from canonical source
export {
  isValidMemoryType,
  getMemoryTypeCategory,
  getMemoryTypeGroup
} from '../server/memory/config/types'; 