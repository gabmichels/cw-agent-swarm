/**
 * This file has been deprecated after removing the Chloe agent system.
 * It's kept here for reference but all functionality has been disabled.
 * See docs/refactoring/architecture/IMPLEMENTATION_GUIDELINES.md for more information.
 */

// Stub implementation until the file is completely removed
export async function getGlobalChloeAgent(): Promise<any> {
  console.warn('getGlobalChloeAgent() is deprecated - Chloe agent system has been removed');
  return { initialized: false };
}

export async function scheduleChloeTask(task: string, options?: any): Promise<any> {
  console.warn('scheduleChloeTask() is deprecated - Chloe agent system has been removed');
  return { status: 'unavailable', message: 'Chloe system has been removed' };
}

/*
// Original implementation - kept for reference
// Singleton instance
import { ChloeAgent, initializeChloeAutonomy } from '../../agents/chloe';
let globalChloeAgent: ChloeAgent | null = null;
let autonomyInitialized = false;

export async function getGlobalChloeAgent(): Promise<ChloeAgent> {
  if (!globalChloeAgent) {
    console.log('Creating global Chloe agent instance...');
    globalChloeAgent = new ChloeAgent();
    await globalChloeAgent.initialize();
    console.log('Global Chloe agent initialized');
  }

  if (!autonomyInitialized) {
    console.log('Initializing autonomy system...');
    try {
      const result = await initializeChloeAutonomy(globalChloeAgent);
      autonomyInitialized = result.status === 'success';
      console.log(`Autonomy system initialization: ${result.status}`);
      
      // If autonomy failed to initialize but Chloe is available, attempt to manually setup scheduler
      if (result.status !== 'success' && globalChloeAgent) {
        console.log('Attempting manual scheduler initialization...');
        const { setupScheduler, ChloeScheduler, setupDefaultSchedule } = await import('../../agents/chloe/scheduler');
        
        try {
          const scheduler = new ChloeScheduler(globalChloeAgent);
          setupDefaultSchedule(scheduler);
          scheduler.setAutonomyMode(true);
          const tasks = setupScheduler(globalChloeAgent);
          tasks.start();
          console.log('Manual scheduler initialization successful');
          autonomyInitialized = true;
        } catch (schedulerError) {
          console.error('Manual scheduler initialization failed:', schedulerError);
        }
      }
    } catch (error) {
      console.error('Failed to initialize autonomy system:', error);
    }
  }
  
  return globalChloeAgent;
}

export async function scheduleChloeTask(task: string, options?: any): Promise<any> {
  const chloe = await getGlobalChloeAgent();
  return chloe.scheduleTask(task, options);
}
*/ 