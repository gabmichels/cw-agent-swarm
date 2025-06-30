/**
 * Approval Integration Service
 */

import {
  IUnifiedToolFoundation,
  ToolParameters,
  ExecutionContext,
  ToolResult,
  APPROVAL_SYSTEM_TOOLS
} from '../../foundation';

export class ApprovalIntegrationService {
  private foundation: IUnifiedToolFoundation;

  constructor(foundation: IUnifiedToolFoundation) {
    this.foundation = foundation;
  }

  async requestApproval(params: {
    taskId: string;
    message: string;
    priority?: string;
    requestedBy?: string;
  }, context: ExecutionContext): Promise<ToolResult> {
    return this.foundation.executeTool(
      APPROVAL_SYSTEM_TOOLS.REQUEST_APPROVAL,
      params,
      context
    );
  }

  async approveTask(params: {
    taskId: string;
    userId: string;
    notes?: string;
  }, context: ExecutionContext): Promise<ToolResult> {
    return this.foundation.executeTool(
      APPROVAL_SYSTEM_TOOLS.APPROVE_TASK,
      params,
      context
    );
  }

  async rejectTask(params: {
    taskId: string;
    userId: string;
    reason: string;
  }, context: ExecutionContext): Promise<ToolResult> {
    return this.foundation.executeTool(
      APPROVAL_SYSTEM_TOOLS.REJECT_TASK,
      params,
      context
    );
  }

  async getApprovalStatus(): Promise<{
    enabled: boolean;
    features: {
      ruleBasedApproval: boolean;
      workflowApproval: boolean;
      approvalNotifications: boolean;
    };
    pendingCount: number;
  }> {
    return {
      enabled: true,
      features: {
        ruleBasedApproval: true,
        workflowApproval: true,
        approvalNotifications: true
      },
      pendingCount: 0
    };
  }
} 