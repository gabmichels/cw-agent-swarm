import { PrismaClient } from '@prisma/client';
import { CostTrackingService } from './CostTrackingService';
import { ApifyCostTracker } from './integrations/ApifyCostTracker';
import { OpenAICostTracker } from './integrations/OpenAICostTracker';
import { WorkflowCostTracker } from './integrations/WorkflowCostTracker';
import { CostEstimationService, EstimationParams, CostEstimate } from './CostEstimationService';
import { logger } from '../../lib/logging';
import {
  CostSummary,
  CostBudget,
  CostAlert,
  CostOptimization,
  CostCategory
} from './interfaces/CostTrackingInterfaces';

/**
 * Centralized cost tracking manager that coordinates all cost tracking activities
 */
export class CostTrackingManager {
  private costService: CostTrackingService;
  private apifyTracker: ApifyCostTracker;
  private openaiTracker: OpenAICostTracker;
  private workflowTracker: WorkflowCostTracker;

  constructor(prisma: PrismaClient) {
    this.costService = new CostTrackingService(prisma);
    this.apifyTracker = new ApifyCostTracker(this.costService);
    this.openaiTracker = new OpenAICostTracker(this.costService);
    this.workflowTracker = new WorkflowCostTracker(this.costService);
  }

  // Apify cost tracking methods
  get apify() {
    return this.apifyTracker;
  }

  // OpenAI cost tracking methods
  get openai() {
    return this.openaiTracker;
  }

  // Workflow cost tracking methods
  get workflows() {
    return this.workflowTracker;
  }

  /**
   * Track cost for deep research operations
   */
  async trackResearchCost(params: {
    researchSessionId: string;
    phase: string;
    queryType: string;
    toolsUsed: string[];
    sourcesAnalyzed: number;
    duration: number;
    initiatedBy: { type: 'agent' | 'user' | 'system'; id: string; name?: string };
    departmentId?: string;
  }): Promise<void> {
    try {
      await this.costService.recordResearchCost(params);
      logger.info('Research cost tracked successfully', {
        researchSessionId: params.researchSessionId,
        phase: params.phase,
        sourcesAnalyzed: params.sourcesAnalyzed,
        toolsUsed: params.toolsUsed
      });
    } catch (error) {
      logger.error('Failed to track research cost', {
        error: error instanceof Error ? error.message : String(error),
        researchSessionId: params.researchSessionId
      });
      throw error;
    }
  }

  /**
   * Get comprehensive cost summary
   */
  async getCostSummary(params: {
    startDate: Date;
    endDate: Date;
    categories?: CostCategory[];
    services?: string[];
    departmentId?: string;
    initiatedBy?: string;
  }): Promise<CostSummary> {
    return this.costService.getCostSummary(params);
  }

  /**
   * Create a cost budget
   */
  async createBudget(budget: Omit<CostBudget, 'id' | 'createdAt' | 'updatedAt'>): Promise<CostBudget> {
    return this.costService.createBudget(budget);
  }

  /**
   * Create a cost alert
   */
  async createAlert(alert: Omit<CostAlert, 'id' | 'createdAt' | 'updatedAt'>): Promise<CostAlert> {
    return this.costService.createAlert(alert);
  }

  /**
   * Get cost optimization recommendations
   */
  async getOptimizationRecommendations(params: {
    startDate: Date;
    endDate: Date;
    categories?: CostCategory[];
    minSavings?: number;
  }): Promise<CostOptimization[]> {
    return this.costService.getOptimizationRecommendations(params);
  }

  /**
   * Cost estimation methods
   */
  get estimation() {
    return {
      /**
       * Estimate cost for Apify tool usage
       */
      estimateApifyCost: CostEstimationService.estimateApifyCost,

      /**
       * Estimate cost for OpenAI API usage
       */
      estimateOpenAICost: CostEstimationService.estimateOpenAICost,

      /**
       * Estimate cost for workflow execution
       */
      estimateWorkflowCost: CostEstimationService.estimateWorkflowCost,

      /**
       * Estimate cost for deep research operations
       */
      estimateDeepResearchCost: CostEstimationService.estimateDeepResearchCost,

      /**
       * Estimate infrastructure costs
       */
      estimateInfrastructureCost: CostEstimationService.estimateInfrastructureCost,

      /**
       * Get comprehensive cost estimate for multiple operations
       */
      estimateMultipleOperations: CostEstimationService.estimateMultipleOperations,

      /**
       * Get cost estimate with budget impact analysis
       */
      estimateWithBudgetImpact: CostEstimationService.estimateWithBudgetImpact
    };
  }

  /**
   * Get cost breakdown by department
   */
  async getDepartmentCostBreakdown(params: {
    startDate: Date;
    endDate: Date;
    departmentIds?: string[];
  }): Promise<Record<string, {
    totalCost: number;
    costByCategory: Record<CostCategory, number>;
    costByService: Record<string, number>;
    operationCount: number;
    averageCostPerOperation: number;
  }>> {
    const breakdown: Record<string, any> = {};

    // If specific departments are requested, get data for each
    if (params.departmentIds) {
      for (const departmentId of params.departmentIds) {
        const summary = await this.costService.getCostSummary({
          ...params,
          departmentId
        });

        breakdown[departmentId] = {
          totalCost: summary.totalCostUsd,
          costByCategory: summary.byCategory,
          costByService: summary.byService,
          operationCount: summary.totalOperations,
          averageCostPerOperation: summary.averageCostPerOperation
        };
      }
    } else {
      // Get overall summary and extract department data
      const overallSummary = await this.costService.getCostSummary(params);
      
      // For now, return the overall summary under 'all' key
      breakdown['all'] = {
        totalCost: overallSummary.totalCostUsd,
        costByCategory: overallSummary.byCategory,
        costByService: overallSummary.byService,
        operationCount: overallSummary.totalOperations,
        averageCostPerOperation: overallSummary.averageCostPerOperation
      };
    }

    return breakdown;
  }

  /**
   * Get real-time cost dashboard data
   */
  async getDashboardData(params: {
    timeWindow: 'hour' | 'day' | 'week' | 'month';
    departmentId?: string;
  }): Promise<{
    currentPeriodCost: number;
    previousPeriodCost: number;
    costTrend: 'increasing' | 'decreasing' | 'stable';
    topCostDrivers: Array<{
      service: string;
      operation: string;
      cost: number;
      percentage: number;
    }>;
    budgetUtilization: Array<{
      budgetName: string;
      utilized: number;
      remaining: number;
      status: 'normal' | 'warning' | 'critical';
    }>;
    recentAlerts: Array<{
      alertName: string;
      severity: string;
      triggeredAt: Date;
      message: string;
    }>;
  }> {
    const now = new Date();
    let startDate: Date;
    let previousStartDate: Date;

    // Calculate time windows
    switch (params.timeWindow) {
      case 'hour':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        previousStartDate = new Date(startDate.getTime() - 60 * 60 * 1000);
        break;
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        previousStartDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    // Get current period summary
    const currentSummary = await this.costService.getCostSummary({
      startDate,
      endDate: now,
      departmentId: params.departmentId
    });

    // Get previous period summary
    const previousSummary = await this.costService.getCostSummary({
      startDate: previousStartDate,
      endDate: startDate,
      departmentId: params.departmentId
    });

    // Determine cost trend
    let costTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (currentSummary.totalCostUsd > previousSummary.totalCostUsd * 1.1) {
      costTrend = 'increasing';
    } else if (currentSummary.totalCostUsd < previousSummary.totalCostUsd * 0.9) {
      costTrend = 'decreasing';
    }

    return {
      currentPeriodCost: currentSummary.totalCostUsd,
      previousPeriodCost: previousSummary.totalCostUsd,
      costTrend,
      topCostDrivers: currentSummary.topCostDrivers,
      budgetUtilization: [], // TODO: Implement budget utilization
      recentAlerts: [] // TODO: Implement recent alerts
    };
  }

  /**
   * Export cost data for external analysis
   */
  async exportCostData(params: {
    startDate: Date;
    endDate: Date;
    format: 'csv' | 'json' | 'excel';
    categories?: CostCategory[];
    services?: string[];
    departmentId?: string;
  }): Promise<{
    data: any;
    filename: string;
    mimeType: string;
  }> {
    const summary = await this.costService.getCostSummary(params);
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `cost-report-${timestamp}`;

    switch (params.format) {
      case 'json':
        return {
          data: JSON.stringify(summary, null, 2),
          filename: `${filename}.json`,
          mimeType: 'application/json'
        };
      case 'csv':
        // Convert summary to CSV format
        const csvData = this.convertToCsv(summary);
        return {
          data: csvData,
          filename: `${filename}.csv`,
          mimeType: 'text/csv'
        };
      case 'excel':
        // For now, return JSON (would need Excel library for proper Excel export)
        return {
          data: JSON.stringify(summary, null, 2),
          filename: `${filename}.xlsx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        };
      default:
        throw new Error(`Unsupported export format: ${params.format}`);
    }
  }

  private convertToCsv(summary: CostSummary): string {
    const headers = ['Category', 'Service', 'Cost USD', 'Percentage'];
    const rows = [headers.join(',')];

    // Add category breakdown
    for (const [category, cost] of Object.entries(summary.byCategory)) {
      const percentage = (cost / summary.totalCostUsd * 100).toFixed(2);
      rows.push(`${category},,${cost.toFixed(4)},${percentage}%`);
    }

    // Add service breakdown
    for (const [service, cost] of Object.entries(summary.byService)) {
      const percentage = (cost / summary.totalCostUsd * 100).toFixed(2);
      rows.push(`,${service},${cost.toFixed(4)},${percentage}%`);
    }

    return rows.join('\n');
  }
}

// Export a singleton instance
let costTrackingManager: CostTrackingManager | null = null;

export function getCostTrackingManager(prisma: PrismaClient): CostTrackingManager {
  if (!costTrackingManager) {
    costTrackingManager = new CostTrackingManager(prisma);
  }
  return costTrackingManager;
} 