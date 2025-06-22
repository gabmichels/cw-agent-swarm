import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../server/memory/services';
import { MemoryType } from '@/server/memory/config/types';
import { ImportanceLevel } from '@/server/memory/config/types';
import { KnowledgeGraphManager } from '../../../lib/agents/implementations/memory/KnowledgeGraphManager';
import { KnowledgeNodeType } from '../../../lib/agents/shared/memory/types';
import { BaseMetadata } from '../../../types/metadata';

// Interface for extended metadata in Knowledge context
interface ExtendedKnowledgeMetadata extends BaseMetadata {
  type?: string;
  tags?: string[];
}

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      content, 
      messageId, 
      tags = [], 
      category = 'general',
      addedBy = 'user' 
    } = body;

    if (!content && !messageId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Either content or messageId is required' 
      }, { status: 400 });
    }

    // Initialize memory services
    const { memoryService, searchService } = await getMemoryServices();
    
    // Initialize the knowledge graph manager
    const graphManager = new KnowledgeGraphManager();
    await graphManager.initialize();

    // Determine memory content: either use provided content or fetch by ID
    let memoryContent = content;
    let memoryType = 'message';
    let memoryTags = [...tags];
    const sourceId = messageId;
    let recordTimestamp: string | number = new Date().toISOString();

    // If messageId is provided, fetch the memory
    if (messageId) {
      // Search for the message using the search service
      const searchResults = await searchService.search('', {
        filter: { id: messageId },
        limit: 1
      });

      if (searchResults.length === 0) {
        return NextResponse.json({ 
          success: false, 
          error: 'Memory not found with the provided ID' 
        }, { status: 404 });
      }

      const record = searchResults[0].point;
      memoryContent = record.payload?.text || '';
      
      // Cast metadata to extended type for knowledge fields
      const metadata = record.payload?.metadata as ExtendedKnowledgeMetadata;
      memoryType = metadata?.type || 'message';
      
      // Merge tags from record if available
      if (metadata?.tags && Array.isArray(metadata.tags)) {
        memoryTags = [...memoryTags, ...metadata.tags];
      }
      
      recordTimestamp = metadata?.timestamp || new Date().toISOString();
    }

    // Convert timestamp to string if it's a number
    const timestamp = typeof recordTimestamp === 'number' 
      ? new Date(recordTimestamp).toISOString() 
      : recordTimestamp;

    // Generate a title from the content (first line or first 50 chars)
    const title = memoryContent.split('\n')[0].trim().substring(0, 50) || 'Knowledge item';
    
    // Auto-tag based on memory type
    if (memoryType === 'thought' || /reflection|insight|reasoning/i.test(memoryContent)) {
      if (!memoryTags.includes('insight')) {
        memoryTags.push('insight');
      }
    }

    // Infer category if not provided or is 'general'
    let inferredCategory = category;
    if (category === 'general' && memoryTags.length > 0) {
      // Use the first tag as a category if it makes sense
      const potentialCategory = memoryTags[0].toLowerCase();
      if (potentialCategory !== 'important' && potentialCategory !== 'insight') {
        inferredCategory = potentialCategory;
      }
    }

    // Determine node type based on content
    let nodeType: KnowledgeNodeType = KnowledgeNodeType.CONCEPT;
    if (memoryContent.includes('insight') || memoryContent.includes('observation')) {
      nodeType = KnowledgeNodeType.INSIGHT;
    } else if (memoryContent.includes('process') || memoryContent.includes('workflow')) {
      nodeType = KnowledgeNodeType.PROCESS;
    } else if (memoryContent.includes('resource') || memoryContent.includes('tool')) {
      nodeType = KnowledgeNodeType.RESOURCE;
    }

    // Create knowledge node
    const nodeId = `knowledge-${Date.now()}`;
    await graphManager.addNode({
      id: nodeId,
      label: title,
      type: nodeType,
      description: memoryContent,
      tags: [...memoryTags, inferredCategory],
      metadata: {
        source: 'memory',
        sourceId: sourceId || `generated_${Date.now()}`,
        addedBy,
        addedVia: 'knowledge_api',
        addedAt: timestamp,
        importance: ImportanceLevel.HIGH,
        originalMetadata: body
      }
    });

    // Also add a reference to memory system with high importance
    await memoryService.addMemory({
      id: nodeId,
      type: MemoryType.DOCUMENT,
      content: memoryContent,
      metadata: {
        schemaVersion: "1.0.0", // Required by BaseMetadata
        kind: 'knowledge',
        category: inferredCategory,
        tags: memoryTags,
        importance: ImportanceLevel.HIGH,
        source: 'knowledge_system',
        addedBy,
        title,
        knowledgeId: nodeId,
        sourceMemoryId: sourceId || `generated_${Date.now()}`,
        addedAt: timestamp
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Content added to knowledge system',
      itemId: nodeId,
      knowledgeItem: {
        id: nodeId,
        title,
        content: memoryContent,
        type: nodeType,
        tags: memoryTags,
        category: inferredCategory,
        addedBy,
        createdAt: new Date(timestamp)
      }
    });
  } catch (error) {
    console.error('Error adding to knowledge system:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add content to knowledge system' },
      { status: 500 }
    );
  }
} 