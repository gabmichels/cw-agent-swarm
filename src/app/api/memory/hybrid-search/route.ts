/**
 * API route for memory hybrid search (vector + keyword)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../server/memory/services';
import { parseQueryParams } from '../../../../utils/api';
import { MemoryErrorCode } from '../../../../server/memory/config';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST handler for hybrid search
 * 
 * @param request The Next.js request object
 * @returns A JSON response with search results
 */
export async function POST(request: NextRequest) {
  try {
    // Initialize services
    const { searchService } = await getMemoryServices();
    
    // Parse query parameters
    const url = new URL(request.url);
    const params = parseQueryParams(url, {
      query: { type: 'string', defaultValue: '' },
      limit: { type: 'number', defaultValue: 10 },
      offset: { type: 'number', defaultValue: 0 },
      hybridRatio: { type: 'number', defaultValue: 0.7 }
    });
    
    // Parse request body for filter
    let filter = {};
    try {
      const body = await request.json();
      filter = body.filter || {};
    } catch (e) {
      // Ignore JSON parsing errors
    }
    
    // Validate query parameter is provided
    if (!params.query) {
      return NextResponse.json({
        error: 'Search query is required',
        results: [],
        total: 0
      }, { status: 400 });
    }
    
    // Perform hybrid search
    const results = await searchService.hybridSearch(params.query, {
      filter,
      limit: params.limit,
      offset: params.offset,
      textWeight: 1 - params.hybridRatio,
      vectorWeight: params.hybridRatio
    });
    
    return NextResponse.json({
      results,
      total: results.length,
      searchInfo: {
        query: params.query,
        filter,
        limit: params.limit,
        offset: params.offset,
        hybridRatio: params.hybridRatio
      }
    });
  } catch (error) {
    console.error('Error performing hybrid search:', error);
    
    // Handle specific memory error types
    if (error && typeof error === 'object' && 'code' in error) {
      const memoryError = error as { code: string; message: string };
      
      if (memoryError.code === MemoryErrorCode.VALIDATION_ERROR) {
        return NextResponse.json({
          error: memoryError.message || 'Invalid search parameters',
          results: [],
          total: 0
        }, { status: 400 });
      }
      
      if (memoryError.code === MemoryErrorCode.DATABASE_ERROR) {
        return NextResponse.json({
          error: memoryError.message || 'Database error',
          results: [],
          total: 0
        }, { status: 500 });
      }
      
      if (memoryError.code === MemoryErrorCode.EMBEDDING_ERROR) {
        return NextResponse.json({
          error: memoryError.message || 'Error generating embeddings for search',
          results: [],
          total: 0
        }, { status: 500 });
      }
    }
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      results: [],
      total: 0
    }, { status: 500 });
  }
} 