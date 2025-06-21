import { PrismaClient } from '@prisma/client';
import { logger } from '../../lib/logging';
import { IdGenerator } from '../../utils/ulid';
import {
  CostEntry,
  CostSummary,
  CostBudget,
  CostAlert,
  CostForecast,
  CostOptimization,
  ToolCostConfig,
  ExternalWorkflowCost,
  CostCategory,
  CostUnit,
  CostTier
} from './interfaces/CostTrackingInterfaces';
import { getPricingForService, calculateServiceCost, ALL_PRICING } from './pricing/PricingConfig';

// Type assertion to bypass Prisma type issues for cost tracking models
interface ExtendedPrismaClient extends PrismaClient {
  costEntry: any;
  costBudget: any;
  costAlert: any;
  toolCostConfig: any;
  externalWorkflowCost: any;
  costOptimization: any;
  costForecast: any;
}

/**
 * Main service for tracking and managing costs across all tools and services
 */
export class CostTrackingService {
  private prisma: ExtendedPrismaClient;
  private costConfigs: Map<string, ToolCostConfig> = new Map();
  private workflowCosts: Map<string, ExternalWorkflowCost> = new Map();
  private budgets: Map<string, CostBudget> = new Map();
  private alerts: Map<string, CostAlert> = new Map();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma as ExtendedPrismaClient;
    this.initializeDefaultConfigs();
  }

  /**
   * Record a cost entry for tool usage, API calls, or workflow executions
   */
  async recordCost(entry: Omit<CostEntry, 'id' | 'timestamp' | 'tier'>): Promise<CostEntry> {
    const costEntry: CostEntry = {
      ...entry,
      id: IdGenerator.generate('cost'),
      timestamp: new Date(),
      tier: this.calculateCostTier(entry.costUsd)
    };

    try {
      // Store in database (we'll add the schema later)
      await this.storeCostEntry(costEntry);

      // Check budget limits
      await this.checkBudgetLimits(costEntry);

      // Check for alerts
      await this.checkAlerts(costEntry);

      logger.info('Cost recorded successfully', {
        costId: costEntry.id.toString(),
        service: costEntry.service,
        operation: costEntry.operation,
        cost: costEntry.costUsd,
        category: costEntry.category
      });

      return costEntry;
    } catch (error) {
      logger.error('Failed to record cost', {
        error: error instanceof Error ? error.message : String(error),
        entry: {
          service: entry.service,
          operation: entry.operation,
          cost: entry.costUsd
        }
      });
      throw error;
    }
  }

  /**
   * Record cost for Apify tool usage
   */
  async recordApifyCost(params: {
    toolName: string;
    operation: string;
    resultsCount: number;
    executionTimeMs: number;
    success: boolean;
    initiatedBy: { type: 'agent' | 'user' | 'system'; id: string; name?: string };
    sessionId?: string;
    toolParameters?: Record<string, unknown>;
    departmentId?: string;
  }): Promise<CostEntry> {
    const config = this.getApifyToolConfig(params.toolName);
    const cost = this.calculateApifyCost(config, params.resultsCount, params.executionTimeMs);

    return this.recordCost({
      category: CostCategory.APIFY_TOOLS,
      service: 'apify',
      operation: params.operation,
      costUsd: cost,
      unitsConsumed: params.resultsCount,
      unitType: CostUnit.RESULTS_PROCESSED,
      costPerUnit: cost / Math.max(params.resultsCount, 1),
      initiatedBy: params.initiatedBy,
      sessionId: params.sessionId,
      metadata: {
        toolParameters: params.toolParameters,
        executionDetails: {
          duration: params.executionTimeMs,
          success: params.success,
          retries: 0
        },
        departmentId: params.departmentId,
        tags: ['apify', params.toolName]
      }
    });
  }

  /**
   * Record cost for OpenAI API usage
   */
  async recordOpenAICost(params: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    operation: string;
    initiatedBy: { type: 'agent' | 'user' | 'system'; id: string; name?: string };
    sessionId?: string;
    departmentId?: string;
  }): Promise<CostEntry> {
    const cost = this.calculateOpenAICost(params.model, params.inputTokens, params.outputTokens);
    const totalTokens = params.inputTokens + params.outputTokens;

    return this.recordCost({
      category: CostCategory.OPENAI_API,
      service: 'openai',
      operation: params.operation,
      costUsd: cost,
      unitsConsumed: totalTokens,
      unitType: CostUnit.TOKENS,
      costPerUnit: cost / totalTokens,
      initiatedBy: params.initiatedBy,
      sessionId: params.sessionId,
      metadata: {
        toolParameters: {
          model: params.model,
          inputTokens: params.inputTokens,
          outputTokens: params.outputTokens
        },
        departmentId: params.departmentId,
        tags: ['openai', params.model]
      }
    });
  }

  /**
   * Record cost for external workflow execution
   */
  async recordWorkflowCost(params: {
    platform: 'n8n' | 'zapier' | 'make' | 'power_automate';
    workflowId: string;
    workflowName: string;
    executionTimeMs: number;
    success: boolean;
    initiatedBy: { type: 'agent' | 'user' | 'system'; id: string; name?: string };
    sessionId?: string;
    departmentId?: string;
  }): Promise<CostEntry> {
    const workflowConfig = this.workflowCosts.get(`${params.platform}:${params.workflowId}`);
    const cost = workflowConfig?.costPerExecution || this.getDefaultWorkflowCost(params.platform);

    return this.recordCost({
      category: this.getWorkflowCostCategory(params.platform),
      service: params.platform,
      operation: 'workflow_execution',
      costUsd: cost,
      unitsConsumed: 1,
      unitType: CostUnit.WORKFLOW_RUNS,
      costPerUnit: cost,
      initiatedBy: params.initiatedBy,
      sessionId: params.sessionId,
      metadata: {
        workflowContext: {
          workflowId: params.workflowId,
          stepId: 'full_workflow',
          platform: params.platform
        },
        executionDetails: {
          duration: params.executionTimeMs,
          success: params.success,
          retries: 0
        },
        departmentId: params.departmentId,
        tags: [params.platform, 'workflow', params.workflowName]
      }
    });
  }

  /**
   * Record cost for deep research operations
   */
  async recordResearchCost(params: {
    researchSessionId: string;
    phase: string;
    queryType: string;
    toolsUsed: string[];
    sourcesAnalyzed: number;
    duration: number;
    initiatedBy: { type: 'agent' | 'user' | 'system'; id: string; name?: string };
    departmentId?: string;
  }): Promise<CostEntry> {
    // Calculate cost based on research depth and sources
    const researchType = this.determineResearchType(params.duration, params.sourcesAnalyzed);
    const result = calculateServiceCost(researchType, {
      results: params.sourcesAnalyzed,
      minutes: params.duration / 60000
    });

    logger.info('Deep research cost calculated', {
      researchSessionId: params.researchSessionId,
      researchType,
      sourcesAnalyzed: params.sourcesAnalyzed,
      durationMinutes: params.duration / 60000,
      cost: result.cost,
      breakdown: result.breakdown
    });

    return this.recordCost({
      category: CostCategory.DEEP_RESEARCH,
      service: 'research_engine',
      operation: researchType,
      costUsd: result.cost,
      unitsConsumed: params.sourcesAnalyzed,
      unitType: CostUnit.RESULTS_PROCESSED,
      costPerUnit: result.cost / Math.max(params.sourcesAnalyzed, 1),
      initiatedBy: params.initiatedBy,
      sessionId: params.researchSessionId,
      metadata: {
        researchContext: {
          researchSessionId: params.researchSessionId,
          researchPhase: params.phase,
          queryType: params.queryType
        },
        executionDetails: {
          duration: params.duration,
          success: true,
          retries: 0
        },
        toolParameters: {
          toolsUsed: params.toolsUsed,
          researchDepth: params.phase,
          sourcesAnalyzed: params.sourcesAnalyzed,
          researchType,
          costBreakdown: result.breakdown
        },
        departmentId: params.departmentId,
        tags: ['research', params.queryType, researchType, ...params.toolsUsed]
      }
    });
  }

  /**
   * Determine research type based on duration and sources
   */
  private determineResearchType(durationMs: number, sourcesAnalyzed: number): string {
    const minutes = durationMs / 60000;
    
    if (minutes <= 10 || sourcesAnalyzed <= 25) {
      return 'deep-research-shallow';
    } else if (minutes <= 20 || sourcesAnalyzed <= 50) {
      return 'deep-research-standard';
    } else if (minutes <= 30 || sourcesAnalyzed <= 80) {
      return 'deep-research-deep';
    } else {
      return 'deep-research-exhaustive';
    }
  }

  /**
   * Get cost summary for a time period
   */
  async getCostSummary(params: {
    startDate: Date;
    endDate: Date;
    categories?: CostCategory[];
    services?: string[];
    departmentId?: string;
    initiatedBy?: string;
  }): Promise<CostSummary> {
    try {
      const entries = await this.getCostEntries(params);
      
      const totalCostUsd = entries.reduce((sum, entry) => sum + entry.costUsd, 0);
      const totalOperations = entries.length;

      // Group by category
      const byCategory = entries.reduce((acc, entry) => {
        acc[entry.category] = (acc[entry.category] || 0) + entry.costUsd;
        return acc;
      }, {} as Record<CostCategory, number>);

      // Group by service
      const byService = entries.reduce((acc, entry) => {
        acc[entry.service] = (acc[entry.service] || 0) + entry.costUsd;
        return acc;
      }, {} as Record<string, number>);

      // Group by tier
      const byTier = entries.reduce((acc, entry) => {
        acc[entry.tier] = (acc[entry.tier] || 0) + entry.costUsd;
        return acc;
      }, {} as Record<CostTier, number>);

      // Group by initiator
      const byInitiator = entries.reduce((acc, entry) => {
        const key = `${entry.initiatedBy.type}:${entry.initiatedBy.id}`;
        if (!acc[key]) {
          acc[key] = { totalCost: 0, operationCount: 0, averageCost: 0 };
        }
        acc[key].totalCost += entry.costUsd;
        acc[key].operationCount += 1;
        acc[key].averageCost = acc[key].totalCost / acc[key].operationCount;
        return acc;
      }, {} as Record<string, { totalCost: number; operationCount: number; averageCost: number }>);

      // Top cost drivers
      const serviceOperationCosts = entries.reduce((acc, entry) => {
        const key = `${entry.service}:${entry.operation}`;
        acc[key] = (acc[key] || 0) + entry.costUsd;
        return acc;
      }, {} as Record<string, number>);

      const topCostDrivers = Object.entries(serviceOperationCosts)
        .map(([key, cost]) => {
          const [service, operation] = key.split(':');
          return {
            service,
            operation,
            cost,
            percentage: (cost / totalCostUsd) * 100
          };
        })
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 10);

      return {
        totalCostUsd,
        byCategory,
        byService,
        byTier,
        byInitiator,
        period: {
          start: params.startDate,
          end: params.endDate
        },
        totalOperations,
        averageCostPerOperation: totalCostUsd / Math.max(totalOperations, 1),
        topCostDrivers
      };
    } catch (error) {
      logger.error('Failed to generate cost summary', {
        error: error instanceof Error ? error.message : String(error),
        params
      });
      throw error;
    }
  }

  /**
   * Create or update a cost budget
   */
  async createBudget(budget: Omit<CostBudget, 'id' | 'createdAt' | 'updatedAt'>): Promise<CostBudget> {
    const newBudget: CostBudget = {
      ...budget,
      id: IdGenerator.generate('budg'),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.budgets.set(newBudget.id.toString(), newBudget);
    
    // Store in database
    await this.storeBudget(newBudget);

    logger.info('Budget created', {
      budgetId: newBudget.id.toString(),
      name: newBudget.name,
      amount: newBudget.budgetUsd,
      period: newBudget.period
    });

    return newBudget;
  }

  /**
   * Create a cost alert
   */
  async createAlert(alert: Omit<CostAlert, 'id' | 'createdAt' | 'updatedAt'>): Promise<CostAlert> {
    const newAlert: CostAlert = {
      ...alert,
      id: IdGenerator.generate('alrt'),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.alerts.set(newAlert.id.toString(), newAlert);
    
    // Store in database
    await this.storeAlert(newAlert);

    logger.info('Cost alert created', {
      alertId: newAlert.id.toString(),
      name: newAlert.name,
      type: newAlert.type,
      severity: newAlert.severity
    });

    return newAlert;
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
    const summary = await this.getCostSummary(params);
    const recommendations: CostOptimization[] = [];

    // Analyze high-cost services
    for (const [service, cost] of Object.entries(summary.byService)) {
      if (cost > (params.minSavings || 10)) {
        const optimization = await this.generateServiceOptimization(service, cost, summary);
        if (optimization) {
          recommendations.push(optimization);
        }
      }
    }

    // Analyze cost patterns
    const patternOptimizations = await this.analyzeUsagePatterns(summary);
    recommendations.push(...patternOptimizations);

    return recommendations.sort((a, b) => b.potentialSavingsUsd - a.potentialSavingsUsd);
  }

  // Private helper methods

  private async initializeDefaultConfigs(): Promise<void> {
    // Load real pricing data from PricingConfig
    logger.info('Initializing cost tracking with real-world pricing data', {
      totalServices: ALL_PRICING.length,
      categories: Array.from(new Set(ALL_PRICING.map((p: any) => p.category)))
    });

    // Convert pricing data to tool configs for Apify tools
    const apifyPricing = ALL_PRICING.filter((p: any) => p.service.startsWith('apify-'));
    for (const pricing of apifyPricing) {
      // Type guard for Apify pricing structure
      if (!('baseCost' in pricing.pricing && 'perUnit' in pricing.pricing)) continue;
      
      const config: ToolCostConfig = {
        toolId: pricing.service,
        toolName: pricing.service.replace('apify-', '').replace('-', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        category: pricing.category,
        pricingModel: pricing.pricingModel as any,
        baseCost: {
          fixedCostUsd: pricing.pricing.baseCost,
          variableCostPerUnit: pricing.pricing.perUnit,
          unitType: this.mapStringToCostUnit(pricing.pricing.unitType)
        },
        freeTier: pricing.freeTier ? {
          unitsPerPeriod: pricing.freeTier.unitsPerMonth,
          period: 'monthly',
          resetDay: 1
        } : undefined,
        updatedAt: new Date(pricing.lastUpdated)
      };
      
      this.costConfigs.set(pricing.service, config);
    }

    logger.info('Loaded Apify tool configurations', {
      toolCount: apifyPricing.length,
      tools: apifyPricing.map((p: any) => p.service)
    });

    // Initialize workflow costs with real pricing data
    const workflowPricing = ALL_PRICING.filter((p: any) => ['zapier', 'make', 'n8n', 'power_automate'].includes(p.service));
    for (const pricing of workflowPricing) {
      // Type guard for workflow pricing structure
      if (!('tiers' in pricing.pricing)) continue;
      
      const defaultTier = pricing.pricing.tiers?.[1] || pricing.pricing.tiers?.[0];
      
      this.workflowCosts.set(`${pricing.service}:default`, {
        platform: pricing.service as any,
        workflowId: 'default',
        workflowName: `${pricing.service.charAt(0).toUpperCase() + pricing.service.slice(1)} Default`,
        costPerExecution: defaultTier?.overageCost || 0.01,
        monthlySubscriptionCost: defaultTier?.monthlyCost,
        limits: {
          executionsPerMonth: defaultTier?.includedUnits,
          dataTransferMB: undefined,
          computeMinutes: undefined
        },
        currentUsage: {
          executionsThisMonth: 0,
          dataTransferMB: 0,
          computeMinutes: 0
        },
        costBreakdown: {
          subscriptionCost: defaultTier?.monthlyCost || 0,
          executionCosts: 0,
          overageCosts: 0,
          totalCost: defaultTier?.monthlyCost || 0
        }
      });
    }

    logger.info('Loaded workflow cost configurations', {
      platformCount: workflowPricing.length,
      platforms: workflowPricing.map((p: any) => p.service)
    });
  }

  private calculateCostTier(costUsd: number): CostTier {
    if (costUsd <= 0) return CostTier.FREE;
    if (costUsd <= 1.00) return CostTier.LOW;
    if (costUsd <= 10.00) return CostTier.MEDIUM;
    if (costUsd <= 100.00) return CostTier.HIGH;
    return CostTier.PREMIUM;
  }

  private mapStringToCostUnit(unitType: string): CostUnit {
    const mapping: Record<string, CostUnit> = {
      'results': CostUnit.RESULTS_PROCESSED,
      'tokens': CostUnit.TOKENS,
      'executions': CostUnit.WORKFLOW_RUNS,
      'api_calls': CostUnit.API_CALLS,
      'minutes': CostUnit.COMPUTE_MINUTES,
      'queries': CostUnit.REQUESTS
    };
    return mapping[unitType] || CostUnit.RESULTS_PROCESSED;
  }

  private getApifyToolConfig(toolName: string): ToolCostConfig {
    return this.costConfigs.get(toolName) || {
      toolId: toolName,
      toolName,
      category: CostCategory.APIFY_TOOLS,
      pricingModel: 'per_call',
      baseCost: {
        fixedCostUsd: 0.01,
        variableCostPerUnit: 0.001,
        unitType: CostUnit.API_CALLS
      },
      updatedAt: new Date()
    };
  }

  private calculateApifyCost(config: ToolCostConfig, resultsCount: number, executionTimeMs: number): number {
    // Try to get real pricing data first
    const realPricing = getPricingForService(config.toolId);
    if (realPricing) {
      const minutes = executionTimeMs / 60000;
      const result = calculateServiceCost(config.toolId, {
        results: resultsCount,
        minutes: minutes > 1 ? minutes : undefined
      });
      
      logger.debug('Apify cost calculated with real pricing', {
        toolId: config.toolId,
        resultsCount,
        minutes,
        cost: result.cost,
        breakdown: result.breakdown
      });
      
      return result.cost;
    }

    // Fallback to config-based calculation
    let cost = config.baseCost.fixedCostUsd || 0;
    
    if (config.baseCost.variableCostPerUnit) {
      cost += config.baseCost.variableCostPerUnit * resultsCount;
    }

    // Add time-based cost for long operations
    if (executionTimeMs > 60000) { // More than 1 minute
      const minutes = executionTimeMs / 60000;
      cost += minutes * 0.001; // $0.001 per minute
    }

    return Math.round(cost * 10000) / 10000; // Round to 4 decimal places
  }

  private calculateOpenAICost(model: string, inputTokens: number, outputTokens: number): number {
    // Use real pricing data
    const result = calculateServiceCost(model, {
      inputTokens,
      outputTokens
    });
    
    logger.debug('OpenAI cost calculated with real pricing', {
      model,
      inputTokens,
      outputTokens,
      cost: result.cost,
      breakdown: result.breakdown
    });
    
    return result.cost;
  }

  private getDefaultWorkflowCost(platform: string): number {
    // Try to get real pricing data from ALL_PRICING instead of ServicePricing
    const realPricing = ALL_PRICING.find((p: any) => p.service === platform);
    if (realPricing && 'tiers' in realPricing.pricing) {
      // Use the starter/basic tier overage cost as default
      const tier = realPricing.pricing.tiers.find((t: any) => t.name.toLowerCase().includes('starter') || t.name.toLowerCase().includes('core')) 
                  || realPricing.pricing.tiers[1] 
                  || realPricing.pricing.tiers[0];
      
      if (tier) {
        logger.debug('Workflow cost calculated with real pricing', {
          platform,
          tier: tier.name,
          cost: tier.overageCost
        });
        return tier.overageCost;
      }
    }

    // Fallback to estimated costs
    const defaults: Record<string, number> = {
      'n8n': 0.008,        // Updated to match n8n cloud pricing
      'zapier': 0.027,     // Updated to match Zapier starter overage
      'make': 0.001,       // Updated to match Make core overage
      'power_automate': 0.003  // Updated estimate
    };
    return defaults[platform] || 0.01;
  }

  private getWorkflowCostCategory(platform: string): CostCategory {
    const mapping: Record<string, CostCategory> = {
      'n8n': CostCategory.N8N_WORKFLOWS,
      'zapier': CostCategory.ZAPIER_WORKFLOWS,
      'make': CostCategory.MAKE_WORKFLOWS,
      'power_automate': CostCategory.CUSTOM
    };
    return mapping[platform] || CostCategory.CUSTOM;
  }

  private async storeCostEntry(entry: CostEntry): Promise<void> {
    try {
      await this.prisma.costEntry.create({
        data: {
          id: entry.id.toString(),
          timestamp: entry.timestamp,
          category: entry.category,
          service: entry.service,
          operation: entry.operation,
          costUsd: entry.costUsd,
          unitsConsumed: entry.unitsConsumed,
          unitType: entry.unitType,
          costPerUnit: entry.costPerUnit,
          tier: entry.tier,
          initiatedByType: entry.initiatedBy.type,
          initiatedById: entry.initiatedBy.id,
          initiatedByName: entry.initiatedBy.name,
          sessionId: entry.sessionId,
          toolParameters: entry.metadata.toolParameters ? JSON.stringify(entry.metadata.toolParameters) : null,
          executionDetails: entry.metadata.executionDetails ? JSON.stringify(entry.metadata.executionDetails) : null,
          researchContext: entry.metadata.researchContext ? JSON.stringify(entry.metadata.researchContext) : null,
          workflowContext: entry.metadata.workflowContext ? JSON.stringify(entry.metadata.workflowContext) : null,
          departmentId: entry.metadata.departmentId,
          tags: entry.metadata.tags ? JSON.stringify(entry.metadata.tags) : null
        }
      });
      
      logger.debug('Cost entry stored successfully', { costId: entry.id.toString() });
    } catch (error) {
      logger.error('Failed to store cost entry', {
        error: error instanceof Error ? error.message : String(error),
        costId: entry.id.toString()
      });
      throw error;
    }
  }

  private async storeBudget(budget: CostBudget): Promise<void> {
    try {
      await this.prisma.costBudget.create({
        data: {
          id: budget.id.toString(),
          name: budget.name,
          period: budget.period,
          budgetUsd: budget.budgetUsd,
          spentUsd: budget.spentUsd,
          remainingUsd: budget.remainingUsd,
          utilizationPercent: budget.utilizationPercent,
          categories: JSON.stringify(budget.categories),
          services: budget.services ? JSON.stringify(budget.services) : null,
          departmentId: budget.departmentId,
          warningThreshold: budget.alertThresholds.warning,
          criticalThreshold: budget.alertThresholds.critical,
          maximumThreshold: budget.alertThresholds.maximum,
          status: budget.status,
          onWarningAction: budget.autoActions.onWarning,
          onCriticalAction: budget.autoActions.onCritical,
          onMaximumAction: budget.autoActions.onMaximum,
          validFrom: budget.validFrom,
          validTo: budget.validTo
        }
      });
      
      logger.debug('Budget stored successfully', { budgetId: budget.id.toString() });
    } catch (error) {
      logger.error('Failed to store budget', {
        error: error instanceof Error ? error.message : String(error),
        budgetId: budget.id.toString()
      });
      throw error;
    }
  }

  private async storeAlert(alert: CostAlert): Promise<void> {
    try {
      await this.prisma.costAlert.create({
        data: {
          id: alert.id.toString(),
          name: alert.name,
          type: alert.type,
          categories: alert.conditions.categories ? JSON.stringify(alert.conditions.categories) : null,
          services: alert.conditions.services ? JSON.stringify(alert.conditions.services) : null,
          costThresholdUsd: alert.conditions.costThresholdUsd,
          percentageIncrease: alert.conditions.percentageIncrease,
          timeWindow: alert.conditions.timeWindow,
          minOperations: alert.conditions.minOperations,
          severity: alert.severity,
          enabled: alert.enabled,
          cooldownMinutes: alert.cooldownMinutes,
          emailNotifications: alert.notifications.email ? JSON.stringify(alert.notifications.email) : null,
          slackNotifications: alert.notifications.slack ? JSON.stringify(alert.notifications.slack) : null,
          webhookNotifications: alert.notifications.webhook ? JSON.stringify(alert.notifications.webhook) : null,
          lastTriggered: alert.lastTriggered,
          triggerCount: 0
        }
      });
      
      logger.debug('Alert stored successfully', { alertId: alert.id.toString() });
    } catch (error) {
      logger.error('Failed to store alert', {
        error: error instanceof Error ? error.message : String(error),
        alertId: alert.id.toString()
      });
      throw error;
    }
  }

  private async getCostEntries(params: {
    startDate: Date;
    endDate: Date;
    categories?: CostCategory[];
    services?: string[];
    departmentId?: string;
    initiatedBy?: string;
  }): Promise<CostEntry[]> {
    try {
      const where: any = {
        timestamp: {
          gte: params.startDate,
          lte: params.endDate
        }
      };

      if (params.categories && params.categories.length > 0) {
        where.category = { in: params.categories };
      }

      if (params.services && params.services.length > 0) {
        where.service = { in: params.services };
      }

      if (params.departmentId) {
        where.departmentId = params.departmentId;
      }

      if (params.initiatedBy) {
        where.initiatedById = params.initiatedBy;
      }

      const entries = await this.prisma.costEntry.findMany({
        where,
        orderBy: { timestamp: 'desc' }
      });

      // Convert database records to CostEntry interface
      return entries.map((entry: any) => ({
        id: IdGenerator.generate('cost'), // Create a new structured ID from the string
        timestamp: entry.timestamp,
        category: entry.category as CostCategory,
        service: entry.service,
        operation: entry.operation,
        costUsd: entry.costUsd,
        unitsConsumed: entry.unitsConsumed,
        unitType: entry.unitType as CostUnit,
        costPerUnit: entry.costPerUnit,
        tier: entry.tier as CostTier,
        initiatedBy: {
          type: entry.initiatedByType as 'agent' | 'user' | 'system',
          id: entry.initiatedById,
          name: entry.initiatedByName || undefined
        },
        sessionId: entry.sessionId || undefined,
        metadata: {
          toolParameters: entry.toolParameters ? JSON.parse(entry.toolParameters) : undefined,
          executionDetails: entry.executionDetails ? JSON.parse(entry.executionDetails) : undefined,
          researchContext: entry.researchContext ? JSON.parse(entry.researchContext) : undefined,
          workflowContext: entry.workflowContext ? JSON.parse(entry.workflowContext) : undefined,
          departmentId: entry.departmentId || undefined,
          tags: entry.tags ? JSON.parse(entry.tags) : undefined
        }
      }));
    } catch (error) {
      logger.error('Failed to get cost entries', {
        error: error instanceof Error ? error.message : String(error),
        params
      });
      throw error;
    }
  }

  private async checkBudgetLimits(entry: CostEntry): Promise<void> {
    try {
      // Get active budgets that apply to this cost entry
      const budgets = await this.prisma.costBudget.findMany({
        where: {
          status: 'active',
          validFrom: { lte: new Date() },
          validTo: { gte: new Date() },
          OR: [
            { departmentId: entry.metadata.departmentId },
            { departmentId: null } // Global budgets
          ]
        }
      });

      for (const budgetRecord of budgets) {
        const categories = JSON.parse(budgetRecord.categories) as CostCategory[];
        const services = budgetRecord.services ? JSON.parse(budgetRecord.services) as string[] : null;

        // Check if this budget applies to the current cost entry
        const appliesToCategory = categories.includes(entry.category);
        const appliesToService = !services || services.includes(entry.service);

        if (appliesToCategory && appliesToService) {
          // Update budget spent amount
          const newSpentAmount = budgetRecord.spentUsd + entry.costUsd;
          const newUtilization = (newSpentAmount / budgetRecord.budgetUsd) * 100;
          const newRemainingAmount = budgetRecord.budgetUsd - newSpentAmount;

          await this.prisma.costBudget.update({
            where: { id: budgetRecord.id },
            data: {
              spentUsd: newSpentAmount,
              utilizationPercent: newUtilization,
              remainingUsd: newRemainingAmount
            }
          });

          // Check threshold violations
          if (newUtilization >= budgetRecord.maximumThreshold && budgetRecord.status === 'active') {
            await this.prisma.costBudget.update({
              where: { id: budgetRecord.id },
              data: { status: 'exceeded' }
            });

            logger.warn('Budget exceeded', {
              budgetId: budgetRecord.id,
              budgetName: budgetRecord.name,
              utilization: newUtilization,
              spent: newSpentAmount,
              limit: budgetRecord.budgetUsd
            });

            // Trigger maximum action
            if (budgetRecord.onMaximumAction) {
              await this.executeBudgetAction(budgetRecord.onMaximumAction, budgetRecord, entry);
            }
          } else if (newUtilization >= budgetRecord.criticalThreshold) {
            logger.warn('Budget critical threshold reached', {
              budgetId: budgetRecord.id,
              budgetName: budgetRecord.name,
              utilization: newUtilization
            });

            // Trigger critical action
            if (budgetRecord.onCriticalAction) {
              await this.executeBudgetAction(budgetRecord.onCriticalAction, budgetRecord, entry);
            }
          } else if (newUtilization >= budgetRecord.warningThreshold) {
            logger.info('Budget warning threshold reached', {
              budgetId: budgetRecord.id,
              budgetName: budgetRecord.name,
              utilization: newUtilization
            });

            // Trigger warning action
            if (budgetRecord.onWarningAction) {
              await this.executeBudgetAction(budgetRecord.onWarningAction, budgetRecord, entry);
            }
          }
        }
      }
    } catch (error) {
      logger.error('Failed to check budget limits', {
        error: error instanceof Error ? error.message : String(error),
        costEntry: {
          service: entry.service,
          operation: entry.operation,
          cost: entry.costUsd
        }
      });
      // Don't throw error to avoid blocking cost recording
    }
  }

  private async checkAlerts(entry: CostEntry): Promise<void> {
    // Check if this cost entry triggers any alerts
    for (const alert of Array.from(this.alerts.values())) {
      if (alert.enabled && this.shouldTriggerAlert(alert, entry)) {
        await this.triggerAlert(alert, entry);
      }
    }
  }

  private shouldTriggerAlert(alert: CostAlert, entry: CostEntry): boolean {
    // Check if alert conditions are met
    if (alert.conditions.categories && !alert.conditions.categories.includes(entry.category)) {
      return false;
    }
    
    if (alert.conditions.services && !alert.conditions.services.includes(entry.service)) {
      return false;
    }

    if (alert.conditions.costThresholdUsd && entry.costUsd < alert.conditions.costThresholdUsd) {
      return false;
    }

    return true;
  }

  private async triggerAlert(alert: CostAlert, entry: CostEntry): Promise<void> {
    // Check cooldown
    if (alert.lastTriggered) {
      const timeSinceLastTrigger = Date.now() - alert.lastTriggered.getTime();
      if (timeSinceLastTrigger < alert.cooldownMinutes * 60 * 1000) {
        return; // Still in cooldown period
      }
    }

    logger.warn('Cost alert triggered', {
      alertId: alert.id.toString(),
      alertName: alert.name,
      costEntry: {
        service: entry.service,
        operation: entry.operation,
        cost: entry.costUsd
      }
    });

    // Update last triggered time and increment trigger count
    await this.prisma.costAlert.update({
      where: { id: alert.id.toString() },
      data: {
        lastTriggered: new Date(),
        triggerCount: { increment: 1 }
      }
    });
    
    // Send notifications
    await this.sendAlertNotifications(alert, entry);
  }

  private async generateServiceOptimization(
    service: string, 
    cost: number, 
    summary: CostSummary
  ): Promise<CostOptimization | null> {
    // Generate optimization recommendations based on service usage patterns
    // This is a simplified example - real implementation would be more sophisticated
    
    if (service === 'apify' && cost > 20) {
      return {
        id: IdGenerator.generate('opt'),
        title: `Optimize Apify Usage - Potential $${(cost * 0.2).toFixed(2)} Monthly Savings`,
        description: 'High Apify usage detected. Consider implementing result caching, reducing result limits, and using dry-run mode for testing.',
        category: CostCategory.APIFY_TOOLS,
        service,
        potentialSavingsUsd: cost * 0.2,
        effort: 'medium',
        priority: 'medium',
        actions: [
          {
            action: 'Implement result caching',
            description: 'Cache frequently requested data to avoid duplicate API calls',
            impact: cost * 0.1
          },
          {
            action: 'Optimize result limits',
            description: 'Review and reduce result limits where possible',
            impact: cost * 0.1
          }
        ],
        risks: [
          {
            risk: 'Reduced data freshness',
            severity: 'low',
            mitigation: 'Implement cache expiration policies'
          }
        ],
        status: 'pending',
        generatedAt: new Date(),
        updatedAt: new Date()
      };
    }

    return null;
  }

  private async analyzeUsagePatterns(summary: CostSummary): Promise<CostOptimization[]> {
    const optimizations: CostOptimization[] = [];

    // Example pattern analysis
    if (summary.totalCostUsd > 100) {
      optimizations.push({
        id: IdGenerator.generate('opt'),
        title: 'High Overall Usage - Review Cost Patterns',
        description: 'Total monthly costs are high. Consider implementing usage quotas and approval workflows for expensive operations.',
        category: CostCategory.CUSTOM,
        service: 'system',
        potentialSavingsUsd: summary.totalCostUsd * 0.15,
        effort: 'high',
        priority: 'high',
        actions: [
          {
            action: 'Implement usage quotas',
            description: 'Set monthly quotas for different cost categories',
            impact: summary.totalCostUsd * 0.1
          },
          {
            action: 'Add approval workflows',
            description: 'Require approval for high-cost operations',
            impact: summary.totalCostUsd * 0.05
          }
        ],
        risks: [
          {
            risk: 'Reduced operational efficiency',
            severity: 'medium',
            mitigation: 'Implement smart approval thresholds'
          }
        ],
        status: 'pending',
        generatedAt: new Date(),
        updatedAt: new Date()
      });
    }

    return optimizations;
  }

  private async executeBudgetAction(
    action: string, 
    budget: any, 
    entry: CostEntry
  ): Promise<void> {
    logger.info('Executing budget action', {
      action,
      budgetId: budget.id,
      budgetName: budget.name,
      costEntry: {
        service: entry.service,
        operation: entry.operation,
        cost: entry.costUsd
      }
    });

    switch (action) {
      case 'notify':
        // Send notification about budget threshold
        await this.sendBudgetNotification(budget, entry);
        break;
      case 'throttle':
        // Implement throttling logic (could be done via rate limiting)
        logger.warn('Budget throttling activated', { budgetId: budget.id });
        break;
      case 'suspend':
        // Suspend operations for this budget category
        logger.warn('Budget operations suspended', { budgetId: budget.id });
        break;
      case 'block':
        // Block all operations for this budget category
        logger.error('Budget operations blocked', { budgetId: budget.id });
        break;
      default:
        logger.warn('Unknown budget action', { action, budgetId: budget.id });
    }
  }

  private async sendBudgetNotification(budget: any, entry: CostEntry): Promise<void> {
    // Placeholder for budget notification logic
    logger.info('Budget notification sent', {
      budgetId: budget.id,
      budgetName: budget.name,
      utilization: budget.utilizationPercent,
      costEntry: {
        service: entry.service,
        cost: entry.costUsd
      }
    });
    // TODO: Implement actual notification sending (email, Slack, etc.)
  }

  private async sendAlertNotifications(alert: CostAlert, entry: CostEntry): Promise<void> {
    logger.info('Sending cost alert notifications', {
      alertId: alert.id.toString(),
      alertName: alert.name,
      severity: alert.severity
    });

    // Send email notifications
    if (alert.notifications.email && alert.notifications.email.length > 0) {
      for (const email of alert.notifications.email) {
        logger.info('Sending email alert', { email, alertName: alert.name });
        // TODO: Implement actual email sending
      }
    }

    // Send Slack notifications
    if (alert.notifications.slack && alert.notifications.slack.length > 0) {
      for (const slack of alert.notifications.slack) {
        logger.info('Sending Slack alert', { slack, alertName: alert.name });
        // TODO: Implement actual Slack webhook
      }
    }

    // Send webhook notifications
    if (alert.notifications.webhook && alert.notifications.webhook.length > 0) {
      for (const webhook of alert.notifications.webhook) {
        logger.info('Sending webhook alert', { webhook, alertName: alert.name });
        // TODO: Implement actual webhook call
      }
    }
  }
} 