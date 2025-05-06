import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../server/memory/services';
import { MemoryType } from '../../../../server/memory/config';

// Make sure this is server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST handler to remove a memory by ID
 * Created as a work-around for Next.js dynamic route issues
 * @see docs/memory/NEXT_JS_API_ISSUES.md
 */
export async function POST(request: NextRequest) {
  console.log('Memory deletion request received via /api/memory/delete');
  
  try {
    // Parse request body for the memory ID and type
    const body = await request.json();
    const { id, type = MemoryType.MESSAGE, hardDelete = false } = body;
    
    console.log('Memory deletion parameters:', { id, type, hardDelete });
    
    if (!id) {
      console.error('Missing required memory ID');
      return NextResponse.json(
        { success: false, error: 'Memory ID is required' },
        { status: 400 }
      );
    }
    
    console.log(`Attempting to delete memory with ID: ${id}, type: ${type}`);
    
    // Get memory services
    const { client, memoryService } = await getMemoryServices();
    
    // Check if memory service is initialized
    const status = await client.getStatus();
    console.log(`Memory system initialized: ${status.initialized}`);
    
    // Make sure memory system is initialized
    if (!status.initialized) {
      console.log('Initializing memory system for memory deletion');
      await client.initialize();
      console.log('Memory system initialization completed');
    }
    
    // First, check if the memory exists
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
    
    // Delete the memory using memory service
    const deleteResult = await memoryService.deleteMemory({
      id,
      type,
      hardDelete
    });
    
    console.log(`Delete operation result: ${deleteResult || false}`);
    
    if (!deleteResult) {
      console.error(`Failed to delete memory with ID: ${id}`);
      return NextResponse.json(
        { success: false, error: 'Failed to delete memory' },
        { status: 500 }
      );
    }
    
    console.log(`Successfully deleted memory with id: ${id}, type: ${type}`);
    
    return NextResponse.json({
      success: true,
      message: 'Memory deleted successfully',
      deletedId: id
    });
    
  } catch (error) {
    console.error('Error in memory deletion handler:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'An error occurred while processing your request', 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
} 