/**
 * Approval System - Unified Foundation Integration
 */

import {
  IUnifiedToolFoundation,
  UnifiedToolDefinition,
  ToolCategory,
  ToolCapability,
  ToolStatus,
  APPROVAL_SYSTEM_TOOLS,
  ToolResult,
  ToolParameters,
  ExecutionContext
} from '../../foundation';
import { logger } from '../../../../lib/logging';
import { ulid } from 'ulid';

export interface ApprovalSystemConfig {
  enableRuleBasedApproval: boolean;
  enableWorkflowApproval: boolean;
  enableApprovalNotifications: boolean;
}

export class ApprovalSystem {
  private foundation: IUnifiedToolFoundation | null = null;
  private readonly config: ApprovalSystemConfig;

  constructor(config: ApprovalSystemConfig) {
    this.config = config;
  }

  async initialize(foundation: IUnifiedToolFoundation): Promise<void> {
    this.foundation = foundation;

    try {
      await this.registerApprovalTools();

      logger.info('Approval system initialized successfully', {
        toolsRegistered: this.getApprovalToolCount()
      });
    } catch (error) {
      logger.error('Failed to initialize approval system', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private async registerApprovalTools(): Promise<void> {
    if (!this.foundation) {
      throw new Error('Foundation not initialized');
    }

    const toolDefinitions = this.createApprovalToolDefinitions();

    for (const toolDef of toolDefinitions) {
      await this.foundation.registerTool(toolDef);
    }
  }

  private createApprovalToolDefinitions(): UnifiedToolDefinition[] {
    return [
      this.createRequestApprovalTool(),
      this.createApproveTaskTool(),
      this.createRejectTaskTool(),
      ...this.createPlaceholderTools()
    ];
  }

  private createRequestApprovalTool(): UnifiedToolDefinition {
    return {
      id: ulid(),
      name: APPROVAL_SYSTEM_TOOLS.REQUEST_APPROVAL,
      displayName: 'Request Approval',
      category: ToolCategory.APPROVAL,
      capabilities: [ToolCapability.APPROVAL_WORKFLOW],
      status: ToolStatus.ACTIVE,
      description: 'Request approval for a task',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
          message: { type: 'string' }
        },
        required: ['taskId', 'message']
      },
      enabled: true,
      metadata: {
        version: '1.0.0',
        author: 'unified-tools',
        provider: 'approval-system'
      },
      executor: async (params: ToolParameters, context: ExecutionContext): Promise<ToolResult> => {
        return {
          success: true,
          data: { approved: false, pending: true },
          metadata: {
            executionTimeMs: Date.now(),
            toolId: APPROVAL_SYSTEM_TOOLS.REQUEST_APPROVAL,
            toolName: APPROVAL_SYSTEM_TOOLS.REQUEST_APPROVAL,
            timestamp: new Date().toISOString()
          }
        };
      }
    };
  }

  private createApproveTaskTool(): UnifiedToolDefinition {
    return {
      id: ulid(),
      name: APPROVAL_SYSTEM_TOOLS.APPROVE_TASK,
      displayName: 'Approve Task',
      category: ToolCategory.APPROVAL,
      capabilities: [ToolCapability.APPROVAL_DECISION],
      status: ToolStatus.ACTIVE,
      description: 'Approve a task',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
          userId: { type: 'string' }
        },
        required: ['taskId', 'userId']
      },
      enabled: true,
      metadata: {
        version: '1.0.0',
        author: 'unified-tools',
        provider: 'approval-system'
      },
      executor: async (params: ToolParameters, context: ExecutionContext): Promise<ToolResult> => {
        return {
          success: true,
          data: { approved: true, approvedBy: params.userId },
          metadata: {
            executionTimeMs: Date.now(),
            toolId: APPROVAL_SYSTEM_TOOLS.APPROVE_TASK,
            toolName: APPROVAL_SYSTEM_TOOLS.APPROVE_TASK,
            timestamp: new Date().toISOString()
          }
        };
      }
    };
  }

  private createRejectTaskTool(): UnifiedToolDefinition {
    return {
      id: ulid(),
      name: APPROVAL_SYSTEM_TOOLS.REJECT_TASK,
      displayName: 'Reject Task',
      category: ToolCategory.APPROVAL,
      capabilities: [ToolCapability.APPROVAL_DECISION],
      status: ToolStatus.ACTIVE,
      description: 'Reject a task',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
          userId: { type: 'string' },
          reason: { type: 'string' }
        },
        required: ['taskId', 'userId', 'reason']
      },
      enabled: true,
      metadata: {
        version: '1.0.0',
        author: 'unified-tools',
        provider: 'approval-system'
      },
      executor: async (params: ToolParameters, context: ExecutionContext): Promise<ToolResult> => {
        return {
          success: true,
          data: { approved: false, rejectedBy: params.userId, reason: params.reason },
          metadata: {
            executionTimeMs: Date.now(),
            toolId: APPROVAL_SYSTEM_TOOLS.REJECT_TASK,
            toolName: APPROVAL_SYSTEM_TOOLS.REJECT_TASK,
            timestamp: new Date().toISOString()
          }
        };
      }
    };
  }

  private createPlaceholderTools(): UnifiedToolDefinition[] {
    const remainingTools = [
      APPROVAL_SYSTEM_TOOLS.SUBMIT_FOR_APPROVAL,
      APPROVAL_SYSTEM_TOOLS.CHECK_APPROVAL_STATUS,
      APPROVAL_SYSTEM_TOOLS.GET_APPROVAL_HISTORY,
      APPROVAL_SYSTEM_TOOLS.DELEGATE_APPROVAL,
      APPROVAL_SYSTEM_TOOLS.ESCALATE_APPROVAL,
      APPROVAL_SYSTEM_TOOLS.CREATE_APPROVAL_RULE,
      APPROVAL_SYSTEM_TOOLS.UPDATE_APPROVAL_RULE,
      APPROVAL_SYSTEM_TOOLS.DELETE_APPROVAL_RULE,
      APPROVAL_SYSTEM_TOOLS.GET_APPROVAL_RULES,
      APPROVAL_SYSTEM_TOOLS.GET_PENDING_APPROVALS,
      APPROVAL_SYSTEM_TOOLS.PROCESS_APPROVAL_DECISION,
      APPROVAL_SYSTEM_TOOLS.SEND_APPROVAL_NOTIFICATION,
      APPROVAL_SYSTEM_TOOLS.TRACK_APPROVAL_METRICS
    ];

    return remainingTools.map(toolName => ({
      id: ulid(),
      name: toolName,
      displayName: toolName.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
      category: ToolCategory.APPROVAL,
      capabilities: [ToolCapability.APPROVAL_WORKFLOW],
      status: ToolStatus.ACTIVE,
      description: `${toolName} tool`,
      parameters: { type: 'object', properties: {}, required: [] },
      enabled: true,
      metadata: {
        version: '1.0.0',
        author: 'unified-tools',
        provider: 'approval-system'
      },
      executor: async (params: ToolParameters, context: ExecutionContext): Promise<ToolResult> => {
        return {
          success: true,
          data: { message: `${toolName} tool is registered but not yet implemented` },
          metadata: {
            executionTimeMs: Date.now(),
            toolId: toolName,
            toolName: toolName,
            timestamp: new Date().toISOString()
          }
        };
      }
    }));
  }

  private getApprovalToolCount(): number {
    return Object.keys(APPROVAL_SYSTEM_TOOLS).length;
  }

  async cleanup(): Promise<void> {
    logger.info('Approval system cleanup completed');
  }
} 