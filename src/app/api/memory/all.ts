import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../server/memory/services';
import { MemoryType } from '../../../server/memory/config/types';

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
    const typeParam = searchParams.get('type') as string | null;
    
    // Convert string type parameter to MemoryType enum
    let memoryType: MemoryType | null = null;
    if (typeParam) {
      // Map string type to enum value
      const memoryTypeMap: Record<string, MemoryType> = {
        'message': MemoryType.MESSAGE,
        'thought': MemoryType.THOUGHT,
        'document': MemoryType.DOCUMENT,
        'task': MemoryType.TASK
      };
      memoryType = memoryTypeMap[typeParam] || null;
    }
    
    // Get all tags from the search params (can be multiple)
    const tags = searchParams.getAll('tags');
    
    // Init memory services
    const { client, searchService } = await getMemoryServices();
    
    // Initialize memory services if needed
    const status = await client.getStatus();
    if (!status.initialized) {
      await client.initialize();
    }
    
    console.log(`[memory/all] Fetching memories with type=${typeParam || 'all'}, limit=${limit}, tags=${tags.join(',') || 'none'}`);
    
    // Create filter for tags if provided
    const filter: Record<string, any> = {};
    
    // Only add tags filter if tags are provided
    if (tags && tags.length > 0) {
      filter.tags = tags;
    }
    
    // Set types array if a specific type is requested
    const types = memoryType ? [memoryType] : undefined;
    
    // Get memory entries using the search service
    const searchResults = await searchService.search(
      '',    // empty query to match everything
      {
        filter,
        limit,
        types
      }
    );
    
    console.log(`[memory/all] Retrieved ${searchResults?.length || 0} memory entries`);
    
    // Ensure we have arrays, even if the API returns null/undefined
    const safeSearchResults = Array.isArray(searchResults) ? searchResults : [];
    
    // Combine and format all memories
    const allMemories = safeSearchResults
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
function formatMemory(searchResult: any) {
  if (!searchResult || !searchResult.point) {
    console.warn('Received undefined or null memory record');
    return null;
  }
  
  try {
    const record = searchResult.point;
    const metadata = record.payload?.metadata || {};
    
    return {
      id: record.id || `id-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      content: record.payload?.text || '',
      created: metadata.timestamp || record.createdAt || new Date().toISOString(),
      timestamp: metadata.timestamp || record.createdAt || new Date().toISOString(),
      type: searchResult.type || 'unknown',
      category: metadata.category || metadata.tag || searchResult.type || 'unknown',
      source: metadata.source || 'system',
      importance: metadata.importance || 'medium',
      tags: Array.isArray(metadata.tags) ? metadata.tags : []
    };
  } catch (err) {
    console.error('Error formatting memory record:', err, searchResult);
    return null;
  }
} 