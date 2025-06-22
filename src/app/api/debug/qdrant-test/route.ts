import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../server/memory/services';
import { MemoryType } from '../../../../server/memory/config';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Define proper type for health info
interface HealthInfo {
  status: 'ok' | 'error';
  collections: Record<string, { status: string; count: number }>;
  error: null | string;
}

export async function GET(req: NextRequest) {
  try {
    // Get memory services
    const { client, searchService } = await getMemoryServices();
    
    // Check if memory client is initialized
    const status = await client.getStatus();
    
    // Try to initialize if not
    if (!status.initialized) {
      await client.initialize();
    }
    
    // Get health information
    const healthInfo: HealthInfo = {
      status: 'ok',
      collections: {},
      error: null
    };
    
    try {
      // Check if we can query each collection
      for (const type of Object.values(MemoryType)) {
        if (!isNaN(Number(type))) continue; // Skip numeric enum values
        
        const results = await searchService.search('', {
          types: [type as MemoryType],
          limit: 1
        });
        
        // Use string key to avoid TypeScript indexed access error
        const typeKey = type.toString();
        healthInfo.collections[typeKey] = {
          status: 'ok',
          count: results.length
        };
      }
    } catch (healthError) {
      healthInfo.status = 'error';
      // Ensure error is set to a string, maintaining the null type for normal operation
      if (healthError) {
        healthInfo.error = healthError instanceof Error ? healthError.message : String(healthError);
      }
    }
    
    // Get message count
    const messageResults = await searchService.search('', {
      types: [MemoryType.MESSAGE],
      limit: 1
    });
    
    const messageCount = messageResults.length > 0 ? messageResults.length : 0;
    
    return NextResponse.json({
      success: true,
      isInitialized: status.initialized,
      messageCount,
      healthInfo,
      serverInfo: {
        qdrantUrl: process.env.QDRANT_URL || 'Not configured',
        nodeVersion: process.version,
      },
    });
  } catch (error) {
    console.error('Error testing memory service connection:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 