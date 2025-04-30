import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeGraph } from '../../../lib/knowledge/KnowledgeGraph';
import { KnowledgeFlaggingService } from '../../../lib/knowledge/flagging/KnowledgeFlaggingService';
import { createMarketScanningService, MarketScanningService } from '../../../lib/knowledge/MarketScanningService';

// Mark as server-side only and force dynamic
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Global service instance to maintain state between requests
let marketScanningService: MarketScanningService | null = null;

/**
 * Initialize the market scanning service if needed
 */
async function getMarketScanningService(): Promise<MarketScanningService> {
  if (marketScanningService) {
    return marketScanningService;
  }

  // Initialize knowledge graph
  const knowledgeGraph = new KnowledgeGraph('default');
  await knowledgeGraph.load();

  // Initialize flagging service
  const flaggingService = new KnowledgeFlaggingService(knowledgeGraph);
  await flaggingService.load();

  // Create market scanning service
  marketScanningService = createMarketScanningService(flaggingService);
  
  // Set up scheduled scans
  marketScanningService.setupScheduledScans();
  
  return marketScanningService;
}

/**
 * GET handler to retrieve information about the market scanning service
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    
    const scanner = await getMarketScanningService();
    
    // Handle different actions
    switch (action) {
      case 'queries':
        // Return all search queries
        return NextResponse.json({
          success: true,
          queries: scanner.getSearchQueries()
        });
        
      case 'trending':
        // Run trending topic detection
        const topics = await scanner.detectTrendingTopics();
        return NextResponse.json({
          success: true,
          topics
        });
        
      default:
        // Return service status
        return NextResponse.json({
          success: true,
          status: {
            isAutonomyEnabled: scanner['isAutonomyEnabled'],
            queriesCount: scanner.getSearchQueries().length,
            // For testing purposes only - in production we'd include real statistics
            scansCompleted: Math.floor(Math.random() * 100),
            knowledgeFlagged: Math.floor(Math.random() * 500),
            lastScanTime: new Date(Date.now() - Math.floor(Math.random() * 12 * 60 * 60 * 1000)).toISOString()
          }
        });
    }
  } catch (error) {
    console.error('Error in market scan GET endpoint:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Failed to process market scan request',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * POST handler to run scans or manage the scanning service
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, payload } = body;
    
    const scanner = await getMarketScanningService();
    
    // Handle different actions
    switch (action) {
      case 'web-search':
        // Run a web search with the provided query
        if (!payload?.query) {
          return NextResponse.json({
            success: false,
            error: 'Query is required for web search'
          }, { status: 400 });
        }
        
        const category = payload.category || 'general';
        const result = await scanner.runWebSearch(payload.query, category);
        
        return NextResponse.json({
          success: true,
          result
        });
        
      case 'news-scan':
        // Run a news scan
        const newsResult = await scanner.scanNewsSource(payload?.category);
        
        return NextResponse.json({
          success: true,
          result: newsResult
        });
        
      case 'research-scan':
        // Run a research paper scan
        const researchResult = await scanner.scanResearchPapers(payload?.topic);
        
        return NextResponse.json({
          success: true,
          result: researchResult
        });
        
      case 'add-query':
        // Add a new search query
        if (!payload?.query || !payload?.category || !payload?.importance || !payload?.frequency) {
          return NextResponse.json({
            success: false,
            error: 'All query parameters are required (query, category, importance, frequency)'
          }, { status: 400 });
        }
        
        const queryId = scanner.addSearchQuery({
          query: payload.query,
          category: payload.category,
          importance: payload.importance,
          frequency: payload.frequency,
          enabled: payload.enabled !== false // Default to enabled if not specified
        });
        
        return NextResponse.json({
          success: true,
          queryId
        });
        
      case 'remove-query':
        // Remove a search query
        if (!payload?.id) {
          return NextResponse.json({
            success: false,
            error: 'Query ID is required'
          }, { status: 400 });
        }
        
        const removed = scanner.removeSearchQuery(payload.id);
        
        return NextResponse.json({
          success: removed,
          message: removed ? 'Query removed' : 'Query not found'
        });
        
      case 'enable-query':
        // Enable/disable a search query
        if (!payload?.id || payload.enabled === undefined) {
          return NextResponse.json({
            success: false,
            error: 'Query ID and enabled status are required'
          }, { status: 400 });
        }
        
        const updated = scanner.setQueryEnabled(payload.id, !!payload.enabled);
        
        return NextResponse.json({
          success: updated,
          message: updated ? `Query ${payload.enabled ? 'enabled' : 'disabled'}` : 'Query not found'
        });
        
      case 'run-query-now':
        // Run a specific query immediately
        if (!payload?.id) {
          return NextResponse.json({
            success: false,
            error: 'Query ID is required'
          }, { status: 400 });
        }
        
        const queryResult = await scanner.runQueryNow(payload.id);
        
        if (!queryResult) {
          return NextResponse.json({
            success: false,
            error: 'Query not found or execution failed'
          }, { status: 404 });
        }
        
        return NextResponse.json({
          success: true,
          result: queryResult
        });
        
      case 'set-autonomy-mode':
        // Enable/disable autonomy mode
        if (payload.enabled === undefined) {
          return NextResponse.json({
            success: false,
            error: 'Enabled status is required'
          }, { status: 400 });
        }
        
        scanner.setAutonomyMode(!!payload.enabled);
        
        return NextResponse.json({
          success: true,
          message: `Autonomy mode ${payload.enabled ? 'enabled' : 'disabled'}`
        });
        
      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in market scan POST endpoint:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Failed to process market scan request',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 