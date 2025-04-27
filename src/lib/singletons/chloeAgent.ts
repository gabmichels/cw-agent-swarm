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
    } catch (error) {
      console.error('Failed to initialize autonomy system:', error);
    }
  }
  
  return globalChloeAgent;
}

// Initialize immediately on server start
getGlobalChloeAgent().catch(err => {
  console.error('Error initializing global Chloe agent:', err);
}); 