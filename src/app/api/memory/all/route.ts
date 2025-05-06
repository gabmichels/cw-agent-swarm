import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../server/memory/services';
import { MemoryType, MemoryErrorCode } from '../../../../server/memory/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    const typeParam = searchParams.get('type');
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
      // Print current memory configuration
      console.log('[memory/all/route] Memory configuration:');
      console.log(`- URL: ${process.env.QDRANT_URL || '(not set)'}`);
      console.log(`- API Key set: ${process.env.QDRANT_API_KEY ? 'Yes' : 'No'}`);
      console.log(`- OpenAI Embeddings: ${process.env.USE_OPENAI_EMBEDDINGS === 'true' ? 'Yes' : 'No'}`);
      
      // Initialize memory services
      const { client, memoryService, searchService } = await getMemoryServices();
      
      // Check database health
      const status = await client.getStatus();
      
      if (!status.initialized) {
        console.log('[memory/all/route] Initializing memory services...');
        await client.initialize();
      }
      
      // Get a sample of recent messages to check health
      const recentMessages = await searchService.search("", {
        types: [MemoryType.MESSAGE],
        limit: 10
      });
      
      diagnosticResults.health = {
        status: status.initialized ? 'ok' : 'not_initialized',
        messageCount: recentMessages.length,
        recentMessages: recentMessages.map(r => ({
          id: r.point.id,
          // Use the memory type from the actual record
          memoryType: (r.point as any).type || MemoryType.MESSAGE,
          timestamp: r.point.payload?.timestamp || null
        }))
      };
      
      console.log(`[memory/all/route] Database health: ${diagnosticResults.health.status}`);
      console.log(`[memory/all/route] Recent messages count: ${recentMessages.length}`);
      
      // Sample of memory types in the health check - handle as any to access type
      const messageTypes = new Set(recentMessages.map(msg => (msg.point as any).type || MemoryType.MESSAGE));
      console.log(`[memory/all/route] Message types in health check: ${Array.from(messageTypes).join(', ')}`);
    } catch (healthError) {
      console.error('[memory/all/route] Error checking database health:', healthError);
      diagnosticResults.errors.push({
        component: 'health_check',
        error: healthError instanceof Error ? healthError.message : String(healthError)
      });
      diagnosticResults.status = 'error';
    }
    
    // If only diagnostics are requested, return early with diagnostic info
    if (diagnosticsOnly) {
      console.log('[memory/all/route] Returning diagnostics-only response');
      return NextResponse.json({
        status: 'success',
        diagnostics: diagnosticResults
      });
    }
    
    // Map old memory types to new MemoryType enum
    let type: MemoryType | undefined;
    if (typeParam) {
      switch (typeParam) {
        case 'message':
          type = MemoryType.MESSAGE;
          break;
        case 'thought':
          type = MemoryType.THOUGHT;
          break;
        case 'document':
          type = MemoryType.DOCUMENT;
          break;
        case 'task':
          type = MemoryType.TASK;
          break;
        default:
          type = undefined;
      }
    }
    
    console.log(`[memory/all/route] Fetching memories with type=${type || 'all'}, limit=${limit}, tags=${tags.join(',') || 'none'}`);
    
    // Get the memory services
    const { searchService } = await getMemoryServices();
    
    // Define memory types to test
    const MEMORY_TYPES = [
      MemoryType.MESSAGE,
      MemoryType.THOUGHT,
      MemoryType.DOCUMENT,
      MemoryType.TASK,
      MemoryType.REFLECTION
    ];
    
    // Test each memory type individually to identify issues
    for (const memoryType of MEMORY_TYPES) {
      try {
        console.log(`[memory/all/route] Testing memory type ${memoryType}...`);
        const typeMemories = await searchService.search('', {
          types: [memoryType],
          limit: 5
        });
        
        const collectionName = memoryType.toString().toLowerCase();
        diagnosticResults.collections[collectionName] = {
          status: 'ok',
          count: typeMemories.length,
          sample: typeMemories.length > 0 ? {
            id: typeMemories[0].point.id,
            memoryType: (typeMemories[0].point as any).type || memoryType,
            timestamp: typeMemories[0].point.payload?.timestamp
          } : null
        };
        
        console.log(`[memory/all/route] Memory type ${memoryType} has ${typeMemories.length} items`);
      } catch (typeError) {
        console.error(`[memory/all/route] Error testing memory type ${memoryType}:`, typeError);
        
        const collectionName = memoryType.toString().toLowerCase();
        diagnosticResults.collections[collectionName] = {
          status: 'error',
          error: typeError instanceof Error ? typeError.message : String(typeError)
        };
        diagnosticResults.errors.push({
          component: `memory_type_${memoryType}`,
          error: typeError instanceof Error ? typeError.message : String(typeError)
        });
      }
    }
    
    // If a specific type is requested, just search that type
    let memoryEntries: any[] = [];
    
    if (type) {
      // Get memory entries for the specified type
      console.log(`[memory/all/route] Fetching memories of type: ${type}`);
      
      const searchOptions: any = {
        types: [type],
        limit
      };
      
      // Add tags filter if provided
      if (tags && tags.length > 0) {
        searchOptions.filter = {
          tags: tags
        };
      }
      
      const searchResults = await searchService.search('', searchOptions);
      memoryEntries = searchResults.map(result => result.point);
    } else {
      // For all types, combine results from different memory types
      console.log('[memory/all/route] Fetching memories from all types');
      
      try {
        // Get a relatively balanced mix from each type
        const perTypeLimit = Math.ceil(limit / MEMORY_TYPES.length);
        
        for (const memoryType of MEMORY_TYPES) {
          try {
            console.log(`[memory/all/route] Fetching from memory type: ${memoryType}`);
            
            const searchOptions: any = {
              types: [memoryType],
              limit: perTypeLimit
            };
            
            // Add tags filter if provided
            if (tags && tags.length > 0) {
              searchOptions.filter = {
                tags: tags
              };
            }
            
            const typeResults = await searchService.search('', searchOptions);
            const typeMemories = typeResults.map(result => result.point);
            
            console.log(`[memory/all/route] Found ${typeMemories.length} memories of type ${memoryType}`);
            memoryEntries.push(...typeMemories);
          } catch (error) {
            console.error(`[memory/all/route] Error fetching memories of type ${memoryType}:`, error);
          }
        }
        
        // Sort all memories by timestamp (newest first)
        memoryEntries.sort((a, b) => {
          const timeA = a.payload?.timestamp ? new Date(a.payload.timestamp).getTime() : 0;
          const timeB = b.payload?.timestamp ? new Date(b.payload.timestamp).getTime() : 0;
          return timeB - timeA;
        });
        
        // Limit the total number of memories after combining all types
        if (memoryEntries.length > limit) {
          memoryEntries = memoryEntries.slice(0, limit);
        }
      } catch (error) {
        console.error('[memory/all/route] Error fetching memories from all types:', error);
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
 * Format a memory record for API response
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
    
    // Get the content from the payload
    const payload = record.payload || {};
    
    // Ensure we have text content
    const content = payload.text || '';
    if (!content) {
      console.warn(`[memory/all/route] Memory record ${id} has no content`);
    }
    
    // Get timestamp from payload
    const timestamp = payload.timestamp || new Date().toISOString();
    
    // Get metadata from payload
    const metadata = payload.metadata || {};
    
    // Determine type from record or metadata
    const type = record.type || metadata.type || 'unknown';
    
    // Check if this is a memory_edit record
    const isMemoryEdit = type === 'memory_edits' || metadata.original_memory_id;
    
    // Extract versioning fields or use defaults
    const originalMemoryId = metadata.original_memory_id;
    const editType = metadata.edit_type || 'update';
    const editorType = metadata.editor_type || 'system';
    const editorId = metadata.editor_id;
    const diffSummary = metadata.diff_summary;
    const current = metadata.current === true;
    const previousVersionId = metadata.previous_version_id;
    
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
      category: metadata.category || metadata.tag || type || 'unknown',
      source: metadata.source || 'system',
      importance: metadata.importance || 'medium',
      tags: Array.isArray(metadata.tags) ? metadata.tags : [],
      // Include all original metadata to preserve version information and other details
      metadata: {
        ...metadata,
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

/**
 * API route to retrieve all memories without pagination limits
 */
export async function GET_ALL_MESSAGES(request: NextRequest) {
  console.log('Fetching all memories without pagination');
  
  try {
    // Initialize services
    const { client, searchService } = await getMemoryServices();
    
    // Check if memory service is initialized
    const status = await client.getStatus();
    console.log(`Memory system initialized: ${status.initialized}`);
    
    if (!status.initialized) {
      console.log('Initializing memory system');
      await client.initialize();
    }
    
    // Parse query parameters
    const url = new URL(request.url);
    const typeParam = url.searchParams.get('type');
    
    // Set search options with a high limit to get all messages
    const searchOptions = {
      types: typeParam ? [typeParam as MemoryType] : undefined,
      limit: 1000,  // Set a very high limit to get all messages
      offset: 0
    };
    
    console.log('Searching for memories with options:', searchOptions);
    
    // Get all memories using search with empty query
    const results = await searchService.search('', searchOptions);
    
    console.log(`Found ${results.length} memories`);
    
    // Return the memories with additional metadata
    return NextResponse.json({
      memories: results,
      total: results.length,
      memorySystemStatus: status
    });
  } catch (error) {
    console.error('Error fetching all memories:', error);
    
    // Return an error response
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      memories: []
    }, { status: 500 });
  }
} 