/**
 * Server-side initialization module
 * This file is loaded on the server side only and initializes global singletons
 */

// Import agent bootstrap system
import { bootstrapAgents } from './agent-bootstrap';
import { createLogger } from './logging/winston-logger';

// Create a logger for server initialization
const serverLogger = createLogger({ moduleId: 'server-init' });

// Add type declaration for global
declare global {
  var chloeAgent: unknown;
}

// Use top-level await for initialization
let initializationPromise: Promise<void> | null = null;

// Keep track of initialization state
let isInitialized = false;
let agentInitAttempted = false;

/**
 * Initialize server-side components and singletons
 */
export async function initializeServer() {
  // Avoid multiple initialization
  if (isInitialized && initializationPromise) {
    serverLogger.info('Server is already initialized, skipping');
    return initializationPromise;
  }
  
  // Create and store the initialization promise
  initializationPromise = (async () => {
    try {
      serverLogger.info('Starting server initialization...');
      
      // Skip on client side
      if (typeof window !== 'undefined') {
        serverLogger.info('Skipping server initialization on client');
        return;
      }
      
      // Bootstrap agent system - this will handle all agents and MCP
      try {
        await bootstrapAgents();
        serverLogger.info('Agent bootstrap completed successfully');
      } catch (bootstrapError) {
        serverLogger.error('Agent bootstrap encountered errors, continuing with partial initialization', { 
          error: bootstrapError 
        });
        // Continue with initialization even if bootstrap fails
      }
      
      // Use a flag to track agent initialization attempts within this process
      if (!agentInitAttempted) {
        serverLogger.info('Initializing default agent (first attempt)...');
        agentInitAttempted = true; // Set flag before initialization
        
        try {
          // Check if global agent already exists
          if (global.chloeAgent) {
            serverLogger.info('Agent already exists in global scope, skipping initialization');
          } else {
            // Check if we should initialize the default agent
            serverLogger.info('Looking for available agents...');
            
            try {
              // Import AgentService dynamically to ensure it only runs on server
              const { AgentService } = await import('../services/AgentService');
              
              // Get the default agent (will be the first available one)
              const agent = await AgentService.getDefaultAgent();
              
              if (agent) {
                serverLogger.info(`Found agent: ${agent.name || agent.id}`);
                if (!agent.initialized && typeof agent.initialize === 'function') {
                  await agent.initialize();
                  serverLogger.info('Default agent initialized successfully');
                } else {
                  serverLogger.info('Default agent already initialized or initialization not needed');
                }
              } else {
                serverLogger.info('No agents available for initialization');
              }
            } catch (error) {
              serverLogger.error('Error finding or initializing default agent:', { error });
            }
          }
        } catch (error) {
          serverLogger.error('Error during agent initialization process:', { error });
        }
      } else {
        serverLogger.info('Skipping agent initialization - already attempted in this process');
      }
      
      serverLogger.info('Server initialization complete');
      isInitialized = true;
    } catch (error) {
      serverLogger.error('Error during server initialization:', { error });
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
  serverLogger.info('Auto-initializing server components...');
  initializeServer().catch(err => {
    serverLogger.error('Failed to auto-initialize server:', { error: err });
  });
}

// Remove chloe agent from global scope
if (typeof global !== 'undefined') {
  if ('chloeAgent' in global) {
    delete global.chloeAgent;
  }
} 