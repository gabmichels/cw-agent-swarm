/**
 * LangGraphPlanningManager.ts - Adapter implementation of PlanningManager for agents
 * 
 * This file provides an adapter implementation that bridges between the
 * PlanningManager interface and the agent's existing planning systems.
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  PlanningManager, 
  PlanningManagerConfig,
  Plan,
  PlanStep,
  PlanAction,
  PlanCreationOptions,
  PlanCreationResult,
  PlanExecutionResult
} from '../../../agents/base/managers/PlanningManager';
import type { AgentBase } from '../../../../agents/shared/base/AgentBase';
import { LangGraph } from '../../../../agents/chloe/graph/chloeGraph';
import { PlanningManager as LangGraphPlanningManagerClass } from '../../../../agents/chloe/core/planningManager';
import { ChatOpenAI } from '@langchain/openai';
import { AgentMemory } from '../../../../agents/chloe/memory';
import { TaskLogger } from '../../../../agents/chloe/task-logger';

// Define planning state types
interface PlanningState {
  steps: PlanningStep[];
  confidence: number;
  error?: string;
}

interface PlanningStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority: number;
  confidence: number;
  actions: PlanningAction[];
  dependencies: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface PlanningAction {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority: number;
  confidence: number;
  type: string;
  parameters: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Error class for planning-related errors
 */
class PlanningError extends Error {
  public readonly code: string;
  public readonly context: Record<string, unknown>;

  constructor(message: string, code = 'PLANNING_ERROR', context: Record<string, unknown> = {}) {
    super(message);
    this.name = 'PlanningError';
    this.code = code;
    this.context = context;
  }
}

/**
 * Adapter implementation of PlanningManager for agents
 */
export class LangGraphPlanningManager implements PlanningManager {
  private readonly managerId: string;
  private readonly managerType = 'planning';
  private config: PlanningManagerConfig;
  private agent: AgentBase;
  private langGraph: LangGraph | null = null;
  private planningManager: LangGraphPlanningManagerClass | null = null;
  private initialized = false;
  private agentMemory: AgentMemory | null = null;

  /**
   * Create a new LangGraphPlanningManager instance
   * 
   * @param agent - The agent this manager belongs to
   * @param config - Configuration options
   */
  constructor(agent: AgentBase, config: Partial<PlanningManagerConfig> = {}) {
    this.managerId = `lang-graph-planning-manager-${uuidv4()}`;
    this.agent = agent;
    this.config = {
      enabled: config.enabled ?? true,
      enableAutoPlanning: config.enableAutoPlanning ?? true,
      planningIntervalMs: config.planningIntervalMs ?? 300000, // 5 minutes
      maxConcurrentPlans: config.maxConcurrentPlans ?? 3,
      minConfidenceThreshold: config.minConfidenceThreshold ?? 0.7,
      enablePlanAdaptation: config.enablePlanAdaptation ?? true,
      maxAdaptationAttempts: config.maxAdaptationAttempts ?? 3,
      enablePlanValidation: config.enablePlanValidation ?? true,
      enablePlanOptimization: config.enablePlanOptimization ?? true
    };
  }

  /**
   * Get the unique ID of this manager
   */
  getId(): string {
    return this.managerId;
  }

  /**
   * Get the manager type
   */
  getType(): string {
    return this.managerType;
  }

  /**
   * Get the manager configuration
   */
  getConfig<T extends PlanningManagerConfig>(): T {
    return this.config as T;
  }

  /**
   * Update the manager configuration
   */
  updateConfig<T extends PlanningManagerConfig>(config: Partial<T>): T {
    this.config = {
      ...this.config,
      ...config
    };
    return this.config as T;
  }

  /**
   * Get the associated agent instance
   */
  getAgent(): AgentBase {
    return this.agent;
  }

  /**
   * Initialize the manager
   */
  async initialize(): Promise<boolean> {
    console.log(`[${this.managerId}] Initializing ${this.managerType} manager`);
    
    try {
      // Get required dependencies
      const model = (this.agent as any).getModel() as ChatOpenAI;
      const memory = (this.agent as any).getMemory() as AgentMemory;
      const taskLogger = (this.agent as any).getTaskLogger() as TaskLogger;
      
      if (!model || !memory || !taskLogger) {
        throw new PlanningError(
          'Required dependencies not available',
          'MISSING_DEPENDENCIES'
        );
      }
      
      // Initialize LangGraph planning systems
      this.langGraph = new LangGraph({
        model,
        memory,
        taskLogger
      });
      
      this.planningManager = new LangGraphPlanningManagerClass({
        agentId: (this.agent as any).agentId,
        memory,
        model,
        taskLogger
      });
      
      this.initialized = true;
      return true;
    } catch (error) {
      throw new PlanningError(
        'Failed to initialize LangGraph planning systems',
        'INITIALIZATION_FAILED',
        { error }
      );
    }
  }

  /**
   * Shutdown the manager and release resources
   */
  async shutdown(): Promise<void> {
    console.log(`[${this.managerId}] Shutting down ${this.managerType} manager`);
    
    // Clean up any resources
    this.initialized = false;
  }

  /**
   * Check if the manager is currently enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable or disable the manager
   */
  setEnabled(enabled: boolean): boolean {
    this.config.enabled = enabled;
    return this.config.enabled;
  }

  /**
   * Reset the manager to its initial state
   */
  async reset(): Promise<boolean> {
    console.log(`[${this.managerId}] Resetting ${this.managerType} manager`);
    
    // Reset any internal state
    return true;
  }

  /**
   * Get manager health status
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    metrics?: Record<string, unknown>;
  }> {
    if (!this.initialized) {
      return {
        status: 'degraded',
        message: 'Planning manager not initialized'
      };
    }

    const stats = await this.getStats();
    
    // Check if there are critical issues
    if (!this.isEnabled()) {
      return {
        status: 'unhealthy',
        message: 'Planning manager is disabled',
        metrics: stats
      };
    }
    
    // Degraded if confidence is low
    if (stats.avgConfidence < (this.config.minConfidenceThreshold ?? 0.7)) {
      return {
        status: 'degraded',
        message: 'Plan confidence is low',
        metrics: stats
      };
    }
    
    return {
      status: 'healthy',
      message: 'Planning manager is healthy',
      metrics: stats
    };
  }

  /**
   * Create a new plan
   */
  async createPlan(options: PlanCreationOptions): Promise<PlanCreationResult> {
    if (!this.initialized || !this.langGraph) {
      throw new PlanningError(
        'Planning manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    try {
      // Execute the planning graph
      const result = await this.langGraph.execute(options.description);
      const planningState = result as unknown as PlanningState;
      
      if (!planningState?.steps) {
        throw new PlanningError(
          'Invalid planning state returned',
          'INVALID_PLANNING_STATE'
        );
      }
      
      // Map the result to a plan
      const plan: Plan = {
        id: uuidv4(),
        name: options.name,
        description: options.description,
        goals: options.goals,
        status: 'pending',
        priority: typeof options.priority === 'number' ? options.priority : 0.5,
        confidence: 0.8,
        steps: this.mapSteps(planningState.steps),
        metadata: {
          source: 'langgraph',
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      return {
        success: true,
        plan
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error creating plan'
      };
    }
  }

  /**
   * Get a plan by ID
   */
  async getPlan(planId: string): Promise<Plan | null> {
    if (!this.initialized || !this.planningManager) {
      throw new PlanningError(
        'Planning manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    // TODO: Implement plan retrieval from LangGraph's planning manager
    return null;
  }

  /**
   * Get all plans
   */
  async getAllPlans(): Promise<Plan[]> {
    if (!this.initialized || !this.planningManager) {
      throw new PlanningError(
        'Planning manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    // TODO: Implement plan retrieval from LangGraph's planning manager
    return [];
  }

  /**
   * Update a plan
   */
  async updatePlan(
    planId: string,
    updates: Partial<Plan>
  ): Promise<Plan | null> {
    if (!this.initialized || !this.planningManager) {
      throw new PlanningError(
        'Planning manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    // TODO: Implement plan updates in LangGraph's planning manager
    return null;
  }

  /**
   * Delete a plan
   */
  async deletePlan(planId: string): Promise<boolean> {
    if (!this.initialized || !this.planningManager) {
      throw new PlanningError(
        'Planning manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    // TODO: Implement plan deletion in LangGraph's planning manager
    return true;
  }

  /**
   * Execute a plan
   */
  async executePlan(planId: string): Promise<PlanExecutionResult> {
    if (!this.initialized || !this.langGraph) {
      throw new PlanningError(
        'Planning manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    try {
      // Get the plan
      const plan = await this.getPlan(planId);
      if (!plan) {
        return {
          success: false,
          error: 'Plan not found'
        };
      }

      // Execute the plan using LangGraph
      const result = await this.langGraph.execute(plan.description);
      const planningState = result as unknown as PlanningState;
      
      if (!planningState) {
        return {
          success: false,
          error: 'Invalid planning state returned'
        };
      }
      
      // Update plan status
      await this.updatePlan(planId, {
        status: planningState.error ? 'failed' : 'completed',
        updatedAt: new Date()
      });
      
      return {
        success: !planningState.error,
        plan: planningState.error ? undefined : plan,
        error: planningState.error
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error executing plan'
      };
    }
  }

  /**
   * Adapt a plan
   */
  async adaptPlan(planId: string, reason: string): Promise<Plan | null> {
    if (!this.initialized || !this.planningManager) {
      throw new PlanningError(
        'Planning manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    try {
      // Get the plan
      const plan = await this.getPlan(planId);
      if (!plan) {
        return null;
      }

      // TODO: Implement plan adaptation in LangGraph's planning manager
      return plan;
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate a plan
   */
  async validatePlan(planId: string): Promise<boolean> {
    if (!this.initialized || !this.planningManager) {
      throw new PlanningError(
        'Planning manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    try {
      // Get the plan
      const plan = await this.getPlan(planId);
      if (!plan) {
        return false;
      }

      // TODO: Implement plan validation in LangGraph's planning manager
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Optimize a plan
   */
  async optimizePlan(planId: string): Promise<Plan | null> {
    if (!this.initialized || !this.planningManager) {
      throw new PlanningError(
        'Planning manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    try {
      // Get the plan
      const plan = await this.getPlan(planId);
      if (!plan) {
        return null;
      }

      // TODO: Implement plan optimization in LangGraph's planning manager
      return plan;
    } catch (error) {
      return null;
    }
  }

  // Private helper methods

  /**
   * Map LangGraph steps to interface format
   */
  private mapSteps(steps: PlanningStep[]): PlanStep[] {
    return steps.map(step => ({
      id: step.id,
      name: step.name,
      description: step.description,
      status: step.status,
      priority: step.priority,
      confidence: step.confidence,
      actions: this.mapActions(step.actions),
      dependencies: step.dependencies,
      createdAt: step.createdAt,
      updatedAt: step.updatedAt
    }));
  }

  /**
   * Map LangGraph actions to interface format
   */
  private mapActions(actions: PlanningAction[]): PlanAction[] {
    return actions.map(action => ({
      id: action.id,
      name: action.name,
      description: action.description,
      status: action.status,
      priority: action.priority,
      confidence: action.confidence,
      type: action.type,
      parameters: action.parameters,
      createdAt: action.createdAt,
      updatedAt: action.updatedAt
    }));
  }

  /**
   * Get planning manager statistics
   */
  private async getStats(): Promise<{
    totalPlans: number;
    activePlans: number;
    completedPlans: number;
    failedPlans: number;
    avgConfidence: number;
    avgStepsPerPlan: number;
    avgActionsPerStep: number;
  }> {
    if (!this.planningManager) {
      throw new PlanningError(
        'Planning manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    // TODO: Implement stats gathering from LangGraph's planning manager
    return {
      totalPlans: 0,
      activePlans: 0,
      completedPlans: 0,
      failedPlans: 0,
      avgConfidence: 0.8,
      avgStepsPerPlan: 5,
      avgActionsPerStep: 3
    };
  }
} 