/**
 * Planning System Integration
 * 
 * This file provides integration between the DefaultPlanningManager and
 * the plan recovery and adaptation systems.
 */

import { AgentBase } from '../../base/AgentBase.interface';
import { PlanRecoverySystem, RecoveryStrategy } from '../interfaces/PlanRecovery.interface';
import { 
  PlanAdaptationSystem, 
  PlanAdaptationStrategy,
  AdaptationTriggerType,
  AdaptationStrategyType,
  AdaptationAction,
  AdaptationScope,
  AdaptationOpportunity,
  AdaptationStrategyConfig,
  AdaptationResult
} from '../interfaces/PlanAdaptation.interface';
import { DefaultPlanRecoverySystem } from '../recovery/DefaultPlanRecoverySystem';
import { DefaultPlanAdaptationSystem } from '../adaptation/DefaultPlanAdaptationSystem';
import { DefaultPlanningManager } from '../../../../lib/agents/implementations/managers/DefaultPlanningManager';
import { 
  PlanCreationOptions, 
  PlanCreationResult, 
  PlanExecutionResult, 
  Plan,
  PlanStep,
  PlanAction
} from '../../base/managers/PlanningManager.interface';
import { ChatOpenAI } from '@langchain/openai';
import { ManagerType } from '../../base/managers/ManagerType';
import { ResourceManager, ResourceRequirements } from '../../base/managers/ResourceManager.interface';

/**
 * Resource requirements for a plan
 */
export interface PlanResourceRequirements extends ResourceRequirements {
  custom?: Record<string, number>;
}

/**
 * Resource allocation for a plan
 */
export interface ResourceAllocation {
  allocated: PlanResourceRequirements;
  available: PlanResourceRequirements;
  utilization: number;
}

/**
 * Enhanced plan with resource awareness
 */
export interface ResourceAwarePlan extends Plan {
  resourceRequirements?: PlanResourceRequirements;
  resourceAllocation?: ResourceAllocation;
}

/**
 * Enhanced planning manager that integrates recovery and adaptation systems
 */
export class EnhancedPlanningManager extends DefaultPlanningManager {
  private recoverySystem: PlanRecoverySystem;
  private adaptationSystem: PlanAdaptationSystem;
  private model: ChatOpenAI;
  private resourceManager?: ResourceManager;
  
  /**
   * Create a new EnhancedPlanningManager
   */
  constructor(
    agent: AgentBase,
    options: {
      recoverySystem?: PlanRecoverySystem;
      adaptationSystem?: PlanAdaptationSystem;
      model?: ChatOpenAI;
      config?: Record<string, unknown>;
    } = {}
  ) {
    super(agent, options.config || {});
    
    // Use provided systems or create defaults
    this.recoverySystem = options.recoverySystem || new DefaultPlanRecoverySystem();
    this.adaptationSystem = options.adaptationSystem || new DefaultPlanAdaptationSystem();
    
    // Initialize LLM model
    this.model = options.model || new ChatOpenAI({
      modelName: 'gpt-4',
      temperature: 0.2,
      maxTokens: 2000
    });
    
    // Try to get resource manager
    const resourceManager = this.agent.getManager<ResourceManager>(ManagerType.RESOURCE);
    this.resourceManager = resourceManager || undefined;
  }

  /**
   * Get the unique ID of this manager
   */
  getId(): string {
    return this.managerId;
  }

  /**
   * Initialize the manager and sub-systems
   */
  async initialize(): Promise<boolean> {
    const baseInitialized = await super.initialize();
    if (!baseInitialized) {
      return false;
    }
    
    try {
      await this.recoverySystem.initialize();
      await this.adaptationSystem.initialize();
      
      // Register default adaptation strategies
      await this.registerDefaultStrategies();
      
      return true;
    } catch (error) {
      console.error('Error initializing planning sub-systems:', error);
      return false;
    }
  }

  /**
   * Register default adaptation strategies
   */
  private async registerDefaultStrategies(): Promise<void> {
    // Resource optimization strategy
    const resourceOptConfig: AdaptationStrategyConfig = {
      id: 'resource-optimization',
      type: AdaptationStrategyType.PARAMETERIZATION,
      name: 'Resource Optimization',
      description: 'Optimizes plan based on resource constraints',
      triggerTypes: [AdaptationTriggerType.RESOURCE_CONSTRAINT],
      priority: 80,
      minConfidenceThreshold: 0.7,
      enabled: true
    };

    await this.registerAdaptationStrategy({
      config: resourceOptConfig
    } as PlanAdaptationStrategy);
    
    // Efficiency optimization strategy
    const efficiencyOptConfig: AdaptationStrategyConfig = {
      id: 'efficiency-optimization',
      type: AdaptationStrategyType.PARALLELIZATION,
      name: 'Efficiency Optimization',
      description: 'Optimizes plan for better efficiency',
      triggerTypes: [AdaptationTriggerType.EFFICIENCY_OPTIMIZATION],
      priority: 70,
      minConfidenceThreshold: 0.7,
      enabled: true
    };

    await this.registerAdaptationStrategy({
      config: efficiencyOptConfig
    } as PlanAdaptationStrategy);
  }

  /**
   * Create a new plan with enhanced error handling and resource awareness
   */
  async createPlan(options: PlanCreationOptions): Promise<PlanCreationResult> {
    try {
      const result = await super.createPlan(options);
      if (!result.success || !result.plan) {
        return result;
      }
      
      // Add resource requirements if resource manager is available
      if (this.resourceManager) {
        const resourceRequirements = await this.calculateResourceRequirements(result.plan);
        const resourceAllocation = await this.allocateResources(resourceRequirements);
        
        // Enhance plan with resource information
        const enhancedPlan: ResourceAwarePlan = {
          ...result.plan,
          resourceRequirements,
          resourceAllocation
        };
        
        return {
          ...result,
          plan: enhancedPlan
        };
      }
      
      return result;
    } catch (error) {
      const errorResponse = await this.recoverySystem.generateStandardErrorResponse(
        error instanceof Error ? error : new Error(String(error)),
        {
          source: this.getId(),
          resources: ['planning-system']
        }
      );
      
      return {
        success: false,
        error: errorResponse.message
      };
    }
  }

  /**
   * Execute a plan with enhanced error handling and adaptation
   */
  async executePlan(planId: string): Promise<PlanExecutionResult> {
    try {
      // Get the plan
      const plan = await this.getPlan(planId);
      if (!plan) {
        throw new Error(`Plan ${planId} not found`);
      }
      
      // Check resource availability if resource manager exists
      if (this.resourceManager && (plan as ResourceAwarePlan).resourceRequirements) {
        const resourcePlan = plan as ResourceAwarePlan;
        const available = await this.checkResourceAvailability(resourcePlan.resourceRequirements!);
        if (!available) {
          // Try to adapt the plan for resource constraints
          const adapted = await this.adaptPlanForResources(planId, {
            type: AdaptationTriggerType.RESOURCE_CONSTRAINT,
            scope: AdaptationScope.FULL_PLAN
          });
          
          if (!adapted) {
            return {
              success: false,
              error: 'Insufficient resources and adaptation failed'
            };
          }
        }
      }
      
      return await super.executePlan(planId);
    } catch (error) {
      const errorResponse = await this.recoverySystem.generateStandardErrorResponse(
        error instanceof Error ? error : new Error(String(error)),
        {
          source: this.getId(),
          resources: ['planning-system']
        }
      );
      
      return {
        success: false,
        error: errorResponse.message
      };
    }
  }

  /**
   * Adapt a plan based on a trigger
   */
  private async adaptPlanForResources(
    planId: string, 
    trigger: {
      type: AdaptationTriggerType;
      scope: AdaptationScope;
      context?: Record<string, unknown>;
    }
  ): Promise<boolean> {
    const plan = await this.getPlan(planId);
    if (!plan) {
      return false;
    }
    
    try {
      // Get adaptation opportunities from the system
      const opportunities = await this.adaptationSystem.detectOpportunities(planId, {
        type: trigger.type,
        source: this.getId(),
        description: `Adaptation triggered by ${trigger.type}`,
        context: trigger.context
      });
      
      if (!opportunities || opportunities.length === 0) {
        return false;
      }
      
      // Use LLM to evaluate and select the best opportunity
      const selectedOpportunity = await this.selectBestOpportunity(opportunities, plan, trigger);
      if (!selectedOpportunity) {
        return false;
      }
      
      // Generate and apply adaptation actions
      const actions = await this.adaptationSystem.generateActions(selectedOpportunity.id);
      if (!actions || actions.length === 0) {
        return false;
      }
      
      // Apply the adaptation
      const result = await this.adaptationSystem.applyAdaptation(selectedOpportunity.id, actions[0]);
      if (!result.success) {
        return false;
      }
      
      // Update the plan
      const adaptedPlan = await this.getPlan(planId);
      if (!adaptedPlan) {
        return false;
      }
      
      await this.updatePlan(planId, adaptedPlan);
      return true;
    } catch (error) {
      console.error('Error adapting plan:', error);
      return false;
    }
  }

  /**
   * Use LLM to select the best adaptation opportunity
   */
  private async selectBestOpportunity(
    opportunities: AdaptationOpportunity[],
    plan: Plan,
    trigger: {
      type: AdaptationTriggerType;
      scope: AdaptationScope;
      context?: Record<string, unknown>;
    }
  ): Promise<AdaptationOpportunity | null> {
    try {
      const prompt = `You are an expert plan optimization system. Analyze the given adaptation opportunities and select the best one based on the current plan and trigger context.

Plan: ${JSON.stringify(plan, null, 2)}

Trigger: ${JSON.stringify(trigger, null, 2)}

Available Opportunities:
${opportunities.map(o => JSON.stringify(o, null, 2)).join('\n\n')}

Select the best opportunity by analyzing:
1. Impact on plan success probability
2. Resource efficiency
3. Risk level
4. Implementation complexity

Respond with just the index number (0-${opportunities.length - 1}) of the best opportunity.`;

      const response = await this.model.invoke(prompt);
      const selectedIndex = parseInt(response.content.trim(), 10);
      
      if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= opportunities.length) {
        return null;
      }
      
      return opportunities[selectedIndex];
    } catch (error) {
      console.error('Error selecting adaptation opportunity:', error);
      return null;
    }
  }

  /**
   * Calculate resource requirements for a plan
   */
  private async calculateResourceRequirements(plan: Plan): Promise<PlanResourceRequirements> {
    // Default base requirements
    const requirements: PlanResourceRequirements = {
      cpu: 1,
      memory: 512,
      storage: 1024,
      network: 100
    };
    
    // Analyze each step's requirements
    for (const step of plan.steps) {
      // Add step-specific requirements based on tools, complexity, etc.
      if (step.requiredTools) {
        requirements.cpu! += step.requiredTools.length * 0.5;
        requirements.memory! += step.requiredTools.length * 256;
      }
      
      if (step.estimatedTimeMinutes) {
        requirements.storage! += step.estimatedTimeMinutes * 100;
      }
    }
    
    return requirements;
  }

  /**
   * Allocate resources for requirements
   */
  private async allocateResources(requirements: PlanResourceRequirements): Promise<ResourceAllocation | undefined> {
    if (!this.resourceManager) {
      return undefined;
    }
    
    try {
      const available = await this.resourceManager.getAvailableResources();
      const allocated = await this.resourceManager.allocateResources(requirements);
      
      return {
        allocated,
        available,
        utilization: this.calculateUtilization(allocated, available)
      };
    } catch (error) {
      console.error('Error allocating resources:', error);
      return undefined;
    }
  }

  /**
   * Check if required resources are available
   */
  private async checkResourceAvailability(requirements: PlanResourceRequirements): Promise<boolean> {
    if (!this.resourceManager) {
      return true;
    }
    
    try {
      const available = await this.resourceManager.getAvailableResources();
      
      // Check each resource type
      for (const [key, required] of Object.entries(requirements)) {
        if (typeof required === 'number') {
          const availableAmount = available[key as keyof PlanResourceRequirements];
          if (typeof availableAmount === 'number' && availableAmount < required) {
            return false;
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error checking resource availability:', error);
      return false;
    }
  }

  /**
   * Calculate resource utilization percentage
   */
  private calculateUtilization(allocated: PlanResourceRequirements, available: PlanResourceRequirements): number {
    let totalUtilization = 0;
    let resourceCount = 0;
    
    for (const [key, value] of Object.entries(allocated)) {
      if (typeof value === 'number') {
        const availableAmount = available[key as keyof PlanResourceRequirements];
        if (typeof availableAmount === 'number' && availableAmount > 0) {
          totalUtilization += (value / availableAmount) * 100;
          resourceCount++;
        }
      }
    }
    
    return resourceCount > 0 ? totalUtilization / resourceCount : 0;
  }

  /**
   * Get the recovery system
   */
  getRecoverySystem(): PlanRecoverySystem {
    return this.recoverySystem;
  }

  /**
   * Get the adaptation system
   */
  getAdaptationSystem(): PlanAdaptationSystem {
    return this.adaptationSystem;
  }

  /**
   * Register a new recovery strategy
   */
  async registerRecoveryStrategy(strategy: RecoveryStrategy): Promise<boolean> {
    return this.recoverySystem.registerRecoveryStrategy(strategy);
  }

  /**
   * Register a new adaptation strategy
   */
  async registerAdaptationStrategy(strategy: PlanAdaptationStrategy): Promise<boolean> {
    return this.adaptationSystem.registerStrategy(strategy);
  }

  /**
   * Override the base adaptPlan method to use our enhanced adaptation
   */
  async adaptPlan(planId: string, reason: string): Promise<Plan | null> {
    // Convert the reason string to a trigger
    const trigger = {
      type: AdaptationTriggerType.MANUAL,
      scope: AdaptationScope.FULL_PLAN,
      context: { reason }
    };

    const success = await this.adaptPlanForResources(planId, trigger);
    if (!success) {
      return null;
    }

    return this.getPlan(planId);
  }
} 