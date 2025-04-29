/**
 * Main exports for the Chloe agent package
 */

// Export core components
export { ChloeAgent } from './core/agent';
export { ChloeAgent as Agent } from './core/agent'; // Legacy export

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
export type { PersonaOptions } from './persona';

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
  
  // Check for existing global instance
  if (global.chloeAgent) {
    return global.chloeAgent;
  }
  
  // Create a new instance
  if (!chloeInstance) {
    console.log('Creating new Chloe instance');
    chloeInstance = new ChloeAgent();
    
    // Initialize on creation
    try {
      await chloeInstance.initialize();
      console.log('Chloe instance initialized successfully');
    } catch (error) {
      console.error('Error initializing Chloe instance:', error);
    }
    
    // Store as global
    global.chloeAgent = chloeInstance;
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