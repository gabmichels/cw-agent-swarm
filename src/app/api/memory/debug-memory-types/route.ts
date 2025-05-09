import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../server/memory/services';
import { MemoryType } from '../../../../server/memory/config';
import { BaseMetadata } from '../../../../types/metadata';

export const runtime = 'nodejs';

// Extended metadata interface for debug information
interface ExtendedDebugMetadata extends BaseMetadata {
  type?: string;
  category?: string;
}

/**
 * API endpoint to provide detailed debugging information about memory types
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[debug-memory-types] Starting memory type analysis');
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 100;
    
    // Initialize memory services
    const { client, memoryService, searchService } = await getMemoryServices();
    
    // Ensure memory system is initialized
    const status = await client.getStatus();
    if (!status.initialized) {
      await client.initialize();
    }
    
    // Define collection types to check
    const collections = {
      [MemoryType.MESSAGE]: 'messages',
      [MemoryType.THOUGHT]: 'thoughts',
      [MemoryType.DOCUMENT]: 'documents',
      [MemoryType.TASK]: 'tasks', 
      [MemoryType.MEMORY_EDIT]: 'memory_edits'
    };
    
    // Store results by collection
    const results: Record<string, any> = {
      timestamp: new Date().toISOString(),
      collectionCounts: {},
      typeDistribution: {},
      samples: {},
      totalMemories: 0
    };
    
    // Check each collection
    let totalMemoryCount = 0;
    
    for (const [type, collectionName] of Object.entries(collections)) {
      try {
        console.log(`[debug-memory-types] Analyzing collection: ${collectionName}`);
        
        // Fetch memories from this collection
        const searchResults = await searchService.search('', { 
          limit: limit > 100 ? 100 : limit,
          types: [type as MemoryType]
        });
        
        // Count memories in this collection
        const count = searchResults.length;
        totalMemoryCount += count;
        results.collectionCounts[collectionName] = count;
        
        // Analyze memory types within this collection
        const typeDistribution: Record<string, number> = {};
        const samples: Array<any> = [];
        
        searchResults.forEach((searchResult, index) => {
          const memory = searchResult.point;
          // Cast metadata to extended type for accessing custom fields
          const metadata = memory.payload?.metadata as ExtendedDebugMetadata || {};
          
          const memoryType = searchResult.type || 
                           metadata.type || 
                           metadata.category || 
                           'unknown';
          
          // Count this type
          typeDistribution[memoryType] = (typeDistribution[memoryType] || 0) + 1;
          
          // Store samples of the first few memories
          if (index < 3) {
            samples.push({
              id: memory.id,
              type: memoryType,
              timestamp: memory.payload?.timestamp || metadata.timestamp,
              contentPreview: memory.payload?.text ? memory.payload.text.substring(0, 100) + '...' : 'No content',
              metadata: Object.keys(memory.payload?.metadata || {})
            });
          }
        });
        
        // Store results for this collection
        results.typeDistribution[collectionName] = typeDistribution;
        results.samples[collectionName] = samples;
        
        console.log(`[debug-memory-types] Found ${count} memories in ${collectionName}`);
      } catch (error) {
        console.error(`[debug-memory-types] Error analyzing collection ${collectionName}:`, error);
        results.collectionCounts[collectionName] = 'error';
      }
    }
    
    // Store the total count
    results.totalMemories = totalMemoryCount;
    
    // Try to get all memories across all types
    try {
      console.log('[debug-memory-types] Testing search across all memory types');
      
      // Search across all memory types
      const allMemoryResults = await searchService.search('', { limit });
      
      // Count type distribution across all memories
      const overallTypeDistribution: Record<string, number> = {};
      
      allMemoryResults.forEach(searchResult => {
        // Cast metadata to extended type
        const metadata = searchResult.point.payload?.metadata as ExtendedDebugMetadata || {};
        
        const memoryType = searchResult.type || 
                         metadata.type || 
                         metadata.category || 
                         'unknown';
        
        overallTypeDistribution[memoryType] = (overallTypeDistribution[memoryType] || 0) + 1;
      });
      
      results.allMemories = {
        count: allMemoryResults.length,
        typeDistribution: overallTypeDistribution
      };
      
      console.log(`[debug-memory-types] Search returned ${allMemoryResults.length} memories across all types`);
    } catch (error) {
      console.error('[debug-memory-types] Error searching across all types:', error);
      results.allMemories = { error: error instanceof Error ? error.message : String(error) };
    }
    
    return NextResponse.json(results);
  } catch (error) {
    console.error('Error in debug-memory-types:', error);
    return NextResponse.json(
      { 
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 