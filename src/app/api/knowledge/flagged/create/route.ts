import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeGraph } from '../../../../../lib/knowledge/KnowledgeGraph';
import { KnowledgeFlaggingService } from '../../../../../lib/knowledge/flagging/KnowledgeFlaggingService';

/**
 * Create a new flagged knowledge item from different sources
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { source, content, metadata } = body;
    
    if (!source || !content) {
      return NextResponse.json(
        { error: 'Source and content are required' },
        { status: 400 }
      );
    }
    
    // Initialize the knowledge graph and flagging service
    const knowledgeGraph = new KnowledgeGraph('default');
    const flaggingService = new KnowledgeFlaggingService(knowledgeGraph);
    
    // Load flagged items
    await flaggingService.load();
    
    let result;
    
    // Flag knowledge based on the source type
    switch (source) {
      case 'conversation':
        const { conversationId, context } = metadata || {};
        result = await flaggingService.flagFromConversation(content, context);
        break;
        
      case 'file':
        const { fileName, fileType } = metadata || {};
        if (!fileName || !fileType) {
          return NextResponse.json(
            { error: 'fileName and fileType are required for file source' },
            { status: 400 }
          );
        }
        result = await flaggingService.flagFromFile(content, fileName, fileType, metadata);
        break;
        
      case 'market_scan':
        const { sourceName, url } = metadata || {};
        if (!sourceName) {
          return NextResponse.json(
            { error: 'sourceName is required for market_scan source' },
            { status: 400 }
          );
        }
        result = await flaggingService.flagFromMarketScan(sourceName, content, url, metadata);
        break;
        
      case 'web_search':
        const { query, sourceName: webSource, url: webUrl } = metadata || {};
        if (!query || !webSource) {
          return NextResponse.json(
            { error: 'query and sourceName are required for web_search source' },
            { status: 400 }
          );
        }
        result = await flaggingService.flagFromWebSearch(query, content, webSource, webUrl, metadata);
        break;
        
      case 'manual':
        const { 
          title, 
          suggestedType, 
          suggestedCategory, 
          suggestedProperties 
        } = metadata || {};
        
        if (!title || !suggestedType || !suggestedCategory || !suggestedProperties) {
          return NextResponse.json(
            { 
              error: 'title, suggestedType, suggestedCategory, and suggestedProperties are required for manual source' 
            },
            { status: 400 }
          );
        }
        
        result = await flaggingService.flagManually(
          title, 
          content, 
          suggestedType, 
          suggestedCategory, 
          suggestedProperties, 
          metadata
        );
        break;
        
      default:
        return NextResponse.json(
          { error: 'Invalid source type' },
          { status: 400 }
        );
    }
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to flag knowledge' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      id: result.itemId 
    });
  } catch (error) {
    console.error('Error flagging knowledge item:', error);
    return NextResponse.json(
      { error: 'Failed to flag knowledge item' },
      { status: 500 }
    );
  }
} 