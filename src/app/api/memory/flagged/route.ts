import { NextRequest, NextResponse } from 'next/server';
import * as serverQdrant from '../../../../server/qdrant';

export const runtime = 'nodejs';

/**
 * API endpoint to fetch flagged messages from memory
 */
export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const queryLimit = searchParams.get('limit');
    const limit = queryLimit ? parseInt(queryLimit, 10) : 50;
    const type = searchParams.get('type') as 'message' | 'thought' | 'reflection' | null;
    const user = searchParams.get('user');
    
    // Get all tags from the search params (can be multiple)
    const tags = searchParams.getAll('tags');
    
    // Initialize Qdrant memory
    await serverQdrant.initMemory();
    
    // Create filter for our query
    const filter: Record<string, any> = {
      flagged: true // Only return flagged messages
    };
    
    // Add type filter if provided
    if (type) {
      filter.type = type;
    }
    
    // Add tags filter if provided
    if (tags && tags.length > 0) {
      filter.tags = tags;
    }
    
    // Add user filter if provided
    if (user) {
      filter.user = user;
    }
    
    // Get memory entries from Qdrant
    const memoryEntries = await serverQdrant.searchMemory(
      null,  // Search all types
      '',    // Empty query to match everything
      {
        filter,
        limit
      }
    );
    
    // Format the response
    const messages = memoryEntries.map(record => ({
      id: record.id,
      content: record.text,
      type: record.type || 'unknown',
      timestamp: record.timestamp,
      tags: record.metadata?.tags || [],
      user: record.metadata?.user,
      flaggedBy: record.metadata?.flaggedBy,
      flaggedAt: record.metadata?.flaggedAt,
    }));
    
    return NextResponse.json({
      success: true,
      messages,
      count: messages.length,
      filters: {
        type,
        tags,
        user
      }
    });
  } catch (error) {
    console.error('Error fetching flagged messages:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch flagged messages' },
      { status: 500 }
    );
  }
}

/**
 * API endpoint to delete flagged messages
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids } = body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid IDs provided' },
        { status: 400 }
      );
    }
    
    // Initialize Qdrant memory
    await serverQdrant.initMemory();
    
    // Process each ID
    const results = await Promise.allSettled(
      ids.map(id => 
        serverQdrant.updateMemoryMetadata(id, {
          deleted: true,
          flagged: false,
          deletedAt: new Date().toISOString()
        })
      )
    );
    
    // Count successful operations
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
    
    return NextResponse.json({
      success: true,
      deletedCount: successCount,
      message: `Successfully processed ${successCount} of ${ids.length} messages`
    });
  } catch (error) {
    console.error('Error deleting flagged messages:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete flagged messages' },
      { status: 500 }
    );
  }
} 