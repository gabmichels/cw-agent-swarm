import { NextResponse } from 'next/server';
import { createAgentMemoryService } from '../../../../../../server/memory/services/multi-agent';
import { getMemoryServices } from '../../../../../../server/memory/services';
import { IdGenerator } from '../../../../../../utils/ulid';
import { agentSchema } from '../../../../../../server/memory/schema/agent';

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
    const agentService = createAgentMemoryService(memoryService);
    
    // Ensure the repository has the schema property set
    if (agentService.repository && !agentService.repository.schema) {
      agentService.repository.schema = agentSchema;
    }
    
    // Get the agent
    const result = await agentService.getById(agentId);
    
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
    
    // Extract capabilities
    const capabilities = result.data.capabilities || [];
    
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
    const capability = await request.json();
    
    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }
    
    // Validate capability
    if (!capability.name) {
      return NextResponse.json(
        { error: 'Capability name is required' },
        { status: 400 }
      );
    }
    
    // Generate ID if not provided
    if (!capability.id) {
      capability.id = IdGenerator.generate('cap').toString();
    }
    
    // Set version if not provided
    if (!capability.version) {
      capability.version = '1.0.0';
    }
    
    const { memoryService } = await getMemoryServices();
    const agentService = createAgentMemoryService(memoryService);
    
    // Ensure the repository has the schema property set
    if (agentService.repository && !agentService.repository.schema) {
      agentService.repository.schema = agentSchema;
    }
    
    // Get the agent
    const getResult = await agentService.getById(agentId);
    
    if (getResult.isError) {
      return NextResponse.json(
        { error: getResult.error.message },
        { status: 500 }
      );
    }
    
    if (!getResult.data) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }
    
    // Get existing capabilities
    const agent = getResult.data;
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
    
    // Update agent
    const updateResult = await agentService.updateAgentCapabilities(agentId, capabilities);
    
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
    const capabilities = await request.json();
    
    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }
    
    // Validate capabilities
    if (!Array.isArray(capabilities)) {
      return NextResponse.json(
        { error: 'Capabilities must be an array' },
        { status: 400 }
      );
    }
    
    // Validate each capability
    for (const capability of capabilities) {
      if (!capability.name) {
        return NextResponse.json(
          { error: 'Each capability must have a name' },
          { status: 400 }
        );
      }
      
      // Generate ID if not provided
      if (!capability.id) {
        capability.id = IdGenerator.generate('cap').toString();
      }
      
      // Set version if not provided
      if (!capability.version) {
        capability.version = '1.0.0';
      }
    }
    
    const { memoryService } = await getMemoryServices();
    const agentService = createAgentMemoryService(memoryService);
    
    // Ensure the repository has the schema property set
    if (agentService.repository && !agentService.repository.schema) {
      agentService.repository.schema = agentSchema;
    }
    
    // Update agent capabilities
    const result = await agentService.updateAgentCapabilities(agentId, capabilities);
    
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