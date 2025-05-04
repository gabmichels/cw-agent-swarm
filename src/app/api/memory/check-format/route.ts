import { NextRequest, NextResponse } from 'next/server';
import * as serverQdrant from '../../../../server/qdrant';

export const runtime = 'nodejs';

/**
 * API endpoint to check memory format issues
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[memory/check-format] Starting memory format check');
    
    // Initialize Qdrant memory
    await serverQdrant.initMemory({
      useOpenAI: process.env.USE_OPENAI_EMBEDDINGS === 'true'
    });
    
    // Get a sample of memories using getAllMemories
    const memories = await serverQdrant.getAllMemories(null, 10);
    
    // Check format of each memory
    const formatResults = memories.map(memory => {
      // Check required fields
      const missingFields = [];
      if (!memory.id) missingFields.push('id');
      if (!memory.text) missingFields.push('text');
      if (!memory.timestamp) missingFields.push('timestamp');
      
      // Check type field
      const type = memory.type || 
                 memory.metadata?.type || 
                 memory.metadata?.messageType ||
                 'unknown';
      
      // Generate sample formatted memory
      const formatted = {
        id: memory.id || `id-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        content: memory.text || '',
        created: memory.timestamp || new Date().toISOString(),
        timestamp: memory.timestamp || new Date().toISOString(),
        type: type,
        category: memory.metadata?.category || memory.metadata?.tag || memory.type || 'unknown',
        source: memory.metadata?.source || 'system',
        importance: memory.metadata?.importance || 'medium',
        tags: Array.isArray(memory.metadata?.tags) ? memory.metadata.tags : []
      };
      
      return {
        originalId: memory.id,
        originalType: memory.type,
        hasMetadata: !!memory.metadata,
        detectedType: type,
        missingFields,
        hasMissingFields: missingFields.length > 0,
        originalSample: {
          id: memory.id,
          type: memory.type,
          text: memory.text ? memory.text.substring(0, 50) + '...' : 'NO TEXT',
          metadata: memory.metadata ? Object.keys(memory.metadata) : []
        },
        formattedSample: formatted
      };
    });
    
    // Count memory type distribution
    const typeCount: Record<string, number> = {};
    memories.forEach(memory => {
      const type = memory.type || 'unknown';
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    
    // Return format check results
    return NextResponse.json({
      totalMemories: memories.length,
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