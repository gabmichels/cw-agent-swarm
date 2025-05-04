import { NextRequest, NextResponse } from 'next/server';
import * as serverQdrant from '../../../../server/qdrant';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Define a type for memory search results
interface MemorySearchResult {
  id: string;
  type: string;
  content: string;
  timestamp: string;
  metadata: Record<string, any>;
}

/**
 * API endpoint to search for memory items by ID or query
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[memory/search] Starting memory search');
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const memoryId = searchParams.get('id');
    const query = searchParams.get('query');
    const collectionType = searchParams.get('collection') as any;
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    
    if (!memoryId && !query) {
      return NextResponse.json(
        { error: 'Either memory ID or search query is required' },
        { status: 400 }
      );
    }
    
    // Initialize Qdrant memory
    await serverQdrant.initMemory({
      useOpenAI: process.env.USE_OPENAI_EMBEDDINGS === 'true'
    });
    
    let results: MemorySearchResult[] = [];
    
    // If ID is provided, search by ID directly
    if (memoryId) {
      console.log(`[memory/search] Searching for memory with ID: ${memoryId}`);
      try {
        // Use searchMemory with a filter to find by exact ID
        const memories = await serverQdrant.searchMemory(
          null, // search across all collections
          "", // empty query for ID-based search
          {
            filter: { id: memoryId },
            limit: 1
          }
        );
        
        if (memories && memories.length > 0) {
          const memory = memories[0];
          // Format the memory item
          const formattedMemory: MemorySearchResult = {
            id: memory.id,
            type: memory.type,
            content: memory.text,
            timestamp: memory.timestamp,
            metadata: memory.metadata || {}
          };
          
          results = [formattedMemory];
        }
      } catch (idError) {
        console.error(`Error getting memory by ID ${memoryId}:`, idError);
        
        // Return an error result in the expected format
        return NextResponse.json([{
          id: memoryId,
          type: 'error',
          content: `Error retrieving memory: ${idError instanceof Error ? idError.message : 'Unknown error'}`,
          timestamp: new Date().toISOString(),
          metadata: { error: true }
        }]);
      }
    } 
    // Otherwise use semantic search
    else if (query) {
      console.log(`[memory/search] Semantic search for: "${query}"`);
      
      // Create search options
      const searchOptions = {
        limit,
        collection: collectionType // Will search all collections if null
      };
      
      const searchResults = await serverQdrant.searchMemory(collectionType, query, searchOptions);
      
      // Format results
      results = searchResults.map(item => ({
        id: item.id,
        type: item.type,
        content: item.text,
        timestamp: item.timestamp,
        metadata: item.metadata || {}
      }));
    }
    
    console.log(`[memory/search] Found ${results.length} results`);
    return NextResponse.json(results);
  } catch (error) {
    console.error('Error in memory search:', error);
    return NextResponse.json(
      { 
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 