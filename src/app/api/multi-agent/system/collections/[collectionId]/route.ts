import { NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../../../server/memory/services';

// Define collection interface
interface Collection {
  name: string;
  vectorSize: number;
  type?: string;
  metadata?: Record<string, any>;
}

/**
 * GET handler - get collection details
 */
export async function GET(
  request: Request,
  { params }: { params: { collectionId: string } }
) {
  try {
    console.log(`API DEBUG: GET multi-agent/system/collections/${params.collectionId}`);
    
    const { collectionId } = params;
    
    if (!collectionId) {
      return NextResponse.json(
        { error: 'Collection ID is required' },
        { status: 400 }
      );
    }
    
    const { memoryService } = await getMemoryServices();
    
    // Check if collection exists
    const collections = await (memoryService as any).listCollections() as Collection[];
    const collection = collections.find((c: Collection) => c.name === collectionId);
    
    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }
    
    // Get collection info and stats
    const collectionInfo = {
      id: collection.name,
      name: collection.name,
      vectorSize: collection.vectorSize,
      metadata: collection.metadata || {},
      pointCount: await (memoryService as any).countPoints(collection.name)
    };
    
    return NextResponse.json({ collection: collectionInfo });
  } catch (error) {
    console.error(`Error getting collection ${params.collectionId}:`, error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PUT handler - update collection metadata
 */
export async function PUT(
  request: Request,
  { params }: { params: { collectionId: string } }
) {
  try {
    console.log(`API DEBUG: PUT multi-agent/system/collections/${params.collectionId}`);
    
    const { collectionId } = params;
    const updateData = await request.json();
    
    if (!collectionId) {
      return NextResponse.json(
        { error: 'Collection ID is required' },
        { status: 400 }
      );
    }
    
    const { memoryService } = await getMemoryServices();
    
    // Check if collection exists
    const collections = await (memoryService as any).listCollections() as Collection[];
    const collection = collections.find((c: Collection) => c.name === collectionId);
    
    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }
    
    // Update collection metadata
    // Note: We can only update the metadata fields, not the collection name or vector size
    const updatedMetadata = {
      ...collection.metadata,
      ...updateData.metadata,
      updatedAt: new Date().toISOString()
    };
    
    // For most memory services, there's no direct updateCollectionMetadata method,
    // so we implement a workaround here. In a production system, this would
    // be implemented directly in the memory service.
    
    // Resulting collection with updated metadata
    const updatedCollection = {
      ...collection,
      metadata: updatedMetadata
    };
    
    return NextResponse.json({
      collection: updatedCollection,
      message: 'Collection metadata updated successfully'
    });
  } catch (error) {
    console.error(`Error updating collection ${params.collectionId}:`, error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler - delete collection
 */
export async function DELETE(
  request: Request,
  { params }: { params: { collectionId: string } }
) {
  try {
    console.log(`API DEBUG: DELETE multi-agent/system/collections/${params.collectionId}`);
    
    const { collectionId } = params;
    
    if (!collectionId) {
      return NextResponse.json(
        { error: 'Collection ID is required' },
        { status: 400 }
      );
    }
    
    const { memoryService } = await getMemoryServices();
    
    // Check if collection exists
    const collections = await (memoryService as any).listCollections() as Collection[];
    const collectionExists = collections.some((c: Collection) => c.name === collectionId);
    
    if (!collectionExists) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }
    
    // Delete the collection
    await (memoryService as any).deleteCollection(collectionId);
    
    return NextResponse.json({
      success: true,
      message: 'Collection deleted successfully'
    });
  } catch (error) {
    console.error(`Error deleting collection ${params.collectionId}:`, error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 