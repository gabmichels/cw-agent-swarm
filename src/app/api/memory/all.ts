import { NextRequest, NextResponse } from 'next/server';
import * as serverQdrant from '../../../server/qdrant';

/**
 * API endpoint to fetch all memories from Chloe's knowledge base
 */
export async function GET(req: NextRequest) {
  try {
    console.log('[memory/all] Initializing memory system to fetch all memories');
    
    // Get query parameters
    const { searchParams } = new URL(req.url);
    const queryLimit = searchParams.get('limit');
    const limit = queryLimit ? parseInt(queryLimit, 10) : 100;
    const type = searchParams.get('type') as 'message' | 'thought' | 'document' | 'task' | null;
    
    // Get all tags from the search params (can be multiple)
    const tags = searchParams.getAll('tags');
    
    // Init memory system
    await serverQdrant.initMemory({
      useOpenAI: process.env.USE_OPENAI_EMBEDDINGS === 'true'
    });
    
    console.log(`[memory/all] Fetching memories with type=${type || 'all'}, limit=${limit}, tags=${tags.join(',') || 'none'}`);
    
    // Create filter for tags if provided
    const filter: Record<string, any> = {};
    
    // Only add tags filter if tags are provided
    if (tags && tags.length > 0) {
      filter.tags = tags;
    }
    
    // Get memory entries from Qdrant
    const memoryEntries = await serverQdrant.searchMemory(
      type,  // can be null to search all types
      '',    // empty query to match everything
      {
        filter,
        limit
      }
    );
    
    console.log(`[memory/all] Retrieved ${memoryEntries?.length || 0} memory entries`);
    
    // Ensure we have arrays, even if the API returns null/undefined
    const safeMemoryEntries = Array.isArray(memoryEntries) ? memoryEntries : [];
    
    // Combine and format all memories
    const allMemories = safeMemoryEntries
      .map(formatMemory)
      .filter(Boolean); // Filter out null values
    
    console.log(`[memory/all] Returning ${allMemories.length} formatted memories`);
    
    // Always return an array (even if empty)
    return NextResponse.json(allMemories);
  } catch (error) {
    console.error('Error fetching memories:', error);
    // Return an empty array on error
    return NextResponse.json([]);
  }
}

/**
 * Helper function to format memory records
 */
function formatMemory(record: any) {
  if (!record) {
    console.warn('Received undefined or null memory record');
    return null;
  }
  
  try {
    return {
      id: record.id || `id-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      content: record.text || '',
      created: record.timestamp || new Date().toISOString(),
      timestamp: record.timestamp || new Date().toISOString(),
      type: record.type || 'unknown',
      category: record.metadata?.category || record.metadata?.tag || record.type || 'unknown',
      source: record.metadata?.source || 'system',
      importance: record.metadata?.importance || 'medium',
      tags: Array.isArray(record.metadata?.tags) ? record.metadata.tags : []
    };
  } catch (err) {
    console.error('Error formatting memory record:', err, record);
    return null;
  }
} 