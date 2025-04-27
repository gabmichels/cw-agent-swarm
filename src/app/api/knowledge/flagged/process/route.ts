import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeGraph } from '../../../../../lib/knowledge/KnowledgeGraph';
import { KnowledgeFlaggingService } from '../../../../../lib/knowledge/flagging/KnowledgeFlaggingService';

/**
 * Process all approved flagged knowledge items
 */
export async function POST(req: NextRequest) {
  try {
    // Initialize the knowledge graph and flagging service
    const knowledgeGraph = new KnowledgeGraph('default');
    const flaggingService = new KnowledgeFlaggingService(knowledgeGraph);
    
    // Load flagged items
    await flaggingService.load();
    
    // Process all approved items
    const results = await flaggingService.processAllApprovedItems();
    
    // Count successes and failures
    const successes = results.filter(result => result.success).length;
    const failures = results.filter(result => !result.success).length;
    
    return NextResponse.json({
      success: true,
      processed: results.length,
      successes,
      failures,
      details: results
    });
  } catch (error) {
    console.error('Error processing approved knowledge items:', error);
    return NextResponse.json(
      { error: 'Failed to process approved knowledge items' },
      { status: 500 }
    );
  }
}

/**
 * Process a specific approved flagged knowledge item
 */
export async function PUT(req: NextRequest) {
  try {
    const { id } = await req.json();
    
    if (!id) {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400 }
      );
    }
    
    // Initialize the knowledge graph and flagging service
    const knowledgeGraph = new KnowledgeGraph('default');
    const flaggingService = new KnowledgeFlaggingService(knowledgeGraph);
    
    // Load flagged items
    await flaggingService.load();
    
    // Process the specific approved item
    const result = await flaggingService.processApprovedItem(id);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to process approved item' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing approved knowledge item:', error);
    return NextResponse.json(
      { error: 'Failed to process approved knowledge item' },
      { status: 500 }
    );
  }
} 