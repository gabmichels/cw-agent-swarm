import { NextRequest, NextResponse } from 'next/server';
import { QdrantClient } from '@qdrant/js-client-rest';

// Initialize Qdrant client
const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_URL || 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY
});

export async function POST(request: NextRequest) {
  try {
    const { collections, recreate = true } = await request.json();
    
    if (!collections || !Array.isArray(collections) || collections.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Collections array is required and must not be empty'
      }, { status: 400 });
    }

    console.log('Delete collections request:', { collections, recreate });

    const results = {
      deleted: [] as string[],
      failed: [] as string[],
      recreated: [] as string[],
      recreationFailed: [] as string[]
    };

    // Step 1: Delete selected collections
    for (const collectionName of collections) {
      try {
        // Check if collection exists first
        const collectionInfo = await qdrantClient.getCollection(collectionName);
        
        if (collectionInfo) {
          // Delete the collection
          await qdrantClient.deleteCollection(collectionName);
          results.deleted.push(collectionName);
          console.log(`Successfully deleted collection: ${collectionName}`);
        } else {
          console.log(`Collection ${collectionName} does not exist, skipping deletion`);
          results.failed.push(`Collection ${collectionName} does not exist`);
        }
      } catch (error) {
        console.error(`Error deleting collection ${collectionName}:`, error);
        results.failed.push(`Failed to delete ${collectionName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Step 2: Recreate collections if requested
    if (recreate) {
      for (const collectionName of results.deleted) {
        try {
          // Recreate the collection with standard settings
          await qdrantClient.createCollection(collectionName, {
            vectors: {
              size: 1536, // Standard embedding size
              distance: 'Cosine'
            }
          });
          results.recreated.push(collectionName);
          console.log(`Successfully recreated collection: ${collectionName}`);
        } catch (error) {
          console.error(`Error recreating collection ${collectionName}:`, error);
          results.recreationFailed.push(`Failed to recreate ${collectionName}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    // Return comprehensive results
    const response = {
      success: true,
      message: `Operation completed. Deleted: ${results.deleted.length}, Recreated: ${results.recreated.length}`,
      details: {
        totalRequested: collections.length,
        deleted: results.deleted,
        deletionFailed: results.failed,
        recreated: results.recreated,
        recreationFailed: results.recreationFailed
      }
    };

    console.log('Delete collections response:', response);
    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in delete-collections API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 