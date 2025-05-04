import { NextRequest, NextResponse } from 'next/server';
import * as serverQdrant from '../../../../server/qdrant';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Check if Qdrant is initialized
    const isInitialized = serverQdrant.isInitialized();
    
    // Try to initialize if not
    if (!isInitialized) {
      await serverQdrant.initMemory();
    }
    
    // Get database health information
    const healthInfo = await serverQdrant.diagnoseDatabaseHealth();
    
    // Get message count
    const messageCount = await serverQdrant.getMessageCount();
    
    return NextResponse.json({
      success: true,
      isInitialized: serverQdrant.isInitialized(),
      messageCount,
      healthInfo,
      serverInfo: {
        qdrantUrl: process.env.QDRANT_URL || 'Not configured',
        nodeVersion: process.version,
      },
    });
  } catch (error) {
    console.error('Error testing Qdrant connection:', error);
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