/**
 * Main exports for the Chloe agent package
 */

// Export core components
export { ChloeAgent } from './core/agent';
export { MemoryManager } from './core/memoryManager';
export { ToolManager } from './core/toolManager';
export { PlanningManager } from './core/planningManager';
export { ReflectionManager } from './core/reflectionManager';
export { ThoughtManager } from './core/thoughtManager';
export { MarketScannerManager } from './core/marketScannerManager';

// Export supporting components
export { ChloeMemory } from './memory';
export type { MemoryEntry } from './memory';
export { MemoryTagger } from './memory-tagger';
export { Persona } from './persona';
export { PersonaLoader } from './persona-loader';
export { TaskLogger } from './task-logger';
export { ChloeScheduler, setupScheduler, setupDefaultSchedule } from './scheduler';

// Export LangGraph workflow components
export { ChloeGraph } from './graph/graph';
export type { GraphState } from './graph/graph';

// Export tools
export { 
  SearchMemoryTool,
  SummarizeRecentActivityTool,
  ProposeContentIdeasTool,
  ReflectOnPerformanceTool,
  NotifyDiscordTool,
  createChloeTools
} from './tools';

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
export type { ChloeMemoryOptions } from './memory';
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