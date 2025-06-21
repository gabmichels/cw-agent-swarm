import { CostTrackingService } from '../CostTrackingService';
import { logger } from '../../../lib/logging';

/**
 * Wrapper service that automatically tracks costs for external workflow executions
 */
export class WorkflowCostTracker {
  private costTracker: CostTrackingService;

  constructor(costTracker: CostTrackingService) {
    this.costTracker = costTracker;
  }

  /**
   * Track cost for N8N workflow execution
   */
  async trackN8NExecution(params: {
    workflowId: string;
    workflowName: string;
    executionId: string;
    success: boolean;
    executionTimeMs: number;
    nodesExecuted: number;
    initiatedBy: { type: 'agent' | 'user' | 'system'; id: string; name?: string };
    sessionId?: string;
    departmentId?: string;
  }): Promise<void> {
    try {
      await this.costTracker.recordWorkflowCost({
        platform: 'n8n',
        workflowId: params.workflowId,
        workflowName: params.workflowName,
        executionTimeMs: params.executionTimeMs,
        success: params.success,
        initiatedBy: params.initiatedBy,
        sessionId: params.sessionId,
        departmentId: params.departmentId
      });

      logger.debug('N8N workflow cost tracked successfully', {
        workflowId: params.workflowId,
        workflowName: params.workflowName,
        executionId: params.executionId,
        success: params.success,
        nodesExecuted: params.nodesExecuted
      });
    } catch (error) {
      logger.error('Failed to track N8N workflow cost', {
        error: error instanceof Error ? error.message : String(error),
        workflowId: params.workflowId,
        executionId: params.executionId
      });
    }
  }

  /**
   * Track cost for Zapier Zap execution
   */
  async trackZapierExecution(params: {
    zapId: string;
    zapName: string;
    executionId: string;
    success: boolean;
    executionTimeMs: number;
    stepsExecuted: number;
    initiatedBy: { type: 'agent' | 'user' | 'system'; id: string; name?: string };
    sessionId?: string;
    departmentId?: string;
  }): Promise<void> {
    try {
      await this.costTracker.recordWorkflowCost({
        platform: 'zapier',
        workflowId: params.zapId,
        workflowName: params.zapName,
        executionTimeMs: params.executionTimeMs,
        success: params.success,
        initiatedBy: params.initiatedBy,
        sessionId: params.sessionId,
        departmentId: params.departmentId
      });

      logger.debug('Zapier workflow cost tracked successfully', {
        zapId: params.zapId,
        zapName: params.zapName,
        executionId: params.executionId,
        success: params.success,
        stepsExecuted: params.stepsExecuted
      });
    } catch (error) {
      logger.error('Failed to track Zapier workflow cost', {
        error: error instanceof Error ? error.message : String(error),
        zapId: params.zapId,
        executionId: params.executionId
      });
    }
  }

  /**
   * Track cost for Make (formerly Integromat) scenario execution
   */
  async trackMakeExecution(params: {
    scenarioId: string;
    scenarioName: string;
    executionId: string;
    success: boolean;
    executionTimeMs: number;
    operationsUsed: number;
    dataTransferMB?: number;
    initiatedBy: { type: 'agent' | 'user' | 'system'; id: string; name?: string };
    sessionId?: string;
    departmentId?: string;
  }): Promise<void> {
    try {
      await this.costTracker.recordWorkflowCost({
        platform: 'make',
        workflowId: params.scenarioId,
        workflowName: params.scenarioName,
        executionTimeMs: params.executionTimeMs,
        success: params.success,
        initiatedBy: params.initiatedBy,
        sessionId: params.sessionId,
        departmentId: params.departmentId
      });

      logger.debug('Make scenario cost tracked successfully', {
        scenarioId: params.scenarioId,
        scenarioName: params.scenarioName,
        executionId: params.executionId,
        success: params.success,
        operationsUsed: params.operationsUsed,
        dataTransferMB: params.dataTransferMB
      });
    } catch (error) {
      logger.error('Failed to track Make scenario cost', {
        error: error instanceof Error ? error.message : String(error),
        scenarioId: params.scenarioId,
        executionId: params.executionId
      });
    }
  }

  /**
   * Track cost for Power Automate flow execution
   */
  async trackPowerAutomateExecution(params: {
    flowId: string;
    flowName: string;
    runId: string;
    success: boolean;
    executionTimeMs: number;
    actionsExecuted: number;
    initiatedBy: { type: 'agent' | 'user' | 'system'; id: string; name?: string };
    sessionId?: string;
    departmentId?: string;
  }): Promise<void> {
    try {
      await this.costTracker.recordWorkflowCost({
        platform: 'power_automate',
        workflowId: params.flowId,
        workflowName: params.flowName,
        executionTimeMs: params.executionTimeMs,
        success: params.success,
        initiatedBy: params.initiatedBy,
        sessionId: params.sessionId,
        departmentId: params.departmentId
      });

      logger.debug('Power Automate flow cost tracked successfully', {
        flowId: params.flowId,
        flowName: params.flowName,
        runId: params.runId,
        success: params.success,
        actionsExecuted: params.actionsExecuted
      });
    } catch (error) {
      logger.error('Failed to track Power Automate flow cost', {
        error: error instanceof Error ? error.message : String(error),
        flowId: params.flowId,
        runId: params.runId
      });
    }
  }

  /**
   * Estimate workflow execution cost
   */
  estimateWorkflowCost(params: {
    platform: 'n8n' | 'zapier' | 'make' | 'power_automate';
    estimatedSteps: number;
    estimatedTimeMinutes?: number;
  }): {
    estimatedCost: number;
    costTier: 'free' | 'low' | 'medium' | 'high' | 'premium';
  } {
    const platformCosts = this.getPlatformCosts();
    const costs = platformCosts[params.platform];

    const baseCost = costs.base;
    const stepCost = params.estimatedSteps * costs.perStep;
    const timeCost = (params.estimatedTimeMinutes || 0) * costs.perMinute;

    const estimatedCost = baseCost + stepCost + timeCost;

    return {
      estimatedCost,
      costTier: this.determineCostTier(estimatedCost)
    };
  }

  /**
   * Get workflow usage summary for a time period
   */
  async getWorkflowUsageSummary(params: {
    platform?: 'n8n' | 'zapier' | 'make' | 'power_automate';
    startDate: Date;
    endDate: Date;
    departmentId?: string;
  }): Promise<{
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    totalCost: number;
    averageCostPerExecution: number;
    topWorkflows: Array<{
      workflowId: string;
      workflowName: string;
      executions: number;
      cost: number;
    }>;
  }> {
    // This would query the cost tracking service for workflow data
    // For now, return placeholder data
    return {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalCost: 0,
      averageCostPerExecution: 0,
      topWorkflows: []
    };
  }

  /**
   * Configure workflow cost settings
   */
  async configureWorkflowCosts(params: {
    platform: 'n8n' | 'zapier' | 'make' | 'power_automate';
    workflowId: string;
    workflowName: string;
    costPerExecution?: number;
    monthlySubscriptionCost?: number;
    executionLimits?: {
      perMonth?: number;
      perDay?: number;
    };
    dataLimits?: {
      transferMBPerMonth?: number;
    };
  }): Promise<void> {
    try {
      // This would update the workflow cost configuration
      // For now, just log the configuration
      logger.info('Workflow cost configuration updated', {
        platform: params.platform,
        workflowId: params.workflowId,
        workflowName: params.workflowName,
        costPerExecution: params.costPerExecution,
        monthlySubscriptionCost: params.monthlySubscriptionCost
      });
    } catch (error) {
      logger.error('Failed to configure workflow costs', {
        error: error instanceof Error ? error.message : String(error),
        platform: params.platform,
        workflowId: params.workflowId
      });
      throw error;
    }
  }

  private getPlatformCosts(): Record<string, {
    base: number;
    perStep: number;
    perMinute: number;
  }> {
    return {
      'n8n': {
        base: 0.01,
        perStep: 0.002,
        perMinute: 0.005
      },
      'zapier': {
        base: 0.02,
        perStep: 0.003,
        perMinute: 0.01
      },
      'make': {
        base: 0.015,
        perStep: 0.0025,
        perMinute: 0.008
      },
      'power_automate': {
        base: 0.025,
        perStep: 0.004,
        perMinute: 0.012
      }
    };
  }

  private determineCostTier(cost: number): 'free' | 'low' | 'medium' | 'high' | 'premium' {
    if (cost <= 0) return 'free';
    if (cost <= 0.05) return 'low';
    if (cost <= 0.25) return 'medium';
    if (cost <= 1.00) return 'high';
    return 'premium';
  }
} 