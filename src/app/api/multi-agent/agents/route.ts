import { NextResponse } from 'next/server';
import { ulid } from 'ulid';
import { AgentRegistrationRequest, AgentProfile } from '@/lib/multi-agent/types/agent';
import { DefaultAgentMemoryService } from '@/server/memory/services/multi-agent/agent-service';
import { getMemoryServices } from '@/server/memory/services';
import { AgentFactory } from '@/agents/shared/AgentFactory';
import { AgentMemoryEntity, AgentStatus, agentSchema } from '@/server/memory/schema/agent';

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
    
    // Initialize memory services and make sure collections are created
    console.log('Preparing to store agent data in the database...');
    const services = await getMemoryServices();
    const client = services.client;
    
    // Check if agent collection exists, create it if it doesn't
    const collectionName = 'agents';
    const collectionExists = await client.collectionExists(collectionName);
    
    if (!collectionExists) {
      console.log(`Collection '${collectionName}' does not exist, creating it now...`);
      // Default dimension size for embedding vectors
      const dimensionSize = 1536; 
      const created = await client.createCollection(collectionName, dimensionSize);
      if (!created) {
        console.error(`Failed to create collection '${collectionName}'`);
        return NextResponse.json(
          { success: false, error: 'Failed to create agent collection' },
          { status: 500 }
        );
      }
      console.log(`Collection '${collectionName}' created successfully.`);
    }
    
    // Create an agent memory service using our UUID-compatible implementation
    const agentService = new DefaultAgentMemoryService(client);
    
    // Create agent data for storage
    console.log('Preparing agent data for storage...');
    const agentData: AgentMemoryEntity = {
      id,
      name: agent.name,
      description: agent.description,
      status: agent.status || AgentStatus.ACTIVE,
      capabilities: agent.capabilities,
      parameters: agent.parameters || {},
      metadata: agent.metadata || {},
      content: `${agent.name} - ${agent.description} - ${agent.capabilities.map(c => c.name).join(', ')}`,
      embedding: [],
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt
    };
    
        // Get embedding for the agent content
    console.log('Generating agent embedding...');
    const embeddingService = services.embeddingService;
    
    try {
        const embeddingResult = await embeddingService.getEmbedding(agentData.content);
        
      // Validate embedding
      if (!Array.isArray(embeddingResult.embedding) || embeddingResult.embedding.length === 0) {
        console.error('Generated embedding is invalid or empty');
        return NextResponse.json(
          { success: false, error: 'Failed to generate valid embedding for agent' },
          { status: 500 }
        );
      }
      
      console.log(`Successfully generated embedding with ${embeddingResult.embedding.length} dimensions`);
      
      // Add the embedding to the agent data
      agentData.embedding = embeddingResult.embedding;
          
      // Store using our agent service (which handles UUID conversion)
      console.log('Storing agent in Qdrant...');
      const result = await agentService.createAgent(agentData);
            
            if (result.isError) {
        console.error('Failed to store agent in Qdrant:', result.error);
              return NextResponse.json(
          { success: false, error: `Failed to store agent: ${result.error?.message || 'unknown error'}` },
                { status: 500 }
              );
            }
            
      console.log(`Agent successfully stored with ID: ${result.value}`);
      
      // Verify the agent was actually stored
      console.log('Verifying agent was stored correctly...');
      const verifyResult = await agentService.getAgent(result.value);
      
      if (verifyResult.isError || !verifyResult.value) {
        console.error('Failed to verify agent was stored:', verifyResult.error);
            return NextResponse.json(
          { success: false, error: 'Agent appeared to be created but could not be retrieved' },
              { status: 500 }
            );
          }
          
      console.log('Agent verified successfully in Qdrant');
      
      // Return success with confirmed persistence
      return NextResponse.json({
        success: true,
        message: 'Agent registered successfully and persisted to database',
        agent
      });
      
    } catch (embeddingError) {
      console.error('Error generating embedding for agent:', embeddingError);
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to generate embedding: ${embeddingError instanceof Error ? embeddingError.message : String(embeddingError)}` 
        },
        { status: 500 }
      );
    }
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
    
    console.log('Getting agents with params:', { idParam, nameParam, tagsParam, statusParam });
    
    // Get memory services including direct access to Qdrant
    const { memoryService, client } = await getMemoryServices();
    const collectionName = 'agents';
    
    // Check if the collection exists
    const collectionExists = await client.collectionExists(collectionName);
    console.log(`Agents collection exists: ${collectionExists}`);
    
    if (!collectionExists) {
      return NextResponse.json({
        success: true,
        agents: [],
        total: 0,
        page: 1,
        pageSize: 0,
        message: 'Agents collection does not exist yet'
      });
    }
    
    // First try direct Qdrant access for more reliable retrieval
    try {
      console.log('Attempting to retrieve agents directly from Qdrant...');
      
      // Create filter for specific agent if ID is provided
      const filter = idParam ? { id: { value: idParam } } : undefined;
      
      // Use scrollPoints to get all agents regardless of embedding
      const points = await client.scrollPoints(collectionName, filter);
      console.log(`Retrieved ${points.length} agents from Qdrant`);
      
      // Convert to agent profiles
      const agents = points.map(point => {
        // Use type assertion for payload
        const payload = point.payload as any;
        return {
          id: point.id,
          name: payload.name,
          description: payload.description,
          status: payload.status,
          capabilities: payload.capabilities,
          parameters: payload.parameters,
          metadata: payload.metadata,
          createdAt: payload.createdAt,
          updatedAt: payload.updatedAt
        };
      });
      
      return NextResponse.json({
        success: true,
        agents,
        total: agents.length,
        page: 1,
        pageSize: agents.length
      });
    } catch (qdrantError) {
      console.error('Error retrieving agents directly from Qdrant:', qdrantError);
      
      // Fall back to using agentService
      console.log('Falling back to agent memory service...');
      
      // Create agent service with proper schema initialization
      const agentService = createAgentMemoryService(memoryService);
      
      // Get all agents
      console.log('Calling agentService.getAgents()...');
      const result = await agentService.getAgents();
      
      if (result.isError && result.error) {
        console.error('Agent service search error:', result.error);
        return NextResponse.json(
          { success: false, error: result.error.message || 'Unknown error' },
          { status: 500 }
        );
      }
      
      // Handle the case where value might be undefined or null
      const agentData = result.value || [];
      console.log(`Retrieved ${agentData.length} agents from agent service`);
      
      if (agentData.length > 0) {
        console.log('Agent IDs retrieved:', agentData.map((agent: AgentMemoryEntity) => typeof agent.id === 'object' ? agent.id.id : agent.id).join(', '));
        console.log('First agent details:', JSON.stringify(agentData[0], null, 2));
      } else {
        console.log('No agents found in the database. Check collection existence and search logic.');
      }
      
      // Convert to simplified agent profile format
      const agents = agentData.map((agent: AgentMemoryEntity) => ({
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
    }
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