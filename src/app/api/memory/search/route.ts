import { NextRequest, NextResponse } from 'next/server';
import * as serverQdrant from '../../../../server/qdrant';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * API endpoint to search for a memory by ID or content
 * @param request NextRequest with search parameters
 * @returns Array of matching memories
 */
export async function GET(request: NextRequest) {
  try {
    // Get search parameters
    const searchParams = request.nextUrl.searchParams;
    const memoryId = searchParams.get('id');
    const query = searchParams.get('query') || '';
    const type = searchParams.get('type') as any;
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    
    console.log(`[memory/search] Request params: id=${memoryId}, query=${query}, type=${type}, limit=${limit}`);
    
    // Initialize memory if needed
    await serverQdrant.initMemory({
      useOpenAI: process.env.USE_OPENAI_EMBEDDINGS === 'true'
    });
    
    // If a specific ID is provided, try to retrieve that memory directly
    if (memoryId) {
      try {
        console.log(`[memory/search] Searching for memory by ID: ${memoryId}`);
        // For ID-based search, use a broader approach
        const memories = await serverQdrant.searchMemory(null, "", {
          filter: { id: memoryId },
          limit: 1
        });
        
        if (!memories || memories.length === 0) {
          console.warn(`[memory/search] Memory ID ${memoryId} not found`);
          // Return diagnostic error info in memory format for consistent handling
          return NextResponse.json([{
            id: 'memory_not_found',
            text: `Memory with ID ${memoryId} not found`,
            timestamp: new Date().toISOString(),
            type: memoryId.startsWith('memory_') ? 'memory_edits' : 'message',
            metadata: { 
              error: true,
              requested_id: memoryId,
              explanation: 'The requested memory ID was not found in any collection'
            }
          }]);
        }
        
        console.log(`[memory/search] Found memory: ${memories[0].id} (${memories[0].type})`);
        return NextResponse.json(memories);
      } catch (idError) {
        console.error(`[memory/search] Error retrieving memory by ID ${memoryId}:`, idError);
        // Return error in memory format for consistent handling
        return NextResponse.json([{
          id: 'search_error',
          text: `Error retrieving memory: ${idError instanceof Error ? idError.message : 'Unknown error'}`,
          timestamp: new Date().toISOString(),
          type: "error",
          metadata: { 
            error: true,
            requested_id: memoryId,
            raw_error: idError instanceof Error ? idError.stack : String(idError)
          }
        }]);
      }
    }
    
    // Otherwise, perform a semantic search based on query
    const memories = await serverQdrant.searchMemory(type, query, { limit });
    
    // Return the search results
    return NextResponse.json(memories);
  } catch (error) {
    console.error('Error in memory search:', error);
    
    // Return error as a memory item
    return NextResponse.json([{
      id: 'api_error',
      text: `API Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date().toISOString(),
      type: "error",
      metadata: { 
        error: true, 
        api: 'memory/search',
        raw_error: error instanceof Error ? error.stack : String(error)
      }
    }], { status: 200 }); // Use 200 to avoid frontend error handling issues
  }
} 