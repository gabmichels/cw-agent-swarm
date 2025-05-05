/**
 * Constants related to memory types and categories
 * 
 * Note: These enums import from server/memory/config directly as the single source of truth.
 */

import { MemoryType as StandardMemoryType, ImportanceLevel as StandardImportanceLevel, ExtendedMemorySource } from '../server/memory/config/types';

/**
 * Import the standard memory types directly
 */
export { StandardMemoryType as MemoryType };

/**
 * Importance levels for memory entries
 */
export enum MemoryImportanceLevel {
  VERY_LOW = 'very_low',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high',
  CRITICAL = 'critical'
}

// Backward compatibility alias
export { MemoryImportanceLevel as ImportanceLevel };

/**
 * Source categorization for memory entries
 */
export enum MemorySourceType {
  USER = 'user',
  AGENT = 'agent',
  SYSTEM = 'system',
  TOOL = 'tool',
  INTEGRATION = 'integration',
  EXTERNAL = 'external',
  INFERENCE = 'inference',
  ANALYSIS = 'analysis',
  REFLECTION = 'reflection',
  OTHER = 'other',
  FILE = "FILE"
}

// Backward compatibility alias
export { MemorySourceType as MemorySource };

// Export the standard memory source as well
export { ExtendedMemorySource }; 