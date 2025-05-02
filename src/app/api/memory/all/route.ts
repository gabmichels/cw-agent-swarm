import { NextRequest, NextResponse } from 'next/server';
import * as serverQdrant from '../../../../server/qdrant';

export const runtime = 'nodejs';

/**
 * API endpoint to fetch all memories from Chloe's knowledge base
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[memory/all/route] Initializing memory system to fetch memories');
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const queryLimit = searchParams.get('limit');
    const limit = queryLimit ? parseInt(queryLimit, 10) : 100;
    const type = searchParams.get('type') as 'message' | 'thought' | 'document' | 'task' | null;
    
    // Get all tags from the search params (can be multiple)
    const tags = searchParams.getAll('tags');
    
    // Initialize Qdrant memory
    await serverQdrant.initMemory({
      useOpenAI: process.env.USE_OPENAI_EMBEDDINGS === 'true'
    });
    
    console.log(`[memory/all/route] Fetching memories with type=${type || 'all'}, limit=${limit}, tags=${tags.join(',') || 'none'}`);
    
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
    
    console.log(`[memory/all/route] Retrieved ${memoryEntries?.length || 0} memory entries`);
    
    // Format the response
    const items = memoryEntries && Array.isArray(memoryEntries) 
      ? memoryEntries.map(record => formatMemory(record))
      : [];
    
    console.log(`[memory/all/route] Returning ${items.length} formatted items`);
    
    // Return the formatted items directly as an array
    return NextResponse.json(items);
  } catch (error) {
    console.error('Error fetching memory entries:', error);
    return NextResponse.json(
      [],
      { status: 200 }  // Return empty array with 200 status to prevent UI errors
    );
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