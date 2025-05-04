import { NextRequest, NextResponse } from 'next/server';
import * as serverQdrant from '../../../../server/qdrant';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * API endpoint to retrieve the history of a memory item
 * @param request NextRequest with memoryId as query param
 * @returns Array of memory edit records in chronological order
 */
export async function GET(request: NextRequest) {
  try {
    // Get memory ID from query parameter
    const searchParams = request.nextUrl.searchParams;
    const memoryId = searchParams.get('id');
    
    if (!memoryId) {
      return NextResponse.json({
        success: false,
        message: 'Missing required parameter: id',
      }, { status: 400 });
    }
    
    // Get options from query parameters (all optional)
    const includeContent = searchParams.get('includeContent') !== 'false'; // Default true
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const includeSoftDeleted = searchParams.get('includeSoftDeleted') !== 'false'; // Default true
    
    console.log(`[memory/history] Fetching history for memory ID: ${memoryId}, includeContent: ${includeContent}, limit: ${limit}, includeSoftDeleted: ${includeSoftDeleted}`);
    
    // Initialize memory if needed
    await serverQdrant.initMemory({
      useOpenAI: process.env.USE_OPENAI_EMBEDDINGS === 'true'
    });
    
    // Retrieve memory history
    try {
      const history = await serverQdrant.getMemoryHistory(memoryId, {
        includeContent,
        limit,
        includeSoftDeleted
      });
      
      console.log(`[memory/history] Found ${history.length} history entries for memory ID: ${memoryId}`);
      
      if (history.length === 0) {
        // Return empty array with diagnostic info
        return NextResponse.json([{
          id: 'memory_history_empty',
          text: `No history found for memory ID: ${memoryId}`,
          timestamp: new Date().toISOString(),
          type: "memory_edits",
          metadata: { diagnostic: true },
          original_memory_id: memoryId,
          edit_type: 'info',
          editor_type: 'system',
          diff_summary: 'No history entries found',
          current: false
        }]);
      }
      
      // Return the memory history
      return NextResponse.json(history);
    } catch (historyError) {
      console.error(`Error retrieving memory history for ID ${memoryId}:`, historyError);
      
      // Return error as a properly formatted history item
      return NextResponse.json([{
        id: 'memory_history_error',
        text: `Error retrieving history: ${historyError instanceof Error ? historyError.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
        type: "memory_edits",
        metadata: { error: true },
        original_memory_id: memoryId,
        edit_type: 'error',
        editor_type: 'system',
        diff_summary: 'Error retrieving history',
        current: false
      }]);
    }
  } catch (error) {
    console.error('Error in memory history API:', error);
    
    // Return error as a history item to ensure consistent UI handling
    return NextResponse.json([{
      id: 'api_error',
      text: `API Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date().toISOString(),
      type: "memory_edits",
      metadata: { error: true },
      original_memory_id: 'unknown',
      edit_type: 'error',
      editor_type: 'system',
      diff_summary: 'API error occurred',
      current: false
    }], { status: 200 }); // Use 200 to avoid frontend error handling
  }
} 