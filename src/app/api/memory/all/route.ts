import { NextRequest, NextResponse } from 'next/server';
import * as serverQdrant from '../../../../server/qdrant';

/**
 * API endpoint to fetch all memories from Chloe's knowledge base
 */
export async function GET(req: NextRequest) {
  try {
    // Init memory system
    await serverQdrant.initMemory({
      useOpenAI: process.env.USE_OPENAI_EMBEDDINGS === 'true'
    });
    
    // Fetch messages, thoughts, and document memories
    const messageMemories = await serverQdrant.getAllMemories('message', 200);
    const thoughtMemories = await serverQdrant.getAllMemories('thought', 200);
    const documentMemories = await serverQdrant.getAllMemories('document', 100);
    
    // Combine and format all memories
    const allMemories = [
      ...messageMemories.map(formatMemory),
      ...thoughtMemories.map(formatMemory),
      ...documentMemories.map(formatMemory),
    ];
    
    // Sort by timestamp (newest first)
    allMemories.sort((a, b) => {
      const dateA = new Date(a.timestamp || a.created);
      const dateB = new Date(b.timestamp || b.created);
      return dateB.getTime() - dateA.getTime();
    });
    
    return NextResponse.json(allMemories);
  } catch (error) {
    console.error('Error fetching memories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch memories' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to format memory records
 */
function formatMemory(record: any) {
  return {
    id: record.id,
    content: record.text,
    created: record.timestamp,
    timestamp: record.timestamp,
    type: record.type,
    category: record.metadata?.category || record.metadata?.tag || record.type,
    source: record.metadata?.source || 'system',
    importance: record.metadata?.importance || 'medium',
    tags: record.metadata?.tags || []
  };
} 