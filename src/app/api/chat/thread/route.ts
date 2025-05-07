import { NextRequest, NextResponse } from 'next/server';
import { getFormattedThreadMessages, getOrCreateThreadInfo, createResponseThreadInfo } from './helper';
import { getMemoryServices } from '../../../../server/memory/services';
import { MemoryType } from '../../../../server/memory/config';

/**
 * GET /api/chat/thread?threadId=<thread-id>
 * 
 * Get all messages in a thread, properly formatted and sorted
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const threadId = url.searchParams.get('threadId');
  
  if (!threadId) {
    return NextResponse.json(
      { error: 'Missing required parameter: threadId' },
      { status: 400 }
    );
  }
  
  try {
    // Use helper function to get formatted messages
    const messages = await getFormattedThreadMessages(threadId);
    
    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Error retrieving thread messages:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve thread messages' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/chat/thread
 * 
 * Create or update thread info for a message
 * 
 * Request body:
 * {
 *   chatId: string;          // The ID of the chat
 *   role: 'user' | 'assistant'; // Role of the message sender
 *   prevMessageId?: string;  // Optional ID of the previous message in the conversation
 * }
 * 
 * Response:
 * {
 *   threadInfo: ThreadInfo;  // The thread info to use for the message
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chatId, role, prevMessageId } = body;
    
    if (!chatId || !role) {
      return NextResponse.json(
        { error: 'Missing required parameters: chatId, role' },
        { status: 400 }
      );
    }
    
    // Validate role
    if (role !== 'user' && role !== 'assistant') {
      return NextResponse.json(
        { error: 'Invalid role. Must be either "user" or "assistant"' },
        { status: 400 }
      );
    }
    
    // Different handling for user vs assistant messages
    let threadInfo;
    
    if (role === 'user') {
      // For user messages, get or create a thread
      threadInfo = getOrCreateThreadInfo(chatId, role, prevMessageId);
    } else {
      // For assistant messages, ensure they link to the previous user message
      if (!prevMessageId) {
        return NextResponse.json(
          { error: 'Assistant messages must include prevMessageId' },
          { status: 400 }
        );
      }
      
      // Create a response thread based on the user message
      threadInfo = await createResponseThreadInfo(prevMessageId);
    }
    
    return NextResponse.json({ threadInfo });
  } catch (error) {
    console.error('Error creating thread info:', error);
    return NextResponse.json(
      { error: 'Failed to create thread info' },
      { status: 500 }
    );
  }
} 