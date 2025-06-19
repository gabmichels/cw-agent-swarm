import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { AgentRegistrationRequest, AgentProfile } from '@/lib/multi-agent/types/agent';
import { DefaultAgentMemoryService } from '@/server/memory/services/multi-agent/agent-service';
import { DefaultCapabilityMemoryService } from '@/server/memory/services/multi-agent/capability-service';
import { getMemoryServices } from '@/server/memory/services';
import { AgentMemoryEntity, AgentStatus } from '@/server/memory/schema/agent';
import { CapabilityMemoryEntity, CapabilityType } from '@/server/memory/schema/capability';
import { AgentMetadata, AgentStatus as MetadataAgentStatus } from '@/types/metadata';
import { StructuredId, structuredIdToString } from '@/types/entity-identifier';

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
 * Agent memory entity with embedding for storage
 */
interface AgentMemoryEntityWithEmbedding extends AgentMemoryEntity {
  embedding: number[];
}

/**
 * Creates standardized agent metadata following implementation guidelines
 */
function createAgentMetadata(
  agent: AgentProfile, 
  agentId: string,
  timestamp: Date
): AgentMetadata {
  // Create structured ID
  const structuredAgentId: StructuredId = {
    namespace: 'agent',
    type: 'agent',
    id: agentId,
    version: 1
  };

  return {
    // Required BaseMetadata fields
    schemaVersion: '1.0',
    timestamp: timestamp.toISOString(),
    
    // Agent-specific identification
    agentId: structuredIdToString(structuredAgentId),
    name: agent.name,
    description: agent.description,
    
    // Agent state
    status: mapAgentStatus(agent.status),
    lastActive: timestamp.toISOString(),
    
    // Agent configuration
    version: agent.metadata?.version || '1.0.0',
    isPublic: agent.metadata?.isPublic || false,
    
    // Categorization
    domain: agent.metadata?.domain || [],
    specialization: agent.metadata?.specialization || [],
    tags: agent.metadata?.tags || [],
    
    // Performance tracking
    performanceMetrics: {
      successRate: 0,
      averageResponseTime: 0,
      taskCompletionRate: 0
    },
    
    // Content summary for retrieval optimization
    contentSummary: generateAgentContentSummary(agent)
  };
}

/**
 * Maps API agent status to metadata agent status
 */
function mapAgentStatus(status?: string): MetadataAgentStatus {
  if (!status) return MetadataAgentStatus.AVAILABLE;
  
  switch (status) {
    case 'available': return MetadataAgentStatus.AVAILABLE;
    case 'busy': return MetadataAgentStatus.BUSY;
    case 'offline': return MetadataAgentStatus.OFFLINE;
    case 'maintenance': return MetadataAgentStatus.MAINTENANCE;
    default: return MetadataAgentStatus.AVAILABLE;
  }
}

/**
 * Generates content summary for agent retrieval optimization
 * Dynamically builds content from structured metadata instead of using legacy content field
 */
function generateAgentContentSummary(agent: AgentProfile): string {
  let summary = `${agent.name} - ${agent.description}`;
  
  // Add capabilities
  if (agent.capabilities.length > 0) {
    summary += ` | Capabilities: ${agent.capabilities.map(c => c.name).join(', ')}`;
  }
  
  // Add persona information if available - dynamically built from metadata.persona
  if (agent.metadata?.persona) {
    const persona = agent.metadata.persona;
    if (persona.background) summary += ` | Background: ${persona.background}`;
    if (persona.personality) summary += ` | Personality: ${persona.personality}`;
    if (persona.communicationStyle) summary += ` | Style: ${persona.communicationStyle}`;
    if (persona.preferences) summary += ` | Preferences: ${persona.preferences}`;
  }
  
  // Add system prompt if available
  if (agent.parameters?.systemPrompt) {
    summary += ` | Instructions: ${agent.parameters.systemPrompt}`;
  }
  
  return summary;
}

/**
 * Converts capabilities to schema-compatible format with UUID point ID references
 * FIXED: Now uses UUID point IDs instead of string capability IDs
 */
function convertCapabilitiesToSchemaFormat(
  capabilities: AgentProfile['capabilities'],
  capabilityMappings: Array<{
    pointId: string;
    capabilityId: string;
    entity: any;
  }>
): AgentMemoryEntity['capabilities'] {
  return capabilityMappings.map(mapping => {
    const originalCapability = capabilities.find(cap => cap.id === mapping.capabilityId);
    const level = originalCapability?.parameters?.level || 'basic';
    const type = originalCapability?.parameters?.type || 'skill';
    
    return {
      id: mapping.pointId, // FIXED: Use UUID point ID instead of string capability ID
      name: mapping.entity.name || originalCapability?.name || (mapping.capabilityId ? mapping.capabilityId.split('.').pop() : 'unknown') || mapping.capabilityId || 'unknown',
      description: `Reference to capability: ${mapping.entity.name} (${mapping.capabilityId || 'unknown'})`,
      version: '1.0.0',
      parameters: {
        level: level,
        type: type,
        proficiency: level,
        dateAdded: new Date().toISOString(),
        source: 'agent-creation',
        // Store the original capability ID for reference
        originalCapabilityId: mapping.capabilityId
      }
    };
  });
}

/**
 * Creates schema-compatible agent parameters
 */
function createAgentParameters(agent: AgentProfile): AgentMemoryEntity['parameters'] {
  return {
    model: agent.parameters?.model || process.env.OPENAI_MODEL_NAME || 'gpt-4.1-2025-04-14',
    temperature: agent.parameters?.temperature || 0.7,
    maxTokens: agent.parameters?.maxTokens || 1024,
    tools: [],
          systemPrompt: agent.parameters?.systemPrompt
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
    
    // Generate a new agent ID using UUID for proper unique identification
    const timestamp = new Date();
    const id = uuidv4();
    
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
    
    // Store each custom capability in the capabilities collection FIRST
    console.log(`📦 Processing ${agent.capabilities.length} capabilities...`);
    let storedCapabilitiesCount = 0;
    const capabilityMappings: Array<{
      pointId: string;        // UUID point ID for Qdrant
      capabilityId: string;   // String capability ID (e.g., "skill.programming")
      entity: any;            // Capability entity
    }> = [];
    
    // Create capability service once outside the loop (use same pattern as working endpoints)
    const capabilityService = new DefaultCapabilityMemoryService();
    
    // WORKAROUND: Get all existing capabilities first as a fallback
    const allCapabilities = await capabilityService.getAllCapabilities();
    const capabilityLookup = new Map(allCapabilities.map(cap => [cap.capabilityId, cap]));
    
    for (const capability of agent.capabilities) {
      try {
        console.log(`🔄 Processing capability: ${capability.name} (${capability.id})`);
        
        // First try direct lookup in existing capabilities
        const existingCapability = capabilityLookup.get(capability.id);
        if (existingCapability) {
          console.log(`✅ Found existing capability: ${capability.name} -> ${existingCapability.pointId}`);
          capabilityMappings.push({
            pointId: existingCapability.pointId,
            capabilityId: capability.id,
            entity: existingCapability.entity
          });
          storedCapabilitiesCount++;
          continue;
        }
        
        // If not found, create the new capability directly (bypass broken findOrCreateCapability)
        console.log(`🔨 Creating new capability: ${capability.name} (${capability.id})`);
        
        // Determine capability type from ID or parameters
        let capabilityType: CapabilityType;
        if (capability.parameters?.type === 'skill' || (capability.id && capability.id.startsWith('skill.'))) {
          capabilityType = CapabilityType.SKILL;
        } else if (capability.parameters?.type === 'domain' || (capability.id && capability.id.startsWith('domain.'))) {
          capabilityType = CapabilityType.DOMAIN;
        } else if (capability.parameters?.type === 'role' || (capability.id && capability.id.startsWith('role.'))) {
          capabilityType = CapabilityType.ROLE;
        } else if (capability.parameters?.type === 'tag' || (capability.id && capability.id.startsWith('tag.'))) {
          capabilityType = CapabilityType.TAG;
        } else {
          // Default to SKILL if can't determine type
          capabilityType = CapabilityType.SKILL;
        }
        
        // Create capability entity for the capabilities collection (NO agent-specific data)
        const capabilityEntity: CapabilityMemoryEntity = {
          id: capability.id,
          name: capability.name,
          description: capability.description,
          type: capabilityType,
          version: capability.version || '1.0.0',
          parameters: capability.parameters || {},
          tags: [],
          domains: capabilityType === CapabilityType.DOMAIN ? [capability.name] : [],
          content: `${capability.name} - ${capability.description} (${capabilityType})`,
          createdAt: timestamp,
          updatedAt: timestamp,
          schemaVersion: '1.0',
          metadata: {
            category: capabilityType
          }
        };
        
        // Create the capability directly using createCapability method
        const createResult = await capabilityService.createCapability(capabilityEntity);
        
        if (createResult.success && createResult.id) {
          console.log(`✅ Created new capability: ${capability.name} -> ${createResult.id}`);
          capabilityMappings.push({
            pointId: createResult.id, // UUID point ID from Qdrant
            capabilityId: capability.id, // String capability ID
            entity: capabilityEntity
          });
          storedCapabilitiesCount++;
        } else {
          console.error(`❌ Failed to create capability: ${capability.name}`);
          console.error(`   Error:`, createResult.error);
        }
        
      } catch (error) {
        console.error(`❌ Error processing capability ${capability.name}:`, error);
        // Continue processing other capabilities instead of failing completely
      }
    }
    
    console.log(`📊 Capability processing complete: ${storedCapabilitiesCount}/${agent.capabilities.length} capabilities processed successfully`);
    console.log(`🔍 Capability mappings: ${capabilityMappings.length}`);
    
    if (storedCapabilitiesCount === 0 && agent.capabilities.length > 0) {
      console.warn('⚠️ WARNING: No capabilities were processed successfully');
      console.warn('⚠️ The agent will be created without capabilities');
      // Continue with agent creation but with empty capabilities
    }
    
    // Create an agent memory service using our UUID-compatible implementation
    const agentService = new DefaultAgentMemoryService(client);
    
    // Create agent data for storage
    console.log('Preparing agent data for storage...');
    
    // Create standardized metadata following implementation guidelines
    const agentMetadata = createAgentMetadata(agent, id, timestamp);
    
    // Create properly formatted agent data that conforms to the schema
    const agentData: AgentMemoryEntity = {
      id,
      name: agent.name,
      description: agent.description || '',
      createdBy: 'api', 
      capabilities: convertCapabilitiesToSchemaFormat(agent.capabilities, capabilityMappings),
      parameters: createAgentParameters(agent),
      status: agentMetadata.status === MetadataAgentStatus.AVAILABLE ? AgentStatus.AVAILABLE :
              agentMetadata.status === MetadataAgentStatus.BUSY ? AgentStatus.BUSY :
              agentMetadata.status === MetadataAgentStatus.OFFLINE ? AgentStatus.OFFLINE :
              AgentStatus.MAINTENANCE,
      lastActive: new Date(),
      chatIds: [],
      teamIds: [],
      metadata: {
        tags: agentMetadata.tags || [],
        domain: agentMetadata.domain,
        specialization: agentMetadata.specialization,
        performanceMetrics: agentMetadata.performanceMetrics,
        version: agentMetadata.version,
        isPublic: agentMetadata.isPublic
      },
      content: "", // Legacy field - content is now dynamically generated from metadata.persona
      type: 'agent',
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
      schemaVersion: '1.0'
    };
    
    // Get embedding for the agent content
    console.log('Generating agent embedding...');
    const embeddingService = services.embeddingService;
    
    try {
        // Use dynamic content generation for embedding instead of storing in content field
        const dynamicContent = generateAgentContentSummary(agent);
        const embeddingResult = await embeddingService.getEmbedding(dynamicContent);
        
      // Validate embedding
      if (!Array.isArray(embeddingResult.embedding) || embeddingResult.embedding.length === 0) {
        console.error('Generated embedding is invalid or empty');
        return NextResponse.json(
          { success: false, error: 'Failed to generate valid embedding for agent' },
          { status: 500 }
        );
      }
      
      console.log(`Successfully generated embedding with ${embeddingResult.embedding.length} dimensions`);
      
      // Create agent data with embedding
      const agentDataWithEmbedding: AgentMemoryEntityWithEmbedding = {
        ...agentData,
        embedding: embeddingResult.embedding
      };
          
      // Store using our agent service (which handles UUID conversion)
      console.log('Storing agent in Qdrant...');
      const result = await agentService.createAgent(agentDataWithEmbedding);
            
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
      const threadId = `thread_${agent.name.toLowerCase().replace(/\s+/g, '_')}_${uuidv4()}`;
      
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
    const id = url.searchParams.get('id'); // Get the agent ID parameter
    
    // Initialize memory services
    const services = await getMemoryServices();
    const agentService = new DefaultAgentMemoryService(services.client);
    
    // If ID is provided, directly fetch that specific agent
    if (id !== null && id !== undefined && id !== '') {
      const agentId: string = id; // Explicitly cast to string type
      const result = await agentService.getAgent(agentId);
      
      if (result.isError || !result.value) {
        console.error('Error getting agent by ID:', result.error);
        return NextResponse.json(
          { error: result.error?.message || 'Agent not found' },
          { status: 404 }
        );
      }
      
      // Convert to API format
      const agent = {
        id: result.value.id,
        name: result.value.name,
        description: result.value.description,
        status: result.value.status,
        capabilities: result.value.capabilities,
        parameters: result.value.parameters,
        metadata: result.value.metadata,
        createdAt: result.value.createdAt,
        updatedAt: result.value.updatedAt
      };
      
      return NextResponse.json({
        agents: [agent], // Return in the same format as a filtered list
        total: 1,
        page: 1,
        pageSize: 1
      });
    }
    
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