/**
 * MarkdownManagerFactory.ts
 * 
 * Factory for creating MarkdownManager instances with configuration specific to each agent.
 * This provides a simpler API for agent-specific configuration and helps with migration
 * from legacy implementations.
 */

import { MarkdownManager, MarkdownManagerOptions } from './MarkdownManager';
import { logger } from '../../../lib/logging';
import { IAgentMemory } from '../memory';

/**
 * Create a MarkdownManager instance for an agent
 * 
 * @param agentId - The ID of the agent
 * @param memory - The agent's memory implementation
 * @param options - Additional options for the markdown manager
 * @returns A configured MarkdownManager instance
 */
export function createMarkdownManager(
  agentId: string,
  memory: IAgentMemory,
  options: Partial<Omit<MarkdownManagerOptions, 'agentId' | 'memory'>> = {}
): MarkdownManager {
  return new MarkdownManager({
    agentId,
    memory,
    // Apply defaults that can be overridden
    department: 'general',
    syncWithGraph: false,
    ...options
  });
}

/**
 * Create a MarkdownManager instance for the Chloe agent
 * This provides a drop-in replacement for the original Chloe markdownManager
 * with the same interface and behavior
 * 
 * @param memory - Chloe's memory implementation
 * @param options - Additional options
 * @returns A configured MarkdownManager instance for Chloe
 */
export function createChloeMarkdownManager(
  memory: IAgentMemory,
  options: Partial<Omit<MarkdownManagerOptions, 'agentId' | 'memory'>> = {}
): MarkdownManager {
  return createMarkdownManager('chloe', memory, {
    department: 'marketing',
    syncWithGraph: true,
    logFunction: (message, data) => {
      logger.info(`[ChloeMarkdownManager] ${message}`, data ? data : '');
    },
    ...options
  });
}

/**
 * Default markdown manager instance for shared use
 * This is lazy-loaded when first accessed
 */
let defaultMarkdownManager: MarkdownManager | null = null;

/**
 * Get or create the default shared markdown manager instance
 * Note: This requires a memory implementation to be passed the first time it's called
 * 
 * @param memory - Memory implementation (required on first call)
 * @returns The default shared markdown manager instance
 */
export function getDefaultMarkdownManager(memory?: IAgentMemory): MarkdownManager {
  if (!defaultMarkdownManager) {
    if (!memory) {
      throw new Error('Memory implementation must be provided when first creating the default markdown manager');
    }
    
    defaultMarkdownManager = createMarkdownManager('shared', memory, {
      department: 'general'
    });
  }
  
  return defaultMarkdownManager;
}

/**
 * Reset the default markdown manager (mainly for testing)
 */
export function resetDefaultMarkdownManager(): void {
  defaultMarkdownManager = null;
} 