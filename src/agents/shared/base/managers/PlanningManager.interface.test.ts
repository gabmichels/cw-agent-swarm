/**
 * PlanningManager.interface.test.ts - Tests for the PlanningManager interface
 * 
 * This file contains tests to ensure the PlanningManager interface is properly defined
 * and extends the BaseManager interface correctly.
 */

import { describe, it, expect } from 'vitest';
import { 
  PlanningManager, 
  PlanningManagerConfig,
  PlanCreationOptions,
  PlanCreationResult,
  PlanExecutionResult,
  Plan
} from './PlanningManager.interface';
import { BaseManager, AbstractBaseManager } from './BaseManager';
import { AgentBase } from '../AgentBase.interface';
import { ManagerType } from './ManagerType';
import { ManagerHealth } from './ManagerHealth';

describe('PlanningManager interface', () => {
  // Type tests to ensure PlanningManager extends BaseManager
  it('should extend BaseManager interface', () => {
    // Create a type that checks if PlanningManager extends BaseManager
    type CheckPlanningManagerExtendsBaseManager = PlanningManager extends BaseManager ? true : false;
    
    // This assignment will fail compilation if PlanningManager doesn't extend BaseManager
    const extendsBaseManager: CheckPlanningManagerExtendsBaseManager = true;
    
    expect(extendsBaseManager).toBe(true);
  });

  // Testing config type correctly extends ManagerConfig
  it('should have config that extends ManagerConfig', () => {
    // Check that specific PlanningManagerConfig properties are present
    const config: PlanningManagerConfig = {
      enabled: true,
      enableAutoPlanning: true,
      planningIntervalMs: 300000,
      maxConcurrentPlans: 5,
      maxAdaptationAttempts: 3
    };
    
    expect(config.enabled).toBe(true);
    expect(config.enableAutoPlanning).toBe(true);
    expect(config.planningIntervalMs).toBe(300000);
    expect(config.maxConcurrentPlans).toBe(5);
  });

  // Mock implementation to ensure interface can be implemented
  it('should allow implementation of the interface', () => {
    // Create a mock agent
    const mockAgent = {} as AgentBase;
    
    // Create a mock implementation that extends AbstractBaseManager and implements PlanningManager
    class MockPlanningManager extends AbstractBaseManager implements PlanningManager {
      constructor() {
        super('mock-planning-manager', ManagerType.PLANNING, mockAgent, { enabled: true });
      }
      
      async initialize(): Promise<boolean> {
        this._initialized = true;
        return true;
      }
      
      async shutdown(): Promise<void> {
        this._initialized = false;
      }

      async getHealth(): Promise<ManagerHealth> {
        return {
          status: 'healthy',
          details: {
            lastCheck: new Date(),
            issues: [],
            metrics: {}
          }
        };
      }
      
      async createPlan(options: PlanCreationOptions): Promise<PlanCreationResult> {
        return { 
          success: true, 
          plan: { 
            id: '1',
            name: options.name,
            description: options.description,
            goals: options.goals,
            steps: [],
            status: 'pending',
            priority: options.priority || 0.5,
            confidence: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: options.metadata || {}
          }
        };
      }
      
      async getPlan(planId: string): Promise<Plan | null> {
        return {
          id: planId,
          name: 'Mock Plan',
          description: 'A mock plan',
          goals: ['Mock goal'],
          steps: [],
          status: 'pending',
          priority: 0.5,
          confidence: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {}
        };
      }
      
      async getAllPlans(): Promise<Plan[]> {
        return [];
      }
      
      async updatePlan(planId: string, updates: Partial<Plan>): Promise<Plan | null> {
        return {
          id: planId,
          name: updates.name || 'Mock Plan',
          description: updates.description || 'A mock plan',
          goals: updates.goals || ['Mock goal'],
          steps: updates.steps || [],
          status: updates.status || 'pending',
          priority: updates.priority || 0.5,
          confidence: updates.confidence || 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: updates.metadata || {}
        };
      }
      
      async deletePlan(planId: string): Promise<boolean> {
        return true;
      }
      
      async executePlan(planId: string): Promise<PlanExecutionResult> {
        return { 
          success: true,
          plan: {
            id: planId,
            name: 'Mock Plan',
            description: 'A mock plan',
            goals: ['Mock goal'],
            steps: [],
            status: 'completed',
            priority: 0.5,
            confidence: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: {}
          }
        };
      }
      
      async adaptPlan(planId: string, reason: string): Promise<Plan | null> {
        return {
          id: planId,
          name: 'Adapted Plan',
          description: 'An adapted plan',
          goals: ['Adapted goal'],
          steps: [],
          status: 'adapted',
          priority: 0.5,
          confidence: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: { adaptationReason: reason }
        };
      }
      
      async validatePlan(planId: string): Promise<boolean> {
        return true;
      }
      
      async optimizePlan(planId: string): Promise<Plan | null> {
        return {
          id: planId,
          name: 'Optimized Plan',
          description: 'An optimized plan',
          goals: ['Optimized goal'],
          steps: [],
          status: 'optimized',
          priority: 0.5,
          confidence: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {
            optimizationMetrics: {
              originalStepCount: 0,
              optimizedStepCount: 0,
              estimatedTimeReduction: 0
            }
          }
        };
      }
    }
    
    // Create an instance to confirm the class satisfies the interface
    const planningManager = new MockPlanningManager();
    expect(planningManager).toBeDefined();
    expect(planningManager.managerType).toBe(ManagerType.PLANNING);
  });
}); 