/**
 * NotificationManager Interface
 * 
 * This file defines interfaces for agent notification capabilities,
 * enabling standardized communication across different systems and users.
 */

/**
 * Notification priority levels
 */
export enum NotificationPriority {
  CRITICAL = 'critical',   // Requires immediate attention
  HIGH = 'high',           // Important, should be addressed soon
  MEDIUM = 'medium',       // Standard notification
  LOW = 'low',             // Informational, non-urgent
  BACKGROUND = 'background' // Background information
}

/**
 * Notification channel types
 */
export enum NotificationChannel {
  UI = 'ui',                 // UI notification within application
  EMAIL = 'email',           // Email notification
  WEBHOOK = 'webhook',       // External webhook
  SLACK = 'slack',           // Slack integration
  TEAMS = 'teams',           // Microsoft Teams integration
  SYSTEM = 'system',         // System notification
  AGENT = 'agent',           // Direct agent-to-agent notification
  CUSTOM = 'custom'          // Custom channel
}

/**
 * Notification status
 */
export enum NotificationStatus {
  PENDING = 'pending',       // Created but not yet sent
  SENDING = 'sending',       // In the process of being sent
  DELIVERED = 'delivered',   // Successfully delivered
  READ = 'read',             // Confirmed as read by recipient
  FAILED = 'failed',         // Failed to deliver
  CANCELED = 'canceled'      // Canceled before delivery
}

/**
 * Notification action type
 */
export enum NotificationActionType {
  LINK = 'link',             // Navigate to a link
  BUTTON = 'button',         // Button press
  REPLY = 'reply',           // Reply field
  FORM = 'form',             // Form to fill out
  CUSTOM = 'custom'          // Custom action
}

/**
 * Notification action interface
 */
export interface NotificationAction {
  /** Unique identifier for the action */
  id: string;
  
  /** Display name for the action */
  name: string;
  
  /** Action type */
  type: NotificationActionType;
  
  /** Action data (depends on type) */
  data: {
    /** URL for LINK type */
    url?: string;
    
    /** Handler name for BUTTON type */
    handler?: string;
    
    /** Form fields for FORM type */
    fields?: Array<{
      name: string;
      type: 'text' | 'number' | 'select' | 'checkbox';
      label: string;
      required?: boolean;
      options?: string[];
    }>;
    
    /** Custom action data */
    [key: string]: unknown;
  };
  
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Notification interface
 */
export interface Notification {
  /** Unique notification ID */
  id: string;
  
  /** Notification title */
  title: string;
  
  /** Notification body/content */
  content: string;
  
  /** Priority level */
  priority: NotificationPriority;
  
  /** Target channels */
  channels: NotificationChannel[];
  
  /** Sender ID (agent ID, system, etc.) */
  senderId: string;
  
  /** Recipient IDs */
  recipientIds: string[];
  
  /** Current status */
  status: NotificationStatus;
  
  /** Timestamp when created */
  createdAt: Date;
  
  /** Timestamp when sent/attempted */
  sentAt?: Date;
  
  /** Timestamp when delivered */
  deliveredAt?: Date;
  
  /** Timestamp when read */
  readAt?: Date;
  
  /** Expiration timestamp */
  expiresAt?: Date;
  
  /** Available actions for this notification */
  actions?: NotificationAction[];
  
  /** Category for grouping/filtering */
  category?: string;
  
  /** Tags for filtering */
  tags?: string[];
  
  /** Notification group ID for threading */
  groupId?: string;
  
  /** Parent notification ID for replies */
  parentId?: string;
  
  /** Additional data */
  data?: Record<string, unknown>;
  
  /** Metadata for internal use */
  metadata?: Record<string, unknown>;
}

/**
 * Notification creation options
 */
export interface NotificationOptions {
  /** Notification title */
  title: string;
  
  /** Notification body/content */
  content: string;
  
  /** Priority level (default: MEDIUM) */
  priority?: NotificationPriority;
  
  /** Target channels (default: UI) */
  channels?: NotificationChannel[];
  
  /** Recipient IDs */
  recipientIds: string[];
  
  /** Time before expiration (in milliseconds) */
  ttl?: number;
  
  /** Available actions */
  actions?: Omit<NotificationAction, 'id'>[];
  
  /** Category for grouping/filtering */
  category?: string;
  
  /** Tags for filtering */
  tags?: string[];
  
  /** Notification group ID for threading */
  groupId?: string;
  
  /** Parent notification ID for replies */
  parentId?: string;
  
  /** Additional data */
  data?: Record<string, unknown>;
  
  /** Channel-specific options */
  channelOptions?: {
    /** Email channel options */
    email?: {
      subject?: string;
      from?: string;
      replyTo?: string;
      cc?: string[];
      bcc?: string[];
      template?: string;
      attachments?: Array<{
        filename: string;
        content: string | Buffer;
        contentType?: string;
      }>;
    };
    
    /** Webhook channel options */
    webhook?: {
      headers?: Record<string, string>;
      method?: 'GET' | 'POST' | 'PUT';
      retries?: number;
    };
    
    /** Slack channel options */
    slack?: {
      channel?: string;
      username?: string;
      iconUrl?: string;
      blocks?: unknown[];
    };
    
    /** Teams channel options */
    teams?: {
      channel?: string;
      cardTemplate?: string;
    };
    
    /** System channel options */
    system?: {
      sound?: boolean;
      sticky?: boolean;
    };
    
    /** Custom channel options */
    [key: string]: unknown;
  };
}

/**
 * Notification filter for queries
 */
export interface NotificationFilter {
  /** Filter by status */
  status?: NotificationStatus[];
  
  /** Filter by priority */
  priority?: NotificationPriority[];
  
  /** Filter by channels */
  channels?: NotificationChannel[];
  
  /** Filter by sender ID */
  senderId?: string;
  
  /** Filter by recipient ID */
  recipientId?: string;
  
  /** Filter by category */
  category?: string;
  
  /** Filter by tag */
  tags?: string[];
  
  /** Filter by group ID */
  groupId?: string;
  
  /** Filter by time range */
  timeRange?: {
    start: Date;
    end: Date;
  };
  
  /** Filter unread only */
  unreadOnly?: boolean;
}

/**
 * Notification action handler
 */
export type NotificationActionHandler = (
  notificationId: string,
  actionId: string,
  data: Record<string, unknown>
) => Promise<void>;

/**
 * Channel configuration interface
 */
export interface ChannelConfig {
  /** Channel type */
  type: NotificationChannel;
  
  /** Display name */
  name: string;
  
  /** Is channel enabled */
  enabled: boolean;
  
  /** Channel-specific configuration */
  config: Record<string, unknown>;
  
  /** Rate limiting */
  rateLimit?: {
    /** Max requests per period */
    maxRequests: number;
    
    /** Time period in milliseconds */
    period: number;
  };
}

/**
 * Notification manager configuration
 */
export interface NotificationManagerConfig {
  /** Default sender ID */
  defaultSenderId: string;
  
  /** Default TTL in milliseconds */
  defaultTtl?: number;
  
  /** Channel configurations */
  channels?: ChannelConfig[];
  
  /** Global rate limiting */
  globalRateLimit?: {
    /** Max notifications per period */
    maxNotifications: number;
    
    /** Time period in milliseconds */
    period: number;
  };
  
  /** Storage options */
  storage?: {
    /** Storage type */
    type: 'memory' | 'database' | 'custom';
    
    /** Max notifications to keep in memory */
    maxItems?: number;
    
    /** Custom storage options */
    options?: Record<string, unknown>;
  };
}

/**
 * NotificationManager interface
 */
export interface NotificationManager {
  /**
   * Initialize the notification manager
   * 
   * @param config Manager configuration
   * @returns Promise resolving to initialization success
   */
  initialize(config: NotificationManagerConfig): Promise<boolean>;
  
  /**
   * Send a notification
   * 
   * @param options Notification options
   * @returns Promise resolving to notification ID
   */
  sendNotification(options: NotificationOptions): Promise<string>;
  
  /**
   * Cancel a pending notification
   * 
   * @param notificationId Notification ID
   * @returns Promise resolving to cancellation success
   */
  cancelNotification(notificationId: string): Promise<boolean>;
  
  /**
   * Mark a notification as read
   * 
   * @param notificationId Notification ID
   * @returns Promise resolving to success
   */
  markAsRead(notificationId: string): Promise<boolean>;
  
  /**
   * Mark all notifications as read
   * 
   * @param recipientId Recipient ID (if specified, only marks this recipient's notifications)
   * @returns Promise resolving to number of notifications marked
   */
  markAllAsRead(recipientId?: string): Promise<number>;
  
  /**
   * Get notification by ID
   * 
   * @param notificationId Notification ID
   * @returns Promise resolving to notification or null if not found
   */
  getNotification(notificationId: string): Promise<Notification | null>;
  
  /**
   * Get notifications with optional filtering
   * 
   * @param filter Notification filter
   * @param limit Maximum number of notifications to return
   * @param offset Offset for pagination
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
   * @param recipientId Optional recipient ID to filter by
   * @returns Promise resolving to unread count
   */
  getUnreadCount(recipientId?: string): Promise<number>;
  
  /**
   * Register action handler
   * 
   * @param actionType Action type
   * @param handler Handler function
   * @returns Promise resolving to registration success
   */
  registerActionHandler(
    actionType: NotificationActionType,
    handler: NotificationActionHandler
  ): Promise<boolean>;
  
  /**
   * Handle action for a notification
   * 
   * @param notificationId Notification ID
   * @param actionId Action ID
   * @param data Action data
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
   * @param config Channel configuration
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
   * @param channelType Channel type
   * @returns Promise resolving to success
   */
  enableChannel(channelType: NotificationChannel): Promise<boolean>;
  
  /**
   * Disable a notification channel
   * 
   * @param channelType Channel type
   * @returns Promise resolving to success
   */
  disableChannel(channelType: NotificationChannel): Promise<boolean>;
  
  /**
   * Delete notifications matching filter criteria
   * 
   * @param filter Notification filter
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
   * Shutdown the notification manager
   * 
   * @returns Promise resolving to shutdown success
   */
  shutdown(): Promise<boolean>;
} 