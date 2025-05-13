import { NextResponse } from 'next/server';
import { createAgentMemoryService } from '../../../../../server/memory/services/multi-agent';
import { getMemoryServices } from '../../../../../server/memory/services';
import { AgentStatus, agentSchema } from '../../../../../server/memory/schema/agent';

export async function GET(
  request: Request,
  context: { params: { agentId: string } }
) {
  try {
    // Next.js requires awaiting the params object itself before accessing properties
    const params = await context.params;
    const agentId = params.agentId;
    
    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }
    
    // Get memory services first
    const services = await getMemoryServices();
    
    if (!services || !services.client) {
      console.error('Memory services or memory client is undefined');
      return NextResponse.json(
        { error: 'Memory service initialization failed' },
        { status: 500 }
      );
    }
    
    // Create agent service with the memory client
    const agentService = await createAgentMemoryService({ memoryClient: services.client });
    
    // Log some info for debugging
    console.log(`Fetching agent with ID: ${agentId}`);
    console.log(`Memory client initialized: ${!!services.client}`);
    console.log(`Agent service initialized: ${!!agentService}`);
    
    // Ensure the repository has the schema property set
    if (agentService.repository && !agentService.repository.schema) {
      agentService.repository.schema = agentSchema;
    }
    
    const result = await agentService.getAgent(agentId);
    
    if (result.isError) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 404 }
      );
    }
    
    if (!result.data) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ agent: result.data });
  } catch (error) {
    let errorAgentId = 'unknown';
    try {
      const params = await context.params;
      errorAgentId = params?.agentId || 'unknown';
    } catch (e) {
      // Ignore params error in error handler
    }
    
    console.error(`Error fetching agent ${errorAgentId}:`, error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: { agentId: string } }
) {
  try {
    // Next.js requires awaiting the params object itself before accessing properties
    const params = await context.params;
    const agentId = params.agentId;
    const updateData = await request.json();
    
    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }
    
    // Set update timestamp
    updateData.updatedAt = new Date();
    
    // Make sure the agent ID is properly set in the update data
    updateData.id = agentId;
    
    // Get memory services first
    const services = await getMemoryServices();
    
    if (!services || !services.client) {
      return NextResponse.json(
        { error: 'Memory service initialization failed' },
        { status: 500 }
      );
    }
    
    // Create agent service with the memory client
    const agentService = await createAgentMemoryService({ memoryClient: services.client });
    
    // Ensure the repository has the schema property set
    if (agentService.repository && !agentService.repository.schema) {
      agentService.repository.schema = agentSchema;
    }
    
    // Use updateAgent with the complete agent data
    const result = await agentService.updateAgent(updateData);
    
    if (result.isError) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 500 }
      );
    }
    
    if (!result.data) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ agent: result.data });
  } catch (error) {
    let errorAgentId = 'unknown';
    try {
      const params = await context.params;
      errorAgentId = params?.agentId || 'unknown';
    } catch (e) {
      // Ignore params error in error handler
    }
    
    console.error(`Error updating agent ${errorAgentId}:`, error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: { agentId: string } }
) {
  try {
    // Next.js requires awaiting the params object itself before accessing properties
    const params = await context.params;
    const agentId = params.agentId;
    
    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }
    
    // Get memory services first
    const services = await getMemoryServices();
    
    if (!services || !services.client) {
      return NextResponse.json(
        { error: 'Memory service initialization failed' },
        { status: 500 }
      );
    }
    
    // Create agent service with the memory client
    const agentService = await createAgentMemoryService({ memoryClient: services.client });
    
    // Ensure the repository has the schema property set
    if (agentService.repository && !agentService.repository.schema) {
      agentService.repository.schema = agentSchema;
    }
    
    const result = await agentService.deleteAgent(agentId);
    
    if (result.isError) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 500 }
      );
    }
    
    if (!result.data) {
      return NextResponse.json(
        { error: 'Agent not found or could not be deleted' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, message: 'Agent deleted successfully' });
  } catch (error) {
    let errorAgentId = 'unknown';
    try {
      const params = await context.params;
      errorAgentId = params?.agentId || 'unknown';
    } catch (e) {
      // Ignore params error in error handler
    }
    
    console.error(`Error deleting agent ${errorAgentId}:`, error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: { agentId: string } }
) {
  try {
    // Next.js requires awaiting the params object itself before accessing properties
    const params = await context.params;
    const agentId = params.agentId;
    const patchData = await request.json();
    const { status, capabilities } = patchData;
    
    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }
    
    // Get memory services first
    const services = await getMemoryServices();
    
    if (!services || !services.client) {
      return NextResponse.json(
        { error: 'Memory service initialization failed' },
        { status: 500 }
      );
    }
    
    // Create agent service with the memory client
    const agentService = await createAgentMemoryService({ memoryClient: services.client });
    
    // Ensure the repository has the schema property set
    if (agentService.repository && !agentService.repository.schema) {
      agentService.repository.schema = agentSchema;
    }
    
    // First, get the current agent data
    const currentAgentResult = await agentService.getAgent(agentId);
    
    if (currentAgentResult.isError || !currentAgentResult.data) {
      return NextResponse.json(
        { error: currentAgentResult.isError ? currentAgentResult.error.message : 'Agent not found' },
        { status: currentAgentResult.isError ? 500 : 404 }
      );
    }
    
    // Create update data from current agent
    const updateData = { ...currentAgentResult.data };
    
    // Handle status update if provided
    if (status) {
      // Validate status
      if (!Object.values(AgentStatus).includes(status)) {
        return NextResponse.json(
          { error: `Invalid status: ${status}. Valid values are: ${Object.values(AgentStatus).join(', ')}` },
          { status: 400 }
        );
      }
      
      // Update status in the update data
      updateData.status = status;
    }
    
    // Handle capabilities update if provided
    if (capabilities && Array.isArray(capabilities)) {
      updateData.capabilities = capabilities;
    }
    
    // Set timestamps
    updateData.updatedAt = new Date();
    
    // Use updateAgent with the complete agent data
    const result = await agentService.updateAgent(updateData);
    
    if (result.isError) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 500 }
      );
    }
    
    if (!result.data) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ agent: result.data });
  } catch (error) {
    let errorAgentId = 'unknown';
    try {
      const params = await context.params;
      errorAgentId = params?.agentId || 'unknown';
    } catch (e) {
      // Ignore params error in error handler
    }
    
    console.error(`Error patching agent ${errorAgentId}:`, error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 