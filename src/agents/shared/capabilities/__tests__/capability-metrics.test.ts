/**
 * Capability Metrics Service Tests
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CapabilityMetricsService, ICapabilityMetricsService, CapabilityUsageRecord, CapabilityPerformanceMetrics } from '../capability-metrics';
import { AnyMemoryService } from '../../../../server/memory/services/memory/memory-service-wrappers';
import { AgentCapability, CapabilityLevel } from '../types';

// Mock memory service with proper typing
const mockAddMemory = vi.fn().mockResolvedValue({ success: true, id: 'test-id' });
const mockSearchMemories = vi.fn();
const mockUpdateMemory = vi.fn().mockResolvedValue({ success: true });

const mockMemoryService = {
  addMemory: mockAddMemory,
  searchMemories: mockSearchMemories,
  updateMemory: mockUpdateMemory
} as unknown as AnyMemoryService;

// Test helper function to create sample filter params
type FilterParams = Record<string, any>;
function expectFilterToContain(actualFilter: FilterParams, expectedValues: FilterParams): void {
  Object.entries(expectedValues).forEach(([key, value]) => {
    expect(actualFilter[key]).toEqual(value);
  });
}

// Mock memory point for search results
const createMockMemoryPoint = (metadata: any) => ({
  id: 'test-id',
  vector: [],
  payload: {
    id: 'test-id',
    text: 'test-content',
    type: 'capability_metrics',
    timestamp: Date.now().toString(),
    metadata
  }
});

// Sample capabilities data
const sampleAgentId = 'agent_123456';
const sampleCapabilityId = 'coding_javascript';

// Sample usage record
const sampleUsageRecord: CapabilityUsageRecord = {
  id: 'usage_123456',
  agentId: sampleAgentId,
  capabilityId: sampleCapabilityId,
  timestamp: Date.now(),
  duration: 1200, // 1.2 seconds
  success: true,
  context: {
    requestId: 'req_123456',
    chatId: 'chat_123456'
  },
  performanceMetrics: {
    latency: 800, // 800ms
    tokenCount: 150,
    confidenceScore: 0.85
  }
};

// Sample performance metrics
const samplePerformanceMetrics: CapabilityPerformanceMetrics = {
  capabilityId: sampleCapabilityId,
  agentId: sampleAgentId,
  usageCount: 5,
  successRate: 0.8, // 80% success
  averageDuration: 1500, // 1.5 seconds
  averageLatency: 900, // 900ms
  averageConfidence: 0.75,
  lastUsed: Date.now() - 3600000, // 1 hour ago
  trending: {
    usageFrequency: 'increasing',
    performanceDirection: 'improving'
  },
  historicalData: {
    timeframe: 'day',
    successRates: [0.7, 0.8, 0.8, 0.9, 0.8],
    latencies: [1000, 950, 900, 850, 900]
  }
};

// Sample agent capability
const sampleAgentCapability: AgentCapability = {
  capabilityId: sampleCapabilityId,
  level: CapabilityLevel.INTERMEDIATE,
  enabled: true,
  proficiency: 0.75
};

describe('CapabilityMetricsService', () => {
  let metricsService: ICapabilityMetricsService;
  
  beforeEach(() => {
    // Reset mock function calls
    vi.resetAllMocks();
    
    // Create new service instance
    metricsService = new CapabilityMetricsService(mockMemoryService);
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('recordCapabilityUsage', () => {
    it('should record a capability usage event', async () => {
      // Mock searchMemories to simulate no existing metrics
      mockSearchMemories.mockResolvedValue([]);
      
      // Call the service
      const result = await metricsService.recordCapabilityUsage(
        sampleAgentId,
        sampleCapabilityId,
        {
          duration: 1200,
          success: true,
          latency: 800,
          tokenCount: 150,
          confidenceScore: 0.85
        }
      );
      
      // Verify the result
      expect(result).toBeDefined();
      expect(result.agentId).toBe(sampleAgentId);
      expect(result.capabilityId).toBe(sampleCapabilityId);
      expect(result.success).toBe(true);
      expect(result.duration).toBe(1200);
      expect(result.performanceMetrics.latency).toBe(800);
      
      // Verify memory service calls
      expect(mockAddMemory).toHaveBeenCalledTimes(2);
      
      // Verify first call for usage record
      expect(mockAddMemory).toHaveBeenCalledWith(expect.objectContaining({
        type: 'capability_usage',
        content: expect.stringContaining(sampleAgentId),
        metadata: expect.objectContaining({
          capabilityId: sampleCapabilityId,
          success: true
        })
      }));
      
      // Verify metrics was queried
      expect(mockSearchMemories).toHaveBeenCalledWith(expect.objectContaining({
        type: 'capability_metrics',
        filter: {
          'metadata.agentId': sampleAgentId,
          'metadata.capabilityId': sampleCapabilityId
        }
      }));
    });
    
    it('should update existing metrics when recording a new usage', async () => {
      // Mock searchMemories to simulate existing metrics
      mockSearchMemories.mockResolvedValue([
        createMockMemoryPoint(samplePerformanceMetrics)
      ]);
      
      // Call the service
      await metricsService.recordCapabilityUsage(
        sampleAgentId,
        sampleCapabilityId,
        {
          duration: 1000,
          success: true,
          latency: 750,
          confidenceScore: 0.9
        }
      );
      
      // Verify memory service calls
      expect(mockAddMemory).toHaveBeenCalledTimes(1); // Only for usage record
      expect(mockUpdateMemory).toHaveBeenCalledTimes(1); // For metrics update
      
      // Verify update includes increased usage count and last used timestamp
      expect(mockUpdateMemory).toHaveBeenCalledWith(expect.objectContaining({
        type: 'capability_metrics',
        id: 'test-id',
        metadata: expect.objectContaining({
          usageCount: expect.any(Number),
          lastUsed: expect.any(Number)
        })
      }));
    });
  });
  
  describe('getCapabilityPerformance', () => {
    it('should return performance metrics for a capability', async () => {
      // Mock searchMemories to return metrics
      mockSearchMemories.mockResolvedValue([
        createMockMemoryPoint(samplePerformanceMetrics)
      ]);
      
      // Call the service
      const result = await metricsService.getCapabilityPerformance(
        sampleAgentId,
        sampleCapabilityId
      );
      
      // Verify the result
      expect(result).toEqual(samplePerformanceMetrics);
      
      // Verify memory service calls
      expect(mockSearchMemories).toHaveBeenCalledTimes(1);
      expect(mockSearchMemories).toHaveBeenCalledWith(expect.objectContaining({
        type: 'capability_metrics',
        filter: {
          'metadata.agentId': sampleAgentId,
          'metadata.capabilityId': sampleCapabilityId
        }
      }));
    });
    
    it('should return null if no metrics are found', async () => {
      // Mock searchMemories to return empty array
      mockSearchMemories.mockResolvedValue([]);
      
      // Call the service
      const result = await metricsService.getCapabilityPerformance(
        sampleAgentId,
        sampleCapabilityId
      );
      
      // Verify the result
      expect(result).toBeNull();
    });
  });
  
  describe('getAgentCapabilityPerformance', () => {
    it('should return all capability metrics for an agent', async () => {
      // Mock searchMemories to return multiple metrics
      const pythonMetrics = {
        ...samplePerformanceMetrics,
        capabilityId: 'coding_python',
        successRate: 0.9
      };
      
      mockSearchMemories.mockResolvedValue([
        createMockMemoryPoint(samplePerformanceMetrics),
        createMockMemoryPoint(pythonMetrics)
      ]);
      
      // Call the service
      const result = await metricsService.getAgentCapabilityPerformance(sampleAgentId);
      
      // Verify the result
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(samplePerformanceMetrics);
      expect(result[1]).toEqual(pythonMetrics);
      
      // Verify memory service calls
      expect(mockSearchMemories).toHaveBeenCalledTimes(1);
      expect(mockSearchMemories).toHaveBeenCalledWith(expect.objectContaining({
        type: 'capability_metrics',
        filter: {
          'metadata.agentId': sampleAgentId
        }
      }));
    });
    
    it('should return empty array if no metrics are found', async () => {
      // Mock searchMemories to return empty array
      mockSearchMemories.mockResolvedValue([]);
      
      // Call the service
      const result = await metricsService.getAgentCapabilityPerformance(sampleAgentId);
      
      // Verify the result
      expect(result).toEqual([]);
    });
  });
  
  describe('getBestPerformingAgents', () => {
    it('should return sorted list of agents by performance', async () => {
      // Create metrics for different agents
      const agent1Metrics = {
        ...samplePerformanceMetrics,
        agentId: 'agent_1',
        successRate: 0.8,
        averageLatency: 1000
      };
      
      const agent2Metrics = {
        ...samplePerformanceMetrics,
        agentId: 'agent_2',
        successRate: 0.9,
        averageLatency: 800
      };
      
      const agent3Metrics = {
        ...samplePerformanceMetrics,
        agentId: 'agent_3',
        successRate: 0.9,
        averageLatency: 500
      };
      
      mockSearchMemories.mockResolvedValue([
        createMockMemoryPoint(agent1Metrics),
        createMockMemoryPoint(agent2Metrics),
        createMockMemoryPoint(agent3Metrics)
      ]);
      
      // Call the service
      const result = await metricsService.getBestPerformingAgents(sampleCapabilityId, 2);
      
      // Verify the result
      expect(result).toHaveLength(2);
      expect(result[0].agentId).toBe('agent_3'); // Highest success rate and lowest latency
      expect(result[1].agentId).toBe('agent_2'); // Same success rate but higher latency
      
      // Verify memory service calls
      expect(mockSearchMemories).toHaveBeenCalledTimes(1);
      expect(mockSearchMemories).toHaveBeenCalledWith(expect.objectContaining({
        type: 'capability_metrics',
        filter: expect.objectContaining({
          'metadata.capabilityId': sampleCapabilityId
        })
      }));
    });
    
    it('should return empty array if no metrics are found', async () => {
      // Mock searchMemories to return empty array
      mockSearchMemories.mockResolvedValue([]);
      
      // Call the service
      const result = await metricsService.getBestPerformingAgents(sampleCapabilityId);
      
      // Verify the result
      expect(result).toEqual([]);
    });
  });
  
  describe('updateCapabilityLevel', () => {
    it('should update capability level based on performance metrics', async () => {
      // Mock high performance metrics and capability search
      const highPerformanceMetrics = {
        ...samplePerformanceMetrics,
        usageCount: 20,
        successRate: 0.96 // 96% success rate should result in EXPERT level
      };
      
      // First call returns performance metrics, second call returns the agent capability
      mockSearchMemories
        .mockResolvedValueOnce([createMockMemoryPoint(highPerformanceMetrics)])
        .mockResolvedValueOnce([{
          id: 'capability-id',
          payload: {
            metadata: {
              capability: { ...sampleAgentCapability, level: CapabilityLevel.ADVANCED }
            }
          }
        }]);
      
      // Call the service
      const result = await metricsService.updateCapabilityLevel(
        sampleAgentId,
        sampleCapabilityId
      );
      
      // Verify the result
      expect(result).toBeDefined();
      expect(result?.previousLevel).toBe(CapabilityLevel.ADVANCED);
      expect(result?.newLevel).toBe(CapabilityLevel.EXPERT);
      
      // Verify memory service calls
      expect(mockUpdateMemory).toHaveBeenCalledTimes(1);
      expect(mockUpdateMemory).toHaveBeenCalledWith(expect.objectContaining({
        type: 'agent_capability',
        metadata: expect.objectContaining({
          capability: expect.objectContaining({
            level: CapabilityLevel.EXPERT
          })
        })
      }));
    });
    
    it('should not update level if metrics are insufficient', async () => {
      // Mock low usage count metrics
      const lowUsageMetrics = {
        ...samplePerformanceMetrics,
        usageCount: 5, // Not enough samples to change level
        successRate: 0.96
      };
      
      // First call returns performance metrics, second call returns the agent capability
      mockSearchMemories
        .mockResolvedValueOnce([createMockMemoryPoint(lowUsageMetrics)])
        .mockResolvedValueOnce([{
          id: 'capability-id',
          payload: {
            metadata: {
              capability: { ...sampleAgentCapability, level: CapabilityLevel.INTERMEDIATE }
            }
          }
        }]);
      
      // Call the service
      const result = await metricsService.updateCapabilityLevel(
        sampleAgentId,
        sampleCapabilityId
      );
      
      // Verify the result
      expect(result).toBeDefined();
      expect(result?.previousLevel).toBe(CapabilityLevel.INTERMEDIATE);
      expect(result?.newLevel).toBe(CapabilityLevel.INTERMEDIATE); // Unchanged
      
      // Verify updateMemory was not called
      expect(mockUpdateMemory).not.toHaveBeenCalled();
    });
  });
}); 