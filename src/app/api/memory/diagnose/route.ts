import { NextRequest, NextResponse } from 'next/server';
import { MemoryType } from '../../../../server/memory/config';
import { getMemoryServices } from '../../../../server/memory/services';

export const runtime = 'nodejs';

// Map memory types to human-readable collection names
const COLLECTIONS: Record<string, string> = {
  [MemoryType.MESSAGE]: 'messages',
  [MemoryType.THOUGHT]: 'thoughts',
  [MemoryType.DOCUMENT]: 'documents',
  [MemoryType.TASK]: 'tasks',
  [MemoryType.REFLECTION]: 'reflections',
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

    // Get memory services
    const { client, memoryService, searchService } = await getMemoryServices();

    // Check if memory service is properly initialized
    const status = await client.getStatus();
    diagnosticResults.initialized = status.initialized;
    console.log(`[memory/diagnose] Memory system initialized: ${status.initialized}`);

    // Initialize if not already initialized or force is true
    if (!status.initialized || force) {
      console.log(`[memory/diagnose] Initializing memory system (force=${force})`);
      await client.initialize();

      // Check status again after initialization
      const newStatus = await client.getStatus();
      diagnosticResults.initialized = newStatus.initialized;
      console.log(`[memory/diagnose] Memory system initialized after attempt: ${newStatus.initialized}`);
    }

    if (!status.initialized) {
      diagnosticResults.status = 'error';
      diagnosticResults.errors.push({
        component: 'initialization',
        error: 'Failed to initialize memory system'
      });
      return NextResponse.json(diagnosticResults);
    }

    // Check database health
    try {
      // Get a sample of recent messages to check health
      const recentMessages = await searchService.search("", {
        types: [MemoryType.MESSAGE],
        limit: 20
      });

      const recentMessagesData = recentMessages.map((result: any) => ({
        id: result.point.id,
        type: (result.point as any).type || MemoryType.MESSAGE,
        timestamp: result.point.payload?.timestamp || null,
        metadata: result.point.payload?.metadata || {}
      }));

      diagnosticResults.health = {
        status: status.initialized ? 'ok' : 'not_initialized',
        messageCount: recentMessages.length,
        recentMessages: recentMessagesData
      };

      console.log(`[memory/diagnose] Database health: ${diagnosticResults.health.status}`);
      console.log(`[memory/diagnose] Recent messages count: ${recentMessages.length}`);

      if (recentMessagesData && recentMessagesData.length > 0) {
        const messageTypes = new Set(recentMessagesData.map((msg: any) => msg.type));
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

    // Test each memory type individually to identify issues
    const memoryTypes = Object.keys(COLLECTIONS) as MemoryType[];
    for (const memoryType of memoryTypes) {
      const collectionName = COLLECTIONS[memoryType];
      try {
        console.log(`[memory/diagnose] Testing memory type ${memoryType}...`);
        const searchResults = await searchService.search('', {
          types: [memoryType],
          limit: 10
        });

        const collectionMemories = searchResults.map((result: any) => result.point);

        diagnosticResults.collections[collectionName] = {
          status: 'ok',
          count: collectionMemories.length,
          sample: collectionMemories.length > 0 ?
            collectionMemories.slice(0, 3).map((mem: any) => ({
              id: mem.id,
              type: (mem as any).type || memoryType,
              timestamp: mem.payload?.timestamp || null,
              metadata_keys: Object.keys(mem.payload?.metadata || {})
            })) : []
        };

        // Record the count for this memory type
        diagnosticResults.memory_counts[memoryType] = collectionMemories.length;

        console.log(`[memory/diagnose] Memory type ${memoryType} has ${collectionMemories.length} items`);

        // Categorize memories by type
        if (collectionMemories.length > 0) {
          const typeCount: Record<string, number> = {};
          collectionMemories.forEach((mem: any) => {
            const type = (mem as any).type || memoryType || 'unknown';
            typeCount[type] = (typeCount[type] || 0) + 1;
          });
          diagnosticResults.type_distribution[collectionName] = typeCount;
        }

        // If the collection has zero items and repair is requested, try resetting it
        if (collectionMemories.length === 0 && repair) {
          console.log(`[memory/diagnose] Attempting to reset empty collection for type: ${memoryType}`);
          try {
            // Reset implementation using memory service
            // We need to create the collection since resetCollection might not exist
            await client.createCollection(memoryType.toString(), 1536);
            diagnosticResults.collections[collectionName].reset_attempted = true;
            diagnosticResults.collections[collectionName].reset_result = true;
          } catch (resetError) {
            console.error(`[memory/diagnose] Error resetting collection for type ${memoryType}:`, resetError);
            diagnosticResults.collections[collectionName].reset_attempted = true;
            diagnosticResults.collections[collectionName].reset_result = false;
            diagnosticResults.collections[collectionName].reset_error =
              resetError instanceof Error ? resetError.message : String(resetError);
          }
        }

      } catch (collectionError) {
        console.error(`[memory/diagnose] Error testing memory type ${memoryType}:`, collectionError);
        diagnosticResults.collections[collectionName] = {
          status: 'error',
          error: collectionError instanceof Error ? collectionError.message : String(collectionError)
        };
        diagnosticResults.errors.push({
          component: `memory_type_${memoryType}`,
          error: collectionError instanceof Error ? collectionError.message : String(collectionError)
        });
        diagnosticResults.status = 'error';
      }
    }

    // Get a count of all memories
    try {
      let totalCount = 0;
      for (const memoryType of memoryTypes) {
        const searchResults = await searchService.search('', {
          types: [memoryType],
          limit: 1
        });

        // Each search result has a length property we can use
        totalCount += searchResults.length;
      }

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