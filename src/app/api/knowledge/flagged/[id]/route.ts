import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeGraph } from '../../../../../lib/knowledge/KnowledgeGraph';
import { KnowledgeFlaggingService } from '../../../../../lib/knowledge/flagging/KnowledgeFlaggingService';

/**
 * Get a specific flagged knowledge item by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    
    // Initialize the knowledge graph and flagging service
    const knowledgeGraph = new KnowledgeGraph('default');
    const flaggingService = new KnowledgeFlaggingService(knowledgeGraph);
    
    // Load flagged items
    await flaggingService.load();
    
    // Get the specific flagged item
    const flaggedItem = flaggingService.getFlaggedItem(id);
    
    if (!flaggedItem) {
      return NextResponse.json(
        { error: 'Flagged knowledge item not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ item: flaggedItem });
  } catch (error) {
    console.error('Error fetching flagged knowledge item:', error);
    return NextResponse.json(
      { error: 'Failed to fetch flagged knowledge item' },
      { status: 500 }
    );
  }
}

/**
 * Update the status of a flagged knowledge item
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const { status } = await req.json();
    
    if (!status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      );
    }
    
    // Initialize the knowledge graph and flagging service
    const knowledgeGraph = new KnowledgeGraph('default');
    const flaggingService = new KnowledgeFlaggingService(knowledgeGraph);
    
    // Load flagged items
    await flaggingService.load();
    
    // Update the status of the flagged item
    const result = await flaggingService.updateItemStatus(id, status);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to update status' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating flagged knowledge item status:', error);
    return NextResponse.json(
      { error: 'Failed to update flagged knowledge item status' },
      { status: 500 }
    );
  }
}

/**
 * Delete a flagged knowledge item
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    
    // Initialize the knowledge graph and flagging service
    const knowledgeGraph = new KnowledgeGraph('default');
    const flaggingService = new KnowledgeFlaggingService(knowledgeGraph);
    
    // Load flagged items
    await flaggingService.load();
    
    // Get the flagged item to check if it exists
    const flaggedItem = flaggingService.getFlaggedItem(id);
    
    if (!flaggedItem) {
      return NextResponse.json(
        { error: 'Flagged knowledge item not found' },
        { status: 404 }
      );
    }
    
    // Remove the item
    flaggingService.getFlaggedItems().filter(item => item.id !== id);
    await flaggingService.save();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting flagged knowledge item:', error);
    return NextResponse.json(
      { error: 'Failed to delete flagged knowledge item' },
      { status: 500 }
    );
  }
} 