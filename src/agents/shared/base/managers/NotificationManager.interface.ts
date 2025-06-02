/**
 * NotificationManager.interface.ts - Notification Manager Interface
 * 
 * This file defines the notification manager interface that extends BaseManager
 * for integration with the DefaultAgent system. It provides notification 
 * capabilities across different channels while following the manager pattern.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md:
 * - Clean break from legacy patterns
 * - Industry best practices with ULID IDs
 * - Interface-first design with strict typing
 */

import { BaseManager, ManagerConfig } from './BaseManager';
import { 
  NotificationOptions,
  Notification,
  NotificationFilter,
  NotificationActionType,
  NotificationActionHandler,
  ChannelConfig,
  NotificationChannel,
  NotificationStatus,
  NotificationManagerConfig as BaseNotificationManagerConfig
} from '../../../shared/notifications/interfaces/NotificationManager.interface';

/**
 * Configuration interface for NotificationManager
 */
export interface NotificationManagerConfig extends ManagerConfig {
  /**
   * Base notification manager configuration
   */
  notificationConfig?: BaseNotificationManagerConfig;
  
  /**
   * Whether to enable automatic notification cleanup
   */
  enableAutoCleanup?: boolean;
  
  /**
   * Maximum age for notifications before cleanup (in milliseconds)
   */
  maxNotificationAge?: number;
  
  /**
   * Maximum number of notifications to keep in memory
   */
  maxNotifications?: number;
  
  /**
   * Whether to enable notification batching
   */
  enableBatching?: boolean;
  
  /**
   * Batch size for sending notifications
   */
  batchSize?: number;
  
  /**
   * Batch timeout in milliseconds
   */
  batchTimeout?: number;
}

/**
 * NotificationManager interface that extends BaseManager
 * 
 * Provides notification capabilities for agents following the standard manager pattern.
 */
export interface NotificationManager extends BaseManager {
  /**
   * Send a notification
   * 
   * @param options - Notification options
   * @returns Promise resolving to notification ID
   */
  sendNotification(options: NotificationOptions): Promise<string>;
  
  /**
   * Send multiple notifications in batch
   * 
   * @param notifications - Array of notification options
   * @returns Promise resolving to array of notification IDs
   */
  sendBatchNotifications(notifications: NotificationOptions[]): Promise<string[]>;
  
  /**
   * Cancel a pending notification
   * 
   * @param notificationId - Notification ID
   * @returns Promise resolving to cancellation success
   */
  cancelNotification(notificationId: string): Promise<boolean>;
  
  /**
   * Mark a notification as read
   * 
   * @param notificationId - Notification ID
   * @returns Promise resolving to success
   */
  markAsRead(notificationId: string): Promise<boolean>;
  
  /**
   * Mark all notifications as read
   * 
   * @param recipientId - Recipient ID (if specified, only marks this recipient's notifications)
   * @returns Promise resolving to number of notifications marked
   */
  markAllAsRead(recipientId?: string): Promise<number>;
  
  /**
   * Get notification by ID
   * 
   * @param notificationId - Notification ID
   * @returns Promise resolving to notification or null if not found
   */
  getNotification(notificationId: string): Promise<Notification | null>;
  
  /**
   * Get notifications with optional filtering
   * 
   * @param filter - Notification filter
   * @param limit - Maximum number of notifications to return
   * @param offset - Offset for pagination
   * @returns Promise resolving to array of notifications
   */
  getNotifications(
    filter?: NotificationFilter,
    limit?: number,
    offset?: number
  ): Promise<Notification[]>;
  
  /**
   * Get unread notification count
   * 
   * @param recipientId - Optional recipient ID to filter by
   * @returns Promise resolving to unread count
   */
  getUnreadCount(recipientId?: string): Promise<number>;
  
  /**
   * Register action handler
   * 
   * @param actionType - Action type
   * @param handler - Handler function
   * @returns Promise resolving to registration success
   */
  registerActionHandler(
    actionType: NotificationActionType,
    handler: NotificationActionHandler
  ): Promise<boolean>;
  
  /**
   * Handle action for a notification
   * 
   * @param notificationId - Notification ID
   * @param actionId - Action ID
   * @param data - Action data
   * @returns Promise resolving to handling success
   */
  handleAction(
    notificationId: string,
    actionId: string,
    data: Record<string, unknown>
  ): Promise<boolean>;
  
  /**
   * Register a notification channel
   * 
   * @param config - Channel configuration
   * @returns Promise resolving to registration success
   */
  registerChannel(config: ChannelConfig): Promise<boolean>;
  
  /**
   * Get all registered channels
   * 
   * @returns Promise resolving to array of channel configurations
   */
  getChannels(): Promise<ChannelConfig[]>;
  
  /**
   * Enable a notification channel
   * 
   * @param channelType - Channel type
   * @returns Promise resolving to success
   */
  enableChannel(channelType: NotificationChannel): Promise<boolean>;
  
  /**
   * Disable a notification channel
   * 
   * @param channelType - Channel type
   * @returns Promise resolving to success
   */
  disableChannel(channelType: NotificationChannel): Promise<boolean>;
  
  /**
   * Delete notifications matching filter criteria
   * 
   * @param filter - Notification filter
   * @returns Promise resolving to number of notifications deleted
   */
  deleteNotifications(filter: NotificationFilter): Promise<number>;
  
  /**
   * Get delivery status statistics
   * 
   * @returns Promise resolving to status statistics
   */
  getDeliveryStats(): Promise<Record<NotificationStatus, number>>;
  
  /**
   * Clean up old notifications based on configuration
   * 
   * @returns Promise resolving to number of notifications cleaned up
   */
  cleanupNotifications(): Promise<number>;
  
  /**
   * Get notification history for an agent
   * 
   * @param agentId - Agent ID to get history for
   * @param options - History options
   * @returns Promise resolving to notification history
   */
  getNotificationHistory(
    agentId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<Notification[]>;
} 