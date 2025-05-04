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
  // Initialize services if needed
  try {
    await initializeServices();
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to initialize memory services',
      message: error instanceof Error ? error.message : String(error)
    });
  }
  
  // Extract ID from request
  const { id } = req.query;
  
  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: 'Invalid memory ID' });
  }
  
  try {
    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        // Get memory
        const includeVector = req.query.includeVector === 'true';
        const type = (req.query.type as MemoryType) || MemoryType.MESSAGE;
        
        const memory = await memoryService.getMemory({
          id,
          type,
          includeVector
        });
        
        return res.status(200).json({ memory });
      
      case 'PATCH':
        // Update memory
        const updates = req.body;
        
        if (!updates || typeof updates !== 'object') {
          return res.status(400).json({ error: 'Invalid update data' });
        }
        
        const preserveEmbedding = req.query.preserveEmbedding === 'true';
        const updateType = updates.type || MemoryType.MESSAGE;
        
        const updatedMemory = await memoryService.updateMemory({
          id,
          type: updateType,
          ...updates,
          preserveEmbedding
        });
        
        return res.status(200).json({ memory: updatedMemory });
      
      case 'DELETE':
        // Delete memory
        const deleteType = (req.query.type as MemoryType) || MemoryType.MESSAGE;
        const hardDelete = req.query.hardDelete === 'true';
        
        await memoryService.deleteMemory({
          id,
          type: deleteType,
          hardDelete
        });
        
        return res.status(200).json({ success: true });
      
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error(`Error handling memory ${id}:`, error);
    
    if (error instanceof MemoryError) {
      // Handle specific error types
      switch (error.code) {
        case MemoryErrorCode.NOT_FOUND:
          return res.status(404).json({ error: 'Memory not found', message: error.message });
        
        case MemoryErrorCode.VALIDATION_ERROR:
          return res.status(400).json({ error: 'Validation error', message: error.message });
        
        case MemoryErrorCode.DATABASE_ERROR:
          return res.status(500).json({ error: 'Database error', message: error.message });
        
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