import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../server/memory/services';
import { MemoryType } from '../../../../server/memory/config';
import { BaseMetadata } from '../../../../types/metadata';

export const runtime = 'nodejs';

// Define enhanced metadata schema for transfer operations
interface TransferMetadata extends BaseMetadata {
  userId?: string;
  original_id?: string;
  original_type?: MemoryType;
  transferred_at?: string;
}

/**
 * API endpoint to transfer memories from one collection to another
 */
export async function POST(request: NextRequest) {
  try {
    // Get request parameters
    const body = await request.json();
    const sourceType = body.sourceType as MemoryType;
    const targetType = body.targetType as MemoryType;
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
    
    // Get memory services
    const { client, memoryService, searchService } = await getMemoryServices();
    
    // Ensure memory service is initialized
    const status = await client.getStatus();
    if (!status.initialized) {
      await client.initialize();
    }
    
    // Get memories from source collection
    console.log(`[memory/transfer] Fetching memories from source collection: ${sourceType}`);
    const searchResults = await searchService.search('', {
      types: [sourceType],
      limit,
      filter
    });
    
    // Map to a simplified memory structure with properly typed metadata
    const sourceMemories = searchResults.map(result => ({
      id: result.point.id,
      text: result.point.payload.text,
      type: result.type,
      timestamp: result.point.payload.timestamp,
      metadata: (result.point.payload.metadata || {}) as TransferMetadata
    }));
    
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
          const result = await memoryService.addMemory({
            type: targetType,
            content: memory.text,
            metadata: {
              ...memory.metadata,
              userId: memory.metadata?.userId || 'gab',
              original_id: memory.id,
              original_type: memory.type,
              transferred_at: new Date().toISOString()
            } as TransferMetadata
          });
          
          if (result.success) {
            results.push({
              originalId: memory.id,
              newId: result.id,
              text: memory.text.substring(0, 100) + (memory.text.length > 100 ? '...' : '')
            });
            
            console.log(`[memory/transfer] Transferred memory ${memory.id} to ${result.id}`);
          } else {
            throw new Error(result.error?.message || 'Unknown error adding memory');
          }
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