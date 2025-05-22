/**
 * Agent Bootstrap System
 * 
 * This module handles bootstrapping agents when the Next.js application starts.
 * It is imported by server-init.ts and runs only on the server.
 */

import { createLogger, configureLogger } from './logging/winston-logger';

// Verify we're running on the server
const isServer = typeof window === 'undefined';

// Configuration
const serverConfig = {
  debug: {
    enabled: isServer && process.env.AGENT_DEBUG_MODE === 'true',
    level: process.env.DEBUG_LEVEL || 'info'
  },
  agents: {
    autoBootstrap: isServer && process.env.AGENT_AUTO_BOOTSTRAP !== 'false', // Default to true
    loadFromDatabase: isServer && process.env.AGENT_LOAD_FROM_DB !== 'false'  // Default to true
  }
};

// Track initialization state
let isBooting = false;
let isBootstrapped = false;
let bootstrapPromise: Promise<void> | null = null;

// Create a logger for the bootstrap process
const bootstrapLogger = createLogger({ moduleId: 'agent-bootstrap' });

/**
 * Set up enhanced debugging if enabled
 */
function setupDebugMode() {
  // Only run on server
  if (!isServer) {
    return;
  }
  
  // Set debug environment variables
  process.env.DEBUG_LEVEL = serverConfig.debug.level;
  process.env.AGENT_DEBUG = 'true';
  process.env.AUTONOMY_DEBUG = 'true';
  process.env.CONSOLE_LOG_LEVEL = 'debug';
  process.env.NODE_DEBUG = 'agent,autonomy,task,web-search';
  process.env.LOG_LEVEL = 'debug';
  
  // Configure logger for debug level
  configureLogger({
    level: 'debug',
    enableColors: true,
    enableConsole: true
  });
  
  bootstrapLogger.info('==================================================');
  bootstrapLogger.info('🔍 ENHANCED DEBUG MODE ENABLED 🔍');
  bootstrapLogger.info('- All agent actions will be logged in detail');
  bootstrapLogger.info('- Debug level logging is enabled system-wide');
  bootstrapLogger.info('==================================================');
}

/**
 * Bootstrap all agent systems
 */
export async function bootstrapAgents(): Promise<void> {
  // Skip on client side
  if (!isServer) {
    return;
  }
  
  // Return existing promise if already bootstrapping
  if (bootstrapPromise) {
    return bootstrapPromise;
  }
  
  // Return immediately if already bootstrapped
  if (isBootstrapped) {
    bootstrapLogger.info('Agents already bootstrapped, skipping');
    return;
  }
  
  // Prevent concurrent bootstrapping
  if (isBooting) {
    bootstrapLogger.info('Bootstrap already in progress, waiting...');
    return new Promise((resolve) => {
      // Check every 100ms if bootstrapping is complete
      const checkInterval = setInterval(() => {
        if (isBootstrapped) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }
  
  // Start bootstrapping
  isBooting = true;
  
  // Create and store the bootstrap promise
  bootstrapPromise = (async () => {
    try {
      bootstrapLogger.info('🔄 Starting agent bootstrap process...');
      
      // Set up debug mode if enabled
      if (serverConfig.debug.enabled) {
        setupDebugMode();
      }
      
      // Skip if auto-bootstrap is disabled
      if (!serverConfig.agents.autoBootstrap) {
        bootstrapLogger.info('⏭️ Agent auto-bootstrapping is disabled. Skipping.');
        return;
      }
      
      bootstrapLogger.info('🚀 Starting to bootstrap agents...');
      
      // Dynamically import bootstrapping functions to handle missing dependencies gracefully
      try {
        // Only load from database if configured to do so
        let agentCount = 0;
        if (serverConfig.agents.loadFromDatabase) {
          bootstrapLogger.info('Loading agents from database...');
          const { bootstrapAgentsFromDatabase } = await import('../server/agent/bootstrap-agents');
          agentCount = await bootstrapAgentsFromDatabase();
          bootstrapLogger.info(`> Bootstrapped ${agentCount} agents from database into runtime registry`);
        }
        
        // Now bootstrap the MCP with these agents
        bootstrapLogger.info('🚀 Starting to bootstrap MCP agent system...');
        const { bootstrapAgentSystem } = await import('../agents/mcp/bootstrapAgents');
        await bootstrapAgentSystem();
        bootstrapLogger.info(`> MCP agent system bootstrapped and integrated with agents`);
        bootstrapLogger.info('- Bootstrap status: Complete ✅');
      } catch (importError) {
        bootstrapLogger.error('Failed to import bootstrap dependencies:', { error: importError });
        bootstrapLogger.info('This may be due to missing optional dependencies like zlib-sync for Discord integration.');
        bootstrapLogger.info('You can install it by running: npm install zlib-sync');
        bootstrapLogger.info('- Bootstrap status: Partial ⚠️');
      }
      
      // Mark as bootstrapped even if there were some errors
      // This prevents bootstrap from being stuck in a failed state
      isBootstrapped = true;
    } catch (error) {
      bootstrapLogger.error('Failed to bootstrap agents:', { error });
      bootstrapLogger.info('- Bootstrap status: Failed ❌');
    } finally {
      isBooting = false;
    }
  })();
  
  return bootstrapPromise;
}

// If not in browser environment, auto-initialize the logger
if (isServer) {
  configureLogger({
    level: process.env.LOG_LEVEL || 'info',
    enableColors: true,
    enableConsole: true
  });
}

// Export configuration for other modules
export const agentConfig = serverConfig; 