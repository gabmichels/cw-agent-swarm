/**
 * Main exports for the Chloe agent package
 */

// Import core agent class
import { ChloeAgent } from './core/agent';

// Export core components
export { ChloeAgent } from './core/agent';
export { ChloeAgentV2 } from './next-gen/ChloeAgentV2';

// Export types
export type { ChloeAgentConfig, ChloeAgentOptions } from './types/interfaces';

// Export the registry adapter functions
export { 
  getModernChloeInstance,
  migrateToChloeV2,
  getChloeInstance
} from './adapters/registry-adapter';

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

// Default export
export default ChloeAgent;

// Import for adaptive tool system
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