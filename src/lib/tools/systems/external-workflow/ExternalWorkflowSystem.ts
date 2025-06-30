/**
 * External Workflow System Integration
 * 
 * Integrates N8n and Zapier workflow tools with the Unified Tool Foundation
 * while preserving workflow execution logic and error handling.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md principles:
 * - ULID for business logic, UUID for database layer
 * - Strict typing throughout
 * - Dependency injection
 * - No string literals (use constants)
 * - Preserve domain expertise
 */

import { ulid } from 'ulid';
import { IUnifiedToolFoundation } from '../../foundation';
import {
  UnifiedToolDefinition,
  ToolResult,
  ExecutionContext,
  ToolParameters,
  ToolRegistrationResult,
  ToolId
} from '../../foundation/types/FoundationTypes';
import { ToolCategory, ToolCapability, ToolStatus } from '../../foundation/enums/ToolEnums';
import { EXTERNAL_WORKFLOW_TOOLS } from '../../foundation/constants/ToolConstants';
import { N8nService, N8nServiceConfig } from '../../../../services/external-workflows/N8nService';
import { ZapierService, ZapierServiceConfig } from '../../../../services/external-workflows/ZapierService';
import {
  WorkflowExecutionRequest,
  WorkflowExecutionResult
} from '../../../../services/external-workflows/interfaces/ExternalWorkflowInterfaces';
import { createLogger } from '../../../logging/winston-logger';

/**
 * External workflow system configuration
 */
export interface ExternalWorkflowSystemConfig {
  readonly n8nConfig: N8nServiceConfig;
  readonly zapierConfig: ZapierServiceConfig;
}

/**
 * External workflow system for unified tools foundation
 * Manages N8n, Zapier, and generic workflow tools
 */
export class ExternalWorkflowSystem {
  private readonly logger = createLogger({ moduleId: 'external-workflow-system' });
  private readonly foundation: IUnifiedToolFoundation;
  private readonly n8nService: N8nService;
  private readonly zapierService: ZapierService;
  private readonly registeredTools = new Map<string, string>();

  constructor(
    foundation: IUnifiedToolFoundation,
    config: ExternalWorkflowSystemConfig
  ) {
    this.foundation = foundation;

    // Create N8n service with proper configuration
    this.n8nService = new N8nService(config.n8nConfig);

    // Create Zapier service with proper configuration
    this.zapierService = new ZapierService(config.zapierConfig);
  }

  /**
   * Initialize the external workflow system
   */
  async initialize(): Promise<void> {
    await this.registerN8nTools();
    await this.registerZapierTools();
    await this.registerGenericWorkflowTools();
  }

  /**
   * Register N8n workflow tools
   */
  private async registerN8nTools(): Promise<void> {
    // N8n workflow execute tool
    const n8nExecuteTool: UnifiedToolDefinition = {
      id: ulid(),
      name: EXTERNAL_WORKFLOW_TOOLS.N8N_WORKFLOW_EXECUTE,
      displayName: 'Execute N8n Workflow',
      description: 'Execute a workflow on N8n platform with parameters',
      category: ToolCategory.WORKFLOW,
      capabilities: [ToolCapability.N8N_WORKFLOW_EXECUTE],
      parameters: {
        type: 'object',
        properties: {
          workflowId: {
            type: 'string',
            description: 'N8n workflow ID to execute'
          },
          parameters: {
            type: 'object',
            description: 'Parameters to pass to the workflow'
          },
          priority: {
            type: 'string',
            description: 'Execution priority level',
            default: 'normal',
            validation: {
              enum: ['low', 'normal', 'high']
            }
          },
          timeoutMs: {
            type: 'number',
            description: 'Execution timeout in milliseconds',
            default: 300000,
            validation: {
              min: 1000
            }
          }
        },
        required: ['workflowId']
      },
      executor: this.executeN8nWorkflow.bind(this),
      metadata: {
        version: '1.0.0',
        author: 'External Workflow System',
        provider: 'n8n',
        tags: ['workflow', 'automation', 'n8n'],
        timeout: 300000
      },
      enabled: true,
      status: ToolStatus.ACTIVE
    };

    const toolId = await this.foundation.registerTool(n8nExecuteTool);
    if (typeof toolId === 'string') {
      this.registeredTools.set(n8nExecuteTool.name, toolId);
    } else {
      this.registeredTools.set(n8nExecuteTool.name, toolId.toolId);
    }

    // N8n workflow create tool
    const n8nCreateTool: UnifiedToolDefinition = {
      id: ulid(),
      name: EXTERNAL_WORKFLOW_TOOLS.N8N_WORKFLOW_CREATE,
      displayName: 'Create N8n Workflow',
      description: 'Create a new workflow on N8n platform',
      category: ToolCategory.WORKFLOW,
      capabilities: [ToolCapability.N8N_WORKFLOW_CREATE],
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Workflow name'
          },
          description: {
            type: 'string',
            description: 'Workflow description'
          },
          nodes: {
            type: 'array',
            description: 'Workflow nodes configuration'
          },
          connections: {
            type: 'object',
            description: 'Node connections configuration'
          }
        },
        required: ['name', 'nodes']
      },
      executor: this.createN8nWorkflow.bind(this),
      metadata: {
        version: '1.0.0',
        author: 'External Workflow System',
        provider: 'n8n',
        tags: ['workflow', 'creation', 'n8n']
      },
      enabled: true,
      status: ToolStatus.ACTIVE
    };

    const createToolId = await this.foundation.registerTool(n8nCreateTool);
    if (typeof createToolId === 'string') {
      this.registeredTools.set(n8nCreateTool.name, createToolId);
    } else {
      this.registeredTools.set(n8nCreateTool.name, createToolId.toolId);
    }
  }

  /**
   * Register Zapier workflow tools
   */
  private async registerZapierTools(): Promise<void> {
    const zapierTriggerTool: UnifiedToolDefinition = {
      id: ulid(),
      name: EXTERNAL_WORKFLOW_TOOLS.ZAPIER_ZAP_TRIGGER,
      displayName: 'Trigger Zapier Zap',
      description: 'Trigger a Zapier Zap with data payload',
      category: ToolCategory.WORKFLOW,
      capabilities: [ToolCapability.ZAPIER_ZAP_TRIGGER],
      parameters: {
        type: 'object',
        properties: {
          zapId: {
            type: 'string',
            description: 'Zapier Zap ID to trigger'
          },
          data: {
            type: 'object',
            description: 'Data payload to send to the Zap'
          },
          priority: {
            type: 'string',
            description: 'Execution priority level',
            default: 'normal',
            validation: {
              enum: ['low', 'normal', 'high']
            }
          }
        },
        required: ['zapId']
      },
      executor: this.triggerZapierZap.bind(this),
      metadata: {
        version: '1.0.0',
        author: 'External Workflow System',
        provider: 'zapier',
        tags: ['workflow', 'automation', 'zapier']
      },
      enabled: true,
      status: ToolStatus.ACTIVE
    };

    const toolId = await this.foundation.registerTool(zapierTriggerTool);
    if (typeof toolId === 'string') {
      this.registeredTools.set(zapierTriggerTool.name, toolId);
    } else {
      this.registeredTools.set(zapierTriggerTool.name, toolId.toolId);
    }
  }

  /**
   * Register generic workflow tools
   */
  private async registerGenericWorkflowTools(): Promise<void> {
    const workflowIntegrationTool: UnifiedToolDefinition = {
      id: ulid(),
      name: EXTERNAL_WORKFLOW_TOOLS.WORKFLOW_INTEGRATION,
      displayName: 'Workflow Integration',
      description: 'Generic workflow integration for multiple platforms',
      category: ToolCategory.WORKFLOW,
      capabilities: [ToolCapability.WORKFLOW_AUTOMATION],
      parameters: {
        type: 'object',
        properties: {
          platform: {
            type: 'string',
            description: 'Workflow platform to use',
            validation: {
              enum: ['n8n', 'zapier']
            }
          },
          workflowId: {
            type: 'string',
            description: 'Workflow identifier'
          },
          parameters: {
            type: 'object',
            description: 'Workflow parameters'
          }
        },
        required: ['platform', 'workflowId']
      },
      executor: this.executeWorkflowIntegration.bind(this),
      metadata: {
        version: '1.0.0',
        author: 'External Workflow System',
        provider: 'generic',
        tags: ['workflow', 'integration', 'multi-platform']
      },
      enabled: true,
      status: ToolStatus.ACTIVE
    };

    // API call tool
    const apiCallTool: UnifiedToolDefinition = {
      id: ulid(),
      name: EXTERNAL_WORKFLOW_TOOLS.API_CALL,
      displayName: 'API Call',
      description: 'Make HTTP API calls as part of workflow automation',
      category: ToolCategory.WORKFLOW,
      capabilities: [ToolCapability.EXTERNAL_API_INTEGRATION],
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'API endpoint URL'
          },
          method: {
            type: 'string',
            description: 'HTTP method',
            default: 'GET',
            validation: {
              enum: ['GET', 'POST', 'PUT', 'DELETE']
            }
          },
          headers: {
            type: 'object',
            description: 'HTTP headers'
          },
          body: {
            type: 'object',
            description: 'Request body data'
          }
        },
        required: ['url']
      },
      executor: this.executeApiCall.bind(this),
      metadata: {
        version: '1.0.0',
        author: 'External Workflow System',
        provider: 'generic',
        tags: ['api', 'http', 'integration']
      },
      enabled: true,
      status: ToolStatus.ACTIVE
    };

    const integrationToolId = await this.foundation.registerTool(workflowIntegrationTool);
    if (typeof integrationToolId === 'string') {
      this.registeredTools.set(workflowIntegrationTool.name, integrationToolId);
    } else {
      this.registeredTools.set(workflowIntegrationTool.name, integrationToolId.toolId);
    }

    const apiToolId = await this.foundation.registerTool(apiCallTool);
    if (typeof apiToolId === 'string') {
      this.registeredTools.set(apiCallTool.name, apiToolId);
    } else {
      this.registeredTools.set(apiCallTool.name, apiToolId.toolId);
    }
  }

  /**
   * Execute N8n workflow
   */
  private async executeN8nWorkflow(
    params: ToolParameters,
    context: ExecutionContext
  ): Promise<ToolResult> {
    try {
      if (!params.workflowId || typeof params.workflowId !== 'string') {
        return {
          success: false,
          error: 'workflowId is required and must be a string'
        };
      }

      const priority = (params.priority as 'low' | 'normal' | 'high') || 'normal';

      const request: WorkflowExecutionRequest = {
        workflowId: params.workflowId,
        parameters: (params.parameters as Record<string, unknown>) || {},
        initiatedBy: {
          type: 'agent',
          id: context.agentId || 'unknown',
          name: context.agentId || 'Unknown Agent'
        },
        sessionId: context.sessionId,
        priority,
        timeoutMs: (params.timeoutMs as number) || 300000
      };

      const result = await this.n8nService.executeWorkflow(request);

      return {
        success: true,
        data: result,
        metadata: {
          executionTimeMs: result.durationMs || 0,
          toolId: ulid(),
          toolName: EXTERNAL_WORKFLOW_TOOLS.N8N_WORKFLOW_EXECUTE,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Create N8n workflow
   */
  private async createN8nWorkflow(
    params: ToolParameters,
    context: ExecutionContext
  ): Promise<ToolResult> {
    try {
      // Note: N8nService doesn't have createWorkflow method in the current implementation
      // This is a placeholder for future implementation
      return {
        success: false,
        error: 'N8n workflow creation not yet implemented'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * List N8n workflows
   */
  private async listN8nWorkflows(
    params: ToolParameters,
    context: ExecutionContext
  ): Promise<ToolResult> {
    try {
      // Note: N8nService doesn't have listWorkflows method in the current implementation
      // This is a placeholder for future implementation
      return {
        success: false,
        error: 'N8n workflow listing not yet implemented'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get N8n workflow status
   */
  private async getN8nWorkflowStatus(
    params: ToolParameters,
    context: ExecutionContext
  ): Promise<ToolResult> {
    try {
      if (!params.executionId || typeof params.executionId !== 'string') {
        return {
          success: false,
          error: 'executionId is required and must be a string'
        };
      }

      const result = await this.n8nService.getExecutionStatus(params.executionId);

      return {
        success: true,
        data: result,
        metadata: {
          executionTimeMs: 0,
          toolId: ulid(),
          toolName: EXTERNAL_WORKFLOW_TOOLS.N8N_WORKFLOW_STATUS,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Trigger Zapier Zap
   */
  private async triggerZapierZap(
    params: ToolParameters,
    context: ExecutionContext
  ): Promise<ToolResult> {
    try {
      if (!params.zapId || typeof params.zapId !== 'string') {
        return {
          success: false,
          error: 'zapId is required and must be a string'
        };
      }

      const priority = (params.priority as 'low' | 'normal' | 'high') || 'normal';

      const request: WorkflowExecutionRequest = {
        workflowId: params.zapId,
        parameters: (params.data as Record<string, unknown>) || {},
        initiatedBy: {
          type: 'agent',
          id: context.agentId || 'unknown',
          name: context.agentId || 'Unknown Agent'
        },
        sessionId: context.sessionId,
        priority,
        timeoutMs: 300000
      };

      const result = await this.zapierService.executeWorkflow(request);

      return {
        success: true,
        data: result,
        metadata: {
          executionTimeMs: result.durationMs || 0,
          toolId: ulid(),
          toolName: EXTERNAL_WORKFLOW_TOOLS.ZAPIER_ZAP_TRIGGER,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get Zapier Zap status
   */
  private async getZapierZapStatus(
    params: ToolParameters,
    context: ExecutionContext
  ): Promise<ToolResult> {
    try {
      if (!params.executionId || typeof params.executionId !== 'string') {
        return {
          success: false,
          error: 'executionId is required and must be a string'
        };
      }

      const result = await this.zapierService.getExecutionStatus(params.executionId);

      return {
        success: true,
        data: result,
        metadata: {
          executionTimeMs: 0,
          toolId: ulid(),
          toolName: EXTERNAL_WORKFLOW_TOOLS.ZAPIER_ZAP_STATUS,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Execute workflow integration
   */
  private async executeWorkflowIntegration(
    params: ToolParameters,
    context: ExecutionContext
  ): Promise<ToolResult> {
    try {
      const platform = params.platform as string;
      const workflowId = params.workflowId as string;
      const parameters = (params.parameters as Record<string, unknown>) || {};

      if (!platform || !workflowId) {
        return {
          success: false,
          error: 'platform and workflowId are required'
        };
      }

      const request: WorkflowExecutionRequest = {
        workflowId,
        parameters,
        initiatedBy: {
          type: 'agent',
          id: context.agentId || 'unknown',
          name: context.agentId || 'Unknown Agent'
        },
        sessionId: context.sessionId,
        priority: 'normal',
        timeoutMs: 300000
      };

      let result: WorkflowExecutionResult;

      switch (platform) {
        case 'n8n':
          result = await this.n8nService.executeWorkflow(request);
          break;
        case 'zapier':
          result = await this.zapierService.executeWorkflow(request);
          break;
        default:
          return {
            success: false,
            error: `Unsupported platform: ${platform}`
          };
      }

      return {
        success: true,
        data: result,
        metadata: {
          executionTimeMs: result.durationMs || 0,
          toolId: ulid(),
          toolName: EXTERNAL_WORKFLOW_TOOLS.WORKFLOW_INTEGRATION,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Execute API call
   */
  private async executeApiCall(
    params: ToolParameters,
    context: ExecutionContext
  ): Promise<ToolResult> {
    try {
      const url = params.url as string;
      const method = (params.method as string) || 'GET';
      const headers = (params.headers as Record<string, string>) || {};
      const body = params.body;

      if (!url) {
        return {
          success: false,
          error: 'url is required'
        };
      }

      // Simple API call implementation with proper typing
      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      if (body) {
        fetchOptions.body = JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);
      const data = await response.json();

      return {
        success: response.ok,
        data,
        metadata: {
          executionTimeMs: 0,
          toolId: ulid(),
          toolName: EXTERNAL_WORKFLOW_TOOLS.API_CALL,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get registered tools
   */
  getRegisteredTools(): ReadonlyMap<string, string> {
    return this.registeredTools;
  }

  /**
   * Get system health status
   */
  async getHealthStatus(): Promise<{
    n8n: boolean;
    zapier: boolean;
    overall: boolean;
  }> {
    try {
      const [n8nHealth, zapierHealth] = await Promise.allSettled([
        this.n8nService.testConnection(),
        this.zapierService.testConnection()
      ]);

      const n8nHealthy = n8nHealth.status === 'fulfilled' && n8nHealth.value;
      const zapierHealthy = zapierHealth.status === 'fulfilled' && zapierHealth.value;

      return {
        n8n: n8nHealthy,
        zapier: zapierHealthy,
        overall: n8nHealthy && zapierHealthy
      };
    } catch (error) {
      return {
        n8n: false,
        zapier: false,
        overall: false
      };
    }
  }

  /**
   * Cleanup system resources
   */
  async cleanup(): Promise<void> {
    // Cleanup any resources if needed
    // For now, just clear the registered tools map
    this.registeredTools.clear();
  }
} 