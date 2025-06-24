import { NextResponse } from 'next/server';
import { getMemoryServices } from '@/server/memory/services';
import { MemoryType } from '@/server/memory/config/types';
import { MessageMetadata, MetadataField } from '@/types/metadata';

/**
 * GET /api/multi-agent/messages/bookmarks
 * Get all bookmarked messages
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Get memory service
    const { memoryService } = await getMemoryServices();

    // Search for all messages using proper interface
    const searchResults = await memoryService.searchMemories({
      query: '',
      type: MemoryType.MESSAGE,
      limit: 1000, // Get a large set to filter
      minScore: 0.1
    });

    // Filter for bookmarked messages
    const bookmarkedMessages = searchResults
      .filter((memory: any) => {
        const metadata = memory.payload?.metadata as MessageMetadata;
        const isBookmarked = (metadata as any)?.[MetadataField.IS_BOOKMARK] === true;
        return isBookmarked;
      })
      .sort((a: any, b: any) => {
        // Sort by bookmarked date (most recent first)
        const aMetadata = a.payload?.metadata as MessageMetadata;
        const bMetadata = b.payload?.metadata as MessageMetadata;
        const aDate = (aMetadata as any)?.[MetadataField.BOOKMARKED_AT];
        const bDate = (bMetadata as any)?.[MetadataField.BOOKMARKED_AT];
        if (aDate && bDate) {
          return new Date(bDate).getTime() - new Date(aDate).getTime();
        }
        // Fallback to creation date
        const aTimestamp = (aMetadata as any)?.[MetadataField.TIMESTAMP] || (a.payload as any)?.timestamp;
        const bTimestamp = (bMetadata as any)?.[MetadataField.TIMESTAMP] || (b.payload as any)?.timestamp;
        if (aTimestamp && bTimestamp) {
          return new Date(bTimestamp).getTime() - new Date(aTimestamp).getTime();
        }
        return 0;
      })
      .slice(offset, offset + limit)
      .map((memory: any) => {
        const metadata = memory.payload?.metadata as MessageMetadata;
        return {
          id: memory.id,
          messageId: (metadata as any)?.[MetadataField.MESSAGE_ID] || (memory.payload as any)?.messageId || memory.id,
          content: memory.payload?.text || (memory.payload as any)?.content || '',
          timestamp: (metadata as any)?.[MetadataField.TIMESTAMP] || (memory.payload as any)?.timestamp,
          bookmarkedAt: (metadata as any)?.[MetadataField.BOOKMARKED_AT],
          role: (metadata as any)?.[MetadataField.ROLE],
          agentId: (metadata as any)?.[MetadataField.AGENT_ID],
          userId: (metadata as any)?.[MetadataField.USER_ID],
          chatId: (metadata as any)?.[MetadataField.CHAT_ID],
          importance: (metadata as any)?.[MetadataField.IMPORTANCE],
          tags: (metadata as any)?.[MetadataField.TAGS]
        };
      });

    const totalBookmarked = searchResults.filter((memory: any) => {
      const metadata = memory.payload?.metadata as MessageMetadata;
      return (metadata as any)?.[MetadataField.IS_BOOKMARK] === true;
    }).length;

    return NextResponse.json({
      success: true,
      messages: bookmarkedMessages,
      pagination: {
        total: totalBookmarked,
        limit,
        offset,
        hasMore: offset + limit < totalBookmarked
      }
    });

  } catch (error) {
    console.error('Error getting bookmarked messages:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 