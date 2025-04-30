import { NextRequest, NextResponse } from 'next/server';
import { searchMemory, getAllMemories } from '../../../server/qdrant';

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
    
    // Build filter based on parameters
    const filter: Record<string, any> = {
      memoryType: 'social_media'
    };
    
    // Add source filter if provided
    if (source) {
      filter.source = source;
    }
    
    // Add topic filter if provided
    if (topic) {
      filter.topic = topic;
    }
    
    // Add timeframe filter
    if (timeframe !== 'all') {
      const now = new Date();
      let since = new Date();
      
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
        filter.timestamp = { $gte: since.toISOString() };
      }
    }
    
    // Get all document memories (social media data is stored as document type)
    let memories;
    if (query) {
      // If there's a search query, use searchMemory with the filter
      memories = await searchMemory('document', query, { 
        limit, 
        filter 
      });
    } else {
      // Otherwise get all memories of document type
      memories = await getAllMemories('document', limit);
      
      // Filter manually since getAllMemories doesn't support filters directly
      memories = memories.filter(memory => {
        // Check if it's social media data
        if (memory.metadata.memoryType !== 'social_media') {
          return false;
        }
        
        // Apply source filter
        if (source && memory.metadata.source !== source) {
          return false;
        }
        
        // Apply topic filter
        if (topic && memory.metadata.topic !== topic) {
          return false;
        }
        
        // Apply timeframe filter
        if (timeframe !== 'all') {
          const memoryDate = new Date(memory.timestamp);
          const now = new Date();
          let since = new Date();
          
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
          }
          
          if (memoryDate < since) {
            return false;
          }
        }
        
        return true;
      });
    }
    
    // Process and format the results
    const socialMediaData = memories
      .filter(memory => memory.metadata.memoryType === 'social_media')
      .map(memory => ({
        id: memory.id,
        text: memory.text,
        timestamp: memory.timestamp,
        type: memory.type,
        source: memory.metadata.source || 'unknown',
        topic: memory.metadata.topic || 'general',
        url: memory.metadata.url || null,
        author: memory.metadata.author || 'anonymous',
        engagement: memory.metadata.engagement || {},
        sentiment: memory.metadata.sentiment || null
      }));
    
    // Sort by timestamp (newest first)
    socialMediaData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
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