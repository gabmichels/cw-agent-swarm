import { v4 as uuidv4 } from 'uuid';
import { DefaultAgent } from './DefaultAgent';
import { AgentCapability as ApiAgentCapability, AgentProfile } from '@/lib/multi-agent/types/agent';
import { AgentMemoryEntity, AgentCapability as DbAgentCapability, AgentTool, AgentStatus } from '@/server/memory/schema/agent';
import { StructuredId, IdGenerator } from '@/utils/ulid';
import { AgentService } from '@/services/AgentService';

/**
 * AgentFactory provides methods to create agent instances from different data sources
 */
export class AgentFactory {
  /**
   * Create an agent instance from any agent configuration format
   * This is a versatile method that handles different agent data formats
   */
  async createAgent(agentConfig: any): Promise<DefaultAgent | null> {
    try {
      // If we just have an ID, try to load the full agent config
      if (typeof agentConfig === 'string') {
        const agentProfile = await AgentService.getAgent(agentConfig);
        if (!agentProfile) {
          console.error(`Agent with ID ${agentConfig} not found`);
          return null;
        }
        agentConfig = agentProfile;
      }
      
      // Determine the format of the agent config and use the appropriate factory method
      if (this.isDbEntity(agentConfig)) {
        return AgentFactory.createFromDbEntity(agentConfig);
      } else if (this.isApiProfile(agentConfig)) {
        return AgentFactory.createFromApiProfile(agentConfig);
      } else {
        // Generic handling for other formats
        // Convert to API Profile format first
        const apiProfile = this.normalizeToApiProfile(agentConfig);
        return AgentFactory.createFromApiProfile(apiProfile);
      }
    } catch (error) {
      console.error('Error creating agent instance:', error);
      return null;
    }
  }
  
  /**
   * Determine if the agent config is a database entity
   */
  private isDbEntity(config: any): config is AgentMemoryEntity {
    return config?.type === 'agent' && 'content' in config;
  }
  
  /**
   * Determine if the agent config is an API profile
   */
  private isApiProfile(config: any): config is AgentProfile {
    return 'id' in config && 'name' in config && 'capabilities' in config;
  }
  
  /**
   * Normalize any agent config format to API Profile format
   */
  private normalizeToApiProfile(config: any): AgentProfile {
    // Create a minimal valid agent profile
    const profile: AgentProfile = {
      id: config.id || `agent-${uuidv4()}`,
      name: config.name || 'Unknown Agent',
      description: config.description || '',
      status: (config.status as any) || 'available',
      capabilities: [],
      parameters: {
        model: config.parameters?.model || 'gpt-4',
        temperature: config.parameters?.temperature || 0.7,
        maxTokens: config.parameters?.maxTokens || 2000,
        tools: config.parameters?.tools || []
      },
      metadata: {
        tags: config.metadata?.tags || [],
        domain: config.metadata?.domain || [],
        specialization: config.metadata?.specialization || [],
        performanceMetrics: config.metadata?.performanceMetrics || {
          successRate: 0,
          averageResponseTime: 0,
          taskCompletionRate: 0
        },
        version: config.metadata?.version || '1.0',
        isPublic: config.metadata?.isPublic || false
      },
      createdAt: config.createdAt || new Date(),
      updatedAt: config.updatedAt || new Date()
    };
    
    // Extract capabilities
    if (Array.isArray(config.capabilities)) {
      profile.capabilities = config.capabilities.map((cap: any) => {
        if (typeof cap === 'string') {
          return { 
            id: `cap-${uuidv4()}`, 
            name: cap, 
            description: `Capability ${cap}` 
          };
        } else if (typeof cap === 'object') {
          return {
            id: cap.id || `cap-${uuidv4()}`,
            name: cap.name || 'Unknown Capability',
            description: cap.description || `Capability ${cap.name || 'Unknown'}`
          };
        }
        return { 
          id: `cap-${uuidv4()}`, 
          name: 'unknown', 
          description: 'Unknown capability' 
        };
      });
    }
    
    // Add any other parameters that might be in the config
    if (config.parameters) {
      profile.parameters = { 
        ...profile.parameters,
        ...config.parameters
      };
    }
    
    // Add any other metadata that might be in the config
    if (config.metadata) {
      profile.metadata = { 
        ...profile.metadata,
        ...config.metadata
      };
    }
    
    return profile;
  }

  /**
   * Create a DefaultAgent instance from an AgentProfile
   */
  static createFromApiProfile(profile: AgentProfile): DefaultAgent {
    // Convert API-style agent capabilities to DB-style
    const capabilities: DbAgentCapability[] = profile.capabilities.map(cap => ({
      id: cap.id,
      name: cap.name,
      description: cap.description,
      version: '1.0', // Default version if not provided
      parameters: {}  // Default empty parameters
    }));
    
    // Convert string tool IDs to proper AgentTool objects
    const tools: AgentTool[] = (profile.parameters.tools || []).map(toolId => ({
      id: toolId,
      name: toolId,
      description: `Tool ${toolId}`,
      parameters: {},
      requiredPermissions: []
    }));
    
    // Create structured ID if needed
    let agentId: string;
    try {
      const structuredId = IdGenerator.parse(profile.id);
      agentId = structuredId ? structuredId.toString() : IdGenerator.generate('agent').toString();
    } catch (error) {
      // If parsing fails, generate a new ID
      agentId = IdGenerator.generate('agent').toString();
    }
    
    // Create agent data conforming to the DB entity format
    const agentData: Partial<AgentMemoryEntity> = {
      id: agentId,
      name: profile.name,
      description: profile.description,
      createdBy: 'user',
      capabilities,
      parameters: {
        ...profile.parameters,
        tools,
        model: profile.parameters.model || 'gpt-4',
        temperature: profile.parameters.temperature || 0.7,
        maxTokens: profile.parameters.maxTokens || 2000
      },
      status: profile.status as AgentStatus,
      lastActive: profile.createdAt,
      chatIds: [],
      teamIds: [],
      content: profile.description,
      type: 'agent',
      metadata: {
        ...profile.metadata,
        tags: profile.metadata.tags || [],
        domain: profile.metadata.domain || [],
        specialization: profile.metadata.specialization || [], 
        performanceMetrics: profile.metadata.performanceMetrics || {
          successRate: 0,
          averageResponseTime: 0,
          taskCompletionRate: 0
        },
        version: profile.metadata.version || '1.0',
        isPublic: profile.metadata.isPublic || false
      }
    };
    
    // Create the DefaultAgent with the converted data
    const agent = new DefaultAgent({
      ...agentData as any,
      enableMemoryManager: true,
      enablePlanningManager: true,
      enableKnowledgeManager: true,
      enableToolManager: true,
      enableSchedulerManager: true,
      managersConfig: {
        memoryManager: {
          enabled: true
        },
        planningManager: {
          enabled: true
        },
        knowledgeManager: {
          enabled: true
        },
        toolManager: {
          enabled: true
        },
        schedulerManager: {
          enabled: true
        }
      }
    });
    
    return agent;
  }
  
  /**
   * Create a DefaultAgent instance from a DB entity
   */
  static createFromDbEntity(entity: AgentMemoryEntity): DefaultAgent {
    // Create the DefaultAgent with the entity data
    const agent = new DefaultAgent({
      ...entity as any,
      enableMemoryManager: true,
      enablePlanningManager: true,
      enableKnowledgeManager: true,
      enableToolManager: true,
      enableSchedulerManager: true,
      managersConfig: {
        memoryManager: {
          enabled: true
        },
        planningManager: {
          enabled: true
        },
        knowledgeManager: {
          enabled: true
        },
        toolManager: {
          enabled: true
        },
        schedulerManager: {
          enabled: true
        }
      }
    });
    
    return agent;
  }
} 