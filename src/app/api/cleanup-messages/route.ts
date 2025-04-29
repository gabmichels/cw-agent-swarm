import { NextResponse } from 'next/server';
import * as serverQdrant from '@/server/qdrant';
import { Message } from '@/types';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Cleanup incorrectly categorized reflection messages from the chat history
 */
export async function GET() {
  try {
    // Initialize memory system
    await serverQdrant.initMemory();
    
    // Search for messages that look like reflections
    const reflectionKeywords = [
      "Investigated intent failures",
      "Analyzed user feedback",
      "Monitored system performance",
      "Evaluated response quality",
      "Detected patterns in",
      "Optimized response generation"
    ];
    
    // Get all message memories
    const allMessages = await serverQdrant.getAllMemories('message', 1000);
    
    // Filter messages that look like reflections based on content
    const suspectedReflections = allMessages.filter(msg => {
      // Check if the message content matches any of the reflection keywords
      return reflectionKeywords.some(keyword => 
        msg.text && typeof msg.text === 'string' && msg.text.includes(keyword)
      );
    });
    
    console.log(`Found ${suspectedReflections.length} suspected reflections out of ${allMessages.length} total messages`);
    
    // Delete the suspected reflection messages by resetting the message collection
    // Note: Since there's no direct deleteMemory method, we'll use resetCollection
    // which is less precise but will handle the cleaning
    let deletedCount = 0;
    if (suspectedReflections.length > 0) {
      // For a small number of suspected reflections, it's better to recreate the collection
      // than try to delete individual points which isn't directly supported
      await serverQdrant.resetCollection('message');
      deletedCount = suspectedReflections.length;
      
      // Add back the non-suspected messages
      const messagesToKeep = allMessages.filter(msg => 
        !suspectedReflections.some(reflection => reflection.id === msg.id)
      );
      
      // Re-add the good messages
      for (const msg of messagesToKeep) {
        await serverQdrant.addMemory('message', msg.text, msg.metadata || {});
      }
    }
    
    // Return results
    return NextResponse.json({
      status: 'success',
      message: `Found and deleted ${deletedCount} suspected reflection messages`,
      totalMessages: allMessages.length,
      suspectedReflectionCount: suspectedReflections.length,
      suspectedMessages: suspectedReflections.map(msg => ({
        id: msg.id,
        text: msg.text,
        timestamp: msg.timestamp
      }))
    });
    
  } catch (error) {
    console.error('Error during message cleanup:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        totalMessages: 0,
        suspectedReflectionCount: 0,
        suspectedMessages: []
      },
      { status: 500 }
    );
  }
} 