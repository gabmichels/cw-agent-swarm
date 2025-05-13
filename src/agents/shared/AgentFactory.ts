import { v4 as uuidv4 } from 'uuid';
import { DefaultAgent } from './DefaultAgent';
import { AgentCapability as ApiAgentCapability, AgentProfile } from '@/lib/multi-agent/types/agent';
import { AgentMemoryEntity, AgentCapability as DbAgentCapability, AgentTool, AgentStatus } from '@/server/memory/schema/agent';
import { StructuredId, IdGenerator } from '@/utils/ulid';

/**
 * AgentFactory provides methods to create agent instances from different data sources
 */
export class AgentFactory {
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
    let structuredId: StructuredId;
    try {
      structuredId = IdGenerator.parse(profile.id) || IdGenerator.generate('agent');
    } catch (error) {
      // If parsing fails, generate a new ID
      structuredId = IdGenerator.generate('agent');
    }
    
    // Create agent data conforming to the DB entity format
    const agentData: Partial<AgentMemoryEntity> = {
      id: structuredId,
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