// API route to test if memory system is working

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getMemoryServices } from '../../../../server/memory/services';
import { MemoryType, ImportanceLevel } from '../../../../server/memory/config';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Run a simple memory test by adding a test entry and then retrieving it
async function runMemoryTest() {
  try {
    console.log('Testing memory system');
    
    // Get memory services
    const memoryServices = await getMemoryServices();
    
    // Test adding a memory
    const testContent = 'This is a test memory from the API.';
    const timestamp = Date.now();
    const memoryResult = await memoryServices.memoryService.addMemory({
      type: MemoryType.THOUGHT,
      content: testContent,
      metadata: {
        userId: 'gab',
        timestamp,
        source: 'memory-test-api',
        importance: ImportanceLevel.MEDIUM
      }
    });
    
    const id = memoryResult.id;
    console.log('Added test memory with ID:', id);
    
    // Add another memory with a unique term to search for
    const searchTerm = `test-unique-${Date.now()}`;
    const searchContent = `This is a unique test memory with term ${searchTerm}`;
    const searchMemory = await memoryServices.memoryService.addMemory({
      type: MemoryType.THOUGHT,
      content: searchContent,
      metadata: {
        userId: 'gab',
        source: 'memory-test-api',
        importance: ImportanceLevel.HIGH
      }
    });
    
    const searchId = searchMemory.id;
    console.log('Added searchable test memory with ID:', searchId);
    
    // Test searching for the memory using the unique term
    const searchResults = await memoryServices.searchService.search(searchTerm, {
      limit: 5
    });
    
    console.log(`Search returned ${searchResults.length} results`);
    
    // Get some recent memories
    const recentMemories = await memoryServices.memoryService.searchMemories({
      type: MemoryType.THOUGHT,
      limit: 5
    });
    
    // Check memory system details
    let memorySystemInfo;
    try {
      memorySystemInfo = {
        backend: 'Qdrant',
        initialized: true,
        url: process.env.QDRANT_URL || 'http://localhost:6333'
      };
    } catch (error) {
      memorySystemInfo = {
        backend: 'Unknown',
        error: error instanceof Error ? error.message : String(error)
      };
    }
    
    return {
      success: true,
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