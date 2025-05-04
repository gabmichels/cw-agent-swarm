import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../server/memory/services';
import { MemoryType } from '../../../../server/memory/config';
import { getCollectionName } from '../../../../server/memory/config/collections';
import { QdrantClient } from '@qdrant/js-client-rest';

export const runtime = 'nodejs';

/**
 * API endpoint to reset a specific memory collection or all collections
 */
export async function POST(request: NextRequest) {
  try {
    // Get collection type from request body
    const body = await request.json();
    const collection = body.collection as MemoryType | 'all';
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
    
    // Initialize memory services
    const { memoryService, client } = await getMemoryServices();
    
    // Create direct Qdrant client for collection deletion
    const qdrantClient = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY
    });
    
    // Verify the collections before resetting if requested
    const verificationResults: Record<string, any> = {};
    
    if (verify) {
      // Verify collections based on the request
      if (collection === 'all') {
        // Verify all collections
        for (const type of Object.values(MemoryType)) {
          try {
            const memories = await memoryService.searchMemories({
              type,
              query: ''
            });
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
          const memories = await memoryService.searchMemories({
            type: collection,
            query: ''
          });
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
    
    let result: boolean = true;
    
    // Reset the collection(s)
    if (collection === 'all') {
      console.log('[memory/reset-collection] Resetting all collections');
      // Reset each collection individually
      const results = await Promise.all(
        Object.values(MemoryType).map(async (type) => {
          try {
            // Get collection name from config
            const collectionName = getCollectionName(type);
            
            // Check if collection exists first
            const collections = await qdrantClient.getCollections();
            const exists = collections.collections.some(c => c.name === collectionName);
            
            if (exists) {
              // Delete the collection
              await qdrantClient.deleteCollection(collectionName);
              
              // Recreate the collection
              await qdrantClient.createCollection(collectionName, {
                vectors: {
                  size: 1536, // Default OpenAI embedding size
                  distance: "Cosine"
                }
              });
              
              return { type, success: true };
            } else {
              // Collection doesn't exist, nothing to reset
              return { type, success: true };
            }
          } catch (error) {
            console.error(`Error resetting collection ${type}:`, error);
            return { type, success: false, error };
          }
        })
      );
      
      // All succeeded if every reset succeeded
      result = results.every(r => r.success);
    } else {
      console.log(`[memory/reset-collection] Resetting collection: ${collection}`);
      try {
        // Get collection name from config
        const collectionName = getCollectionName(collection);
        
        // Check if collection exists first
        const collections = await qdrantClient.getCollections();
        const exists = collections.collections.some(c => c.name === collectionName);
        
        if (exists) {
          // Delete the collection
          await qdrantClient.deleteCollection(collectionName);
          
          // Recreate the collection
          await qdrantClient.createCollection(collectionName, {
            vectors: {
              size: 1536, // Default OpenAI embedding size
              distance: "Cosine"
            }
          });
          
          result = true;
        } else {
          // Collection doesn't exist, nothing to reset
          result = true;
        }
      } catch (error) {
        console.error(`Error resetting collection ${collection}:`, error);
        result = false;
      }
    }
    
    console.log(`[memory/reset-collection] Reset result: ${result}`);
    
    // Verify the collections after resetting
    const postResetResults: Record<string, any> = {};
    
    // Check the affected collections after reset
    if (collection === 'all') {
      // Verify all collections after reset
      for (const type of Object.values(MemoryType)) {
        try {
          const memories = await memoryService.searchMemories({
            type,
            query: ''
          });
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
        const memories = await memoryService.searchMemories({
          type: collection,
          query: ''
        });
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