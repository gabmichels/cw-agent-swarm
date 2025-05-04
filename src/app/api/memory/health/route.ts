/**
 * API route for memory system health check
 */
import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../server/memory/services';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET handler for memory system health check
 */
export async function GET(request: NextRequest) {
  try {
    // Initialize services
    const { client, memoryService, searchService } = await getMemoryServices();
    
    // Check client status
    const clientStatus = await client.getStatus();
    
    // Perform a simple search to test the system
    const testResults = await searchService.search('health check', { limit: 1 });
    
    // Calculate uptime information
    const now = Date.now();
    const startTime = process.uptime() * 1000;
    const uptimeMs = now - startTime;
    
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: {
        ms: uptimeMs,
        seconds: Math.floor(uptimeMs / 1000),
        minutes: Math.floor(uptimeMs / (1000 * 60)),
        hours: Math.floor(uptimeMs / (1000 * 60 * 60)),
        days: Math.floor(uptimeMs / (1000 * 60 * 60 * 24))
      },
      client: {
        status: clientStatus.connected ? 'connected' : 'disconnected',
        initialized: clientStatus.initialized,
        collections: clientStatus.collectionsReady || [],
        fallback: clientStatus.usingFallback
      },
      search: {
        operational: testResults !== null
      }
    });
  } catch (error) {
    console.error('Error checking memory system health:', error);
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 