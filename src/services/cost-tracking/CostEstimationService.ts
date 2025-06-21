/**
 * Cost Estimation Service
 * Provides cost estimates before operations are executed
 */

import { logger } from '../../lib/logging';
import { CostCategory, CostTier, CostUnit } from './interfaces/CostTrackingInterfaces';
import { getPricingForService, calculateServiceCost } from './pricing/PricingConfig';

export interface CostEstimate {
  estimatedCost: number;
  costTier: CostTier;
  costBreakdown: string;
  confidence: 'high' | 'medium' | 'low';
  factors: string[];
  warnings?: string[];
}

export interface EstimationParams {
  // Apify tool estimation
  apifyTool?: {
    toolName: string;
    expectedResults: number;
    estimatedTimeMs?: number;
  };

  // OpenAI API estimation
  openaiCall?: {
    model: string;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
  };

  // Workflow execution estimation
  workflowExecution?: {
    platform: 'n8n' | 'zapier' | 'make' | 'power_automate';
    estimatedExecutions: number;
    workflowComplexity?: 'simple' | 'medium' | 'complex';
  };

  // Deep research estimation
  deepResearch?: {
    researchDepth: 'shallow' | 'standard' | 'deep' | 'exhaustive';
    estimatedSources?: number;
    estimatedDurationMinutes?: number;
  };

  // Infrastructure usage estimation
  infrastructure?: {
    service: 'storage' | 'compute' | 'vector_database';
    units: number;
    unitType: CostUnit;
  };
}

export class CostEstimationService {
  /**
   * Estimate cost for Apify tool usage
   */
  static estimateApifyCost(params: {
    toolName: string;
    expectedResults: number;
    estimatedTimeMs?: number;
  }): CostEstimate {
    const { toolName, expectedResults, estimatedTimeMs = 30000 } = params;
    
    const result = calculateServiceCost(toolName, {
      results: expectedResults,
      minutes: estimatedTimeMs > 60000 ? estimatedTimeMs / 60000 : undefined
    });

    const factors = [
      `${expectedResults} expected results`,
      `${Math.round(estimatedTimeMs / 1000)}s estimated execution time`
    ];

    const warnings = [];
    if (expectedResults > 100) {
      warnings.push('High result count may increase execution time and cost');
    }
    if (estimatedTimeMs > 300000) { // 5 minutes
      warnings.push('Long execution time may incur additional compute costs');
    }

    return {
      estimatedCost: result.cost,
      costTier: this.calculateCostTier(result.cost),
      costBreakdown: result.breakdown,
      confidence: 'high',
      factors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Estimate cost for OpenAI API usage
   */
  static estimateOpenAICost(params: {
    model: string;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
  }): CostEstimate {
    const { model, estimatedInputTokens, estimatedOutputTokens } = params;
    
    const result = calculateServiceCost(model, {
      inputTokens: estimatedInputTokens,
      outputTokens: estimatedOutputTokens
    });

    const factors = [
      `${estimatedInputTokens.toLocaleString()} input tokens`,
      `${estimatedOutputTokens.toLocaleString()} output tokens`,
      `Model: ${model}`
    ];

    const warnings = [];
    if (estimatedInputTokens + estimatedOutputTokens > 50000) {
      warnings.push('High token count may result in significant costs');
    }
    if (model.includes('gpt-4') && estimatedOutputTokens > 1000) {
      warnings.push('GPT-4 output tokens are expensive - consider using GPT-3.5 for simpler tasks');
    }

    return {
      estimatedCost: result.cost,
      costTier: this.calculateCostTier(result.cost),
      costBreakdown: result.breakdown,
      confidence: 'high',
      factors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Estimate cost for workflow execution
   */
  static estimateWorkflowCost(params: {
    platform: 'n8n' | 'zapier' | 'make' | 'power_automate';
    estimatedExecutions: number;
    workflowComplexity?: 'simple' | 'medium' | 'complex';
  }): CostEstimate {
    const { platform, estimatedExecutions, workflowComplexity = 'medium' } = params;
    
    const result = calculateServiceCost(platform, {
      executions: estimatedExecutions
    });

    // Adjust for workflow complexity
    let adjustedCost = result.cost;
    const complexityMultiplier = {
      simple: 1.0,
      medium: 1.2,
      complex: 1.5
    };
    adjustedCost *= complexityMultiplier[workflowComplexity];

    const factors = [
      `${estimatedExecutions} workflow executions`,
      `Platform: ${platform}`,
      `Complexity: ${workflowComplexity}`
    ];

    const warnings = [];
    if (estimatedExecutions > 1000) {
      warnings.push('High execution count - consider optimizing workflow triggers');
    }
    if (workflowComplexity === 'complex') {
      warnings.push('Complex workflows may have higher failure rates and retry costs');
    }

    return {
      estimatedCost: adjustedCost,
      costTier: this.calculateCostTier(adjustedCost),
      costBreakdown: `${result.breakdown} (adjusted for ${workflowComplexity} complexity)`,
      confidence: workflowComplexity === 'simple' ? 'high' : 'medium',
      factors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Estimate cost for deep research operations
   */
  static estimateDeepResearchCost(params: {
    researchDepth: 'shallow' | 'standard' | 'deep' | 'exhaustive';
    estimatedSources?: number;
    estimatedDurationMinutes?: number;
  }): CostEstimate {
    const { researchDepth, estimatedSources, estimatedDurationMinutes } = params;
    
    // Map research depth to service names
    const serviceMap = {
      shallow: 'deep-research-shallow',
      standard: 'deep-research-standard',
      deep: 'deep-research-deep',
      exhaustive: 'deep-research-exhaustive'
    };

    // Default estimates based on research depth
    const defaults = {
      shallow: { sources: 20, minutes: 8 },
      standard: { sources: 40, minutes: 18 },
      deep: { sources: 65, minutes: 28 },
      exhaustive: { sources: 100, minutes: 50 }
    };

    const sources = estimatedSources || defaults[researchDepth].sources;
    const minutes = estimatedDurationMinutes || defaults[researchDepth].minutes;

    const result = calculateServiceCost(serviceMap[researchDepth], {
      results: sources,
      minutes
    });

    const factors = [
      `${sources} sources to analyze`,
      `~${minutes} minutes research time`,
      `Research depth: ${researchDepth}`
    ];

    const warnings = [];
    if (sources > 80) {
      warnings.push('High source count may extend research time significantly');
    }
    if (researchDepth === 'exhaustive') {
      warnings.push('Exhaustive research can be expensive - ensure it\'s necessary for your use case');
    }

    return {
      estimatedCost: result.cost,
      costTier: this.calculateCostTier(result.cost),
      costBreakdown: result.breakdown,
      confidence: estimatedSources && estimatedDurationMinutes ? 'high' : 'medium',
      factors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Estimate infrastructure costs
   */
  static estimateInfrastructureCost(params: {
    service: 'storage' | 'compute' | 'vector_database';
    units: number;
    unitType: CostUnit;
  }): CostEstimate {
    const { service, units, unitType } = params;
    
    let serviceName: string = service;
    if (service === 'vector_database') {
      serviceName = 'qdrant-cloud';
    }

    const result = calculateServiceCost(serviceName, {
      units
    });

    const factors = [
      `${units} ${unitType.replace('_', ' ')}`,
      `Service: ${service}`
    ];

    const warnings = [];
    if (service === 'storage' && units > 100) {
      warnings.push('Large storage usage - consider data lifecycle policies');
    }
    if (service === 'compute' && units > 1000) {
      warnings.push('High compute usage - consider optimization or caching');
    }

    return {
      estimatedCost: result.cost,
      costTier: this.calculateCostTier(result.cost),
      costBreakdown: result.breakdown,
      confidence: 'high',
      factors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Get comprehensive cost estimate for multiple operations
   */
  static estimateMultipleOperations(operations: EstimationParams[]): {
    totalEstimatedCost: number;
    totalCostTier: CostTier;
    operationEstimates: CostEstimate[];
    summary: {
      highestCostOperation: number;
      operationCount: number;
      averageCostPerOperation: number;
      totalWarnings: string[];
    };
  } {
    const estimates: CostEstimate[] = [];

    for (const operation of operations) {
      if (operation.apifyTool) {
        estimates.push(this.estimateApifyCost(operation.apifyTool));
      }
      if (operation.openaiCall) {
        estimates.push(this.estimateOpenAICost(operation.openaiCall));
      }
      if (operation.workflowExecution) {
        estimates.push(this.estimateWorkflowCost(operation.workflowExecution));
      }
      if (operation.deepResearch) {
        estimates.push(this.estimateDeepResearchCost(operation.deepResearch));
      }
      if (operation.infrastructure) {
        estimates.push(this.estimateInfrastructureCost(operation.infrastructure));
      }
    }

    const totalCost = estimates.reduce((sum, est) => sum + est.estimatedCost, 0);
    const allWarnings = estimates.flatMap(est => est.warnings || []);
    const highestCost = Math.max(...estimates.map(est => est.estimatedCost));

    return {
      totalEstimatedCost: totalCost,
      totalCostTier: this.calculateCostTier(totalCost),
      operationEstimates: estimates,
      summary: {
        highestCostOperation: highestCost,
        operationCount: estimates.length,
        averageCostPerOperation: totalCost / estimates.length,
        totalWarnings: Array.from(new Set(allWarnings)) // Remove duplicates
      }
    };
  }

  /**
   * Calculate cost tier from USD amount
   */
  private static calculateCostTier(costUsd: number): CostTier {
    if (costUsd <= 0) return CostTier.FREE;
    if (costUsd <= 1.00) return CostTier.LOW;
    if (costUsd <= 10.00) return CostTier.MEDIUM;
    if (costUsd <= 100.00) return CostTier.HIGH;
    return CostTier.PREMIUM;
  }

  /**
   * Get cost estimate with budget impact analysis
   */
  static estimateWithBudgetImpact(
    estimation: CostEstimate,
    currentBudgetSpent: number,
    budgetLimit: number
  ): CostEstimate & {
    budgetImpact: {
      currentUtilization: number;
      afterOperationUtilization: number;
      remainingBudget: number;
      wouldExceedBudget: boolean;
    };
  } {
    const afterOperationSpent = currentBudgetSpent + estimation.estimatedCost;
    const currentUtilization = (currentBudgetSpent / budgetLimit) * 100;
    const afterUtilization = (afterOperationSpent / budgetLimit) * 100;

    return {
      ...estimation,
      budgetImpact: {
        currentUtilization,
        afterOperationUtilization: afterUtilization,
        remainingBudget: budgetLimit - afterOperationSpent,
        wouldExceedBudget: afterOperationSpent > budgetLimit
      }
    };
  }
} 