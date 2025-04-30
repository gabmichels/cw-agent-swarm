import { ChloeMemory } from '../memory';
import { ToolManager } from './toolManager';

// Singleton instance with memory
let instance: ToolManager | null = null;
let memoryInstance: ChloeMemory | null = null;

/**
 * Initialize the ToolManager singleton with the memory instance.
 * This must be called before using getToolManager().
 */
export function initializeToolManager(memory: ChloeMemory): void {
  if (!instance) {
    memoryInstance = memory;
    instance = new ToolManager(memory);
  }
}

/**
 * Get the singleton instance of ToolManager.
 * Make sure to call initializeToolManager() before using this.
 */
export function getToolManager(): ToolManager {
  if (!instance) {
    if (!memoryInstance) {
      throw new Error('ToolManager not initialized. Call initializeToolManager(memory) first.');
    }
    instance = new ToolManager(memoryInstance);
  }
  return instance;
}

/**
 * Reset the ToolManager singleton (primarily for testing purposes).
 */
export function resetToolManager(): void {
  instance = null;
  memoryInstance = null;
} 