import { NextRequest, NextResponse } from 'next/server';
import * as serverQdrant from '../../../../server/qdrant';
import { QdrantMemoryType } from '../../../../server/qdrant';

export const runtime = 'nodejs';

/**
 * API endpoint to reset a specific memory collection or all collections
 */
export async function POST(request: NextRequest) {
  try {
    // Get collection type from request body
    const body = await request.json();
    const collection = body.collection as QdrantMemoryType | 'all';
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
    
    // Initialize Qdrant memory
    await serverQdrant.initMemory({
      useOpenAI: process.env.USE_OPENAI_EMBEDDINGS === 'true'
    });
    
    // Verify the collections before resetting if requested
    const verificationResults: Record<string, any> = {};
    
    if (verify) {
      // Verify collections based on the request
      if (collection === 'all') {
        // Verify all collections
        for (const type of ['message', 'thought', 'document', 'task', 'memory_edits'] as QdrantMemoryType[]) {
          try {
            const memories = await serverQdrant.searchMemory(type, '', { limit: 5 });
            verificationResults[type] = {
              exists: true,
              count: memories.length,
              sample: memories.length > 0 ? memories[0].id : null
            };
          } catch (error) {
            verificationResults[type] = {
              exists: false,
              error: error instanceof Error ? error.message : String(error)
            };
          }
        }
      } else {
        // Verify specific collection
        try {
          const memories = await serverQdrant.searchMemory(collection, '', { limit: 5 });
          verificationResults[collection] = {
            exists: true,
            count: memories.length,
            sample: memories.length > 0 ? memories[0].id : null
          };
        } catch (error) {
          verificationResults[collection] = {
            exists: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
    }
    
    let result: boolean = false;
    
    // Reset the collection(s)
    if (collection === 'all') {
      console.log('[memory/reset-collection] Resetting all collections');
      result = await serverQdrant.resetAllCollections();
    } else {
      console.log(`[memory/reset-collection] Resetting collection: ${collection}`);
      result = await serverQdrant.resetCollection(collection);
    }
    
    console.log(`[memory/reset-collection] Reset result: ${result}`);
    
    // Verify the collections after resetting
    const postResetResults: Record<string, any> = {};
    
    // Check the affected collections after reset
    if (collection === 'all') {
      // Verify all collections after reset
      for (const type of ['message', 'thought', 'document', 'task', 'memory_edits'] as QdrantMemoryType[]) {
        try {
          const memories = await serverQdrant.searchMemory(type, '', { limit: 5 });
          postResetResults[type] = {
            exists: true,
            count: memories.length
          };
        } catch (error) {
          postResetResults[type] = {
            exists: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
    } else {
      // Verify specific collection after reset
      try {
        const memories = await serverQdrant.searchMemory(collection, '', { limit: 5 });
        postResetResults[collection] = {
          exists: true,
          count: memories.length
        };
      } catch (error) {
        postResetResults[collection] = {
          exists: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
    
    return NextResponse.json({
      status: 'success',
      collection,
      result,
      verification: verify ? verificationResults : undefined,
      post_reset: postResetResults
    });
  } catch (error) {
    console.error('Error resetting collection:', error);
    return NextResponse.json(
      { 
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 