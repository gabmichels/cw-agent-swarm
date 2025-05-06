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
  context: { params: { id: string } }
) {
  try {
    // Initialize services
    const { memoryService } = await getMemoryServices();
    
    // Get memory ID from context params
    const id = context.params.id;
    console.log(`Processing GET request for memory ID: ${id}`);
    
    if (!id) {
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
      id,
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
  context: { params: { id: string } }
) {
  try {
    // Initialize services
    const { memoryService } = await getMemoryServices();
    
    // Get memory ID from context params
    const id = context.params.id;
    console.log(`Processing PATCH request for memory ID: ${id}`);
    
    if (!id) {
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
      id,
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
      id,
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
  context: { params: { id: string } }
) {
  console.log(`Received DELETE request for memory`);
  
  try {
    // Initialize services
    const { memoryService } = await getMemoryServices();
    
    // Get memory ID from context params
    const id = context.params.id;
    console.log(`Processing memory ID: ${id}`);
    
    if (!id) {
      console.error('Cannot delete: Memory ID is missing');
      return NextResponse.json({ 
        success: false,
        error: 'Memory ID is required' 
      }, { status: 400 });
    }

    // Parse query parameters
    const url = new URL(request.url);
    const hardDelete = url.searchParams.get('hardDelete') === 'true';
    const type = url.searchParams.get('type') as MemoryType || MemoryType.MESSAGE;
    
    console.log(`Attempting to delete memory: ${id}, type: ${type}, hardDelete: ${hardDelete}`);
    
    // Double-check that the memory exists first
    try {
      const memory = await memoryService.getMemory({ id, type });
      if (!memory) {
        console.log(`Memory not found for ID: ${id}`);
        return NextResponse.json({ 
          success: false,
          error: 'Memory not found' 
        }, { status: 404 });
      }
      console.log(`Found memory to delete: ${memory.id}`);
    } catch (checkError) {
      console.error(`Error checking memory existence: ${checkError}`);
    }
    
    // Delete memory
    try {
      console.log(`Calling deleteMemory with id: ${id}, type: ${type}`);
      const success = await memoryService.deleteMemory({
        id,
        type,
        hardDelete
      });

      console.log(`Memory deletion result: ${success}`);
      
      if (!success) {
        console.error(`Failed to delete memory: ${id}`);
        return NextResponse.json({
          success: false, 
          error: 'Failed to delete memory' 
        }, { status: 500 });
      }
      
      console.log(`Successfully deleted memory with ID: ${id}`);
      return NextResponse.json({ success: true });
    } catch (deleteError) {
      console.error(`Error during deletion operation: ${deleteError}`);
      return NextResponse.json({
        success: false,
        error: `Deletion operation failed: ${deleteError instanceof Error ? deleteError.message : String(deleteError)}`
      }, { status: 500 });
    }
  } catch (error) {
    console.error(`Error in DELETE handler: ${error}`);
    
    // Handle specific memory error types
    if (error && typeof error === 'object' && 'code' in error) {
      const memoryError = error as { code: string; message: string };
      
      if (memoryError.code === MemoryErrorCode.NOT_FOUND) {
        return NextResponse.json({ 
          success: false,
          error: memoryError.message || 'Memory not found' 
        }, { status: 404 });
      }
      
      if (memoryError.code === MemoryErrorCode.VALIDATION_ERROR) {
        return NextResponse.json({ 
          success: false,
          error: memoryError.message || 'Invalid request parameters' 
        }, { status: 400 });
      }
    }
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 