import { NextRequest, NextResponse } from 'next/server';
import * as serverQdrant from '../../../../server/qdrant';
import { ImportanceLevel, MemorySource } from '../../../../constants/memory';

export const runtime = 'nodejs';

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
    
    // Initialize Qdrant memory
    await serverQdrant.initMemory();
    
    const successfulItems: any[] = [];
    const failedItems: any[] = [];
    
    // Process each message
    for (const id of ids) {
      try {
        // Fetch the message by searching for its ID
        const messages = await serverQdrant.searchMemory(
          null, // Search all types
          '',   // Empty query
          {
            filter: { id },
            limit: 1
          }
        );
        
        if (messages.length === 0) {
          failedItems.push({ id, error: 'Message not found' });
          continue;
        }
        
        const message = messages[0];
        
        // Extract content and metadata
        const content = message.text;
        const originalTags = message.metadata?.tags || [];
        const allTags = Array.from(new Set([...originalTags, ...addTags]));
        const category = getCategoryFromTags(allTags) || message.type;
        
        // Store as a knowledge item in memory with enhanced metadata
        await serverQdrant.addMemory(
          message.type,
          content,
          {
            ...message.metadata,
            source: MemorySource.USER,
            importance: ImportanceLevel.HIGH,
            isKnowledge: true,
            category,
            tags: allTags,
            originalId: id,
            addedToKnowledgeAt: new Date().toISOString()
          }
        );
        
        // Mark the original message as added to knowledge
        await serverQdrant.updateMemoryMetadata(id, {
          addedToKnowledge: true,
          addedToKnowledgeAt: new Date().toISOString(),
          flagged: false // Remove flag once processed
        });
        
        successfulItems.push({
          id,
          tags: allTags,
          category
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
 * Determine a category based on provided tags
 */
function getCategoryFromTags(tags: string[]): string | undefined {
  // Category mapping based on common tags
  const categoryMap: Record<string, string[]> = {
    'concept': ['concept', 'idea', 'theory', 'model', 'framework'],
    'process': ['process', 'procedure', 'workflow', 'method'],
    'resource': ['tool', 'resource', 'app', 'technology'],
    'insight': ['insight', 'learning', 'observation', 'reflection'],
    'strategy': ['strategy', 'approach', 'tactic', 'plan'],
    'reference': ['reference', 'citation', 'source', 'document'],
    'principle': ['principle', 'rule', 'guideline', 'standard']
  };
  
  // Check if any tags match our categories
  for (const [category, relatedTags] of Object.entries(categoryMap)) {
    if (tags.some(tag => relatedTags.includes(tag.toLowerCase()))) {
      return category;
    }
    
    // Also check if the category name itself is in the tags
    if (tags.some(tag => tag.toLowerCase() === category)) {
      return category;
    }
  }
  
  return undefined;
} 