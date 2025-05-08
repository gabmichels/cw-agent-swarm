/**
 * Main exports for the Chloe agent package
 */

// Export core components
export { ChloeAgent } from './core/agent';
export { ChloeAgentV2 } from './next-gen/ChloeAgentV2';

// Export types
export type { ChloeAgentConfig, ChloeAgentOptions } from './types/interfaces';

// Export the registry adapter functions
export { 
  getModernChloeInstance,
  migrateToChloeV2
} from './adapters/registry-adapter';

// Re-export from registry-adapter for backward compatibility
export { getChloeInstance } from './adapters/registry-adapter';

// Export additional components
export { ToolManager } from './core/toolManager';
export { PlanningManager } from './core/planningManager';
export { MemoryManager } from './core/memoryManager';
export { ReflectionManager } from './core/reflectionManager';
export { ThoughtManager } from './core/thoughtManager';
export { MarketScannerManager } from './core/marketScannerManager';
export { KnowledgeGapsManager } from './core/knowledgeGapsManager';

// Export notifiers
export type { Notifier } from './notifiers';
export type { DiscordNotifier } from './notifiers/discord';

// Export memory components
export type { ChloeMemory } from './memory';
export { MemoryTagger } from './memory-tagger';
export { TaskLogger } from './task-logger';

// Export autonomy components
export { setupScheduler, ChloeScheduler, setupDefaultSchedule, initializeAutonomy } from './scheduler';

// Export tools
export { createChloeTools } from './tools';

// Export LangGraph workflow components
export { ChloeGraph, createChloeGraph } from './graph';
export type { PlanningState, SubGoal, PlanningTask } from './graph';

// Export planAndExecute functionality
export { 
  planAndExecute, 
  attachPlanAndExecute
} from './planAndExecute';
export type { PlanAndExecuteOptions } from './planAndExecute';

// Export autonomy system
export {
  initializeChloeAutonomy,
  diagnoseAutonomySystem,
  getRecentChatMessages,
  summarizeChat
} from './autonomy';

// Re-export types

// Import for singleton
import { ChloeAgent } from './core/agent';

// Global instance (singleton)
let chloeInstance: ChloeAgent | null = null;

/**
 * Get a singleton instance of the ChloeAgent
 */
export async function getChloeInstance(): Promise<ChloeAgent> {
  // If running in a browser, simply return a new instance (stateless)
  if (typeof window !== 'undefined') {
    return new ChloeAgent();
  }
  
  // Check for existing global instance first (highest priority)
  if (global.chloeAgent) {
    console.log('Using existing global Chloe instance');
    return global.chloeAgent;
  }
  
  // Check for existing module instance next
  if (chloeInstance) {
    console.log('Using existing module-level Chloe instance');
    return chloeInstance;
  }
  
  // Create a new instance only if no instance exists at all
  console.log('Creating new Chloe instance');
  chloeInstance = new ChloeAgent();
  
  // Store as global immediately to prevent duplicate initialization
  global.chloeAgent = chloeInstance;
  
  // Initialize on creation
  try {
    console.log('Initializing new Chloe instance');
    await chloeInstance.initialize();
    console.log('Chloe instance initialized successfully');
  } catch (error) {
    console.error('Error initializing Chloe instance:', error);
  }
  
  return chloeInstance;
}

// Global type declaration for accessing the singleton
declare global {
  // eslint-disable-next-line no-var
  var chloeAgent: ChloeAgent;
}

// Default export
export default ChloeAgent;

// Initialize the new adaptive tool system in Chloe's startup process

import { ChloeMemory } from './memory';
import { initializeToolManager } from './tools/fixToolManagerSingleton';
import { registerApifyTools } from './tools/apifyToolAdapters';

// Add this to the agent setup function

/**
 * Initialize the adaptive tool intelligence system
 */
async function setupAdaptiveToolSystem(memory: ChloeMemory): Promise<void> {
  try {
    // Initialize the tool manager singleton with memory
    initializeToolManager(memory);
    
    // Register Apify tools
    registerApifyTools(memory);
    
    // Register other tools as needed
    // ...
    
    console.log('Adaptive tool intelligence system initialized successfully');
  } catch (error) {
    console.error('Error initializing adaptive tool system:', error);
  }
}

// Call this during Chloe's initialization
// setupAdaptiveToolSystem(memory); 