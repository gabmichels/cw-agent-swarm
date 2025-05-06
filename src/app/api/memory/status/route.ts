import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../server/memory/services';
import { MemoryType } from '../../../../server/memory/config';

// Make sure this is server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET handler to check if a memory exists by ID
 * Created as a work-around for Next.js dynamic route issues
 * @see docs/memory/NEXT_JS_API_ISSUES.md
 */
export async function GET(request: NextRequest) {
  console.log('Memory status check request received');
  
  try {
    // Get query parameters
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const type = url.searchParams.get('type') as MemoryType || MemoryType.MESSAGE;
    
    console.log('Memory status check parameters:', { id, type });
    
    if (!id) {
      console.error('Missing required memory ID');
      return NextResponse.json(
        { exists: false, error: 'Memory ID is required' },
        { status: 400 }
      );
    }
    
    // Get memory services
    const { client, memoryService } = await getMemoryServices();
    
    // Check if memory service is initialized
    const status = await client.getStatus();
    
    // Make sure memory system is initialized
    if (!status.initialized) {
      console.log('Initializing memory system for status check');
      await client.initialize();
    }
    
    // Check if the memory exists
    try {
      const memory = await memoryService.getMemory({ id, type });
      
      if (!memory) {
        console.log(`Memory not found for ID: ${id}`);
        return NextResponse.json({ exists: false });
      }
      
      console.log(`Found memory with ID: ${memory.id}`);
      return NextResponse.json({ 
        exists: true,
        id: memory.id,
        type,
        timestamp: memory.payload?.timestamp
      });
    } catch (error) {
      console.error(`Error checking memory existence: ${error}`);
      return NextResponse.json(
        { 
          exists: false, 
          error: 'Error checking memory existence',
          details: error instanceof Error ? error.message : String(error)
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in memory status handler:', error);
    return NextResponse.json(
      { 
        exists: false, 
        error: 'An error occurred while processing your request', 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
} 