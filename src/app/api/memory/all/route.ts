import { NextRequest, NextResponse } from 'next/server';
import * as serverQdrant from '../../../../server/qdrant';

export const runtime = 'nodejs';

/**
 * API endpoint to fetch all memories from Chloe's knowledge base
 */
export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const queryLimit = searchParams.get('limit');
    const limit = queryLimit ? parseInt(queryLimit, 10) : 50;
    const type = searchParams.get('type') as 'message' | 'thought' | 'document' | 'task' | null;
    
    // Get all tags from the search params (can be multiple)
    const tags = searchParams.getAll('tags');
    
    // Initialize Qdrant memory
    await serverQdrant.initMemory();
    
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
    
    // Format the response
    const items = memoryEntries.map(record => ({
      id: record.id,
      text: record.text,
      type: record.type,
      timestamp: record.timestamp,
      tags: record.metadata?.tags || [],
      importance: record.metadata?.importance || 'medium',
      source: record.metadata?.source || 'unknown',
      metadata: record.metadata || {}
    }));
    
    return NextResponse.json({
      success: true,
      items,
      count: items.length,
      filters: {
        type,
        tags
      }
    });
  } catch (error) {
    console.error('Error fetching memory entries:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch memory entries' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to format memory records
 */
function formatMemory(record: any) {
  return {
    id: record.id,
    content: record.text,
    created: record.timestamp,
    timestamp: record.timestamp,
    type: record.type,
    category: record.metadata?.category || record.metadata?.tag || record.type,
    source: record.metadata?.source || 'system',
    importance: record.metadata?.importance || 'medium',
    tags: record.metadata?.tags || []
  };
} 