import { NextResponse } from 'next/server';
import { ulid } from 'ulid';
import { AgentRegistrationRequest, AgentProfile } from '@/lib/multi-agent/types/agent';
import { createAgentMemoryService } from '@/server/memory/services/multi-agent';
import { getMemoryServices } from '@/server/memory/services';
import { AgentFactory } from '@/agents/shared/AgentFactory';
import { AgentMemoryEntity, AgentStatus } from '@/server/memory/schema/agent';

// Extended type to handle the additional fields from the form
interface ExtendedAgentRegistrationRequest extends AgentRegistrationRequest {
  _extended?: {
    systemPrompt?: string;
    knowledgePaths?: string[];
    persona?: {
      background: string;
      personality: string;
      communicationStyle: string;
      preferences: string;
    };
  };
}

/**
 * POST /api/multi-agent/agents
 * Registers a new agent in the system
 */
export async function POST(request: Request) {
  try {
    // Parse request body
    const requestData: ExtendedAgentRegistrationRequest = await request.json();
    
    // Validate request data
    if (!requestData.name) {
      return NextResponse.json(
        { success: false, error: 'Agent name is required' },
        { status: 400 }
      );
    }
    
    if (!requestData.description) {
      return NextResponse.json(
        { success: false, error: 'Agent description is required' },
        { status: 400 }
      );
    }
    
    if (!requestData.capabilities || requestData.capabilities.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one capability is required' },
        { status: 400 }
      );
    }
    
    // Generate a new agent ID using ULID for sortable, unique IDs
    const timestamp = new Date();
    const id = `agent_${requestData.name.toLowerCase().replace(/\s+/g, '_')}_${ulid(timestamp.getTime())}`;
    
    // Process extended data if available
    if (requestData._extended) {
      // Add system prompt to parameters if provided
      if (requestData._extended.systemPrompt) {
        requestData.parameters = {
          ...requestData.parameters,
          systemPrompt: requestData._extended.systemPrompt
        };
      }
      
      // Add knowledge paths and persona to metadata if provided
      if (requestData._extended.knowledgePaths || requestData._extended.persona) {
        requestData.metadata = {
          ...requestData.metadata,
          knowledgePaths: requestData._extended.knowledgePaths,
          persona: requestData._extended.persona
        };
      }
    }
    
    // Remove the _extended field before creating the agent profile
    const { _extended, ...standardRequestData } = requestData;
    
    // Create agent profile
    const agent: AgentProfile = {
      id,
      name: standardRequestData.name,
      description: standardRequestData.description,
      status: standardRequestData.status,
      capabilities: standardRequestData.capabilities,
      parameters: standardRequestData.parameters,
      metadata: standardRequestData.metadata,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    
    // Store agent data in the database
    const { memoryService } = await getMemoryServices();
    const agentService = createAgentMemoryService(memoryService);
    
    // Create an instance of our DefaultAgent using the factory
    try {
      // Create agent using the factory
      const defaultAgent = AgentFactory.createFromApiProfile(agent);
      
      // Initialize the agent
      await defaultAgent.initialize();
      
      // Get the agent data for storing in the database
      const agentData = defaultAgent.getConfig();
      
      // Store agent in the database
      const result = await agentService.create(agentData);
      
      if (result.isError) {
        return NextResponse.json(
          { success: false, error: result.error.message },
          { status: 500 }
        );
      }
      
      // TODO: In the future, store the agent in a global registry
      console.log(`Initialized DefaultAgent with ID: ${defaultAgent.getAgentId()}`);
    } catch (agentError) {
      console.error('Error initializing DefaultAgent:', agentError);
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to initialize agent: ${agentError instanceof Error ? agentError.message : String(agentError)}`
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Agent registered successfully',
      agent
    });
  } catch (error) {
    console.error('Error registering agent:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/multi-agent/agents
 * Retrieves a list of registered agents
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get('id');
    const nameParam = searchParams.get('name');
    const tagsParam = searchParams.get('tags');
    const statusParam = searchParams.get('status');
    
    // Get agent service
    const { memoryService } = await getMemoryServices();
    const agentService = createAgentMemoryService(memoryService);
    
    // Get all agents
    const result = await agentService.findAll();
    
    if (result.isError) {
      return NextResponse.json(
        { success: false, error: result.error.message },
        { status: 500 }
      );
    }
    
    // Convert to simplified agent profile format
    const agents = result.data.map((agent: AgentMemoryEntity) => ({
      id: typeof agent.id === 'object' ? agent.id.id : agent.id,
      name: agent.name,
      description: agent.description,
      status: agent.status,
      capabilities: agent.capabilities,
      parameters: agent.parameters,
      metadata: agent.metadata,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt
    }));
    
    return NextResponse.json({
      success: true,
      agents,
      total: agents.length,
      page: 1,
      pageSize: agents.length
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      },
      { status: 500 }
    );
  }
} 