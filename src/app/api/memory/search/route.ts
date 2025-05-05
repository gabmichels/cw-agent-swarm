/**
 * API route for memory vector search
 */
import { NextRequest, NextResponse } from 'next/server';
import { MemoryType, MemoryErrorCode } from '../../../../server/memory/config';
import { getMemoryServices } from '../../../../server/memory/services';
import { parseQueryParams } from '../../../../utils/api';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST handler for semantic vector search
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
      offset: { type: 'number', defaultValue: 0 }
    });
    
    // Parse request body for filter
    let filter = {};
    let types: MemoryType[] = [];
    
    try {
      const body = await request.json();
      filter = body.filter || {};
      types = body.types || [];
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
    
    // Perform search with graceful error handling
    try {
      const results = await searchService.search(params.query, {
        filter,
        limit: params.limit,
        offset: params.offset,
        types
      });
      
      return NextResponse.json({
        results,
        total: results.length,
        searchInfo: {
          query: params.query,
          filter,
          limit: params.limit,
          offset: params.offset,
          types
        }
      });
    } catch (searchError) {
      // For search errors, provide more detailed information but don't fail completely
      console.error('Error during search operation:', searchError);
      
      return NextResponse.json({
        warning: 'Search completed with issues',
        error: searchError instanceof Error ? searchError.message : 'Search error occurred',
        results: [],
        total: 0,
        searchInfo: {
          query: params.query,
          filter,
          limit: params.limit,
          offset: params.offset,
          types
        }
      }, { status: 200 }); // Still return 200 so the client can handle partial results
    }
  } catch (error) {
    console.error('Error searching memories:', error);
    
    // Handle specific memory error types
    if (error && typeof error === 'object' && 'code' in error) {
      const memoryError = error as { code: string; message: string };
      
      if (memoryError.code === MemoryErrorCode.EMBEDDING_ERROR) {
        return NextResponse.json({
          error: memoryError.message || 'Error generating embeddings for search',
          results: [],
          total: 0
        }, { status: 500 });
      }
      
      if (memoryError.code === MemoryErrorCode.VALIDATION_ERROR) {
        return NextResponse.json({
          error: memoryError.message || 'Invalid search parameters',
          results: [],
          total: 0
        }, { status: 400 });
      }
      
      // Add specific handling for collection not found errors
      if (memoryError.code === MemoryErrorCode.NOT_FOUND) {
        return NextResponse.json({
          warning: 'Some collections were not found',
          error: memoryError.message || 'One or more collections do not exist',
          results: [],
          total: 0
        }, { status: 200 }); // Use 200 status with warning to avoid breaking clients
      }
    }
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      results: [],
      total: 0
    }, { status: 500 });
  }
}

/**
 * GET handler for backward compatibility
 */
export async function GET(request: NextRequest) {
  try {
    // Initialize services
    const { searchService } = await getMemoryServices();
    
    // Parse query parameters
    const url = new URL(request.url);
    const query = url.searchParams.get('query') || '';
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    
    // Validate query parameter is provided
    if (!query) {
      return NextResponse.json({
        error: 'Search query is required',
        results: [],
        total: 0
      }, { status: 400 });
    }
    
    // Perform search
    const results = await searchService.search(query, {
      limit,
      offset
    });
    
    return NextResponse.json({
      results,
      total: results.length,
      searchInfo: {
        query,
        limit,
        offset
      }
    });
  } catch (error) {
    console.error('Error searching memories:', error);
    
    // Handle specific memory error types
    if (error && typeof error === 'object' && 'code' in error) {
      const memoryError = error as { code: string; message: string };
      
      if (memoryError.code === MemoryErrorCode.EMBEDDING_ERROR) {
        return NextResponse.json({
          error: memoryError.message || 'Error generating embeddings for search',
          results: [],
          total: 0
        }, { status: 500 });
      }
      
      if (memoryError.code === MemoryErrorCode.VALIDATION_ERROR) {
        return NextResponse.json({
          error: memoryError.message || 'Invalid search parameters',
          results: [],
          total: 0
        }, { status: 400 });
      }
    }
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      results: [],
      total: 0
    }, { status: 500 });
  }
} 