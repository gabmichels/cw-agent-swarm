/**
 * API route for memory contexts
 */
import { NextRequest, NextResponse } from 'next/server';
import { MemoryErrorCode } from '../../../../server/memory/config';
import { getMemoryServices } from '../../../../server/memory/services';
import { parseQueryParams } from '../../../../utils/api';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Custom error code for context-related errors
const CONTEXT_ERROR = 'MEMORY_CONTEXT_ERROR';

/**
 * GET endpoint to retrieve memory context
 * 
 * @param request The Next.js request object
 * @returns A JSON response with the memory context
 */
export async function GET(request: NextRequest) {
  try {
    // Initialize services
    const { searchService } = await getMemoryServices();
    
    // Parse query parameters
    const url = new URL(request.url);
    const params = parseQueryParams(url, {
      query: { type: 'string' },
      types: { type: 'array' },
      maxMemoriesPerGroup: { type: 'number', defaultValue: 5 },
      maxTotalMemories: { type: 'number', defaultValue: 20 },
      includeSummary: { type: 'boolean', defaultValue: false },
      minScore: { type: 'number', defaultValue: 0.6 },
      timeWeighted: { type: 'boolean', defaultValue: false },
      numGroups: { type: 'number', defaultValue: 3 },
      groupingStrategy: { type: 'string', defaultValue: 'topic' }
    });

    // Extract filter parameters if provided
    const filterParams: Record<string, string> = {};
    Array.from(url.searchParams.keys()).forEach(key => {
      if (key.startsWith('filter.')) {
        const filterKey = key.replace('filter.', '');
        const value = url.searchParams.get(key);
        if (value !== null) {
          filterParams[filterKey] = value;
        }
      }
    });
    
    // Get memory context with options
    const result = await searchService.getMemoryContext({
      query: params.query,
      filter: Object.keys(filterParams).length > 0 ? filterParams : undefined,
      types: params.types,
      maxMemoriesPerGroup: params.maxMemoriesPerGroup,
      maxTotalMemories: params.maxTotalMemories,
      includeSummary: params.includeSummary,
      minScore: params.minScore,
      timeWeighted: params.timeWeighted,
      numGroups: params.numGroups,
      groupingStrategy: params.groupingStrategy === 'topic' || 
                        params.groupingStrategy === 'time' || 
                        params.groupingStrategy === 'type' || 
                        params.groupingStrategy === 'custom' 
                        ? params.groupingStrategy 
                        : 'topic'
    });
    
    return NextResponse.json({
      context: result,
      success: true
    });
  } catch (error) {
    console.error('Error retrieving memory context:', error);
    
    // Handle specific memory error types
    if (error && typeof error === 'object' && 'code' in error) {
      const memoryError = error as { code: string; message: string };
      
      if (memoryError.code === CONTEXT_ERROR) {
        return NextResponse.json({
          error: memoryError.message || 'Error creating memory context',
          success: false
        }, { status: 500 });
      }
      
      if (memoryError.code === MemoryErrorCode.VALIDATION_ERROR) {
        return NextResponse.json({
          error: memoryError.message || 'Invalid request parameters',
          success: false
        }, { status: 400 });
      }
      
      if (memoryError.code === MemoryErrorCode.DATABASE_ERROR) {
        return NextResponse.json({
          error: memoryError.message || 'Database error',
          success: false
        }, { status: 500 });
      }
    }
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false
    }, { status: 500 });
  }
}

/**
 * POST endpoint to create a memory context with more complex filters
 * 
 * @param request The Next.js request object
 * @returns A JSON response with the memory context
 */
export async function POST(request: NextRequest) {
  try {
    // Initialize services
    const { searchService } = await getMemoryServices();
    
    // Parse request body
    const body = await request.json();
    const { 
      query, 
      filter, 
      types, 
      maxMemoriesPerGroup = 5, 
      maxTotalMemories = 20,
      includeSummary = false,
      minScore = 0.6,
      timeWeighted = false,
      numGroups = 3,
      includedGroups = [],
      groupingStrategy = 'topic'
    } = body;
    
    // Validate required parameters
    if (!query && (!filter || Object.keys(filter).length === 0)) {
      return NextResponse.json({
        error: 'Either query or filter must be provided',
        success: false
      }, { status: 400 });
    }
    
    // Get memory context with options
    const result = await searchService.getMemoryContext({
      query,
      filter,
      types,
      maxMemoriesPerGroup,
      maxTotalMemories,
      includeSummary,
      minScore,
      timeWeighted,
      numGroups,
      includedGroups,
      groupingStrategy: ['topic', 'time', 'type', 'custom'].includes(groupingStrategy) 
                        ? groupingStrategy 
                        : 'topic'
    });
    
    return NextResponse.json({
      context: result,
      success: true
    });
  } catch (error) {
    console.error('Error retrieving memory context:', error);
    
    // Handle specific memory error types
    if (error && typeof error === 'object' && 'code' in error) {
      const memoryError = error as { code: string; message: string };
      
      if (memoryError.code === CONTEXT_ERROR) {
        return NextResponse.json({
          error: memoryError.message || 'Error creating memory context',
          success: false
        }, { status: 500 });
      }
      
      if (memoryError.code === MemoryErrorCode.VALIDATION_ERROR) {
        return NextResponse.json({
          error: memoryError.message || 'Invalid request parameters',
          success: false
        }, { status: 400 });
      }
      
      if (memoryError.code === MemoryErrorCode.DATABASE_ERROR) {
        return NextResponse.json({
          error: memoryError.message || 'Database error',
          success: false
        }, { status: 500 });
      }
    }
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false
    }, { status: 500 });
  }
} 