/**
 * Conversation Visualization Service Tests
 * 
 * Test suite for the conversation visualization service using Vitest
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConversationVisualizationService } from '../visualization-service';
import { VisualizationNodeType, VisualizationEdgeType } from '../visualization-interface';

// Mock dependencies
vi.mock('uuid', () => ({
  v4: () => 'mock-uuid'
}));

// Create mock memory service
const mockMemoryService = {
  addMemory: vi.fn().mockResolvedValue({ id: 'mem-1' }),
  searchMemories: vi.fn().mockImplementation((params) => {
    if (params.type === 'agent') {
      const agent = mockAgents.find(a => a.id === params.filter.id);
      return Promise.resolve(agent ? [{ payload: agent }] : []);
    } else if (params.type === 'conversation') {
      return Promise.resolve([{ payload: mockConversation }]);
    }
    return Promise.resolve([]);
  })
};

// Create mock conversation manager
const mockConversationManager = {
  getConversation: vi.fn().mockResolvedValue(null),
  getMessagesForParticipant: vi.fn().mockResolvedValue([])
};

// Create mock capability registry
const mockCapabilityRegistry = {
  findProviders: vi.fn().mockResolvedValue([]),
  getCapabilityMetrics: vi.fn().mockResolvedValue(null)
};

// Mock the MessagingFactory
vi.mock('../../factory', () => ({
  MessagingFactory: {
    getConversationManager: vi.fn().mockResolvedValue(null),
    getCapabilityRegistry: vi.fn().mockResolvedValue(null)
  }
}));

// Import MessagingFactory after mocking
import { MessagingFactory } from '../../factory';

// Mock data for tests
const mockConversation = {
  id: 'conv-1',
  name: 'Test Conversation',
  description: 'A test conversation',
  state: 'active',
  participants: [
    {
      id: 'agent-1',
      name: 'Agent One',
      type: 'agent',
      role: 'moderator',
      joinedAt: 1000,
      lastActiveAt: 2000
    },
    {
      id: 'agent-2',
      name: 'Agent Two',
      type: 'agent',
      role: 'member',
      joinedAt: 1100,
      lastActiveAt: 2100
    },
    {
      id: 'user-1',
      name: 'User One',
      type: 'user',
      role: 'member',
      joinedAt: 1200,
      lastActiveAt: 2200
    }
  ],
  createdAt: 900,
  updatedAt: 2300,
  flowControl: 'free_form'
};

const mockMessages = [
  {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'user-1',
    content: 'Hello agents',
    timestamp: 1500,
    format: 'text',
    isVisibleToAll: true
  },
  {
    id: 'msg-2',
    conversationId: 'conv-1',
    senderId: 'agent-1',
    content: 'Hello user',
    timestamp: 1600,
    format: 'text',
    isVisibleToAll: true
  },
  {
    id: 'msg-3',
    conversationId: 'conv-1',
    senderId: 'agent-2',
    content: 'I have data to share',
    timestamp: 1700,
    format: 'text',
    isVisibleToAll: true
  }
];

const mockAgents = [
  {
    id: 'agent-1',
    name: 'Agent One',
    capabilities: ['reasoning', 'math']
  },
  {
    id: 'agent-2',
    name: 'Agent Two',
    capabilities: ['data_analysis', 'translation']
  }
];

const mockCapabilityMetrics = {
  capabilityId: 'data_analysis',
  agentId: 'agent-2',
  usageCount: 25,
  successRate: 0.92,
  averageLatency: 350,
  lastUsed: 2000,
  averageDuration: 450,
  averageConfidence: 0.85,
  trending: {
    usageFrequency: 'increasing',
    performanceDirection: 'stable'
  },
  historicalData: {
    timeframe: 'week',
    successRates: [0.9, 0.91, 0.92],
    latencies: [360, 355, 350]
  }
};

describe('ConversationVisualizationService', () => {
  // Initialize visualization service
  let visualizationService: ConversationVisualizationService;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Update mock values
    mockConversationManager.getConversation.mockResolvedValue(mockConversation);
    mockConversationManager.getMessagesForParticipant.mockResolvedValue(mockMessages);
    mockCapabilityRegistry.findProviders.mockResolvedValue(['agent-2']);
    mockCapabilityRegistry.getCapabilityMetrics.mockResolvedValue(mockCapabilityMetrics);
    
    // Setup factory mocks
    (MessagingFactory.getConversationManager as any).mockResolvedValue(mockConversationManager);
    (MessagingFactory.getCapabilityRegistry as any).mockResolvedValue(mockCapabilityRegistry);
    
    // Create service instance
    visualizationService = new ConversationVisualizationService(mockMemoryService as any);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('visualizeConversation', () => {
    test('should create a graph representation of a conversation', async () => {
      // Call the method
      const graph = await visualizationService.visualizeConversation('conv-1');
      
      // Verify conversation was retrieved
      expect(mockConversationManager.getConversation).toHaveBeenCalledWith('conv-1');
      
      // Verify messages were retrieved
      expect(mockConversationManager.getMessagesForParticipant).toHaveBeenCalledWith('conv-1', '', expect.anything());
      
      // Verify graph structure
      expect(graph).toHaveProperty('nodes');
      expect(graph).toHaveProperty('edges');
      expect(graph).toHaveProperty('metadata');
      
      // Should have nodes for all participants and messages
      expect(graph.nodes.length).toBe(mockConversation.participants.length + mockMessages.length);
      
      // Should have edges for message sending
      expect(graph.edges.length).toBeGreaterThanOrEqual(mockMessages.length);
      
      // Check participant nodes
      const agentNodes = graph.nodes.filter(n => n.type === VisualizationNodeType.AGENT);
      const userNodes = graph.nodes.filter(n => n.type === VisualizationNodeType.USER);
      expect(agentNodes.length).toBe(2); // Two agent participants
      expect(userNodes.length).toBe(1); // One user participant
      
      // Check message nodes
      const messageNodes = graph.nodes.filter(n => n.type === VisualizationNodeType.MESSAGE);
      expect(messageNodes.length).toBe(mockMessages.length);
      
      // Check metadata
      expect(graph.metadata.title).toContain(mockConversation.name);
      expect(graph.metadata.participantCount).toBe(mockConversation.participants.length);
      expect(graph.metadata.messageCount).toBe(mockMessages.length);
    });

    test('should apply filter options', async () => {
      // Filter to only show messages from user-1
      const filterOptions = {
        participants: ['user-1']
      };
      
      // Mock messages for this test
      mockConversationManager.getMessagesForParticipant.mockResolvedValue([
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          senderId: 'user-1',
          content: 'Hello agents',
          timestamp: 1500,
          format: 'text',
          isVisibleToAll: true
        }
      ]);
      
      const graph = await visualizationService.visualizeConversation('conv-1', filterOptions);
      
      // Should still include all participant nodes
      expect(graph.nodes.filter(n => n.type === VisualizationNodeType.AGENT).length).toBe(2);
      expect(graph.nodes.filter(n => n.type === VisualizationNodeType.USER).length).toBe(1);
      
      // But only the message node for user-1
      const messageNodes = graph.nodes.filter(n => n.type === VisualizationNodeType.MESSAGE);
      expect(messageNodes.length).toBe(1);
    });
  });

  describe('visualizeCapabilityUsage', () => {
    test('should create a graph showing agents with a capability', async () => {
      // Call the method
      const graph = await visualizationService.visualizeCapabilityUsage('data_analysis');
      
      // Verify capability providers were retrieved
      expect(mockCapabilityRegistry.findProviders).toHaveBeenCalledWith('data_analysis');
      
      // Verify metrics were retrieved
      expect(mockCapabilityRegistry.getCapabilityMetrics).toHaveBeenCalledWith('agent-2', 'data_analysis');
      
      // Verify graph structure
      expect(graph.nodes.length).toBe(2); // One capability node + one agent node
      expect(graph.edges.length).toBe(1); // One edge connecting agent to capability
      
      // Check node types
      const capabilityNodes = graph.nodes.filter(n => n.type === VisualizationNodeType.CAPABILITY);
      const agentNodes = graph.nodes.filter(n => n.type === VisualizationNodeType.AGENT);
      expect(capabilityNodes.length).toBe(1);
      expect(agentNodes.length).toBe(1);
      
      // Check capability node
      expect(capabilityNodes[0].id).toBe('data_analysis');
      
      // Check agent node
      expect(agentNodes[0].id).toBe('agent-2');
      
      // Check edge
      const edge = graph.edges[0];
      expect(edge.source).toBe('agent-2');
      expect(edge.target).toBe('data_analysis');
      expect(edge.type).toBe(VisualizationEdgeType.PROVIDED);
      expect(edge.weight).toBe(25); // from mockCapabilityMetrics.usageCount
    });
  });

  describe('visualizeAgentInteractions', () => {
    test('should create a graph of agent interactions', async () => {
      // Add an additional message to create interactions
      const interactionMessages = [...mockMessages, {
        id: 'msg-4',
        conversationId: 'conv-1',
        senderId: 'agent-1',
        content: 'Let me help with that',
        timestamp: 1800,
        format: 'text',
        isVisibleToAll: true
      }];
      
      mockConversationManager.getMessagesForParticipant.mockResolvedValue(interactionMessages);
      
      // Call the method
      const graph = await visualizationService.visualizeAgentInteractions(['agent-1', 'agent-2']);
      
      // Verify graph structure
      expect(graph.nodes.length).toBe(2); // Two agent nodes
      
      // Verify nodes represent the agents
      const agentIds = graph.nodes.map(n => n.id);
      expect(agentIds).toContain('agent-1');
      expect(agentIds).toContain('agent-2');
    });
  });

  describe('exportVisualization', () => {
    test('should export a graph as JSON', async () => {
      // Create a simple test graph
      const testGraph = {
        nodes: [{ id: 'node-1', type: VisualizationNodeType.AGENT, label: 'Test Node', properties: {}, timestamp: 1000 }],
        edges: [],
        metadata: {
          title: 'Test Graph',
          timeRange: { start: 1000, end: 2000 },
          participantCount: 1,
          messageCount: 0
        }
      };
      
      // Export as JSON
      const result = await visualizationService.exportVisualization(testGraph, 'json');
      
      // Verify result is valid JSON
      expect(typeof result).toBe('string');
      const parsed = JSON.parse(result as string);
      expect(parsed).toEqual(testGraph);
    });

    test('should export a graph as GraphML', async () => {
      // Create a simple test graph
      const testGraph = {
        nodes: [{ id: 'node-1', type: VisualizationNodeType.AGENT, label: 'Test Node', properties: {}, timestamp: 1000 }],
        edges: [],
        metadata: {
          title: 'Test Graph',
          timeRange: { start: 1000, end: 2000 },
          participantCount: 1,
          messageCount: 0
        }
      };
      
      // Export as GraphML
      const result = await visualizationService.exportVisualization(testGraph, 'graphml');
      
      // Verify result is a string containing GraphML
      expect(typeof result).toBe('string');
      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result).toContain('<graphml');
      expect(result).toContain('<node id="node-1">');
    });
  });

  describe('visualizeConversationTimeline', () => {
    test('should generate a timeline of conversation activity', async () => {
      // Call the method with hourly granularity
      const timeline = await visualizationService.visualizeConversationTimeline('conv-1', 'hour');
      
      // Verify conversation and messages were retrieved
      expect(mockConversationManager.getConversation).toHaveBeenCalledWith('conv-1');
      expect(mockConversationManager.getMessagesForParticipant).toHaveBeenCalledWith('conv-1', '', expect.anything());
      
      // Verify timeline structure
      expect(Array.isArray(timeline)).toBe(true);
      
      // Verify timeline data points
      timeline.forEach(point => {
        expect(point).toHaveProperty('time');
        expect(point).toHaveProperty('messageCount');
        expect(point).toHaveProperty('activeAgents');
        expect(typeof point.time).toBe('number');
        expect(typeof point.messageCount).toBe('number');
        expect(typeof point.activeAgents).toBe('number');
      });
    });
  });
}); 