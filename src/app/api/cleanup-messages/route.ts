import { NextResponse } from 'next/server';
import { getMemoryServices } from '../../../server/memory/services';
import { MemoryType } from '../../../server/memory/config';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Cleanup incorrectly categorized reflection messages from the chat history
 */
export async function GET() {
  try {
    // Get memory services
    const { client, memoryService, searchService } = await getMemoryServices();
    
    // Check if memory system is initialized
    const status = await client.getStatus();
    if (!status.initialized) {
      await client.initialize();
    }
    
    // Search for messages that look like reflections
    const reflectionKeywords = [
      "Investigated intent failures",
      "Analyzed user feedback",
      "Monitored system performance",
      "Evaluated response quality",
      "Detected patterns in",
      "Optimized response generation",
      "Performance Review:",
      "Success Rate:",
      "Task Completion:",
      "User Satisfaction:"
    ];
    
    // Get all message memories
    const messageResults = await searchService.search('', {
      types: [MemoryType.MESSAGE],
      limit: 1000
    });
    
    // Convert search results to a more usable format
    const allMessages = messageResults.map(result => ({
      id: result.point.id,
      text: result.point.payload?.text || '',
      timestamp: result.point.payload?.timestamp,
      metadata: result.point.payload?.metadata || {}
    }));
    
    // Filter messages that look like reflections based on content
    const suspectedReflections = allMessages.filter(msg => {
      // Check if the message content matches any of the reflection keywords
      return reflectionKeywords.some(keyword => 
        msg.text && typeof msg.text === 'string' && msg.text.includes(keyword)
      );
    });
    
    console.log(`Found ${suspectedReflections.length} suspected reflections out of ${allMessages.length} total messages`);
    
    // Delete the suspected reflection messages
    let deletedCount = 0;
    
    if (suspectedReflections.length > 0) {
      // For a small number of suspected reflections, mark them as deleted
      const deletePromises = suspectedReflections.map(async (reflection) => {
        try {
          const result = await memoryService.deleteMemory({
            id: reflection.id,
            type: MemoryType.MESSAGE
          });
          
          if (result) {
            deletedCount++;
          }
          return result;
        } catch (error) {
          console.error(`Error deleting message ${reflection.id}:`, error);
          return false;
        }
      });
      
      await Promise.all(deletePromises);
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