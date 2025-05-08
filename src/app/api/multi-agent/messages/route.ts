import { NextResponse } from 'next/server';
import { generateMessageId, MessageRole, MessageStatus, MessageType, SendMessageRequest } from '@/lib/multi-agent/types/message';

/**
 * POST /api/multi-agent/messages
 * Send a message to a chat
 */
export async function POST(request: Request) {
  try {
    // Parse request body
    const requestData: SendMessageRequest = await request.json();
    
    // Validate required fields
    if (!requestData.chatId) {
      return NextResponse.json(
        { success: false, error: 'Chat ID is required' },
        { status: 400 }
      );
    }
    
    if (!requestData.senderId) {
      return NextResponse.json(
        { success: false, error: 'Sender ID is required' },
        { status: 400 }
      );
    }
    
    if (!requestData.senderType) {
      return NextResponse.json(
        { success: false, error: 'Sender type is required' },
        { status: 400 }
      );
    }
    
    if (!requestData.content && !requestData.attachments?.length) {
      return NextResponse.json(
        { success: false, error: 'Message content or attachments are required' },
        { status: 400 }
      );
    }
    
    // Generate message ID and timestamps
    const messageId = generateMessageId();
    const timestamp = new Date();
    
    // Determine message role based on sender type
    let role = MessageRole.USER;
    if (requestData.senderType === 'agent') {
      role = MessageRole.AGENT;
    } else if (requestData.senderType === 'system') {
      role = MessageRole.SYSTEM;
    }
    
    // Create message object
    const message = {
      id: messageId,
      chatId: requestData.chatId,
      senderId: requestData.senderId,
      senderType: requestData.senderType,
      content: requestData.content || '',
      type: requestData.type || MessageType.TEXT,
      role,
      status: MessageStatus.DELIVERED,
      attachments: requestData.attachments || [],
      replyToId: requestData.replyToId,
      metadata: requestData.metadata || {},
      createdAt: timestamp,
      updatedAt: timestamp
    };
    
    // TODO: Store the message in the database
    // This will be implemented when the database infrastructure is ready
    
    // If the sender is a user, trigger agent response
    if (role === MessageRole.USER) {
      // TODO: In a full implementation, we'd:
      // 1. Find the agent participant(s) in the chat
      // 2. Send the message to the agent(s) for processing
      // 3. Wait for an agent response or return immediately with a 202 Accepted
      
      // For now, we'll simulate that an agent is processing the message
      console.log(`User message received, would trigger agent response for chat ${requestData.chatId}`);
    }
    
    return NextResponse.json({
      success: true,
      message: {
        ...message,
        // Convert dates to strings for JSON serialization
        createdAt: timestamp.toISOString(),
        updatedAt: timestamp.toISOString()
      }
    });
  } catch (error) {
    console.error('Error sending message:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/multi-agent/messages
 * Get messages from a chat
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');
    const senderId = searchParams.get('senderId');
    const senderType = searchParams.get('senderType');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;
    
    if (!chatId) {
      return NextResponse.json(
        { success: false, error: 'Chat ID is required' },
        { status: 400 }
      );
    }
    
    // TODO: Fetch messages from the database based on the search parameters
    // This will be implemented when the database infrastructure is ready
    
    // For now, return an empty array
    return NextResponse.json({
      success: true,
      messages: [],
      total: 0,
      hasMore: false
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      },
      { status: 500 }
    );
  }
} 