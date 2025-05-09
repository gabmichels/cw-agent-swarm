/**
 * Server-side initialization module
 * This file is loaded on the server side only and initializes global singletons
 */

// Use top-level await for initialization
let initializationPromise: Promise<void> | null = null;

// Keep track of initialization state
let isInitialized = false;
let chloeInitAttempted = false;

/**
 * Initialize server-side components and singletons
 */
export async function initializeServer() {
  // Avoid multiple initialization
  if (isInitialized && initializationPromise) {
    console.log('Server is already initialized, skipping');
    return initializationPromise;
  }
  
  // Create and store the initialization promise
  initializationPromise = (async () => {
    try {
      console.log('Starting server initialization...');
      
      // Skip on client side
      if (typeof window !== 'undefined') {
        console.log('Skipping server initialization on client');
        return;
      }
      
      // Use a flag to track Chloe initialization attempts within this process
      if (!chloeInitAttempted) {
        console.log('Initializing Chloe agent (first attempt)...');
        chloeInitAttempted = true; // Set flag before initialization
        
        try {
          // Check if global Chloe instance already exists
          if (global.chloeAgent) {
            console.log('Chloe agent already exists in global scope, skipping initialization');
          } else {
            // Check if we should initialize the default agent
            console.log('Initializing default agent...');
            
            try {
              // Import AgentService dynamically to ensure it only runs on server
              const { AgentService } = await import('../services/AgentService');
              
              // Get or create the default agent (currently 'chloe')
              const agent = await AgentService.getDefaultAgent();
              
              if (agent && !agent.initialized && typeof agent.initialize === 'function') {
                await agent.initialize();
                console.log('Default agent initialized successfully');
              } else {
                console.log('Default agent already initialized or not available');
              }
            } catch (error) {
              console.error('Error initializing default agent:', error);
            }
          }
        } catch (error) {
          console.error('Error initializing Chloe agent:', error);
        }
      } else {
        console.log('Skipping Chloe initialization - already attempted in this process');
      }
      
      console.log('Server initialization complete');
      isInitialized = true;
    } catch (error) {
      console.error('Error during server initialization:', error);
      // Reset initialization promise on error
      initializationPromise = null;
      throw error;
    }
  })();
  
  // Wait for initialization to complete
  await initializationPromise;
}

// Automatically initialize on module import in server environments
if (typeof window === 'undefined') {
  console.log('Auto-initializing server components...');
  initializeServer().catch(err => {
    console.error('Failed to auto-initialize server:', err);
  });
} 