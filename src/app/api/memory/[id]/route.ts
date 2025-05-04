/**
 * API routes for individual memory operations
 */
import { NextRequest, NextResponse } from 'next/server';
import { MemoryType, MemoryErrorCode } from '../../../../server/memory/config';
import { getMemoryServices } from '../../../../server/memory/services';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Get a memory by ID
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
    const includeVector = url.searchParams.get('includeVector') === 'true';
    const type = url.searchParams.get('type') as MemoryType || MemoryType.MESSAGE;
    
    // Get memory
    const memory = await memoryService.getMemory({
      id: memoryId,
      type,
      includeVector
    });

    if (!memory) {
      return NextResponse.json({ 
        error: 'Memory not found' 
      }, { status: 404 });
    }

    return NextResponse.json({ memory });
  } catch (error) {
    console.error('Error getting memory:', error);
    
    // Handle specific memory error types
    if (error && typeof error === 'object' && 'code' in error) {
      const memoryError = error as { code: string; message: string };
      
      if (memoryError.code === MemoryErrorCode.NOT_FOUND) {
        return NextResponse.json({ 
          error: memoryError.message || 'Memory not found' 
        }, { status: 404 });
      }
      
      if (memoryError.code === MemoryErrorCode.VALIDATION_ERROR) {
        return NextResponse.json({ 
          error: memoryError.message || 'Invalid request parameters' 
        }, { status: 400 });
      }
    }
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Update a memory by ID
 */
export async function PATCH(
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

    // Parse request body
    const body = await request.json();
    const { content, metadata, payload, type = MemoryType.MESSAGE, preserveEmbedding = false } = body;
    
    // Validate at least one field to update is provided
    if (!content && !metadata && !payload) {
      return NextResponse.json({ 
        error: 'No update fields provided' 
      }, { status: 400 });
    }

    // Update memory
    const success = await memoryService.updateMemory({
      id: memoryId,
      type,
      content,
      metadata,
      payload,
      preserveEmbedding
    });

    if (!success) {
      return NextResponse.json({ 
        error: 'Failed to update memory' 
      }, { status: 500 });
    }

    // Get updated memory
    const updatedMemory = await memoryService.getMemory({
      id: memoryId,
      type
    });

    return NextResponse.json({ 
      success, 
      memory: updatedMemory 
    });
  } catch (error) {
    console.error('Error updating memory:', error);
    
    // Handle specific memory error types
    if (error && typeof error === 'object' && 'code' in error) {
      const memoryError = error as { code: string; message: string };
      
      if (memoryError.code === MemoryErrorCode.NOT_FOUND) {
        return NextResponse.json({ 
          error: memoryError.message || 'Memory not found' 
        }, { status: 404 });
      }
      
      if (memoryError.code === MemoryErrorCode.VALIDATION_ERROR) {
        return NextResponse.json({ 
          error: memoryError.message || 'Invalid request parameters' 
        }, { status: 400 });
      }
    }
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Delete a memory by ID
 */
export async function DELETE(
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
    const hardDelete = url.searchParams.get('hardDelete') === 'true';
    const type = url.searchParams.get('type') as MemoryType || MemoryType.MESSAGE;
    
    // Delete memory
    const success = await memoryService.deleteMemory({
      id: memoryId,
      type,
      hardDelete
    });

    if (!success) {
      return NextResponse.json({ 
        error: 'Failed to delete memory' 
      }, { status: 500 });
    }

    return NextResponse.json({ success });
  } catch (error) {
    console.error('Error deleting memory:', error);
    
    // Handle specific memory error types
    if (error && typeof error === 'object' && 'code' in error) {
      const memoryError = error as { code: string; message: string };
      
      if (memoryError.code === MemoryErrorCode.NOT_FOUND) {
        return NextResponse.json({ 
          error: memoryError.message || 'Memory not found' 
        }, { status: 404 });
      }
      
      if (memoryError.code === MemoryErrorCode.VALIDATION_ERROR) {
        return NextResponse.json({ 
          error: memoryError.message || 'Invalid request parameters' 
        }, { status: 400 });
      }
    }
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 