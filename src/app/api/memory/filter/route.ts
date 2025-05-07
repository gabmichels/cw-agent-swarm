/**
 * API route for advanced memory filtering
 * Supports filtering by tags, types, and other metadata
 */
import { NextRequest, NextResponse } from 'next/server';
import { MemoryType, MemoryErrorCode } from '../../../../server/memory/config';
import { getMemoryServices } from '../../../../server/memory/services';
import { parseQueryParams } from '../../../../utils/api';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST handler for advanced filtering
 */
export async function POST(request: NextRequest) {
  try {
    // Initialize services
    const { searchService } = await getMemoryServices();
    
    // Parse query parameters
    const url = new URL(request.url);
    const params = parseQueryParams(url, {
      limit: { type: 'number', defaultValue: 50 },
      offset: { type: 'number', defaultValue: 0 }
    });
    
    // Parse request body for filter criteria
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({
        error: 'Invalid JSON in request body',
        results: [],
        total: 0
      }, { status: 400 });
    }
    
    const { 
      tags = [], 
      types = [], 
      timeRange = null,
      metadata = {},
      sortBy = 'timestamp',
      sortOrder = 'desc',
      textSearch = ''
    } = body;
    
    // Build filter object
    const filter: Record<string, any> = {};
    
    // Add tag filtering
    if (tags && Array.isArray(tags) && tags.length > 0) {
      filter['metadata.tags'] = {
        $in: tags
      };
    }
    
    // Add time range filtering
    if (timeRange && typeof timeRange === 'object') {
      if (timeRange.startDate) {
        filter['timestamp'] = filter['timestamp'] || {};
        filter['timestamp']['$gte'] = new Date(timeRange.startDate).getTime().toString();
      }
      
      if (timeRange.endDate) {
        filter['timestamp'] = filter['timestamp'] || {};
        filter['timestamp']['$lte'] = new Date(timeRange.endDate).getTime().toString();
      }
    }
    
    // Add custom metadata filtering
    if (metadata && typeof metadata === 'object') {
      Object.entries(metadata).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          filter[`metadata.${key}`] = value;
        }
      });
    }
    
    // Perform search with filter
    try {
      // If text search is provided, use semantic search with filter
      // Otherwise, use direct filter without semantic search
      let results;
      
      if (textSearch) {
        results = await searchService.search(textSearch, {
          filter,
          limit: params.limit,
          offset: params.offset,
          types: types.length > 0 ? types : undefined
        });
      } else {
        // For pure filtering without text search, use a special method
        // that retrieves memories without semantic search
        results = await searchService.filter({
          filter,
          limit: params.limit,
          offset: params.offset,
          types: types.length > 0 ? types : undefined,
          sortBy,
          sortOrder: sortOrder as 'asc' | 'desc'
        });
      }
      
      return NextResponse.json({
        results,
        total: results.length,
        filterInfo: {
          tags,
          types,
          timeRange,
          metadata,
          limit: params.limit,
          offset: params.offset,
          sortBy,
          sortOrder,
          textSearch
        }
      });
    } catch (searchError) {
      console.error('Error during filter operation:', searchError);
      
      return NextResponse.json({
        warning: 'Filter completed with issues',
        error: searchError instanceof Error ? searchError.message : 'Filter error occurred',
        results: [],
        total: 0,
        filterInfo: {
          tags,
          types,
          timeRange,
          metadata
        }
      }, { status: 200 }); // Still return 200 so the client can handle partial results
    }
  } catch (error) {
    console.error('Error filtering memories:', error);
    
    // Handle specific memory error types
    if (error && typeof error === 'object' && 'code' in error) {
      const memoryError = error as { code: string; message: string };
      
      if (memoryError.code === MemoryErrorCode.VALIDATION_ERROR) {
        return NextResponse.json({
          error: memoryError.message || 'Invalid filter parameters',
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