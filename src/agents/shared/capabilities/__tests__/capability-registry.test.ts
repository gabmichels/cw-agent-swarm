/**
 * Capability Registry Tests
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CapabilityRegistry } from '../capability-registry';
import { CapabilityLevel, CapabilityType, AgentCapability, Capability } from '../types';
import { AnyMemoryService } from '../../../../server/memory/services/memory/memory-service-wrappers';

// Mock memory service
const mockAddMemory = vi.fn().mockResolvedValue({ success: true, id: 'mock-mem-id' });
const mockSearchMemories = vi.fn().mockResolvedValue([]);
const mockUpdateMemory = vi.fn().mockResolvedValue(true);
const mockDeleteMemory = vi.fn().mockResolvedValue(true);

const mockMemoryService = {
  addMemory: mockAddMemory,
  searchMemories: mockSearchMemories,
  updateMemory: mockUpdateMemory,
  deleteMemory: mockDeleteMemory
} as unknown as AnyMemoryService;

// Test data
const TEST_AGENT_ID = 'test-agent-1';
const TEST_CAPABILITY_ID = 'coding.javascript';

// Sample capabilities for testing
const sampleCapability: Capability = {
  id: TEST_CAPABILITY_ID,
  name: 'JavaScript Coding',
  description: 'Ability to write and understand JavaScript code',
  type: CapabilityType.CREATION,
  parameters: {
    language: 'javascript',
    frameworks: ['node', 'react', 'express']
  },
  requiredCapabilities: [],
  incompatibleWith: []
};

const sampleAgentCapability: AgentCapability = {
  capabilityId: TEST_CAPABILITY_ID,
  level: CapabilityLevel.ADVANCED,
  proficiency: 0.85,
  enabled: true,
  parameters: {
    preferredFramework: 'react'
  }
};

describe('CapabilityRegistry', () => {
  let registry: CapabilityRegistry;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create registry instance with mocked dependencies
    registry = new CapabilityRegistry(mockMemoryService);
    
    // Default mock implementations
    mockSearchMemories.mockImplementation((params) => {
      // Mock capability definition lookup
      if (params.type === 'capability_definition' && params.filter?.['metadata.id'] === TEST_CAPABILITY_ID) {
        return Promise.resolve([{
          id: 'cap-def-1',
          payload: {
            text: sampleCapability.name,
            metadata: {
              ...sampleCapability,
              definitionType: 'capability'
            }
          }
        }]);
      }
      return Promise.resolve([]);
    });
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('registerCapability', () => {
    it('should register a capability for an agent', async () => {
      // Call method
      const result = await registry.registerCapability(TEST_AGENT_ID, sampleAgentCapability);
      
      // Verify result
      expect(result).toHaveProperty('agentId', TEST_AGENT_ID);
      expect(result).toHaveProperty('capability', sampleAgentCapability);
      expect(result).toHaveProperty('registeredAt');
      
      // Verify memory service was called
      expect(mockAddMemory).toHaveBeenCalledWith(expect.objectContaining({
        type: 'agent_capability',
        content: `${TEST_AGENT_ID}:${TEST_CAPABILITY_ID}`,
        metadata: expect.objectContaining({
          agentId: TEST_AGENT_ID,
          capability: sampleAgentCapability
        })
      }));
    });
    
    it('should throw an error if capability does not exist', async () => {
      // Mock capability not found
      mockSearchMemories.mockResolvedValueOnce([]);
      
      // Call method and expect it to throw
      await expect(registry.registerCapability(TEST_AGENT_ID, {
        ...sampleAgentCapability,
        capabilityId: 'non-existent-cap'
      })).rejects.toThrow('Capability non-existent-cap does not exist');
    });
  });
  
  describe('unregisterCapability', () => {
    it('should unregister a capability for an agent', async () => {
      // Mock finding the capability registration
      mockSearchMemories.mockImplementationOnce(() => Promise.resolve([{
        id: 'reg-1',
        payload: {
          text: `${TEST_AGENT_ID}:${TEST_CAPABILITY_ID}`,
          metadata: {
            agentId: TEST_AGENT_ID,
            capability: sampleAgentCapability
          }
        }
      }]));
      
      // Call method
      const result = await registry.unregisterCapability(TEST_AGENT_ID, TEST_CAPABILITY_ID);
      
      // Verify result
      expect(result).toBe(true);
      
      // Verify memory service was called
      expect(mockDeleteMemory).toHaveBeenCalledWith(expect.objectContaining({
        type: 'agent_capability',
        id: 'reg-1'
      }));
    });
    
    it('should return false if no registration exists', async () => {
      // Mock not finding any registration
      mockSearchMemories.mockResolvedValueOnce([]);
      
      // Call method
      const result = await registry.unregisterCapability(TEST_AGENT_ID, TEST_CAPABILITY_ID);
      
      // Verify result
      expect(result).toBe(false);
      
      // Verify memory service was not called
      expect(mockDeleteMemory).not.toHaveBeenCalled();
    });
  });
  
  describe('findProviders', () => {
    it('should find agents that provide a capability', async () => {
      // Mock finding two agent registrations
      mockSearchMemories.mockImplementationOnce(() => Promise.resolve([
        {
          id: 'reg-1',
          payload: {
            text: `agent-1:${TEST_CAPABILITY_ID}`,
            metadata: {
              agentId: 'agent-1',
              capability: {
                ...sampleAgentCapability,
                level: CapabilityLevel.EXPERT,
                proficiency: 0.9
              }
            }
          }
        },
        {
          id: 'reg-2',
          payload: {
            text: `agent-2:${TEST_CAPABILITY_ID}`,
            metadata: {
              agentId: 'agent-2',
              capability: {
                ...sampleAgentCapability,
                level: CapabilityLevel.INTERMEDIATE,
                proficiency: 0.7
              }
            }
          }
        }
      ]));
      
      // Call method
      const providers = await registry.findProviders(TEST_CAPABILITY_ID);
      
      // Verify result
      expect(providers).toHaveLength(2);
      expect(providers).toContain('agent-1');
      expect(providers).toContain('agent-2');
      
      // Verify memory service was called with correct filter
      expect(mockSearchMemories).toHaveBeenCalledWith(expect.objectContaining({
        type: 'agent_capability',
        filter: expect.objectContaining({
          'metadata.capability.capabilityId': TEST_CAPABILITY_ID,
          'metadata.capability.enabled': true
        })
      }));
    });
    
    it('should filter by minimum level', async () => {
      // Mock finding agents with different levels
      mockSearchMemories.mockImplementationOnce(() => Promise.resolve([
        {
          id: 'reg-1',
          payload: {
            text: `agent-1:${TEST_CAPABILITY_ID}`,
            metadata: {
              agentId: 'agent-1',
              capability: {
                ...sampleAgentCapability,
                level: CapabilityLevel.EXPERT
              }
            }
          }
        },
        {
          id: 'reg-2',
          payload: {
            text: `agent-2:${TEST_CAPABILITY_ID}`,
            metadata: {
              agentId: 'agent-2',
              capability: {
                ...sampleAgentCapability,
                level: CapabilityLevel.INTERMEDIATE
              }
            }
          }
        }
      ]));
      
      // Call method with minimum level filter
      const providers = await registry.findProviders(TEST_CAPABILITY_ID, {
        minimumLevel: CapabilityLevel.ADVANCED
      });
      
      // Verify filter was applied correctly
      expect(mockSearchMemories).toHaveBeenCalledWith(expect.objectContaining({
        filter: expect.objectContaining({
          'metadata.capability.level': {
            $in: [CapabilityLevel.ADVANCED, CapabilityLevel.EXPERT]
          }
        })
      }));
    });
    
    it('should prioritize preferred agents', async () => {
      // Mock finding three agents
      mockSearchMemories.mockImplementationOnce(() => Promise.resolve([
        {
          id: 'reg-1',
          payload: {
            text: `agent-1:${TEST_CAPABILITY_ID}`,
            metadata: { agentId: 'agent-1' }
          }
        },
        {
          id: 'reg-2',
          payload: {
            text: `agent-2:${TEST_CAPABILITY_ID}`,
            metadata: { agentId: 'agent-2' }
          }
        },
        {
          id: 'reg-3',
          payload: {
            text: `agent-3:${TEST_CAPABILITY_ID}`,
            metadata: { agentId: 'agent-3' }
          }
        }
      ]));
      
      // Call method with preferred agents
      const providers = await registry.findProviders(TEST_CAPABILITY_ID, {
        preferredAgentIds: ['agent-2', 'agent-3']
      });
      
      // Verify result only contains preferred agents
      expect(providers).toHaveLength(2);
      expect(providers).toContain('agent-2');
      expect(providers).toContain('agent-3');
      expect(providers).not.toContain('agent-1');
    });
  });
  
  describe('getAgentCapabilities', () => {
    it('should get all capabilities for an agent', async () => {
      // Mock finding two capability registrations
      mockSearchMemories.mockImplementationOnce(() => Promise.resolve([
        {
          id: 'reg-1',
          payload: {
            text: `${TEST_AGENT_ID}:${TEST_CAPABILITY_ID}`,
            metadata: {
              capability: sampleAgentCapability
            }
          }
        },
        {
          id: 'reg-2',
          payload: {
            text: `${TEST_AGENT_ID}:natural-language.english`,
            metadata: {
              capability: {
                capabilityId: 'natural-language.english',
                level: CapabilityLevel.EXPERT,
                enabled: true
              }
            }
          }
        }
      ]));
      
      // Call method
      const capabilities = await registry.getAgentCapabilities(TEST_AGENT_ID);
      
      // Verify result
      expect(capabilities).toHaveLength(2);
      expect(capabilities[0].capabilityId).toBe(TEST_CAPABILITY_ID);
      expect(capabilities[1].capabilityId).toBe('natural-language.english');
      
      // Verify memory service was called
      expect(mockSearchMemories).toHaveBeenCalledWith(expect.objectContaining({
        type: 'agent_capability',
        filter: {
          'metadata.agentId': TEST_AGENT_ID
        }
      }));
    });
    
    it('should return empty array if agent has no capabilities', async () => {
      // Mock not finding any registrations
      mockSearchMemories.mockResolvedValueOnce([]);
      
      // Call method
      const capabilities = await registry.getAgentCapabilities(TEST_AGENT_ID);
      
      // Verify result
      expect(capabilities).toEqual([]);
    });
  });
  
  describe('defineCapability', () => {
    it('should define a new capability', async () => {
      // Mock checking for existing capability (not found)
      mockSearchMemories.mockResolvedValueOnce([]);
      
      // New capability without ID
      const newCapability: Omit<Capability, 'id'> = {
        name: 'Python Coding',
        description: 'Ability to write and understand Python code',
        type: CapabilityType.CREATION,
        parameters: {
          language: 'python',
          frameworks: ['django', 'flask']
        },
        requiredCapabilities: [],
        incompatibleWith: []
      };
      
      // Call method
      const result = await registry.defineCapability(newCapability);
      
      // Verify result has generated ID
      expect(result).toHaveProperty('id', 'creation.python_coding');
      expect(result.name).toBe(newCapability.name);
      
      // Verify memory service was called
      expect(mockAddMemory).toHaveBeenCalledWith(expect.objectContaining({
        type: 'capability_definition',
        content: 'Python Coding',
        metadata: expect.objectContaining({
          definitionType: 'capability',
          name: 'Python Coding',
          type: CapabilityType.CREATION
        })
      }));
    });
    
    it('should throw error if capability ID already exists', async () => {
      // Mock finding existing capability
      mockSearchMemories.mockResolvedValueOnce([{
        id: 'cap-def-1',
        payload: {
          text: 'JavaScript Coding',
          metadata: { ...sampleCapability }
        }
      }]);
      
      // Call method and expect it to throw
      await expect(registry.defineCapability({
        name: 'JavaScript',
        description: 'Another JS capability',
        type: CapabilityType.CREATION,
        parameters: {},
        requiredCapabilities: [],
        incompatibleWith: []
      })).rejects.toThrow(/already exists/);
    });
  });
  
  describe('getCapability', () => {
    it('should get a capability definition by ID', async () => {
      // Call method
      const capability = await registry.getCapability(TEST_CAPABILITY_ID);
      
      // Verify result
      expect(capability).not.toBeNull();
      expect(capability?.id).toBe(TEST_CAPABILITY_ID);
      expect(capability?.name).toBe('JavaScript Coding');
      
      // Verify memory service was called
      expect(mockSearchMemories).toHaveBeenCalledWith(expect.objectContaining({
        type: 'capability_definition',
        filter: {
          'metadata.id': TEST_CAPABILITY_ID
        }
      }));
    });
    
    it('should return null if capability not found', async () => {
      // Mock not finding the capability
      mockSearchMemories.mockResolvedValueOnce([]);
      
      // Call method
      const capability = await registry.getCapability('non-existent');
      
      // Verify result
      expect(capability).toBeNull();
    });
  });
  
  describe('getAllCapabilities', () => {
    it('should get all registered capability definitions', async () => {
      // Mock finding multiple capabilities
      mockSearchMemories.mockImplementationOnce(() => Promise.resolve([
        {
          id: 'cap-def-1',
          payload: {
            text: 'JavaScript Coding',
            metadata: {
              id: 'coding.javascript',
              name: 'JavaScript Coding',
              type: CapabilityType.CREATION,
              description: 'JS coding',
              parameters: {},
              requiredCapabilities: [],
              incompatibleWith: []
            }
          }
        },
        {
          id: 'cap-def-2',
          payload: {
            text: 'Python Coding',
            metadata: {
              id: 'coding.python',
              name: 'Python Coding',
              type: CapabilityType.CREATION,
              description: 'Python coding',
              parameters: {},
              requiredCapabilities: [],
              incompatibleWith: []
            }
          }
        }
      ]));
      
      // Call method
      const capabilities = await registry.getAllCapabilities();
      
      // Verify result
      expect(capabilities).toHaveLength(2);
      expect(capabilities[0].id).toBe('coding.javascript');
      expect(capabilities[1].id).toBe('coding.python');
      
      // Verify memory service was called
      expect(mockSearchMemories).toHaveBeenCalledWith(expect.objectContaining({
        type: 'capability_definition',
        filter: {
          'metadata.definitionType': 'capability'
        }
      }));
    });
    
    it('should return empty array if no capabilities defined', async () => {
      // Mock not finding any capabilities
      mockSearchMemories.mockResolvedValueOnce([]);
      
      // Call method
      const capabilities = await registry.getAllCapabilities();
      
      // Verify result
      expect(capabilities).toEqual([]);
    });
  });

  // Test for capabilities metrics integration
  describe('capability metrics integration', () => {
    // Mock the metrics service methods
    beforeEach(() => {
      // Mock the getAgentCapabilities method to return a capability
      mockMemoryService.searchMemories = vi.fn().mockImplementation((params) => {
        if (params.type === 'agent_capability') {
          return Promise.resolve([
            {
              id: TEST_CAPABILITY_ID,
              payload: {
                metadata: {
                  capability: {
                    capabilityId: TEST_CAPABILITY_ID,
                    level: CapabilityLevel.INTERMEDIATE,
                    enabled: true
                  }
                }
              }
            }
          ]);
        }
        return Promise.resolve([]);
      });
    });

    describe('recordCapabilityUsage', () => {
      it('should record capability usage', async () => {
        // Call the method
        await registry.recordCapabilityUsage(
          'test-agent',
          TEST_CAPABILITY_ID,
          true,
          100,
          {
            latency: 50,
            confidenceScore: 0.9
          }
        );

        // Verify that searchMemories was called
        expect(mockMemoryService.searchMemories).toHaveBeenCalled();
        expect(mockMemoryService.addMemory).toHaveBeenCalled();
      });

      it('should not record usage for unregistered capability', async () => {
        // Mock to return no capabilities
        mockMemoryService.searchMemories = vi.fn().mockResolvedValue([]);

        // Call the method
        await registry.recordCapabilityUsage(
          'test-agent',
          'non-existent-capability',
          true,
          100
        );

        // Verify searchMemories was called but addMemory was not
        expect(mockMemoryService.searchMemories).toHaveBeenCalled();
        expect(mockMemoryService.addMemory).not.toHaveBeenCalled();
      });
    });

    describe('getCapabilityMetrics', () => {
      it('should return metrics for a capability', async () => {
        // Set up the mock to return metrics
        const sampleMetrics = {
          capabilityId: TEST_CAPABILITY_ID,
          agentId: 'test-agent',
          usageCount: 10,
          successRate: 0.8,
          averageDuration: 150,
          averageLatency: 70,
          averageConfidence: 0.85,
          lastUsed: Date.now(),
          trending: {
            usageFrequency: 'increasing',
            performanceDirection: 'improving'
          },
          historicalData: {
            timeframe: 'day',
            successRates: [0.7, 0.8, 0.9],
            latencies: [80, 75, 70]
          }
        };

        mockMemoryService.searchMemories = vi.fn().mockImplementation((params) => {
          if (params.type === 'capability_metrics') {
            return Promise.resolve([
              {
                id: 'metrics-id',
                payload: {
                  metadata: sampleMetrics
                }
              }
            ]);
          }
          return Promise.resolve([]);
        });

        // Call the method
        const metrics = await registry.getCapabilityMetrics('test-agent', TEST_CAPABILITY_ID);

        // Verify the result
        expect(metrics).toBeDefined();
        expect(metrics?.capabilityId).toBe(TEST_CAPABILITY_ID);
        expect(metrics?.agentId).toBe('test-agent');
        expect(metrics?.usageCount).toBe(10);
      });
    });

    describe('findBestProviders', () => {
      it('should return best providers based on metrics', async () => {
        // Set up the mock to return metrics for multiple agents
        mockMemoryService.searchMemories = vi.fn().mockImplementation((params) => {
          if (params.type === 'capability_metrics') {
            return Promise.resolve([
              {
                id: 'metrics-1',
                payload: {
                  metadata: {
                    capabilityId: TEST_CAPABILITY_ID,
                    agentId: 'agent-1',
                    usageCount: 20,
                    successRate: 0.9,
                    averageLatency: 50
                  }
                }
              },
              {
                id: 'metrics-2',
                payload: {
                  metadata: {
                    capabilityId: TEST_CAPABILITY_ID,
                    agentId: 'agent-2',
                    usageCount: 15,
                    successRate: 0.95,
                    averageLatency: 60
                  }
                }
              },
              {
                id: 'metrics-3',
                payload: {
                  metadata: {
                    capabilityId: TEST_CAPABILITY_ID,
                    agentId: 'agent-3',
                    usageCount: 10,
                    successRate: 0.85,
                    averageLatency: 40
                  }
                }
              }
            ]);
          }
          return Promise.resolve([]);
        });

        // Call the method
        const bestProviders = await registry.findBestProviders(TEST_CAPABILITY_ID, 2);

        // Verify the result
        expect(bestProviders).toHaveLength(2);
        expect(bestProviders).toContain('agent-2'); // Highest success rate
        expect(bestProviders[0]).toBe('agent-2'); // Should be first
      });

      it('should fall back to regular findProviders if no metrics exist', async () => {
        // Set up the mock to return no metrics
        mockMemoryService.searchMemories = vi.fn().mockImplementation((params) => {
          if (params.type === 'capability_metrics') {
            return Promise.resolve([]);
          }
          if (params.type === 'agent_capability') {
            return Promise.resolve([
              {
                id: 'cap-1',
                payload: {
                  metadata: {
                    agentId: 'agent-1',
                    capability: {
                      capabilityId: TEST_CAPABILITY_ID,
                      level: CapabilityLevel.ADVANCED,
                      enabled: true
                    }
                  }
                }
              }
            ]);
          }
          return Promise.resolve([]);
        });

        // Call the method
        const providers = await registry.findBestProviders(TEST_CAPABILITY_ID);

        // Verify the result
        expect(providers).toHaveLength(1);
        expect(providers[0]).toBe('agent-1');
      });
    });

    describe('updateCapabilityLevels', () => {
      it('should update capability levels based on performance', async () => {
        // Set up the mock for capability metrics
        const metricsResponse = {
          capabilityId: TEST_CAPABILITY_ID,
          agentId: 'test-agent',
          usageCount: 20,
          successRate: 0.96, // High enough for EXPERT level
          averageDuration: 100,
          averageLatency: 50,
          averageConfidence: 0.9,
          lastUsed: Date.now()
        };

        mockMemoryService.searchMemories = vi.fn().mockImplementation((params) => {
          if (params.type === 'agent_capability') {
            return Promise.resolve([
              {
                id: 'cap-1',
                payload: {
                  metadata: {
                    capability: {
                      capabilityId: TEST_CAPABILITY_ID,
                      level: CapabilityLevel.ADVANCED,
                      enabled: true
                    }
                  }
                }
              }
            ]);
          }
          if (params.type === 'capability_metrics') {
            return Promise.resolve([
              {
                id: 'metrics-id',
                payload: {
                  metadata: metricsResponse
                }
              }
            ]);
          }
          return Promise.resolve([]);
        });

        // Call the method
        const result = await registry.updateCapabilityLevels('test-agent');

        // Verify the result
        expect(result).toBeDefined();
        expect(result.updated).toBe(1);
        expect(result.unchanged).toBe(0);

        // Verify updateMemory was called
        expect(mockMemoryService.updateMemory).toHaveBeenCalled();
      });

      it('should handle case when no capabilities need updates', async () => {
        // Set up the mock for capability metrics with low sample size
        const metricsResponse = {
          capabilityId: TEST_CAPABILITY_ID,
          agentId: 'test-agent',
          usageCount: 5, // Too few samples to trigger level change
          successRate: 0.96,
          averageDuration: 100,
          averageLatency: 50,
          averageConfidence: 0.9,
          lastUsed: Date.now()
        };

        mockMemoryService.searchMemories = vi.fn().mockImplementation((params) => {
          if (params.type === 'agent_capability') {
            return Promise.resolve([
              {
                id: 'cap-1',
                payload: {
                  metadata: {
                    capability: {
                      capabilityId: TEST_CAPABILITY_ID,
                      level: CapabilityLevel.INTERMEDIATE,
                      enabled: true
                    }
                  }
                }
              }
            ]);
          }
          if (params.type === 'capability_metrics') {
            return Promise.resolve([
              {
                id: 'metrics-id',
                payload: {
                  metadata: metricsResponse
                }
              }
            ]);
          }
          return Promise.resolve([]);
        });

        // Call the method
        const result = await registry.updateCapabilityLevels('test-agent');

        // Verify the result
        expect(result).toBeDefined();
        expect(result.updated).toBe(0);
        expect(result.unchanged).toBe(1);
      });
    });
  });
}); 