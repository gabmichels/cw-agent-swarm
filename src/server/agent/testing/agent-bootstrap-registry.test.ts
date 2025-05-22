/**
 * Tests for the Agent Bootstrap Registry
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { agentBootstrapRegistry, AgentBootstrapState } from '../agent-bootstrap-registry';
import { AgentStatus } from '../../memory/schema/agent';

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
      
      const info = agentBootstrapRegistry.registerAgent(agentId, agentName);
      
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
      const firstInfo = agentBootstrapRegistry.registerAgent(agentId, 'Test Agent');
      
      // Update state
      agentBootstrapRegistry.updateAgentBootstrapState(agentId, AgentBootstrapState.IN_PROGRESS);
      
      // Try to register again
      const secondInfo = agentBootstrapRegistry.registerAgent(agentId, 'Test Agent Again');
      
      // Should return the existing registration
      expect(secondInfo).toBe(firstInfo);
      expect(secondInfo.state).toBe(AgentBootstrapState.IN_PROGRESS);
    });
    
    it('should track all registered agents', () => {
      // Register multiple agents
      agentBootstrapRegistry.registerAgent('agent-1', 'Agent 1');
      agentBootstrapRegistry.registerAgent('agent-2', 'Agent 2');
      agentBootstrapRegistry.registerAgent('agent-3', 'Agent 3');
      
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
      agentBootstrapRegistry.registerAgent(agentId, 'Test Agent');
      
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
      agentBootstrapRegistry.registerAgent(agentId, 'Test Agent');
      
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
      agentBootstrapRegistry.registerAgent('agent-1', 'Agent 1');
      agentBootstrapRegistry.registerAgent('agent-2', 'Agent 2');
      agentBootstrapRegistry.registerAgent('agent-3', 'Agent 3');
      
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
      agentBootstrapRegistry.registerAgent(agentId, 'Test Agent');
      
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
      agentBootstrapRegistry.registerAgent(agentId, 'Test Agent');
      
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
      agentBootstrapRegistry.registerAgent(agentId, 'Test Agent');
      
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
      agentBootstrapRegistry.registerAgent(agentId, 'Test Agent');
      
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
      agentBootstrapRegistry.registerAgent(agentId, 'Test Agent');
      
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