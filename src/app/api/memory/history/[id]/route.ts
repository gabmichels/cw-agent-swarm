/**
 * API route for memory version history
 */
import { NextRequest, NextResponse } from 'next/server';
import { MemoryType, MemoryErrorCode } from '../../../../../server/memory/config';
import { getMemoryServices } from '../../../../../server/memory/services';
import { parseQueryParams } from '../../../../../utils/api';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET handler for memory version history
 * 
 * @param request The Next.js request object
 * @param params The route parameters containing the memory ID
 * @returns A JSON response with the memory version history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Initialize services
    const { memoryService } = await getMemoryServices();
    
    // Get memory ID from path params
    const memoryId = params.id;
    if (!memoryId) {
      return NextResponse.json({ 
        error: 'Memory ID is required' 
      }, { status: 400 });
    }
    
    // Parse query parameters
    const url = new URL(request.url);
    const queryParams = parseQueryParams(url, {
      type: { type: 'enum', enumValues: Object.values(MemoryType), defaultValue: MemoryType.MESSAGE },
      limit: { type: 'number', defaultValue: 10 }
    });
    
    // Fetch memory history using the service
    const historyItems = await memoryService.getMemoryHistory({
      id: memoryId,
      type: queryParams.type,
      limit: queryParams.limit
    });
    
    return NextResponse.json({
      history: historyItems,
      total: historyItems.length,
      memory_id: memoryId
    });
  } catch (error) {
    console.error('Error fetching memory history:', error);
    
    // Handle specific memory error types
    if (error && typeof error === 'object' && 'code' in error) {
      const memoryError = error as { code: string; message: string };
      
      if (memoryError.code === MemoryErrorCode.NOT_FOUND) {
        return NextResponse.json({ 
          error: memoryError.message || 'Memory not found',
          history: [] 
        }, { status: 404 });
      }
      
      if (memoryError.code === MemoryErrorCode.VALIDATION_ERROR) {
        return NextResponse.json({ 
          error: memoryError.message || 'Invalid request parameters',
          history: [] 
        }, { status: 400 });
      }
      
      if (memoryError.code === MemoryErrorCode.DATABASE_ERROR) {
        return NextResponse.json({ 
          error: memoryError.message || 'Database error',
          history: [] 
        }, { status: 500 });
      }
    }
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      history: []
    }, { status: 500 });
  }
} 