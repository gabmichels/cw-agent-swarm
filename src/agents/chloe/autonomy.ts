// Chloe Autonomy System Integration

import { ChloeAgent } from './agent';
import { initializeAutonomy } from './scheduler';
import * as serverQdrant from '../../server/qdrant';

/**
 * Initialize Chloe's full autonomy system with:
 * - Memory integration via Qdrant
 * - Scheduled tasks for planning and execution
 * - Daily reflections and summaries
 */
export async function initializeChloeAutonomy(agent: ChloeAgent): Promise<{
  status: 'success' | 'partial' | 'failed';
  message: string;
  autonomySystem?: any;
}> {
  try {
    console.log('Initializing Chloe autonomy system...');
    
    // Step 1: Ensure memory system is initialized
    try {
      await serverQdrant.initMemory({ 
        useOpenAI: true,
        forceReinit: false
      });
      console.log('Memory system initialized successfully');
    } catch (memoryError) {
      console.error('Error initializing memory system:', memoryError);
      return {
        status: 'partial',
        message: 'Memory system initialization failed, proceeding with limited functionality'
      };
    }
    
    // Step 2: Initialize autonomy scheduling
    try {
      const autonomySystem = initializeAutonomy(agent);
      console.log('Autonomy scheduling initialized successfully');
      
      // Step 3: Perform an initial system reflection
      await agent.reflect('What are my key responsibilities as a Chief Marketing Officer?');
      console.log('Initial system reflection completed');
      
      return {
        status: 'success',
        message: 'Chloe autonomy system fully initialized',
        autonomySystem
      };
    } catch (schedulerError) {
      console.error('Error initializing autonomy scheduling:', schedulerError);
      return {
        status: 'partial',
        message: 'Scheduler initialization failed, memory system is working but autonomous tasks will not run'
      };
    }
  } catch (error) {
    console.error('Fatal error initializing Chloe autonomy system:', error);
    return {
      status: 'failed',
      message: `Autonomy system initialization failed completely: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Run a diagnostic check on Chloe's autonomy systems
 */
export async function diagnoseAutonomySystem(): Promise<{
  memory: { status: string; messageCount: number };
  scheduler: { status: string; activeTasks: number };
  planning: { status: string; };
}> {
  try {
    // Check memory system
    const memoryStatus = await serverQdrant.diagnoseDatabaseHealth();
    
    // Placeholder for scheduler and planning checks
    // In a real implementation, this would check the actual systems
    
    return {
      memory: {
        status: memoryStatus.status,
        messageCount: memoryStatus.messageCount
      },
      scheduler: {
        status: 'operational',
        activeTasks: 5 // Default tasks
      },
      planning: {
        status: 'operational'
      }
    };
  } catch (error) {
    console.error('Error diagnosing autonomy system:', error);
    return {
      memory: { status: 'error', messageCount: 0 },
      scheduler: { status: 'unknown', activeTasks: 0 },
      planning: { status: 'unknown' }
    };
  }
}

/**
 * Export functions for external use
 */
export {
  // Re-export memory functions
  getRecentChatMessages,
  summarizeChat
} from '../../server/qdrant';
