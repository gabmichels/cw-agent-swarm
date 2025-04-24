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

// Attach the planAndExecute method on import
import './planAndExecute';

// Re-export types
export type { ChloeMemoryOptions } from './memory';
export type { PersonaOptions } from './persona';

// Import ChloeAgent for default export
import { ChloeAgent } from './agent';
// Default export
export default ChloeAgent; 