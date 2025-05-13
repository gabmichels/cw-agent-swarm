/**
 * Knowledge Interfaces Index
 * 
 * This file exports all knowledge-related interfaces for easy import.
 */

// Export knowledge acquisition interfaces
export * from './KnowledgeAcquisition.interface';

// Export knowledge validation interfaces
export * from './KnowledgeValidation.interface';

// Re-export related interfaces from KnowledgeManager
export type { 
  KnowledgeManagerConfig,
  KnowledgeEntry
} from '../../../../lib/agents/base/managers/KnowledgeManager'; 