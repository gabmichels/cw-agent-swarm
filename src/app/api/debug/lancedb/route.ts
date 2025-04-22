import { NextResponse } from 'next/server';
import { LanceDBMemory } from '../../../../lib/memory';
import { MemoryRecord } from '../../../../lib/memory/src/lancedb';
import fs from 'fs';
import path from 'path';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log("Starting LanceDB debug test...");
    
    // Initialize LanceDB
    const lanceDB = new LanceDBMemory({
      useOpenAI: process.env.USE_OPENAI_EMBEDDINGS === 'true',
    });
    
    console.log("Initializing LanceDB...");
    // Initialize the connection
    await lanceDB.initialize();
    console.log("LanceDB initialized");
    
    // Generate a manual test report
    const dataDir = process.env.LANCEDB_DATA_DIR || './data/lance';
    const dirExists = fs.existsSync(dataDir);
    console.log(`Data directory ${dataDir} exists: ${dirExists}`);
    
    let connectionSuccess = lanceDB.isInitialized();
    console.log(`Connection initialized: ${connectionSuccess}`);
    
    // Try to store a dummy message (simpler than a thought to reduce errors)
    let storeSuccess = false;
    let searchSuccess = false;
    let testRecord = null;
    let searchResults: MemoryRecord[] = [];
    
    try {
      console.log("Storing test message...");
      testRecord = await lanceDB.storeMessage({
        role: 'system',
        content: 'This is a test message for LanceDB debugging',
      });
      storeSuccess = !!testRecord;
      console.log(`Store success: ${storeSuccess}`);
      
      // Only try search if store worked
      if (storeSuccess) {
        console.log("Searching for test message...");
        searchResults = await lanceDB.searchMemory({
          query: 'test message',
          limit: 3
        });
        searchSuccess = searchResults.length > 0;
        console.log(`Search success: ${searchSuccess}, found ${searchResults.length} results`);
      }
    } catch (opError) {
      console.error("Failed during store/search operations:", opError);
    }
    
    // Return comprehensive debug information
    return NextResponse.json({
      success: connectionSuccess,
      message: connectionSuccess ? 
        "LanceDB connection test successful" : 
        "LanceDB connection failed",
      details: {
        dataDirectory: dataDir,
        directoryExists: dirExists,
        connectionEstablished: connectionSuccess,
        storeOperationSuccess: storeSuccess,
        searchOperationSuccess: searchSuccess,
        recordsFound: searchResults.length
      },
      testRecord: storeSuccess ? testRecord : null,
      searchResults: searchSuccess ? searchResults : [],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error testing LanceDB:", error);
    
    return NextResponse.json({
      success: false,
      message: "LanceDB connection test failed",
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 