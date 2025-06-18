import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../../../server/memory/services';
import { MessageRole } from '../../../../../../agents/shared/types/MessageTypes';
import { generateSystemUserId, generateAgentId, generateChatId } from '../../../../../../lib/core/id-generation';
import { addMessageMemory } from '../../../../../../server/memory/services/memory/memory-service-wrappers';
import { getOrCreateThreadInfo } from '../../../../chat/thread/helper';
import { createUserId, createAgentId as createAgentEntityId, createChatId as createChatEntityId } from '../../../../../../types/entity-identifier';

/**
 * POST /api/multi-agent/chats/[chatId]/agent-messages
 * Create a message from an agent (appears as assistant message in chat)
 */
export async function POST(
  request: NextRequest,
  context: { params: { chatId: string } }
) {
  try {
    const params = await context.params;
    const chatId = params.chatId;
    
    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { content, agentId, metadata = {} } = body;

    if (!content) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      );
    }

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }

    // Get memory services
    const { memoryService } = await getMemoryServices();

    // Create EntityIdentifier objects following arch-refactor-guidelines
    const systemUserEntityId = createUserId('system'); // System user for agent messages  
    const agentEntityId = createAgentEntityId(agentId); // Create EntityIdentifier object for agent
    const chatEntityId = createChatEntityId(chatId); // Create EntityIdentifier object for chat

    // Create thread info for agent message
    const threadInfo = getOrCreateThreadInfo(chatId, 'assistant');

    console.log(`Creating agent message from ${agentId} in chat ${chatId}`);

    // Add agent message to memory with ASSISTANT role
    const messageResult = await addMessageMemory(
      memoryService,
      content,
      MessageRole.ASSISTANT, // This ensures it appears as agent message
      systemUserEntityId,  // Pass EntityIdentifier object
      agentEntityId,       // Pass EntityIdentifier object
      chatEntityId,        // Pass EntityIdentifier object
      threadInfo,
      {
        messageType: metadata.messageType || 'scheduled_message',
        metadata: {
          sentViaAgent: true,
          toolUsed: 'send_message',
          deliveredAt: new Date().toISOString(),
          isAutomatedMessage: true,
          ...metadata
        }
      }
    );

    if (messageResult && messageResult.id) {
      console.log(`✅ Agent message created successfully with ID: ${messageResult.id}`);
      
      return NextResponse.json({
        success: true,
        messageId: messageResult.id,
        content,
        role: 'assistant',
        agentId,
        chatId,
        timestamp: new Date().toISOString()
      });
    } else {
      console.error('❌ Failed to create agent message:', messageResult);
      return NextResponse.json(
        { error: 'Failed to create message' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error creating agent message:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 