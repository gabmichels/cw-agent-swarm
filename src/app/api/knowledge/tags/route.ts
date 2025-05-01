import { NextRequest, NextResponse } from 'next/server';
import * as serverQdrant from '../../../../server/qdrant';
import { KnowledgeGraph } from '../../../../lib/knowledge/KnowledgeGraph';
import { KnowledgeFlaggingService } from '../../../../lib/knowledge/flagging/KnowledgeFlaggingService';

interface TagCount {
  tag: string;
  count: number;
  sources: {
    memory: number;
    knowledge: number;
  };
}

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const includeMemory = url.searchParams.get('includeMemory') !== 'false';
    const includeKnowledge = url.searchParams.get('includeKnowledge') !== 'false';
    const sortBy = url.searchParams.get('sortBy') || 'count'; // 'count' or 'name'
    const sortOrder = url.searchParams.get('sortOrder') || 'desc'; // 'asc' or 'desc'
    
    // Initialize tag frequency map
    const tagMap = new Map<string, TagCount>();
    
    // Get tags from memory if requested
    if (includeMemory) {
      try {
        // Initialize Qdrant
        await serverQdrant.initMemory();
        
        // Get all memory entries from Qdrant
        const memoryEntries = await serverQdrant.getAllMemories(null, 1000);
        
        // Process tags from memory entries
        memoryEntries.forEach(entry => {
          if (entry.metadata?.tags && Array.isArray(entry.metadata.tags)) {
            entry.metadata.tags.forEach((tag: string) => {
              const tagStr = String(tag).toLowerCase();
              if (!tagStr) return;
              
              if (tagMap.has(tagStr)) {
                const tagCount = tagMap.get(tagStr)!;
                tagCount.count += 1;
                tagCount.sources.memory += 1;
              } else {
                tagMap.set(tagStr, {
                  tag: tagStr,
                  count: 1,
                  sources: {
                    memory: 1,
                    knowledge: 0
                  }
                });
              }
            });
          }
        });
      } catch (error) {
        console.error('Error getting tags from memory:', error);
        // Continue without memory tags
      }
    }
    
    // Get tags from knowledge flagging system if requested
    if (includeKnowledge) {
      try {
        // Initialize Knowledge Graph and Flagging Service
        const knowledgeGraph = new KnowledgeGraph('default');
        await knowledgeGraph.load();
        const flaggingService = new KnowledgeFlaggingService(knowledgeGraph);
        await flaggingService.load();
        
        // Get all flagged items
        const flaggedItems = flaggingService.getFlaggedItems();
        
        // Process tags from flagged items
        flaggedItems.forEach(item => {
          // Extract tags from metadata if available
          const itemTags = item.metadata?.tags || [];
          
          if (Array.isArray(itemTags)) {
            itemTags.forEach(tag => {
              const tagStr = String(tag).toLowerCase();
              if (!tagStr) return;
              
              if (tagMap.has(tagStr)) {
                const tagCount = tagMap.get(tagStr)!;
                tagCount.count += 1;
                tagCount.sources.knowledge += 1;
              } else {
                tagMap.set(tagStr, {
                  tag: tagStr,
                  count: 1,
                  sources: {
                    memory: 0,
                    knowledge: 1
                  }
                });
              }
            });
          }
          
          // Also extract from research properties if it's a research type
          if (item.suggestedType === 'research' && 
              item.suggestedProperties?.type === 'research' &&
              Array.isArray(item.suggestedProperties.tags)) {
            item.suggestedProperties.tags.forEach(tag => {
              const tagStr = String(tag).toLowerCase();
              if (!tagStr) return;
              
              if (tagMap.has(tagStr)) {
                const tagCount = tagMap.get(tagStr)!;
                tagCount.count += 1;
                tagCount.sources.knowledge += 1;
              } else {
                tagMap.set(tagStr, {
                  tag: tagStr,
                  count: 1,
                  sources: {
                    memory: 0,
                    knowledge: 1
                  }
                });
              }
            });
          }
        });
      } catch (error) {
        console.error('Error getting tags from knowledge system:', error);
        // Continue without knowledge tags
      }
    }
    
    // Convert to array and sort
    let tags = Array.from(tagMap.values());
    
    // Sort by specified criteria
    if (sortBy === 'count') {
      tags = tags.sort((a, b) => sortOrder === 'asc' ? a.count - b.count : b.count - a.count);
    } else {
      tags = tags.sort((a, b) => {
        return sortOrder === 'asc' ? 
          a.tag.localeCompare(b.tag) : 
          b.tag.localeCompare(a.tag);
      });
    }
    
    return NextResponse.json({
      tags,
      total: tags.length,
      sources: {
        memory: includeMemory,
        knowledge: includeKnowledge
      }
    });
  } catch (error) {
    console.error('Error retrieving tags:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve tags' },
      { status: 500 }
    );
  }
} 