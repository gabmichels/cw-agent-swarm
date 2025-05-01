import { NextRequest, NextResponse } from 'next/server';
import * as serverQdrant from '../../../server/qdrant';
import { MemoryRecord } from '../../../server/qdrant';
import { ChloeMemory } from '../../../agents/chloe/memory';
import { ImportanceLevel } from '../../../constants/memory';
import { KnowledgeGraph } from '../../../lib/knowledge/KnowledgeGraph';
import { KnowledgeFlaggingService } from '../../../lib/knowledge/flagging/KnowledgeFlaggingService';
import { SuggestedKnowledgeType } from '../../../lib/knowledge/flagging/types';

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

    // Initialize memory systems
    await serverQdrant.initMemory();
    const memory = new ChloeMemory();
    await memory.initialize();
    
    // Initialize the knowledge systems
    const knowledgeGraph = new KnowledgeGraph('default');
    await knowledgeGraph.load();
    const flaggingService = new KnowledgeFlaggingService(knowledgeGraph);
    await flaggingService.load();

    // Determine memory content: either use provided content or fetch by ID
    let memoryContent = content;
    let memoryType = 'message';
    let memoryTags = [...tags];
    let sourceId = messageId;
    let timestamp = new Date().toISOString();

    // If messageId is provided, fetch the memory
    if (messageId) {
      // Search for the message in Qdrant
      const records = await serverQdrant.searchMemory(null, '', {
        filter: { id: messageId },
        limit: 1
      });

      if (records.length === 0) {
        return NextResponse.json({ 
          success: false, 
          error: 'Memory not found with the provided ID' 
        }, { status: 404 });
      }

      const record = records[0];
      memoryContent = record.text;
      memoryType = record.type;
      
      // Merge tags from record if available
      if (record.metadata?.tags && Array.isArray(record.metadata.tags)) {
        memoryTags = [...memoryTags, ...record.metadata.tags];
      }
      
      timestamp = record.timestamp;
    }

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

    // Create structured knowledge item
    const knowledgeItem = {
      title,
      content: memoryContent,
      sourceMemoryId: sourceId || `generated_${Date.now()}`,
      type: memoryType,
      tags: memoryTags,
      addedBy,
      createdAt: new Date(),
      category: inferredCategory,
      importance: ImportanceLevel.HIGH
    };

    // Determine the suggested knowledge type based on content and tags
    let suggestedType: SuggestedKnowledgeType = 'concept'; // Default type
    if (memoryTags.includes('principle') || /principle|rule|guideline/i.test(memoryContent)) {
      suggestedType = 'principle';
    } else if (memoryTags.includes('framework') || /framework|model|methodology/i.test(memoryContent)) {
      suggestedType = 'framework';
    } else if (memoryTags.includes('research') || /research|study|finding/i.test(memoryContent)) {
      suggestedType = 'research';
    }

    // Store in knowledge system via flagging service
    const result = await flaggingService.flagManually(
      title,
      memoryContent,
      suggestedType,
      inferredCategory,
      // Using a basic properties object with type assertion to avoid complex typing issues
      {
        type: suggestedType,
        name: title,
        description: memoryContent
      } as any, // Use type assertion for simplicity
      {
        source: 'memory',
        sourceId: knowledgeItem.sourceMemoryId,
        addedBy: knowledgeItem.addedBy,
        addedVia: 'knowledge_api',
        addedAt: new Date().toISOString(),
        tags: memoryTags,
        timestamp,
        importance: ImportanceLevel.HIGH,
        originalMetadata: body
      }
    );

    if (result.success) {
      // Save changes to the flagging service
      await flaggingService.save();
      
      // Also add a reference to Qdrant memory with high importance
      await serverQdrant.addMemory(
        'document',
        memoryContent,
        {
          id: result.itemId,
          kind: 'knowledge',
          category: inferredCategory,
          tags: memoryTags,
          importance: ImportanceLevel.HIGH,
          source: 'knowledge_system',
          addedBy,
          title,
          knowledgeId: result.itemId,
          sourceMemoryId: knowledgeItem.sourceMemoryId,
          flaggedAt: new Date().toISOString()
        }
      );

      return NextResponse.json({ 
        success: true, 
        message: 'Content added to knowledge system',
        itemId: result.itemId,
        knowledgeItem
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: result.error || 'Failed to add content to knowledge system' 
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error adding to knowledge system:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add content to knowledge system' },
      { status: 500 }
    );
  }
} 