/**
 * Planning System Integration
 * 
 * This file provides integration between the DefaultPlanningManager and
 * the plan recovery and adaptation systems.
 */

import { AgentBase } from '../../base/AgentBase.interface';
import { PlanRecoverySystem } from '../interfaces/PlanRecovery.interface';
import { PlanAdaptationSystem } from '../interfaces/PlanAdaptation.interface';
import { DefaultPlanRecoverySystem } from '../recovery/DefaultPlanRecoverySystem';
import { DefaultPlanAdaptationSystem } from '../adaptation/DefaultPlanAdaptationSystem';
import { DefaultPlanningManager } from '../../../../lib/agents/implementations/managers/DefaultPlanningManager';
import { PlanCreationOptions, PlanCreationResult, PlanExecutionResult, Plan } from '../../../../lib/agents/base/managers/PlanningManager';

/**
 * Enhanced planning manager that integrates recovery and adaptation systems
 */
export class EnhancedPlanningManager extends DefaultPlanningManager {
  private recoverySystem: PlanRecoverySystem;
  private adaptationSystem: PlanAdaptationSystem;
  
  /**
   * Create a new EnhancedPlanningManager
   * 
   * @param agent The agent this manager belongs to
   * @param options Configuration options
   */
  constructor(
    agent: AgentBase,
    options: {
      recoverySystem?: PlanRecoverySystem;
      adaptationSystem?: PlanAdaptationSystem;
      config?: Record<string, unknown>;
    } = {}
  ) {
    super(agent, options.config || {});
    
    // Use provided systems or create defaults
    this.recoverySystem = options.recoverySystem || new DefaultPlanRecoverySystem();
    this.adaptationSystem = options.adaptationSystem || new DefaultPlanAdaptationSystem();
  }
  
  /**
   * Initialize the manager and sub-systems
   */
  async initialize(): Promise<boolean> {
    // Initialize parent class
    const baseInitialized = await super.initialize();
    if (!baseInitialized) {
      return false;
    }
    
    // Initialize sub-systems
    try {
      await this.recoverySystem.initialize();
      await this.adaptationSystem.initialize();
      return true;
    } catch (error) {
      console.error('Error initializing planning sub-systems:', error);
      return false;
    }
  }
  
  /**
   * Shutdown the manager and sub-systems
   */
  async shutdown(): Promise<void> {
    try {
      await this.recoverySystem.shutdown();
      await this.adaptationSystem.shutdown();
    } catch (error) {
      console.error('Error shutting down planning sub-systems:', error);
    }
    
    await super.shutdown();
  }
  
  /**
   * Create a new plan with enhanced error handling
   */
  async createPlan(options: PlanCreationOptions): Promise<PlanCreationResult> {
    try {
      // Call parent implementation
      return await super.createPlan(options);
    } catch (error) {
      // Handle error with recovery system
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
      // Call parent implementation
      const result = await super.executePlan(planId);
      
      if (!result.success) {
        // If execution failed, record the failure
        const failureId = await this.recoverySystem.recordFailure({
          planId,
          message: result.error || 'Plan execution failed',
          category: result.error?.includes('timeout')
            ? 'timeout' as any
            : 'unknown' as any,
          severity: 'medium' as any,
          timestamp: new Date()
        });
        
        // Attempt recovery
        await this.recoverySystem.executeAutomaticRecovery(failureId);
      }
      
      return result;
    } catch (error) {
      // Handle error with recovery system
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
   * Adapt a plan with enhanced adaptation system
   */
  async adaptPlan(planId: string, reason: string): Promise<Plan | null> {
    try {
      // Add the plan to the adaptation system's cache
      const plan = await this.getPlan(planId);
      if (!plan) {
        return null;
      }
      
      // Inject plan into adaptation system's cache
      (this.adaptationSystem as any).planCache.set(planId, plan);
      
      // Detect adaptation opportunities
      const opportunities = await this.adaptationSystem.detectOpportunities(
        planId,
        {
          type: 'goal_change' as any,
          source: this.getId(),
          description: reason
        }
      );
      
      if (opportunities.length === 0) {
        // Fall back to parent implementation
        return super.adaptPlan(planId, reason);
      }
      
      // Use the highest priority opportunity
      const opportunity = opportunities.sort((a, b) => b.priorityScore - a.priorityScore)[0];
      
      // Trigger adaptation process with auto-apply
      const adaptationResult = await this.adaptationSystem.triggerAdaptation(
        planId,
        {
          type: 'goal_change' as any,
          source: this.getId(),
          description: reason
        },
        {
          autoApply: true
        }
      );
      
      if (adaptationResult.appliedAdaptation?.success) {
        // Get the modified plan
        const modifiedPlan = await this.getPlan(planId);
        
        // If adaptation didn't modify the plan, fall back to parent implementation
        if (!modifiedPlan) {
          return super.adaptPlan(planId, reason);
        }
        
        return modifiedPlan;
      }
      
      // Fall back to parent implementation
      return super.adaptPlan(planId, reason);
    } catch (error) {
      console.error('Error in enhanced adaptPlan:', error);
      // Fall back to parent implementation
      return super.adaptPlan(planId, reason);
    }
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
   * Register a custom recovery strategy
   */
  async registerRecoveryStrategy(strategy: any): Promise<boolean> {
    return this.recoverySystem.registerRecoveryStrategy(strategy);
  }
  
  /**
   * Register a custom adaptation strategy
   */
  async registerAdaptationStrategy(strategy: any): Promise<boolean> {
    return this.adaptationSystem.registerStrategy(strategy);
  }
} 