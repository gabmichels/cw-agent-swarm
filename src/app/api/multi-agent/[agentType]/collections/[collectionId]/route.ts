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
 * GET handler - get a specific collection
 */
export async function GET(
  request: Request,
  { params }: { params: { agentType: string, collectionId: string } }
) {
  try {
    const { agentType, collectionId } = await params;
    console.log(`API DEBUG: GET multi-agent/${agentType}/collections/${collectionId}`);

    if (!collectionId) {
      return NextResponse.json(
        { error: 'Collection ID is required' },
        { status: 400 }
      );
    }

    const collectionService = await getMemoryServices();
    const collection = await collectionService.getCollectionById(collectionId);

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ collection });
  } catch (error) {
    console.error(`Error in API operation:`, error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PUT handler - update a collection
 */
export async function PUT(
  request: Request,
  { params }: { params: { agentType: string, collectionId: string } }
) {
  try {
    const { agentType, collectionId } = await params;
    console.log(`API DEBUG: PUT multi-agent/${agentType}/collections/${collectionId}`);

    const updateData = await request.json();

    if (!collectionId) {
      return NextResponse.json(
        { error: 'Collection ID is required' },
        { status: 400 }
      );
    }

    const collectionService = await getMemoryServices();
    const updatedCollection = await collectionService.updateCollection(collectionId, updateData);

    if (!updatedCollection) {
      return NextResponse.json(
        { error: 'Failed to update collection' },
        { status: 500 }
      );
    }

    return NextResponse.json({ collection: updatedCollection });
  } catch (error) {
    console.error(`Error in API operation:`, error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler - delete a collection
 */
export async function DELETE(
  request: Request,
  { params }: { params: { agentType: string, collectionId: string } }
) {
  try {
    const { agentType, collectionId } = await params;
    console.log(`API DEBUG: DELETE multi-agent/${agentType}/collections/${collectionId}`);

    if (!collectionId) {
      return NextResponse.json(
        { error: 'Collection ID is required' },
        { status: 400 }
      );
    }

    const collectionService = await getMemoryServices();

    // Verify collection exists before deletion
    const collection = await collectionService.getCollectionById(collectionId);
    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    const success = await collectionService.deleteCollection(collectionId);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete collection' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Collection deleted successfully'
    });
  } catch (error) {
    console.error(`Error in API operation:`, error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 