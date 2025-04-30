// API route to test if memory system is working

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import * as serverQdrant from '../../../../server/qdrant';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Run a simple memory test by adding a test entry and then retrieving it
async function runMemoryTest() {
  try {
    console.log('Testing memory system');
    
    // Initialize Qdrant
    await serverQdrant.initMemory({
      useOpenAI: process.env.USE_OPENAI_EMBEDDINGS === 'true'
    });
    
    // Check if Qdrant is initialized
    const isInitialized = serverQdrant.isInitialized();
    
    // Test adding a memory
    const testContent = 'This is a test memory from the API.';
    const timestamp = Date.now();
    const id = await serverQdrant.addMemory('thought', testContent, {
      timestamp,
      source: 'memory-test-api',
      importance: 'medium'
    });
    
    console.log('Added test memory with ID:', id);
    
    // Add another memory with a unique term to search for
    const searchTerm = `test-unique-${Date.now()}`;
    const searchContent = `This is a unique test memory with term ${searchTerm}`;
    const searchId = await serverQdrant.addMemory('thought', searchContent, {
      source: 'memory-test-api',
      importance: 'high'
    });
    
    console.log('Added searchable test memory with ID:', searchId);
    
    // Test searching for the memory using the unique term
    const searchResults = await serverQdrant.searchMemory(null, searchTerm, {
      limit: 5
    });
    
    console.log(`Search returned ${searchResults.length} results`);
    
    // Get some recent memories
    const recentMemories = await serverQdrant.getRecentMemories('thought', 5);
    
    // Check memory system details
    let memorySystemInfo;
    try {
      // Attempt to access Qdrant directly to check if it's operational
      const qdrantHandler = (serverQdrant as any).qdrantInstance;
      memorySystemInfo = {
        backend: qdrantHandler && qdrantHandler.useQdrant ? 'Qdrant' : 'In-Memory Fallback',
        url: process.env.QDRANT_URL || 'http://localhost:6333'
      };
    } catch (error) {
      memorySystemInfo = {
        backend: 'In-Memory Fallback',
        error: error instanceof Error ? error.message : String(error)
      };
    }
    
    return {
      success: isInitialized,
      memorySystem: memorySystemInfo,
      testId: id,
      searchResults,
      recentMemories,
      timestamp
    };
  } catch (error) {
    console.error('Memory test failed:', error);
    return {
      success: false,
      memorySystem: {
        backend: 'Failed to determine',
        error: error instanceof Error ? error.message : String(error)
      },
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function GET() {
  const result = await runMemoryTest();
  
  return NextResponse.json(result);
} 