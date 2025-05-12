import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '@/server/memory/services';
import { MemoryType } from '@/server/memory/config';
import { EditorType } from '@/types/metadata';
import { MemoryErrorCode } from '@/lib/errors/types';

/**
 * API endpoint to rollback a memory to a specific version
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[memory/rollback] Starting memory rollback');
    
    // Parse request body
    const body = await request.json();
    const { id, versionId, type, editorType, editorId } = body;
    
    // Validate required parameters
    if (!id || !versionId) {
      return NextResponse.json(
        { 
          status: 'error',
          error: {
            code: MemoryErrorCode.VALIDATION_FAILED,
            message: 'Memory ID and version ID are required'
          }
        },
        { status: 400 }
      );
    }
    
    // Get memory services
    const { client, memoryService } = await getMemoryServices();
    
    // Initialize memory services if needed
    const status = await client.getStatus();
    if (!status.initialized) {
      console.log('[memory/rollback] Initializing memory services');
      await client.initialize();
    }
    
    console.log(`[memory/rollback] Rolling back memory ${id} to version ${versionId}`);
    
    // Perform the rollback
    const result = await memoryService.rollbackMemory({
      id,
      versionId,
      type: type as MemoryType,
      editorType: editorType as EditorType,
      editorId
    });
    
    if (!result.success) {
      console.error('[memory/rollback] Rollback failed:', result.error);
      return NextResponse.json(
        { 
          status: 'error',
          error: result.error || {
            code: MemoryErrorCode.UNKNOWN,
            message: 'Unknown error during rollback'
          }
        },
        { status: result.error?.code === MemoryErrorCode.NOT_FOUND ? 404 : 500 }
      );
    }
    
    console.log(`[memory/rollback] Successfully rolled back memory ${id}`);
    
    // Return success response
    return NextResponse.json({
      status: 'success',
      id: result.id
    });
  } catch (error) {
    console.error('Error rolling back memory:', error);
    return NextResponse.json(
      { 
        status: 'error',
        error: {
          code: MemoryErrorCode.UNKNOWN,
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      { status: 500 }
    );
  }
} 