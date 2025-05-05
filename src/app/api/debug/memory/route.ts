import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../server/memory/services';
import { MemoryType } from '../../../../server/memory/config';

// Add server-only markers to prevent client-side execution
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Debug endpoint to examine memory contents
 * GET /api/debug/memory
 */
export async function GET(request: NextRequest) {
  try {
    console.log('Debug: Fetching all memory items');
    
    // Get memory services
    const { client, searchService } = await getMemoryServices();
    
    // Initialize client if needed
    const status = await client.getStatus();
    if (!status.initialized) {
      console.log('Initializing memory services...');
      await client.initialize();
    }
    
    // Fetch all message type memories
    const results = await searchService.search("", {
      limit: 100,
      types: [MemoryType.MESSAGE]
    });
    
    console.log(`Debug: Found ${results.length} memory items`);
    
    // Extract basic information from each memory
    const memoryItems = results.map(result => {
      const point = result.point;
      try {
        const payload = point.payload || {};
        const metadata = payload.metadata || {};
        
        return {
          id: point.id,
          type: (point as any).type || payload.type || 'unknown',
          text: payload.text?.substring(0, 100) + (payload.text?.length > 100 ? '...' : ''),
          timestamp: payload.timestamp,
          role: metadata.role,
          userId: metadata.userId,
          isForChat: metadata.isForChat,
          isInternal: metadata.isInternal,
          source: metadata.source,
          hasAttachments: !!(metadata.attachments && metadata.attachments.length > 0)
        };
      } catch (error) {
        console.error('Error processing memory item:', error);
        return {
          id: point.id || 'unknown',
          error: 'Failed to process memory item',
          rawData: point
        };
      }
    });
    
    // Return debug information
    return NextResponse.json({
      status: 'success',
      count: memoryItems.length,
      items: memoryItems,
      clientStatus: status
    });
  } catch (error) {
    console.error('Error fetching memory for debug:', error);
    return NextResponse.json(
      { 
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 