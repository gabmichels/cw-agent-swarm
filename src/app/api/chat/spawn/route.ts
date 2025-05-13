import { NextResponse } from 'next/server';
import { getChatService } from '../../../../server/memory/services/chat-service';
import { ChatType } from '../../../../server/memory/models/chat-collection';
import { getCurrentUser } from '../../../../lib/user';

/**
 * POST handler - spawn a new chat session
 */
export async function POST(request: Request) {
  try {
    // Get parameters from request
    const defaultUser = getCurrentUser();
    const { userId = defaultUser.id, agentId = '', title, description } = await request.json();
    
    // Validate agentId
    if (!agentId) {
      try {
        // Try to get the default agent
        const { AgentService } = await import('@/services/AgentService');
        const defaultAgent = await AgentService.getDefaultAgent();
        
        if (defaultAgent && defaultAgent.id) {
          // Use default agent
          console.log(`Using default agent: ${defaultAgent.name || defaultAgent.id}`);
        } else {
          // No default agent available
          return NextResponse.json({
            success: false,
            error: 'No agent ID specified and no default agent available'
          }, { status: 400 });
        }
      } catch (error) {
        console.error('Error finding default agent:', error);
        return NextResponse.json({
          success: false,
          error: 'Failed to find default agent'
        }, { status: 500 });
      }
    }
    
    // Validate inputs
    if (!userId || !agentId) {
      return NextResponse.json(
        { error: 'userId and agentId are required' },
        { status: 400 }
      );
    }
    
    // Create a fresh chat with forceNewId=true to ensure a unique UUID
    const chatService = await getChatService();
    const chatSession = await chatService.createChat(userId, agentId, {
      title: title || `New conversation with ${agentId}`,
      description: description || `Fresh conversation between user ${userId} and agent ${agentId}`,
      type: ChatType.DIRECT,
      forceNewId: true // This ensures we get a fresh UUID
    });
    
    return NextResponse.json({
      success: true,
      chat: {
        id: chatSession.id,
        title: chatSession.metadata?.title,
        createdAt: chatSession.createdAt,
        participants: chatSession.participants.map(p => ({
          id: p.id,
          type: p.type
        }))
      }
    });
  } catch (error) {
    console.error('Error spawning new chat:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 