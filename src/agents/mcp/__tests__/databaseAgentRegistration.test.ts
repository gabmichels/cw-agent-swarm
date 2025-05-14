/**
 * Test the database agent registration functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadAndRegisterAgents, registerNewAgent, updateAgentRegistration, deregisterAgent } from '../databaseAgentRegistration';
import { MCPRuntime } from '../MCPRuntime';
import { AgentService } from '../../../services/AgentService';
import { AgentFactory } from '../../shared/AgentFactory';
import { AgentProfile } from '@/lib/multi-agent/types/agent';

// Mock dependencies
vi.mock('../MCPRuntime', () => ({
  MCPRuntime: {
    registerAgent: vi.fn(),
    deregisterAgent: vi.fn(),
    getAllAgents: vi.fn().mockReturnValue([])
  }
}));

vi.mock('../../../services/AgentService', () => ({
  AgentService: {
    getAllAgents: vi.fn(),
    getAgent: vi.fn()
  }
}));

vi.mock('../../shared/AgentFactory', () => ({
  AgentFactory: vi.fn().mockImplementation(() => ({
    createAgent: vi.fn().mockResolvedValue({
      id: 'test-agent',
      name: 'Test Agent',
      processTask: vi.fn().mockResolvedValue('Task result')
    })
  }))
}));

describe('Database Agent Registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('loadAndRegisterAgents', () => {
    it('should load agents from database and register them with MCP', async () => {
      // Setup mock data with proper AgentProfile structure
      const mockAgents: AgentProfile[] = [
        {
          id: 'agent1',
          name: 'Agent 1',
          description: 'Test agent 1',
          status: 'available',
          capabilities: [{ id: 'cap1', name: 'capability1', description: 'Capability 1' }],
          parameters: { model: 'gpt-4', temperature: 0.7, maxTokens: 2000, tools: [] },
          metadata: { tags: [], domain: [], specialization: [], version: '1.0', isPublic: false, performanceMetrics: { successRate: 0, averageResponseTime: 0, taskCompletionRate: 0 } },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'agent2',
          name: 'Agent 2',
          description: 'Test agent 2',
          status: 'available',
          capabilities: [{ id: 'cap2', name: 'capability2', description: 'Capability 2' }],
          parameters: { model: 'gpt-4', temperature: 0.7, maxTokens: 2000, tools: [] },
          metadata: { tags: [], domain: [], specialization: [], version: '1.0', isPublic: false, performanceMetrics: { successRate: 0, averageResponseTime: 0, taskCompletionRate: 0 } },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      
      // Setup mocks
      vi.mocked(AgentService.getAllAgents).mockResolvedValue(mockAgents);

      // Call the function
      await loadAndRegisterAgents();

      // Assertions
      expect(AgentService.getAllAgents).toHaveBeenCalledTimes(1);
      expect(MCPRuntime.registerAgent).toHaveBeenCalledTimes(2);
      
      // Verify the agents were registered with MCP
      expect(MCPRuntime.registerAgent).toHaveBeenCalledWith(expect.objectContaining({
        id: 'agent1',
        name: 'Agent 1'
      }));
      
      expect(MCPRuntime.registerAgent).toHaveBeenCalledWith(expect.objectContaining({
        id: 'agent2',
        name: 'Agent 2'
      }));
    });

    it('should handle empty agent list', async () => {
      // Setup mocks
      vi.mocked(AgentService.getAllAgents).mockResolvedValue([]);

      // Call the function
      await loadAndRegisterAgents();

      // Assertions
      expect(AgentService.getAllAgents).toHaveBeenCalledTimes(1);
      expect(MCPRuntime.registerAgent).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      // Setup mocks
      vi.mocked(AgentService.getAllAgents).mockRejectedValue(new Error('Database error'));

      // Call the function
      await loadAndRegisterAgents();

      // Assertions
      expect(AgentService.getAllAgents).toHaveBeenCalledTimes(1);
      expect(MCPRuntime.registerAgent).not.toHaveBeenCalled();
    });
  });

  describe('registerNewAgent', () => {
    it('should register a new agent with MCP', () => {
      // Setup mock data
      const mockAgent = {
        id: 'new-agent',
        name: 'New Agent',
        capabilities: ['capability1', 'capability2']
      };

      // Call the function
      registerNewAgent(mockAgent);

      // Assertions
      expect(MCPRuntime.registerAgent).toHaveBeenCalledTimes(1);
      expect(MCPRuntime.registerAgent).toHaveBeenCalledWith(expect.objectContaining({
        id: 'new-agent',
        name: 'New Agent',
        capabilities: ['capability1', 'capability2']
      }));
    });

    it('should handle errors gracefully', () => {
      // Setup mocks
      vi.mocked(MCPRuntime.registerAgent).mockImplementation(() => {
        throw new Error('Registration error');
      });

      // Setup mock data
      const mockAgent = {
        id: 'error-agent',
        name: 'Error Agent',
        capabilities: ['capability1']
      };

      // Call the function - should not throw
      registerNewAgent(mockAgent);

      // Assertions
      expect(MCPRuntime.registerAgent).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateAgentRegistration', () => {
    it('should update an existing agent registration with MCP', () => {
      // Setup mock data
      const mockAgent = {
        id: 'update-agent',
        name: 'Updated Agent',
        capabilities: ['capability1', 'capability2']
      };

      // Call the function
      updateAgentRegistration(mockAgent);

      // Assertions
      expect(MCPRuntime.deregisterAgent).toHaveBeenCalledTimes(1);
      expect(MCPRuntime.deregisterAgent).toHaveBeenCalledWith('update-agent');
      
      expect(MCPRuntime.registerAgent).toHaveBeenCalledTimes(1);
      expect(MCPRuntime.registerAgent).toHaveBeenCalledWith(expect.objectContaining({
        id: 'update-agent',
        name: 'Updated Agent',
        capabilities: ['capability1', 'capability2']
      }));
    });
  });

  describe('deregisterAgent', () => {
    it('should deregister an agent from MCP', () => {
      // Call the function
      deregisterAgent('agent-to-remove');

      // Assertions
      expect(MCPRuntime.deregisterAgent).toHaveBeenCalledTimes(1);
      expect(MCPRuntime.deregisterAgent).toHaveBeenCalledWith('agent-to-remove');
    });
  });
}); 