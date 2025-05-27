/**
 * PlanExecutor.test.ts - Unit tests for PlanExecutor component
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PlanExecutor } from '../PlanExecutor';
import { ActionExecutor } from '../ActionExecutor';

// Mock the logger
vi.mock('@/lib/logging/winston-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  })
}));

describe('PlanExecutor', () => {
  let planExecutor: PlanExecutor;
  let mockActionExecutor: ActionExecutor;

  beforeEach(() => {
    // Create mock action executor
    mockActionExecutor = {
      executeActionsConcurrently: vi.fn(),
      executeActionsSequentially: vi.fn(),
      cancelAllExecutions: vi.fn()
    } as any;

    planExecutor = new PlanExecutor({}, mockActionExecutor);
  });

  afterEach(() => {
    planExecutor.shutdown();
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      const config = planExecutor.getConfig();

      expect(config.defaultExecutionConfig.maxConcurrentSteps).toBe(3);
      expect(config.defaultExecutionConfig.maxConcurrentActions).toBe(5);
      expect(config.defaultExecutionConfig.stepTimeoutMs).toBe(300000);
      expect(config.defaultExecutionConfig.actionTimeoutMs).toBe(60000);
      expect(config.enableLogging).toBe(true);
      expect(config.enableProgressTracking).toBe(true);
    });

    it('should allow configuration updates', () => {
      planExecutor.configure({
        enableLogging: false,
        progressUpdateIntervalMs: 10000
      });

      const config = planExecutor.getConfig();

      expect(config.enableLogging).toBe(false);
      expect(config.progressUpdateIntervalMs).toBe(10000);
    });

    it('should create executor with custom configuration', () => {
      const customExecutor = new PlanExecutor({
        enableLogging: false,
        enableProgressTracking: false,
        maxExecutionTimeMs: 1800000
      });

      const config = customExecutor.getConfig();

      expect(config.enableLogging).toBe(false);
      expect(config.enableProgressTracking).toBe(false);
      expect(config.maxExecutionTimeMs).toBe(1800000);

      customExecutor.shutdown();
    });
  });

  describe('health status', () => {
    it('should return healthy status', () => {
      const health = planExecutor.getHealthStatus();

      expect(health.healthy).toBe(true);
      expect(health.activeExecutions).toBe(0);
      expect(health.config).toBeDefined();
    });
  });

  describe('execution control', () => {
    it('should handle execution not found errors', async () => {
      await expect(planExecutor.getExecutionStatus('nonexistent')).rejects.toThrow('Execution not found');
      await expect(planExecutor.pauseExecution('nonexistent')).rejects.toThrow('Execution not found');
      await expect(planExecutor.resumeExecution('nonexistent')).rejects.toThrow('Execution not found');
      await expect(planExecutor.cancelExecution('nonexistent')).rejects.toThrow('Execution not found');
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', () => {
      expect(() => planExecutor.shutdown()).not.toThrow();
    });

    it('should shutdown without errors', () => {
      // Test that shutdown doesn't throw errors even with no active executions
      expect(() => planExecutor.shutdown()).not.toThrow();
    });
  });
}); 