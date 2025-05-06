/**
 * API route for memory operations (list and create)
 */
import { NextRequest, NextResponse } from 'next/server';
import { MemoryType, MemoryErrorCode } from '../../../server/memory/config';
import { getMemoryServices } from '../../../server/memory/services';
import { parseQueryParams } from '../../../utils/api';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET endpoint to list memories
 * 
 * @param request The Next.js request object
 * @returns A JSON response with a list of memories
 */
export async function GET(request: NextRequest) {
  try {
    // Initialize services
    const { searchService } = await getMemoryServices();
    
    // Parse query parameters
    const url = new URL(request.url);
    const params = parseQueryParams(url, {
      type: { type: 'enum', enumValues: Object.values(MemoryType) },
      limit: { type: 'number', defaultValue: 10 },
      offset: { type: 'number', defaultValue: 0 }
    });
    
    // Get memories (using search with empty query to list all)
    const searchQuery = '';
    const searchOptions = {
      types: params.type ? [params.type] : undefined,
      limit: params.limit,
      offset: params.offset
    };
    
    const results = await searchService.search(searchQuery, searchOptions);
    
    return NextResponse.json({
      memories: results,
      total: results.length,
      limit: params.limit,
      offset: params.offset,
      type: params.type
    });
  } catch (error) {
    console.error('Error listing memories:', error);
    
    // Handle specific memory error types
    if (error && typeof error === 'object' && 'code' in error) {
      const memoryError = error as { code: string; message: string };
      
      if (memoryError.code === MemoryErrorCode.DATABASE_ERROR) {
        return NextResponse.json({
          error: memoryError.message || 'Database error',
          memories: []
        }, { status: 500 });
      }
      
      if (memoryError.code === MemoryErrorCode.VALIDATION_ERROR) {
        return NextResponse.json({
          error: memoryError.message || 'Invalid request parameters',
          memories: []
        }, { status: 400 });
      }
    }
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      memories: []
    }, { status: 500 });
  }
}

/**
 * POST endpoint to create a new memory
 * 
 * @param request The Next.js request object
 * @returns A JSON response with the created memory
 */
export async function POST(request: NextRequest) {
  try {
    // Initialize services
    const { memoryService } = await getMemoryServices();
    
    // Parse request body
    const body = await request.json();
    const { type, content, metadata, embedding, id } = body;
    
    // Validate required fields
    if (!type || !content) {
      return NextResponse.json({
        error: 'Memory type and content are required',
        success: false
      }, { status: 400 });
    }
    
    // Validate memory type
    if (!Object.values(MemoryType).includes(type)) {
      return NextResponse.json({
        error: `Invalid memory type: ${type}`,
        success: false
      }, { status: 400 });
    }
    
    // Ensure userId is set in metadata
    const safeMetadata = {
      ...metadata,
      userId: metadata?.userId ? String(metadata.userId) : 'gab' // Ensure userId is always set with default 'gab'
    };
    
    // Add memory
    const result = await memoryService.addMemory({
      type,
      content,
      metadata: safeMetadata, // Use the updated metadata with guaranteed userId
      embedding,
      id
    });
    
    if (!result.success) {
      return NextResponse.json({
        error: result.error?.message || 'Failed to add memory',
        code: result.error?.code,
        success: false
      }, { status: 500 });
    }
    
    // Get the newly created memory
    const memory = await memoryService.getMemory({
      id: result.id!,
      type
    });
    
    return NextResponse.json({
      success: true,
      memory,
      id: result.id
    }, { status: 201 });
  } catch (error) {
    console.error('Error adding memory:', error);
    
    // Handle specific memory error types
    if (error && typeof error === 'object' && 'code' in error) {
      const memoryError = error as { code: string; message: string };
      
      if (memoryError.code === MemoryErrorCode.VALIDATION_ERROR) {
        return NextResponse.json({
          error: memoryError.message || 'Invalid memory data',
          success: false
        }, { status: 400 });
      }
      
      if (memoryError.code === MemoryErrorCode.EMBEDDING_ERROR) {
        return NextResponse.json({
          error: memoryError.message || 'Error generating embeddings',
          success: false
        }, { status: 500 });
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