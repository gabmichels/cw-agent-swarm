import { NextApiRequest, NextApiResponse } from 'next';
import { MemoryService } from '../../../src/server/memory/services/memory/memory-service';
import { SearchService } from '../../../src/server/memory/services/search/search-service';
import { QdrantMemoryClient } from '../../../src/server/memory/services/client/qdrant-client';
import { EmbeddingService } from '../../../src/server/memory/services/client/embedding-service';
import { MemoryError, MemoryErrorCode, MemoryType } from '../../../src/server/memory/config';

// Initialize services
let memoryService: MemoryService;
let searchService: SearchService;

async function initializeServices() {
  if (memoryService && searchService) return;
  
  try {
    const client = new QdrantMemoryClient({
      qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
      qdrantApiKey: process.env.QDRANT_API_KEY
    });
    
    const embeddingService = new EmbeddingService({
      embeddingModel: 'text-embedding-3-small'
    });
    
    // Initialize services
    await client.initialize();
    
    // Create memory service
    memoryService = new MemoryService(client, embeddingService, {
      getTimestamp: () => Date.now()
    });
    
    // Create search service
    searchService = new SearchService(
      client, 
      embeddingService,
      memoryService,
      { getTimestamp: () => Date.now() }
    );
  } catch (error) {
    console.error('Failed to initialize memory services:', error);
    throw error;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Initialize services if needed
  try {
    await initializeServices();
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to initialize memory services',
      message: error instanceof Error ? error.message : String(error)
    });
  }
  
  try {
    // Extract search parameters
    const { query, limit, offset } = req.query;
    const { filter } = req.body || {};
    
    // Validate query parameter
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Search query is required',
        results: [],
        total: 0
      });
    }
    
    // Parse numeric parameters
    const parsedLimit = limit ? parseInt(limit as string, 10) : 10;
    const parsedOffset = offset ? parseInt(offset as string, 10) : 0;
    
    // Create search options
    const searchOptions = {
      filter: filter || {},
      limit: parsedLimit,
      offset: parsedOffset,
      types: filter?.types as MemoryType[] || []
    };
    
    // Perform search with query string and options
    const results = await searchService.search(query as string, searchOptions);
    
    // Return search results
    return res.status(200).json({
      results,
      total: results.length,
      searchInfo: {
        query,
        filter,
        limit: parsedLimit,
        offset: parsedOffset
      }
    });
  } catch (error) {
    console.error('Error searching memories:', error);
    
    if (error instanceof MemoryError) {
      // Handle specific error types
      switch (error.code) {
        case MemoryErrorCode.VALIDATION_ERROR:
          return res.status(400).json({ error: 'Validation error', message: error.message });
        
        case MemoryErrorCode.DATABASE_ERROR:
          return res.status(500).json({ error: 'Database error', message: error.message });
        
        case MemoryErrorCode.EMBEDDING_ERROR:
          return res.status(500).json({ error: 'Embedding error', message: error.message });
        
        default:
          return res.status(500).json({ error: 'Memory system error', message: error.message });
      }
    }
    
    return res.status(500).json({
      error: 'An unexpected error occurred',
      message: error instanceof Error ? error.message : String(error)
    });
  }
} 