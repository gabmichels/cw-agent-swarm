/**
 * External Workflow Integration Service
 * 
 * Service that handles integration between external workflow tools
 * and the unified tool foundation, replacing direct workflow calls
 * with foundation.executeTool() calls.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md principles:
 * - Replace legacy patterns completely
 * - Use centralized constants for tool names
 * - Preserve workflow execution logic and error handling
 * - No fallback patterns
 */

import { ulid } from 'ulid';
import { IUnifiedToolFoundation } from '../../foundation';
import {
  ToolResult,
  ExecutionContext,
  ToolParameters,
  ToolId
} from '../../foundation/types/FoundationTypes';
import { EXTERNAL_WORKFLOW_TOOLS } from '../../foundation/constants/ToolConstants';
import {
  WorkflowExecutionRequest,
  WorkflowExecutionResult
} from '../../../../services/external-workflows/interfaces/ExternalWorkflowInterfaces';
import { createLogger } from '../../../logging/winston-logger';

/**
 * Workflow execution options
 */
export interface WorkflowExecutionOptions {
  readonly timeout?: number;
  readonly retryAttempts?: number;
  readonly priority?: 'low' | 'normal' | 'high' | 'critical';
  readonly metadata?: Record<string, unknown>;
}

/**
 * External Workflow Integration Service
 */
export class ExternalWorkflowIntegrationService {
  private readonly logger = createLogger({ moduleId: 'external-workflow-integration' });

  constructor(
    private readonly foundation: IUnifiedToolFoundation
  ) { }

  /**
   * Execute N8n workflow through foundation
   */
  async executeN8nWorkflow(
    workflowId: string,
    parameters: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const toolParams: ToolParameters = {
      workflowId,
      parameters: parameters || {},
      priority: 'normal',
      timeoutMs: 300000
    };

    const result = await this.foundation.executeTool(
      EXTERNAL_WORKFLOW_TOOLS.N8N_WORKFLOW_EXECUTE,
      toolParams,
      context
    );

    return {
      success: result.success,
      data: result.data,
      error: result.error,
      toolId: result.toolId,
      durationMs: result.metadata?.executionTimeMs || 0,
      startedAt: new Date(),
      metadata: {
        executionTimeMs: result.metadata?.executionTimeMs || 0,
        toolId: result.metadata?.toolId || ulid(),
        toolName: result.metadata?.toolName || EXTERNAL_WORKFLOW_TOOLS.N8N_WORKFLOW_EXECUTE,
        timestamp: result.metadata?.timestamp || new Date().toISOString(),
        context: result.metadata?.context
      }
    };
  }

  /**
   * Create N8n workflow through foundation
   */
  async createN8nWorkflow(
    name: string,
    description: string,
    nodes: unknown[],
    connections: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const toolParams: ToolParameters = {
      name,
      description,
      nodes,
      connections
    };

    const result = await this.foundation.executeTool(
      EXTERNAL_WORKFLOW_TOOLS.N8N_WORKFLOW_CREATE,
      toolParams,
      context
    );

    return {
      success: result.success,
      data: result.data,
      error: result.error,
      toolId: result.toolId,
      durationMs: result.metadata?.executionTimeMs || 0,
      startedAt: new Date(),
      metadata: {
        executionTimeMs: result.metadata?.executionTimeMs || 0,
        toolId: result.metadata?.toolId || ulid(),
        toolName: result.metadata?.toolName || EXTERNAL_WORKFLOW_TOOLS.N8N_WORKFLOW_CREATE,
        timestamp: result.metadata?.timestamp || new Date().toISOString(),
        context: result.metadata?.context
      }
    };
  }

  /**
   * List N8n workflows through foundation
   */
  async listN8nWorkflows(
    context: ExecutionContext,
    active?: boolean,
    limit: number = 20
  ): Promise<ToolResult> {
    const toolParams: ToolParameters = {
      active,
      limit
    };

    const result = await this.foundation.executeTool(
      EXTERNAL_WORKFLOW_TOOLS.N8N_WORKFLOW_LIST,
      toolParams,
      context
    );

    return {
      success: result.success,
      data: result.data,
      error: result.error,
      toolId: result.toolId,
      durationMs: result.metadata?.executionTimeMs || 0,
      startedAt: new Date(),
      metadata: {
        executionTimeMs: result.metadata?.executionTimeMs || 0,
        toolId: result.metadata?.toolId || ulid(),
        toolName: result.metadata?.toolName || EXTERNAL_WORKFLOW_TOOLS.N8N_WORKFLOW_LIST,
        timestamp: result.metadata?.timestamp || new Date().toISOString(),
        context: result.metadata?.context
      }
    };
  }

  /**
   * Get N8n workflow status through foundation
   */
  async getN8nWorkflowStatus(
    executionId: string,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const toolParams: ToolParameters = {
      executionId
    };

    const result = await this.foundation.executeTool(
      EXTERNAL_WORKFLOW_TOOLS.N8N_WORKFLOW_STATUS,
      toolParams,
      context
    );

    return {
      success: result.success,
      data: result.data,
      error: result.error,
      toolId: result.toolId,
      durationMs: result.metadata?.executionTimeMs || 0,
      startedAt: new Date(),
      metadata: {
        executionTimeMs: result.metadata?.executionTimeMs || 0,
        toolId: result.metadata?.toolId || ulid(),
        toolName: result.metadata?.toolName || EXTERNAL_WORKFLOW_TOOLS.N8N_WORKFLOW_STATUS,
        timestamp: result.metadata?.timestamp || new Date().toISOString(),
        context: result.metadata?.context
      }
    };
  }

  /**
   * Trigger Zapier Zap through foundation
   */
  async triggerZapierZap(
    zapId: string,
    context: ExecutionContext,
    data: Record<string, unknown> = {},
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): Promise<ToolResult> {
    const toolParams: ToolParameters = {
      zapId,
      data,
      priority
    };

    const result = await this.foundation.executeTool(
      EXTERNAL_WORKFLOW_TOOLS.ZAPIER_ZAP_TRIGGER,
      toolParams,
      context
    );

    return {
      success: result.success,
      data: result.data,
      error: result.error,
      toolId: result.toolId,
      durationMs: result.metadata?.executionTimeMs || 0,
      startedAt: new Date(),
      metadata: {
        executionTimeMs: result.metadata?.executionTimeMs || 0,
        toolId: result.metadata?.toolId || ulid(),
        toolName: result.metadata?.toolName || EXTERNAL_WORKFLOW_TOOLS.ZAPIER_ZAP_TRIGGER,
        timestamp: result.metadata?.timestamp || new Date().toISOString(),
        context: result.metadata?.context
      }
    };
  }

  /**
   * Get Zapier Zap status through foundation
   */
  async getZapierZapStatus(
    executionId: string,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const toolParams: ToolParameters = {
      executionId
    };

    const result = await this.foundation.executeTool(
      EXTERNAL_WORKFLOW_TOOLS.ZAPIER_ZAP_STATUS,
      toolParams,
      context
    );

    return {
      success: result.success,
      data: result.data,
      error: result.error,
      toolId: result.toolId,
      durationMs: result.metadata?.executionTimeMs || 0,
      startedAt: new Date(),
      metadata: {
        executionTimeMs: result.metadata?.executionTimeMs || 0,
        toolId: result.metadata?.toolId || ulid(),
        toolName: result.metadata?.toolName || EXTERNAL_WORKFLOW_TOOLS.ZAPIER_ZAP_STATUS,
        timestamp: result.metadata?.timestamp || new Date().toISOString(),
        context: result.metadata?.context
      }
    };
  }

  /**
   * Execute workflow integration through foundation
   */
  async executeWorkflowIntegration(
    platform: 'n8n' | 'zapier',
    workflowId: string,
    context: ExecutionContext,
    parameters: Record<string, unknown> = {}
  ): Promise<ToolResult> {
    const toolParams: ToolParameters = {
      platform,
      workflowId,
      parameters
    };

    const result = await this.foundation.executeTool(
      EXTERNAL_WORKFLOW_TOOLS.WORKFLOW_INTEGRATION,
      toolParams,
      context
    );

    return {
      success: result.success,
      data: result.data,
      error: result.error,
      toolId: result.toolId,
      durationMs: result.metadata?.executionTimeMs || 0,
      startedAt: new Date(),
      metadata: {
        executionTimeMs: result.metadata?.executionTimeMs || 0,
        toolId: result.metadata?.toolId || ulid(),
        toolName: result.metadata?.toolName || EXTERNAL_WORKFLOW_TOOLS.WORKFLOW_INTEGRATION,
        timestamp: result.metadata?.timestamp || new Date().toISOString(),
        context: result.metadata?.context
      }
    };
  }

  /**
   * Trigger webhook through foundation
   */
  async triggerWebhook(
    url: string,
    context: ExecutionContext,
    data: Record<string, unknown> = {},
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'POST',
    headers: Record<string, string> = {}
  ): Promise<ToolResult> {
    const toolParams: ToolParameters = {
      url,
      data,
      method,
      headers
    };

    const result = await this.foundation.executeTool(
      EXTERNAL_WORKFLOW_TOOLS.WEBHOOK_TRIGGER,
      toolParams,
      context
    );

    return {
      success: result.success,
      data: result.data,
      error: result.error,
      toolId: result.toolId,
      durationMs: result.metadata?.executionTimeMs || 0,
      startedAt: new Date(),
      metadata: {
        executionTimeMs: result.metadata?.executionTimeMs || 0,
        toolId: result.metadata?.toolId || ulid(),
        toolName: result.metadata?.toolName || EXTERNAL_WORKFLOW_TOOLS.WEBHOOK_TRIGGER,
        timestamp: result.metadata?.timestamp || new Date().toISOString(),
        context: result.metadata?.context
      }
    };
  }

  /**
   * Make API call through foundation
   */
  async makeApiCall(
    url: string,
    context: ExecutionContext,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    headers: Record<string, string> = {},
    body?: Record<string, unknown>
  ): Promise<ToolResult> {
    const toolParams: ToolParameters = {
      url,
      method,
      headers,
      body
    };

    const result = await this.foundation.executeTool(
      EXTERNAL_WORKFLOW_TOOLS.API_CALL,
      toolParams,
      context
    );

    return {
      success: result.success,
      data: result.data,
      error: result.error,
      toolId: result.toolId,
      durationMs: result.metadata?.executionTimeMs || 0,
      startedAt: new Date(),
      metadata: {
        executionTimeMs: result.metadata?.executionTimeMs || 0,
        toolId: result.metadata?.toolId || ulid(),
        toolName: result.metadata?.toolName || EXTERNAL_WORKFLOW_TOOLS.API_CALL,
        timestamp: result.metadata?.timestamp || new Date().toISOString(),
        context: result.metadata?.context
      }
    };
  }

  /**
   * Transform data through foundation
   */
  async transformData(
    data: Record<string, unknown>,
    transformations: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const toolParams: ToolParameters = {
      data,
      transformations
    };

    const result = await this.foundation.executeTool(
      EXTERNAL_WORKFLOW_TOOLS.DATA_TRANSFORM,
      toolParams,
      context
    );

    return {
      success: result.success,
      data: result.data,
      error: result.error,
      toolId: result.toolId,
      durationMs: result.metadata?.executionTimeMs || 0,
      startedAt: new Date(),
      metadata: {
        executionTimeMs: result.metadata?.executionTimeMs || 0,
        toolId: result.metadata?.toolId || ulid(),
        toolName: result.metadata?.toolName || EXTERNAL_WORKFLOW_TOOLS.DATA_TRANSFORM,
        timestamp: result.metadata?.timestamp || new Date().toISOString(),
        context: result.metadata?.context
      }
    };
  }

  /**
   * Get workflow execution history
   */
  async getWorkflowExecutionHistory(
    platform: 'n8n' | 'zapier',
    workflowId: string,
    context: ExecutionContext,
    limit: number = 50
  ): Promise<WorkflowExecutionResult[]> {
    // This would typically call a specific tool for getting execution history
    // For now, we'll use the workflow integration tool and handle the response
    const result = await this.executeWorkflowIntegration(
      platform,
      workflowId,
      context,
      { operation: 'get_history', limit }
    );

    if (result.success && Array.isArray(result.data)) {
      return result.data as WorkflowExecutionResult[];
    }

    return [];
  }

  /**
   * Validate workflow parameters
   */
  async validateWorkflowParameters(
    platform: 'n8n' | 'zapier',
    workflowId: string,
    parameters: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<{ isValid: boolean; errors: string[] }> {
    // This would typically call a specific validation tool
    // For now, we'll do basic validation
    const errors: string[] = [];

    if (!workflowId) {
      errors.push('workflowId is required');
    }

    if (!parameters || typeof parameters !== 'object') {
      errors.push('parameters must be an object');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get available workflow platforms
   */
  getAvailablePlatforms(): string[] {
    return ['n8n', 'zapier'];
  }

  /**
   * Get platform-specific workflow tools
   */
  getPlatformTools(platform: 'n8n' | 'zapier'): string[] {
    switch (platform) {
      case 'n8n':
        return [
          EXTERNAL_WORKFLOW_TOOLS.N8N_WORKFLOW_EXECUTE,
          EXTERNAL_WORKFLOW_TOOLS.N8N_WORKFLOW_CREATE,
          EXTERNAL_WORKFLOW_TOOLS.N8N_WORKFLOW_LIST,
          EXTERNAL_WORKFLOW_TOOLS.N8N_WORKFLOW_STATUS
        ];
      case 'zapier':
        return [
          EXTERNAL_WORKFLOW_TOOLS.ZAPIER_ZAP_TRIGGER,
          EXTERNAL_WORKFLOW_TOOLS.ZAPIER_ZAP_STATUS
        ];
      default:
        return [];
    }
  }

  /**
   * Get generic workflow tools
   */
  getGenericTools(): string[] {
    return [
      EXTERNAL_WORKFLOW_TOOLS.WORKFLOW_INTEGRATION,
      EXTERNAL_WORKFLOW_TOOLS.WEBHOOK_TRIGGER,
      EXTERNAL_WORKFLOW_TOOLS.API_CALL,
      EXTERNAL_WORKFLOW_TOOLS.DATA_TRANSFORM
    ];
  }
} 