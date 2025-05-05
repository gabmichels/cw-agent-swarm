import { NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../server/memory/services';

export const runtime = 'nodejs'; // Mark as server-side only
export const dynamic = 'force-dynamic'; // Prevent caching

/**
 * API endpoint to restart the memory system
 * This forces a complete reset of all memory service connections
 */
export async function POST() {
  try {
    // Get current memory services
    const { client, memoryService, searchService } = await getMemoryServices();
    
    // Force re-initialization
    if (client.isInitialized()) {
      // Force a reset of memory services
      await client.initialize();
      
      return NextResponse.json({
        success: true,
        message: 'Memory system restarted successfully',
        status: await client.getStatus()
      });
    } else {
      // Initialize if not already initialized
      await client.initialize();
      
      return NextResponse.json({
        success: true,
        message: 'Memory system initialized successfully',
        status: await client.getStatus()
      });
    }
  } catch (error) {
    console.error('Error restarting memory system:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 