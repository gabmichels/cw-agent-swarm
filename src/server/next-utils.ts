import { createServer } from 'http';
import { NextApiRequest, NextApiResponse } from 'next';
import { parse } from 'url';
import next from 'next';
import { initializeWebSocketServer } from './websocket';
import { bootstrapAgentsFromDatabase } from './agent/bootstrap-agents';
import { bootstrapAgentSystem } from '../agents/mcp/bootstrapAgents';
import { logger, createLogger, setLogLevel, configureLogger, LogLevel } from '../lib/logging/winston-logger';
import serverConfig from './config';

// Configure the default logger
configureLogger({
  level: process.env.LOG_LEVEL || 'info',
  enableColors: true,
  enableConsole: true
});

// Check if we're in development or production mode
const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Create a logger for the server
const serverLogger = createLogger({ moduleId: 'next-server' });

// Log startup settings
serverLogger.info('🔄 Starting server with configuration:');
serverLogger.info(`- Development mode: ${dev}`);
serverLogger.info(`- Hostname: ${hostname}`);
serverLogger.info(`- Port: ${port}`);
serverLogger.info(`- Debug mode: ${serverConfig.debug.enabled ? 'Enabled' : 'Disabled'}`);
serverLogger.info(`- Auto bootstrap: ${serverConfig.agents.autoBootstrap ? 'Enabled' : 'Disabled'}`);
serverLogger.info('- Bootstrap status: Pending');

// Define proper Next.js app interface
interface NextAppOptions {
  dev?: boolean;
  hostname?: string;
  port?: number;
}

interface NextRequestHandler {
  (req: any, res: any, parsedUrl?: any): Promise<void>;
}

interface NextApp {
  prepare(): Promise<void>;
  getRequestHandler(): NextRequestHandler;
}

/**
 * Set up enhanced debugging if debug mode is requested
 */
function setupDebugMode() {
  // Create a dedicated logger for this bootstrap process
  const debugLogger = createLogger({ moduleId: 'debug-mode' });
  
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
  
  debugLogger.info('==================================================');
  debugLogger.info('🔍 ENHANCED DEBUG MODE ENABLED 🔍');
  debugLogger.info('- All agent actions will be logged in detail');
  debugLogger.info('- Debug level logging is enabled system-wide');
  debugLogger.info('==================================================');
  
  return debugLogger;
}

// Initialize the Next.js app with appropriate type casting
// @ts-ignore - We're handling the type incompatibility with our custom interface
const app: NextApp = next({ dev, hostname, port });
// @ts-ignore - Using our interface definition
const handle: NextRequestHandler = app.getRequestHandler();

/**
 * Create a custom HTTP server with WebSocket support
 */
export async function createCustomServer() {
  await app.prepare();
  
  // Create HTTP server
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url || '/', true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      serverLogger.error('Error occurred handling request:', { error: err });
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });
  
  // Initialize WebSocket server with the HTTP server
  initializeWebSocketServer(server);
  
  return server;
}

/**
 * Bootstrap all agent systems
 */
async function bootstrapAgents() {
  if (!serverConfig.agents.autoBootstrap) {
    serverLogger.info('⏭️ Agent auto-bootstrapping is disabled. Skipping.');
    return;
  }
  
  try {
    serverLogger.info('🚀 Starting to bootstrap agents from database...');
    
    // Only load from database if configured to do so
    let agentCount = 0;
    if (serverConfig.agents.loadFromDatabase) {
      agentCount = await bootstrapAgentsFromDatabase();
      serverLogger.info(`> Bootstrapped ${agentCount} agents from database into runtime registry`);
    }
    
    // Now bootstrap the MCP with these agents
    serverLogger.info('🚀 Starting to bootstrap MCP agent system...');
    await bootstrapAgentSystem();
    serverLogger.info(`> MCP agent system bootstrapped and integrated with agents`);
    serverLogger.info('- Bootstrap status: Complete');
  } catch (error) {
    serverLogger.error('Failed to bootstrap agents:', { error });
    serverLogger.info('- Bootstrap status: Failed');
  }
}

/**
 * Start the server and listen on the specified port
 */
export async function startServer() {
  // Check if debug mode is enabled from config
  const debugMode = serverConfig.debug.enabled;
  
  if (debugMode) {
    const debugLogger = setupDebugMode();
    debugLogger.info('Starting server with enhanced debugging capabilities...');
  }
  
  serverLogger.info('⚙️ Starting server with WebSocket support...');
  const server = await createCustomServer();
  
  server.listen(port, async () => {
    serverLogger.info(`> Ready on http://${hostname}:${port}`);
    serverLogger.info('🔄 Beginning agent bootstrap process...');
    
    // Bootstrap agents after server is ready
    await bootstrapAgents();
  });
  
  return server;
}

/**
 * Run the Next.js API route handler with proper typing
 */
export function runApiHandler(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  req: NextApiRequest,
  res: NextApiResponse
) {
  return handler(req, res);
} 