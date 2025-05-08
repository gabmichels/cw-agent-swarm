import { NextResponse } from 'next/server';
import { IdGenerator } from '../../../../utils/ulid';
import { AgentStatus } from '../../../../server/memory/schema/agent';
import { createAgentMemoryService } from '../../../../server/memory/services/multi-agent';
import { getMemoryServices } from '../../../../server/memory/services';

/**
 * GET handler - list or search agents
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const capability = searchParams.get('capability');
    const status = searchParams.get('status');
    const agentId = searchParams.get('agentId');
    
    const { memoryService } = await getMemoryServices();
    const agentService = createAgentMemoryService(memoryService);
    
    // If specific agent ID is provided, return that agent
    if (agentId) {
      const result = await agentService.getById(agentId);
      
      if (result.isError) {
        return NextResponse.json(
          { error: result.error.message },
          { status: 404 }
        );
      }
      
      return NextResponse.json({ agent: result.data });
    }
    
    // If capability is provided, find agents with that capability
    if (capability) {
      const result = await agentService.findAgentsByCapability(capability);
      
      if (result.isError) {
        return NextResponse.json(
          { error: result.error.message },
          { status: 500 }
        );
      }
      
      return NextResponse.json({ agents: result.data });
    }
    
    // If status is provided, find agents with that status
    if (status) {
      if (status === 'available') {
        const result = await agentService.findAvailableAgents();
        
        if (result.isError) {
          return NextResponse.json(
            { error: result.error.message },
            { status: 500 }
          );
        }
        
        return NextResponse.json({ agents: result.data });
      }
    }
    
    // Default: return all agents
    const result = await agentService.getAll();
    
    if (result.isError) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ agents: result.data });
  } catch (error) {
    console.error('Error fetching agents:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST handler - create a new agent
 */
export async function POST(request: Request) {
  try {
    const agentData = await request.json();
    
    // Validate required fields
    if (!agentData.name) {
      return NextResponse.json(
        { error: 'Agent name is required' },
        { status: 400 }
      );
    }
    
    if (!agentData.capabilities || !Array.isArray(agentData.capabilities)) {
      return NextResponse.json(
        { error: 'Agent capabilities must be provided as an array' },
        { status: 400 }
      );
    }
    
    const { memoryService } = await getMemoryServices();
    const agentService = createAgentMemoryService(memoryService);
    
    // Generate ID if not provided
    if (!agentData.id) {
      agentData.id = IdGenerator.generate('agent');
    }
    
    // Set defaults
    agentData.status = agentData.status || AgentStatus.AVAILABLE;
    agentData.createdAt = new Date();
    agentData.updatedAt = new Date();
    agentData.lastActive = new Date();
    
    // Create the agent
    const result = await agentService.create(agentData);
    
    if (result.isError) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ agent: result.data }, { status: 201 });
  } catch (error) {
    console.error('Error creating agent:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 