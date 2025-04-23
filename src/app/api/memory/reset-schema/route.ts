import { NextResponse } from 'next/server';
import * as serverQdrant from '../../../../server/qdrant';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    console.log('Resetting Qdrant collections...');
    
    // Force reinitialization of Qdrant
    await serverQdrant.initMemory({
      forceReinit: true
    });
    
    // Reset all collections
    const resetResult = await serverQdrant.resetAllCollections();
    
    // Check initialization status
    const isInitialized = serverQdrant.isInitialized();
    
    // Add a test record
    let testRecordId = null;
    try {
      testRecordId = await serverQdrant.addMemory('message', 'Test message after reset', {
        userId: 'test-user',
        role: 'system',
        source: 'system'
      });
      console.log(`Test record added with ID: ${testRecordId}`);
    } catch (error) {
      console.error('Error adding test record:', error);
    }
    
    return NextResponse.json({
      success: isInitialized && resetResult,
      message: 'Qdrant memory system reset successfully',
      testRecordId
    });
  } catch (error) {
    console.error('Error resetting Qdrant collections:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error during schema reset',
      error
    }, {
      status: 500
    });
  }
} 