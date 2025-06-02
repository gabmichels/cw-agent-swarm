/**
 * DefaultNotificationManagerWrapper.ts - Default Notification Manager Wrapper
 * 
 * This file provides a wrapper around the existing DefaultNotificationManager to
 * integrate it with the DefaultAgent manager system while preserving all existing
 * functionality including Discord integration and notification channels.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md:
 * - Clean break from legacy patterns
 * - No placeholder implementations
 * - Industry best practices with ULID IDs
 * - Wrap existing implementation, don't replace
 */

import { ulid } from 'ulid';
import { 
  NotificationManager, 
  NotificationManagerConfig
} from '../../../../agents/shared/base/managers/NotificationManager.interface';
import { AbstractBaseManager } from '../../../../agents/shared/base/managers/BaseManager';
import { AgentBase } from '../../../../agents/shared/base/AgentBase';
import { ManagerType } from '../../../../agents/shared/base/managers/ManagerType';
import { ManagerHealth } from '../../../../agents/shared/base/managers/ManagerHealth';

// Import existing notification implementation
import { DefaultNotificationManager } from '../../../../agents/shared/notifications/DefaultNotificationManager';
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
} from '../../../../agents/shared/notifications/interfaces/NotificationManager.interface';

/**
 * Extended configuration for DefaultNotificationManagerWrapper
 */
export interface DefaultNotificationManagerWrapperConfig extends NotificationManagerConfig {
  /**
   * Whether this manager is enabled (required by BaseManager)
   */
  enabled: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_NOTIFICATION_MANAGER_CONFIG: DefaultNotificationManagerWrapperConfig = {
  enabled: false, // Disabled by default for backward compatibility
  enableAutoCleanup: true,
  maxNotificationAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  maxNotifications: 10000,
  enableBatching: false,
  batchSize: 10,
  batchTimeout: 1000,
  notificationConfig: {
    defaultSenderId: 'system',
    defaultTtl: 24 * 60 * 60 * 1000, // 24 hours
    storage: {
      type: 'memory',
      maxItems: 10000
    }
  }
};

/**
 * Error class for notification-related errors
 */
export class NotificationWrapperError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'NOTIFICATION_WRAPPER_ERROR',
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'NotificationWrapperError';
  }
}

/**
 * Wrapper implementation of the NotificationManager interface
 * 
 * This class wraps the existing DefaultNotificationManager and provides
 * the BaseManager interface for integration with DefaultAgent.
 */
export class DefaultNotificationManagerWrapper extends AbstractBaseManager implements NotificationManager {
  public readonly managerType: ManagerType = ManagerType.NOTIFICATION;
  
  protected _config: DefaultNotificationManagerWrapperConfig;
  protected _initialized: boolean = false;
  protected _notificationManager: DefaultNotificationManager;
  protected _cleanupInterval?: NodeJS.Timeout;
  protected _batchQueue: NotificationOptions[] = [];
  protected _batchTimeout?: NodeJS.Timeout;
  
  /**
   * Create a new DefaultNotificationManagerWrapper instance
   * 
   * @param agent - The agent this manager belongs to
   * @param config - Configuration options
   */
  constructor(
    protected agent: AgentBase,
    config: Partial<DefaultNotificationManagerWrapperConfig> = {}
  ) {
    const managerId = `notification-manager-${ulid()}`;
    const mergedConfig = {
      ...DEFAULT_NOTIFICATION_MANAGER_CONFIG,
      ...config
    };
    
    super(
      managerId,
      ManagerType.NOTIFICATION,
      agent,
      mergedConfig
    );
    
    this._config = mergedConfig;
    this._notificationManager = new DefaultNotificationManager();
  }

  /**
   * Get the agent this manager belongs to
   */
  getAgent(): AgentBase {
    return this.agent;
  }

  /**
   * Check if the manager is enabled
   */
  isEnabled(): boolean {
    return this._config.enabled;
  }

  /**
   * Enable or disable the manager
   */
  setEnabled(enabled: boolean): boolean {
    this._config.enabled = enabled;
    return enabled;
  }

  /**
   * Initialize the notification manager wrapper
   */
  async initialize(): Promise<boolean> {
    try {
      console.log(`[${this.managerId}] Initializing DefaultNotificationManagerWrapper...`);
      
      if (!this._config.enabled) {
        console.log(`[${this.managerId}] Manager is disabled, skipping initialization`);
        this._initialized = true;
        return true;
      }

      // Initialize the wrapped notification manager
      if (this._config.notificationConfig) {
        // Use agent ID as default sender if 'system' is configured (the default)
        const shouldUseAgentId = this._config.notificationConfig.defaultSenderId === 'system';
        const config: BaseNotificationManagerConfig = {
          ...this._config.notificationConfig,
          defaultSenderId: shouldUseAgentId ? this.agent.getAgentId() : this._config.notificationConfig.defaultSenderId
        };
        
        await this._notificationManager.initialize(config);
      }

      // Start automatic cleanup if enabled
      if (this._config.enableAutoCleanup && this._config.maxNotificationAge) {
        this._startCleanupInterval();
      }

      console.log(`[${this.managerId}] DefaultNotificationManagerWrapper initialized successfully`);
      this._initialized = true;
      
      return true;
    } catch (error) {
      console.error(`[${this.managerId}] Failed to initialize DefaultNotificationManagerWrapper:`, error);
      throw new NotificationWrapperError(
        'Failed to initialize notification manager wrapper',
        'INIT_FAILED',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Shutdown the notification manager wrapper
   */
  async shutdown(): Promise<void> {
    try {
      console.log(`[${this.managerId}] Shutting down DefaultNotificationManagerWrapper...`);
      
      // Clear cleanup interval
      if (this._cleanupInterval) {
        clearInterval(this._cleanupInterval);
        this._cleanupInterval = undefined;
      }

      // Clear batch timeout
      if (this._batchTimeout) {
        clearTimeout(this._batchTimeout);
        this._batchTimeout = undefined;
      }

      // Process remaining batched notifications
      if (this._batchQueue.length > 0) {
        await this._processBatch();
      }

      // Shutdown the wrapped notification manager
      await this._notificationManager.shutdown();
      
      this._initialized = false;
      console.log(`[${this.managerId}] DefaultNotificationManagerWrapper shutdown complete`);
    } catch (error) {
      console.error(`[${this.managerId}] Error during shutdown:`, error);
      throw error;
    }
  }

  /**
   * Reset the notification manager wrapper
   */
  async reset(): Promise<boolean> {
    try {
      console.log(`[${this.managerId}] Resetting DefaultNotificationManagerWrapper...`);
      
      await this.shutdown();
      this._batchQueue = [];
      await this.initialize();
      
      return true;
    } catch (error) {
      console.error(`[${this.managerId}] Failed to reset DefaultNotificationManagerWrapper:`, error);
      return false;
    }
  }

  /**
   * Get manager health status
   */
  async getHealth(): Promise<ManagerHealth> {
    const isHealthy = this._initialized && this.isEnabled();
    const status = isHealthy ? 'healthy' : 'unhealthy';
    const issues: Array<{
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
      detectedAt: Date;
    }> = [];
    
    // Check for issues
    if (!this._initialized) {
      issues.push({
        severity: 'critical',
        message: 'NotificationManagerWrapper is not initialized',
        detectedAt: new Date()
      });
    }
    
    if (!this.isEnabled()) {
      issues.push({
        severity: 'medium',
        message: 'NotificationManagerWrapper is disabled',
        detectedAt: new Date()
      });
    }

    const metrics: Record<string, unknown> = {
      initialized: this._initialized,
      enabled: this.isEnabled(),
      batchQueueSize: this._batchQueue.length,
      hasCleanupInterval: !!this._cleanupInterval
    };

    try {
      // Get notification statistics if available
      if (this._initialized && this.isEnabled()) {
        const stats = await this._notificationManager.getDeliveryStats();
        metrics.deliveryStats = stats;
        
        const unreadCount = await this._notificationManager.getUnreadCount();
        metrics.unreadCount = unreadCount;
      }
    } catch (error) {
      metrics.healthCheckError = error instanceof Error ? error.message : 'Unknown error';
      issues.push({
        severity: 'high',
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        detectedAt: new Date()
      });
    }

    return {
      status,
      message: status === 'healthy' ? 'NotificationManager is operating normally' : 'NotificationManager has issues',
      metrics,
      details: {
        lastCheck: new Date(),
        issues,
        metrics: {
          managerType: this.managerType,
          managerId: this.managerId
        }
      }
    };
  }

  /**
   * Send a notification
   */
  async sendNotification(options: NotificationOptions): Promise<string> {
    this._ensureInitialized();
    
    try {
      if (this._config.enableBatching) {
        return await this._addToBatch(options);
      } else {
        return await this._notificationManager.sendNotification(options);
      }
    } catch (error) {
      throw new NotificationWrapperError(
        'Failed to send notification',
        'SEND_FAILED',
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          notificationTitle: options.title
        }
      );
    }
  }

  /**
   * Send multiple notifications in batch
   */
  async sendBatchNotifications(notifications: NotificationOptions[]): Promise<string[]> {
    this._ensureInitialized();
    
    try {
      const results: string[] = [];
      
      for (const notification of notifications) {
        const id = await this._notificationManager.sendNotification(notification);
        results.push(id);
      }
      
      return results;
    } catch (error) {
      throw new NotificationWrapperError(
        'Failed to send batch notifications',
        'BATCH_SEND_FAILED',
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          batchSize: notifications.length
        }
      );
    }
  }

  /**
   * Cancel a pending notification
   */
  async cancelNotification(notificationId: string): Promise<boolean> {
    this._ensureInitialized();
    
    try {
      return await this._notificationManager.cancelNotification(notificationId);
    } catch (error) {
      throw new NotificationWrapperError(
        'Failed to cancel notification',
        'CANCEL_FAILED',
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          notificationId
        }
      );
    }
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    this._ensureInitialized();
    
    try {
      return await this._notificationManager.markAsRead(notificationId);
    } catch (error) {
      throw new NotificationWrapperError(
        'Failed to mark notification as read',
        'MARK_READ_FAILED',
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          notificationId
        }
      );
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(recipientId?: string): Promise<number> {
    this._ensureInitialized();
    
    try {
      return await this._notificationManager.markAllAsRead(recipientId);
    } catch (error) {
      throw new NotificationWrapperError(
        'Failed to mark all notifications as read',
        'MARK_ALL_READ_FAILED',
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          recipientId
        }
      );
    }
  }

  /**
   * Get notification by ID
   */
  async getNotification(notificationId: string): Promise<Notification | null> {
    this._ensureInitialized();
    
    try {
      return await this._notificationManager.getNotification(notificationId);
    } catch (error) {
      throw new NotificationWrapperError(
        'Failed to get notification',
        'GET_NOTIFICATION_FAILED',
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          notificationId
        }
      );
    }
  }

  /**
   * Get notifications with optional filtering
   */
  async getNotifications(
    filter?: NotificationFilter,
    limit?: number,
    offset?: number
  ): Promise<Notification[]> {
    this._ensureInitialized();
    
    try {
      return await this._notificationManager.getNotifications(filter, limit, offset);
    } catch (error) {
      throw new NotificationWrapperError(
        'Failed to get notifications',
        'GET_NOTIFICATIONS_FAILED',
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          filter,
          limit,
          offset
        }
      );
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(recipientId?: string): Promise<number> {
    this._ensureInitialized();
    
    try {
      return await this._notificationManager.getUnreadCount(recipientId);
    } catch (error) {
      throw new NotificationWrapperError(
        'Failed to get unread count',
        'GET_UNREAD_COUNT_FAILED',
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          recipientId
        }
      );
    }
  }

  /**
   * Register action handler
   */
  async registerActionHandler(
    actionType: NotificationActionType,
    handler: NotificationActionHandler
  ): Promise<boolean> {
    this._ensureInitialized();
    
    try {
      return await this._notificationManager.registerActionHandler(actionType, handler);
    } catch (error) {
      throw new NotificationWrapperError(
        'Failed to register action handler',
        'REGISTER_HANDLER_FAILED',
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          actionType
        }
      );
    }
  }

  /**
   * Handle action for a notification
   */
  async handleAction(
    notificationId: string,
    actionId: string,
    data: Record<string, unknown>
  ): Promise<boolean> {
    this._ensureInitialized();
    
    try {
      return await this._notificationManager.handleAction(notificationId, actionId, data);
    } catch (error) {
      throw new NotificationWrapperError(
        'Failed to handle notification action',
        'HANDLE_ACTION_FAILED',
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          notificationId,
          actionId
        }
      );
    }
  }

  /**
   * Register a notification channel
   */
  async registerChannel(config: ChannelConfig): Promise<boolean> {
    this._ensureInitialized();
    
    try {
      return await this._notificationManager.registerChannel(config);
    } catch (error) {
      throw new NotificationWrapperError(
        'Failed to register notification channel',
        'REGISTER_CHANNEL_FAILED',
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          channelType: config.type
        }
      );
    }
  }

  /**
   * Get all registered channels
   */
  async getChannels(): Promise<ChannelConfig[]> {
    this._ensureInitialized();
    
    try {
      return await this._notificationManager.getChannels();
    } catch (error) {
      throw new NotificationWrapperError(
        'Failed to get notification channels',
        'GET_CHANNELS_FAILED',
        { 
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      );
    }
  }

  /**
   * Enable a notification channel
   */
  async enableChannel(channelType: NotificationChannel): Promise<boolean> {
    this._ensureInitialized();
    
    try {
      return await this._notificationManager.enableChannel(channelType);
    } catch (error) {
      throw new NotificationWrapperError(
        'Failed to enable notification channel',
        'ENABLE_CHANNEL_FAILED',
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          channelType
        }
      );
    }
  }

  /**
   * Disable a notification channel
   */
  async disableChannel(channelType: NotificationChannel): Promise<boolean> {
    this._ensureInitialized();
    
    try {
      return await this._notificationManager.disableChannel(channelType);
    } catch (error) {
      throw new NotificationWrapperError(
        'Failed to disable notification channel',
        'DISABLE_CHANNEL_FAILED',
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          channelType
        }
      );
    }
  }

  /**
   * Delete notifications matching filter criteria
   */
  async deleteNotifications(filter: NotificationFilter): Promise<number> {
    this._ensureInitialized();
    
    try {
      return await this._notificationManager.deleteNotifications(filter);
    } catch (error) {
      throw new NotificationWrapperError(
        'Failed to delete notifications',
        'DELETE_NOTIFICATIONS_FAILED',
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          filter
        }
      );
    }
  }

  /**
   * Get delivery status statistics
   */
  async getDeliveryStats(): Promise<Record<NotificationStatus, number>> {
    this._ensureInitialized();
    
    try {
      return await this._notificationManager.getDeliveryStats();
    } catch (error) {
      throw new NotificationWrapperError(
        'Failed to get delivery statistics',
        'GET_DELIVERY_STATS_FAILED',
        { 
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      );
    }
  }

  /**
   * Clean up old notifications based on configuration
   */
  async cleanupNotifications(): Promise<number> {
    this._ensureInitialized();
    
    try {
      if (!this._config.maxNotificationAge) {
        return 0;
      }

      const cutoffDate = new Date(Date.now() - this._config.maxNotificationAge);
      const filter: NotificationFilter = {
        timeRange: {
          start: new Date(0), // Beginning of time
          end: cutoffDate
        }
      };

      const deletedCount = await this._notificationManager.deleteNotifications(filter);
      
      if (deletedCount > 0) {
        console.log(`[${this.managerId}] Cleaned up ${deletedCount} old notifications`);
      }
      
      return deletedCount;
    } catch (error) {
      console.error(`[${this.managerId}] Failed to cleanup notifications:`, error);
      throw new NotificationWrapperError(
        'Failed to cleanup notifications',
        'CLEANUP_FAILED',
        { 
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      );
    }
  }

  /**
   * Get notification history for an agent
   */
  async getNotificationHistory(
    agentId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<Notification[]> {
    this._ensureInitialized();
    
    try {
      const filter: NotificationFilter = {
        senderId: agentId
      };

      if (options.startDate || options.endDate) {
        filter.timeRange = {
          start: options.startDate || new Date(0),
          end: options.endDate || new Date()
        };
      }

      return await this._notificationManager.getNotifications(
        filter,
        options.limit,
        options.offset
      );
    } catch (error) {
      throw new NotificationWrapperError(
        'Failed to get notification history',
        'GET_HISTORY_FAILED',
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          agentId,
          options
        }
      );
    }
  }

  /**
   * Ensure the manager is initialized
   */
  protected _ensureInitialized(): void {
    if (!this._initialized) {
      throw new NotificationWrapperError(
        'NotificationManagerWrapper has not been initialized',
        'NOT_INITIALIZED'
      );
    }

    if (!this.isEnabled()) {
      throw new NotificationWrapperError(
        'NotificationManagerWrapper is disabled',
        'DISABLED'
      );
    }
  }

  /**
   * Start the cleanup interval
   */
  protected _startCleanupInterval(): void {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
    }

    // Run cleanup every hour
    const intervalMs = 60 * 60 * 1000;
    
    this._cleanupInterval = setInterval(async () => {
      try {
        await this.cleanupNotifications();
      } catch (error) {
        console.error(`[${this.managerId}] Automatic cleanup failed:`, error);
      }
    }, intervalMs);
  }

  /**
   * Add notification to batch queue
   */
  protected async _addToBatch(options: NotificationOptions): Promise<string> {
    // Generate ID immediately for consistency
    const notificationId = ulid();
    
    // Add to batch queue
    this._batchQueue.push(options);

    // Start batch timeout if not already running
    if (!this._batchTimeout) {
      this._batchTimeout = setTimeout(async () => {
        await this._processBatch();
      }, this._config.batchTimeout || 1000);
    }

    // Process batch if it reaches the configured size
    if (this._batchQueue.length >= (this._config.batchSize || 10)) {
      await this._processBatch();
    }

    return notificationId;
  }

  /**
   * Process the current batch of notifications
   */
  protected async _processBatch(): Promise<void> {
    if (this._batchQueue.length === 0) {
      return;
    }

    // Clear timeout
    if (this._batchTimeout) {
      clearTimeout(this._batchTimeout);
      this._batchTimeout = undefined;
    }

    // Get current batch and clear queue
    const batch = [...this._batchQueue];
    this._batchQueue = [];

    try {
      // Send all notifications in batch
      await this.sendBatchNotifications(batch);
      console.log(`[${this.managerId}] Processed batch of ${batch.length} notifications`);
    } catch (error) {
      console.error(`[${this.managerId}] Failed to process notification batch:`, error);
      // Re-add failed notifications to queue for retry
      this._batchQueue.unshift(...batch);
    }
  }
} 