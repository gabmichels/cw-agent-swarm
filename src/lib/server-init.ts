/**
 * Server-side initialization module
 * This file is loaded on the server side only and initializes global singletons
 */

// Use top-level await for initialization
let initializationPromise: Promise<void> | null = null;

// Keep track of initialization state
let isInitialized = false;

/**
 * Initialize server-side components and singletons
 */
export async function initializeServer() {
  // Avoid multiple initialization
  if (isInitialized) {
    console.log('Server already initialized, skipping duplicate initialization');
    return;
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    console.log('Server initialization already in progress, waiting for completion');
    await initializationPromise;
    return;
  }

  // Set up initialization promise
  initializationPromise = (async () => {
    try {
      console.log('Starting server initialization...');
      
      // Skip on client side
      if (typeof window !== 'undefined') {
        console.log('Skipping server initialization on client');
        return;
      }
      
      console.log('Initializing Chloe agent...');
      try {
        // Dynamic import to ensure it only runs on server
        const { getChloeInstance } = await import('../agents/chloe');
        const chloe = await getChloeInstance();
        
        if (chloe && !chloe.initialized && typeof chloe.initialize === 'function') {
          await chloe.initialize();
          console.log('Chloe agent initialized successfully');
        } else {
          console.log('Chloe agent already initialized or not available');
        }
      } catch (error) {
        console.error('Error initializing Chloe agent:', error);
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

// Automatically initialize on module import
if (typeof window === 'undefined') {
  console.log('Auto-initializing server components...');
  initializeServer().catch(err => {
    console.error('Failed to auto-initialize server:', err);
  });
} 