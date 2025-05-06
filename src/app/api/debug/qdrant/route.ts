import { NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../server/memory/services';
import { MemoryType, ImportanceLevel } from '../../../../server/memory/config';
import { BaseMemorySchema, MemoryPoint } from '../../../../server/memory/models';

export const runtime = 'nodejs'; // Mark as server-side only
export const dynamic = 'force-dynamic'; // Prevent caching

export async function GET() {
  console.log("Testing memory service connection...");
  
  // Variable to store test results
  let connectionSuccess = false;
  let testRecordId: string | null = null;
  let searchResults: any[] = [];
  
  try {
    // Get memory services
    const { client, memoryService, searchService } = await getMemoryServices();
    
    // Initialize memory services if needed
    const status = await client.getStatus();
    if (!status.initialized) {
      await client.initialize();
    }
    
    connectionSuccess = (await client.getStatus()).initialized;
    console.log(`Memory service initialization ${connectionSuccess ? 'successful' : 'failed'}`);
    
    // Try to store a dummy message
    if (connectionSuccess) {
      try {
        // Test adding a record
        console.log("Storing test message...");
        const result = await memoryService.addMemory({
          type: MemoryType.MESSAGE,
          content: 'This is a test message for memory service debugging',
          metadata: {
            userId: 'gab',
            source: 'debug',
            importance: ImportanceLevel.LOW
          }
        });
        
        if (result && result.id) {
          testRecordId = result.id;
          console.log(`Test record stored with ID: ${testRecordId}`);
        } else {
          console.log('Test record creation did not return a valid ID');
        }
      } catch (storeError) {
        console.error("Error storing test message:", storeError);
      }
      
      // Test search
      try {
        console.log("Searching for test message...");
        const results = await searchService.search('test message', { 
          types: [MemoryType.MESSAGE],
          limit: 3 
        });
        
        searchResults = results.map(result => ({
          id: result.point.id,
          text: result.point.payload.text,
          score: result.score,
          type: result.type
        }));
        
        console.log(`Search returned ${searchResults.length} results`);
      } catch (searchError) {
        console.error("Error searching messages:", searchError);
      }
    }
    
    return NextResponse.json({
      success: connectionSuccess,
      message: connectionSuccess ?
        'Memory service connection successful' :
        'Failed to connect to memory service',
      testRecordId,
      searchResults,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Memory service test error:", error);
    
    return NextResponse.json({
      success: false,
      message: "Server-side memory service connection test failed",
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, {
      status: 500
    });
  }
} 