/**
 * Main exports for the Chloe agent package
 */

// Export all Chloe components
export { ChloeAgent } from './agent';
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

// Export the Chloe agent implementation
export * from './agent';
export * from './tools';
export * from './memory';
export * from './persona';
export * from './autonomy';
export * from './knowledge';

// Attach the planAndExecute method on import
import './planAndExecute';

// Re-export types
export type { ChloeMemoryOptions } from './memory';
export type { PersonaOptions } from './persona';

// Import ChloeAgent for default export
import { ChloeAgent } from './agent';

// Import required modules for the LangChain cognitive tools
import { createLangChainCognitiveTools } from './tools/cognitiveTools';

/**
 * Get or create a singleton instance of the Chloe agent
 */
export async function getChloeInstance(): Promise<ChloeAgent | null> {
  // Check if we already have an instance in the global scope
  if ((global as any).chloeAgent) {
    return (global as any).chloeAgent;
  }
  
  try {
    // Create and initialize a new instance
    const agent = new ChloeAgent();
    await agent.initialize();
    
    // Initialize LangChain compatible cognitive tools using the agent's cognitive systems
    const langChainCognitiveTools = createLangChainCognitiveTools(
      agent.getCognitiveMemory(),
      agent.getKnowledgeGraph()
    );
    
    // Store for future use
    (global as any).chloeAgent = agent;
    
    return agent;
  } catch (error) {
    console.error('Error initializing Chloe agent:', error);
    return null;
  }
}

// Default export
export default ChloeAgent; 