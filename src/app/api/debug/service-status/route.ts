import { NextRequest, NextResponse } from 'next/server';
import { createConnection } from 'net';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const service = searchParams.get('service');
    const port = searchParams.get('port');

    if (!service || !port) {
      return NextResponse.json(
        { error: 'Missing service or port parameter' },
        { status: 400 }
      );
    }

    const portNumber = parseInt(port, 10);
    if (isNaN(portNumber)) {
      return NextResponse.json(
        { error: 'Invalid port number' },
        { status: 400 }
      );
    }

    // Check if the service is responding
    let checkUrl: string;

    switch (service) {
      case 'prisma':
        checkUrl = `http://localhost:${portNumber}/`;
        break;
      case 'qdrant':
        checkUrl = `http://localhost:${portNumber}/`;
        break;
      case 'fastserver':
        checkUrl = `http://localhost:${portNumber}/health`;
        break;
      default:
        checkUrl = `http://localhost:${portNumber}/`;
    }

    // For Prisma Studio, try a simple port check first since HTTP might not work
    if (service === 'prisma') {
      return new Promise<NextResponse>((resolve) => {
        const socket = createConnection(portNumber, 'localhost');

        socket.on('connect', () => {
          socket.end();
          console.log(`Prisma Studio port ${portNumber} is open`);
          resolve(NextResponse.json({
            online: true,
            service,
            port: portNumber,
            method: 'socket',
            url: checkUrl
          }));
        });

        socket.on('error', (error) => {
          console.error(`Prisma Studio port ${portNumber} connection failed:`, error.message);
          resolve(NextResponse.json({
            online: false,
            service,
            port: portNumber,
            error: 'connection_refused',
            message: error.message,
            method: 'socket',
            url: checkUrl
          }));
        });

        // Set a timeout for the socket connection
        setTimeout(() => {
          socket.destroy();
          console.error(`Prisma Studio port ${portNumber} connection timeout`);
          resolve(NextResponse.json({
            online: false,
            service,
            port: portNumber,
            error: 'timeout',
            message: 'Socket connection timeout',
            method: 'socket',
            url: checkUrl
          }));
        }, 3000);
      });
    }

    // For other services, use HTTP fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    try {
      console.log(`Checking service ${service} at ${checkUrl}`);

      const response = await fetch(checkUrl, {
        method: 'GET',
        signal: controller.signal,
        // Don't include mode: 'cors' for server-side requests
      });

      clearTimeout(timeoutId);

      console.log(`Service ${service} responded with status ${response.status}`);

      // Any response (even an error response) means the service is running
      return NextResponse.json({
        online: true,
        service,
        port: portNumber,
        status: response.status,
        statusText: response.statusText,
        method: 'http',
        url: checkUrl
      });

    } catch (fetchError) {
      clearTimeout(timeoutId);

      console.error(`Service ${service} check failed:`, fetchError);

      // Check if it's an abort error (timeout) or connection error
      const isTimeout = fetchError instanceof Error && fetchError.name === 'AbortError';
      const isConnectionError = fetchError instanceof Error &&
        (fetchError.message.includes('ECONNREFUSED') ||
          fetchError.message.includes('fetch failed') ||
          fetchError.message.includes('Failed to fetch'));

      return NextResponse.json({
        online: false,
        service,
        port: portNumber,
        error: isTimeout ? 'timeout' : isConnectionError ? 'connection_refused' : 'unknown',
        message: fetchError instanceof Error ? fetchError.message : 'Unknown error',
        method: 'http',
        url: checkUrl
      });
    }

  } catch (error) {
    console.error('Service status check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 