/**
 * AgentIntegrationService.ts - Backward Compatibility Layer for Agent Tool Manager
 * 
 * This service provides backward compatibility for existing agent tool manager calls
 * while seamlessly migrating to the unified foundation execution.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md principles:
 * - ULID for business logic identifiers
 * - Centralized constants (NO string literals)
 * - Dependency injection throughout
 * - Comprehensive error handling with AppError
 * - Structured logging integration
 */

import { IUnifiedToolFoundation } from '../../foundation/interfaces/UnifiedToolFoundationInterface';
import { ExecutionContext, ToolResult, ToolParameters, UnifiedToolDefinition } from '../../foundation/types/FoundationTypes';
import { AGENT_TOOLS } from '../../foundation/constants/ToolConstants';
import { AppError } from '../../../errors/base';
import { IdGenerator, StructuredId } from '../../../../utils/ulid';
import { IStructuredLogger } from '../../../logging/interfaces/IStructuredLogger';
import { Tool } from '../../../../agents/shared/base/managers/ToolManager.interface';
import { ToolCategory, ToolCapability, ToolStatus } from '../../foundation/enums/ToolEnums';

/**
 * Agent Integration Service - Provides backward compatibility and convenience methods
 */
export class AgentIntegrationService {
  private foundation: IUnifiedToolFoundation;
  private logger: IStructuredLogger;

  constructor(
    foundation: IUnifiedToolFoundation,
    logger: IStructuredLogger
  ) {
    this.foundation = foundation;
    this.logger = logger;
  }

  /**
   * Register a new agent in the system
   */
  async registerAgent(agentData: {
    agentId: string;
    agentType: string;
    name: string;
    description?: string;
    capabilities?: string[];
    config?: Record<string, unknown>;
  }): Promise<ToolResult> {
    const context = this.createExecutionContext('registerAgent');

    return await this.foundation.executeTool(
      AGENT_TOOLS.REGISTER_AGENT,
      agentData,
      context
    );
  }

  /**
   * Unregister an agent from the system
   */
  async unregisterAgent(agentId: string, force = false): Promise<ToolResult> {
    const context = this.createExecutionContext('unregisterAgent');

    return await this.foundation.executeTool(
      AGENT_TOOLS.UNREGISTER_AGENT,
      { agentId, force },
      context
    );
  }

  /**
   * Check the health status of an agent
   */
  async checkAgentHealth(agentId: string, includeManagers = true): Promise<ToolResult> {
    const context = this.createExecutionContext('checkAgentHealth');

    return await this.foundation.executeTool(
      AGENT_TOOLS.CHECK_AGENT_HEALTH,
      { agentId, includeManagers },
      context
    );
  }

  /**
   * Get performance metrics for an agent
   */
  async getAgentMetrics(agentId: string, timeRange: '1h' | '24h' | '7d' | '30d' = '24h'): Promise<ToolResult> {
    const context = this.createExecutionContext('getAgentMetrics');

    return await this.foundation.executeTool(
      AGENT_TOOLS.GET_AGENT_METRICS,
      { agentId, timeRange },
      context
    );
  }

  /**
   * Send a message to a specific agent
   */
  async sendMessageToAgent(
    targetAgentId: string,
    message: string,
    priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal',
    expectResponse = false
  ): Promise<ToolResult> {
    const context = this.createExecutionContext('sendMessageToAgent');

    return await this.foundation.executeTool(
      AGENT_TOOLS.SEND_MESSAGE_TO_AGENT,
      { targetAgentId, message, priority, expectResponse },
      context
    );
  }

  /**
   * Broadcast a message to multiple agents
   */
  async broadcastMessage(
    message: string,
    targetAgents?: string[],
    priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'
  ): Promise<ToolResult> {
    const context = this.createExecutionContext('broadcastMessage');

    return await this.foundation.executeTool(
      AGENT_TOOLS.BROADCAST_MESSAGE,
      { message, targetAgents, priority },
      context
    );
  }

  /**
   * Register a tool with an agent's tool manager
   */
  async registerTool(agentId: string, toolDefinition: UnifiedToolDefinition): Promise<ToolResult> {
    const context = this.createExecutionContext('registerTool');

    return await this.foundation.executeTool(
      AGENT_TOOLS.REGISTER_TOOL,
      { agentId, toolDefinition },
      context
    );
  }

  /**
   * Unregister a tool from an agent's tool manager
   */
  async unregisterTool(agentId: string, toolId: string): Promise<ToolResult> {
    const context = this.createExecutionContext('unregisterTool');

    return await this.foundation.executeTool(
      AGENT_TOOLS.UNREGISTER_TOOL,
      { agentId, toolId },
      context
    );
  }

  /**
   * List all tools available to an agent
   */
  async listTools(
    agentId: string,
    enabled = true,
    category?: string
  ): Promise<ToolResult> {
    const context = this.createExecutionContext('listTools');

    return await this.foundation.executeTool(
      AGENT_TOOLS.LIST_TOOLS,
      { agentId, enabled, category },
      context
    );
  }

  /**
   * Execute a tool through an agent's tool manager
   */
  async executeTool(
    agentId: string,
    toolId: string,
    params: ToolParameters,
    options?: {
      context?: unknown;
      timeoutMs?: number;
      retries?: number;
    }
  ): Promise<ToolResult> {
    const context = this.createExecutionContext('executeTool', (options?.context || {}) as Record<string, unknown>);

    return await this.foundation.executeTool(
      AGENT_TOOLS.EXECUTE_TOOL,
      { agentId, toolId, params, options },
      context
    );
  }

  /**
   * Grant permission to an agent
   */
  async grantPermission(
    agentId: string,
    permission: string,
    resource?: string
  ): Promise<ToolResult> {
    const context = this.createExecutionContext('grantPermission');

    return await this.foundation.executeTool(
      AGENT_TOOLS.GRANT_PERMISSION,
      { agentId, permission, resource },
      context
    );
  }

  /**
   * Revoke permission from an agent
   */
  async revokePermission(
    agentId: string,
    permission: string,
    resource?: string
  ): Promise<ToolResult> {
    const context = this.createExecutionContext('revokePermission');

    return await this.foundation.executeTool(
      AGENT_TOOLS.REVOKE_PERMISSION,
      { agentId, permission, resource },
      context
    );
  }

  /**
   * Check if an agent has a specific permission
   */
  async checkPermission(
    agentId: string,
    permission: string,
    resource?: string
  ): Promise<ToolResult> {
    const context = this.createExecutionContext('checkPermission');

    return await this.foundation.executeTool(
      AGENT_TOOLS.CHECK_PERMISSION,
      { agentId, permission, resource },
      context
    );
  }

  /**
   * List all permissions for an agent
   */
  async listPermissions(agentId: string): Promise<ToolResult> {
    const context = this.createExecutionContext('listPermissions');

    return await this.foundation.executeTool(
      AGENT_TOOLS.LIST_PERMISSIONS,
      { agentId },
      context
    );
  }

  /**
   * Get agent capabilities
   */
  async getAgentCapabilities(agentId: string): Promise<ToolResult> {
    const context = this.createExecutionContext('getAgentCapabilities');

    return await this.foundation.executeTool(
      AGENT_TOOLS.GET_AGENT_CAPABILITIES,
      { agentId },
      context
    );
  }

  /**
   * Enable a capability for an agent
   */
  async enableCapability(agentId: string, capability: string): Promise<ToolResult> {
    const context = this.createExecutionContext('enableCapability');

    return await this.foundation.executeTool(
      AGENT_TOOLS.ENABLE_CAPABILITY,
      { agentId, capability },
      context
    );
  }

  /**
   * Disable a capability for an agent
   */
  async disableCapability(agentId: string, capability: string): Promise<ToolResult> {
    const context = this.createExecutionContext('disableCapability');

    return await this.foundation.executeTool(
      AGENT_TOOLS.DISABLE_CAPABILITY,
      { agentId, capability },
      context
    );
  }

  /**
   * Coordinate multiple agents for a complex task
   */
  async coordinateAgents(
    coordinatorAgentId: string,
    participantAgentIds: string[],
    task: string,
    coordination: {
      strategy?: 'sequential' | 'parallel' | 'hierarchical';
      timeout?: number;
      retries?: number;
    } = {}
  ): Promise<ToolResult> {
    const context = this.createExecutionContext('coordinateAgents', {
      coordinatorAgentId,
      participantAgentIds,
      task,
      ...coordination,
    });

    return await this.foundation.executeTool(
      AGENT_TOOLS.COORDINATE_AGENTS,
      { coordinatorAgentId, participantAgentIds, task, coordination },
      context
    );
  }

  /**
   * Monitor an agent's activities
   */
  async monitorAgent(
    agentId: string,
    monitoringOptions: {
      duration?: number;
      metrics?: string[];
      alertThresholds?: Record<string, number>;
    } = {}
  ): Promise<ToolResult> {
    const context = this.createExecutionContext('monitorAgent', { agentId, ...monitoringOptions });

    return await this.foundation.executeTool(
      AGENT_TOOLS.MONITOR_AGENT,
      { agentId, monitoringOptions },
      context
    );
  }

  /**
   * Discover available tools by capability
   */
  async discoverToolsByCapability(capability: ToolCapability): Promise<ToolResult> {
    const context = this.createExecutionContext('discoverToolsByCapability');

    try {
      const discoveredTools = await this.foundation.discoverTools({
        capabilities: [capability],
        enabledOnly: true, // Only discover enabled tools
        discoveryMethod: 'CAPABILITY_MATCH',
      });

      this.logger.info('Successfully discovered tools by capability', {
        system: 'agent-tools',
        operation: 'discoverToolsByCapability',
        capability: capability,
        toolCount: discoveredTools.length,
        tools: discoveredTools.map(tool => tool.name)
      });

      return {
        success: true,
        data: discoveredTools,
        toolId: AGENT_TOOLS.DISCOVER_TOOLS_BY_CAPABILITY,
        durationMs: 0,
        startedAt: new Date(),
        metadata: {
          toolId: AGENT_TOOLS.DISCOVER_TOOLS_BY_CAPABILITY,
          toolName: AGENT_TOOLS.DISCOVER_TOOLS_BY_CAPABILITY,
          executionTimeMs: 0,
          timestamp: new Date().toISOString(),
          context: { capability },
        },
      };
    } catch (error) {
      this.logger.error('Failed to discover tools by capability', {
        system: 'agent-tools',
        operation: 'discoverToolsByCapability',
        capability: capability,
        error: error instanceof Error ? error.message : String(error)
      });

      throw new AppError(
        `Failed to discover tools by capability ${capability}: ${error instanceof Error ? error.message : String(error)}`,
        'ToolDiscoveryError',
        {
          toolId: AGENT_TOOLS.DISCOVER_TOOLS_BY_CAPABILITY,
          originalError: error instanceof Error ? error.message : String(error),
          context: { capability },
        }
      );
    }
  }

  /**
   * Execute a chain of tools through agents
   */
  async executeToolChain(
    agentIds: string[],
    toolChain: Array<{
      toolName: string;
      params: ToolParameters;
      agentId?: string;
    }>,
    options?: {
      context?: Record<string, unknown>;
      strategy?: 'sequential' | 'parallel';
      continueOnError?: boolean;
      timeout?: number;
    }
  ): Promise<ToolResult> {
    const context = this.createExecutionContext('executeToolChain', (options?.context || {}));

    try {
      const results = await this.foundation.executeToolChain(
        toolChain.map(tc => ({ identifier: tc.toolName, params: tc.params })),
        context
      );

      this.logger.info('Successfully executed tool chain', {
        system: 'agent-tools',
        operation: 'executeToolChain',
        agentIds,
        toolChain: toolChain.map(tc => tc.toolName),
        results: results.map(r => r.success ? r.metadata?.toolId : `Error: ${r.error || 'Unknown error'}`)
      });

      return {
        success: true,
        data: results,
        toolId: AGENT_TOOLS.EXECUTE_TOOL_CHAIN,
        durationMs: Date.now() - (context.metadata?.startTime as number || 0),
        startedAt: new Date(),
        metadata: {
          toolId: AGENT_TOOLS.EXECUTE_TOOL_CHAIN,
          toolName: AGENT_TOOLS.EXECUTE_TOOL_CHAIN,
          executionTimeMs: Date.now() - (context.metadata?.startTime as number || 0),
          timestamp: new Date().toISOString(),
          context: { agentIds, toolChain: toolChain.map(tc => tc.toolName), ...(options?.context || {}) },
        }
      };
    } catch (error) {
      this.logger.error('Failed to execute tool chain', {
        system: 'agent-tools',
        operation: 'executeToolChain',
        agentIds,
        toolChain: toolChain.map(tc => tc.toolName),
        error: error instanceof Error ? error.message : String(error)
      });

      throw new AppError(
        `Failed to execute tool chain: ${error instanceof Error ? error.message : String(error)}`,
        'ToolExecutionError',
        {
          toolId: AGENT_TOOLS.EXECUTE_TOOL_CHAIN,
          originalError: error instanceof Error ? error.message : String(error),
          context: { agentIds, toolChain: toolChain.map(tc => tc.toolName) },
        }
      );
    }
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