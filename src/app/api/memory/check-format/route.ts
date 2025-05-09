import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../server/memory/services';
import { BaseMetadata } from '../../../../types/metadata';

export const runtime = 'nodejs';

// Extended metadata interface for the specific needs of this API
interface ExtendedMetadata extends Omit<BaseMetadata, 'timestamp'> {
  type?: string;
  messageType?: string;
  category?: string;
  tag?: string;
  source?: string;
  timestamp?: string; // Using string timestamp here, different from BaseMetadata
}

/**
 * API endpoint to check memory format issues
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[memory/check-format] Starting memory format check');
    
    // Initialize memory services
    const { client, searchService } = await getMemoryServices();
    
    // Initialize memory services if needed
    const status = await client.getStatus();
    if (!status.initialized) {
      await client.initialize();
    }
    
    // Get a sample of memories using search service
    const searchResults = await searchService.search('', { limit: 10 });
    
    // Check format of each memory
    const formatResults = searchResults.map(searchResult => {
      const memory = searchResult.point;
      const memoryType = searchResult.type;
      
      // Check required fields
      const missingFields = [];
      if (!memory.id) missingFields.push('id');
      if (!memory.payload?.text) missingFields.push('text');
      
      const metadata = (memory.payload?.metadata || {}) as ExtendedMetadata;
      const timestamp = metadata.timestamp || memory.payload?.timestamp;
      if (!timestamp) missingFields.push('timestamp');
      
      // Check type field
      const type = memoryType || 
                 metadata.type || 
                 metadata.messageType ||
                 'unknown';
      
      // Generate sample formatted memory
      const formatted = {
        id: memory.id || `id-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        content: memory.payload?.text || '',
        created: timestamp || new Date().toISOString(),
        timestamp: timestamp || new Date().toISOString(),
        type: type,
        category: metadata.category || metadata.tag || type || 'unknown',
        source: metadata.source || 'system',
        importance: metadata.importance || 'medium',
        tags: Array.isArray(metadata.tags) ? metadata.tags : []
      };
      
      return {
        originalId: memory.id,
        originalType: memoryType,
        hasMetadata: !!metadata && Object.keys(metadata).length > 0,
        detectedType: type,
        missingFields,
        hasMissingFields: missingFields.length > 0,
        originalSample: {
          id: memory.id,
          type: memoryType,
          text: memory.payload?.text ? memory.payload.text.substring(0, 50) + '...' : 'NO TEXT',
          metadata: metadata ? Object.keys(metadata) : []
        },
        formattedSample: formatted
      };
    });
    
    // Count memory type distribution
    const typeCount: Record<string, number> = {};
    searchResults.forEach(searchResult => {
      const type = searchResult.type || 'unknown';
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    
    // Return format check results
    return NextResponse.json({
      totalMemories: searchResults.length,
      typeDistribution: typeCount,
      formatResults,
      hasFormatIssues: formatResults.some(r => r.hasMissingFields)
    });
  } catch (error) {
    console.error('Error checking memory formats:', error);
    return NextResponse.json(
      { 
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 