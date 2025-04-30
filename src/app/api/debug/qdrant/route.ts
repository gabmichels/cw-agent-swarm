import { NextResponse } from 'next/server';
import * as serverQdrant from '../../../../server/qdrant';
import { MemoryRecord } from '../../../../server/qdrant';

export const runtime = 'nodejs'; // Mark as server-side only
export const dynamic = 'force-dynamic'; // Prevent caching

export async function GET() {
  console.log("Testing Qdrant connection...");
  
  // Variable to store test results
  let connectionSuccess = false;
  let testRecordId: string | null = null;
  let searchResults: MemoryRecord[] = [];
  
  try {
    // Initialize Qdrant
    await serverQdrant.initMemory({
      useOpenAI: process.env.USE_OPENAI_EMBEDDINGS === 'true',
      forceReinit: true
    });
    
    connectionSuccess = serverQdrant.isInitialized();
    console.log(`Qdrant initialization ${connectionSuccess ? 'successful' : 'failed'}`);
    
    // Try to store a dummy message
    if (connectionSuccess) {
      try {
        // Test adding a record
        console.log("Storing test message...");
        testRecordId = await serverQdrant.addMemory('message', 'This is a test message for Qdrant debugging', {
          source: 'debug',
          importance: 'low'
        });
        console.log(`Test record stored with ID: ${testRecordId}`);
      } catch (storeError) {
        console.error("Error storing test message:", storeError);
      }
      
      // Test search
      try {
        console.log("Searching for test message...");
        searchResults = await serverQdrant.searchMemory('message', 'test message', { limit: 3 });
        console.log(`Search returned ${searchResults.length} results`);
      } catch (searchError) {
        console.error("Error searching messages:", searchError);
      }
    }
    
    return NextResponse.json({
      success: connectionSuccess,
      message: connectionSuccess ?
        'Qdrant connection successful' :
        'Failed to connect to Qdrant',
      testRecordId,
      searchResults,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Qdrant test error:", error);
    
    return NextResponse.json({
      success: false,
      message: "Server-side Qdrant connection test failed",
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, {
      status: 500
    });
  }
} 