import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../server/memory/services';
import { MemoryType } from '../../../../server/memory/config/types';
import { KnowledgeGraphManager } from '../../../../lib/agents/implementations/memory/KnowledgeGraphManager';

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
        // Get memory services
        const { client, searchService } = await getMemoryServices();
        
        // Check if memory service is initialized
        const status = await client.getStatus();
        if (!status.initialized) {
          await client.initialize();
        }
        
        // Get all memory entries by searching with empty query
        const searchResults = await searchService.search('', {
          limit: 1000
        });
        
        // Process tags from memory entries
        const memoryEntries = searchResults.map(result => ({
          id: result.point.id,
          text: result.point.payload?.text || '',
          metadata: result.point.payload?.metadata || {}
        }));
        
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
    
    // Get tags from knowledge graph if requested
    if (includeKnowledge) {
      try {
        // Initialize Knowledge Graph Manager
        const graphManager = new KnowledgeGraphManager();
        await graphManager.initialize();
        
        // Get all nodes
        const nodes = await graphManager.findNodes('', undefined, 1000);
        
        // Process tags from nodes
        nodes.forEach(node => {
          if (node.tags && Array.isArray(node.tags)) {
            node.tags.forEach(tag => {
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
        console.error('Error getting tags from knowledge graph:', error);
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