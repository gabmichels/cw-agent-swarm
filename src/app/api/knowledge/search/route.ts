import { NextRequest, NextResponse } from 'next/server';
import { DefaultKnowledgeGraph } from '../../../../agents/shared/knowledge/DefaultKnowledgeGraph';
import { SemanticSearchService } from '../../../../lib/knowledge/SemanticSearchService';
import { logger } from '../../../../lib/logging';
import { KnowledgeNodeType } from '../../../../agents/shared/knowledge/interfaces/KnowledgeGraph.interface';

let graphManager: DefaultKnowledgeGraph | null = null;
let searchService: SemanticSearchService | null = null;

async function getSearchService(): Promise<SemanticSearchService> {
  if (!searchService) {
    if (!graphManager) {
      graphManager = new DefaultKnowledgeGraph();
      await graphManager.initialize();
    }
    searchService = new SemanticSearchService(graphManager);
  }
  return searchService;
}

/**
 * Search the knowledge graph with semantic capabilities
 * 
 * Query parameters:
 * - q: search query (required)
 * - limit: max number of results (default: 10)
 * - types: comma-separated list of node types to search
 * - threshold: minimum relevance score threshold (0-1, default: 0.6)
 * - augment: whether to augment the query with domain knowledge (default: false)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    
    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }
    
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const threshold = parseFloat(searchParams.get('threshold') || '0.6');
    const augment = searchParams.get('augment') === 'true';
    
    // Parse types from query params
    const types = searchParams.get('types')?.split(',').filter(Boolean) as KnowledgeNodeType[] || undefined;
    
    const searchService = await getSearchService();
    
    // Apply query augmentation if requested
    let finalQuery = query;
    let augmentationInfo = null;
    
    if (augment) {
      const { augmentedQuery, usedItems } = await searchService.augmentQuery(query, {
        types
      });
      finalQuery = augmentedQuery;
      augmentationInfo = {
        originalQuery: query,
        augmentedQuery: finalQuery,
        usedItems: usedItems.map((item: any) => ({
          id: item.id,
          label: item.label,
          type: item.type,
          description: item.description
        }))
      };
    }
    
    // Execute search
    const results = await searchService.searchKnowledge(finalQuery, {
      limit,
      types,
      threshold
    });
    
    logger.info(`Knowledge search for "${query}" returned ${results.length} results`);
    
    return NextResponse.json({
      query: finalQuery,
      augmentation: augmentationInfo,
      results: results.map((result: any) => ({
        id: result.item.id,
        label: result.item.label,
        type: result.item.type,
        description: result.item.description,
        score: result.score,
        highlights: result.highlights
      }))
    });
    
  } catch (error) {
    logger.error(`Error in semantic search API: ${error}`);
    return NextResponse.json(
      { error: 'Failed to search knowledge' },
      { status: 500 }
    );
  }
}

/**
 * Record relevance feedback for search results
 * 
 * Body:
 * - itemId: ID of the knowledge node
 * - isRelevant: whether the node was relevant to the query
 * - userQuery: the original search query
 * - explanation: optional user feedback explanation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { itemId, isRelevant, userQuery, explanation } = body;
    
    if (!itemId || typeof isRelevant !== 'boolean' || !userQuery) {
      return NextResponse.json(
        { error: 'Missing required fields: itemId, isRelevant, userQuery' },
        { status: 400 }
      );
    }
    
    const searchService = await getSearchService();
    const success = await searchService.recordRelevanceFeedback({
      itemId,
      isRelevant,
      userQuery,
      explanation
    });
    
    if (success) {
      logger.info(`Recorded relevance feedback for node ${itemId}: ${isRelevant ? 'relevant' : 'not relevant'}`);
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: 'Failed to record feedback' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    logger.error(`Error recording relevance feedback: ${error}`);
    return NextResponse.json(
      { error: 'Failed to record feedback' },
      { status: 500 }
    );
  }
} 