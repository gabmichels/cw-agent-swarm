import { NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../server/memory/services';
import { MemoryType } from '../../../../server/memory/config';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    console.log('Resetting memory collections...');
    
    // Get memory services
    const { client, memoryService } = await getMemoryServices();
    
    // Force reinitialization of memory system
    await client.initialize();
    
    // Get client status
    const status = await client.getStatus();
    
    // Add a test record
    let testRecordId = null;
    try {
      const result = await memoryService.addMemory({
        type: MemoryType.MESSAGE,
        content: 'Test message after reset',
        metadata: {
          userId: 'test-user',
          role: 'system',
          source: 'system'
        }
      });
      
      testRecordId = result.success ? result.id : null;
      console.log(`Test record added with ID: ${testRecordId}`);
    } catch (error) {
      console.error('Error adding test record:', error);
    }
    
    return NextResponse.json({
      success: status.initialized,
      message: 'Memory system reset successfully',
      testRecordId,
      status
    });
  } catch (error) {
    console.error('Error resetting memory collections:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error during schema reset',
      error
    }, {
      status: 500
    });
  }
} 