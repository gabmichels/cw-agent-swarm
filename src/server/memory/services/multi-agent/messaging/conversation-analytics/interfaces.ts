/**
 * Conversation Analytics Service Interfaces
 * 
 * This module defines the interfaces for the conversation analytics service,
 * which provides methods for tracking and analyzing multi-agent conversations.
 */

import {
  ConversationAnalytics,
  MessageAnalyticsUpdate,
  AnalyticsQueryOptions,
  ConversationInsights,
  Insight
} from './types';

/**
 * Interface for the conversation analytics service
 */
export interface IConversationAnalyticsService {
  /**
   * Update analytics with new message data
   */
  trackMessage(update: MessageAnalyticsUpdate): Promise<void>;
  
  /**
   * Get analytics for a specific conversation
   */
  getConversationAnalytics(
    conversationId: string,
    options?: AnalyticsQueryOptions
  ): Promise<ConversationAnalytics | null>;
  
  /**
   * Get analytics for multiple conversations
   */
  getMultipleConversationAnalytics(
    options?: AnalyticsQueryOptions
  ): Promise<ConversationAnalytics[]>;
  
  /**
   * Get insights for a conversation
   */
  getConversationInsights(
    conversationId: string
  ): Promise<ConversationInsights | null>;
  
  /**
   * Generate insights for a conversation
   */
  generateInsights(
    conversationId: string
  ): Promise<Insight[]>;
  
  /**
   * Get participant analytics across all conversations
   */
  getParticipantAnalytics(
    participantId: string,
    options?: AnalyticsQueryOptions
  ): Promise<any>;
  
  /**
   * Get agent capability analytics
   */
  getCapabilityAnalytics(
    options?: AnalyticsQueryOptions
  ): Promise<any>;
  
  /**
   * Reset analytics for a conversation (for testing)
   */
  resetConversationAnalytics(
    conversationId: string
  ): Promise<void>;
} 