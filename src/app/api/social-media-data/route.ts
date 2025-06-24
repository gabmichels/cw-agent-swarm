import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../server/memory/services';
import { MemoryType } from '../../../server/memory/config';
import { SocialMediaMetadata } from '../../../types/metadata';

export const dynamic = 'force-dynamic';

/**
 * GET handler for retrieving social media data from memory
 * 
 * Optional query parameters:
 * - query: search term to filter social media data (default: '')
 * - limit: maximum number of items to return (default: 50)
 * - timeframe: 'all', 'day', 'week', 'month' (default: 'all')
 * - source: filter by social media source ('twitter', 'reddit', etc.)
 * - topic: filter by topic/category
 * 
 * Returns an array of social media data sorted by date (newest first)
 */
export async function GET(req: NextRequest) {
  try {
    // Parse query parameters
    const url = new URL(req.url);
    const query = url.searchParams.get('query') || '';
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const timeframe = url.searchParams.get('timeframe') || 'all';
    const source = url.searchParams.get('source') || null;
    const topic = url.searchParams.get('topic') || null;
    
    console.log('Social media data request:', { query, limit, timeframe, source, topic });
    
    // Initialize memory services
    const { client, searchService } = await getMemoryServices();
    
    // Ensure memory system is initialized
    const status = await client.getStatus();
    if (!status.initialized) {
      await client.initialize();
    }
    
    // Build filter based on parameters
    const filter: Record<string, any> = {
      'metadata.memoryType': 'social_media'
    };
    
    // Add source filter if provided
    if (source) {
      filter['metadata.source'] = source;
    }
    
    // Add topic filter if provided
    if (topic) {
      filter['metadata.topic'] = topic;
    }
    
    // Add timeframe filter
    if (timeframe !== 'all') {
      const now = new Date();
      const since = new Date();
      
      switch (timeframe) {
        case 'day':
          since.setDate(now.getDate() - 1);
          break;
        case 'week':
          since.setDate(now.getDate() - 7);
          break;
        case 'month':
          since.setMonth(now.getMonth() - 1);
          break;
        default:
          // No timeframe filter for 'all'
          break;
      }
      
      if (timeframe !== 'all') {
        filter['metadata.timestamp'] = { $gte: since.toISOString() };
      }
    }
    
    // Get social media data using the search service
    const searchResults = await searchService.search(query, { 
      limit,
      filter,
      types: [MemoryType.DOCUMENT]
    });
    
    // Process and format the results
    const socialMediaData = searchResults
      .filter((result: any) => {
        const metadata = result.point.payload?.metadata as SocialMediaMetadata | undefined;
        return metadata?.memoryType === 'social_media';
      })
      .map((result: any) => {
        const memory = result.point;
        const metadata = memory.payload?.metadata as SocialMediaMetadata || {} as SocialMediaMetadata;
        
        return {
          id: memory.id,
          text: memory.payload?.text || '',
          timestamp: metadata.timestamp || memory.payload?.timestamp,
          type: result.type,
          source: metadata.source || 'unknown',
          topic: metadata.topic || 'general',
          url: metadata.url || null,
          author: metadata.author || 'anonymous',
          engagement: metadata.engagement || {},
          sentiment: metadata.sentiment || null
        };
      });
    
    // Sort by timestamp (newest first)
    socialMediaData.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return NextResponse.json({
      success: true,
      count: socialMediaData.length,
      data: socialMediaData
    });
  } catch (error) {
    console.error('Error fetching social media data:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch social media data',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 