/**
 * Multi-Agent Delegation Service
 * 
 * Main service that integrates all multi-agent delegation components.
 * Following IMPLEMENTATION_GUIDELINES.md: ULID, strict typing, DI, pure functions, immutability
 */

import { ulid } from 'ulid';
import { StructuredId } from '../../types/entity-identifier';
import {
  IToolDelegationProtocol,
  ToolDelegationRequest,
  ToolDelegationResponse,
  ToolDelegationStatus,
  ToolCapabilityCategory,
  ToolDelegationPriority,
  createToolDelegationRequest,
  ToolDelegationError,
  ToolCapability
} from './delegation/ToolDelegationProtocol';
import {
  IAgentCapabilityDiscovery,
  AgentCapabilityDiscovery,
  AgentDiscoveryCriteria
} from './discovery/AgentCapabilityDiscovery';
import {
  CrossAgentTaskHandlerRegistry,
  EmailTaskParameters,
  SocialMediaTaskParameters
} from './handlers/CrossAgentTaskHandlers';
import {
  IWorkflowOrchestrator,
  WorkflowOrchestrator,
  WorkflowDefinition,
  WorkflowExecutionContext,
  createWorkflowStep
} from './orchestration/WorkflowOrchestrator';

/**
 * Service configuration
 */
export interface MultiAgentDelegationConfig {
  readonly emailService?: {
    sendEmail(params: EmailTaskParameters, agentId: string): Promise<any>;
  };
  readonly socialMediaService?: {
    createPost(params: SocialMediaTaskParameters, agentId: string): Promise<any>;
  };
  readonly messagingService: {
    sendMessage(
      toAgentId: string,
      request: ToolDelegationRequest
    ): Promise<ToolDelegationResponse>;
  };
}

/**
 * Delegation request options
 */
export interface DelegationOptions {
  readonly targetAgentId?: string;
  readonly priority?: ToolDelegationPriority;
  readonly requiresConfirmation?: boolean;
  readonly timeout?: number;
  readonly retryCount?: number;
  readonly fallbackStrategy?: string;
}

/**
 * Multi-agent delegation service interface
 */
export interface IMultiAgentDelegationService {
  /**
   * Register agent capabilities
   */
  registerAgentCapabilities(
    agentId: string,
    capabilities: readonly ToolCapability[]
  ): Promise<void>;

  /**
   * Delegate a tool request to another agent
   */
  delegateToolRequest(
    requestingAgentId: string,
    toolName: string,
    toolCategory: ToolCapabilityCategory,
    parameters: Record<string, unknown>,
    options?: DelegationOptions
  ): Promise<ToolDelegationResponse>;

  /**
   * Find agents with specific capabilities
   */
  findCapableAgents(
    criteria: AgentDiscoveryCriteria
  ): Promise<readonly string[]>;

  /**
   * Create and execute a workflow
   */
  executeWorkflow(
    name: string,
    description: string,
    steps: readonly {
      name: string;
      toolName: string;
      toolCategory: ToolCapabilityCategory;
      parameters: Record<string, unknown>;
      dependencies?: readonly string[];
      assignedAgentId?: string;
    }[],
    coordinatorAgentId: string
  ): Promise<WorkflowExecutionContext>;

  /**
   * Get workflow status
   */
  getWorkflowStatus(workflowId: string): Promise<WorkflowExecutionContext>;

  /**
   * Send email via delegation
   */
  sendEmailViaDelegation(
    requestingAgentId: string,
    emailParams: EmailTaskParameters,
    options?: DelegationOptions
  ): Promise<ToolDelegationResponse>;

  /**
   * Post to social media via delegation
   */
  postToSocialMediaViaDelegation(
    requestingAgentId: string,
    socialParams: SocialMediaTaskParameters,
    options?: DelegationOptions
  ): Promise<ToolDelegationResponse>;
}

/**
 * Multi-agent delegation service implementation
 */
export class MultiAgentDelegationService implements IMultiAgentDelegationService {
  private readonly capabilityDiscovery: IAgentCapabilityDiscovery;
  private readonly taskHandlerRegistry: CrossAgentTaskHandlerRegistry;
  private readonly workflowOrchestrator: IWorkflowOrchestrator;
  private readonly requestTracker: Map<string, ToolDelegationRequest> = new Map();

  constructor(private readonly config: MultiAgentDelegationConfig) {
    this.capabilityDiscovery = new AgentCapabilityDiscovery();
    this.taskHandlerRegistry = new CrossAgentTaskHandlerRegistry({
      emailService: config.emailService,
      socialMediaService: config.socialMediaService
    });
    this.workflowOrchestrator = new WorkflowOrchestrator(
      this.capabilityDiscovery,
      this.taskHandlerRegistry,
      {
        sendMessage: this.config.messagingService.sendMessage
      }
    );
  }

  /**
   * Register agent capabilities
   */
  async registerAgentCapabilities(
    agentId: string,
    capabilities: readonly ToolCapability[]
  ): Promise<void> {
    if (!agentId) {
      throw new ToolDelegationError(
        'Agent ID is required for capability registration',
        'INVALID_AGENT_ID'
      );
    }

    await this.capabilityDiscovery.registerCapabilities(agentId, capabilities);
  }

  /**
   * Delegate a tool request to another agent
   */
  async delegateToolRequest(
    requestingAgentId: string,
    toolName: string,
    toolCategory: ToolCapabilityCategory,
    parameters: Record<string, unknown>,
    options: DelegationOptions = {}
  ): Promise<ToolDelegationResponse> {
    // Create delegation request
    const request = createToolDelegationRequest(
      requestingAgentId,
      toolName,
      toolCategory,
      parameters,
      {
        targetAgentId: options.targetAgentId,
        priority: options.priority,
        requiresConfirmation: options.requiresConfirmation,
        context: {
          reason: `Tool delegation request for ${toolName}`,
          expectedOutcome: `Execute ${toolName} tool successfully`,
          fallbackStrategy: options.fallbackStrategy
        },
        metadata: {
          timeout: options.timeout,
          retryCount: options.retryCount
        }
      }
    );

    // Track the request
    this.requestTracker.set(request.id.toString(), request);

    try {
      // Try to handle with local task handlers first
      const handler = this.taskHandlerRegistry.getHandler(request);
      if (handler) {
        const response = await this.taskHandlerRegistry.processRequest(request);
        return response;
      }

      // Find capable agent if no target specified
      if (!options.targetAgentId) {
        const criteria: AgentDiscoveryCriteria = {
          toolName,
          toolCategory
        };

        const discoveredAgents = await this.capabilityDiscovery.discoverAgents(criteria);
        if (discoveredAgents.length === 0) {
          throw new ToolDelegationError(
            `No capable agent found for tool: ${toolName}`,
            'NO_CAPABLE_AGENT',
            { toolName, category: toolCategory }
          );
        }

        // Update request with discovered agent
        const updatedRequest = {
          ...request,
          targetAgentId: discoveredAgents[0].agentCapabilities.agentId
        };

        // Send to discovered agent
        return await this.config.messagingService.sendMessage(
          discoveredAgents[0].agentCapabilities.agentId,
          updatedRequest
        );
      }

      // Send to specified agent
      return await this.config.messagingService.sendMessage(
        options.targetAgentId,
        request
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = error instanceof ToolDelegationError ? error.code : 'DELEGATION_ERROR';

      throw new ToolDelegationError(
        `Tool delegation failed: ${errorMessage}`,
        errorCode,
        { toolName, category: toolCategory, requestingAgentId }
      );
    } finally {
      // Clean up request tracking
      this.requestTracker.delete(request.id.toString());
    }
  }

  /**
   * Find agents with specific capabilities
   */
  async findCapableAgents(
    criteria: AgentDiscoveryCriteria
  ): Promise<readonly string[]> {
    const discoveredAgents = await this.capabilityDiscovery.discoverAgents(criteria);
    return Object.freeze(
      discoveredAgents.map(result => result.agentCapabilities.agentId)
    );
  }

  /**
   * Create and execute a workflow
   */
  async executeWorkflow(
    name: string,
    description: string,
    steps: readonly {
      name: string;
      toolName: string;
      toolCategory: ToolCapabilityCategory;
      parameters: Record<string, unknown>;
      dependencies?: readonly string[];
      assignedAgentId?: string;
    }[],
    coordinatorAgentId: string
  ): Promise<WorkflowExecutionContext> {
    // Convert step names to IDs for dependencies
    const stepIdMap: Record<string, StructuredId> = {};
    
    const workflowSteps = steps.map((step, index) => {
      const stepId = {
        id: ulid(Date.now() + index),
        prefix: 'workflow_step',
        timestamp: new Date(),
        toString: () => `workflow_step_${ulid(Date.now() + index)}`
      } as StructuredId;

      stepIdMap[step.name] = stepId;

      return createWorkflowStep(
        step.name,
        step.toolName,
        step.toolCategory,
        step.parameters,
        {
          dependencies: step.dependencies?.map(depName => stepIdMap[depName]).filter(Boolean) || [],
          assignedAgentId: step.assignedAgentId
        }
      );
    });

    const workflowDefinition = this.workflowOrchestrator.createWorkflow(
      name,
      description,
      workflowSteps,
      coordinatorAgentId
    );

    return await this.workflowOrchestrator.executeWorkflow(workflowDefinition);
  }

  /**
   * Get workflow status
   */
  async getWorkflowStatus(workflowId: string): Promise<WorkflowExecutionContext> {
    const id = {
      id: workflowId,
      prefix: 'workflow',
      timestamp: new Date(),
      toString: () => workflowId
    } as StructuredId;

    return await this.workflowOrchestrator.getWorkflowStatus(id);
  }

  /**
   * Send email via delegation
   */
  async sendEmailViaDelegation(
    requestingAgentId: string,
    emailParams: EmailTaskParameters,
    options: DelegationOptions = {}
  ): Promise<ToolDelegationResponse> {
    return await this.delegateToolRequest(
      requestingAgentId,
      'sendEmail',
      ToolCapabilityCategory.EMAIL,
      emailParams as any,
      options
    );
  }

  /**
   * Post to social media via delegation
   */
  async postToSocialMediaViaDelegation(
    requestingAgentId: string,
    socialParams: SocialMediaTaskParameters,
    options: DelegationOptions = {}
  ): Promise<ToolDelegationResponse> {
    return await this.delegateToolRequest(
      requestingAgentId,
      'createPost',
      ToolCapabilityCategory.SOCIAL_MEDIA,
      socialParams as any,
      options
    );
  }
}

/**
 * Factory function to create delegation service
 */
export const createMultiAgentDelegationService = (
  config: MultiAgentDelegationConfig
): IMultiAgentDelegationService => {
  return new MultiAgentDelegationService(config);
};

/**
 * Predefined tool capabilities for common services
 */
export const COMMON_TOOL_CAPABILITIES = Object.freeze({
  EMAIL: Object.freeze([
    {
      name: 'sendEmail',
      category: ToolCapabilityCategory.EMAIL,
      description: 'Send email messages',
      parameters: Object.freeze({
        to: { type: 'string|array', required: true, description: 'Recipients' },
        subject: { type: 'string', required: true, description: 'Email subject' },
        body: { type: 'string', required: true, description: 'Email body' },
        cc: { type: 'string|array', required: false, description: 'CC recipients' },
        bcc: { type: 'string|array', required: false, description: 'BCC recipients' }
      }),
      permissions: ['email.send'],
      estimatedExecutionTime: 2000,
      reliability: 0.95
    }
  ] as readonly ToolCapability[]),

  SOCIAL_MEDIA: Object.freeze([
    {
      name: 'createPost',
      category: ToolCapabilityCategory.SOCIAL_MEDIA,
      description: 'Create social media posts',
      parameters: Object.freeze({
        content: { type: 'string', required: true, description: 'Post content' },
        platforms: { type: 'array', required: true, description: 'Target platforms' },
        images: { type: 'array', required: false, description: 'Image attachments' },
        hashtags: { type: 'array', required: false, description: 'Hashtags' }
      }),
      permissions: ['social_media.post'],
      estimatedExecutionTime: 3000,
      reliability: 0.90
    }
  ] as readonly ToolCapability[])
});

/**
 * Pure function to validate delegation request
 */
export const validateDelegationRequest = (
  requestingAgentId: string,
  toolName: string,
  toolCategory: ToolCapabilityCategory,
  parameters: Record<string, unknown>
): boolean => {
  try {
    if (!requestingAgentId || !toolName || !toolCategory) {
      return false;
    }

    if (!parameters || typeof parameters !== 'object') {
      return false;
    }

    // Category-specific validation
    switch (toolCategory) {
      case ToolCapabilityCategory.EMAIL:
        return !!(parameters.to && parameters.subject && parameters.body);
      
      case ToolCapabilityCategory.SOCIAL_MEDIA:
        return !!(parameters.content && parameters.platforms);
      
      default:
        return true;
    }
  } catch {
    return false;
  }
}; 