import { NextRequest, NextResponse } from 'next/server';
import { DefaultKnowledgeGraph } from '../../../../agents/shared/knowledge/DefaultKnowledgeGraph';
import { SemanticSearchService } from '../../../../lib/knowledge/SemanticSearchService';
import { KnowledgeGapsService } from '../../../../lib/knowledge/gaps/KnowledgeGapsService';
import { logger } from '../../../../lib/logging';

let graphManager: DefaultKnowledgeGraph | null = null;
let searchService: SemanticSearchService | null = null;
let gapsService: KnowledgeGapsService | null = null;

/**
 * Initialize or get the knowledge gaps service
 */
async function getGapsService(): Promise<KnowledgeGapsService> {
  if (!gapsService) {
    if (!graphManager) {
      graphManager = new DefaultKnowledgeGraph();
      await graphManager.initialize();
    }
    
    if (!searchService) {
      searchService = new SemanticSearchService(graphManager);
    }
    
    gapsService = new KnowledgeGapsService(graphManager, searchService);
    await gapsService.load(); // Load existing gaps and priorities
  }
  
  return gapsService;
}

/**
 * GET handler for fetching knowledge gaps
 * 
 * Query parameters:
 * - category: Filter by category
 * - status: Filter by status (new, investigating, addressed, dismissed)
 * - limit: Maximum number of results to return
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const limitStr = searchParams.get('limit');
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;
    
    const service = await getGapsService();
    let gaps = service.getAllKnowledgeGaps();
    
    // Apply filters
    if (category) {
      gaps = service.getKnowledgeGapsByCategory(category);
    }
    
    if (status) {
      gaps = gaps.filter((gap: any) => gap.status === status);
    }
    
    // Apply limit
    if (limit && limit > 0) {
      gaps = gaps.slice(0, limit);
    }
    
    // Get stats
    const stats = service.getKnowledgeGapsStats();
    
    return NextResponse.json({
      gaps,
      stats
    });
  } catch (error) {
    logger.error(`Error fetching knowledge gaps: ${error}`);
    return NextResponse.json(
      { error: 'Failed to fetch knowledge gaps' },
      { status: 500 }
    );
  }
}

/**
 * POST handler for analyzing conversations and identifying gaps
 * 
 * Body parameters:
 * - conversation: The conversation text to analyze
 * - threshold: (optional) Confidence threshold for gaps (0.1-1.0)
 * - maxGaps: (optional) Maximum number of gaps to identify
 * - category: (optional) Filter by category
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversation, threshold, maxGaps, category } = body;
    
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation text is required' },
        { status: 400 }
      );
    }
    
    const options = {
      threshold,
      maxGaps,
      category
    };
    
    const service = await getGapsService();
    const gaps = await service.analyzeConversation(conversation, options);
    
    // Get learning priorities for these gaps
    const priorities = gaps.map((gap: any) => 
      service.getLearningPrioritiesForGap(gap.id)
    ).flat();
    
    return NextResponse.json({
      gaps,
      priorities,
      totalGapsIdentified: gaps.length
    });
  } catch (error) {
    logger.error(`Error analyzing for knowledge gaps: ${error}`);
    return NextResponse.json(
      { error: 'Failed to analyze conversation for knowledge gaps' },
      { status: 500 }
    );
  }
}

/**
 * PATCH handler for updating knowledge gap or priority status
 * 
 * Body parameters:
 * - id: ID of the knowledge gap or priority
 * - type: 'gap' or 'priority'
 * - status: New status to set
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, type, status } = body;
    
    if (!id || !type || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: id, type, status' },
        { status: 400 }
      );
    }
    
    const service = await getGapsService();
    let result: any = null;
    
    if (type === 'gap') {
      // Validate status
      if (!['new', 'investigating', 'addressed', 'dismissed'].includes(status)) {
        return NextResponse.json(
          { error: 'Invalid gap status. Must be: new, investigating, addressed, or dismissed' },
          { status: 400 }
        );
      }
      
      result = await service.updateKnowledgeGapStatus(
        id, 
        status as 'new' | 'investigating' | 'addressed' | 'dismissed'
      );
    } else if (type === 'priority') {
      // Validate status
      if (!['pending', 'in_progress', 'completed'].includes(status)) {
        return NextResponse.json(
          { error: 'Invalid priority status. Must be: pending, in_progress, or completed' },
          { status: 400 }
        );
      }
      
      result = await service.updateLearningPriorityStatus(
        id,
        status as 'pending' | 'in_progress' | 'completed'
      );
    } else {
      return NextResponse.json(
        { error: 'Invalid type. Must be "gap" or "priority"' },
        { status: 400 }
      );
    }
    
    if (!result) {
      return NextResponse.json(
        { error: `${type} with ID ${id} not found` },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      [type]: result
    });
  } catch (error) {
    logger.error(`Error updating knowledge gap/priority: ${error}`);
    return NextResponse.json(
      { error: 'Failed to update knowledge gap/priority' },
      { status: 500 }
    );
  }
} 