import { NextResponse } from 'next/server';
import { createAgentMemoryService } from '@/server/memory/services/multi-agent';
import { getMemoryServices } from '@/server/memory/services';
import { AgentFactory } from '@/agents/shared/AgentFactory';
import { AgentMemoryService } from '@/server/memory/services/multi-agent/agent-service';

/**
 * POST /api/multi-agent/agents/[agentId]/process
 * Process a message using the specified agent
 */
export async function POST(
  request: Request,
  { params }: { params: { agentId: string } }
) {
  try {
    const dynamicParams = await params;
    const agentId = dynamicParams.agentId;
    
    if (!agentId) {
      return NextResponse.json(
        { success: false, error: 'Agent ID is required' },
        { status: 400 }
      );
    }
    
    // Get message data
    const { message, options = {} } = await request.json();
    
    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      );
    }
    
    // Get the agent from the memory service
    const { memoryService } = await getMemoryServices();
    const agentService: AgentMemoryService = await createAgentMemoryService(memoryService);
    
    // Get the agent entity
    const result = await agentService.getAgent(agentId);
    
    if (result.isError || !result.value) {
      return NextResponse.json(
        { success: false, error: result.error?.message || 'Agent not found' },
        { status: result.error ? 500 : 404 }
      );
    }
    
    const agentEntity = result.value;
    
    // Create an agent instance from the entity
    try {
      const agent = AgentFactory.createFromDbEntity(agentEntity);
      
      // Initialize the agent (if not already initialized)
      await agent.initialize();
      
      // Process the message
      const response = await agent.processInput(message, options);
      
      return NextResponse.json({
        success: true,
        agentId: agentId,
        message: message,
        response: response,
        timestamp: new Date()
      });
    } catch (error) {
      return NextResponse.json(
        { 
          success: false, 
          error: error instanceof Error ? error.message : 'An unknown error occurred'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error processing message:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      },
      { status: 500 }
    );
  }
} 