import { NextRequest, NextResponse } from 'next/server';
import * as serverQdrant from '../../../../server/qdrant';

export const runtime = 'nodejs';

/**
 * API endpoint to fetch all memories from Chloe's knowledge base
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[memory/all/route] Initializing memory system to fetch memories');
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const queryLimit = searchParams.get('limit');
    const limit = queryLimit ? parseInt(queryLimit, 10) : 500; // Increased default to 500
    const type = searchParams.get('type') as 'message' | 'thought' | 'document' | 'task' | null;
    const debug = searchParams.get('debug') === 'true';
    const diagnosticsOnly = searchParams.get('diagnostics') === 'true';
    
    // Get all tags from the search params (can be multiple)
    const tags = searchParams.getAll('tags');
    
    console.log(`[memory/all/route] Using limit: ${limit}, debug mode: ${debug}`);
    
    // Run diagnostics on memory collections
    const diagnosticResults: any = {
      timestamp: new Date().toISOString(),
      status: 'ok',
      collections: {},
      errors: [],
      warnings: []
    };
    
    try {
      // Print current Qdrant configuration
      console.log('[memory/all/route] Qdrant configuration:');
      console.log(`- URL: ${process.env.QDRANT_URL || '(not set)'}`);
      console.log(`- API Key set: ${process.env.QDRANT_API_KEY ? 'Yes' : 'No'}`);
      console.log(`- OpenAI Embeddings: ${process.env.USE_OPENAI_EMBEDDINGS === 'true' ? 'Yes' : 'No'}`);
      
      // Check database health before proceeding
      const healthResult = await serverQdrant.diagnoseDatabaseHealth();
      diagnosticResults.health = healthResult;
      console.log(`[memory/all/route] Database health: ${healthResult.status}`);
      console.log(`[memory/all/route] Total message count: ${healthResult.messageCount}`);
      console.log(`[memory/all/route] Recent messages: ${healthResult.recentMessages.length}`);
      
      // Sample of message types in the health check
      const messageTypes = new Set(healthResult.recentMessages.map(msg => msg.type));
      console.log(`[memory/all/route] Message types in health check: ${Array.from(messageTypes).join(', ')}`);
    } catch (healthError) {
      console.error('[memory/all/route] Error checking database health:', healthError);
      diagnosticResults.errors.push({
        component: 'health_check',
        error: healthError instanceof Error ? healthError.message : String(healthError)
      });
      diagnosticResults.status = 'error';
    }
    
    // Initialize Qdrant memory with explicit disable of any privacy filters
    console.log('[memory/all/route] Initializing Qdrant memory...');
    await serverQdrant.initMemory({
      useOpenAI: process.env.USE_OPENAI_EMBEDDINGS === 'true',
      forceReinit: true // Force reinitialization to ensure fresh state
    });
    
    // Check if Qdrant is properly initialized
    const isInitialized = serverQdrant.isInitialized();
    diagnosticResults.initialized = isInitialized;
    console.log(`[memory/all/route] Qdrant initialized: ${isInitialized}`);
    
    // If only diagnostics are requested, return early with diagnostic info
    if (diagnosticsOnly) {
      console.log('[memory/all/route] Returning diagnostics-only response');
      return NextResponse.json({
        status: 'success',
        diagnostics: diagnosticResults
      });
    }
    
    console.log(`[memory/all/route] Fetching memories with type=${type || 'all'}, limit=${limit}, tags=${tags.join(',') || 'none'}`);
    
    // Create filter for tags if provided
    const filter: Record<string, any> = {};
    
    // Only add tags filter if tags are provided
    if (tags && tags.length > 0) {
      filter.tags = tags;
    }
    
    // Define collection types to search
    const COLLECTIONS = {
      message: 'messages',
      thought: 'thoughts',
      document: 'documents',
      task: 'tasks',
      memory_edits: 'memory_edits',
    };
    
    // Test each collection individually to identify issues
    for (const [collectionType, collectionName] of Object.entries(COLLECTIONS)) {
      try {
        console.log(`[memory/all/route] Testing collection ${collectionName}...`);
        const collectionMemories = await serverQdrant.searchMemory(
          collectionType as any,
          '',
          { limit: 5 }
        );
        
        diagnosticResults.collections[collectionName] = {
          status: 'ok',
          count: collectionMemories.length,
          sample: collectionMemories.length > 0 ? {
            id: collectionMemories[0].id,
            type: collectionMemories[0].type,
            timestamp: collectionMemories[0].timestamp
          } : null
        };
        
        console.log(`[memory/all/route] Collection ${collectionName} has ${collectionMemories.length} items`);
      } catch (collectionError) {
        console.error(`[memory/all/route] Error testing collection ${collectionName}:`, collectionError);
        diagnosticResults.collections[collectionName] = {
          status: 'error',
          error: collectionError instanceof Error ? collectionError.message : String(collectionError)
        };
        diagnosticResults.errors.push({
          component: `collection_${collectionName}`,
          error: collectionError instanceof Error ? collectionError.message : String(collectionError)
        });
      }
    }
    
    // If a specific type is requested, just search that collection
    let memoryEntries: any[] = [];
    
    if (type) {
      // Get memory entries for the specified type
      console.log(`[memory/all/route] Fetching memories of type: ${type}`);
      memoryEntries = await serverQdrant.searchMemory(
        type,
        '',  // empty query to match everything
        {
          filter,
          limit
        }
      );
    } else {
      // For all types, use the getAllMemories function which is specifically designed
      // to retrieve a balanced mix of memories from all collections
      console.log(`[memory/all/route] Using getAllMemories to fetch from all collections with limit: ${limit}`);
      
      try {
        memoryEntries = await serverQdrant.getAllMemories(null, limit);
        console.log(`[memory/all/route] Successfully retrieved ${memoryEntries.length} memories from all collections`);
      } catch (error) {
        console.error('[memory/all/route] Error fetching all memories:', error);
        
        // Fallback to the collection-by-collection approach if getAllMemories fails
        console.log('[memory/all/route] Falling back to collection-by-collection approach');
        const perCollectionLimit = Math.ceil(limit / Object.keys(COLLECTIONS).length);
        
        // Fetch from each collection type to ensure we get a mix
        for (const collectionType of Object.keys(COLLECTIONS)) {
          try {
            console.log(`[memory/all/route] Fetching from collection: ${collectionType}`);
            const collectionMemories = await serverQdrant.searchMemory(
              collectionType as any,
              '',  // empty query to match everything
              {
                filter,
                limit: perCollectionLimit
              }
            );
            
            console.log(`[memory/all/route] Found ${collectionMemories.length} memories in collection ${collectionType}`);
            memoryEntries.push(...collectionMemories);
          } catch (error) {
            console.error(`[memory/all/route] Error fetching from collection ${collectionType}:`, error);
          }
        }
        
        // Sort all memories by timestamp (newest first)
        memoryEntries.sort((a, b) => {
          const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return timeB - timeA;
        });
        
        // Limit the total number of memories after combining all collections
        if (memoryEntries.length > limit) {
          memoryEntries = memoryEntries.slice(0, limit);
        }
      }
    }
    
    console.log(`[memory/all/route] Retrieved ${memoryEntries?.length || 0} memory entries`);
    
    // Count types for debugging
    if (debug && memoryEntries && memoryEntries.length > 0) {
      console.log('[memory/all/route] First memory entry sample:', JSON.stringify(memoryEntries[0], null, 2).substring(0, 500) + '...');
      
      // Count each memory type 
      const typeCount: Record<string, number> = {};
      memoryEntries.forEach(entry => {
        const type = entry.type || 'unknown';
        typeCount[type] = (typeCount[type] || 0) + 1;
      });
      console.log('[memory/all/route] Memory types distribution:', typeCount);
      diagnosticResults.typeDistribution = typeCount;
    }
    
    // Format the response
    const items = memoryEntries && Array.isArray(memoryEntries) 
      ? memoryEntries.map(record => formatMemory(record)).filter(Boolean)
      : [];
    
    console.log(`[memory/all/route] Returning ${items.length} formatted items`);
    
    if (debug && items.length > 0) {
      console.log('[memory/all/route] First formatted item sample:', JSON.stringify(items[0], null, 2).substring(0, 500) + '...');
      
      // Count formatted memory types for comparison
      const formattedTypeCount: Record<string, number> = {};
      items.forEach(item => {
        if (!item) return;
        const type = item.type || item.category || 'unknown';
        formattedTypeCount[type] = (formattedTypeCount[type] || 0) + 1;
      });
      console.log('[memory/all/route] Formatted memory types distribution:', formattedTypeCount);
      diagnosticResults.formattedTypeDistribution = formattedTypeCount;
    }
    
    // Return the formatted items with diagnostic information
    return NextResponse.json(items);
  } catch (error) {
    console.error('Error fetching memory entries:', error);
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

/**
 * Helper function to format memory records
 */
function formatMemory(record: any) {
  if (!record) {
    console.warn('Received undefined or null memory record');
    return null;
  }
  
  try {
    // Log raw record for debugging
    console.log(`[memory/all/route] Formatting memory record: ${record.id}`);
    
    // Generate a unique ID if missing
    const id = record.id || `id-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Ensure we have text content
    const content = record.text || record.content || '';
    if (!content) {
      console.warn(`[memory/all/route] Memory record ${id} has no content`);
    }
    
    // Get timestamp
    const timestamp = record.timestamp || record.created || new Date().toISOString();
    
    // Determine type from multiple possible sources
    const type = record.type || 
                record.metadata?.type || 
                record.metadata?.messageType ||
                'unknown';
    
    // Check if this is a memory_edit record
    const isMemoryEdit = type === 'memory_edits' || record.metadata?.original_memory_id;
    
    // Extract versioning fields or use defaults
    const originalMemoryId = record.original_memory_id || record.metadata?.original_memory_id;
    const editType = record.edit_type || record.metadata?.edit_type || 'update';
    const editorType = record.editor_type || record.metadata?.editor_type || 'system';
    const editorId = record.editor_id || record.metadata?.editor_id;
    const diffSummary = record.diff_summary || record.metadata?.diff_summary;
    const current = record.current === true || record.metadata?.current === true;
    const previousVersionId = record.previous_version_id || record.metadata?.previous_version_id;
    
    // If this is a memory_edit, log additional info for debugging
    if (isMemoryEdit) {
      console.log(`[memory/all/route] Found memory_edit: ${id}, original: ${originalMemoryId}, edit_type: ${editType}, current: ${current}`);
    }
    
    // Create formatted record
    const formatted = {
      id: id,
      content: content,
      created: timestamp,
      timestamp: timestamp,
      type: type,
      category: record.metadata?.category || record.metadata?.tag || record.type || 'unknown',
      source: record.metadata?.source || 'system',
      importance: record.metadata?.importance || 'medium',
      tags: Array.isArray(record.metadata?.tags) ? record.metadata.tags : [],
      // Include all original metadata to preserve version information and other details
      metadata: {
        ...record.metadata || {},
        // Add explicit version info to metadata if this is a memory_edit
        ...(isMemoryEdit ? {
          isMemoryEdit: true, 
          original_memory_id: originalMemoryId,
          edit_type: editType,
          editor_type: editorType,
          editor_id: editorId,
          diff_summary: diffSummary,
          current: current,
          previous_version_id: previousVersionId
        } : {})
      },
      // Add specific version-related fields at the top level for easier access
      kind: type, // For backward compatibility
      isMemoryEdit: isMemoryEdit,
      edit_type: editType,
      original_memory_id: originalMemoryId,
      editor_type: editorType,
      editor_id: editorId,
      current: current,
      previous_version_id: previousVersionId,
      diff_summary: diffSummary
    };
    
    return formatted;
  } catch (err) {
    console.error('Error formatting memory record:', err, record);
    return null;
  }
} 