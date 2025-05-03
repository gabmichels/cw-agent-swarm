/**
 * Automatic Markdown Content Loader for Chloe
 * 
 * This module initializes at startup to ensure all critical markdown content
 * from docs/ and knowledge/ directories is loaded into Chloe's memory with
 * CRITICAL importance for quick retrieval.
 */

import { loadAllMarkdownAsMemory } from '../knowledge/markdownMemoryLoader';
import { logger } from '../../../lib/logging';
import path from 'path';
import fs from 'fs';

// Track loaded files to prevent reprocessing the same files 
let loadedFiles: Set<string> = new Set<string>();

/**
 * Initialize the markdown memory loader and load all markdown files
 * from the standard directories.
 * 
 * @param options Configuration options for initialization
 * @returns Promise resolving when initialization is complete
 */
export async function initializeMarkdownMemory(options: {
  force?: boolean; // Whether to force reload all files, ignoring the loaded list
  directories?: string[]; // Custom directories to load from
} = {}): Promise<void> {
  try {
    logger.info('Starting automatic markdown memory loader initialization...');
    
    // Set up directories to search - these contain the most important documentation
    const directoriesToLoad = options.directories || ['docs/', 'knowledge/'];
    
    // Load all markdown files into memory in the background
    // Apply duplication checking by default
    logger.info('Loading markdown documentation into memory (CRITICAL importance)...');
    
    const stats = await loadAllMarkdownAsMemory(directoriesToLoad, {
      force: options.force || false,
      checkForDuplicates: true
    });
    
    // Record successful initialization details
    logger.info(`Markdown initialization complete: Processed ${stats.filesProcessed} files, Added ${stats.entriesAdded} memory entries, Skipped ${stats.duplicatesSkipped} duplicates`);
    
  } catch (error) {
    // Log the error but don't block application startup
    logger.error('Error during markdown memory initialization:', error);
    logger.warn('Application will continue without markdown content loaded. Some knowledge retrieval features may be impaired.');
  }
}

/**
 * Force reload all markdown files, ignoring duplication checks
 */
export async function forceReloadMarkdownFiles(): Promise<void> {
  try {
    logger.info('Forcing reload of all markdown files...');
    await initializeMarkdownMemory({ force: true });
    logger.info('Forced markdown reload complete');
  } catch (error) {
    logger.error('Error during forced markdown reload:', error);
  }
}

// Auto-initialize if this file is imported directly in server context
if (typeof window === 'undefined') {
  initializeMarkdownMemory().catch(error => {
    logger.error('Failed to initialize markdown memory:', error);
  });
} 