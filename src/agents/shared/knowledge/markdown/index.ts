/**
 * Markdown tools for knowledge management
 * 
 * This module provides tools for working with markdown files as knowledge sources.
 */

export { MarkdownManager } from '../MarkdownManager';
export type { 
  MarkdownManagerOptions, 
  MarkdownLoadingStats,
  MarkdownParsingOptions 
} from '../MarkdownManager';

export {
  createMarkdownManager,
  getDefaultMarkdownManager,
  resetDefaultMarkdownManager
} from '../MarkdownManagerFactory';

/**
 * Common markdown parsing configurations
 */
export const MARKDOWN_CONFIGS = {
  /**
   * Default configuration for document-based memory storage
   */
  DEFAULT: {
    splitSections: false,
    maxTags: 15,
    defaultImportance: 'medium'
  },
  
  /**
   * Configuration for detailed knowledge extraction with sections
   */
  KNOWLEDGE_EXTRACTION: {
    splitSections: true,
    maxTags: 10, 
    defaultImportance: 'medium',
    maxSectionLength: 5000
  },
  
  /**
   * Configuration for training data preparation
   */
  TRAINING: {
    splitSections: true,
    maxTags: 20,
    defaultImportance: 'high',
    maxSectionLength: 8000
  }
}; 