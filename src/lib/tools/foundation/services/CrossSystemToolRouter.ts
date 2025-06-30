/**
 * Cross-System Tool Router Service
 * 
 * Implements Phase 3.1 intelligent tool routing and composition capabilities.
 * Routes requests to the most appropriate tools across all systems and handles
 * smart fallbacks, load balancing, and tool composition.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md principles:
 * - ULID for business logic tracking
 * - Structured error handling
 * - Pure function routing logic
 * - Comprehensive logging
 * 
 * Phase 3.1 Features:
 * - Intelligent tool routing across all systems
 * - Smart fallback mechanisms with alternatives
 * - Tool load balancing and caching
 * - Automatic tool composition and chaining
 */

import { IUnifiedToolRegistry } from '../interfaces/UnifiedToolRegistryInterface';
import { IToolDiscoveryService } from '../interfaces/ToolDiscoveryServiceInterface';
import { IUnifiedToolExecutor } from '../interfaces/UnifiedToolExecutorInterface';
import {
  UnifiedTool,
  ToolParameters,
  ExecutionContext,
  ToolResult,
  ToolIdentifier,
  SearchContext
} from '../types/FoundationTypes';
import { ToolCategory, ToolCapability } from '../enums/ToolEnums';
import { IStructuredLogger } from '../../../logging/interfaces/IStructuredLogger';
import { ToolExecutionError, ToolNotFoundError } from '../errors/ToolFoundationErrors';
import { ulid } from 'ulid';

/**
 * Tool routing decision with confidence and alternatives
 */
export interface ToolRoutingDecision {
  readonly routingId: string;
  readonly primaryTool: UnifiedTool;
  readonly confidence: number;
  readonly alternatives: readonly {
    readonly tool: UnifiedTool;
    readonly confidence: number;
    readonly reason: string;
  }[];
  readonly routingReason: string;
  readonly estimatedExecutionTime: number;
  readonly requiredCapabilities: readonly ToolCapability[];
}

/**
 * Tool composition plan for multi-tool workflows
 */
export interface ToolCompositionPlan {
  readonly compositionId: string;
  readonly name: string;
  readonly description: string;
  readonly steps: readonly {
    readonly stepId: string;
    readonly tool: UnifiedTool;
    readonly parameters: ToolParameters;
    readonly dependsOn: readonly string[];
    readonly outputMapping?: Record<string, string>;
    readonly timeout?: number;
  }[];
  readonly estimatedTotalTime: number;
  readonly complexity: 'low' | 'medium' | 'high';
  readonly successProbability: number;
}

/**
 * Tool routing strategy configuration
 */
export interface RoutingStrategy {
  readonly prioritizeFastTools: boolean;
  readonly prioritizeReliableTools: boolean;
  readonly enableLoadBalancing: boolean;
  readonly enableCaching: boolean;
  readonly maxAlternatives: number;
  readonly fallbackTimeout: number;
  readonly compositionEnabled: boolean;
}

/**
 * Cross-System Tool Router Implementation
 */
export class CrossSystemToolRouter {
  private readonly routingStrategy: RoutingStrategy = {
    prioritizeFastTools: true,
    prioritizeReliableTools: true,
    enableLoadBalancing: true,
    enableCaching: true,
    maxAlternatives: 3,
    fallbackTimeout: 30000, // 30 seconds
    compositionEnabled: true
  };

  private readonly executionCache = new Map<string, { result: ToolResult; timestamp: number }>();
  private readonly loadBalancingMap = new Map<string, number>(); // Tool usage tracking
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly registry: IUnifiedToolRegistry,
    private readonly discoveryService: IToolDiscoveryService,
    private readonly executor: IUnifiedToolExecutor,
    private readonly logger: IStructuredLogger
  ) { }

  /**
   * Routes a request to the most appropriate tool with intelligent fallbacks
   */
  async routeToolRequest(
    intent: string,
    parameters: ToolParameters,
    context: ExecutionContext,
    strategy?: Partial<RoutingStrategy>
  ): Promise<ToolResult> {
    const routingId = ulid();
    const effectiveStrategy = { ...this.routingStrategy, ...strategy };

    try {
      await this.logger.info('Starting intelligent tool routing', {
        routingId,
        strategy: effectiveStrategy,
        userIntent: intent
      });

      // Step 1: Get routing decision
      const routingDecision = await this.getRoutingDecision(intent, context, effectiveStrategy);

      // Step 2: Try primary tool
      try {
        const result = await this.executeWithCaching(
          routingDecision.primaryTool,
          parameters,
          context,
          effectiveStrategy
        );

        if (result.success) {
          await this.logger.info('Primary tool execution successful', {
            routingId,
            toolName: routingDecision.primaryTool.name,
            executionTime: result.durationMs
          });
          return result;
        }
      } catch (primaryError) {
        await this.logger.warn('Primary tool execution failed, trying alternatives', {
          routingId,
          primaryTool: routingDecision.primaryTool.name,
          error: primaryError instanceof Error ? primaryError.message : 'Unknown error'
        });
      }

      // Step 3: Try alternatives if primary fails
      for (const alternative of routingDecision.alternatives) {
        try {
          const result = await this.executeWithCaching(
            alternative.tool,
            parameters,
            context,
            effectiveStrategy
          );

          if (result.success) {
            await this.logger.info('Alternative tool execution successful', {
              routingId,
              toolName: alternative.tool.name,
              reason: alternative.reason,
              executionTime: result.durationMs
            });
            return result;
          }
        } catch (alternativeError) {
          await this.logger.warn('Alternative tool execution failed', {
            routingId,
            alternativeTool: alternative.tool.name,
            error: alternativeError instanceof Error ? alternativeError.message : 'Unknown error'
          });
        }
      }

      // Step 4: All tools failed
      throw new ToolExecutionError(
        `All routing options failed for intent: ${intent}. Tried tools: ${[routingDecision.primaryTool.name, ...routingDecision.alternatives.map(a => a.tool.name)].join(', ')}`,
        {
          toolId: routingDecision.primaryTool.id,
          toolName: routingDecision.primaryTool.name,
          parameters,
          executionTimeMs: 0
        }
      );

    } catch (error) {
      await this.logger.error('Tool routing failed', {
        routingId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userIntent: intent
      });
      throw error;
    }
  }

  /**
   * Creates a tool composition plan for complex multi-tool workflows
   */
  async createCompositionPlan(
    workflow: string,
    context: ExecutionContext,
    parameters?: ToolParameters
  ): Promise<ToolCompositionPlan> {
    const compositionId = ulid();

    try {
      await this.logger.info('Creating tool composition plan', {
        workflow,
        compositionId
      });

      // Discover relevant cross-system workflows
      const workflows = await this.discoveryService.discoverCrossSystemWorkflows(workflow, {
        agentId: context.agentId,
        userId: context.userId,
        workspaceId: context.workspaceId
      });

      if (workflows.length === 0) {
        throw new ToolNotFoundError(
          `No cross-system workflows found for: ${workflow}`,
          {
            identifier: workflow,
            availableTools: [],
            suggestedTools: [],
            searchCriteria: { workflow }
          }
        );
      }

      // Select the best workflow
      const selectedWorkflow = workflows[0];

      // Create composition steps
      const steps = await Promise.all(
        selectedWorkflow.toolChain.map(async (chainStep, index) => {
          // Use getTool instead of getToolByName
          const tool = await this.registry.getTool(chainStep.toolName);
          if (!tool) {
            throw new ToolNotFoundError(
              `Tool not found in composition: ${chainStep.toolName}`,
              {
                identifier: chainStep.toolName,
                availableTools: await this.registry.getAllToolNames(),
                suggestedTools: [],
                searchCriteria: { toolName: chainStep.toolName }
              }
            );
          }

          return {
            stepId: ulid(),
            tool,
            parameters: parameters || {},
            dependsOn: chainStep.dependsOn || [],
            outputMapping: chainStep.outputMapping,
            timeout: 60000 // 1 minute default
          };
        })
      );

      // Calculate estimates
      const estimatedTotalTime = steps.reduce((total, step) => total + (step.timeout || 60000), 0);
      const complexity = this.calculateComplexity(steps);
      const successProbability = this.calculateSuccessProbability(steps);

      const compositionPlan: ToolCompositionPlan = {
        compositionId,
        name: selectedWorkflow.name,
        description: selectedWorkflow.description,
        steps,
        estimatedTotalTime,
        complexity,
        successProbability
      };

      await this.logger.info('Tool composition plan created', {
        compositionId,
        stepsCount: steps.length,
        estimatedTime: estimatedTotalTime,
        complexity,
        successProbability
      });

      return compositionPlan;

    } catch (error) {
      await this.logger.error('Tool composition planning failed', {
        workflow,
        compositionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Executes a tool composition plan with dependency management
   */
  async executeComposition(
    plan: ToolCompositionPlan,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const executionId = ulid();

    try {
      await this.logger.info('Starting composition execution', {
        compositionId: plan.compositionId,
        executionId,
        stepsCount: plan.steps.length
      });

      const stepResults = new Map<string, ToolResult>();
      const executedSteps: string[] = [];

      // Execute steps in dependency order
      for (const step of plan.steps) {
        // Check if dependencies are satisfied
        const unsatisfiedDeps = step.dependsOn.filter(dep => !executedSteps.includes(dep));
        if (unsatisfiedDeps.length > 0) {
          throw new ToolExecutionError(
            `Unsatisfied dependencies for step ${step.stepId}: ${unsatisfiedDeps.join(', ')}`,
            {
              toolId: step.tool.id,
              toolName: step.tool.name,
              parameters: step.parameters,
              executionTimeMs: 0
            }
          );
        }

        // Prepare parameters with output mapping from previous steps
        let stepParameters = { ...step.parameters };
        if (step.outputMapping) {
          for (const [sourceKey, targetKey] of Object.entries(step.outputMapping)) {
            const sourceResult = Array.from(stepResults.values()).find(result =>
              result.data && typeof result.data === 'object' && sourceKey in result.data
            );
            if (sourceResult && sourceResult.data && typeof sourceResult.data === 'object') {
              stepParameters[targetKey] = (sourceResult.data as Record<string, unknown>)[sourceKey];
            }
          }
        }

        // Execute step
        const stepResult = await this.executor.execute(step.tool, stepParameters, context);
        stepResults.set(step.stepId, stepResult);
        executedSteps.push(step.stepId);

        await this.logger.info('Composition step completed', {
          compositionId: plan.compositionId,
          executionId,
          stepId: step.stepId,
          toolName: step.tool.name,
          success: stepResult.success
        });

        if (!stepResult.success) {
          throw new ToolExecutionError(
            `Composition step failed: ${step.tool.name}. Error: ${stepResult.error || 'Unknown error'}`,
            {
              toolId: step.tool.id,
              toolName: step.tool.name,
              parameters: stepParameters,
              executionTimeMs: stepResult.durationMs || 0
            }
          );
        }
      }

      // Combine results
      const combinedData = Array.from(stepResults.values()).map(result => result.data);
      const totalDuration = Array.from(stepResults.values()).reduce(
        (total, result) => total + (result.durationMs || 0), 0
      );

      const finalResult: ToolResult = {
        success: true,
        data: {
          compositionId: plan.compositionId,
          executionId,
          steps: combinedData,
          summary: `Successfully executed ${plan.steps.length} steps`
        },
        durationMs: totalDuration,
        startedAt: new Date(),
        metadata: {
          executionTimeMs: totalDuration,
          toolId: plan.compositionId,
          toolName: plan.name,
          timestamp: new Date().toISOString(),
          context: {
            compositionPlan: plan.name,
            stepsExecuted: executedSteps.length,
            totalSteps: plan.steps.length
          }
        }
      };

      await this.logger.info('Composition execution completed', {
        compositionId: plan.compositionId,
        executionId,
        totalDuration,
        stepsCompleted: executedSteps.length
      });

      return finalResult;

    } catch (error) {
      await this.logger.error('Composition execution failed', {
        compositionId: plan.compositionId,
        executionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Gets routing decision for a given intent
   */
  private async getRoutingDecision(
    intent: string,
    context: ExecutionContext,
    strategy: RoutingStrategy
  ): Promise<ToolRoutingDecision> {
    const routingId = ulid();

    // Search for relevant tools
    const searchResults = await this.discoveryService.searchTools(intent, {
      agentId: context.agentId,
      userId: context.userId,
      workspaceId: context.workspaceId,
      permissions: context.permissions,
      maxResults: strategy.maxAlternatives + 1
    });

    if (searchResults.length === 0) {
      throw new ToolNotFoundError(
        `No tools found for intent: ${intent}`,
        {
          identifier: intent,
          availableTools: await this.registry.getAllToolNames(),
          suggestedTools: [],
          searchCriteria: { userIntent: intent }
        }
      );
    }

    // Score tools based on strategy
    const scoredTools = searchResults.map(result => ({
      tool: result.tool,
      score: this.calculateRoutingScore(result.tool, strategy)
    })).sort((a, b) => b.score - a.score);

    const primaryTool = scoredTools[0].tool;
    const alternatives = scoredTools.slice(1, strategy.maxAlternatives + 1).map(scored => ({
      tool: scored.tool,
      confidence: scored.score,
      reason: this.getRoutingReason(scored.tool, strategy)
    }));

    return {
      routingId,
      primaryTool,
      confidence: scoredTools[0].score,
      alternatives,
      routingReason: this.getRoutingReason(primaryTool, strategy),
      estimatedExecutionTime: primaryTool.averageExecutionTime,
      requiredCapabilities: primaryTool.capabilities
    };
  }

  /**
   * Executes a tool with caching support
   */
  private async executeWithCaching(
    tool: UnifiedTool,
    parameters: ToolParameters,
    context: ExecutionContext,
    strategy: RoutingStrategy
  ): Promise<ToolResult> {
    // Check cache if enabled
    if (strategy.enableCaching) {
      const cacheKey = this.generateCacheKey(tool.id, parameters);
      const cached = this.executionCache.get(cacheKey);

      if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
        await this.logger.info('Cache hit for tool execution', {
          toolName: tool.name,
          cacheKey
        });
        return cached.result;
      }
    }

    // Update load balancing
    if (strategy.enableLoadBalancing) {
      const currentLoad = this.loadBalancingMap.get(tool.id) || 0;
      this.loadBalancingMap.set(tool.id, currentLoad + 1);
    }

    // Execute tool
    const result = await this.executor.execute(tool, parameters, context);

    // Cache result if successful and caching is enabled
    if (strategy.enableCaching && result.success) {
      const cacheKey = this.generateCacheKey(tool.id, parameters);
      this.executionCache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });
    }

    return result;
  }

  /**
   * Calculates routing score for a tool based on strategy
   */
  private calculateRoutingScore(tool: UnifiedTool, strategy: RoutingStrategy): number {
    let score = 0;

    // Base relevance score
    score += 50;

    // Fast tools bonus
    if (strategy.prioritizeFastTools) {
      const fastBonus = Math.max(0, 100 - tool.averageExecutionTime / 100);
      score += fastBonus * 0.3;
    }

    // Reliable tools bonus
    if (strategy.prioritizeReliableTools) {
      score += tool.successRate * 0.4;
    }

    // Load balancing penalty
    if (strategy.enableLoadBalancing) {
      const currentLoad = this.loadBalancingMap.get(tool.id) || 0;
      const loadPenalty = Math.min(20, currentLoad * 2);
      score -= loadPenalty;
    }

    return Math.max(0, score);
  }

  /**
   * Gets routing reason for a tool
   */
  private getRoutingReason(tool: UnifiedTool, strategy: RoutingStrategy): string {
    const reasons: string[] = [];

    if (strategy.prioritizeFastTools && tool.averageExecutionTime < 1000) {
      reasons.push('fast execution');
    }

    if (strategy.prioritizeReliableTools && tool.successRate > 0.9) {
      reasons.push('high reliability');
    }

    if (tool.executionCount > 100) {
      reasons.push('proven performance');
    }

    return reasons.length > 0 ? reasons.join(', ') : 'best available option';
  }

  /**
   * Calculates complexity of a composition plan
   */
  private calculateComplexity(steps: readonly any[]): 'low' | 'medium' | 'high' {
    if (steps.length <= 2) return 'low';
    if (steps.length <= 5) return 'medium';
    return 'high';
  }

  /**
   * Calculates success probability of a composition plan
   */
  private calculateSuccessProbability(steps: readonly any[]): number {
    const averageSuccessRate = steps.reduce((sum, step) => sum + step.tool.successRate, 0) / steps.length;
    // Compound probability with slight degradation for complexity
    return Math.max(0.1, averageSuccessRate * Math.pow(0.95, steps.length - 1));
  }

  /**
   * Generates cache key for tool execution
   */
  private generateCacheKey(toolId: string, parameters: ToolParameters): string {
    const paramHash = JSON.stringify(parameters, Object.keys(parameters).sort());
    return `${toolId}:${Buffer.from(paramHash).toString('base64')}`;
  }

  /**
   * Clears execution cache
   */
  async clearCache(): Promise<void> {
    this.executionCache.clear();
    await this.logger.info('Tool routing cache cleared');
  }

  /**
   * Gets routing statistics
   */
  async getRoutingStats(): Promise<{
    readonly cacheHitRate: number;
    readonly totalExecutions: number;
    readonly averageRoutingTime: number;
    readonly topTools: readonly { toolId: string; executions: number }[];
  }> {
    const totalExecutions = Array.from(this.loadBalancingMap.values()).reduce((sum, count) => sum + count, 0);
    const topTools = Array.from(this.loadBalancingMap.entries())
      .map(([toolId, executions]) => ({ toolId, executions }))
      .sort((a, b) => b.executions - a.executions)
      .slice(0, 10);

    return {
      cacheHitRate: 0.85, // Mock value - would track real cache hits
      totalExecutions,
      averageRoutingTime: 150, // Mock value - would track real routing times
      topTools
    };
  }
} 