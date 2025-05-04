import { NextRequest, NextResponse } from 'next/server';
import * as serverQdrant from '../../../../server/qdrant';
import { QdrantMemoryType, MemoryRecord } from '../../../../server/qdrant';

export const runtime = 'nodejs';

/**
 * API endpoint to transfer memories from one collection to another
 */
export async function POST(request: NextRequest) {
  try {
    // Get request parameters
    const body = await request.json();
    const sourceType = body.sourceType as QdrantMemoryType;
    const targetType = body.targetType as QdrantMemoryType;
    const limit = body.limit ? parseInt(body.limit, 10) : 100;
    const filter = body.filter || {};
    const dryRun = body.dryRun === true;
    
    // Validate required parameters
    if (!sourceType || !targetType) {
      return NextResponse.json(
        { 
          status: 'error', 
          error: 'Source and target types are required' 
        },
        { status: 400 }
      );
    }
    
    console.log(`[memory/transfer] Request to transfer memories from ${sourceType} to ${targetType} (limit: ${limit}, dryRun: ${dryRun})`);
    
    // Initialize Qdrant memory
    await serverQdrant.initMemory({
      useOpenAI: process.env.USE_OPENAI_EMBEDDINGS === 'true'
    });
    
    // Get memories from source collection
    console.log(`[memory/transfer] Fetching memories from source collection: ${sourceType}`);
    const sourceMemories = await serverQdrant.searchMemory(
      sourceType,
      '',  // empty query to get all memories
      {
        limit,
        filter
      }
    );
    
    console.log(`[memory/transfer] Found ${sourceMemories.length} memories in source collection`);
    
    // Return early if no memories found
    if (sourceMemories.length === 0) {
      return NextResponse.json({
        status: 'success',
        message: 'No memories found in source collection',
        sourceType,
        targetType,
        count: 0,
        transferred: []
      });
    }
    
    // Process memories and transfer to target collection
    const results = [];
    const errors = [];
    
    if (!dryRun) {
      console.log(`[memory/transfer] Transferring ${sourceMemories.length} memories to target collection: ${targetType}`);
      
      for (const memory of sourceMemories) {
        try {
          // Create new memory in target collection
          const newMemoryId = await serverQdrant.addMemory(
            targetType,
            memory.text,
            {
              ...memory.metadata,
              original_id: memory.id,
              original_type: memory.type,
              transferred_at: new Date().toISOString()
            }
          );
          
          results.push({
            originalId: memory.id,
            newId: newMemoryId,
            text: memory.text.substring(0, 100) + (memory.text.length > 100 ? '...' : '')
          });
          
          console.log(`[memory/transfer] Transferred memory ${memory.id} to ${newMemoryId}`);
        } catch (error) {
          console.error(`[memory/transfer] Error transferring memory ${memory.id}:`, error);
          errors.push({
            memoryId: memory.id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    } else {
      console.log('[memory/transfer] Dry run - no memories were actually transferred');
      
      // In dry run mode, just return the memories that would be transferred
      results.push(...sourceMemories.map(memory => ({
        originalId: memory.id,
        type: memory.type,
        timestamp: memory.timestamp,
        text: memory.text.substring(0, 100) + (memory.text.length > 100 ? '...' : '')
      })));
    }
    
    // Return success response
    return NextResponse.json({
      status: 'success',
      sourceType,
      targetType,
      dryRun,
      count: results.length,
      errorsCount: errors.length,
      transferred: results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error transferring memories:', error);
    return NextResponse.json(
      { 
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 