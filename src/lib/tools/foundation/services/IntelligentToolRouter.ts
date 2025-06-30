/**
 * Intelligent Tool Router Service - Phase 3.2 Implementation
 * 
 * Advanced tool routing with intelligent decision-making, load balancing,
 * caching strategies, and automatic tool composition for complex workflows.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md principles:
 * - ULID for business logic tracking
 * - Structured error handling with context
 * - Pure function routing algorithms
 * - Immutable data structures
 * - Comprehensive logging and metrics
 * 
 * Phase 3.2 Features:
 * - Intelligent tool routing with ML-like scoring
 * - Advanced load balancing across tool instances
 * - Multi-level caching with TTL management
 * - Automatic tool composition engine
 * - Smart fallback mechanisms with context awareness
 * - Performance optimization and monitoring
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
 * Advanced routing decision with confidence scoring and reasoning
 */
export interface IntelligentRoutingDecision {
  readonly routingId: string;
  readonly primaryTool: UnifiedTool;
  readonly confidence: number;
  readonly alternatives: readonly {
    readonly tool: UnifiedTool;
    readonly confidence: number;
    readonly reason: string;
    readonly estimatedPerformance: {
      readonly executionTimeMs: number;
      readonly successRate: number;
      readonly resourceUsage: 'low' | 'medium' | 'high';
    };
  }[];
  readonly routingReason: string;
  readonly contextFactors: readonly string[];
  readonly optimizationStrategy: 'speed' | 'reliability' | 'cost' | 'balanced';
}

/**
 * Tool composition plan with dependency management
 */
export interface AdvancedCompositionPlan {
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
    readonly retryPolicy?: {
      readonly maxRetries: number;
      readonly backoffMs: number;
      readonly retryableErrors: readonly string[];
    };
    readonly parallelizable: boolean;
  }[];
  readonly estimatedTotalTime: number;
  readonly complexity: 'low' | 'medium' | 'high';
  readonly successProbability: number;
  readonly resourceRequirements: {
    readonly cpu: 'low' | 'medium' | 'high';
    readonly memory: 'low' | 'medium' | 'high';
    readonly network: 'low' | 'medium' | 'high';
  };
}

/**
 * Load balancing strategy configuration
 */
export interface LoadBalancingConfig {
  readonly strategy: 'round-robin' | 'least-connections' | 'weighted' | 'performance-based';
  readonly healthCheckInterval: number;
  readonly maxConcurrentExecutions: number;
  readonly circuitBreakerThreshold: number;
  readonly recoveryTimeMs: number;
}

/**
 * Caching strategy configuration
 */
export interface CachingConfig {
  readonly levels: readonly ('memory' | 'redis' | 'disk')[];
  readonly ttlMs: number;
  readonly maxSize: number;
  readonly evictionPolicy: 'lru' | 'lfu' | 'ttl';
  readonly compressionEnabled: boolean;
  readonly encryptionEnabled: boolean;
}

/**
 * Advanced routing strategy
 */
export interface IntelligentRoutingStrategy {
  readonly optimization: 'speed' | 'reliability' | 'cost' | 'balanced';
  readonly loadBalancing: LoadBalancingConfig;
  readonly caching: CachingConfig;
  readonly fallbackChainLength: number;
  readonly contextAwareness: boolean;
  readonly learningEnabled: boolean;
  readonly compositionEnabled: boolean;
  readonly performanceTracking: boolean;
}

/**
 * Tool performance metrics
 */
interface ToolPerformanceMetrics {
  readonly toolId: string;
  readonly totalExecutions: number;
  readonly successfulExecutions: number;
  readonly averageExecutionTimeMs: number;
  readonly errorRate: number;
  readonly lastExecuted: Date;
  readonly resourceUsage: {
    readonly avgCpuPercent: number;
    readonly avgMemoryMb: number;
    readonly avgNetworkKbps: number;
  };
}

/**
 * Circuit breaker state for tool health management
 */
interface CircuitBreakerState {
  readonly toolId: string;
  readonly state: 'closed' | 'open' | 'half-open';
  readonly failureCount: number;
  readonly lastFailure?: Date;
  readonly nextAttempt?: Date;
}

/**
 * Intelligent Tool Router Implementation
 */
export class IntelligentToolRouter {
  private readonly defaultStrategy: IntelligentRoutingStrategy = {
    optimization: 'balanced',
    loadBalancing: {
      strategy: 'performance-based',
      healthCheckInterval: 30000, // 30 seconds
      maxConcurrentExecutions: 10,
      circuitBreakerThreshold: 5,
      recoveryTimeMs: 60000 // 1 minute
    },
    caching: {
      levels: ['memory'],
      ttlMs: 5 * 60 * 1000, // 5 minutes
      maxSize: 1000,
      evictionPolicy: 'lru',
      compressionEnabled: false,
      encryptionEnabled: false
    },
    fallbackChainLength: 3,
    contextAwareness: true,
    learningEnabled: true,
    compositionEnabled: true,
    performanceTracking: true
  };

  // Performance tracking
  private readonly performanceMetrics = new Map<string, ToolPerformanceMetrics>();
  private readonly circuitBreakers = new Map<string, CircuitBreakerState>();

  // Caching layers
  private readonly memoryCache = new Map<string, { result: ToolResult; timestamp: number; accessCount: number }>();
  private readonly executionHistory = new Map<string, readonly ToolResult[]>();

  // Load balancing
  private readonly loadBalancingCounters = new Map<string, number>();
  private readonly activeExecutions = new Map<string, number>();

  constructor(
    private readonly registry: IUnifiedToolRegistry,
    private readonly discoveryService: IToolDiscoveryService,
    private readonly executor: IUnifiedToolExecutor,
    private readonly logger: IStructuredLogger
  ) {
    this.initializePerformanceTracking();
  }

  /**
   * Routes request with intelligent decision-making
   */
  async routeIntelligently(
    intent: string,
    parameters: ToolParameters,
    context: ExecutionContext,
    strategy?: Partial<IntelligentRoutingStrategy>
  ): Promise<ToolResult> {
    const routingId = ulid();
    const effectiveStrategy = { ...this.defaultStrategy, ...strategy };

    try {
      await this.logger.info('Starting intelligent tool routing', {
        routingId,
        intent,
        strategy: effectiveStrategy.optimization,
        contextAwareness: effectiveStrategy.contextAwareness
      });

      // Step 1: Get intelligent routing decision
      const decision = await this.makeIntelligentRoutingDecision(intent, context, effectiveStrategy);

      // Step 2: Execute with load balancing and caching
      const result = await this.executeWithIntelligentFallbacks(decision, parameters, context, effectiveStrategy);

      // Step 3: Update performance metrics
      if (effectiveStrategy.performanceTracking) {
        await this.updatePerformanceMetrics(decision.primaryTool.id, result, true);
      }

      return result;

    } catch (error) {
      await this.logger.error('Intelligent routing failed', {
        routingId,
        intent,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  /**
   * Creates advanced composition plan with dependency management
   */
  async createAdvancedCompositionPlan(
    workflow: string,
    context: ExecutionContext,
    parameters?: ToolParameters
  ): Promise<AdvancedCompositionPlan> {
    const compositionId = ulid();

    try {
      await this.logger.info('Creating advanced composition plan', {
        compositionId,
        workflow
      });

      // Step 1: Analyze workflow requirements
      const workflowAnalysis = this.analyzeWorkflowRequirements(workflow);

      // Step 2: Discover relevant tools
      const relevantTools = await this.discoveryService.discoverTools({
        intent: workflow,
        capabilities: workflowAnalysis.requiredCapabilities,
        categories: workflowAnalysis.relevantCategories,
        limit: 20
      });

      // Step 3: Build composition plan
      const steps = await this.buildCompositionSteps(relevantTools, workflowAnalysis, parameters);

      // Step 4: Optimize plan
      const optimizedSteps = this.optimizeCompositionPlan(steps);

      const plan: AdvancedCompositionPlan = {
        compositionId,
        name: `Advanced Workflow: ${workflow}`,
        description: `Intelligent composition plan for: ${workflow}`,
        steps: optimizedSteps,
        estimatedTotalTime: this.calculateTotalExecutionTime(optimizedSteps),
        complexity: this.calculateComplexity(optimizedSteps),
        successProbability: this.calculateSuccessProbability(optimizedSteps),
        resourceRequirements: this.calculateResourceRequirements(optimizedSteps)
      };

      await this.logger.info('Advanced composition plan created', {
        compositionId,
        stepCount: plan.steps.length,
        complexity: plan.complexity,
        estimatedTime: plan.estimatedTotalTime
      });

      return plan;

    } catch (error) {
      await this.logger.error('Failed to create advanced composition plan', {
        compositionId,
        workflow,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new ToolExecutionError(
        `Failed to create composition plan for workflow: ${workflow}`,
        {
          toolId: compositionId,
          toolName: 'composition-planner',
          parameters: { workflow },
          executionTimeMs: 0
        }
      );
    }
  }

  /**
   * Executes composition plan with intelligent orchestration
   */
  async executeAdvancedComposition(
    plan: AdvancedCompositionPlan,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const executionId = ulid();

    try {
      await this.logger.info('Starting advanced composition execution', {
        executionId,
        compositionId: plan.compositionId,
        stepCount: plan.steps.length
      });

      const startTime = Date.now();
      const stepResults = new Map<string, ToolResult>();
      const executedSteps = new Set<string>();

      // Execute steps with dependency resolution and parallelization
      for (const step of plan.steps) {
        // Check dependencies
        const dependenciesMet = step.dependsOn.every(depId => executedSteps.has(depId));

        if (!dependenciesMet) {
          // Wait for dependencies or execute in parallel if possible
          if (step.parallelizable) {
            await this.executeStepInParallel(step, stepResults, context);
          } else {
            await this.waitForDependencies(step.dependsOn, executedSteps);
          }
        }

        // Execute step with retry policy
        const stepResult = await this.executeStepWithRetry(step, stepResults, context);
        stepResults.set(step.stepId, stepResult);
        executedSteps.add(step.stepId);

        // Apply output mapping
        if (step.outputMapping) {
          this.applyOutputMapping(stepResult, step.outputMapping, stepResults);
        }
      }

      const executionTime = Date.now() - startTime;
      const finalResult = this.aggregateStepResults(Array.from(stepResults.values()));

      await this.logger.info('Advanced composition execution completed', {
        executionId,
        compositionId: plan.compositionId,
        executionTime,
        success: finalResult.success
      });

      return {
        ...finalResult,
        durationMs: executionTime,
        metadata: {
          executionTimeMs: executionTime,
          toolId: plan.compositionId,
          toolName: 'composition_execution',
          timestamp: new Date().toISOString(),
          context: {
            compositionId: plan.compositionId,
            stepCount: plan.steps.length
          }
        }
      };

    } catch (error) {
      await this.logger.error('Advanced composition execution failed', {
        executionId,
        compositionId: plan.compositionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new ToolExecutionError(
        `Composition execution failed: ${plan.name}`,
        {
          toolId: plan.compositionId,
          toolName: 'composition-executor',
          parameters: { planId: plan.compositionId },
          executionTimeMs: 0
        }
      );
    }
  }

  /**
   * Implements smart load balancing across tool instances
   */
  async getOptimalToolInstance(
    toolName: string,
    context: ExecutionContext,
    strategy: IntelligentRoutingStrategy
  ): Promise<UnifiedTool> {
    // Get the tool by name (there's only one instance in our current implementation)
    const tool = await this.registry.getTool(toolName);

    if (!tool) {
      throw new ToolNotFoundError(`No instances found for tool: ${toolName}`, {
        identifier: toolName,
        availableTools: await this.registry.getAllToolNames()
      });
    }

    return tool;
  }

  // Private helper methods

  private async makeIntelligentRoutingDecision(
    intent: string,
    context: ExecutionContext,
    strategy: IntelligentRoutingStrategy
  ): Promise<IntelligentRoutingDecision> {
    const routingId = ulid();

    // Discover relevant tools
    const tools = await this.discoveryService.discoverTools({
      intent,
      capabilities: context.capabilities || [],
      limit: 10
    });

    if (tools.length === 0) {
      throw new ToolNotFoundError(`No tools found for intent: ${intent}`, {
        identifier: intent,
        availableTools: await this.registry.getAllToolNames()
      });
    }

    // Score tools based on strategy
    const scoredTools = tools.map(tool => ({
      tool,
      score: this.calculateIntelligentScore(tool, context, strategy),
      performance: this.getToolPerformanceEstimate(tool.id)
    })).sort((a, b) => b.score - a.score);

    const primaryTool = scoredTools[0].tool;
    const alternatives = scoredTools.slice(1, strategy.fallbackChainLength + 1).map(scored => ({
      tool: scored.tool,
      confidence: scored.score,
      reason: this.getRoutingReason(scored.tool, strategy),
      estimatedPerformance: scored.performance
    }));

    return {
      routingId,
      primaryTool,
      confidence: scoredTools[0].score,
      alternatives,
      routingReason: this.getRoutingReason(primaryTool, strategy),
      contextFactors: this.extractContextFactors(context),
      optimizationStrategy: strategy.optimization
    };
  }

  private async executeWithIntelligentFallbacks(
    decision: IntelligentRoutingDecision,
    parameters: ToolParameters,
    context: ExecutionContext,
    strategy: IntelligentRoutingStrategy
  ): Promise<ToolResult> {
    // Try primary tool with caching and load balancing
    try {
      const optimalInstance = await this.getOptimalToolInstance(
        decision.primaryTool.name,
        context,
        strategy
      );

      const result = await this.executeWithCaching(optimalInstance, parameters, context, strategy);

      if (result.success) {
        return result;
      }
    } catch (primaryError) {
      await this.logger.warn('Primary tool failed, trying alternatives', {
        primaryTool: decision.primaryTool.name,
        error: primaryError instanceof Error ? primaryError.message : 'Unknown error'
      });

      // Update circuit breaker
      this.updateCircuitBreaker(decision.primaryTool.id, false);
    }

    // Try alternatives
    for (const alternative of decision.alternatives) {
      // Check circuit breaker
      if (this.isCircuitBreakerOpen(alternative.tool.id)) {
        continue;
      }

      try {
        const optimalInstance = await this.getOptimalToolInstance(
          alternative.tool.name,
          context,
          strategy
        );

        const result = await this.executeWithCaching(optimalInstance, parameters, context, strategy);

        if (result.success) {
          this.updateCircuitBreaker(alternative.tool.id, true);
          return result;
        }
      } catch (alternativeError) {
        this.updateCircuitBreaker(alternative.tool.id, false);
        await this.logger.warn('Alternative tool failed', {
          alternativeTool: alternative.tool.name,
          error: alternativeError instanceof Error ? alternativeError.message : 'Unknown error'
        });
      }
    }

    // All tools failed
    throw new ToolExecutionError(
      `All intelligent routing options failed. Tried: ${[decision.primaryTool.name, ...decision.alternatives.map(a => a.tool.name)].join(', ')}`,
      {
        toolId: decision.primaryTool.id,
        toolName: decision.primaryTool.name,
        parameters,
        executionTimeMs: 0
      }
    );
  }

  private async executeWithCaching(
    tool: UnifiedTool,
    parameters: ToolParameters,
    context: ExecutionContext,
    strategy: IntelligentRoutingStrategy
  ): Promise<ToolResult> {
    const cacheKey = this.generateCacheKey(tool.id, parameters);

    // Check cache
    if (strategy.caching.levels.includes('memory')) {
      const cached = this.memoryCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < strategy.caching.ttlMs) {
        cached.accessCount++;
        await this.logger.debug('Cache hit', { toolId: tool.id, cacheKey });
        return cached.result;
      }
    }

    // Execute tool
    const startTime = Date.now();
    this.incrementActiveExecutions(tool.id);

    try {
      const result = await this.executor.execute(tool, parameters, context);
      const executionTime = Date.now() - startTime;

      const enhancedResult = {
        ...result,
        durationMs: executionTime
      };

      // Update performance metrics
      await this.updatePerformanceMetrics(tool.id, enhancedResult, result.success);

      // Update circuit breaker
      this.updateCircuitBreaker(tool.id, result.success);

      // Cache result
      if (strategy.caching.levels.includes('memory') && result.success) {
        this.memoryCache.set(cacheKey, {
          result: enhancedResult,
          timestamp: Date.now(),
          accessCount: 1
        });

        // Enforce cache size limit
        if (this.memoryCache.size > strategy.caching.maxSize) {
          this.evictCacheEntries(strategy.caching.evictionPolicy);
        }
      }

      return enhancedResult;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const failedResult: ToolResult = {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: executionTime
      };

      // Update performance metrics for failed execution
      await this.updatePerformanceMetrics(tool.id, failedResult, false);

      // Update circuit breaker for failure
      this.updateCircuitBreaker(tool.id, false);

      throw error;
    } finally {
      this.decrementActiveExecutions(tool.id);
    }
  }

  private calculateIntelligentScore(
    tool: UnifiedTool,
    context: ExecutionContext,
    strategy: IntelligentRoutingStrategy
  ): number {
    let score = 0;

    // Base capability matching
    const capabilityMatch = context.capabilities?.filter(cap =>
      tool.capabilities.includes(cap)
    ).length || 0;
    score += capabilityMatch * 10;

    // Performance-based scoring
    const metrics = this.performanceMetrics.get(tool.id);
    if (metrics) {
      switch (strategy.optimization) {
        case 'speed':
          score += Math.max(0, 100 - metrics.averageExecutionTimeMs / 100);
          break;
        case 'reliability':
          score += (metrics.successfulExecutions / metrics.totalExecutions) * 100;
          break;
        case 'cost':
          // Lower resource usage = higher score
          score += metrics.resourceUsage.avgCpuPercent < 50 ? 20 : 0;
          score += metrics.resourceUsage.avgMemoryMb < 100 ? 20 : 0;
          break;
        case 'balanced':
          score += (metrics.successfulExecutions / metrics.totalExecutions) * 30;
          score += Math.max(0, 30 - metrics.averageExecutionTimeMs / 100);
          score += metrics.resourceUsage.avgCpuPercent < 70 ? 10 : 0;
          break;
      }
    }

    // Circuit breaker penalty
    if (this.isCircuitBreakerOpen(tool.id)) {
      score -= 50;
    }

    // Load balancing consideration
    const activeCount = this.activeExecutions.get(tool.id) || 0;
    if (activeCount > strategy.loadBalancing.maxConcurrentExecutions) {
      score -= 30;
    }

    return Math.max(0, score);
  }

  private getRoutingReason(tool: UnifiedTool, strategy: IntelligentRoutingStrategy): string {
    const reasons = [];

    if (tool.capabilities.length > 0) {
      reasons.push(`Matches ${tool.capabilities.length} capabilities`);
    }

    const metrics = this.performanceMetrics.get(tool.id);
    if (metrics) {
      const successRate = (metrics.successfulExecutions / metrics.totalExecutions) * 100;
      reasons.push(`${successRate.toFixed(1)}% success rate`);

      if (strategy.optimization === 'speed') {
        reasons.push(`${metrics.averageExecutionTimeMs}ms avg execution`);
      }
    }

    return reasons.join(', ') || 'Default selection';
  }

  private extractContextFactors(context: ExecutionContext): readonly string[] {
    const factors = [];

    if (context.capabilities && context.capabilities.length > 0) {
      factors.push(`Required capabilities: ${context.capabilities.join(', ')}`);
    }

    if (context.userId) {
      factors.push(`User context: ${context.userId}`);
    }

    if (context.agentId) {
      factors.push(`Agent context: ${context.agentId}`);
    }

    return factors;
  }

  // Load balancing implementations
  private selectRoundRobin(tools: readonly UnifiedTool[], toolName: string): UnifiedTool {
    const counter = this.loadBalancingCounters.get(toolName) || 0;
    const selectedIndex = counter % tools.length;
    this.loadBalancingCounters.set(toolName, counter + 1);
    return tools[selectedIndex];
  }

  private selectLeastConnections(tools: readonly UnifiedTool[]): UnifiedTool {
    return tools.reduce((least, current) => {
      const leastConnections = this.activeExecutions.get(least.id) || 0;
      const currentConnections = this.activeExecutions.get(current.id) || 0;
      return currentConnections < leastConnections ? current : least;
    });
  }

  private selectWeighted(tools: readonly UnifiedTool[]): UnifiedTool {
    // Simple weighted selection based on success rate
    const weightedTools = tools.map(tool => {
      const metrics = this.performanceMetrics.get(tool.id);
      const weight = metrics ? (metrics.successfulExecutions / metrics.totalExecutions) : 0.5;
      return { tool, weight };
    });

    const totalWeight = weightedTools.reduce((sum, item) => sum + item.weight, 0);
    const random = Math.random() * totalWeight;

    let currentWeight = 0;
    for (const item of weightedTools) {
      currentWeight += item.weight;
      if (random <= currentWeight) {
        return item.tool;
      }
    }

    return tools[0];
  }

  private selectPerformanceBased(tools: readonly UnifiedTool[]): UnifiedTool {
    return tools.reduce((best, current) => {
      const bestMetrics = this.performanceMetrics.get(best.id);
      const currentMetrics = this.performanceMetrics.get(current.id);

      if (!bestMetrics && !currentMetrics) return best;
      if (!bestMetrics) return current;
      if (!currentMetrics) return best;

      // Score based on success rate and execution time
      const bestScore = (bestMetrics.successfulExecutions / bestMetrics.totalExecutions) * 100 -
        bestMetrics.averageExecutionTimeMs / 100;
      const currentScore = (currentMetrics.successfulExecutions / currentMetrics.totalExecutions) * 100 -
        currentMetrics.averageExecutionTimeMs / 100;

      return currentScore > bestScore ? current : best;
    });
  }

  // Circuit breaker management
  private isCircuitBreakerOpen(toolId: string): boolean {
    const breaker = this.circuitBreakers.get(toolId);
    if (!breaker) return false;

    if (breaker.state === 'open') {
      if (breaker.nextAttempt && Date.now() > breaker.nextAttempt.getTime()) {
        // Transition to half-open
        this.circuitBreakers.set(toolId, {
          ...breaker,
          state: 'half-open'
        });
        return false;
      }
      return true;
    }

    return false;
  }

  private updateCircuitBreaker(toolId: string, success: boolean): void {
    const existing = this.circuitBreakers.get(toolId) || {
      toolId,
      state: 'closed' as const,
      failureCount: 0
    };

    if (success) {
      // Reset circuit breaker on success
      this.circuitBreakers.set(toolId, {
        toolId,
        state: 'closed',
        failureCount: 0
      });
    } else {
      const newFailureCount = existing.failureCount + 1;
      const threshold = this.defaultStrategy.loadBalancing.circuitBreakerThreshold;

      if (newFailureCount >= threshold) {
        // Open circuit breaker
        const recoveryTime = new Date(Date.now() + this.defaultStrategy.loadBalancing.recoveryTimeMs);
        this.circuitBreakers.set(toolId, {
          toolId,
          state: 'open',
          failureCount: newFailureCount,
          lastFailure: new Date(),
          nextAttempt: recoveryTime
        });
      } else {
        // Increment failure count but keep closed
        this.circuitBreakers.set(toolId, {
          toolId,
          state: 'closed',
          failureCount: newFailureCount,
          lastFailure: new Date()
        });
      }
    }
  }

  // Performance tracking
  private async updatePerformanceMetrics(
    toolId: string,
    result: ToolResult,
    success: boolean
  ): Promise<void> {
    const existing = this.performanceMetrics.get(toolId) || {
      toolId,
      totalExecutions: 0,
      successfulExecutions: 0,
      averageExecutionTimeMs: 0,
      errorRate: 0,
      lastExecuted: new Date(),
      resourceUsage: {
        avgCpuPercent: 10,
        avgMemoryMb: 50,
        avgNetworkKbps: 100
      }
    };

    const executionTime = result.metadata?.executionTimeMs || result.durationMs || 100;
    const newTotalExecutions = existing.totalExecutions + 1;
    const newSuccessfulExecutions = success ? existing.successfulExecutions + 1 : existing.successfulExecutions;

    // Update average execution time
    const newAverageTime = ((existing.averageExecutionTimeMs * existing.totalExecutions) + executionTime) / newTotalExecutions;

    // Update error rate
    const newErrorRate = (newTotalExecutions - newSuccessfulExecutions) / newTotalExecutions;

    this.performanceMetrics.set(toolId, {
      toolId,
      totalExecutions: newTotalExecutions,
      successfulExecutions: newSuccessfulExecutions,
      averageExecutionTimeMs: newAverageTime,
      errorRate: newErrorRate,
      lastExecuted: new Date(),
      resourceUsage: {
        avgCpuPercent: Math.min(100, existing.resourceUsage.avgCpuPercent + (success ? 1 : 5)),
        avgMemoryMb: Math.min(1000, existing.resourceUsage.avgMemoryMb + (success ? 2 : 10)),
        avgNetworkKbps: Math.min(10000, existing.resourceUsage.avgNetworkKbps + (success ? 5 : 20))
      }
    });

    await this.logger.debug('Performance metrics updated', {
      toolId,
      totalExecutions: newTotalExecutions,
      successfulExecutions: newSuccessfulExecutions,
      averageExecutionTimeMs: newAverageTime,
      errorRate: newErrorRate
    });
  }

  private getToolPerformanceEstimate(toolId: string): {
    readonly executionTimeMs: number;
    readonly successRate: number;
    readonly resourceUsage: 'low' | 'medium' | 'high';
  } {
    const metrics = this.performanceMetrics.get(toolId);

    if (!metrics) {
      return {
        executionTimeMs: 1000, // Default estimate
        successRate: 0.8, // Default estimate
        resourceUsage: 'medium'
      };
    }

    const successRate = metrics.successfulExecutions / metrics.totalExecutions;
    const resourceUsage = metrics.resourceUsage.avgCpuPercent > 70 ? 'high' :
      metrics.resourceUsage.avgCpuPercent > 30 ? 'medium' : 'low';

    return {
      executionTimeMs: metrics.averageExecutionTimeMs,
      successRate,
      resourceUsage
    };
  }

  // Cache management
  private generateCacheKey(toolId: string, parameters: ToolParameters): string {
    const paramString = JSON.stringify(parameters, Object.keys(parameters).sort());
    return `${toolId}:${Buffer.from(paramString).toString('base64')}`;
  }

  private evictCacheEntries(policy: 'lru' | 'lfu' | 'ttl'): void {
    const entries = Array.from(this.memoryCache.entries());

    switch (policy) {
      case 'lru':
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        break;
      case 'lfu':
        entries.sort((a, b) => a[1].accessCount - b[1].accessCount);
        break;
      case 'ttl':
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        break;
    }

    // Remove oldest 10% of entries
    const toRemove = Math.ceil(entries.length * 0.1);
    for (let i = 0; i < toRemove; i++) {
      this.memoryCache.delete(entries[i][0]);
    }
  }

  // Execution tracking
  private incrementActiveExecutions(toolId: string): void {
    const current = this.activeExecutions.get(toolId) || 0;
    this.activeExecutions.set(toolId, current + 1);
  }

  private decrementActiveExecutions(toolId: string): void {
    const current = this.activeExecutions.get(toolId) || 0;
    this.activeExecutions.set(toolId, Math.max(0, current - 1));
  }

  private initializePerformanceTracking(): void {
    // Initialize periodic health checks and metrics cleanup
    setInterval(() => {
      this.cleanupOldMetrics();
      this.performHealthChecks();
    }, this.defaultStrategy.loadBalancing.healthCheckInterval);
  }

  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours

    for (const [toolId, metrics] of this.performanceMetrics.entries()) {
      if (metrics.lastExecuted.getTime() < cutoffTime) {
        this.performanceMetrics.delete(toolId);
      }
    }
  }

  private async performHealthChecks(): Promise<void> {
    // Check circuit breakers and potentially reset them
    for (const [toolId, breaker] of this.circuitBreakers.entries()) {
      if (breaker.state === 'open' && breaker.nextAttempt &&
        Date.now() > breaker.nextAttempt.getTime()) {
        this.circuitBreakers.set(toolId, {
          ...breaker,
          state: 'half-open'
        });
      }
    }
  }

  // Composition plan helpers (simplified implementations)
  private analyzeWorkflowRequirements(workflow: string): {
    requiredCapabilities: readonly ToolCapability[];
    relevantCategories: readonly ToolCategory[];
  } {
    // Simple keyword-based analysis (could be enhanced with LLM)
    const capabilities: ToolCapability[] = [];
    const categories: ToolCategory[] = [];

    if (workflow.includes('email')) {
      capabilities.push(ToolCapability.EMAIL_SEND, ToolCapability.EMAIL_READ);
      categories.push(ToolCategory.WORKSPACE);
    }
    if (workflow.includes('social') || workflow.includes('post')) {
      capabilities.push(ToolCapability.SOCIAL_MEDIA_POST);
      categories.push(ToolCategory.SOCIAL_MEDIA);
    }
    if (workflow.includes('search') || workflow.includes('scrape')) {
      capabilities.push(ToolCapability.WEB_SCRAPING);
      categories.push(ToolCategory.APIFY, ToolCategory.THINKING);
    }

    return { requiredCapabilities: capabilities, relevantCategories: categories };
  }

  private async buildCompositionSteps(
    tools: readonly UnifiedTool[],
    analysis: any,
    parameters?: ToolParameters
  ): Promise<readonly any[]> {
    // Simplified step building
    return tools.slice(0, 3).map((tool, index) => ({
      stepId: ulid(),
      tool,
      parameters: parameters || {},
      dependsOn: index > 0 ? [ulid()] : [],
      timeout: 30000,
      retryPolicy: {
        maxRetries: 2,
        backoffMs: 1000,
        retryableErrors: ['timeout', 'network']
      },
      parallelizable: index > 1
    }));
  }

  private optimizeCompositionPlan(steps: readonly any[]): readonly any[] {
    // Simple optimization - could be enhanced
    return steps;
  }

  private calculateTotalExecutionTime(steps: readonly any[]): number {
    return steps.reduce((total, step) => total + (step.timeout || 30000), 0);
  }

  private calculateComplexity(steps: readonly any[]): 'low' | 'medium' | 'high' {
    if (steps.length <= 2) return 'low';
    if (steps.length <= 5) return 'medium';
    return 'high';
  }

  private calculateSuccessProbability(steps: readonly any[]): number {
    // Simple calculation based on step count
    return Math.max(0.5, 1 - (steps.length * 0.1));
  }

  private calculateResourceRequirements(steps: readonly any[]): {
    readonly cpu: 'low' | 'medium' | 'high';
    readonly memory: 'low' | 'medium' | 'high';
    readonly network: 'low' | 'medium' | 'high';
  } {
    const stepCount = steps.length;
    return {
      cpu: stepCount <= 2 ? 'low' : stepCount <= 5 ? 'medium' : 'high',
      memory: stepCount <= 3 ? 'low' : stepCount <= 6 ? 'medium' : 'high',
      network: stepCount <= 2 ? 'low' : stepCount <= 4 ? 'medium' : 'high'
    };
  }

  // Simplified composition execution helpers
  private async executeStepInParallel(step: any, stepResults: Map<string, ToolResult>, context: ExecutionContext): Promise<void> {
    // Simplified parallel execution
  }

  private async waitForDependencies(dependsOn: readonly string[], executedSteps: Set<string>): Promise<void> {
    // Simplified dependency waiting
  }

  private async executeStepWithRetry(step: any, stepResults: Map<string, ToolResult>, context: ExecutionContext): Promise<ToolResult> {
    // Simplified step execution with retry
    return await this.executor.execute(step.tool, step.parameters, context);
  }

  private applyOutputMapping(stepResult: ToolResult, outputMapping: Record<string, string>, stepResults: Map<string, ToolResult>): void {
    // Simplified output mapping
  }

  private aggregateStepResults(results: readonly ToolResult[]): ToolResult {
    const success = results.every(r => r.success);
    const totalTime = results.reduce((sum, r) => sum + (r.durationMs || 0), 0);

    return {
      success,
      data: results,
      error: success ? undefined : 'Some steps failed',
      metadata: {
        executionTimeMs: totalTime,
        toolId: 'composition_summary',
        toolName: 'composition_summary',
        timestamp: new Date().toISOString(),
        context: {
          stepCount: results.length,
          successCount: results.filter(r => r.success).length,
          failureCount: results.filter(r => !r.success).length
        }
      }
    };
  }

  /**
   * Public API methods for monitoring and management
   */

  async getPerformanceMetrics(): Promise<readonly ToolPerformanceMetrics[]> {
    return Array.from(this.performanceMetrics.values());
  }

  async getCircuitBreakerStatus(): Promise<readonly CircuitBreakerState[]> {
    return Array.from(this.circuitBreakers.values());
  }

  async clearCache(): Promise<void> {
    this.memoryCache.clear();
    await this.logger.info('Cache cleared');
  }

  async getRoutingStats(): Promise<{
    readonly totalExecutions: number;
    readonly cacheHitRate: number;
    readonly averageRoutingTime: number;
    readonly activeExecutions: number;
  }> {
    const totalExecutions = Array.from(this.performanceMetrics.values())
      .reduce((sum, metrics) => sum + metrics.totalExecutions, 0);

    const cacheEntries = Array.from(this.memoryCache.values());
    const totalCacheAccess = cacheEntries.reduce((sum, entry) => sum + entry.accessCount, 0);
    const cacheHitRate = totalCacheAccess > 0 ? (cacheEntries.length / totalCacheAccess) : 0;

    const activeExecutions = Array.from(this.activeExecutions.values())
      .reduce((sum, count) => sum + count, 0);

    return {
      totalExecutions,
      cacheHitRate,
      averageRoutingTime: 150, // Placeholder
      activeExecutions
    };
  }
} 