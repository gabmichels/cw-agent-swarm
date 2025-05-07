import { ChloeAgent, initializeChloeAutonomy } from '../../agents/chloe';

// Singleton instance
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

// Remove automatic initialization on import
// getGlobalChloeAgent().catch(err => {
//   console.error('Error initializing global Chloe agent:', err);
// }); 