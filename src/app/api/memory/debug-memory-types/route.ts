import { NextRequest, NextResponse } from 'next/server';
import * as serverQdrant from '../../../../server/qdrant';

export const runtime = 'nodejs';

/**
 * API endpoint to provide detailed debugging information about memory types
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[debug-memory-types] Starting memory type analysis');
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 100;
    
    // Initialize Qdrant memory
    await serverQdrant.initMemory({
      useOpenAI: process.env.USE_OPENAI_EMBEDDINGS === 'true',
      forceReinit: true // Force reinitialization to ensure fresh state
    });
    
    // Define collection types to check
    const collections = {
      message: 'messages',
      thought: 'thoughts',
      document: 'documents',
      task: 'tasks', 
      memory_edits: 'memory_edits'
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
        const memories = await serverQdrant.searchMemory(
          type as any,
          '',
          { limit: limit > 100 ? 100 : limit }
        );
        
        // Count memories in this collection
        const count = memories.length;
        totalMemoryCount += count;
        results.collectionCounts[collectionName] = count;
        
        // Analyze memory types within this collection
        const typeDistribution: Record<string, number> = {};
        const samples: Array<any> = [];
        
        memories.forEach((memory, index) => {
          // Extract the memory type
          const memoryType = memory.type || 
                          memory.metadata?.type || 
                          memory.metadata?.category || 
                          'unknown';
          
          // Count this type
          typeDistribution[memoryType] = (typeDistribution[memoryType] || 0) + 1;
          
          // Store samples of the first few memories
          if (index < 3) {
            samples.push({
              id: memory.id,
              type: memoryType,
              timestamp: memory.timestamp,
              contentPreview: memory.text ? memory.text.substring(0, 100) + '...' : 'No content',
              metadata: Object.keys(memory.metadata || {})
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
    
    // Try to get all memories with our fixed function
    try {
      console.log('[debug-memory-types] Testing getAllMemories function');
      const allMemories = await serverQdrant.getAllMemories(null, limit);
      
      // Count type distribution across all memories
      const overallTypeDistribution: Record<string, number> = {};
      
      allMemories.forEach(memory => {
        const memoryType = memory.type || 
                        memory.metadata?.type || 
                        memory.metadata?.category || 
                        'unknown';
        
        overallTypeDistribution[memoryType] = (overallTypeDistribution[memoryType] || 0) + 1;
      });
      
      results.allMemories = {
        count: allMemories.length,
        typeDistribution: overallTypeDistribution
      };
      
      console.log(`[debug-memory-types] getAllMemories returned ${allMemories.length} memories`);
    } catch (error) {
      console.error('[debug-memory-types] Error testing getAllMemories:', error);
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