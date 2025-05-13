/**
 * DefaultNotificationManager
 * 
 * Default implementation of the NotificationManager interface,
 * providing notification capabilities across different channels.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  NotificationManager,
  NotificationManagerConfig,
  Notification,
  NotificationOptions,
  NotificationFilter,
  NotificationStatus,
  NotificationChannel,
  NotificationActionType,
  NotificationAction,
  NotificationActionHandler,
  ChannelConfig,
  NotificationPriority
} from './interfaces/NotificationManager.interface';

/**
 * Error types for notification operations
 */
export class NotificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotificationError';
  }
}

export class NotificationNotFoundError extends NotificationError {
  constructor(id: string) {
    super(`Notification with id '${id}' not found`);
  }
}

export class ChannelNotFoundError extends NotificationError {
  constructor(type: string) {
    super(`Channel type '${type}' not found`);
  }
}

export class NotInitializedError extends NotificationError {
  constructor() {
    super('NotificationManager has not been initialized');
  }
}

/**
 * Default implementation of NotificationManager
 */
export class DefaultNotificationManager implements NotificationManager {
  private initialized = false;
  private notifications: Map<string, Notification> = new Map();
  private channels: Map<NotificationChannel, ChannelConfig> = new Map();
  private actionHandlers: Map<NotificationActionType, NotificationActionHandler> = new Map();
  private config: NotificationManagerConfig | null = null;
  
  /**
   * Check if manager is initialized, throw error if not
   */
  private ensureInitialized() {
    if (!this.initialized) {
      throw new NotInitializedError();
    }
  }
  
  /**
   * Initialize the notification manager
   */
  async initialize(config: NotificationManagerConfig): Promise<boolean> {
    if (this.initialized) {
      return true;
    }
    
    this.config = config;
    
    // Register provided channels
    if (config.channels) {
      for (const channelConfig of config.channels) {
        this.channels.set(channelConfig.type, channelConfig);
      }
    } else {
      // Register default UI channel if no channels provided
      this.channels.set(NotificationChannel.UI, {
        type: NotificationChannel.UI,
        name: 'UI Notifications',
        enabled: true,
        config: {}
      });
    }
    
    // Register default action handlers
    this.actionHandlers.set(NotificationActionType.LINK, async () => {
      // Default link handler would integrate with UI framework
      // For now, it's a no-op
    });
    
    this.initialized = true;
    return true;
  }
  
  /**
   * Send a notification
   */
  async sendNotification(options: NotificationOptions): Promise<string> {
    this.ensureInitialized();
    
    const id = uuidv4();
    const now = new Date();
    
    // Set default values
    const channels = options.channels || [NotificationChannel.UI];
    const priority = options.priority || NotificationPriority.MEDIUM;
    
    // Calculate expiration if TTL provided
    let expiresAt: Date | undefined = undefined;
    if (options.ttl) {
      expiresAt = new Date(now.getTime() + options.ttl);
    } else if (this.config?.defaultTtl) {
      expiresAt = new Date(now.getTime() + this.config.defaultTtl);
    }
    
    // Process actions if any
    let actions: NotificationAction[] | undefined = undefined;
    if (options.actions && options.actions.length > 0) {
      actions = options.actions.map(action => ({
        ...action,
        id: uuidv4() // Generate ID for each action
      }));
    }
    
    // Create notification object
    const notification: Notification = {
      id,
      title: options.title,
      content: options.content,
      priority,
      channels,
      senderId: this.config?.defaultSenderId || 'system',
      recipientIds: options.recipientIds,
      status: NotificationStatus.PENDING,
      createdAt: now,
      expiresAt,
      actions,
      category: options.category,
      tags: options.tags,
      groupId: options.groupId,
      parentId: options.parentId,
      data: options.data,
      metadata: {}
    };
    
    // Store notification
    this.notifications.set(id, notification);
    
    // Set to sending status
    notification.status = NotificationStatus.SENDING;
    notification.sentAt = new Date();
    
    // In a full implementation, we would actually send through channels
    // For now, we'll just simulate successful delivery
    setTimeout(() => {
      if (this.notifications.has(id)) {
        const notif = this.notifications.get(id)!;
        notif.status = NotificationStatus.DELIVERED;
        notif.deliveredAt = new Date();
        this.notifications.set(id, notif);
      }
    }, 100);
    
    return id;
  }
  
  /**
   * Cancel a pending notification
   */
  async cancelNotification(notificationId: string): Promise<boolean> {
    this.ensureInitialized();
    
    const notification = this.notifications.get(notificationId);
    if (!notification) {
      throw new NotificationNotFoundError(notificationId);
    }
    
    // Only cancel if not already delivered or failed
    if (notification.status === NotificationStatus.PENDING || 
        notification.status === NotificationStatus.SENDING) {
      notification.status = NotificationStatus.CANCELED;
      this.notifications.set(notificationId, notification);
      return true;
    }
    
    return false;
  }
  
  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    this.ensureInitialized();
    
    const notification = this.notifications.get(notificationId);
    if (!notification) {
      throw new NotificationNotFoundError(notificationId);
    }
    
    // Only mark as read if delivered
    if (notification.status === NotificationStatus.DELIVERED) {
      notification.status = NotificationStatus.READ;
      notification.readAt = new Date();
      this.notifications.set(notificationId, notification);
      return true;
    }
    
    return false;
  }
  
  /**
   * Mark all notifications as read
   */
  async markAllAsRead(recipientId?: string): Promise<number> {
    this.ensureInitialized();
    
    let count = 0;
    
    // Use Array.from() to convert to array before iterating
    Array.from(this.notifications.entries()).forEach(([id, notification]) => {
      // Skip if not delivered or not matching recipient
      if (notification.status !== NotificationStatus.DELIVERED) {
        return;
      }
      
      if (recipientId && !notification.recipientIds.includes(recipientId)) {
        return;
      }
      
      // Mark as read
      notification.status = NotificationStatus.READ;
      notification.readAt = new Date();
      this.notifications.set(id, notification);
      count++;
    });
    
    return count;
  }
  
  /**
   * Get notification by ID
   */
  async getNotification(notificationId: string): Promise<Notification | null> {
    this.ensureInitialized();
    return this.notifications.get(notificationId) || null;
  }
  
  /**
   * Get notifications with optional filtering
   */
  async getNotifications(
    filter?: NotificationFilter,
    limit?: number,
    offset?: number
  ): Promise<Notification[]> {
    this.ensureInitialized();
    
    let results = Array.from(this.notifications.values());
    
    // Apply filters if provided
    if (filter) {
      if (filter.status) {
        results = results.filter(n => filter.status!.includes(n.status));
      }
      
      if (filter.priority) {
        results = results.filter(n => filter.priority!.includes(n.priority));
      }
      
      if (filter.channels) {
        results = results.filter(n => n.channels.some(c => filter.channels!.includes(c)));
      }
      
      if (filter.senderId) {
        results = results.filter(n => n.senderId === filter.senderId);
      }
      
      if (filter.recipientId) {
        results = results.filter(n => n.recipientIds.includes(filter.recipientId!));
      }
      
      if (filter.category) {
        results = results.filter(n => n.category === filter.category);
      }
      
      if (filter.tags && filter.tags.length > 0) {
        results = results.filter(n => 
          n.tags && filter.tags!.some(tag => n.tags!.includes(tag))
        );
      }
      
      if (filter.groupId) {
        results = results.filter(n => n.groupId === filter.groupId);
      }
      
      if (filter.timeRange) {
        results = results.filter(n => 
          n.createdAt >= filter.timeRange!.start && 
          n.createdAt <= filter.timeRange!.end
        );
      }
      
      if (filter.unreadOnly) {
        results = results.filter(n => n.status === NotificationStatus.DELIVERED);
      }
    }
    
    // Sort by creation time (newest first)
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    // Apply pagination
    if (offset !== undefined && offset > 0) {
      results = results.slice(offset);
    }
    
    if (limit !== undefined && limit > 0) {
      results = results.slice(0, limit);
    }
    
    return results;
  }
  
  /**
   * Get unread notification count
   */
  async getUnreadCount(recipientId?: string): Promise<number> {
    this.ensureInitialized();
    
    let count = 0;
    
    // Use Array.from() to convert to array before iterating
    Array.from(this.notifications.values()).forEach(notification => {
      if (notification.status !== NotificationStatus.DELIVERED) {
        return;
      }
      
      if (recipientId && !notification.recipientIds.includes(recipientId)) {
        return;
      }
      
      count++;
    });
    
    return count;
  }
  
  /**
   * Register action handler
   */
  async registerActionHandler(
    actionType: NotificationActionType,
    handler: NotificationActionHandler
  ): Promise<boolean> {
    this.ensureInitialized();
    
    this.actionHandlers.set(actionType, handler);
    return true;
  }
  
  /**
   * Handle action for a notification
   */
  async handleAction(
    notificationId: string,
    actionId: string,
    data: Record<string, unknown>
  ): Promise<boolean> {
    this.ensureInitialized();
    
    const notification = this.notifications.get(notificationId);
    if (!notification) {
      throw new NotificationNotFoundError(notificationId);
    }
    
    // Find the action
    const action = notification.actions?.find(a => a.id === actionId);
    if (!action) {
      throw new Error(`Action ${actionId} not found in notification ${notificationId}`);
    }
    
    // Get the handler for this action type
    const handler = this.actionHandlers.get(action.type);
    if (!handler) {
      throw new Error(`No handler registered for action type ${action.type}`);
    }
    
    // Call the handler
    try {
      await handler(notificationId, actionId, data);
      return true;
    } catch (error) {
      console.error(`Error handling action ${actionId} for notification ${notificationId}:`, error);
      return false;
    }
  }
  
  /**
   * Register a notification channel
   */
  async registerChannel(config: ChannelConfig): Promise<boolean> {
    this.ensureInitialized();
    
    this.channels.set(config.type, config);
    return true;
  }
  
  /**
   * Get all registered channels
   */
  async getChannels(): Promise<ChannelConfig[]> {
    this.ensureInitialized();
    return Array.from(this.channels.values());
  }
  
  /**
   * Enable a notification channel
   */
  async enableChannel(channelType: NotificationChannel): Promise<boolean> {
    this.ensureInitialized();
    
    const channel = this.channels.get(channelType);
    if (!channel) {
      throw new ChannelNotFoundError(channelType);
    }
    
    channel.enabled = true;
    this.channels.set(channelType, channel);
    return true;
  }
  
  /**
   * Disable a notification channel
   */
  async disableChannel(channelType: NotificationChannel): Promise<boolean> {
    this.ensureInitialized();
    
    const channel = this.channels.get(channelType);
    if (!channel) {
      throw new ChannelNotFoundError(channelType);
    }
    
    channel.enabled = false;
    this.channels.set(channelType, channel);
    return true;
  }
  
  /**
   * Delete notifications matching filter criteria
   */
  async deleteNotifications(filter: NotificationFilter): Promise<number> {
    this.ensureInitialized();
    
    // Get notifications matching the filter
    const notifications = await this.getNotifications(filter);
    
    // Delete each matching notification
    let count = 0;
    for (const notification of notifications) {
      if (this.notifications.delete(notification.id)) {
        count++;
      }
    }
    
    return count;
  }
  
  /**
   * Get delivery status statistics
   */
  async getDeliveryStats(): Promise<Record<NotificationStatus, number>> {
    this.ensureInitialized();
    
    const stats: Record<NotificationStatus, number> = {
      [NotificationStatus.PENDING]: 0,
      [NotificationStatus.SENDING]: 0,
      [NotificationStatus.DELIVERED]: 0,
      [NotificationStatus.READ]: 0,
      [NotificationStatus.FAILED]: 0,
      [NotificationStatus.CANCELED]: 0
    };
    
    // Count notifications by status
    Array.from(this.notifications.values()).forEach(notification => {
      // Ensure status is a valid key
      if (notification.status in stats) {
        stats[notification.status]++;
      }
    });
    
    return stats;
  }
  
  /**
   * Shutdown the notification manager
   */
  async shutdown(): Promise<boolean> {
    if (!this.initialized) {
      return true;
    }
    
    // Clear all data
    this.notifications.clear();
    this.initialized = false;
    
    return true;
  }
} 