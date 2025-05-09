import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../server/memory/services';
import { ImportanceLevel, MemorySource } from '../../../../constants/memory';
import { MemoryType } from '../../../../server/memory/config/types';
import { BaseMetadata } from '../../../../types/metadata';

export const runtime = 'nodejs';

// Extended metadata interface for UI-specific properties
interface ExtendedKnowledgeMetadata extends BaseMetadata {
  userId?: string | { toString(): string };
  tags?: string[];
  flagged?: boolean;
  isKnowledge?: boolean;
  addedToKnowledge?: boolean;
  addedToKnowledgeAt?: string;
}

/**
 * API endpoint to add flagged messages to knowledge storage
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids, addTags = [] } = body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid IDs provided' },
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
    
    const successfulItems: any[] = [];
    const failedItems: any[] = [];
    
    // Process each message
    for (const id of ids) {
      try {
        // Fetch the message by searching for its ID
        const searchResults = await searchService.search('', {
          filter: { id },
          limit: 1
        });
        
        if (searchResults.length === 0) {
          failedItems.push({ id, error: 'Message not found' });
          continue;
        }
        
        const searchResult = searchResults[0];
        const message = searchResult.point;
        const messageType = searchResult.type;
        
        // Extract content and metadata
        const content = message.payload?.text;
        const rawMetadata = message.payload?.metadata || {};
        
        // Cast to extended metadata interface
        const metadata = rawMetadata as ExtendedKnowledgeMetadata;
        
        const originalTags = metadata.tags || [];
        const allTags = Array.from(new Set([...originalTags, ...addTags]));
        const category = getCategoryFromTags(allTags) || messageType;
        
        // Store as a knowledge item in memory with enhanced metadata
        const knowledgeMemoryResult = await memoryService.addMemory({
          type: messageType,
          content,
          metadata: {
            ...metadata,
            schemaVersion: metadata.schemaVersion || "1.0.0", // Ensure required field exists
            userId: metadata.userId ? metadata.userId.toString() : 'gab',
            source: MemorySource.USER,
            importance: ImportanceLevel.HIGH,
            isKnowledge: true,
            category,
            tags: allTags,
            originalId: id,
            addedToKnowledgeAt: new Date().toISOString()
          }
        });
        
        // Mark the original message as added to knowledge
        await memoryService.updateMemory({
          id,
          type: messageType,
          metadata: {
            ...metadata,
            schemaVersion: metadata.schemaVersion || "1.0.0", // Ensure required field exists
            userId: metadata.userId ? metadata.userId.toString() : 'gab',
            addedToKnowledge: true,
            addedToKnowledgeAt: new Date().toISOString(),
            flagged: false // Remove flag once processed
          }
        });
        
        successfulItems.push({
          id,
          tags: allTags,
          category,
          knowledgeId: knowledgeMemoryResult.id
        });
      } catch (error) {
        console.error(`Error processing message ${id}:`, error);
        failedItems.push({
          id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      processedCount: successfulItems.length,
      failedCount: failedItems.length,
      processed: successfulItems,
      failed: failedItems
    });
  } catch (error) {
    console.error('Error adding messages to knowledge:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add messages to knowledge' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to extract a category from tags
 */
function getCategoryFromTags(tags: string[]): string | null {
  const categoryTags = [
    'concept', 'principle', 'fact', 'procedure',
    'personal', 'professional', 'academic', 'technical',
    'preference', 'opinion', 'background', 'experience'
  ];
  
  for (const tag of tags) {
    if (categoryTags.includes(tag.toLowerCase())) {
      return tag.toLowerCase();
    }
  }
  
  return null;
} 