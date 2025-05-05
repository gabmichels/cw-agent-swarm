import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../server/memory/services';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET handler for testing memory API without using the proxy
 */
export async function GET(request: NextRequest) {
  try {
    console.log("[memory-test] Testing direct access to memory services");
    
    // Initialize services
    const services = await getMemoryServices();
    
    // Check if services are available
    if (!services || !services.searchService) {
      console.error("[memory-test] Memory services not available");
      return NextResponse.json({
        success: false,
        error: "Memory services not available"
      }, { status: 500 });
    }
    
    // Parse query parameters
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    
    console.log(`[memory-test] Fetching up to ${limit} memories directly from search service`);
    
    // Get memories directly using search service
    const searchQuery = '';
    const searchOptions = {
      limit: limit,
      offset: 0
    };
    
    try {
      const results = await services.searchService.search(searchQuery, searchOptions);
      
      console.log(`[memory-test] Successfully fetched ${results.length} memories directly`);
      
      return NextResponse.json({
        success: true,
        memories: results,
        total: results.length,
        limit: limit
      });
    } catch (searchError) {
      console.error("[memory-test] Error searching memories:", searchError);
      return NextResponse.json({
        success: false,
        error: "Failed to search memories",
        details: searchError instanceof Error ? searchError.message : String(searchError)
      }, { status: 500 });
    }
  } catch (error) {
    console.error("[memory-test] Critical error:", error);
    return NextResponse.json({
      success: false,
      error: "Critical error processing request",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 