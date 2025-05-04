import { NextRequest, NextResponse } from 'next/server';
import * as serverQdrant from '../../../../server/qdrant';

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
    
    // Initialize Qdrant memory
    await serverQdrant.initMemory({
      useOpenAI: process.env.USE_OPENAI_EMBEDDINGS === 'true'
    });
    
    // Get memory history
    const historyOptions = {
      includeContent: true,
      limit: 20,
      includeSoftDeleted: true
    };
    
    console.log(`[memory/history] Fetching history for memory ID: ${memoryId}`);
    
    const history = await serverQdrant.getMemoryHistory(memoryId, historyOptions);
    
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