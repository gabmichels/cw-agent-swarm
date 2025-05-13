import { NextResponse } from 'next/server';
import { createAgentMemoryService } from '../../../../../server/memory/services/multi-agent';
import { getMemoryServices } from '../../../../../server/memory/services';
import { AgentStatus, agentSchema } from '../../../../../server/memory/schema/agent';

export async function GET(
  request: Request,
  { params }: { params: { agentId: string } }
) {
  try {
    const agentId = params.agentId;
    
    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }
    
    const { memoryService } = await getMemoryServices();
    const agentService = createAgentMemoryService(memoryService);
    
    // Ensure the repository has the schema property set
    if (agentService.repository && !agentService.repository.schema) {
      agentService.repository.schema = agentSchema;
    }
    
    const result = await agentService.getById(agentId);
    
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
    console.error(`Error fetching agent ${params.agentId}:`, error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { agentId: string } }
) {
  try {
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
    
    const { memoryService } = await getMemoryServices();
    const agentService = createAgentMemoryService(memoryService);
    
    // Ensure the repository has the schema property set
    if (agentService.repository && !agentService.repository.schema) {
      agentService.repository.schema = agentSchema;
    }
    
    const result = await agentService.update(agentId, updateData);
    
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
    console.error(`Error updating agent ${params.agentId}:`, error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { agentId: string } }
) {
  try {
    const agentId = params.agentId;
    
    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }
    
    const { memoryService } = await getMemoryServices();
    const agentService = createAgentMemoryService(memoryService);
    
    // Ensure the repository has the schema property set
    if (agentService.repository && !agentService.repository.schema) {
      agentService.repository.schema = agentSchema;
    }
    
    const result = await agentService.delete(agentId);
    
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
    console.error(`Error deleting agent ${params.agentId}:`, error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { agentId: string } }
) {
  try {
    const agentId = params.agentId;
    const patchData = await request.json();
    const { status, capabilities } = patchData;
    
    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }
    
    const { memoryService } = await getMemoryServices();
    const agentService = createAgentMemoryService(memoryService);
    
    // Ensure the repository has the schema property set
    if (agentService.repository && !agentService.repository.schema) {
      agentService.repository.schema = agentSchema;
    }
    
    // Handle status update if provided
    if (status) {
      // Validate status
      if (!Object.values(AgentStatus).includes(status)) {
        return NextResponse.json(
          { error: `Invalid status: ${status}. Valid values are: ${Object.values(AgentStatus).join(', ')}` },
          { status: 400 }
        );
      }
      
      const statusResult = await agentService.updateAgentStatus(agentId, status);
      
      if (statusResult.isError) {
        return NextResponse.json(
          { error: statusResult.error.message },
          { status: 500 }
        );
      }
      
      if (!statusResult.data) {
        return NextResponse.json(
          { error: 'Agent not found' },
          { status: 404 }
        );
      }
    }
    
    // Handle capabilities update if provided
    if (capabilities && Array.isArray(capabilities)) {
      const capabilitiesResult = await agentService.updateAgentCapabilities(agentId, capabilities);
      
      if (capabilitiesResult.isError) {
        return NextResponse.json(
          { error: capabilitiesResult.error.message },
          { status: 500 }
        );
      }
      
      if (!capabilitiesResult.data) {
        return NextResponse.json(
          { error: 'Agent not found' },
          { status: 404 }
        );
      }
    }
    
    // Get the updated agent
    const result = await agentService.getById(agentId);
    
    if (result.isError || !result.data) {
      return NextResponse.json(
        { error: result.isError ? result.error.message : 'Agent not found' },
        { status: result.isError ? 500 : 404 }
      );
    }
    
    return NextResponse.json({ agent: result.data });
  } catch (error) {
    console.error(`Error patching agent ${params.agentId}:`, error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 