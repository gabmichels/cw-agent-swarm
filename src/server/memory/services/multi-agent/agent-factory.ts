/**
 * Agent Factory
 * 
 * This module provides a factory for creating agent instances with standardized configuration
 * and enhanced memory communication capabilities.
 */

import { AgentCapability, AgentMemoryEntity, AgentParameters, AgentStatus, agentSchema } from "../../schema/agent";
import { IdGenerator } from "../../../../utils/ulid";
import { AgentMemoryService } from "../agent-memory-service";
import { IMemoryRepository } from "../base/types";
import { Result, failureResult } from "../../../../lib/errors/base";
import { AppError } from "../../../../lib/errors/base";
import { 
  EnhancedMemoryService, 
  AgentCommunicationType, 
  AgentMemoryAccessLevel,
  AgentCommunicationParams 
} from './enhanced-memory-service';
import { BaseMemorySchema } from '../../models';
import { MemoryType } from '../../config';

/**
 * Agent template interface for creating new agents
 */
export interface AgentTemplate {
  name: string;
  description?: string;
  capabilities: AgentCapability[];
  parameters: Partial<AgentParameters>;
  metadata?: {
    tags?: string[];
    domain?: string[];
    specialization?: string[];
    isPublic?: boolean;
  }
}

/**
 * Agent factory service for creating standardized agents
 * Enhanced with agent-to-agent communication capabilities
 */
export class AgentFactory {
  private agentService: AgentMemoryService;
  
  /**
   * Create a new agent factory with optional Enhanced Memory Service
   * Following IMPLEMENTATION_GUIDELINES.md: Dependency Injection pattern
   * @param agentRepository Repository for agent storage
   * @param enhancedMemoryService Optional Enhanced Memory Service for agent communication
   */
  constructor(
    agentRepository: IMemoryRepository<AgentMemoryEntity>,
    private readonly enhancedMemoryService?: EnhancedMemoryService
  ) {
    this.agentService = new AgentMemoryService(agentRepository);
  }
  
  /**
   * Create a new agent from a template
   * @param template The agent template
   * @param createdBy The creator's ID
   * @returns Result containing the created agent or error
   */
  async createAgent(
    template: AgentTemplate,
    createdBy: string = "system"
  ): Promise<Result<AgentMemoryEntity>> {
    // Generate unique agent ID
    const agentId = IdGenerator.generate("agent");
    
    // Merge provided parameters with defaults
    const parameters: AgentParameters = {
      model: template.parameters.model || "default",
      temperature: template.parameters.temperature ?? 0.7,
      maxTokens: template.parameters.maxTokens || 1000,
      tools: template.parameters.tools || [],
      systemPrompt: template.parameters.systemPrompt || "",
      autonomous: template.parameters.autonomous || false
    };
    
    // Prepare agent data with required fields
    const agentData: Omit<AgentMemoryEntity, "id" | "createdAt" | "updatedAt" | "schemaVersion"> = {
      name: template.name,
      description: template.description || "",
      createdBy,
      capabilities: template.capabilities,
      parameters,
      status: AgentStatus.AVAILABLE,
      lastActive: new Date(),
      chatIds: [],
      teamIds: [],
      content: "", // Legacy field
      type: "agent",
      metadata: {
        tags: template.metadata?.tags || [],
        domain: template.metadata?.domain || [],
        specialization: template.metadata?.specialization || [],
        performanceMetrics: {
          successRate: 0,
          averageResponseTime: 0,
          taskCompletionRate: 0
        },
        version: "1.0.0",
        isPublic: template.metadata?.isPublic || false
      }
    };
    
    // Create the agent using the service
    return await this.agentService.create(agentData);
  }
  
  /**
   * Create a specialized agent based on a predefined template
   * @param type The type of specialized agent to create
   * @param name The name for the agent
   * @param customParams Custom parameters to override defaults
   * @param createdBy The creator's ID
   * @returns Result containing the created agent or error
   */
  async createSpecializedAgent(
    type: "assistant" | "researcher" | "coder" | "reviewer",
    name: string,
    customParams: Partial<AgentParameters> = {},
    createdBy: string = "system"
  ): Promise<Result<AgentMemoryEntity>> {
    // Define specialized agent templates
    const templates: Record<string, AgentTemplate> = {
      assistant: {
        name: `Assistant${name ? `: ${name}` : ""}`,
        description: "General purpose assistant agent for answering questions and providing information",
        capabilities: [
          {
            id: "general_knowledge",
            name: "General Knowledge",
            description: "Can answer general knowledge questions",
            version: "1.0"
          },
          {
            id: "task_management",
            name: "Task Management",
            description: "Can help organize and track tasks",
            version: "1.0"
          }
        ],
        parameters: {
          model: process.env.OPENAI_MODEL_NAME || "gpt-4.1-2025-04-14",
          temperature: 0.7,
          maxTokens: process.env.OPENAI_MAX_TOKENS ? parseInt(process.env.OPENAI_MAX_TOKENS, 10) : 32000,
          tools: [],
          ...customParams
        },
        metadata: {
          tags: ["assistant", "general", "helpful"],
          domain: ["general"],
          specialization: ["assistance", "information"],
          isPublic: true
        }
      },
      researcher: {
        name: `Researcher${name ? `: ${name}` : ""}`,
        description: "Specialized agent for in-depth research and information synthesis",
        capabilities: [
          {
            id: "research",
            name: "Research",
            description: "Can perform in-depth research on topics",
            version: "1.0"
          },
          {
            id: "information_synthesis",
            name: "Information Synthesis",
            description: "Can synthesize information from multiple sources",
            version: "1.0"
          }
        ],
        parameters: {
          model: process.env.OPENAI_MODEL_NAME || "gpt-4.1-2025-04-14",
          temperature: 0.7,
          maxTokens: process.env.OPENAI_MAX_TOKENS ? parseInt(process.env.OPENAI_MAX_TOKENS, 10) : 32000,
          tools: [],
          ...customParams
        },
        metadata: {
          tags: ["researcher", "analyst", "thorough"],
          domain: ["research", "analysis"],
          specialization: ["deep research", "synthesis"],
          isPublic: true
        }
      },
      coder: {
        name: `Coder${name ? `: ${name}` : ""}`,
        description: "Specialized agent for code generation and software development",
        capabilities: [
          {
            id: "code_generation",
            name: "Code Generation",
            description: "Can generate code in multiple languages",
            version: "1.0"
          },
          {
            id: "code_review",
            name: "Code Review",
            description: "Can review and improve existing code",
            version: "1.0"
          }
        ],
        parameters: {
          model: process.env.OPENAI_MODEL_NAME || "gpt-4.1-2025-04-14",
          temperature: 0.7,
          maxTokens: process.env.OPENAI_MAX_TOKENS ? parseInt(process.env.OPENAI_MAX_TOKENS, 10) : 32000,
          tools: [],
          ...customParams
        },
        metadata: {
          tags: ["coder", "developer", "programmer"],
          domain: ["software", "development"],
          specialization: ["coding", "programming"],
          isPublic: true
        }
      },
      reviewer: {
        name: `Reviewer${name ? `: ${name}` : ""}`,
        description: "Specialized agent for reviewing content and providing critical feedback",
        capabilities: [
          {
            id: "content_review",
            name: "Content Review",
            description: "Can review and critique content",
            version: "1.0"
          },
          {
            id: "feedback_generation",
            name: "Feedback Generation",
            description: "Can generate constructive feedback",
            version: "1.0"
          }
        ],
        parameters: {
          model: process.env.OPENAI_MODEL_NAME || "gpt-4.1-2025-04-14",
          temperature: 0.7,
          maxTokens: process.env.OPENAI_MAX_TOKENS ? parseInt(process.env.OPENAI_MAX_TOKENS, 10) : 32000,
          tools: [],
          ...customParams
        },
        metadata: {
          tags: ["reviewer", "critic", "feedback"],
          domain: ["review", "analysis"],
          specialization: ["critique", "feedback"],
          isPublic: true
        }
      }
    };
    
    // Create agent using the selected template
    const template = templates[type];
    if (!template) {
      throw new Error(`Unknown agent type: ${type}`);
    }
    
    // Customize the name if provided
    if (name) {
      template.name = name;
    }
    
    return await this.createAgent(template, createdBy);
  }
  
  /**
   * Clone an existing agent with optional modifications
   * @param agentId The ID of the agent to clone
   * @param modifications Modifications to apply to the clone
   * @param createdBy The creator's ID
   * @returns Result containing the cloned agent or error
   */
  async cloneAgent(
    agentId: string,
    modifications: Partial<AgentTemplate> = {},
    createdBy: string = "system"
  ): Promise<Result<AgentMemoryEntity>> {
    // Get the original agent
    const agentResult = await this.agentService.getById(agentId);
    
    if (agentResult.error || !agentResult.data) {
      // Return appropriate error if agent not found
      return agentResult.error ? 
        agentResult as Result<AgentMemoryEntity> : 
        failureResult(new AppError(
          `Agent with ID ${agentId} not found`,
          "AGENT_NOT_FOUND",
          { agentId }
        ));
    }
    
    const sourceAgent = agentResult.data;
    
    // Create a template based on the original agent
    const template: AgentTemplate = {
      name: modifications.name || `Clone of ${sourceAgent.name}`,
      description: modifications.description || sourceAgent.description,
      capabilities: modifications.capabilities || sourceAgent.capabilities,
      parameters: {
        ...sourceAgent.parameters,
        ...modifications.parameters
      },
      metadata: {
        tags: modifications.metadata?.tags || sourceAgent.metadata.tags,
        domain: modifications.metadata?.domain || sourceAgent.metadata.domain,
        specialization: modifications.metadata?.specialization || sourceAgent.metadata.specialization,
        isPublic: modifications.metadata?.isPublic ?? sourceAgent.metadata.isPublic
      }
    };
    
    // Create the cloned agent
    return await this.createAgent(template, createdBy);
  }

  // ============================================================================
  // AGENT COMMUNICATION METHODS
  // Following IMPLEMENTATION_GUIDELINES.md: ULID, strict typing, DI, pure functions
  // ============================================================================

  /**
   * Enable agent-to-agent communication for a newly created agent
   * Pure function with immutable parameters and strict typing
   */
  async enableAgentCommunication(
    agentId: string,
    communicationSettings: {
      readonly accessLevel: AgentMemoryAccessLevel;
      readonly allowedCommunicationTypes: readonly AgentCommunicationType[];
      readonly teamId?: string;
      readonly projectId?: string;
    }
  ): Promise<Result<boolean>> {
    try {
      if (!this.enhancedMemoryService) {
        return {
          success: false,
          error: new AppError(
            'Enhanced Memory Service not available for agent communication',
            'SERVICE_NOT_AVAILABLE',
            { agentId }
          )
        };
      }

      // Store agent communication settings in memory
      const result = await this.enhancedMemoryService.sendAgentMessage<BaseMemorySchema>({
        type: MemoryType.AGENT,
        content: `Agent communication enabled for ${agentId}`,
        senderAgentId: 'system',
        receiverAgentId: agentId,
        communicationType: AgentCommunicationType.STATUS_UPDATE,
        accessLevel: communicationSettings.accessLevel,
        metadata: {
          agentId,
          communicationSettings: {
            accessLevel: communicationSettings.accessLevel,
            allowedCommunicationTypes: communicationSettings.allowedCommunicationTypes,
            teamId: communicationSettings.teamId,
            projectId: communicationSettings.projectId
          },
          eventType: 'communication_enabled',
          timestamp: Date.now()
        }
      });

      return {
        success: result.success,
        data: result.success,
        error: result.error ? new AppError(
          result.error.message,
          result.error.code as string,
          { agentId }
        ) : undefined
      };
    } catch (error) {
      return failureResult(new AppError(
        `Failed to enable agent communication: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'COMMUNICATION_SETUP_FAILED',
        { agentId, error }
      ));
    }
  }

  /**
   * Send a message from one agent to another
   * Pure function with immutable parameters and strict typing
   */
  async sendAgentMessage(
    senderAgentId: string,
    receiverAgentId: string,
    content: string,
    options: {
      readonly communicationType?: AgentCommunicationType;
      readonly priority?: 'low' | 'medium' | 'high' | 'urgent';
      readonly accessLevel?: AgentMemoryAccessLevel;
      readonly metadata?: Record<string, unknown>;
    } = {}
  ): Promise<Result<string>> {
    try {
      if (!this.enhancedMemoryService) {
        return failureResult(new AppError(
          'Enhanced Memory Service not available for agent communication',
          'SERVICE_NOT_AVAILABLE',
          { senderAgentId, receiverAgentId }
        ));
      }

      // Validate both agents exist
      const senderResult = await this.agentService.getById(senderAgentId);
      const receiverResult = await this.agentService.getById(receiverAgentId);

      if (senderResult.error || !senderResult.data) {
        return failureResult(new AppError(
          `Sender agent not found: ${senderAgentId}`,
          'SENDER_NOT_FOUND',
          { senderAgentId }
        ));
      }

      if (receiverResult.error || !receiverResult.data) {
        return failureResult(new AppError(
          `Receiver agent not found: ${receiverAgentId}`,
          'RECEIVER_NOT_FOUND',
          { receiverAgentId }
        ));
      }

      // Send the message using Enhanced Memory Service
      const result = await this.enhancedMemoryService.sendAgentMessage<BaseMemorySchema>({
        type: MemoryType.MESSAGE,
        content,
        senderAgentId,
        receiverAgentId,
        communicationType: options.communicationType || AgentCommunicationType.DIRECT_MESSAGE,
        priority: options.priority || 'medium',
        accessLevel: options.accessLevel || AgentMemoryAccessLevel.PRIVATE,
        metadata: {
          ...options.metadata,
          senderName: senderResult.data.name,
          receiverName: receiverResult.data.name,
          timestamp: Date.now()
        }
      });

      return {
        success: result.success,
        data: result.id || 'unknown',
        error: result.error ? new AppError(
          result.error.message,
          result.error.code as string,
          { senderAgentId, receiverAgentId }
        ) : undefined
      };
    } catch (error) {
      return failureResult(new AppError(
        `Failed to send agent message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'MESSAGE_SEND_FAILED',
        { senderAgentId, receiverAgentId, error }
      ));
    }
  }

  /**
   * Broadcast a message from one agent to multiple agents
   * Pure function with immutable parameters and strict typing
   */
  async broadcastAgentMessage(
    senderAgentId: string,
    content: string,
    options: {
      readonly receiverAgentIds?: readonly string[];
      readonly teamId?: string;
      readonly accessLevel: AgentMemoryAccessLevel;
      readonly communicationType?: AgentCommunicationType;
      readonly priority?: 'low' | 'medium' | 'high' | 'urgent';
      readonly metadata?: Record<string, unknown>;
    }
  ): Promise<Result<string[]>> {
    try {
      if (!this.enhancedMemoryService) {
        return failureResult(new AppError(
          'Enhanced Memory Service not available for agent communication',
          'SERVICE_NOT_AVAILABLE',
          { senderAgentId }
        ));
      }

      // Validate sender agent exists
      const senderResult = await this.agentService.getById(senderAgentId);
      if (senderResult.error || !senderResult.data) {
        return failureResult(new AppError(
          `Sender agent not found: ${senderAgentId}`,
          'SENDER_NOT_FOUND',
          { senderAgentId }
        ));
      }

      // Send broadcast message using Enhanced Memory Service
      const results = await this.enhancedMemoryService.broadcastAgentMessage<BaseMemorySchema>({
        type: MemoryType.MESSAGE,
        content,
        senderAgentId,
        communicationType: options.communicationType || AgentCommunicationType.BROADCAST,
        priority: options.priority || 'medium',
        accessLevel: options.accessLevel,
        receiverAgentIds: options.receiverAgentIds,
        teamId: options.teamId,
        metadata: {
          ...options.metadata,
          senderName: senderResult.data.name,
          timestamp: Date.now(),
          broadcastType: options.receiverAgentIds ? 'targeted' : 'team'
        }
      });

      // Extract message IDs from results
      const messageIds = results
        .filter(r => r.success)
        .map(r => r.id || 'unknown');

      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        console.warn(`Broadcast partially failed: ${failures.length} messages failed to send`);
      }

      return {
        success: messageIds.length > 0,
        data: messageIds,
        error: messageIds.length === 0 ? new AppError(
          'All broadcast messages failed to send',
          'BROADCAST_FAILED',
          { senderAgentId, failures }
        ) : undefined
      };
    } catch (error) {
      return failureResult(new AppError(
        `Failed to broadcast agent message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'BROADCAST_FAILED',
        { senderAgentId, error }
      ));
    }
  }

  /**
   * Get conversation history between agents
   * Pure function with immutable parameters and strict typing
   */
  async getAgentConversationHistory(
    agentId: string,
    otherAgentId?: string,
    options: {
      readonly limit?: number;
      readonly offset?: number;
      readonly since?: Date;
      readonly communicationType?: AgentCommunicationType;
    } = {}
  ): Promise<Result<any[]>> {
    try {
      if (!this.enhancedMemoryService) {
        return failureResult(new AppError(
          'Enhanced Memory Service not available for agent communication',
          'SERVICE_NOT_AVAILABLE',
          { agentId }
        ));
      }

      // Validate requesting agent exists
      const agentResult = await this.agentService.getById(agentId);
      if (agentResult.error || !agentResult.data) {
        return failureResult(new AppError(
          `Agent not found: ${agentId}`,
          'AGENT_NOT_FOUND',
          { agentId }
        ));
      }

      // Get conversation history using Enhanced Memory Service
      const history = await this.enhancedMemoryService.getAgentConversationHistory<BaseMemorySchema>(
        agentId,
        otherAgentId,
        {
          limit: options.limit || 50,
          offset: options.offset || 0,
          since: options.since,
          communicationType: options.communicationType
        }
      );

      return {
        success: true,
        data: history
      };
    } catch (error) {
      return failureResult(new AppError(
        `Failed to get agent conversation history: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'HISTORY_RETRIEVAL_FAILED',
        { agentId, otherAgentId, error }
      ));
    }
  }
} 