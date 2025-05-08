/**
 * Conversation Analytics Service Tests
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ConversationAnalyticsService } from '../analytics-service';
import { MessageAnalyticsUpdate } from '../types';
import { AnyMemoryService } from '../../../../../services/memory/memory-service-wrappers';

// Mock memory service with proper typing
const mockAddMemory = vi.fn().mockResolvedValue({ success: true, id: 'test-id' });
const mockSearchMemories = vi.fn();
const mockUpdateMemory = vi.fn().mockResolvedValue({ success: true });
const mockDeleteMemory = vi.fn().mockResolvedValue({ success: true });

const mockMemoryService = {
  addMemory: mockAddMemory,
  searchMemories: mockSearchMemories,
  updateMemory: mockUpdateMemory,
  deleteMemory: mockDeleteMemory
} as unknown as AnyMemoryService;

// Sample conversation ID for testing
const CONVERSATION_ID = 'conversation_123456';

describe('ConversationAnalyticsService', () => {
  let analyticsService: ConversationAnalyticsService;
  
  beforeEach(() => {
    // Reset mock function calls
    vi.resetAllMocks();
    
    // Create new service instance
    analyticsService = new ConversationAnalyticsService(mockMemoryService);
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('trackMessage', () => {
    it('should create new analytics when none exist', async () => {
      // Mock searchMemories to simulate no existing analytics
      mockSearchMemories.mockResolvedValue([]);
      
      // Create a message update
      const update: MessageAnalyticsUpdate = {
        conversationId: CONVERSATION_ID,
        messageId: 'msg1',
        senderId: 'agent1',
        senderType: 'agent',
        messageType: 'text',
        timestamp: Date.now(),
        messageLength: 100
      };
      
      // Call the service
      await analyticsService.trackMessage(update);
      
      // Verify memory service calls
      expect(mockSearchMemories).toHaveBeenCalledTimes(2); // Once to check for existing analytics, once for something else
      expect(mockAddMemory).toHaveBeenCalledTimes(1);
      expect(mockAddMemory).toHaveBeenCalledWith(expect.objectContaining({
        type: 'conversation_analytics',
        metadata: expect.objectContaining({
          conversationId: CONVERSATION_ID,
          messageCount: 1
        })
      }));
    });
    
    it('should update existing analytics', async () => {
      // Create existing analytics
      const existingAnalytics = {
        conversationId: CONVERSATION_ID,
        startTime: Date.now() - 60000, // 1 minute ago
        duration: 0,
        participantCount: 1,
        humanParticipants: 0,
        agentParticipants: 1,
        participantMap: {
          'agent1': {
            participantId: 'agent1',
            participantType: 'agent',
            messageCount: 1,
            averageMessageLength: 50,
            averageResponseTime: 0,
            initiatedInteractions: 0,
            receivedInteractions: 0,
            uniqueInteractionPartners: 0,
            topInteractionPartners: []
          }
        },
        messageCount: 1,
        messagesByParticipant: { 'agent1': 1 },
        messagesByType: { 'text': 1 },
        averageMessageLength: 50,
        averageResponseTime: 0,
        responseTimeByParticipant: {},
        interactionMatrix: {},
        interactionGraph: [],
        activityDistribution: {},
        capabilitiesUsed: [],
        capabilityUsageCount: {},
        updatedAt: Date.now() - 60000
      };
      
      // Mock searchMemories to return existing analytics
      mockSearchMemories.mockResolvedValue([
        {
          id: 'analytics1',
          payload: {
            metadata: existingAnalytics
          }
        }
      ]);
      
      // Create a message update from a new participant
      const update: MessageAnalyticsUpdate = {
        conversationId: CONVERSATION_ID,
        messageId: 'msg2',
        senderId: 'agent2',
        senderType: 'agent',
        recipientId: 'agent1',
        recipientType: 'agent',
        messageType: 'text',
        timestamp: Date.now(),
        messageLength: 150,
        responseToMessageId: 'msg1',
        responseTimeMs: 2000
      };
      
      // Call the service
      await analyticsService.trackMessage(update);
      
      // Verify memory service calls
      expect(mockSearchMemories).toHaveBeenCalledTimes(2); // Once to check for existing analytics, once for something else
      expect(mockUpdateMemory).toHaveBeenCalledTimes(1);
      expect(mockUpdateMemory).toHaveBeenCalledWith(expect.objectContaining({
        type: 'conversation_analytics',
        id: 'analytics1',
        metadata: expect.objectContaining({
          conversationId: CONVERSATION_ID,
          messageCount: 2,
          participantCount: 2,
          agentParticipants: 2
        })
      }));
    });
  });
  
  describe('getConversationAnalytics', () => {
    it('should return null when no analytics exist', async () => {
      // Mock searchMemories to return empty results
      mockSearchMemories.mockResolvedValue([]);
      
      // Call the service
      const result = await analyticsService.getConversationAnalytics(CONVERSATION_ID);
      
      // Verify result and service calls
      expect(result).toBeNull();
      expect(mockSearchMemories).toHaveBeenCalledTimes(1);
    });
    
    it('should return analytics when they exist', async () => {
      // Create sample analytics
      const sampleAnalytics = {
        conversationId: CONVERSATION_ID,
        messageCount: 10,
        participantCount: 3
      };
      
      // Mock searchMemories to return sample analytics
      mockSearchMemories.mockResolvedValue([
        {
          id: 'analytics1',
          payload: {
            metadata: sampleAnalytics
          }
        }
      ]);
      
      // Call the service
      const result = await analyticsService.getConversationAnalytics(CONVERSATION_ID);
      
      // Verify result and service calls
      expect(result).not.toBeNull();
      expect(result?.conversationId).toBe(CONVERSATION_ID);
      expect(result?.messageCount).toBe(10);
      expect(result?.participantCount).toBe(3);
      expect(mockSearchMemories).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('getMultipleConversationAnalytics', () => {
    it('should return empty array when no analytics exist', async () => {
      // Mock searchMemories to return empty results
      mockSearchMemories.mockResolvedValue([]);
      
      // Call the service
      const results = await analyticsService.getMultipleConversationAnalytics();
      
      // Verify result and service calls
      expect(results).toEqual([]);
      expect(mockSearchMemories).toHaveBeenCalledTimes(1);
    });
    
    it('should return multiple analytics when they exist', async () => {
      // Create sample analytics
      const analytics1 = {
        conversationId: 'conv1',
        messageCount: 10,
        participantCount: 3
      };
      
      const analytics2 = {
        conversationId: 'conv2',
        messageCount: 5,
        participantCount: 2
      };
      
      // Mock searchMemories to return sample analytics
      mockSearchMemories.mockResolvedValue([
        {
          id: 'analytics1',
          payload: {
            metadata: analytics1
          }
        },
        {
          id: 'analytics2',
          payload: {
            metadata: analytics2
          }
        }
      ]);
      
      // Call the service
      const results = await analyticsService.getMultipleConversationAnalytics();
      
      // Verify result and service calls
      expect(results).toHaveLength(2);
      expect(results[0].conversationId).toBe('conv1');
      expect(results[1].conversationId).toBe('conv2');
      expect(mockSearchMemories).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('resetConversationAnalytics', () => {
    it('should delete analytics and insights', async () => {
      // Mock searchMemories to return analytics and insights
      mockSearchMemories.mockResolvedValueOnce([
        {
          id: 'analytics1',
          payload: {
            metadata: { conversationId: CONVERSATION_ID }
          }
        }
      ]).mockResolvedValueOnce([
        {
          id: 'insights1',
          payload: {
            metadata: { conversationId: CONVERSATION_ID }
          }
        }
      ]);
      
      // Call the service
      await analyticsService.resetConversationAnalytics(CONVERSATION_ID);
      
      // Verify service calls
      expect(mockSearchMemories).toHaveBeenCalledTimes(2);
      expect(mockDeleteMemory).toHaveBeenCalledTimes(2);
      expect(mockDeleteMemory).toHaveBeenCalledWith({ 
        id: 'analytics1', 
        type: 'conversation_analytics' 
      });
      expect(mockDeleteMemory).toHaveBeenCalledWith({ 
        id: 'insights1', 
        type: 'conversation_insights' 
      });
    });
  });
}); 