import { createServer } from 'http';
import { NextApiRequest, NextApiResponse } from 'next';
import { parse } from 'url';
import next from 'next';
import { initializeWebSocketServer } from './websocket';
import { bootstrapAgentsFromDatabase } from './agent/bootstrap-agents';
import { bootstrapAgentSystem } from '../agents/mcp/bootstrapAgents';

// Check if we're in development or production mode
const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Log startup settings
console.log('🔄 Starting server with configuration:');
console.log(`- Development mode: ${dev}`);
console.log(`- Hostname: ${hostname}`);
console.log(`- Port: ${port}`);
console.log('- Bootstrap status: Pending');

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
      console.error('Error occurred handling request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });
  
  // Initialize WebSocket server with the HTTP server
  initializeWebSocketServer(server);
  
  return server;
}

/**
 * Start the server and listen on the specified port
 */
export async function startServer() {
  console.log('⚙️ Starting server with WebSocket support...');
  const server = await createCustomServer();
  
  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log('🔄 Beginning agent bootstrap process...');
  });
  
  // Bootstrap agents from database into runtime registry
  try {
    console.log('🚀 Starting to bootstrap agents from database...');
    const agentCount = await bootstrapAgentsFromDatabase();
    console.log(`> Bootstrapped ${agentCount} agents from database into runtime registry`);
    
    // Now bootstrap the MCP with these agents
    console.log('🚀 Starting to bootstrap MCP agent system...');
    await bootstrapAgentSystem();
    console.log(`> MCP agent system bootstrapped and integrated with database agents`);
    console.log('- Bootstrap status: Complete');
  } catch (error) {
    console.error('Failed to bootstrap agents:', error);
    console.log('- Bootstrap status: Failed');
  }
  
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