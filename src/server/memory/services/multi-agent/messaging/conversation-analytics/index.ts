/**
 * Conversation Analytics Module
 * 
 * This module exports the conversation analytics service and related types.
 */

// Export the service class
export { ConversationAnalyticsService } from './analytics-service';

// Export the interface
export type { IConversationAnalyticsService } from './interfaces';

// Export types
export type {
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