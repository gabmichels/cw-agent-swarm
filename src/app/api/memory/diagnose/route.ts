import { NextRequest, NextResponse } from 'next/server';
import * as serverQdrant from '../../../../server/qdrant';
import { QdrantMemoryType } from '../../../../server/qdrant';

export const runtime = 'nodejs';

// Collection names from constants
const COLLECTIONS = {
  message: 'messages',
  thought: 'thoughts',
  document: 'documents',
  task: 'tasks',
  memory_edits: 'memory_edits',
};

/**
 * API endpoint to diagnose memory system issues
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[memory/diagnose] Starting memory system diagnostics');
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';
    const repair = searchParams.get('repair') === 'true';
    
    // Prepare diagnostic results
    const diagnosticResults: any = {
      timestamp: new Date().toISOString(),
      status: 'ok',
      environment: {
        qdrantUrl: process.env.QDRANT_URL || '(not set)',
        hasQdrantApiKey: !!process.env.QDRANT_API_KEY,
        useOpenAIEmbeddings: process.env.USE_OPENAI_EMBEDDINGS === 'true',
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        nodeEnv: process.env.NODE_ENV,
      },
      collections: {},
      memory_counts: {},
      type_distribution: {},
      errors: [],
      warnings: []
    };
    
    // Initialize Qdrant with force option if requested
    console.log(`[memory/diagnose] Initializing Qdrant memory system (force=${force})`);
    await serverQdrant.initMemory({
      useOpenAI: process.env.USE_OPENAI_EMBEDDINGS === 'true',
      forceReinit: force
    });
    
    // Check if Qdrant is properly initialized
    const isInitialized = serverQdrant.isInitialized();
    diagnosticResults.initialized = isInitialized;
    console.log(`[memory/diagnose] Qdrant initialized: ${isInitialized}`);
    
    if (!isInitialized) {
      diagnosticResults.status = 'error';
      diagnosticResults.errors.push({
        component: 'initialization',
        error: 'Failed to initialize Qdrant memory system'
      });
      return NextResponse.json(diagnosticResults);
    }
    
    // Check database health
    try {
      const healthResult = await serverQdrant.diagnoseDatabaseHealth();
      diagnosticResults.health = healthResult;
      console.log(`[memory/diagnose] Database health: ${healthResult.status}`);
      console.log(`[memory/diagnose] Total message count: ${healthResult.messageCount}`);
      
      if (healthResult.recentMessages && healthResult.recentMessages.length > 0) {
        const messageTypes = new Set(healthResult.recentMessages.map(msg => msg.type));
        console.log(`[memory/diagnose] Message types in health check: ${Array.from(messageTypes).join(', ')}`);
        diagnosticResults.message_types = Array.from(messageTypes);
      } else {
        console.warn('[memory/diagnose] No recent messages found in health check');
        diagnosticResults.warnings.push({
          component: 'health_check',
          warning: 'No recent messages found'
        });
      }
    } catch (healthError) {
      console.error('[memory/diagnose] Error checking database health:', healthError);
      diagnosticResults.errors.push({
        component: 'health_check',
        error: healthError instanceof Error ? healthError.message : String(healthError)
      });
      diagnosticResults.status = 'error';
    }
    
    // Test each collection individually to identify issues
    for (const [collectionType, collectionName] of Object.entries(COLLECTIONS)) {
      try {
        console.log(`[memory/diagnose] Testing collection ${collectionName}...`);
        const collectionMemories = await serverQdrant.searchMemory(
          collectionType as QdrantMemoryType,
          '',
          { limit: 10 }
        );
        
        diagnosticResults.collections[collectionName] = {
          status: 'ok',
          count: collectionMemories.length,
          sample: collectionMemories.length > 0 ? 
            collectionMemories.slice(0, 3).map(mem => ({
              id: mem.id,
              type: mem.type,
              timestamp: mem.timestamp,
              metadata_keys: Object.keys(mem.metadata || {})
            })) : []
        };
        
        // Record the count for this memory type
        diagnosticResults.memory_counts[collectionType] = collectionMemories.length;
        
        console.log(`[memory/diagnose] Collection ${collectionName} has ${collectionMemories.length} items`);
        
        // Categorize memories by type
        if (collectionMemories.length > 0) {
          const typeCount: Record<string, number> = {};
          collectionMemories.forEach(mem => {
            const type = mem.type || 'unknown';
            typeCount[type] = (typeCount[type] || 0) + 1;
          });
          diagnosticResults.type_distribution[collectionName] = typeCount;
        }
        
        // If the collection has zero items and repair is requested, try resetting it
        if (collectionMemories.length === 0 && repair) {
          console.log(`[memory/diagnose] Attempting to reset empty collection: ${collectionName}`);
          const resetResult = await serverQdrant.resetCollection(collectionType as QdrantMemoryType);
          diagnosticResults.collections[collectionName].reset_attempted = true;
          diagnosticResults.collections[collectionName].reset_result = resetResult;
        }
        
      } catch (collectionError) {
        console.error(`[memory/diagnose] Error testing collection ${collectionName}:`, collectionError);
        diagnosticResults.collections[collectionName] = {
          status: 'error',
          error: collectionError instanceof Error ? collectionError.message : String(collectionError)
        };
        diagnosticResults.errors.push({
          component: `collection_${collectionName}`,
          error: collectionError instanceof Error ? collectionError.message : String(collectionError)
        });
        diagnosticResults.status = 'error';
      }
    }
    
    // Get a count of all memories
    try {
      const totalCount = await serverQdrant.getMessageCount();
      diagnosticResults.total_memory_count = totalCount;
      console.log(`[memory/diagnose] Total memory count: ${totalCount}`);
      
      if (totalCount === 0) {
        diagnosticResults.warnings.push({
          component: 'memory_count',
          warning: 'No memories found in the database'
        });
      }
    } catch (countError) {
      console.error('[memory/diagnose] Error getting memory count:', countError);
      diagnosticResults.errors.push({
        component: 'memory_count',
        error: countError instanceof Error ? countError.message : String(countError)
      });
    }
    
    // Check if we have any errors
    if (diagnosticResults.errors.length > 0) {
      diagnosticResults.status = 'error';
    } else if (diagnosticResults.warnings.length > 0) {
      diagnosticResults.status = 'warning';
    }
    
    // Return diagnostic results
    return NextResponse.json(diagnosticResults);
  } catch (error) {
    console.error('Error running memory diagnostics:', error);
    return NextResponse.json(
      { 
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 