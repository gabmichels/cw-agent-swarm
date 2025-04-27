import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeGraph } from '../../../../lib/knowledge/KnowledgeGraph';
import { KnowledgeFlaggingService } from '../../../../lib/knowledge/flagging/KnowledgeFlaggingService';

/**
 * Get all flagged knowledge items, with optional filtering
 */
export async function GET(req: NextRequest) {
  try {
    // Extract query parameters
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const source = searchParams.get('source');
    
    // Initialize the knowledge graph and flagging service
    const knowledgeGraph = new KnowledgeGraph('default');
    const flaggingService = new KnowledgeFlaggingService(knowledgeGraph);
    
    // Load flagged items
    await flaggingService.load();
    
    // Get flagged items with optional filtering
    const flaggedItems = flaggingService.getFlaggedItems({
      status: status as any || undefined,
      suggestedType: type as any || undefined,
      sourceType: source as any || undefined,
    });
    
    return NextResponse.json({ items: flaggedItems });
  } catch (error) {
    console.error('Error fetching flagged knowledge items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch flagged knowledge items' },
      { status: 500 }
    );
  }
} 