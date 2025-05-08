import { NextResponse } from 'next/server';
import { createAgentMemoryService } from '../../../../../server/memory/services/multi-agent';

/**
 * GET handler - list agents or get specific agent by ID
 */
export async function GET(request: Request) {
  try {
    console.log(`API DEBUG: GET multi-agent/system/agents`);
    
    // Get query parameters
    const url = new URL(request.url);
    const agentId = url.searchParams.get('agentId');
    const capability = url.searchParams.get('capability');
    const status = url.searchParams.get('status');
    
    const agentService = await createAgentMemoryService(null);
    
    // If agentId is provided, get specific agent
    if (agentId) {
      const response = await agentService.getById(agentId);
      
      if (response.isError || !response.data) {
        return NextResponse.json(
          { error: 'Agent not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({ agent: response.data });
    }
    
    // If capability is provided, filter by capability
    if (capability) {
      const response = await agentService.findAgentsByCapability(capability);
      return NextResponse.json({ agents: response.data });
    }
    
    // If status is provided, filter by status
    if (status) {
      if (status === 'available') {
        const response = await agentService.findAvailableAgents();
        return NextResponse.json({ agents: response.data });
      }
    }
    
    // Otherwise, return all agents
    const response = await agentService.getAll();
    return NextResponse.json({ agents: response.data });
  } catch (error) {
    console.error('Error getting agents:', error);
    
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
    console.log(`API DEBUG: POST multi-agent/system/agents`);
    
    const data = await request.json();
    
    // Validate request data
    if (!data.name) {
      return NextResponse.json(
        { error: 'Agent name is required' },
        { status: 400 }
      );
    }
    
    // Add default fields
    const agentData = {
      id: data.id || `agent-${Date.now()}`,
      name: data.name,
      description: data.description || '',
      capabilities: data.capabilities || [],
      status: data.status || 'available',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActive: new Date(),
      ...data
    };
    
    const agentService = await createAgentMemoryService(null);
    const response = await agentService.create(agentData);
    
    if (response.isError || !response.data) {
      return NextResponse.json(
        { error: 'Failed to create agent' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { agent: response.data },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating agent:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 