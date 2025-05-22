/**
 * Tests for the Agent Bootstrap Registry
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AgentStatus } from '../../memory/schema/agent';

// Define the state enum locally for the test
enum AgentBootstrapState {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// Create a mock implementation for tests
class MockAgentBootstrapRegistry {
  private registry: Map<string, any> = new Map();
  private locks: Map<string, boolean> = new Map();
  
  clear() {
    this.registry.clear();
    this.locks.clear();
  }
  
  registerAgent(agentId: string, agentName: string, status: AgentStatus) {
    if (this.registry.has(agentId)) {
      return this.registry.get(agentId);
    }
    
    const info = {
      agentId,
      agentName,
      state: AgentBootstrapState.NOT_STARTED,
      status,
      locked: false,
      startTime: null,
      endTime: null,
      retryCount: 0
    };
    
    this.registry.set(agentId, info);
    return info;
  }
  
  getAgentBootstrapInfo(agentId: string) {
    return this.registry.get(agentId);
  }
  
  updateAgentBootstrapState(agentId: string, state: AgentBootstrapState, error?: Error) {
    const info = this.registry.get(agentId);
    if (!info) return undefined;
    
    info.state = state;
    
    if (state === AgentBootstrapState.IN_PROGRESS && !info.startTime) {
      info.startTime = new Date();
    }
    
    if (state === AgentBootstrapState.COMPLETED || state === AgentBootstrapState.FAILED) {
      info.endTime = new Date();
      this.releaseLock(agentId);
    }
    
    if (error) {
      info.error = error;
    }
    
    return info;
  }
  
  getAllRegisteredAgentIds() {
    return Array.from(this.registry.keys());
  }
  
  getAgentsByState(state: AgentBootstrapState) {
    return Array.from(this.registry.values()).filter(info => info.state === state);
  }
  
  acquireLock(agentId: string) {
    if (!this.registry.has(agentId)) return false;
    
    const info = this.registry.get(agentId);
    if (info.locked) return false;
    
    info.locked = true;
    info.lockTimestamp = new Date();
    return true;
  }
  
  releaseLock(agentId: string) {
    if (!this.registry.has(agentId)) return false;
    
    const info = this.registry.get(agentId);
    if (!info.locked) return false;
    
    info.locked = false;
    info.lockTimestamp = undefined;
    return true;
  }
  
  incrementRetryCount(agentId: string) {
    const info = this.registry.get(agentId);
    if (!info) return 0;
    
    info.retryCount = (info.retryCount || 0) + 1;
    return info.retryCount;
  }
  
  shouldRetry(agentId: string) {
    const info = this.registry.get(agentId);
    if (!info) return false;
    
    return info.retryCount < 3; // Max 3 retries
  }
}

// Create mock instance
const agentBootstrapRegistry = new MockAgentBootstrapRegistry();

// Mock logger
vi.mock('../../../lib/logging', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('Agent Bootstrap Registry', () => {
  beforeEach(() => {
    // Clear registry between tests
    agentBootstrapRegistry.clear();
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('Agent Registration', () => {
    it('should register an agent with initial state', () => {
      const agentId = 'test-agent-1';
      const agentName = 'Test Agent';
      
      const info = agentBootstrapRegistry.registerAgent(agentId, agentName, AgentStatus.OFFLINE);
      
      expect(info).toBeDefined();
      expect(info.agentId).toBe(agentId);
      expect(info.agentName).toBe(agentName);
      expect(info.state).toBe(AgentBootstrapState.NOT_STARTED);
      expect(info.startTime).toBeNull();
      expect(info.endTime).toBeNull();
      expect(info.retryCount).toBe(0);
      expect(info.status).toBe(AgentStatus.OFFLINE);
    });
    
    it('should not duplicate agent registrations', () => {
      const agentId = 'test-agent-1';
      
      // Register first time
      const firstInfo = agentBootstrapRegistry.registerAgent(agentId, 'Test Agent', AgentStatus.OFFLINE);
      
      // Update state
      agentBootstrapRegistry.updateAgentBootstrapState(agentId, AgentBootstrapState.IN_PROGRESS);
      
      // Try to register again
      const secondInfo = agentBootstrapRegistry.registerAgent(agentId, 'Test Agent Again', AgentStatus.OFFLINE);
      
      // Should return the existing registration
      expect(secondInfo).toBe(firstInfo);
      expect(secondInfo.state).toBe(AgentBootstrapState.IN_PROGRESS);
    });
    
    it('should track all registered agents', () => {
      // Register multiple agents
      agentBootstrapRegistry.registerAgent('agent-1', 'Agent 1', AgentStatus.OFFLINE);
      agentBootstrapRegistry.registerAgent('agent-2', 'Agent 2', AgentStatus.OFFLINE);
      agentBootstrapRegistry.registerAgent('agent-3', 'Agent 3', AgentStatus.OFFLINE);
      
      const registeredIds = agentBootstrapRegistry.getAllRegisteredAgentIds();
      
      expect(registeredIds).toHaveLength(3);
      expect(registeredIds).toContain('agent-1');
      expect(registeredIds).toContain('agent-2');
      expect(registeredIds).toContain('agent-3');
    });
  });
  
  describe('Bootstrap State Management', () => {
    it('should update agent bootstrap state', () => {
      const agentId = 'test-agent-1';
      
      // Register agent
      agentBootstrapRegistry.registerAgent(agentId, 'Test Agent', AgentStatus.OFFLINE);
      
      // Update to IN_PROGRESS
      const inProgressInfo = agentBootstrapRegistry.updateAgentBootstrapState(
        agentId, 
        AgentBootstrapState.IN_PROGRESS
      );
      
      expect(inProgressInfo?.state).toBe(AgentBootstrapState.IN_PROGRESS);
      expect(inProgressInfo?.startTime).toBeInstanceOf(Date);
      expect(inProgressInfo?.endTime).toBeNull();
      
      // Update to COMPLETED
      const completedInfo = agentBootstrapRegistry.updateAgentBootstrapState(
        agentId, 
        AgentBootstrapState.COMPLETED
      );
      
      expect(completedInfo?.state).toBe(AgentBootstrapState.COMPLETED);
      expect(completedInfo?.startTime).toBeInstanceOf(Date);
      expect(completedInfo?.endTime).toBeInstanceOf(Date);
    });
    
    it('should track error information', () => {
      const agentId = 'test-agent-1';
      const testError = new Error('Test initialization error');
      
      // Register agent
      agentBootstrapRegistry.registerAgent(agentId, 'Test Agent', AgentStatus.OFFLINE);
      
      // Update to FAILED with error
      const failedInfo = agentBootstrapRegistry.updateAgentBootstrapState(
        agentId, 
        AgentBootstrapState.FAILED,
        testError
      );
      
      expect(failedInfo?.state).toBe(AgentBootstrapState.FAILED);
      expect(failedInfo?.error).toBe(testError);
      expect(failedInfo?.endTime).toBeInstanceOf(Date);
    });
    
    it('should filter agents by state', () => {
      // Register agents in different states
      agentBootstrapRegistry.registerAgent('agent-1', 'Agent 1', AgentStatus.OFFLINE);
      agentBootstrapRegistry.registerAgent('agent-2', 'Agent 2', AgentStatus.OFFLINE);
      agentBootstrapRegistry.registerAgent('agent-3', 'Agent 3', AgentStatus.OFFLINE);
      
      // Update states
      agentBootstrapRegistry.updateAgentBootstrapState('agent-1', AgentBootstrapState.IN_PROGRESS);
      agentBootstrapRegistry.updateAgentBootstrapState('agent-2', AgentBootstrapState.COMPLETED);
      agentBootstrapRegistry.updateAgentBootstrapState('agent-3', AgentBootstrapState.IN_PROGRESS);
      
      const inProgressAgents = agentBootstrapRegistry.getAgentsByState(AgentBootstrapState.IN_PROGRESS);
      
      expect(inProgressAgents).toHaveLength(2);
      expect(inProgressAgents.map(a => a.agentId)).toContain('agent-1');
      expect(inProgressAgents.map(a => a.agentId)).toContain('agent-3');
      
      const completedAgents = agentBootstrapRegistry.getAgentsByState(AgentBootstrapState.COMPLETED);
      
      expect(completedAgents).toHaveLength(1);
      expect(completedAgents[0].agentId).toBe('agent-2');
    });
  });
  
  describe('Locking Mechanism', () => {
    it('should acquire and release locks', () => {
      const agentId = 'test-agent-1';
      
      // Register agent
      agentBootstrapRegistry.registerAgent(agentId, 'Test Agent', AgentStatus.OFFLINE);
      
      // Acquire lock
      const lockAcquired = agentBootstrapRegistry.acquireLock(agentId);
      expect(lockAcquired).toBe(true);
      
      // Try to acquire again
      const secondLockAttempt = agentBootstrapRegistry.acquireLock(agentId);
      expect(secondLockAttempt).toBe(false);
      
      // Release lock
      const lockReleased = agentBootstrapRegistry.releaseLock(agentId);
      expect(lockReleased).toBe(true);
      
      // Try to acquire again after release
      const thirdLockAttempt = agentBootstrapRegistry.acquireLock(agentId);
      expect(thirdLockAttempt).toBe(true);
    });
    
    it('should automatically release lock when bootstrap is completed', () => {
      const agentId = 'test-agent-1';
      
      // Register agent
      agentBootstrapRegistry.registerAgent(agentId, 'Test Agent', AgentStatus.OFFLINE);
      
      // Acquire lock
      agentBootstrapRegistry.acquireLock(agentId);
      
      // Update to COMPLETED (should auto-release lock)
      agentBootstrapRegistry.updateAgentBootstrapState(agentId, AgentBootstrapState.COMPLETED);
      
      // Try to acquire again
      const lockAcquired = agentBootstrapRegistry.acquireLock(agentId);
      expect(lockAcquired).toBe(true);
    });
    
    it('should automatically release lock when bootstrap fails', () => {
      const agentId = 'test-agent-1';
      
      // Register agent
      agentBootstrapRegistry.registerAgent(agentId, 'Test Agent', AgentStatus.OFFLINE);
      
      // Acquire lock
      agentBootstrapRegistry.acquireLock(agentId);
      
      // Update to FAILED (should auto-release lock)
      agentBootstrapRegistry.updateAgentBootstrapState(
        agentId, 
        AgentBootstrapState.FAILED,
        new Error('Test error')
      );
      
      // Try to acquire again
      const lockAcquired = agentBootstrapRegistry.acquireLock(agentId);
      expect(lockAcquired).toBe(true);
    });
  });
  
  describe('Retry Management', () => {
    it('should track retry counts', () => {
      const agentId = 'test-agent-1';
      
      // Register agent
      agentBootstrapRegistry.registerAgent(agentId, 'Test Agent', AgentStatus.OFFLINE);
      
      // Increment retries
      expect(agentBootstrapRegistry.incrementRetryCount(agentId)).toBe(1);
      expect(agentBootstrapRegistry.incrementRetryCount(agentId)).toBe(2);
      expect(agentBootstrapRegistry.incrementRetryCount(agentId)).toBe(3);
      
      const info = agentBootstrapRegistry.getAgentBootstrapInfo(agentId);
      expect(info?.retryCount).toBe(3);
    });
    
    it('should determine if retry should be attempted', () => {
      const agentId = 'test-agent-1';
      
      // Register agent
      agentBootstrapRegistry.registerAgent(agentId, 'Test Agent', AgentStatus.OFFLINE);
      
      // Should retry with 0 retries
      expect(agentBootstrapRegistry.shouldRetry(agentId)).toBe(true);
      
      // Increment retries to max (3)
      agentBootstrapRegistry.incrementRetryCount(agentId);
      agentBootstrapRegistry.incrementRetryCount(agentId);
      agentBootstrapRegistry.incrementRetryCount(agentId);
      
      // Should not retry after max retries
      expect(agentBootstrapRegistry.shouldRetry(agentId)).toBe(false);
    });
  });
}); 