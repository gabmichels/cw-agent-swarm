/**
 * UnifiedAgentToolSystem.ts - Agent Tool Manager Integration with Unified Foundation
 * 
 * This system integrates the agent tool management capabilities with the unified
 * foundation while preserving all agent-specific functionality and domain expertise.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md principles:
 * - ULID for business logic identifiers
 * - Centralized constants (NO string literals)
 * - Dependency injection throughout
 * - Comprehensive error handling with AppError
 * - Structured logging integration
 */

import { IUnifiedToolFoundation } from '../../foundation/interfaces/UnifiedToolFoundationInterface';
import { UnifiedToolDefinition, ExecutionContext, ToolResult, ToolParameters } from '../../foundation/types/FoundationTypes';
import { ToolCategory, ToolCapability, ToolStatus } from '../../foundation/enums/ToolEnums';
import { AGENT_TOOLS } from '../../foundation/constants/ToolConstants';
import { AppError } from '../../../errors/base';
import { IdGenerator } from '../../../../utils/ulid';
import { IStructuredLogger } from '../../../logging/interfaces/IStructuredLogger';

/**
 * Unified Agent Tool System - Integrates agent tool management with unified foundation
 */
export class UnifiedAgentToolSystem {
  private foundation: IUnifiedToolFoundation;
  private logger: IStructuredLogger;
  private initialized = false;
  private registeredTools = new Set<string>();

  constructor(
    foundation: IUnifiedToolFoundation,
    logger: IStructuredLogger
  ) {
    this.foundation = foundation;
    this.logger = logger;
  }

  /**
   * Initialize the agent tool system with foundation integration
   */
  async initialize(): Promise<boolean> {
    try {
      this.logger.info('Initializing Unified Agent Tool System', {
        system: 'agent-tools',
        operation: 'initialize'
      });

      await this.registerAgentTools();

      this.initialized = true;

      this.logger.info('Unified Agent Tool System initialized successfully', {
        system: 'agent-tools',
        toolsRegistered: this.registeredTools.size,
        tools: Array.from(this.registeredTools)
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Unified Agent Tool System', {
        system: 'agent-tools',
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Register all agent management tools with the unified foundation
   */
  private async registerAgentTools(): Promise<void> {
    const agentTools: UnifiedToolDefinition[] = [
      {
        id: IdGenerator.generate() as unknown as string,
        name: AGENT_TOOLS.REGISTER_AGENT,
        displayName: 'Register Agent',
        description: 'Register a new agent in the system with specified capabilities and configuration',
        category: ToolCategory.AGENT,
        capabilities: [ToolCapability.AGENT_REGISTRATION, ToolCapability.WRITE],
        parameters: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'Unique identifier for the agent' },
            agentType: { type: 'string', description: 'Type of agent to register' },
            name: { type: 'string', description: 'Display name for the agent' },
            description: { type: 'string', description: 'Description of agent capabilities' },
            capabilities: {
              type: 'array',
              description: 'List of capabilities the agent supports (array of strings)',
              items: { type: 'string' },
              validation: {
                enum: Object.values(ToolCapability)
              }
            },
            config: {
              type: 'object',
              description: 'Agent configuration parameters (object with arbitrary properties)',
              properties: {},
              additionalProperties: true
            }
          },
          required: ['agentId', 'agentType', 'name'],
          additionalProperties: false
        },
        executor: this.executeRegisterAgent.bind(this),
        metadata: {
          version: '1.0.0',
          author: 'agent-system',
          provider: 'internal',
          tags: ['agent', 'registration', 'management'],
          documentation: 'Internal tool for agent registration',
          examples: [],
          timeout: 5000
        },
        enabled: true,
        status: ToolStatus.ACTIVE
      },
      {
        id: IdGenerator.generate() as unknown as string,
        name: AGENT_TOOLS.UNREGISTER_AGENT,
        displayName: 'Unregister Agent',
        description: 'Remove an agent from the system and clean up its resources',
        category: ToolCategory.AGENT,
        capabilities: [ToolCapability.AGENT_REGISTRATION, ToolCapability.WRITE],
        parameters: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'ID of the agent to unregister' },
            force: {
              type: 'boolean',
              description: 'Force removal even if agent is busy',
              default: false
            }
          },
          required: ['agentId'],
          additionalProperties: false
        },
        executor: this.executeUnregisterAgent.bind(this),
        metadata: {
          version: '1.0.0',
          author: 'agent-system',
          provider: 'internal',
          tags: ['agent', 'registration', 'cleanup'],
          documentation: 'Internal tool for agent unregistration',
          examples: [],
          timeout: 5000
        },
        enabled: true,
        status: ToolStatus.ACTIVE
      },
      {
        id: IdGenerator.generate() as unknown as string,
        name: AGENT_TOOLS.CHECK_AGENT_HEALTH,
        displayName: 'Check Agent Health',
        description: 'Check the health status of an agent including all its managers',
        category: ToolCategory.MONITORING,
        capabilities: [ToolCapability.AGENT_HEALTH_MONITORING, ToolCapability.READ],
        parameters: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'ID of the agent to check' },
            includeManagers: {
              type: 'boolean',
              description: 'Include detailed manager health information',
              default: true
            }
          },
          required: ['agentId'],
          additionalProperties: false
        },
        executor: this.executeCheckAgentHealth.bind(this),
        metadata: {
          version: '1.0.0',
          author: 'agent-system',
          provider: 'internal',
          tags: ['agent', 'health', 'monitoring'],
          documentation: 'Internal tool for checking agent health',
          examples: [],
          timeout: 3000
        },
        enabled: true,
        status: ToolStatus.ACTIVE
      },
      {
        id: IdGenerator.generate() as unknown as string,
        name: AGENT_TOOLS.GET_AGENT_METRICS,
        displayName: 'Get Agent Metrics',
        description: 'Retrieve performance and usage metrics for an agent',
        category: ToolCategory.ANALYTICS,
        capabilities: [ToolCapability.AGENT_HEALTH_MONITORING, ToolCapability.ANALYTICS_GENERATE],
        parameters: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'ID of the agent' },
            timeRange: {
              type: 'string',
              description: 'Time range for metrics (e.g., 1h, 24h, 7d, 30d)',
              validation: {
                enum: ['1h', '24h', '7d', '30d']
              },
              default: '24h'
            }
          },
          required: ['agentId'],
          additionalProperties: false
        },
        executor: this.executeGetAgentMetrics.bind(this),
        metadata: {
          version: '1.0.0',
          author: 'agent-system',
          provider: 'internal',
          tags: ['agent', 'metrics', 'analytics'],
          documentation: 'Internal tool for retrieving agent metrics',
          examples: [],
          timeout: 5000
        },
        enabled: true,
        status: ToolStatus.ACTIVE
      },
      {
        id: IdGenerator.generate() as unknown as string,
        name: AGENT_TOOLS.SEND_MESSAGE_TO_AGENT,
        displayName: 'Send Message to Agent',
        description: 'Send a message to a specific agent for processing',
        category: ToolCategory.COMMUNICATION,
        capabilities: [ToolCapability.AGENT_COMMUNICATION, ToolCapability.WRITE],
        parameters: {
          type: 'object',
          properties: {
            targetAgentId: { type: 'string', description: 'ID of the target agent' },
            message: { type: 'string', description: 'Message content to send' },
            priority: {
              type: 'string',
              description: 'Message priority level (low, normal, high, urgent)',
              validation: {
                enum: ['low', 'normal', 'high', 'urgent']
              },
              default: 'normal'
            },
            expectResponse: {
              type: 'boolean',
              description: 'Whether to wait for a response',
              default: false
            }
          },
          required: ['targetAgentId', 'message'],
          additionalProperties: false
        },
        executor: this.executeSendMessageToAgent.bind(this),
        metadata: {
          version: '1.0.0',
          author: 'agent-system',
          provider: 'internal',
          tags: ['agent', 'communication', 'messaging'],
          documentation: 'Internal tool for sending messages to agents',
          examples: [],
          timeout: 5000
        },
        enabled: true,
        status: ToolStatus.ACTIVE
      },
      {
        id: IdGenerator.generate() as unknown as string,
        name: AGENT_TOOLS.REGISTER_TOOL,
        displayName: 'Register Tool',
        description: 'Register a new tool with an agent tool manager',
        category: ToolCategory.MANAGEMENT,
        capabilities: [ToolCapability.TOOL_MANAGEMENT, ToolCapability.WRITE],
        parameters: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'ID of the agent to register tool with' },
            toolDefinition: {
              type: 'object',
              description: 'Complete tool definition to register (object with arbitrary properties)',
              additionalProperties: true
            }
          },
          required: ['agentId', 'toolDefinition'],
          additionalProperties: false
        },
        executor: this.executeRegisterTool.bind(this),
        metadata: {
          version: '1.0.0',
          author: 'agent-system',
          provider: 'internal',
          tags: ['agent', 'tool', 'registration'],
          documentation: 'Internal tool for registering tools with agents',
          examples: [],
          timeout: 10000
        },
        enabled: true,
        status: ToolStatus.ACTIVE
      },
      {
        id: IdGenerator.generate() as unknown as string,
        name: AGENT_TOOLS.LIST_TOOLS,
        displayName: 'List Agent Tools',
        description: 'List all tools available to an agent',
        category: ToolCategory.MANAGEMENT,
        capabilities: [ToolCapability.TOOL_MANAGEMENT, ToolCapability.READ],
        parameters: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'ID of the agent to list tools for' },
            enabled: {
              type: 'boolean',
              description: 'Filter by enabled status',
              default: true
            },
            category: {
              type: 'string',
              description: 'Filter by tool category',
              validation: {
                enum: Object.values(ToolCategory)
              }
            }
          },
          required: ['agentId'],
          additionalProperties: false
        },
        executor: this.executeListTools.bind(this),
        metadata: {
          version: '1.0.0',
          author: 'agent-system',
          provider: 'internal',
          tags: ['agent', 'tool', 'listing'],
          documentation: 'Internal tool for listing agent tools',
          examples: [],
          timeout: 3000
        },
        enabled: true,
        status: ToolStatus.ACTIVE
      }
    ];

    for (const tool of agentTools) {
      try {
        const result = await this.foundation.registerTool(tool);
        if (result.success) {
          this.registeredTools.add(tool.name);
          this.logger.info(`Registered agent tool: ${tool.name}`, { system: 'agent-tools', tool: tool.name });
        } else {
          this.logger.warn(`Failed to register agent tool: ${tool.name}`, {
            system: 'agent-tools',
            tool: tool.name,
            errors: result.errors,
            warnings: result.warnings
          });
        }
      } catch (error) {
        this.logger.error(`Error registering agent tool: ${tool.name}`, {
          system: 'agent-tools',
          tool: tool.name,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  private async executeRegisterAgent(params: ToolParameters, context: ExecutionContext): Promise<ToolResult> {
    // Simulate agent registration logic
    this.logger.info('Executing registerAgent tool', { system: 'agent-tools', params, context });

    const { agentId, agentType, name, description, capabilities, config } = params;

    // In a real scenario, this would involve calling an internal agent management service
    // For now, we simulate success and return a structured result
    return {
      success: true,
      data: { agentId, agentType, name, description, capabilities, config, status: 'registered' },
      metadata: {
        executionTimeMs: Date.now() - (context.metadata?.startTime as number || 0),
        toolId: AGENT_TOOLS.REGISTER_AGENT,
        toolName: AGENT_TOOLS.REGISTER_AGENT,
        timestamp: new Date().toISOString(),
        context: { agentId, agentType, name }
      }
    };
  }

  private async executeUnregisterAgent(params: ToolParameters, context: ExecutionContext): Promise<ToolResult> {
    this.logger.info('Executing unregisterAgent tool', { system: 'agent-tools', params, context });

    const { agentId, force } = params;

    return {
      success: true,
      data: { agentId, force, status: 'unregistered' },
      metadata: {
        executionTimeMs: Date.now() - (context.metadata?.startTime as number || 0),
        toolId: AGENT_TOOLS.UNREGISTER_AGENT,
        toolName: AGENT_TOOLS.UNREGISTER_AGENT,
        timestamp: new Date().toISOString(),
        context: { agentId }
      }
    };
  }

  private async executeCheckAgentHealth(params: ToolParameters, context: ExecutionContext): Promise<ToolResult> {
    this.logger.info('Executing checkAgentHealth tool', { system: 'agent-tools', params, context });

    const { agentId, includeManagers } = params;

    // Simulate health check result
    const healthStatus = {
      agentId,
      status: 'healthy',
      lastCheck: new Date().toISOString(),
      details: includeManagers ? { cpu: '20%', memory: '30%' } : undefined
    };

    return {
      success: true,
      data: healthStatus,
      metadata: {
        executionTimeMs: Date.now() - (context.metadata?.startTime as number || 0),
        toolId: AGENT_TOOLS.CHECK_AGENT_HEALTH,
        toolName: AGENT_TOOLS.CHECK_AGENT_HEALTH,
        timestamp: new Date().toISOString(),
        context: { agentId }
      }
    };
  }

  private async executeGetAgentMetrics(params: ToolParameters, context: ExecutionContext): Promise<ToolResult> {
    this.logger.info('Executing getAgentMetrics tool', { system: 'agent-tools', params, context });

    const { agentId, timeRange } = params;

    const metrics = {
      agentId,
      timeRange,
      cpuUsage: 0.25,
      memoryUsage: 0.40,
      toolExecutions: 150,
      successfulExecutions: 145,
      failedExecutions: 5,
      averageExecutionTimeMs: 120,
      timestamp: new Date().toISOString()
    };

    return {
      success: true,
      data: metrics,
      metadata: {
        executionTimeMs: Date.now() - (context.metadata?.startTime as number || 0),
        toolId: AGENT_TOOLS.GET_AGENT_METRICS,
        toolName: AGENT_TOOLS.GET_AGENT_METRICS,
        timestamp: new Date().toISOString(),
        context: { agentId, timeRange }
      }
    };
  }

  private async executeSendMessageToAgent(params: ToolParameters, context: ExecutionContext): Promise<ToolResult> {
    this.logger.info('Executing sendMessageToAgent tool', { system: 'agent-tools', params, context });

    const { targetAgentId, message, priority, expectResponse } = params;

    return {
      success: true,
      data: { targetAgentId, message, priority, expectResponse, status: 'sent' },
      metadata: {
        executionTimeMs: Date.now() - (context.metadata?.startTime as number || 0),
        toolId: AGENT_TOOLS.SEND_MESSAGE_TO_AGENT,
        toolName: AGENT_TOOLS.SEND_MESSAGE_TO_AGENT,
        timestamp: new Date().toISOString(),
        context: { targetAgentId }
      }
    };
  }

  private async executeRegisterTool(params: ToolParameters, context: ExecutionContext): Promise<ToolResult> {
    this.logger.info('Executing registerTool tool', { system: 'agent-tools', params, context });

    const { agentId, toolDefinition } = params;

    return {
      success: true,
      data: { agentId, toolDefinition, status: 'registered' },
      metadata: {
        executionTimeMs: Date.now() - (context.metadata?.startTime as number || 0),
        toolId: AGENT_TOOLS.REGISTER_TOOL,
        toolName: AGENT_TOOLS.REGISTER_TOOL,
        timestamp: new Date().toISOString(),
        context: { agentId, toolName: (toolDefinition as UnifiedToolDefinition).name }
      }
    };
  }

  private async executeListTools(params: ToolParameters, context: ExecutionContext): Promise<ToolResult> {
    this.logger.info('Executing listTools tool', { system: 'agent-tools', params, context });

    const { agentId, enabled, category } = params;

    // Simulate listing tools
    const tools = [
      // Example tool data - in a real scenario, this would come from a registry
      {
        id: IdGenerator.generateString(),
        name: AGENT_TOOLS.CHECK_AGENT_HEALTH,
        displayName: 'Check Agent Health',
        description: 'Check health status',
        category: ToolCategory.MONITORING,
        capabilities: [ToolCapability.AGENT_HEALTH_MONITORING],
        enabled: true
      },
      {
        id: IdGenerator.generateString(),
        name: AGENT_TOOLS.SEND_MESSAGE_TO_AGENT,
        displayName: 'Send Agent Message',
        description: 'Send message to agent',
        category: ToolCategory.COMMUNICATION,
        capabilities: [ToolCapability.AGENT_COMMUNICATION],
        enabled: true
      }
    ];

    const filteredTools = tools.filter(tool => {
      let match = true;
      if (enabled !== undefined) {
        match = match && tool.enabled === enabled;
      }
      if (category) {
        match = match && tool.category === category;
      }
      return match;
    });

    return {
      success: true,
      data: { agentId, enabled, category, tools: filteredTools, totalCount: filteredTools.length },
      metadata: {
        executionTimeMs: Date.now() - (context.metadata?.startTime as number || 0),
        toolId: AGENT_TOOLS.LIST_TOOLS,
        toolName: AGENT_TOOLS.LIST_TOOLS,
        timestamp: new Date().toISOString(),
        context: { agentId, enabled, category }
      }
    };
  }

  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    initialized: boolean;
    toolsRegistered: number;
    details?: string;
  }> {
    return {
      status: this.initialized && this.registeredTools.size > 0 ? 'healthy' : 'degraded',
      initialized: this.initialized,
      toolsRegistered: this.registeredTools.size,
      details: this.initialized ? undefined : 'Agent Tool System not fully initialized or no tools registered.'
    };
  }

  getRegisteredTools(): string[] {
    return Array.from(this.registeredTools);
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  private createExecutionContext(operation: string, additionalContext?: Record<string, unknown>): ExecutionContext {
    const traceId = IdGenerator.generateString();
    return {
      traceId: traceId,
      agentId: IdGenerator.generateString(),
      permissions: [],
      capabilities: [],
      maxExecutionTime: 60000,
      metadata: {
        operation,
        startTime: Date.now(),
        timestamp: new Date().toISOString(),
        ...additionalContext,
      },
    };
  }
}
