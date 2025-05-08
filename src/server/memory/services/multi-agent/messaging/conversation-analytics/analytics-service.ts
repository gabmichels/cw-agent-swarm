/**
 * Conversation Analytics Service
 * 
 * This service tracks and analyzes multi-agent conversations,
 * providing metrics and insights on communication patterns.
 */

import { AnyMemoryService } from '../../../../services/memory/memory-service-wrappers';
import { MemoryType } from '../../../../config/types';
import { v4 as uuidv4 } from 'uuid';

import {
  ConversationAnalytics,
  MessageAnalyticsUpdate,
  AnalyticsQueryOptions,
  ConversationInsights,
  Insight,
  ParticipantAnalytics,
  InteractionLink,
  AnalyticsPeriod,
  InsightType
} from './types';
import { IConversationAnalyticsService } from './interfaces';

// Define memory type constants
const CONVERSATION_ANALYTICS_TYPE = 'conversation_analytics' as MemoryType;
const CONVERSATION_INSIGHTS_TYPE = 'conversation_insights' as MemoryType;

/**
 * Implementation of the conversation analytics service
 */
export class ConversationAnalyticsService implements IConversationAnalyticsService {
  constructor(private readonly memoryService: AnyMemoryService) {}
  
  /**
   * Update analytics with new message data
   */
  async trackMessage(update: MessageAnalyticsUpdate): Promise<void> {
    try {
      // Get existing analytics or create new
      let analytics = await this.getConversationAnalytics(update.conversationId);
      
      if (!analytics) {
        // Create new analytics
        analytics = this.createEmptyAnalytics(update.conversationId, update.timestamp);
      }
      
      // Update metrics with new message data
      this.updateMetricsWithMessage(analytics, update);
      
      // Save updated analytics
      await this.saveAnalytics(analytics);
    } catch (error) {
      console.error(`Error tracking message analytics for conversation ${update.conversationId}:`, error);
    }
  }
  
  /**
   * Get analytics for a specific conversation
   */
  async getConversationAnalytics(
    conversationId: string,
    options?: AnalyticsQueryOptions
  ): Promise<ConversationAnalytics | null> {
    try {
      const analyticsRecords = await this.memoryService.searchMemories({
        type: CONVERSATION_ANALYTICS_TYPE,
        filter: {
          'metadata.conversationId': conversationId
        },
        limit: 1
      });
      
      if (analyticsRecords.length === 0) {
        return null;
      }
      
      // Return the analytics
      return analyticsRecords[0].payload.metadata as unknown as ConversationAnalytics;
    } catch (error) {
      console.error(`Error getting conversation analytics for ${conversationId}:`, error);
      return null;
    }
  }
  
  /**
   * Get analytics for multiple conversations
   */
  async getMultipleConversationAnalytics(
    options: AnalyticsQueryOptions = {}
  ): Promise<ConversationAnalytics[]> {
    try {
      // Build filter
      const filter: Record<string, any> = {};
      
      // Add time filters if specified
      if (options.startTime) {
        filter['metadata.startTime'] = { $gte: options.startTime };
      }
      
      if (options.endTime) {
        filter['metadata.endTime'] = { $lte: options.endTime };
      }
      
      // Add message count filter if specified
      if (options.minMessageCount) {
        filter['metadata.messageCount'] = { $gte: options.minMessageCount };
      }
      
      // Query the memory service
      const analyticsRecords = await this.memoryService.searchMemories({
        type: CONVERSATION_ANALYTICS_TYPE,
        filter,
        limit: 100
      });
      
      // Convert to ConversationAnalytics objects
      return analyticsRecords.map(record => 
        record.payload.metadata as unknown as ConversationAnalytics
      );
    } catch (error) {
      console.error('Error getting multiple conversation analytics:', error);
      return [];
    }
  }
  
  /**
   * Get insights for a conversation
   */
  async getConversationInsights(
    conversationId: string
  ): Promise<ConversationInsights | null> {
    try {
      const insightsRecords = await this.memoryService.searchMemories({
        type: CONVERSATION_INSIGHTS_TYPE,
        filter: {
          'metadata.conversationId': conversationId
        },
        limit: 1
      });
      
      if (insightsRecords.length === 0) {
        // No insights found, generate them now
        const insights = await this.generateInsights(conversationId);
        
        if (insights.length === 0) {
          return null;
        }
        
        // Create and save insights
        const conversationInsights: ConversationInsights = {
          conversationId,
          insights,
          generatedAt: Date.now()
        };
        
        await this.saveInsights(conversationInsights);
        
        return conversationInsights;
      }
      
      // Return the insights
      return insightsRecords[0].payload.metadata as unknown as ConversationInsights;
    } catch (error) {
      console.error(`Error getting conversation insights for ${conversationId}:`, error);
      return null;
    }
  }
  
  /**
   * Generate insights for a conversation
   */
  async generateInsights(
    conversationId: string
  ): Promise<Insight[]> {
    try {
      // Get conversation analytics
      const analytics = await this.getConversationAnalytics(conversationId);
      
      if (!analytics) {
        return [];
      }
      
      const insights: Insight[] = [];
      
      // Add response time insights
      this.addResponseTimeInsights(analytics, insights);
      
      // Add participation imbalance insights
      this.addParticipationInsights(analytics, insights);
      
      // Add capability usage insights
      this.addCapabilityInsights(analytics, insights);
      
      // Sort insights by importance
      insights.sort((a, b) => b.importance - a.importance);
      
      return insights;
    } catch (error) {
      console.error(`Error generating insights for conversation ${conversationId}:`, error);
      return [];
    }
  }
  
  /**
   * Get participant analytics across all conversations
   */
  async getParticipantAnalytics(
    participantId: string,
    options: AnalyticsQueryOptions = {}
  ): Promise<any> {
    // Implementation will be added later
    return {
      participantId,
      totalConversations: 0,
      totalMessages: 0,
      averageResponseTime: 0
    };
  }
  
  /**
   * Get agent capability analytics
   */
  async getCapabilityAnalytics(
    options: AnalyticsQueryOptions = {}
  ): Promise<any> {
    // Implementation will be added later
    return {
      capabilities: [],
      totalUsage: 0
    };
  }
  
  /**
   * Reset analytics for a conversation (for testing)
   */
  async resetConversationAnalytics(
    conversationId: string
  ): Promise<void> {
    try {
      // Find analytics records
      const analyticsRecords = await this.memoryService.searchMemories({
        type: CONVERSATION_ANALYTICS_TYPE,
        filter: {
          'metadata.conversationId': conversationId
        }
      });
      
      // Delete each record
      for (const record of analyticsRecords) {
        await this.memoryService.deleteMemory({ 
          id: record.id,
          type: CONVERSATION_ANALYTICS_TYPE
        });
      }
      
      // Find insights records
      const insightsRecords = await this.memoryService.searchMemories({
        type: CONVERSATION_INSIGHTS_TYPE,
        filter: {
          'metadata.conversationId': conversationId
        }
      });
      
      // Delete each insights record
      for (const record of insightsRecords) {
        await this.memoryService.deleteMemory({ 
          id: record.id,
          type: CONVERSATION_INSIGHTS_TYPE
        });
      }
    } catch (error) {
      console.error(`Error resetting analytics for conversation ${conversationId}:`, error);
    }
  }
  
  /**
   * Create empty analytics structure
   */
  private createEmptyAnalytics(conversationId: string, startTime: number): ConversationAnalytics {
    return {
      conversationId,
      startTime,
      duration: 0,
      participantCount: 0,
      humanParticipants: 0,
      agentParticipants: 0,
      participantMap: {},
      messageCount: 0,
      messagesByParticipant: {},
      messagesByType: {},
      averageMessageLength: 0,
      averageResponseTime: 0,
      responseTimeByParticipant: {},
      interactionMatrix: {},
      interactionGraph: [],
      activityDistribution: {},
      capabilitiesUsed: [],
      capabilityUsageCount: {},
      updatedAt: startTime
    };
  }
  
  /**
   * Update analytics metrics with a new message
   */
  private updateMetricsWithMessage(
    analytics: ConversationAnalytics,
    update: MessageAnalyticsUpdate
  ): void {
    const { senderId, senderType, messageType, messageLength, timestamp } = update;
    
    // Update time-based metrics
    analytics.duration = Math.max(analytics.duration, timestamp - analytics.startTime);
    analytics.updatedAt = timestamp;
    
    // Update message counts
    analytics.messageCount += 1;
    analytics.messagesByParticipant[senderId] = (analytics.messagesByParticipant[senderId] || 0) + 1;
    analytics.messagesByType[messageType] = (analytics.messagesByType[messageType] || 0) + 1;
    
    // Update message length average
    const totalLength = analytics.averageMessageLength * (analytics.messageCount - 1) + messageLength;
    analytics.averageMessageLength = totalLength / analytics.messageCount;
    
    // Update activity distribution
    const hour = new Date(timestamp).getHours().toString();
    analytics.activityDistribution[hour] = (analytics.activityDistribution[hour] || 0) + 1;
    
    // Update participant info if this is a new participant
    if (!analytics.participantMap[senderId]) {
      // Create new participant entry
      analytics.participantMap[senderId] = {
        participantId: senderId,
        participantType: senderType,
        messageCount: 1,
        averageMessageLength: messageLength,
        averageResponseTime: 0,
        initiatedInteractions: 0,
        receivedInteractions: 0,
        uniqueInteractionPartners: 0,
        topInteractionPartners: []
      };
      
      // Update participant counts
      analytics.participantCount += 1;
      if (senderType === 'human') {
        analytics.humanParticipants += 1;
      } else {
        analytics.agentParticipants += 1;
      }
    } else {
      // Update existing participant
      const participant = analytics.participantMap[senderId];
      
      // Update message count and length
      participant.messageCount += 1;
      const totalLength = participant.averageMessageLength * (participant.messageCount - 1) + messageLength;
      participant.averageMessageLength = totalLength / participant.messageCount;
    }
    
    // Update response time metrics if this is a response
    if (update.responseTimeMs !== undefined && update.responseTimeMs > 0) {
      // Update overall average
      const totalTime = analytics.averageResponseTime * (analytics.messageCount - 1) + update.responseTimeMs;
      analytics.averageResponseTime = totalTime / analytics.messageCount;
      
      // Update sender's average response time
      const participant = analytics.participantMap[senderId];
      const totalParticipantTime = participant.averageResponseTime * (participant.messageCount - 1) + update.responseTimeMs;
      participant.averageResponseTime = totalParticipantTime / participant.messageCount;
      
      // Update response time by participant
      analytics.responseTimeByParticipant[senderId] = 
        analytics.responseTimeByParticipant[senderId] || 0 + update.responseTimeMs;
    }
    
    // Update interaction matrix if this is a direct message
    if (update.recipientId) {
      // Make sure matrix has entries for both participants
      if (!analytics.interactionMatrix[senderId]) {
        analytics.interactionMatrix[senderId] = {};
      }
      
      // Increment interaction count
      analytics.interactionMatrix[senderId][update.recipientId] = 
        (analytics.interactionMatrix[senderId][update.recipientId] || 0) + 1;
      
      // Update participant interaction metrics
      const sender = analytics.participantMap[senderId];
      sender.initiatedInteractions += 1;
      
      // Add recipient as interaction partner if needed
      if (sender.topInteractionPartners.indexOf(update.recipientId) === -1) {
        sender.topInteractionPartners.push(update.recipientId);
        sender.uniqueInteractionPartners += 1;
      }
      
      // Create recipient in participant map if needed
      if (!analytics.participantMap[update.recipientId]) {
        analytics.participantMap[update.recipientId] = {
          participantId: update.recipientId,
          participantType: update.recipientType || 'agent',
          messageCount: 0,
          averageMessageLength: 0,
          averageResponseTime: 0,
          initiatedInteractions: 0,
          receivedInteractions: 1,
          uniqueInteractionPartners: 1,
          topInteractionPartners: [senderId]
        };
        
        // Update participant counts
        analytics.participantCount += 1;
        if (update.recipientType === 'human') {
          analytics.humanParticipants += 1;
        } else {
          analytics.agentParticipants += 1;
        }
      } else {
        // Update existing recipient
        const recipient = analytics.participantMap[update.recipientId];
        recipient.receivedInteractions += 1;
        
        // Add sender as interaction partner if needed
        if (recipient.topInteractionPartners.indexOf(senderId) === -1) {
          recipient.topInteractionPartners.push(senderId);
          recipient.uniqueInteractionPartners += 1;
        }
      }
      
      // Update interaction graph
      // Find existing link or create new one
      let link = analytics.interactionGraph.find(
        l => l.source === senderId && l.target === update.recipientId
      );
      
      if (!link) {
        link = {
          source: senderId,
          target: update.recipientId,
          weight: 1,
          messageTypes: { [messageType]: 1 }
        };
        analytics.interactionGraph.push(link);
      } else {
        link.weight += 1;
        link.messageTypes = link.messageTypes || {};
        link.messageTypes[messageType] = (link.messageTypes[messageType] || 0) + 1;
      }
      
      // Update response time for link if applicable
      if (update.responseTimeMs) {
        if (!link.averageResponseTime) {
          link.averageResponseTime = update.responseTimeMs;
        } else {
          link.averageResponseTime = (link.averageResponseTime + update.responseTimeMs) / 2;
        }
      }
    }
    
    // Update capability usage if capabilities provided
    if (update.capabilities && update.capabilities.length > 0) {
      update.capabilities.forEach(capability => {
        // Add to list of used capabilities if not already there
        if (analytics.capabilitiesUsed.indexOf(capability) === -1) {
          analytics.capabilitiesUsed.push(capability);
        }
        
        // Increment usage count
        analytics.capabilityUsageCount[capability] = 
          (analytics.capabilityUsageCount[capability] || 0) + 1;
      });
    }
    
    // Update peak activity time
    let peakHour = '';
    let peakValue = 0;
    Object.entries(analytics.activityDistribution).forEach(([hour, count]) => {
      if (count > peakValue) {
        peakHour = hour;
        peakValue = count;
      }
    });
    analytics.peakActivityTime = peakHour;
  }
  
  /**
   * Save analytics to memory service
   */
  private async saveAnalytics(analytics: ConversationAnalytics): Promise<void> {
    try {
      // Search for existing analytics
      const existingRecords = await this.memoryService.searchMemories({
        type: CONVERSATION_ANALYTICS_TYPE,
        filter: {
          'metadata.conversationId': analytics.conversationId
        },
        limit: 1
      });
      
      if (existingRecords.length > 0) {
        // Update existing record
        await this.memoryService.updateMemory({
          type: CONVERSATION_ANALYTICS_TYPE,
          id: existingRecords[0].id,
          metadata: analytics
        });
      } else {
        // Create new record
        await this.memoryService.addMemory({
          type: CONVERSATION_ANALYTICS_TYPE,
          content: `Analytics for conversation ${analytics.conversationId}`,
          metadata: analytics
        });
      }
    } catch (error) {
      console.error(`Error saving analytics for conversation ${analytics.conversationId}:`, error);
    }
  }
  
  /**
   * Save insights to memory service
   */
  private async saveInsights(insights: ConversationInsights): Promise<void> {
    try {
      // Search for existing insights
      const existingRecords = await this.memoryService.searchMemories({
        type: CONVERSATION_INSIGHTS_TYPE,
        filter: {
          'metadata.conversationId': insights.conversationId
        },
        limit: 1
      });
      
      if (existingRecords.length > 0) {
        // Update existing record
        await this.memoryService.updateMemory({
          type: CONVERSATION_INSIGHTS_TYPE,
          id: existingRecords[0].id,
          metadata: insights
        });
      } else {
        // Create new record
        await this.memoryService.addMemory({
          type: CONVERSATION_INSIGHTS_TYPE,
          content: `Insights for conversation ${insights.conversationId}`,
          metadata: insights
        });
      }
    } catch (error) {
      console.error(`Error saving insights for conversation ${insights.conversationId}:`, error);
    }
  }
  
  /**
   * Add response time insights
   */
  private addResponseTimeInsights(
    analytics: ConversationAnalytics,
    insights: Insight[]
  ): void {
    // Check if average response time is significant
    if (analytics.averageResponseTime > 5000) {
      insights.push({
        type: InsightType.RESPONSE_TIME,
        description: 'High average response times detected',
        importance: 7,
        metrics: {
          averageResponseTime: analytics.averageResponseTime
        },
        suggestions: [
          'Consider optimizing agent response processing',
          'Check for complex capability processing that might be slow'
        ]
      });
    }
    
    // Look for significant response time variations between participants
    const responseTimeValues = Object.values(analytics.responseTimeByParticipant);
    if (responseTimeValues.length > 1) {
      const maxTime = Math.max(...responseTimeValues);
      const minTime = Math.min(...responseTimeValues);
      
      // If significant variance
      if (maxTime > minTime * 3 && maxTime > 2000) {
        // Find slowest responder
        let slowestParticipant = '';
        let slowestTime = 0;
        
        Object.entries(analytics.responseTimeByParticipant).forEach(([participantId, time]) => {
          if (time > slowestTime) {
            slowestParticipant = participantId;
            slowestTime = time;
          }
        });
        
        insights.push({
          type: InsightType.RESPONSE_TIME,
          description: `Participant ${slowestParticipant} has significantly slower response times`,
          importance: 6,
          relatedParticipants: [slowestParticipant],
          metrics: {
            responseTime: slowestTime,
            averageResponseTime: analytics.averageResponseTime
          },
          suggestions: [
            'Investigate potential bottlenecks for this participant',
            'Consider optimizing or replacing this agent in the conversation'
          ]
        });
      }
    }
  }
  
  /**
   * Add participation insights
   */
  private addParticipationInsights(
    analytics: ConversationAnalytics,
    insights: Insight[]
  ): void {
    // Check for participation imbalance
    const messagesCounts = Object.values(analytics.messagesByParticipant);
    if (messagesCounts.length > 1) {
      const maxMessages = Math.max(...messagesCounts);
      const minMessages = Math.min(...messagesCounts);
      const totalMessages = analytics.messageCount;
      
      // If one participant dominates the conversation
      if (maxMessages > totalMessages * 0.6 && analytics.participantCount > 2) {
        // Find dominant participant
        let dominantParticipant = '';
        
        Object.entries(analytics.messagesByParticipant).forEach(([participantId, count]) => {
          if (count === maxMessages) {
            dominantParticipant = participantId;
          }
        });
        
        insights.push({
          type: InsightType.PARTICIPATION_IMBALANCE,
          description: `Participant ${dominantParticipant} dominates the conversation (${Math.round(maxMessages/totalMessages*100)}% of messages)`,
          importance: 8,
          relatedParticipants: [dominantParticipant],
          metrics: {
            messageCount: maxMessages,
            totalMessages: totalMessages,
            percentage: maxMessages / totalMessages
          },
          suggestions: [
            'Consider balancing participation by encouraging other agents',
            'Adjust conversation flow to involve more participants'
          ]
        });
      }
      
      // Check for non-participating agents
      if (minMessages < 2 && analytics.messageCount > 10) {
        // Find quiet participants
        const quietParticipants: string[] = [];
        
        Object.entries(analytics.messagesByParticipant).forEach(([participantId, count]) => {
          if (count <= 1) {
            quietParticipants.push(participantId);
          }
        });
        
        if (quietParticipants.length > 0) {
          insights.push({
            type: InsightType.PARTICIPATION_IMBALANCE,
            description: `${quietParticipants.length} participant(s) have minimal or no participation`,
            importance: 7,
            relatedParticipants: quietParticipants,
            suggestions: [
              'Consider removing inactive participants',
              'Directly engage these participants with targeted questions'
            ]
          });
        }
      }
    }
  }
  
  /**
   * Add capability insights
   */
  private addCapabilityInsights(
    analytics: ConversationAnalytics,
    insights: Insight[]
  ): void {
    // Check for capability usage patterns
    if (analytics.capabilitiesUsed.length > 0) {
      // Find most used capability
      let topCapability = '';
      let topUsage = 0;
      
      Object.entries(analytics.capabilityUsageCount).forEach(([capability, count]) => {
        if (count > topUsage) {
          topCapability = capability;
          topUsage = count;
        }
      });
      
      // If one capability is heavily used
      if (topUsage > 5) {
        insights.push({
          type: InsightType.CAPABILITY_USAGE,
          description: `Heavy usage of capability '${topCapability}' detected`,
          importance: 5,
          metrics: {
            usageCount: topUsage,
            totalCapabilities: analytics.capabilitiesUsed.length
          },
          suggestions: [
            'Consider adding more agents with this capability',
            'This capability might need optimization for better performance'
          ]
        });
      }
    }
  }
} 