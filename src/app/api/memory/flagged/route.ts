import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../server/memory/services';
import { MemoryType } from '../../../../server/memory/config';
import { BaseMetadata } from '../../../../types/metadata';

export const runtime = 'nodejs';

// Define the interface for flagged memory metadata
interface FlaggedMetadata extends BaseMetadata {
  user?: string;
  flaggedBy?: string;
  flaggedAt?: string;
  flagged?: boolean;
  deleted?: boolean;
  deletedAt?: string;
}

/**
 * API endpoint to fetch flagged messages from memory
 */
export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const queryLimit = searchParams.get('limit');
    const limit = queryLimit ? parseInt(queryLimit, 10) : 50;
    const typeParam = searchParams.get('type');
    const user = searchParams.get('user');
    
    // Get all tags from the search params (can be multiple)
    const tags = searchParams.getAll('tags');
    
    // Initialize memory services
    const { client, searchService } = await getMemoryServices();
    const status = await client.getStatus();
    
    if (!status.initialized) {
      console.log('[memory/flagged] Initializing memory services');
      await client.initialize();
    }
    
    // Map memory type string to MemoryType enum
    let memoryType: MemoryType | undefined;
    if (typeParam) {
      switch (typeParam) {
        case 'message':
          memoryType = MemoryType.MESSAGE;
          break;
        case 'thought':
          memoryType = MemoryType.THOUGHT;
          break;
        case 'reflection':
          memoryType = MemoryType.REFLECTION;
          break;
        default:
          // Leave undefined to search all types
          break;
      }
    }
    
    // Create filter for our query
    const searchOptions: any = {
      limit,
      filter: {
        flagged: true // Only return flagged messages
      }
    };
    
    // Add type filter if provided
    if (memoryType) {
      searchOptions.types = [memoryType];
    }
    
    // Add tags filter if provided
    if (tags && tags.length > 0) {
      searchOptions.filter.tags = tags;
    }
    
    // Add user filter if provided
    if (user) {
      searchOptions.filter.user = user;
    }
    
    // Get memory entries from search service
    const searchResults = await searchService.search('', searchOptions);
    const memoryEntries = searchResults.map(result => result.point);
    
    // Format the response
    const messages = memoryEntries.map(record => {
      // Cast the metadata to our enhanced type for proper type checking
      const metadata = record.payload?.metadata as FlaggedMetadata;
      
      return {
        id: record.id,
        content: record.payload?.text || '',
        type: (record as any).type || 'unknown',
        timestamp: record.payload?.timestamp || new Date().toISOString(),
        tags: metadata?.tags || [],
        user: metadata?.user,
        flaggedBy: metadata?.flaggedBy,
        flaggedAt: metadata?.flaggedAt,
      };
    });
    
    return NextResponse.json({
      success: true,
      messages,
      count: messages.length,
      filters: {
        type: typeParam,
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
    
    // Initialize memory services
    const { client, memoryService } = await getMemoryServices();
    const status = await client.getStatus();
    
    if (!status.initialized) {
      console.log('[memory/flagged] Initializing memory services');
      await client.initialize();
    }
    
    // Process each ID - mark as deleted and remove flag
    const results = await Promise.allSettled(
      ids.map(id => 
        memoryService.updateMemory({
          id,
          type: MemoryType.MESSAGE, // Default to MESSAGE type - we'll try to determine actual type in real implementation
          metadata: {
            deleted: true,
            flagged: false,
            deletedAt: new Date().toISOString()
          } as FlaggedMetadata
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