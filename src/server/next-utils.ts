import { createServer } from 'http';
import { NextApiRequest, NextApiResponse } from 'next';
import { parse } from 'url';
import next from 'next';
import { initializeWebSocketServer } from './websocket';

// Check if we're in development or production mode
const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Initialize the Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

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
  const server = await createCustomServer();
  
  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
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