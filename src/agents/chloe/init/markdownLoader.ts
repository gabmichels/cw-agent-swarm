/**
 * Automatic Markdown Content Loader for Chloe
 * 
 * This module initializes at startup to ensure all critical markdown content
 * from docs/ and knowledge/ directories is loaded into Chloe's memory with
 * CRITICAL importance for quick retrieval.
 * 
 * Note: After initial loading, ongoing file changes are automatically detected and
 * processed by the MarkdownWatcher class, which monitors the file system for changes.
 */

import { loadAllMarkdownAsMemory } from '../knowledge/markdownMemoryLoader';
import { logger } from '../../../lib/logging';
import { AGENT_CONFIGS } from '../types/agent';

// Track whether initialization has already occurred to prevent multiple loads 
let initializationComplete = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Get agent ID from path
 */
function getAgentIdFromPath(): string {
  // Default to chloe
  return 'chloe';
}

/**
 * Initialize the markdown memory loader and load all markdown files
 * from the standard directories.
 * 
 * This function is called once during application startup to perform the initial load.
 * Subsequent file changes are handled by the MarkdownWatcher, not by this function.
 * 
 * @param options Configuration options for initialization
 * @returns Promise resolving when initialization is complete
 */
export async function initializeMarkdownMemory(options: {
  force?: boolean; // Whether to force reload all files, ignoring the loaded list
  directories?: string[]; // Custom directories to load from
  agentId?: string; // Agent ID to load markdown for
  department?: string; // Department the agent is associated with
} = {}): Promise<void> {
  try {
    // Skip if already initialized in this process and not forced
    if (initializationComplete && !options.force) {
      logger.info('Markdown memory already initialized in this process, skipping');
      return;
    }

    // If initialization is in progress, wait for it to complete
    if (initializationPromise && !options.force) {
      logger.info('Markdown memory initialization already in progress, waiting for completion');
      await initializationPromise;
      return;
    }

    // Set initialization promise to avoid concurrent initializations
    initializationPromise = (async () => {
      logger.info('Starting automatic markdown memory loader initialization...');
      
      // Get agent ID from options or determine from module path
      const agentId = options.agentId || getAgentIdFromPath();
      
      // Get agent config based on ID
      const agentConfig = AGENT_CONFIGS[agentId];
      
      // Get department directly - either from options, agent config, or default
      const department = options.department || 
                        (agentConfig && agentConfig.departments && agentConfig.departments.length > 0 ? 
                        agentConfig.departments[0] : 'marketing');
      
      // Set up directories to search - these contain the most important documentation
      const directoriesToLoad = options.directories || [
        'data/knowledge/company', 
        `data/knowledge/agents/${agentId}`,
        `data/knowledge/agents/shared`,
        `data/knowledge/domains/${department}`
      ];
      
      // Load all markdown files into memory
      // Apply duplication checking by default
      logger.info(`Loading markdown documentation for agent ${agentId} (department: ${department}) into memory with caching enabled...`);
      
      const stats = await loadAllMarkdownAsMemory(directoriesToLoad, {
        force: options.force || false,
        checkForDuplicates: true
      });
      
      // Record successful initialization details
      logger.info(`Markdown initialization complete: Processed ${stats.filesProcessed} files, Added ${stats.entriesAdded} memory entries, Skipped ${stats.duplicatesSkipped} duplicates, Unchanged: ${stats.unchangedFiles}`);
      
      // Mark as initialized 
      initializationComplete = true;
      
      // Log that ongoing file changes will be handled by the watcher
      logger.info('Initial markdown loading complete. Ongoing file changes will be detected by MarkdownWatcher.');
    })();

    // Wait for initialization to complete
    await initializationPromise;
    
  } catch (error) {
    // Log the error but don't block application startup
    logger.error('Error during markdown memory initialization:', error);
    logger.warn('Application will continue without markdown content loaded. Some knowledge retrieval features may be impaired.');
    
    // Reset initialization state so we can try again
    initializationPromise = null;
    initializationComplete = false;
  }
}

/**
 * Force reload all markdown files, ignoring duplication checks.
 * This is primarily used by admin tools and should be used with caution
 * as it may interfere with the MarkdownWatcher's file tracking.
 */
export async function forceReloadMarkdownFiles(agentId?: string, department?: string): Promise<void> {
  try {
    // Reset initialization state
    initializationComplete = false;
    initializationPromise = null;
    
    logger.info('Forcing reload of all markdown files...');
    await initializeMarkdownMemory({ force: true, agentId, department });
    logger.info('Forced markdown reload complete');
  } catch (error) {
    logger.error('Error during forced markdown reload:', error);
  }
}

/**
 * Get standard directories for the agent
 */
export function getAgentDirectories(agentId: string = 'chloe', department: string = 'marketing'): string[] {
  return [
    'data/knowledge/company', 
    `data/knowledge/agents/${agentId}`,
    `data/knowledge/agents/shared`,
    `data/knowledge/domains/${department}`
  ];
}

// Auto-initialize if this file is imported directly in server context
// This handles the initial load only, ongoing changes are handled by MarkdownWatcher
if (typeof window === 'undefined') {
  initializeMarkdownMemory().catch(error => {
    logger.error('Failed to initialize markdown memory:', error);
  });
} 