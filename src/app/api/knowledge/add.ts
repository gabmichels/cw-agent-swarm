import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeGraph } from '../../../lib/knowledge/KnowledgeGraph';
import { KnowledgeFlaggingService } from '../../../lib/knowledge/flagging/KnowledgeFlaggingService';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content, source = 'chat', timestamp = new Date().toISOString() } = body;

    if (!content) {
      return NextResponse.json({ success: false, error: 'Content is required' }, { status: 400 });
    }

    // Initialize the knowledge graph
    const knowledgeGraph = new KnowledgeGraph('default');
    await knowledgeGraph.load();
    
    // Initialize the flagging service
    const flaggingService = new KnowledgeFlaggingService(knowledgeGraph);
    await flaggingService.load();
    
    // Extract title from content (first line or first 50 chars)
    const title = content.split('\n')[0].trim().substring(0, 50) || 'User flagged content';
    
    // Flag the content manually
    const result = await flaggingService.flagManually(
      title,
      content,
      'concept', // Default to concept, the system will analyze and reclassify as needed
      'general',  // Default category
      {
        type: 'concept',
        name: title,
        description: content,
      },
      {
        source: 'user_flagged',
        addedBy: 'user',
        addedVia: 'chat_interface',
        addedAt: new Date().toISOString(),
        userFlagged: true,
        timestamp
      }
    );

    if (result.success) {
      console.log(`Added content to knowledge database with ID: ${result.itemId}`);
      
      // Save the flagged items
      await flaggingService.save();
      
      return NextResponse.json({ 
        success: true, 
        message: 'Content added to knowledge database',
        itemId: result.itemId
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: result.error || 'Failed to add content to knowledge database' 
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error adding content to knowledge database:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add content to knowledge database' },
      { status: 500 }
    );
  }
} 