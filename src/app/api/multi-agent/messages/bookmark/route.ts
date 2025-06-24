import { NextResponse } from 'next/server';
import { getMemoryServices } from '@/server/memory/services';
import { MemoryType } from '@/server/memory/config/types';
import { MessageMetadata, MetadataField } from '@/types/metadata';
import { UpdateMemoryParams } from '@/server/memory/services/memory/types';

/**
 * POST /api/multi-agent/messages/bookmark
 * Toggle bookmark status for a message
 */
export async function POST(request: Request) {
  try {
    const requestBody = await request.json();
    const { messageId, timestamp, content, isBookmarked } = requestBody;

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: 'Message ID is required' },
        { status: 400 }
      );
    }

    // Get memory service with proper initialization
    const { memoryService } = await getMemoryServices();

    // Ensure the client is properly initialized
    if (memoryService && 'memoryClient' in memoryService) {
      const client = (memoryService as any).memoryClient;
      if (client && typeof client.isInitialized === 'function' && !client.isInitialized()) {
        console.log('Memory client not initialized, initializing now...');
        if (typeof client.initialize === 'function') {
          await client.initialize();
        }
      }
    }

    // Try multiple search strategies to find the message
    let searchResults: any[] = [];
    if (content && content.trim()) {
      try {
        searchResults = await memoryService.searchMemories({
          query: content.substring(0, 200), // Use first 200 chars for better matching
          type: MemoryType.MESSAGE,
          limit: 100,
          minScore: 0.1
        });
      } catch (searchError) {
        console.warn('Content-based search failed, trying fallback search:', searchError);
        searchResults = [];
      }
    }

    // Strategy 2: If no results or no content, search with a broader query
    if (searchResults.length === 0) {
      try {
        searchResults = await memoryService.searchMemories({
          query: '', // Empty query to get all messages
          type: MemoryType.MESSAGE,
          limit: 500, // Increase limit to catch more messages
          minScore: 0.0 // Lower threshold
        });
      } catch (searchError) {
        console.error('Fallback search failed:', searchError);
        // Return error if we can't search at all
        return NextResponse.json(
          { success: false, error: 'Unable to search for message in memory' },
          { status: 500 }
        );
      }
    }

    // Find the exact message by ID using multiple strategies
    let targetMemory = searchResults.find((memory: any) => {
      const metadata = memory.payload?.metadata as MessageMetadata;
      const memoryMessageId = (metadata as any)?.[MetadataField.MESSAGE_ID] ||
        (memory.payload as any)?.messageId ||
        memory.id; // Also try the memory ID itself
      return memoryMessageId === messageId;
    });

    // If not found by messageId, try to find by timestamp and content similarity
    if (!targetMemory && timestamp && content) {
      const searchTimestamp = new Date(timestamp).toISOString();
      targetMemory = searchResults.find((memory: any) => {
        const metadata = memory.payload?.metadata as MessageMetadata;
        const memoryTimestamp = (metadata as any)?.[MetadataField.TIMESTAMP] ||
          (memory.payload as any)?.timestamp;
        const memoryContent = memory.payload?.text || (memory.payload as any)?.content || '';

        // Check if timestamps match and content is similar
        const timestampMatch = memoryTimestamp === searchTimestamp;
        const contentMatch = content && memoryContent.includes(content.substring(0, 50));

        return timestampMatch && contentMatch;
      });
    }

    if (!targetMemory) {
      return NextResponse.json(
        { success: false, error: 'Message not found in memory' },
        { status: 404 }
      );
    }

    // Prepare update parameters
    const currentMetadata = (targetMemory.payload?.metadata as MessageMetadata) || {};
    const updateParams: UpdateMemoryParams<any> = {
      type: MemoryType.MESSAGE,
      id: targetMemory.id,
      metadata: {
        ...currentMetadata,
        [MetadataField.IS_BOOKMARK]: isBookmarked,
        [MetadataField.BOOKMARKED_AT]: isBookmarked ? new Date().toISOString() : undefined
      }
    };

    // Update the memory
    let updateResult;
    try {
      updateResult = await memoryService.updateMemory(updateParams);
    } catch (updateError) {
      console.error('Error updating memory:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update bookmark status' },
        { status: 500 }
      );
    }

    if (!updateResult) {
      return NextResponse.json(
        { success: false, error: 'Failed to update bookmark status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        messageId,
        isBookmarked,
        bookmarkedAt: isBookmarked ? updateParams.metadata?.[MetadataField.BOOKMARKED_AT] : undefined
      }
    });

  } catch (error) {
    console.error('Error updating bookmark:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/multi-agent/messages/bookmark?messageId=xxx
 * Get bookmark status for a specific message
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const messageId = url.searchParams.get('messageId');

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: 'Message ID is required' },
        { status: 400 }
      );
    }

    // Get memory service with proper initialization
    const { memoryService } = await getMemoryServices();

    // Ensure the client is properly initialized
    if (memoryService && 'memoryClient' in memoryService) {
      const client = (memoryService as any).memoryClient;
      if (client && typeof client.isInitialized === 'function' && !client.isInitialized()) {
        console.log('Memory client not initialized, initializing now...');
        if (typeof client.initialize === 'function') {
          await client.initialize();
        }
      }
    }

    // Search for the message using proper interface with error handling
    let searchResults: any[] = [];
    try {
      searchResults = await memoryService.searchMemories({
        query: '',
        type: MemoryType.MESSAGE,
        limit: 100,
        minScore: 0.1
      });
    } catch (searchError) {
      console.error('Error searching for bookmark status:', searchError);
      // Return false for bookmark status if we can't search
      return NextResponse.json({
        success: true,
        isBookmarked: false,
        error: 'Unable to verify bookmark status'
      });
    }

    const targetMemory = searchResults.find((memory: any) => {
      const metadata = memory.payload?.metadata as MessageMetadata;
      const memoryMessageId = (metadata as any)?.[MetadataField.MESSAGE_ID] ||
        (memory.payload as any)?.messageId;
      return memoryMessageId === messageId;
    });

    if (!targetMemory) {
      return NextResponse.json({
        success: true,
        isBookmarked: false
      });
    }

    const metadata = targetMemory.payload?.metadata as MessageMetadata;
    const isBookmarked = (metadata as any)?.[MetadataField.IS_BOOKMARK] || false;
    const bookmarkedAt = (metadata as any)?.[MetadataField.BOOKMARKED_AT];

    return NextResponse.json({
      success: true,
      isBookmarked,
      bookmarkedAt
    });

  } catch (error) {
    console.error('Error getting bookmark status:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 