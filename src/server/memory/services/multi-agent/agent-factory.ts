/**
 * Agent Factory
 * 
 * This module provides a factory for creating agent instances with standardized configuration.
 */

import { AgentCapability, AgentMemoryEntity, AgentParameters, AgentStatus, agentSchema } from "../../schema/agent";
import { IdGenerator } from "../../../../utils/ulid";
import { AgentMemoryService } from "../agent-memory-service";
import { IMemoryRepository } from "../base/types";
import { Result, failureResult } from "../../../../lib/errors/base";
import { AppError } from "../../../../lib/errors/base";

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
 */
export class AgentFactory {
  private agentService: AgentMemoryService;
  
  /**
   * Create a new agent factory
   * @param agentRepository Repository for agent storage
   */
  constructor(agentRepository: IMemoryRepository<AgentMemoryEntity>) {
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
      customInstructions: template.parameters.customInstructions || "",
      contextWindow: template.parameters.contextWindow || 4000,
      systemMessages: template.parameters.systemMessages || []
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
      content: template.description || template.name,
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
} 