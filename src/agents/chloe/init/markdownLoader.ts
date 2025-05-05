/**
 * Automatic Markdown Content Loader for Chloe
 * 
 * This module initializes at startup to ensure all critical markdown content
 * from docs/ and knowledge/ directories is loaded into Chloe's memory with
 * CRITICAL importance for quick retrieval.
 */

import { loadAllMarkdownAsMemory } from '../knowledge/markdownMemoryLoader';
import { logger } from '../../../lib/logging';
import { AGENT_CONFIGS } from '../types/agent';

// Track whether initialization has already occurred to prevent multiple loads 
let initializationComplete = false;

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
  agentId?: string; // Agent ID to load markdown for
  department?: string; // Department the agent is associated with
} = {}): Promise<void> {
  try {
    // Skip if already initialized in this process and not forced
    if (initializationComplete && !options.force) {
      logger.info('Markdown memory already initialized in this process, skipping');
      return;
    }

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
  } catch (error) {
    // Log the error but don't block application startup
    logger.error('Error during markdown memory initialization:', error);
    logger.warn('Application will continue without markdown content loaded. Some knowledge retrieval features may be impaired.');
  }
}

/**
 * Force reload all markdown files, ignoring duplication checks
 */
export async function forceReloadMarkdownFiles(agentId?: string, department?: string): Promise<void> {
  try {
    logger.info('Forcing reload of all markdown files...');
    await initializeMarkdownMemory({ force: true, agentId, department });
    logger.info('Forced markdown reload complete');
  } catch (error) {
    logger.error('Error during forced markdown reload:', error);
  }
}

/**
 * Helper function to determine agent ID from the current module path
 */
function getAgentIdFromPath(): string {
  // Default to 'chloe' if we can't determine from path
  try {
    const modulePath = __dirname;
    const match = modulePath.match(/[\/\\]agents[\/\\]([^\/\\]+)[\/\\]/);
    return match ? match[1] : 'chloe';
  } catch {
    return 'chloe';
  }
}

// Auto-initialize if this file is imported directly in server context
if (typeof window === 'undefined') {
  initializeMarkdownMemory().catch(error => {
    logger.error('Failed to initialize markdown memory:', error);
  });
} 