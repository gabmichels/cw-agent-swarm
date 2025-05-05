import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../server/memory/services';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * API endpoint to get the version history of a memory
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[memory/history] Starting history fetch');
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const memoryId = searchParams.get('id');
    
    if (!memoryId) {
      return NextResponse.json(
        { error: 'Memory ID is required' },
        { status: 400 }
      );
    }
    
    // Get memory services
    const { client, memoryService } = await getMemoryServices();
    
    // Initialize memory services if needed
    const status = await client.getStatus();
    if (!status.initialized) {
      console.log('[memory/history] Initializing memory services');
      await client.initialize();
    }
    
    // Get memory history
    const historyOptions = {
      limit: 20
    };
    
    console.log(`[memory/history] Fetching history for memory ID: ${memoryId}`);
    
    // Use the memory service to get memory history
    const history = await memoryService.getMemoryHistory({
      id: memoryId,
      limit: historyOptions.limit
    });
    
    if (!history || history.length === 0) {
      console.log(`[memory/history] No history found for memory ID: ${memoryId}`);
      return NextResponse.json([]);
    }
    
    console.log(`[memory/history] Found ${history.length} versions for memory ID: ${memoryId}`);
    
    // Format and return the history items
    return NextResponse.json(history);
  } catch (error) {
    console.error('Error getting memory history:', error);
    return NextResponse.json(
      { 
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 