import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../server/memory/services';

export const runtime = 'nodejs';

/**
 * API endpoint to add tags to multiple memory items
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids, tags } = body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid IDs provided' },
        { status: 400 }
      );
    }
    
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid tags provided' },
        { status: 400 }
      );
    }
    
    // Get memory services
    const { client, memoryService, searchService } = await getMemoryServices();
    
    // Initialize memory services if needed
    const status = await client.getStatus();
    if (!status.initialized) {
      await client.initialize();
    }
    
    const updatedItems = [];
    const failedItems = [];
    
    // Process each memory item
    for (const id of ids) {
      try {
        // Find the memory item by id
        const searchResults = await searchService.search('', {
          filter: { id },
          limit: 1
        });
        
        if (searchResults && searchResults.length > 0) {
          const searchResult = searchResults[0];
          const memoryItem = searchResult.point;
          const memoryType = searchResult.type;
          
          // Extract existing metadata and tags
          const existingMetadata = memoryItem.payload?.metadata || {};
          const existingTags = existingMetadata.tags || [];
          
          // Merge existing tags with new ones (removing duplicates)
          const updatedTags = Array.from(new Set([...existingTags, ...tags]));
          
          // Create updated metadata
          const updatedMetadata = {
            ...existingMetadata,
            tags: updatedTags
          };
          
          // Update the memory item
          await memoryService.updateMemory({
            id,
            type: memoryType,
            metadata: updatedMetadata
          });
          
          updatedItems.push({
            id,
            tags: updatedTags
          });
        } else {
          failedItems.push({
            id,
            error: 'Memory item not found'
          });
        }
      } catch (error) {
        failedItems.push({
          id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      updatedCount: updatedItems.length,
      failedCount: failedItems.length,
      updated: updatedItems,
      failed: failedItems
    });
  } catch (error) {
    console.error('Error bulk tagging memory items:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to bulk tag memory items' },
      { status: 500 }
    );
  }
} 