import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeGraph } from '../../../../../lib/knowledge/KnowledgeGraph';
import { KnowledgeFlaggingService } from '../../../../../lib/knowledge/flagging/KnowledgeFlaggingService';

/**
 * Get statistics about flagged knowledge items
 */
export async function GET(req: NextRequest) {
  try {
    // Initialize the knowledge graph and flagging service
    const knowledgeGraph = new KnowledgeGraph('default');
    const flaggingService = new KnowledgeFlaggingService(knowledgeGraph);
    
    // Load flagged items
    await flaggingService.load();
    
    // Get flagging stats
    const stats = flaggingService.getStats();
    
    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Error fetching flagged knowledge stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch flagged knowledge stats' },
      { status: 500 }
    );
  }
} 