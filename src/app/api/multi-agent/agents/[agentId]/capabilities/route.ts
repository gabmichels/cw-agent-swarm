import { NextResponse } from 'next/server';
import { createAgentMemoryService } from '../../../../../../server/memory/services/multi-agent';
import { getMemoryServices } from '../../../../../../server/memory/services';
import { IdGenerator } from '../../../../../../utils/ulid';
import { agentSchema } from '../../../../../../server/memory/schema/agent';
import type { AgentCapability, AgentMemoryEntity } from '../../../../../../server/memory/schema/agent';
import type { DefaultAgentMemoryService } from '../../../../../../server/memory/services/multi-agent/agent-service';

/**
 * GET endpoint to retrieve agent capabilities
 */
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
    const agentService = await createAgentMemoryService(memoryService);
    
    // Get the agent
    const result = await agentService.getAgent(agentId);
    
    if (result.isError) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 500 }
      );
    }
    
    if (!result.value) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }
    
    // Extract capabilities
    const capabilities = result.value.capabilities || [];
    
    return NextResponse.json({ capabilities });
  } catch (error) {
    console.error(`Error fetching capabilities for agent ${params.agentId}:`, error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint to add a new capability to agent
 */
export async function POST(
  request: Request,
  { params }: { params: { agentId: string } }
) {
  try {
    const agentId = params.agentId;
    const capabilityData = await request.json();
    
    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }
    
    // Validate capability
    if (!capabilityData.name || !capabilityData.description) {
      return NextResponse.json(
        { error: 'Capability name and description are required' },
        { status: 400 }
      );
    }
    
    // Create a properly typed capability object
    const capability: AgentCapability = {
      id: capabilityData.id || IdGenerator.generate('cap').toString(),
      name: capabilityData.name,
      description: capabilityData.description,
      version: capabilityData.version || '1.0.0',
      parameters: capabilityData.parameters || {}
    };
    
    const { memoryService } = await getMemoryServices();
    const agentService = await createAgentMemoryService(memoryService);
    
    // Get the agent
    const getResult = await agentService.getAgent(agentId);
    
    if (getResult.isError) {
      return NextResponse.json(
        { error: getResult.error.message },
        { status: 500 }
      );
    }
    
    if (!getResult.value) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }
    
    // Get existing capabilities and create updated agent
    const agent = getResult.value;
    const capabilities = [...(agent.capabilities || [])];
    
    // Check for duplicate
    const existingIndex = capabilities.findIndex(cap => cap.id === capability.id);
    if (existingIndex >= 0) {
      return NextResponse.json(
        { error: `Capability with ID ${capability.id} already exists` },
        { status: 409 }
      );
    }
    
    // Add new capability
    capabilities.push(capability);
    
    // Create updated agent
    const updatedAgent: AgentMemoryEntity = {
      ...agent,
      capabilities
    };
    
    // Update agent
    const updateResult = await agentService.updateAgent(updatedAgent);
    
    if (updateResult.isError) {
      return NextResponse.json(
        { error: updateResult.error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { capability, message: 'Capability added successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error(`Error adding capability to agent ${params.agentId}:`, error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PUT endpoint to replace all agent capabilities
 */
export async function PUT(
  request: Request,
  { params }: { params: { agentId: string } }
) {
  try {
    const agentId = params.agentId;
    const capabilitiesData = await request.json();
    
    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }
    
    // Validate capabilities
    if (!Array.isArray(capabilitiesData)) {
      return NextResponse.json(
        { error: 'Capabilities must be an array' },
        { status: 400 }
      );
    }
    
    // Create properly typed capabilities array
    const capabilities: AgentCapability[] = capabilitiesData.map(data => {
      if (!data.name || !data.description) {
        throw new Error('Each capability must have a name and description');
      }
      
      return {
        id: data.id || IdGenerator.generate('cap').toString(),
        name: data.name,
        description: data.description,
        version: data.version || '1.0.0',
        parameters: data.parameters || {}
      };
    });
    
    const { memoryService } = await getMemoryServices();
    const agentService = await createAgentMemoryService(memoryService);
    
    // Get current agent to update
    const getResult = await agentService.getAgent(agentId);
    
    if (getResult.isError) {
      return NextResponse.json(
        { error: getResult.error.message },
        { status: 500 }
      );
    }
    
    if (!getResult.value) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }
    
    // Create updated agent
    const updatedAgent: AgentMemoryEntity = {
      ...getResult.value,
      capabilities
    };
    
    // Update agent
    const updateResult = await agentService.updateAgent(updatedAgent);
    
    if (updateResult.isError) {
      return NextResponse.json(
        { error: updateResult.error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ 
      capabilities,
      message: 'Agent capabilities updated successfully' 
    });
  } catch (error) {
    console.error(`Error updating capabilities for agent ${params.agentId}:`, error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 