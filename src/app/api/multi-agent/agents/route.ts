import { NextResponse } from 'next/server';
import { ulid } from 'ulid';
import { AgentRegistrationRequest, AgentProfile } from '@/lib/multi-agent/types/agent';
import { DefaultAgentMemoryService } from '@/server/memory/services/multi-agent/agent-service';
import { DefaultCapabilityMemoryService } from '@/server/memory/services/multi-agent/capability-service';
import { getMemoryServices } from '@/server/memory/services';
import { AgentFactory } from '@/agents/shared/AgentFactory';
import { AgentMemoryEntity, AgentStatus, agentSchema } from '@/server/memory/schema/agent';
import { CapabilityMemoryEntity, CapabilityType } from '@/server/memory/schema/capability';
import { ChatType } from '@/server/memory/models/chat-collection';

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
    
    // Check if capabilities collection exists, create it if it doesn't
    const capabilitiesCollectionName = 'capabilities';
    const capabilitiesCollectionExists = await client.collectionExists(capabilitiesCollectionName);
    
    if (!capabilitiesCollectionExists) {
      console.log(`Collection '${capabilitiesCollectionName}' does not exist, creating it now...`);
      // Default dimension size for embedding vectors
      const dimensionSize = 1536; 
      const created = await client.createCollection(capabilitiesCollectionName, dimensionSize);
      if (!created) {
        console.error(`Failed to create collection '${capabilitiesCollectionName}'`);
        console.log('Continuing with agent creation anyway...');
      } else {
        console.log(`Collection '${capabilitiesCollectionName}' created successfully.`);
      }
    }
    
    // Create capability service
    const capabilityService = new DefaultCapabilityMemoryService(client);
    
    // Store each custom capability in the capabilities collection
    for (const capability of agent.capabilities) {
      // Determine capability type from ID or name if not explicitly provided
      let capabilityType: CapabilityType;
      if (capability.id.startsWith('skill.')) {
        capabilityType = CapabilityType.SKILL;
      } else if (capability.id.startsWith('domain.')) {
        capabilityType = CapabilityType.DOMAIN;
      } else if (capability.id.startsWith('role.')) {
        capabilityType = CapabilityType.ROLE;
      } else if (capability.id.startsWith('tag.')) {
        capabilityType = CapabilityType.TAG;
      } else {
        // Default to SKILL if can't determine type
        capabilityType = CapabilityType.SKILL;
      }
      
      // Create capability object
      const capabilityEntity: CapabilityMemoryEntity = {
        id: capability.id || `capability_${capabilityType}_${capability.name.toLowerCase().replace(/\s+/g, '_')}_${ulid()}`,
        name: capability.name,
        description: capability.description,
        type: capabilityType,
        version: capability.version || '1.0.0',
        parameters: capability.parameters || {},
        tags: [],
        domains: [],
        content: `${capability.name} - ${capability.description}`,
        createdAt: timestamp,
        updatedAt: timestamp,
        schemaVersion: '1.0',
        metadata: {} // Required by BaseMemoryEntity
      };
      
      // Store capability
      try {
        await capabilityService.createCapability(capabilityEntity);
      } catch (error) {
        console.error(`Error storing capability ${capability.name}:`, error);
        // Continue with other capabilities even if one fails
      }
    }
    
    // Create an agent memory service using our UUID-compatible implementation
    const agentService = new DefaultAgentMemoryService(client);
    
    // Create agent data for storage
    console.log('Preparing agent data for storage...');
    
    // Helper function to convert API agent capabilities to schema-compatible format
    const convertCapabilities = (capabilities: typeof agent.capabilities): AgentMemoryEntity['capabilities'] => {
      return capabilities.map(cap => ({
        id: cap.id || `capability_${cap.name.toLowerCase().replace(/\s+/g, '_')}`,
        name: cap.name,
        description: cap.description,
        version: '1.0.0', // Default version for API-created capabilities
        parameters: {}
      }));
    };
    
    // Helper function to create schema-compatible parameters
    const createSchemaParameters = (): AgentMemoryEntity['parameters'] => {
      return {
        model: agent.parameters?.model || 'gpt-3.5-turbo',
        temperature: agent.parameters?.temperature || 0.7,
        maxTokens: agent.parameters?.maxTokens || 1024,
        tools: [], // Convert string[] to AgentTool[]
        customInstructions: agent.parameters?.systemPrompt,
        systemMessages: agent.parameters?.systemPrompt ? [agent.parameters.systemPrompt] : undefined
      };
    };
    
    // Helper function to create schema-compatible metadata
    const createSchemaMetadata = (): AgentMemoryEntity['metadata'] => {
      // Start with required fields with defaults
      const baseMetadata = {
        tags: agent.metadata?.tags || [],
        domain: agent.metadata?.domain || [],
        specialization: agent.metadata?.specialization || [],
        performanceMetrics: agent.metadata?.performanceMetrics || {
          successRate: 0,
          averageResponseTime: 0,
          taskCompletionRate: 0
        },
        version: agent.metadata?.version || '1.0.0',
        isPublic: agent.metadata?.isPublic || false,
        // Store persona information in metadata
        persona: agent.metadata?.persona || {
          background: '',
          personality: '',
          communicationStyle: '',
          preferences: ''
        }
      };
      
      // Add any custom fields from the agent metadata but exclude ones we've already added
      const { tags, domain, specialization, performanceMetrics, version, isPublic, persona, ...customMetadata } = agent.metadata || {};
      
      // Return combined metadata
      return {
        ...baseMetadata,
        ...customMetadata
      } as AgentMemoryEntity['metadata'];
    };
    
    // Helper function to generate rich content for semantic search
    const generateAgentContent = (agentProfile: AgentProfile): string => {
      // Start with basic information
      let content = `${agentProfile.name} - ${agentProfile.description}`;
      
      // Add capabilities
      content += ` - Capabilities: ${agentProfile.capabilities.map(c => c.name).join(', ')}`;
      
      // Add persona information if available
      if (agentProfile.metadata?.persona) {
        const persona = agentProfile.metadata.persona;
        content += ` - Background: ${persona.background || ''}`;
        content += ` - Personality: ${persona.personality || ''}`;
        content += ` - Communication Style: ${persona.communicationStyle || ''}`;
        content += ` - Preferences: ${persona.preferences || ''}`;
      }
      
      // Add system prompt if available
      if (agentProfile.parameters?.systemPrompt) {
        content += ` - Custom Instructions: ${agentProfile.parameters.systemPrompt}`;
      }
      
      return content;
    };
    
    // Map agent status from API to schema enum
    const mapStatus = (status?: string): AgentStatus => {
      if (!status) return AgentStatus.AVAILABLE;
      
      switch (status) {
        case 'available': return AgentStatus.AVAILABLE;
        case 'unavailable': return AgentStatus.OFFLINE;
        case 'maintenance': return AgentStatus.MAINTENANCE;
        default: return AgentStatus.AVAILABLE;
      }
    };
    
    // Create properly formatted agent data that conforms to the schema
    const agentData = {
      id, // This will be handled by the service
      name: agent.name,
      description: agent.description || '',
      createdBy: 'api', 
      capabilities: convertCapabilities(agent.capabilities),
      parameters: createSchemaParameters(),
      status: mapStatus(agent.status),
      lastActive: new Date(),
      chatIds: [],
      teamIds: [],
      metadata: createSchemaMetadata(),
      content: generateAgentContent(agent),
      type: 'agent', // Required for base memory schema
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
      schemaVersion: '1.0' // Required by AgentMemoryEntity
    };
    
    // We need to use this as unknown first to satisfy TypeScript
    const typedAgentData = agentData as unknown as AgentMemoryEntity;
    
    // Get embedding for the agent content
    console.log('Generating agent embedding...');
    const embeddingService = services.embeddingService;
    
    try {
        const embeddingResult = await embeddingService.getEmbedding(typedAgentData.content);
        
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
      (typedAgentData as any).embedding = embeddingResult.embedding;
          
      // Store using our agent service (which handles UUID conversion)
      console.log('Storing agent in Qdrant...');
      const result = await agentService.createAgent(typedAgentData);
            
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
            
      console.log('Successfully verified agent was stored.');
      
      // Generate a thread ID for the agent
      const threadId = `thread_${agent.name.toLowerCase().replace(/\s+/g, '_')}_${ulid()}`;
      
      // Create response with thread ID
      return NextResponse.json({
        success: true,
        message: 'Agent registered successfully',
        agent: {
          ...agent,
          id: result.value // Use the ID from the memory service
        },
        threadId
      });
    } catch (error) {
      console.error('Error creating agent:', error);
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to create agent: ${error instanceof Error ? error.message : String(error)}` 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error processing agent registration request:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: `Error processing request: ${error instanceof Error ? error.message : String(error)}` 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/multi-agent/agents
 * Lists agents based on filter criteria
 */
export async function GET(request: Request) {
  try {
    // Parse URL to extract query parameters
    const url = new URL(request.url);
    
    // Extract filter parameters
    const name = url.searchParams.get('name');
    const status = url.searchParams.get('status');
    const domain = url.searchParams.get('domain');
    const tags = url.searchParams.getAll('tag');
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    
    // Initialize memory services
    const services = await getMemoryServices();
    const agentService = new DefaultAgentMemoryService(services.client);
    
    // Build filter object
    const filter: Record<string, any> = {};
    if (name) filter.name = name;
    if (status) filter.status = status;
    if (domain) filter['metadata.domain'] = domain;
    if (tags.length > 0) filter['metadata.tags'] = tags;
    
    // Get agents based on filters
    const result = await agentService.findAgents(filter, limit, (page - 1) * limit);
    
    if (result.isError) {
      console.error('Error searching for agents:', result.error);
      return NextResponse.json(
        { error: result.error?.message || 'Error searching for agents' },
        { status: 500 }
      );
    }
    
    // Convert agent entities to API format
    const agents = result.value.map((agent: AgentMemoryEntity) => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      status: agent.status,
      capabilities: agent.capabilities,
      parameters: agent.parameters,
      metadata: agent.metadata,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt
    }));
    
    // Get total count
    const countResult = await agentService.countAgents(filter);
    const total = countResult.isError ? 0 : countResult.value;
    
    return NextResponse.json({
      agents,
      total,
      page,
      pageSize: limit
    });
  } catch (error) {
    console.error('Error listing agents:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 