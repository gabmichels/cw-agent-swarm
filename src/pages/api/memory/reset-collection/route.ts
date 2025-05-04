import { NextRequest, NextResponse } from 'next/server';
import { MemoryType } from '../../../../server/memory/config';
import { MemoryService } from '../../../../server/memory/services/memory/memory-service';
import { QdrantMemoryClient } from '../../../../server/memory/services/client/qdrant-client';
import { EmbeddingService } from '../../../../server/memory/services/client/embedding-service';
import { SearchService } from '../../../../server/memory/services/search/search-service';
import * as serverQdrant from '../../../../server/qdrant';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * API endpoint to reset memory collections using both the standardized and legacy systems
 */
export async function POST(request: NextRequest) {
  try {
    // Get collection type from request body
    const body = await request.json();
    const collection = body.collection as string;
    const verify = body.verify === true;
    
    if (!collection) {
      return NextResponse.json(
        { 
          status: 'error', 
          error: 'Collection parameter is required' 
        },
        { status: 400 }
      );
    }
    
    console.log(`[memory/reset-collection] Request to reset collection: ${collection}`);
    
    // Initialize services
    const qdrantClient = new QdrantMemoryClient();
    const embeddingService = new EmbeddingService();
    const memoryService = new MemoryService(qdrantClient, embeddingService);
    
    // Create search service with all required dependencies
    const searchService = new SearchService(
      qdrantClient, 
      embeddingService,
      memoryService
    );
    
    // Initialize legacy Qdrant memory as well
    await serverQdrant.initMemory({
      useOpenAI: process.env.USE_OPENAI_EMBEDDINGS === 'true'
    });
    
    // Determine which collections to reset
    let collectionsToReset: MemoryType[] = [];
    if (collection === 'all') {
      collectionsToReset = Object.values(MemoryType);
    } else {
      // Convert collection string to MemoryType if possible
      const memoryType = Object.values(MemoryType).find(type => type === collection);
      if (memoryType) {
        collectionsToReset = [memoryType];
      } else {
        return NextResponse.json(
          { 
            status: 'error', 
            error: `Invalid collection type: ${collection}` 
          },
          { status: 400 }
        );
      }
    }
    
    // If verification is requested, get current state
    const verificationResults: Record<string, any> = {};
    if (verify) {
      for (const type of collectionsToReset) {
        try {
          const memories = await searchService.search("", {
            types: [type],
            limit: 5
          });
          verificationResults[type] = {
            exists: true,
            count: memories.length,
            sample: memories.length > 0 ? memories[0].point.id : null
          };
        } catch (error) {
          verificationResults[type] = {
            exists: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
    }
    
    // Reset collections in both systems
    const results: Record<string, any> = {};
    let overallSuccess = true;
    
    // Reset collections in standardized system
    // Note: The client doesn't have a direct resetCollection method,
    // so we need to delete and re-create for each collection
    for (const type of collectionsToReset) {
      try {
        // Delete all points for this type using search and delete
        const memories = await searchService.search("", {
          types: [type],
          limit: 1000 // Reset up to 1000 memories
        });
        
        // Delete each point
        let deletionSuccess = true;
        let deletedCount = 0;
        
        for (const memory of memories) {
          try {
            await memoryService.deleteMemory({
              id: memory.point.id,
              type: type
            });
            deletedCount++;
          } catch (err) {
            console.error(`Error deleting memory ${memory.point.id}:`, err);
            deletionSuccess = false;
          }
        }
        
        results[`standardized_${type}`] = { 
          success: deletionSuccess,
          deletedCount
        };
        if (!deletionSuccess) overallSuccess = false;
      } catch (error) {
        console.error(`Error resetting collection ${type} in standardized system:`, error);
        results[`standardized_${type}`] = { 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        };
        overallSuccess = false;
      }
    }
    
    // Reset collections in legacy system
    try {
      if (collection === 'all') {
        const success = await serverQdrant.resetAllCollections();
        results.legacy_all = { success };
        if (!success) overallSuccess = false;
      } else {
        // Convert to legacy type
        const legacyType = collection as any; // Legacy system uses same type strings
        const success = await serverQdrant.resetCollection(legacyType);
        results[`legacy_${collection}`] = { success };
        if (!success) overallSuccess = false;
      }
    } catch (error) {
      console.error('Error resetting collections in legacy system:', error);
      results.legacy_error = error instanceof Error ? error.message : String(error);
      overallSuccess = false;
    }
    
    // Verify the collections after resetting
    const postResetResults: Record<string, any> = {};
    if (verify) {
      for (const type of collectionsToReset) {
        try {
          const memories = await searchService.search("", {
            types: [type],
            limit: 5
          });
          postResetResults[type] = {
            count: memories.length,
            success: memories.length === 0
          };
          if (memories.length > 0) overallSuccess = false;
        } catch (error) {
          postResetResults[type] = {
            error: error instanceof Error ? error.message : String(error),
            success: false
          };
          overallSuccess = false;
        }
      }
    }
    
    return NextResponse.json({
      status: overallSuccess ? 'success' : 'partial',
      results,
      verificationResults,
      postResetResults
    });
  } catch (error) {
    console.error('Error in reset-collection API:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 