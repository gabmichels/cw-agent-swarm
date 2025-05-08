/**
 * Conversation Analytics Types
 * 
 * This module defines the types used for the conversation analytics service,
 * which tracks and analyzes multi-agent conversation patterns and metrics.
 */

/**
 * Conversation analytics summary
 */
export interface ConversationAnalytics {
  // Core identity
  conversationId: string;
  
  // Time-based metrics
  startTime: number;
  endTime?: number;
  duration: number; // in milliseconds
  
  // Participant metrics
  participantCount: number;
  humanParticipants: number;
  agentParticipants: number;
  participantMap: Record<string, ParticipantAnalytics>;
  
  // Message metrics
  messageCount: number;
  messagesByParticipant: Record<string, number>;
  messagesByType: Record<string, number>;
  averageMessageLength: number;
  
  // Response metrics
  averageResponseTime: number; // in milliseconds
  responseTimeByParticipant: Record<string, number>;
  
  // Interaction patterns
  interactionMatrix: Record<string, Record<string, number>>;
  interactionGraph: InteractionLink[];
  
  // Activity metrics
  activityDistribution: Record<string, number>; // distribution by hour of day
  peakActivityTime?: string; // hour with most messages
  
  // Semantic metrics
  topicDistribution?: Record<string, number>;
  sentimentScores?: Record<string, number>;
  
  // Capability metrics
  capabilitiesUsed: string[];
  capabilityUsageCount: Record<string, number>;
  
  // Performance metrics
  taskCompletionRate?: number;
  successRate?: number;
  
  // Updated timestamp
  updatedAt: number;
}

/**
 * Analytics for a single participant
 */
export interface ParticipantAnalytics {
  participantId: string;
  participantType: 'human' | 'agent';
  messageCount: number;
  averageMessageLength: number;
  averageResponseTime: number;
  responseTimesByRecipient?: Record<string, number>;
  initiatedInteractions: number;
  receivedInteractions: number;
  uniqueInteractionPartners: number;
  topInteractionPartners: string[];
  activeTimeDistribution?: Record<string, number>;
  capabilitiesUsed?: string[];
  sentimentScore?: number;
  engagementScore?: number;
}

/**
 * Link in the interaction graph
 */
export interface InteractionLink {
  source: string;
  target: string;
  weight: number;
  averageResponseTime?: number;
  messageTypes?: Record<string, number>;
}

/**
 * Time period for analytics
 */
export enum AnalyticsPeriod {
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  ALL_TIME = 'all_time'
}

/**
 * Query options for conversation analytics
 */
export interface AnalyticsQueryOptions {
  period?: AnalyticsPeriod;
  startTime?: number;
  endTime?: number;
  includeSemanticMetrics?: boolean;
  includeParticipantDetails?: boolean;
  includeInteractionGraph?: boolean;
  minMessageCount?: number;
}

/**
 * Message analytics update used to incrementally update analytics
 */
export interface MessageAnalyticsUpdate {
  conversationId: string;
  messageId: string;
  senderId: string;
  senderType: 'human' | 'agent';
  recipientId?: string;
  recipientType?: 'human' | 'agent';
  messageType: string;
  timestamp: number;
  responseToMessageId?: string;
  responseTimeMs?: number;
  messageLength: number;
  capabilities?: string[];
  topic?: string;
  sentiment?: number;
  isSuccessful?: boolean;
  isTaskCompletion?: boolean;
}

/**
 * Conversation analytics insights
 */
export interface ConversationInsights {
  conversationId: string;
  insights: Insight[];
  generatedAt: number;
}

/**
 * Individual insight
 */
export interface Insight {
  type: InsightType;
  description: string;
  importance: number; // 1-10
  relatedParticipants?: string[];
  metrics?: Record<string, any>;
  suggestions?: string[];
}

/**
 * Types of insights
 */
export enum InsightType {
  RESPONSE_TIME = 'response_time',
  PARTICIPATION_IMBALANCE = 'participation_imbalance',
  COMMUNICATION_PATTERN = 'communication_pattern',
  CAPABILITY_USAGE = 'capability_usage',
  TASK_COMPLETION = 'task_completion',
  INTERACTION_QUALITY = 'interaction_quality',
  CONVERSATION_FLOW = 'conversation_flow',
  SENTIMENT_TREND = 'sentiment_trend'
} 