/**
 * Reflection Strategy Manager
 * 
 * Handles strategy registration, management, selection, and performance evaluation
 * for reflection strategies. Extracted from DefaultReflectionManager.
 */

import { ulid } from 'ulid';
import { 
  ReflectionStrategyManager as IReflectionStrategyManager,
  ReflectionStrategy,
  StrategyListOptions,
  StrategyPerformance,
  ReflectionTrigger,
  ExecutionContext
} from '../interfaces/ReflectionInterfaces';

/**
 * Error class for strategy management errors
 */
export class StrategyManagementError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'StrategyManagementError';
  }
}

/**
 * Configuration for reflection strategy management
 */
export interface ReflectionStrategyManagerConfig {
  maxStrategies?: number;
  defaultPriority?: number;
  enablePerformanceTracking?: boolean;
  strategyTimeoutMs?: number;
  maxExecutionHistory?: number;
  autoDisableThreshold?: number; // Disable strategies with success rate below this
}

/**
 * Strategy execution history entry
 */
interface StrategyExecutionHistory {
  strategyId: string;
  executedAt: Date;
  executionTime: number;
  success: boolean;
  trigger: ReflectionTrigger;
  context: Record<string, unknown>;
  error?: string;
}

/**
 * Implementation of ReflectionStrategyManager interface
 */
export class ReflectionStrategyManager implements IReflectionStrategyManager {
  private readonly config: Required<ReflectionStrategyManagerConfig>;
  private readonly strategies: Map<string, ReflectionStrategy> = new Map();
  private readonly strategyPerformance: Map<string, StrategyPerformance> = new Map();
  private readonly executionHistory: StrategyExecutionHistory[] = [];

  constructor(config: ReflectionStrategyManagerConfig = {}) {
    this.config = {
      maxStrategies: config.maxStrategies || 50,
      defaultPriority: config.defaultPriority || 5,
      enablePerformanceTracking: config.enablePerformanceTracking ?? true,
      strategyTimeoutMs: config.strategyTimeoutMs || 30000,
      maxExecutionHistory: config.maxExecutionHistory || 1000,
      autoDisableThreshold: config.autoDisableThreshold || 0.3
    };

    // Register default strategies
    this.registerDefaultStrategies();
  }

  /**
   * Register a new reflection strategy
   */
  async registerStrategy(strategy: Omit<ReflectionStrategy, 'id' | 'createdAt' | 'updatedAt'>): Promise<ReflectionStrategy> {
    // Check capacity
    if (this.strategies.size >= this.config.maxStrategies) {
      throw new StrategyManagementError(
        `Maximum strategies limit reached (${this.config.maxStrategies})`,
        'CAPACITY_EXCEEDED',
        { currentCount: this.strategies.size, maxAllowed: this.config.maxStrategies }
      );
    }

    // Validate strategy
    await this.validateStrategy(strategy);

    // Generate ID and create full strategy
    const fullStrategy: ReflectionStrategy = {
      id: ulid(),
      ...strategy,
      priority: strategy.priority ?? this.config.defaultPriority,
      enabled: strategy.enabled ?? true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Store strategy
    this.strategies.set(fullStrategy.id, fullStrategy);

    // Initialize performance tracking
    if (this.config.enablePerformanceTracking) {
      this.strategyPerformance.set(fullStrategy.id, {
        executionCount: 0,
        successRate: 0,
        averageExecutionTime: 0,
        lastExecuted: new Date(),
        effectiveness: 0
      });
    }

    return fullStrategy;
  }

  /**
   * Get a strategy by ID
   */
  async getStrategy(strategyId: string): Promise<ReflectionStrategy | null> {
    return this.strategies.get(strategyId) || null;
  }

  /**
   * Update an existing strategy
   */
  async updateStrategy(strategyId: string, updates: Partial<Omit<ReflectionStrategy, 'id' | 'createdAt' | 'updatedAt'>>): Promise<ReflectionStrategy> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new StrategyManagementError(
        `Strategy not found: ${strategyId}`,
        'STRATEGY_NOT_FOUND',
        { strategyId }
      );
    }

    // Validate updates
    if (updates.name || updates.description || updates.trigger || updates.implementation) {
      await this.validateStrategy({ ...strategy, ...updates });
    }

    // Apply updates
    const updatedStrategy: ReflectionStrategy = {
      ...strategy,
      ...updates,
      id: strategy.id, // Ensure ID cannot be changed
      updatedAt: new Date()
    };

    this.strategies.set(strategyId, updatedStrategy);
    return updatedStrategy;
  }

  /**
   * List strategies with optional filtering and sorting
   */
  async listStrategies(options: StrategyListOptions = {}): Promise<ReflectionStrategy[]> {
    let strategies = Array.from(this.strategies.values());

    // Apply filters
    if (options.trigger && options.trigger.length > 0) {
      strategies = strategies.filter(s => options.trigger!.includes(s.trigger));
    }

    if (options.enabled !== undefined) {
      strategies = strategies.filter(s => s.enabled === options.enabled);
    }

    // Apply sorting
    const sortBy = options.sortBy || 'priority';
    const sortDirection = options.sortDirection || 'desc';

    strategies.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'priority':
          comparison = (a.priority || this.config.defaultPriority) - (b.priority || this.config.defaultPriority);
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        default:
          comparison = 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return strategies;
  }

  /**
   * Enable or disable a strategy
   */
  async setStrategyEnabled(strategyId: string, enabled: boolean): Promise<ReflectionStrategy> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new StrategyManagementError(
        `Strategy not found: ${strategyId}`,
        'STRATEGY_NOT_FOUND',
        { strategyId }
      );
    }

    const updatedStrategy: ReflectionStrategy = {
      ...strategy,
      enabled,
      updatedAt: new Date()
    };

    this.strategies.set(strategyId, updatedStrategy);
    return updatedStrategy;
  }

  /**
   * Select the best strategy for a given trigger and context
   */
  async selectStrategy(trigger: ReflectionTrigger, context: Record<string, unknown>): Promise<ReflectionStrategy | null> {
    // Get enabled strategies for this trigger
    const candidates = Array.from(this.strategies.values())
      .filter(s => s.enabled && s.trigger === trigger);

    if (candidates.length === 0) {
      return null;
    }

    // Score strategies based on priority and performance
    const scoredStrategies = candidates.map(strategy => {
      const performance = this.strategyPerformance.get(strategy.id);
      
      // Base score from priority (higher priority = higher score)
      let score = (strategy.priority || this.config.defaultPriority) * 10;
      
      // Adjust based on performance if available
      if (performance && this.config.enablePerformanceTracking) {
        // Boost score based on success rate and effectiveness
        score += performance.successRate * 50;
        score += performance.effectiveness * 30;
        
        // Penalize strategies that haven't been used recently
        const daysSinceLastExecution = (Date.now() - performance.lastExecuted.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceLastExecution > 7) {
          score *= 0.8; // 20% penalty for strategies not used in a week
        }
      }

      // Context-based scoring (can be extended based on specific context requirements)
      if (context.urgency === 'high' && strategy.name.toLowerCase().includes('quick')) {
        score += 20;
      }

      return { strategy, score };
    });

    // Sort by score and return the best strategy
    scoredStrategies.sort((a, b) => b.score - a.score);
    return scoredStrategies[0]?.strategy || null;
  }

  /**
   * Evaluate strategy performance
   */
  async evaluateStrategyPerformance(strategyId: string): Promise<StrategyPerformance> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new StrategyManagementError(
        `Strategy not found: ${strategyId}`,
        'STRATEGY_NOT_FOUND',
        { strategyId }
      );
    }

    if (!this.config.enablePerformanceTracking) {
      throw new StrategyManagementError(
        'Performance tracking is disabled',
        'PERFORMANCE_TRACKING_DISABLED',
        { strategyId }
      );
    }

    // Get execution history for this strategy
    const executions = this.executionHistory.filter(h => h.strategyId === strategyId);
    
    if (executions.length === 0) {
      return {
        executionCount: 0,
        successRate: 0,
        averageExecutionTime: 0,
        lastExecuted: strategy.createdAt,
        effectiveness: 0
      };
    }

    // Calculate metrics
    const successfulExecutions = executions.filter(e => e.success);
    const successRate = successfulExecutions.length / executions.length;
    const averageExecutionTime = executions.reduce((sum, e) => sum + e.executionTime, 0) / executions.length;
    const lastExecuted = new Date(Math.max(...executions.map(e => e.executedAt.getTime())));

    // Calculate effectiveness (combination of success rate and execution speed)
    const speedScore = Math.max(0, 1 - (averageExecutionTime / this.config.strategyTimeoutMs));
    const effectiveness = (successRate * 0.7) + (speedScore * 0.3);

    const performance: StrategyPerformance = {
      executionCount: executions.length,
      successRate,
      averageExecutionTime,
      lastExecuted,
      effectiveness
    };

    // Update stored performance
    this.strategyPerformance.set(strategyId, performance);

    // Auto-disable strategy if performance is too low
    if (executions.length >= 5 && successRate < this.config.autoDisableThreshold) {
      await this.setStrategyEnabled(strategyId, false);
    }

    return performance;
  }

  /**
   * Record strategy execution for performance tracking
   */
  async recordExecution(
    strategyId: string,
    trigger: ReflectionTrigger,
    context: Record<string, unknown>,
    executionTime: number,
    success: boolean,
    error?: string
  ): Promise<void> {
    if (!this.config.enablePerformanceTracking) {
      return;
    }

    const execution: StrategyExecutionHistory = {
      strategyId,
      executedAt: new Date(),
      executionTime,
      success,
      trigger,
      context,
      error
    };

    this.executionHistory.push(execution);

    // Trim history if it exceeds max size
    if (this.executionHistory.length > this.config.maxExecutionHistory) {
      this.executionHistory.splice(0, this.executionHistory.length - this.config.maxExecutionHistory);
    }

    // Update performance metrics
    await this.evaluateStrategyPerformance(strategyId);
  }

  /**
   * Get strategy management statistics
   */
  getStats(): Record<string, unknown> {
    const strategies = Array.from(this.strategies.values());
    const enabledStrategies = strategies.filter(s => s.enabled);
    
    const triggerCounts = strategies.reduce((counts, strategy) => {
      counts[strategy.trigger] = (counts[strategy.trigger] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    return {
      totalStrategies: strategies.length,
      enabledStrategies: enabledStrategies.length,
      disabledStrategies: strategies.length - enabledStrategies.length,
      triggerDistribution: triggerCounts,
      performanceTrackingEnabled: this.config.enablePerformanceTracking,
      executionHistorySize: this.executionHistory.length,
      config: this.config
    };
  }

  /**
   * Clear all strategies and reset state
   */
  async clear(reregisterDefaults: boolean = true): Promise<void> {
    this.strategies.clear();
    this.strategyPerformance.clear();
    this.executionHistory.length = 0;
    
    // Re-register default strategies unless explicitly disabled
    if (reregisterDefaults) {
      this.registerDefaultStrategies();
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async validateStrategy(strategy: Partial<ReflectionStrategy>): Promise<void> {
    if (!strategy.name || strategy.name.trim().length === 0) {
      throw new StrategyManagementError(
        'Strategy name is required',
        'INVALID_STRATEGY_NAME',
        { name: strategy.name }
      );
    }

    if (!strategy.description || strategy.description.trim().length === 0) {
      throw new StrategyManagementError(
        'Strategy description is required',
        'INVALID_STRATEGY_DESCRIPTION',
        { description: strategy.description }
      );
    }

    if (!strategy.trigger) {
      throw new StrategyManagementError(
        'Strategy trigger is required',
        'INVALID_STRATEGY_TRIGGER',
        { trigger: strategy.trigger }
      );
    }

    const validTriggers: ReflectionTrigger[] = ['error', 'task_completion', 'learning_opportunity', 'performance_issue', 'user_feedback'];
    if (!validTriggers.includes(strategy.trigger)) {
      throw new StrategyManagementError(
        `Invalid trigger: ${strategy.trigger}. Valid triggers: ${validTriggers.join(', ')}`,
        'INVALID_TRIGGER_TYPE',
        { trigger: strategy.trigger, validTriggers }
      );
    }

    if (strategy.priority !== undefined && (strategy.priority < 1 || strategy.priority > 10)) {
      throw new StrategyManagementError(
        'Strategy priority must be between 1 and 10',
        'INVALID_STRATEGY_PRIORITY',
        { priority: strategy.priority }
      );
    }

    if (!strategy.implementation || typeof strategy.implementation !== 'function') {
      throw new StrategyManagementError(
        'Strategy implementation function is required',
        'INVALID_STRATEGY_IMPLEMENTATION',
        { implementation: typeof strategy.implementation }
      );
    }
  }

  private registerDefaultStrategies(): void {
    // Register some default reflection strategies
    const defaultStrategies = [
      {
        name: 'Error Analysis Strategy',
        description: 'Analyzes errors to extract learning insights and improvement opportunities',
        trigger: 'error' as ReflectionTrigger,
        priority: 8,
        implementation: async (context: ExecutionContext) => {
          // Default error analysis implementation
          return {
            success: true,
            insights: [{
              id: ulid(),
              type: 'error' as const,
              content: 'Error analysis completed',
              timestamp: new Date(),
              reflectionId: context.data.reflectionId as string || ulid(),
              confidence: 0.8,
              metadata: {
                source: 'error_analysis_strategy',
                applicationStatus: 'pending' as const,
                category: 'error_handling' as const,
                relatedInsights: [],
                appliedAt: undefined
              }
            }],
            metrics: { analysisTime: 100 },
            errors: [],
            executionTime: 100
          };
        }
      },
      {
        name: 'Task Completion Reflection',
        description: 'Reflects on completed tasks to identify successes and areas for improvement',
        trigger: 'task_completion' as ReflectionTrigger,
        priority: 6,
        implementation: async (context: ExecutionContext) => {
          return {
            success: true,
            insights: [{
              id: ulid(),
              type: 'learning' as const,
              content: 'Task completion analysis completed',
              timestamp: new Date(),
              reflectionId: context.data.reflectionId as string || ulid(),
              confidence: 0.7,
              metadata: {
                source: 'task_completion_strategy',
                applicationStatus: 'pending' as const,
                category: 'improvement' as const,
                relatedInsights: [],
                appliedAt: undefined
              }
            }],
            metrics: { analysisTime: 150 },
            errors: [],
            executionTime: 150
          };
        }
      }
    ];

    // Register default strategies without validation (they're known to be valid)
    defaultStrategies.forEach(strategy => {
      const fullStrategy: ReflectionStrategy = {
        id: ulid(),
        ...strategy,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.strategies.set(fullStrategy.id, fullStrategy);

      if (this.config.enablePerformanceTracking) {
        this.strategyPerformance.set(fullStrategy.id, {
          executionCount: 0,
          successRate: 0,
          averageExecutionTime: 0,
          lastExecuted: fullStrategy.createdAt,
          effectiveness: 0
        });
      }
    });
  }
} 