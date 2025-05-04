import { NextApiRequest, NextApiResponse } from 'next';
import { MemoryService } from '../../../src/server/memory/services/memory/memory-service';
import { QdrantMemoryClient } from '../../../src/server/memory/services/client/qdrant-client';
import { EmbeddingService } from '../../../src/server/memory/services/client/embedding-service';
import { MemoryError, MemoryErrorCode, MemoryType } from '../../../src/server/memory/config';

// Initialize services
let memoryService: MemoryService;

async function initializeServices() {
  if (memoryService) return;
  
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
  } catch (error) {
    console.error('Failed to initialize memory services:', error);
    throw error;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Allow GET (list) and POST (create) methods
  if (req.method !== 'GET' && req.method !== 'POST') {
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
    if (req.method === 'GET') {
      // List memories
      const { type, limit, offset } = req.query;
      
      // Parse memory type
      let memoryType: MemoryType = MemoryType.MESSAGE; // Default type
      if (type && !Array.isArray(type) && Object.values(MemoryType).includes(type as MemoryType)) {
        memoryType = type as MemoryType;
      }
      
      // Parse numeric parameters
      const parsedLimit = limit ? parseInt(limit as string, 10) : 10;
      const parsedOffset = offset ? parseInt(offset as string, 10) : 0;
      
      // Get memories using searchMemories with proper params
      const memories = await memoryService.searchMemories({
        type: memoryType,
        limit: parsedLimit,
        offset: parsedOffset,
        query: '', // Empty query to list all
        filter: {}
      });
      
      return res.status(200).json({
        memories,
        total: memories.length,
        limit: parsedLimit,
        offset: parsedOffset,
        type: memoryType
      });
    } else {
      // Add new memory
      const {
        type,
        content,
        metadata,
        embedding,
        id
      } = req.body;
      
      // Validate required fields
      if (!type || !content) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Memory type and content are required'
        });
      }
      
      // Validate memory type
      if (!Object.values(MemoryType).includes(type)) {
        return res.status(400).json({
          error: 'Validation error',
          message: `Invalid memory type: ${type}`
        });
      }
      
      // Add memory
      const memory = await memoryService.addMemory({
        type,
        content,
        metadata,
        embedding,
        id
      });
      
      return res.status(201).json({ memory });
    }
  } catch (error) {
    console.error('Error handling memory request:', error);
    
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