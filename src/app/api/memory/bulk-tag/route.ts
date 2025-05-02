import { NextRequest, NextResponse } from 'next/server';
import * as serverQdrant from '../../../../server/qdrant';

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
    
    // Initialize Qdrant memory
    await serverQdrant.initMemory();
    
    const updatedItems = [];
    const failedItems = [];
    
    // Process each memory item
    for (const id of ids) {
      try {
        // Get the memory item using searchMemory instead of getMemoryById
        const memoryItems = await serverQdrant.searchMemory(
          null, // Search all types
          '',   // Empty query
          {
            filter: { id }, // Filter by ID
            limit: 1
          }
        );
        
        if (memoryItems && memoryItems.length > 0) {
          const memoryItem = memoryItems[0];
          
          // Prepare the updated tags (merging existing tags with new ones)
          const existingTags = memoryItem.metadata?.tags || [];
          const updatedTags = Array.from(new Set([...existingTags, ...tags]));
          
          // Update the memory item's metadata
          const updatedMetadata = {
            ...memoryItem.metadata || {},
            tags: updatedTags
          };
          
          // Update the memory item
          await serverQdrant.updateMemoryMetadata(id, updatedMetadata);
          
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