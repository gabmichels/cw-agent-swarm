/**
 * PlanningManager.interface.test.ts - Tests for the PlanningManager interface
 * 
 * This file contains tests to ensure the PlanningManager interface is properly defined
 * and extends the BaseManager interface correctly.
 */

import { describe, it, expect } from 'vitest';
import { PlanningManager, PlanningManagerConfig } from './PlanningManager.interface';
import { BaseManager, AbstractBaseManager } from './BaseManager';
import { AgentBase } from '../AgentBase.interface';
import { ManagerType } from './ManagerType';

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
        this.initialized = true;
        return true;
      }
      
      async shutdown(): Promise<void> {
        this.initialized = false;
      }
      
      async createPlan(options: any): Promise<any> {
        return { success: true, plan: { id: '1', ...options } };
      }
      
      async getPlan(planId: string): Promise<any> {
        return { id: planId };
      }
      
      async getAllPlans(): Promise<any[]> {
        return [];
      }
      
      async updatePlan(planId: string, updates: any): Promise<any> {
        return { id: planId, ...updates };
      }
      
      async deletePlan(planId: string): Promise<boolean> {
        return true;
      }
      
      async executePlan(planId: string): Promise<any> {
        return { success: true };
      }
      
      async adaptPlan(planId: string, reason: string): Promise<any> {
        return { id: planId };
      }
      
      async validatePlan(planId: string): Promise<boolean> {
        return true;
      }
      
      async optimizePlan(planId: string): Promise<any> {
        return { id: planId };
      }
    }
    
    // Create an instance to confirm the class satisfies the interface
    const planningManager = new MockPlanningManager();
    expect(planningManager).toBeDefined();
    expect(planningManager.getType()).toBe(ManagerType.PLANNING);
  });
}); 