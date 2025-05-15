import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '@/server/memory/services';
import { createAgentMemoryService } from '@/server/memory/services/multi-agent';
import { AppError } from '@/lib/errors/base';

/**
 * GET /api/multi-agent/agents/[agentId]
 * Returns details of a specific agent
 */
export async function GET(
  request: NextRequest,
  context: { params: { agentId: string } }
) {
  const params = await context.params;
  const agentId = params.agentId;
  try {
    if (!agentId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Agent ID is required' 
      }, { status: 400 });
    }
    
    const { memoryService } = await getMemoryServices();
    const agentService = await createAgentMemoryService(memoryService);
    
    const result = await agentService.getAgent(agentId);
    
    if (result.isError) {
      console.error(`Error retrieving agent ${agentId}:`, result.error?.message || 'Unknown error');
      return NextResponse.json({ 
        success: false, 
        error: result.error?.message || 'Failed to retrieve agent' 
      }, { status: 500 });
    }
    
    if (!result.value) {
      return NextResponse.json({ 
        success: false, 
        error: 'Agent not found' 
      }, { status: 404 });
    }
    
    return NextResponse.json({ 
      success: true, 
      agent: result.value 
    });
  } catch (error) {
    console.error(`Error retrieving agent ${agentId}:`, error);
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

/**
 * PUT /api/multi-agent/agents/[agentId]
 * Updates an existing agent
 */
export async function PUT(
  request: NextRequest,
  context: { params: { agentId: string } }
) {
  const params = await context.params;
  const agentId = params.agentId;
  try {
    if (!agentId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Agent ID is required' 
      }, { status: 400 });
    }
    
    const { memoryService } = await getMemoryServices();
    const agentService = await createAgentMemoryService(memoryService);
    
    // First retrieve the existing agent
    const getResult = await agentService.getAgent(agentId);
    
    if (getResult.isError) {
      console.error(`Error retrieving agent ${agentId}:`, getResult.error?.message || 'Unknown error');
      return NextResponse.json({ 
        success: false, 
        error: getResult.error?.message || 'Failed to retrieve agent' 
      }, { status: 500 });
    }
    
    if (!getResult.value) {
      return NextResponse.json({ 
        success: false, 
        error: 'Agent not found' 
      }, { status: 404 });
    }
    
    // Merge the existing agent with the updates
    const updatedAgent = {
      ...getResult.value,
      ...await request.json(),
      updatedAt: new Date()
    };
    
    // Update the agent
    const updateResult = await agentService.updateAgent(updatedAgent);
    
    if (updateResult.isError) {
      console.error(`Error updating agent ${agentId}:`, updateResult.error?.message || 'Unknown error');
      return NextResponse.json({ 
        success: false, 
        error: updateResult.error?.message || 'Failed to update agent' 
      }, { status: 500 });
    }
    
    // Register the updated agent with MCP
    try {
      console.log('Updating agent in Multi-Agent Control Plane (MCP)...');
      
      // Import MCP registration functions
      const { updateAgentRegistration } = await import('../../../../../agents/mcp');
      
      // Update the agent with MCP
      updateAgentRegistration(updatedAgent);
      
      console.log(`Successfully updated agent ${updatedAgent.name} (${updatedAgent.id}) with MCP`);
    } catch (mcpError) {
      console.warn('Warning: Failed to update agent with MCP:', mcpError);
      // Don't fail the overall request if MCP registration fails
    }
    
    return NextResponse.json({ 
      success: true, 
      agent: updatedAgent
    });
  } catch (error) {
    console.error(`Error updating agent ${agentId}:`, error);
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

/**
 * DELETE /api/multi-agent/agents/[agentId]
 * Deletes an agent
 */
export async function DELETE(
  request: NextRequest,
  context: { params: { agentId: string } }
) {
  const params = await context.params;
  const agentId = params.agentId;
  try {
    if (!agentId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Agent ID is required' 
      }, { status: 400 });
    }
    
    const { memoryService } = await getMemoryServices();
    const agentService = await createAgentMemoryService(memoryService);
    
    // Delete the agent
    const result = await agentService.deleteAgent(agentId);
    
    if (result.isError) {
      console.error(`Error deleting agent ${agentId}:`, result.error?.message || 'Unknown error');
      return NextResponse.json({ 
        success: false, 
        error: result.error?.message || 'Failed to delete agent'
      }, { status: 500 });
    }
    
    // Deregister the agent from MCP
    try {
      console.log('Deregistering agent from Multi-Agent Control Plane (MCP)...');
      
      // Import MCP deregistration function
      const { deregisterAgent } = await import('../../../../../agents/mcp');
      
      // Deregister the agent from MCP
      deregisterAgent(agentId);
      
      console.log(`Successfully deregistered agent ${agentId} from MCP`);
    } catch (mcpError) {
      console.warn('Warning: Failed to deregister agent from MCP:', mcpError);
      // Don't fail the overall request if MCP deregistration fails
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Agent ${agentId} deleted successfully` 
    });
  } catch (error) {
    console.error(`Error deleting agent ${agentId}:`, error);
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 