/**
 * Planning System Integration
 * 
 * This file provides integration between the DefaultPlanningManager and
 * the plan recovery and adaptation systems.
 */

import { AgentBase } from '../../base/AgentBase.interface';
import { PlanRecoverySystem, RecoveryStrategy } from '../interfaces/PlanRecovery.interface';
import { PlanAdaptationSystem, PlanAdaptationStrategy } from '../interfaces/PlanAdaptation.interface';
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

/**
 * Enhanced planning manager that integrates recovery and adaptation systems
 */
export class EnhancedPlanningManager extends DefaultPlanningManager {
  private recoverySystem: PlanRecoverySystem;
  private adaptationSystem: PlanAdaptationSystem;
  
  /**
   * Create a new EnhancedPlanningManager
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
      return await super.createPlan(options);
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
} 