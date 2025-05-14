/**
 * SchedulerManager.interface.test.ts - Tests for the SchedulerManager interface
 * 
 * This file contains tests to ensure the SchedulerManager interface is properly defined
 * and extends the BaseManager interface correctly.
 */

import { describe, it, expect } from 'vitest';
import { SchedulerManager, SchedulerManagerConfig } from './SchedulerManager.interface';
import { BaseManager, AbstractBaseManager } from './BaseManager';
import { AgentBase } from '../AgentBase.interface';
import { ManagerType } from './ManagerType';

describe('SchedulerManager interface', () => {
  // Type tests to ensure SchedulerManager extends BaseManager
  it('should extend BaseManager interface', () => {
    // Create a type that checks if SchedulerManager extends BaseManager
    type CheckSchedulerManagerExtendsBaseManager = SchedulerManager extends BaseManager ? true : false;
    
    // This assignment will fail compilation if SchedulerManager doesn't extend BaseManager
    const extendsBaseManager: CheckSchedulerManagerExtendsBaseManager = true;
    
    expect(extendsBaseManager).toBe(true);
  });

  // Testing config type correctly extends ManagerConfig
  it('should have config that extends ManagerConfig', () => {
    // Check that specific SchedulerManagerConfig properties are present
    const config: SchedulerManagerConfig = {
      enabled: true,
      enableAutoScheduling: true,
      schedulingIntervalMs: 60000,
      maxConcurrentTasks: 5,
      maxTaskRetries: 3,
      defaultTaskTimeoutMs: 30000
    };
    
    expect(config.enabled).toBe(true);
    expect(config.enableAutoScheduling).toBe(true);
    expect(config.maxConcurrentTasks).toBe(5);
  });

  // Mock implementation to ensure interface can be implemented
  it('should allow implementation of the interface', () => {
    // Create a mock agent
    const mockAgent = {} as AgentBase;
    
    // Create a mock implementation that extends AbstractBaseManager and implements SchedulerManager
    class MockSchedulerManager extends AbstractBaseManager implements SchedulerManager {
      constructor() {
        super('mock-scheduler-manager', ManagerType.SCHEDULER, mockAgent, { enabled: true });
      }
      
      async initialize(): Promise<boolean> {
        this.initialized = true;
        return true;
      }
      
      async shutdown(): Promise<void> {
        this.initialized = false;
      }
      
      async createTask(options: any): Promise<any> {
        return { success: true, task: { id: '1', ...options } };
      }
      
      async getTask(taskId: string): Promise<any> {
        return { id: taskId };
      }
      
      async getAllTasks(): Promise<any[]> {
        return [];
      }
      
      async updateTask(taskId: string, updates: any): Promise<any> {
        return { id: taskId, ...updates };
      }
      
      async deleteTask(taskId: string): Promise<boolean> {
        return true;
      }
      
      async executeTask(taskId: string): Promise<any> {
        return { 
          success: true, 
          taskId,
          durationMs: 100
        };
      }
      
      async cancelTask(taskId: string): Promise<boolean> {
        return true;
      }
      
      async getDueTasks(): Promise<any[]> {
        return [];
      }
      
      async getRunningTasks(): Promise<any[]> {
        return [];
      }
      
      async getPendingTasks(): Promise<any[]> {
        return [];
      }
      
      async getFailedTasks(): Promise<any[]> {
        return [];
      }
      
      async retryTask(taskId: string): Promise<any> {
        return { 
          success: true, 
          taskId,
          durationMs: 100
        };
      }
    }
    
    // Create an instance to confirm the class satisfies the interface
    const schedulerManager = new MockSchedulerManager();
    expect(schedulerManager).toBeDefined();
    expect(schedulerManager.getType()).toBe(ManagerType.SCHEDULER);
  });
}); 