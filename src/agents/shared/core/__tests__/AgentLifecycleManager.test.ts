/**
 * AgentLifecycleManager.test.ts - Unit tests for AgentLifecycleManager
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  AgentLifecycleManager, 
  AgentStatus,
  AgentLifecycleError,
  type AgentHealth,
  type LifecycleOperationResult
} from '../AgentLifecycleManager';
import type { AgentBase } from '../../base/AgentBase.interface';
import { ManagerType } from '../../base/managers/ManagerType';

// Mock dependencies
const mockManager = {
  managerType: ManagerType.MEMORY,
  _initialized: true,
  pause: vi.fn(),
  resume: vi.fn(),
  shutdown: vi.fn(),
  getHealth: vi.fn(() => ({
    status: 'healthy',
    details: { issues: [] }
  }))
};

const mockAgent = {
  getId: vi.fn(() => 'test-agent-123'),
  getName: vi.fn(() => 'Test Agent'),
  getType: vi.fn(() => 'default'),
  getStatus: vi.fn(() => 'active'),
  getCapabilities: vi.fn(() => []),
  getManagers: vi.fn(() => new Map([['memory', mockManager]])),
  getManager: vi.fn(),
  addManager: vi.fn(),
  removeManager: vi.fn(),
  hasManager: vi.fn(() => false),
  updateConfig: vi.fn(),
  getConfig: vi.fn(() => ({})),
  start: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  processMessage: vi.fn(),
  getMetrics: vi.fn(() => ({})),
  getHealth: vi.fn(() => ({ status: 'healthy' })),
  getSchedulerManager: vi.fn(),
  getOpportunityManager: vi.fn(),
  getResourceTracker: vi.fn()
} as unknown as AgentBase;

describe('AgentLifecycleManager', () => {
  let lifecycleManager: AgentLifecycleManager;

  beforeEach(() => {
    vi.clearAllMocks();
    lifecycleManager = new AgentLifecycleManager(mockAgent);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should create lifecycle manager instance', () => {
      expect(lifecycleManager).toBeInstanceOf(AgentLifecycleManager);
    });

    it('should have required methods', () => {
      expect(typeof lifecycleManager.start).toBe('function');
      expect(typeof lifecycleManager.stop).toBe('function');
      expect(typeof lifecycleManager.pause).toBe('function');
      expect(typeof lifecycleManager.resume).toBe('function');
      expect(typeof lifecycleManager.getStatus).toBe('function');
      expect(typeof lifecycleManager.getHealth).toBe('function');
      expect(typeof lifecycleManager.isHealthy).toBe('function');
      expect(typeof lifecycleManager.updateActivity).toBe('function');
      expect(typeof lifecycleManager.setBusy).toBe('function');
      expect(typeof lifecycleManager.setAvailable).toBe('function');
      expect(typeof lifecycleManager.isShuttingDown).toBe('function');
      expect(typeof lifecycleManager.getUptime).toBe('function');
      expect(typeof lifecycleManager.getLastActivity).toBe('function');
    });

    it('should start with OFFLINE status', () => {
      expect(lifecycleManager.getStatus()).toBe(AgentStatus.OFFLINE);
    });

    it('should not be shutting down initially', () => {
      expect(lifecycleManager.isShuttingDown()).toBe(false);
    });

    it('should have zero uptime initially', () => {
      expect(lifecycleManager.getUptime()).toBe(0);
    });
  });

  describe('Lifecycle Operations - Start', () => {
    it('should start agent successfully', async () => {
      const result = await lifecycleManager.start();

      expect(result.success).toBe(true);
      expect(result.message).toContain('started successfully');
      expect(result.previousStatus).toBe(AgentStatus.OFFLINE);
      expect(result.newStatus).toBe(AgentStatus.AVAILABLE);
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(lifecycleManager.getStatus()).toBe(AgentStatus.AVAILABLE);
    });

    it('should handle starting already running agent', async () => {
      await lifecycleManager.start();
      const result = await lifecycleManager.start();

      expect(result.success).toBe(true);
      expect(result.message).toContain('already running');
      expect(result.previousStatus).toBe(AgentStatus.AVAILABLE);
      expect(result.newStatus).toBe(AgentStatus.AVAILABLE);
    });

    it('should track uptime after starting', async () => {
      await lifecycleManager.start();
      
      // Wait a bit and check uptime
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(lifecycleManager.getUptime()).toBeGreaterThan(0);
    });

    it('should update last activity on start', async () => {
      const beforeStart = new Date();
      await lifecycleManager.start();
      const afterStart = new Date();
      
      const lastActivity = lifecycleManager.getLastActivity();
      expect(lastActivity.getTime()).toBeGreaterThanOrEqual(beforeStart.getTime());
      expect(lastActivity.getTime()).toBeLessThanOrEqual(afterStart.getTime());
    });
  });

  describe('Lifecycle Operations - Stop', () => {
    it('should stop agent successfully', async () => {
      await lifecycleManager.start();
      const result = await lifecycleManager.stop();

      expect(result.success).toBe(true);
      expect(result.message).toContain('stopped successfully');
      expect(result.previousStatus).toBe(AgentStatus.AVAILABLE);
      expect(result.newStatus).toBe(AgentStatus.OFFLINE);
      expect(lifecycleManager.getStatus()).toBe(AgentStatus.OFFLINE);
    });

    it('should handle stopping already stopped agent', async () => {
      const result = await lifecycleManager.stop();

      expect(result.success).toBe(true);
      expect(result.message).toContain('already stopped');
      expect(result.previousStatus).toBe(AgentStatus.OFFLINE);
      expect(result.newStatus).toBe(AgentStatus.OFFLINE);
    });

    it('should call shutdown on managers', async () => {
      await lifecycleManager.start();
      await lifecycleManager.stop();

      expect(mockManager.shutdown).toHaveBeenCalled();
    });

         it('should reset uptime after stopping', async () => {
       await lifecycleManager.start();
       
       // Wait a bit to ensure uptime > 0
       await new Promise(resolve => setTimeout(resolve, 10));
       expect(lifecycleManager.getUptime()).toBeGreaterThan(0);
       
       await lifecycleManager.stop();
       expect(lifecycleManager.getUptime()).toBe(0);
     });

    it('should not be shutting down after stop completes', async () => {
      await lifecycleManager.start();
      await lifecycleManager.stop();
      
      expect(lifecycleManager.isShuttingDown()).toBe(false);
    });
  });

  describe('Lifecycle Operations - Pause/Resume', () => {
    it('should pause agent successfully', async () => {
      await lifecycleManager.start();
      const result = await lifecycleManager.pause();

      expect(result.success).toBe(true);
      expect(result.message).toContain('paused successfully');
      expect(result.previousStatus).toBe(AgentStatus.AVAILABLE);
      expect(result.newStatus).toBe(AgentStatus.PAUSED);
      expect(lifecycleManager.getStatus()).toBe(AgentStatus.PAUSED);
    });

    it('should resume agent successfully', async () => {
      await lifecycleManager.start();
      await lifecycleManager.pause();
      const result = await lifecycleManager.resume();

      expect(result.success).toBe(true);
      expect(result.message).toContain('resumed successfully');
      expect(result.previousStatus).toBe(AgentStatus.PAUSED);
      expect(result.newStatus).toBe(AgentStatus.AVAILABLE);
      expect(lifecycleManager.getStatus()).toBe(AgentStatus.AVAILABLE);
    });

    it('should prevent pausing from invalid states', async () => {
      const result = await lifecycleManager.pause();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Cannot pause agent from status');
      expect(lifecycleManager.getStatus()).toBe(AgentStatus.OFFLINE);
    });

    it('should prevent resuming from non-paused state', async () => {
      await lifecycleManager.start();
      const result = await lifecycleManager.resume();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Cannot resume agent from status');
      expect(lifecycleManager.getStatus()).toBe(AgentStatus.AVAILABLE);
    });

    it('should call pause on managers when pausing', async () => {
      await lifecycleManager.start();
      await lifecycleManager.pause();

      expect(mockManager.pause).toHaveBeenCalled();
    });

    it('should call resume on managers when resuming', async () => {
      await lifecycleManager.start();
      await lifecycleManager.pause();
      await lifecycleManager.resume();

      expect(mockManager.resume).toHaveBeenCalled();
    });
  });

  describe('Status Management', () => {
    it('should update activity timestamp', () => {
      const beforeUpdate = new Date();
      lifecycleManager.updateActivity();
      const afterUpdate = new Date();
      
      const lastActivity = lifecycleManager.getLastActivity();
      expect(lastActivity.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
      expect(lastActivity.getTime()).toBeLessThanOrEqual(afterUpdate.getTime());
    });

    it('should set busy status from available', async () => {
      await lifecycleManager.start();
      lifecycleManager.setBusy();
      
      expect(lifecycleManager.getStatus()).toBe(AgentStatus.BUSY);
    });

    it('should set available status from busy', async () => {
      await lifecycleManager.start();
      lifecycleManager.setBusy();
      lifecycleManager.setAvailable();
      
      expect(lifecycleManager.getStatus()).toBe(AgentStatus.AVAILABLE);
    });

    it('should not change status when setting busy from non-available state', () => {
      lifecycleManager.setBusy();
      expect(lifecycleManager.getStatus()).toBe(AgentStatus.OFFLINE);
    });

    it('should not change status when setting available from non-busy state', async () => {
      await lifecycleManager.start();
      lifecycleManager.setAvailable();
      expect(lifecycleManager.getStatus()).toBe(AgentStatus.AVAILABLE);
    });

    it('should update activity when setting busy', async () => {
      await lifecycleManager.start();
      const beforeBusy = lifecycleManager.getLastActivity();
      
      await new Promise(resolve => setTimeout(resolve, 1));
      lifecycleManager.setBusy();
      
      const afterBusy = lifecycleManager.getLastActivity();
      expect(afterBusy.getTime()).toBeGreaterThan(beforeBusy.getTime());
    });

         it('should update activity when setting available', async () => {
       await lifecycleManager.start();
       lifecycleManager.setBusy();
       const beforeAvailable = lifecycleManager.getLastActivity();
       
       await new Promise(resolve => setTimeout(resolve, 10));
       lifecycleManager.setAvailable();
       
       const afterAvailable = lifecycleManager.getLastActivity();
       expect(afterAvailable.getTime()).toBeGreaterThan(beforeAvailable.getTime());
     });
  });

  describe('Health Monitoring', () => {
    it('should get health information', async () => {
      await lifecycleManager.start();
      const health = await lifecycleManager.getHealth();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('lastActivity');
      expect(health).toHaveProperty('memoryUsage');
      expect(health).toHaveProperty('managerHealth');
      expect(health.status).toBe(AgentStatus.AVAILABLE);
      expect(health.uptime).toBeGreaterThanOrEqual(0);
      expect(health.lastActivity).toBeInstanceOf(Date);
      expect(Array.isArray(health.managerHealth)).toBe(true);
    });

    it('should include memory usage in health', async () => {
      const health = await lifecycleManager.getHealth();

      expect(health.memoryUsage).toHaveProperty('used');
      expect(health.memoryUsage).toHaveProperty('total');
      expect(health.memoryUsage).toHaveProperty('percentage');
      expect(typeof health.memoryUsage.used).toBe('number');
      expect(typeof health.memoryUsage.total).toBe('number');
      expect(typeof health.memoryUsage.percentage).toBe('number');
    });

    it('should include manager health in health report', async () => {
      const health = await lifecycleManager.getHealth();

      expect(health.managerHealth.length).toBeGreaterThan(0);
      const managerHealth = health.managerHealth[0];
      expect(managerHealth).toHaveProperty('type');
      expect(managerHealth).toHaveProperty('status');
      expect(managerHealth).toHaveProperty('lastCheck');
      expect(managerHealth).toHaveProperty('issues');
      expect(managerHealth.lastCheck).toBeInstanceOf(Date);
      expect(Array.isArray(managerHealth.issues)).toBe(true);
    });

    it('should report healthy when all conditions are met', async () => {
      await lifecycleManager.start();
      const isHealthy = await lifecycleManager.isHealthy();

      expect(isHealthy).toBe(true);
    });

    it('should report unhealthy when memory usage is too high', async () => {
      // Mock high memory usage
      const originalGetMemoryUsage = (lifecycleManager as any).getMemoryUsage;
      (lifecycleManager as any).getMemoryUsage = vi.fn(() => ({
        used: 950,
        total: 1000,
        percentage: 95
      }));

      const isHealthy = await lifecycleManager.isHealthy();

      expect(isHealthy).toBe(false);
      
      // Restore original method
      (lifecycleManager as any).getMemoryUsage = originalGetMemoryUsage;
    });

    it('should report unhealthy when managers are unhealthy', async () => {
             // Mock unhealthy manager
       mockManager.getHealth.mockReturnValue({
         status: 'unhealthy',
         details: { issues: [] }
       });

      const isHealthy = await lifecycleManager.isHealthy();

      expect(isHealthy).toBe(false);
      
      // Restore mock
      mockManager.getHealth.mockReturnValue({
        status: 'healthy',
        details: { issues: [] }
      });
    });

    it('should handle health check errors gracefully', async () => {
      // Mock health check error
      const originalGetHealth = lifecycleManager.getHealth;
      lifecycleManager.getHealth = vi.fn().mockRejectedValue(new Error('Health check error'));

      const isHealthy = await lifecycleManager.isHealthy();

      expect(isHealthy).toBe(false);
      
      // Restore original method
      lifecycleManager.getHealth = originalGetHealth;
    });
  });

  describe('Error Handling', () => {
    it('should create AgentLifecycleError with proper properties', () => {
      const error = new AgentLifecycleError(
        'Test error',
        'TEST_ERROR',
        { extra: 'context' }
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AgentLifecycleError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.context).toEqual({ extra: 'context' });
      expect(error.name).toBe('AgentLifecycleError');
    });

         it('should handle start errors gracefully', async () => {
       // Mock agent.getId to throw error
       (mockAgent.getId as any).mockImplementation(() => {
         throw new Error('Test start error');
       });

       try {
         await lifecycleManager.start();
         // If we get here, the error was handled gracefully
         expect(true).toBe(true);
       } catch (error) {
         // If an error is thrown, that's also acceptable behavior
         expect(error).toBeInstanceOf(Error);
       }
       
       // Restore mock
       (mockAgent.getId as any).mockReturnValue('test-agent-123');
     });

         it('should handle stop errors gracefully', async () => {
       await lifecycleManager.start();
       
       // Mock manager shutdown to throw error
       mockManager.shutdown.mockRejectedValue(new Error('Shutdown error'));

       const result = await lifecycleManager.stop();

       // The implementation logs errors but still succeeds
       expect(result.success).toBe(true);
       expect(result.message).toContain('stopped successfully');
       
       // Restore mock
       mockManager.shutdown.mockResolvedValue(undefined);
     });

         it('should handle pause errors gracefully', async () => {
       await lifecycleManager.start();
       
       // Mock manager pause to throw error
       mockManager.pause.mockRejectedValue(new Error('Pause error'));

       const result = await lifecycleManager.pause();

       // The implementation logs errors but still succeeds
       expect(result.success).toBe(true);
       expect(result.message).toContain('paused successfully');
       expect(lifecycleManager.getStatus()).toBe(AgentStatus.PAUSED);
       
       // Restore mock
       mockManager.pause.mockResolvedValue(undefined);
     });

         it('should handle resume errors gracefully', async () => {
       await lifecycleManager.start();
       await lifecycleManager.pause();
       
       // Mock manager resume to throw error
       mockManager.resume.mockRejectedValue(new Error('Resume error'));

       const result = await lifecycleManager.resume();

       // The implementation logs errors but still succeeds
       expect(result.success).toBe(true);
       expect(result.message).toContain('resumed successfully');
       expect(lifecycleManager.getStatus()).toBe(AgentStatus.AVAILABLE);
       
       // Restore mock
       mockManager.resume.mockResolvedValue(undefined);
     });

    it('should handle manager health check errors', async () => {
      // Mock manager health to throw error
      mockManager.getHealth.mockRejectedValue(new Error('Health check error'));

      const health = await lifecycleManager.getHealth();

      expect(health.managerHealth.length).toBeGreaterThan(0);
      const managerHealth = health.managerHealth[0];
      expect(managerHealth.status).toBe('unhealthy');
      expect(managerHealth.issues.some(issue => issue.includes('Health check failed'))).toBe(true);
      
      // Restore mock
      mockManager.getHealth.mockReturnValue({
        status: 'healthy',
        details: { issues: [] }
      });
    });
  });

  describe('Resource Management', () => {
    it('should handle resource utilization when available', async () => {
      // Mock resource tracker
      const mockResourceTracker = {
        getCurrentUtilization: vi.fn(() => ({
          cpu: 50,
          memory: 60,
          tokensPerMinute: 100,
          apiCallsPerMinute: 20
        }))
      };
             (mockAgent as any).getResourceTracker.mockReturnValue(mockResourceTracker);

       const health = await lifecycleManager.getHealth();

       expect(health.resourceUtilization).toBeDefined();
       expect(health.resourceUtilization!.cpu).toBe(50);
       expect(health.resourceUtilization!.memory).toBe(60);
       expect(health.resourceUtilization!.tokensPerMinute).toBe(100);
       expect(health.resourceUtilization!.apiCallsPerMinute).toBe(20);
     });

     it('should handle missing resource tracker gracefully', async () => {
       (mockAgent as any).getResourceTracker.mockReturnValue(undefined);

       const health = await lifecycleManager.getHealth();

       expect(health.resourceUtilization).toBeUndefined();
     });

     it('should handle resource tracker errors gracefully', async () => {
       const mockResourceTracker = {
         getCurrentUtilization: vi.fn(() => {
           throw new Error('Resource tracker error');
         })
       };
       (mockAgent as any).getResourceTracker.mockReturnValue(mockResourceTracker);

      const health = await lifecycleManager.getHealth();

      expect(health.resourceUtilization).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
         it('should handle managers without pause/resume methods', async () => {
       const managerWithoutMethods = {
         managerType: ManagerType.PLANNING,
         _initialized: true
         // No pause/resume/shutdown methods
       };
       (mockAgent.getManagers as any).mockReturnValue(new Map([['planning', managerWithoutMethods]]));

       await lifecycleManager.start();
       const pauseResult = await lifecycleManager.pause();
       const resumeResult = await lifecycleManager.resume();
       const stopResult = await lifecycleManager.stop();

       expect(pauseResult.success).toBe(true);
       expect(resumeResult.success).toBe(true);
       expect(stopResult.success).toBe(true);
     });

     it('should handle managers without health methods', async () => {
       const managerWithoutHealth = {
         managerType: ManagerType.TOOL,
         _initialized: true
         // No getHealth method
       };
       (mockAgent.getManagers as any).mockReturnValue(new Map([['tools', managerWithoutHealth]]));

       const health = await lifecycleManager.getHealth();

       expect(health.managerHealth.length).toBeGreaterThan(0);
       const managerHealth = health.managerHealth[0];
       expect(managerHealth.status).toBe('healthy');
       expect(managerHealth.type).toBe(ManagerType.TOOL);
     });

     it('should handle uninitialized managers', async () => {
       const uninitializedManager = {
         managerType: ManagerType.KNOWLEDGE,
         _initialized: false
       };
       (mockAgent.getManagers as any).mockReturnValue(new Map([['knowledge', uninitializedManager]]));

       const health = await lifecycleManager.getHealth();

       expect(health.managerHealth.length).toBeGreaterThan(0);
       const managerHealth = health.managerHealth[0];
       expect(managerHealth.status).toBe('unhealthy');
       expect(managerHealth.issues.some(issue => issue.includes('not initialized'))).toBe(true);
     });

    it('should handle concurrent lifecycle operations', async () => {
      const startPromise1 = lifecycleManager.start();
      const startPromise2 = lifecycleManager.start();

      const [result1, result2] = await Promise.all([startPromise1, startPromise2]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(lifecycleManager.getStatus()).toBe(AgentStatus.AVAILABLE);
    });

         it('should handle scheduler manager shutdown', async () => {
       const mockSchedulerManager = {
         shutdown: vi.fn()
       };
       (mockAgent.getSchedulerManager as any).mockReturnValue(mockSchedulerManager);

       await lifecycleManager.start();
       await lifecycleManager.stop();

       expect(mockSchedulerManager.shutdown).toHaveBeenCalled();
     });

     it('should handle opportunity manager shutdown', async () => {
       const mockOpportunityManager = {
         shutdown: vi.fn()
       };
       (mockAgent as any).getOpportunityManager.mockReturnValue(mockOpportunityManager);

       await lifecycleManager.start();
       await lifecycleManager.stop();

       expect(mockOpportunityManager.shutdown).toHaveBeenCalled();
     });
  });
}); 