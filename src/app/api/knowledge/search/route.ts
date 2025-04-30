import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeGraph } from '../../../../lib/knowledge/KnowledgeGraph';
import { SemanticSearchService } from '../../../../lib/knowledge/SemanticSearchService';
import { logger } from '../../../../lib/logging';

let knowledgeGraph: KnowledgeGraph | null = null;
let searchService: SemanticSearchService | null = null;

function getSearchService(domain: string = 'marketing'): SemanticSearchService {
  if (!searchService) {
    if (!knowledgeGraph) {
      knowledgeGraph = new KnowledgeGraph(domain);
    }
    searchService = new SemanticSearchService(knowledgeGraph);
  }
  return searchService;
}

/**
 * Search the knowledge graph with semantic capabilities
 * 
 * Query parameters:
 * - q: search query (required)
 * - limit: max number of results (default: 10)
 * - types: comma-separated list of item types to search (concept,principle,framework,research)
 * - categories: comma-separated list of categories/domains to filter by
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
    
    // Parse types and categories from query params
    const types = searchParams.get('types')?.split(',').filter(Boolean) as any[] || undefined;
    const categories = searchParams.get('categories')?.split(',').filter(Boolean) || undefined;
    
    const searchService = getSearchService();
    
    // Apply query augmentation if requested
    let finalQuery = query;
    let augmentationInfo = null;
    
    if (augment) {
      const { augmentedQuery, usedItems } = await searchService.augmentQuery(query, {
        types,
        categories,
      });
      finalQuery = augmentedQuery;
      augmentationInfo = {
        originalQuery: query,
        augmentedQuery: finalQuery,
        usedItems: usedItems.map(item => ({
          id: item.id,
          name: item.name || item.title,
          type: item._type
        }))
      };
    }
    
    // Execute search
    const results = await searchService.searchKnowledge(finalQuery, {
      limit,
      types,
      categories,
      threshold
    });
    
    logger.info(`Knowledge search for "${query}" returned ${results.length} results`);
    
    return NextResponse.json({
      query: finalQuery,
      augmentation: augmentationInfo,
      results: results.map(result => ({
        id: result.item.id,
        name: result.item.name || result.item.title,
        type: result.item._type,
        score: result.score,
        highlights: result.highlights,
        // Include a preview of the content depending on item type
        preview: result.item.description || result.item.content?.substring(0, 150) || ''
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
 * - itemId: ID of the knowledge item
 * - isRelevant: whether the item was relevant to the query
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
    
    const searchService = getSearchService();
    const success = await searchService.recordRelevanceFeedback({
      itemId,
      isRelevant,
      userQuery,
      explanation
    });
    
    if (success) {
      logger.info(`Recorded relevance feedback for item ${itemId}: ${isRelevant ? 'relevant' : 'not relevant'}`);
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