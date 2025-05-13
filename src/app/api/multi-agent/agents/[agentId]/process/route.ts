import { NextResponse } from 'next/server';
import { createAgentMemoryService } from '@/server/memory/services/multi-agent';
import { getMemoryServices } from '@/server/memory/services';
import { AgentFactory } from '@/agents/shared/AgentFactory';
import { agentSchema } from '@/server/memory/schema/agent';

/**
 * POST /api/multi-agent/agents/[agentId]/process
 * Process a message using the specified agent
 */
export async function POST(
  request: Request,
  { params }: { params: { agentId: string } }
) {
  try {
    const agentId = params.agentId;
    
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
    const agentService = createAgentMemoryService(memoryService);
    
    // Ensure the repository has the schema property set
    if (agentService.repository && !agentService.repository.schema) {
      agentService.repository.schema = agentSchema;
    }
    
    const result = await agentService.getById(agentId);
    
    if (result.isError) {
      return NextResponse.json(
        { success: false, error: result.error.message },
        { status: 500 }
      );
    }
    
    if (!result.data) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }
    
    const agentEntity = result.data;
    
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