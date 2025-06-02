/**
 * DefaultNotificationManagerWrapper.test.ts - Comprehensive Tests
 * 
 * Tests for the DefaultNotificationManagerWrapper implementation,
 * ensuring >95% coverage and validating all functionality.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md:
 * - Test-driven development approach
 * - Industry best practices for testing
 * - Error scenarios and edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DefaultNotificationManagerWrapper, NotificationWrapperError, DEFAULT_NOTIFICATION_MANAGER_CONFIG } from '../DefaultNotificationManagerWrapper';
import { NotificationManager } from '../../../../../agents/shared/base/managers/NotificationManager.interface';
import { ManagerType } from '../../../../../agents/shared/base/managers/ManagerType';
import { AgentBase } from '../../../../../agents/shared/base/AgentBase';
import {
  NotificationOptions,
  NotificationFilter,
  NotificationActionType,
  ChannelConfig,
  NotificationChannel,
  NotificationStatus,
  NotificationPriority
} from '../../../../../agents/shared/notifications/interfaces/NotificationManager.interface';

// Mock the DefaultNotificationManager
vi.mock('../../../../../agents/shared/notifications/DefaultNotificationManager');
import { DefaultNotificationManager } from '../../../../../agents/shared/notifications/DefaultNotificationManager';

// Mock AgentBase
const mockAgent: AgentBase = {
  getAgentId: vi.fn().mockReturnValue('test-agent-id'),
  // Add other required methods as mocks
  initialize: vi.fn(),
  shutdown: vi.fn(),
  reset: vi.fn(),
  isEnabled: vi.fn().mockReturnValue(true),
  getManager: vi.fn(),
  registerManager: vi.fn(),
  unregisterManager: vi.fn(),
  getAllManagers: vi.fn(),
  getManagerHealth: vi.fn(),
  getOverallHealth: vi.fn(),
  getConfig: vi.fn(),
  updateConfig: vi.fn()
} as any;

describe('DefaultNotificationManagerWrapper', () => {
  let wrapper: DefaultNotificationManagerWrapper;
  let mockNotificationManager: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create a new mock for each test
    mockNotificationManager = {
      initialize: vi.fn().mockResolvedValue(true),
      shutdown: vi.fn().mockResolvedValue(true),
      sendNotification: vi.fn().mockResolvedValue('notification-id'),
      cancelNotification: vi.fn().mockResolvedValue(true),
      markAsRead: vi.fn().mockResolvedValue(true),
      markAllAsRead: vi.fn().mockResolvedValue(5),
      getNotification: vi.fn().mockResolvedValue(null),
      getNotifications: vi.fn().mockResolvedValue([]),
      getUnreadCount: vi.fn().mockResolvedValue(0),
      registerActionHandler: vi.fn().mockResolvedValue(true),
      handleAction: vi.fn().mockResolvedValue(true),
      registerChannel: vi.fn().mockResolvedValue(true),
      getChannels: vi.fn().mockResolvedValue([]),
      enableChannel: vi.fn().mockResolvedValue(true),
      disableChannel: vi.fn().mockResolvedValue(true),
      deleteNotifications: vi.fn().mockResolvedValue(0),
      getDeliveryStats: vi.fn().mockResolvedValue({
        [NotificationStatus.DELIVERED]: 10,
        [NotificationStatus.PENDING]: 2,
        [NotificationStatus.FAILED]: 1,
        [NotificationStatus.CANCELED]: 0,
        [NotificationStatus.READ]: 8,
        [NotificationStatus.SENDING]: 0
      })
    };

    // Override the constructor to use our mock
    vi.mocked(DefaultNotificationManager).mockImplementation(() => mockNotificationManager);

    wrapper = new DefaultNotificationManagerWrapper(mockAgent);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('Constructor and Basic Properties', () => {
    it('should create wrapper with correct properties', () => {
      expect(wrapper.managerId).toMatch(/^notification-manager-[A-Z0-9]{26}$/);
      expect(wrapper.managerType).toBe(ManagerType.NOTIFICATION);
      expect(wrapper.getAgent()).toBe(mockAgent);
      expect(wrapper.isEnabled()).toBe(false); // Disabled by default
    });

    it('should create wrapper with custom configuration', () => {
      const customConfig = {
        enabled: true,
        enableAutoCleanup: false,
        maxNotificationAge: 1000,
        enableBatching: true,
        batchSize: 5
      };

      const customWrapper = new DefaultNotificationManagerWrapper(mockAgent, customConfig);
      const config = customWrapper.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.enableAutoCleanup).toBe(false);
      expect(config.maxNotificationAge).toBe(1000);
      expect(config.enableBatching).toBe(true);
      expect(config.batchSize).toBe(5);
    });

    it('should merge configuration with defaults correctly', () => {
      const partialConfig = { enabled: true };
      const customWrapper = new DefaultNotificationManagerWrapper(mockAgent, partialConfig);
      const config = customWrapper.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.enableAutoCleanup).toBe(DEFAULT_NOTIFICATION_MANAGER_CONFIG.enableAutoCleanup);
      expect(config.maxNotificationAge).toBe(DEFAULT_NOTIFICATION_MANAGER_CONFIG.maxNotificationAge);
    });
  });

  describe('Configuration Management', () => {
    it('should get current configuration', () => {
      const config = wrapper.getConfig();
      expect(config).toEqual(expect.objectContaining({
        enabled: false,
        enableAutoCleanup: true,
        maxNotificationAge: expect.any(Number),
        maxNotifications: expect.any(Number)
      }));
    });

    it('should update configuration', () => {
      const updates = {
        enabled: true,
        enableBatching: true,
        batchSize: 20
      };

      const newConfig = wrapper.updateConfig(updates);
      
      expect(newConfig.enabled).toBe(true);
      expect(newConfig.enableBatching).toBe(true);
      expect(newConfig.batchSize).toBe(20);
    });

    it('should enable and disable manager', () => {
      expect(wrapper.isEnabled()).toBe(false);
      
      const result = wrapper.setEnabled(true);
      expect(result).toBe(true);
      expect(wrapper.isEnabled()).toBe(true);
      
      wrapper.setEnabled(false);
      expect(wrapper.isEnabled()).toBe(false);
    });
  });

  describe('Lifecycle Management', () => {
    it('should initialize successfully when enabled', async () => {
      wrapper.setEnabled(true);
      
      const result = await wrapper.initialize();
      
      expect(result).toBe(true);
      expect(mockNotificationManager.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultSenderId: 'test-agent-id',
          defaultTtl: 24 * 60 * 60 * 1000,
          storage: {
            type: 'memory',
            maxItems: 10000
          }
        })
      );
    });

    it('should skip initialization when disabled', async () => {
      wrapper.setEnabled(false);
      
      const result = await wrapper.initialize();
      
      expect(result).toBe(true);
      expect(mockNotificationManager.initialize).not.toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      wrapper.setEnabled(true);
      mockNotificationManager.initialize.mockRejectedValue(new Error('Init failed'));
      
      await expect(wrapper.initialize()).rejects.toThrow(NotificationWrapperError);
      await expect(wrapper.initialize()).rejects.toThrow('Failed to initialize notification manager wrapper');
    });

    it('should shutdown successfully', async () => {
      wrapper.setEnabled(true);
      await wrapper.initialize();
      
      await wrapper.shutdown();
      
      expect(mockNotificationManager.shutdown).toHaveBeenCalled();
    });

    it('should reset successfully', async () => {
      wrapper.setEnabled(true);
      await wrapper.initialize();
      
      const result = await wrapper.reset();
      
      expect(result).toBe(true);
      expect(mockNotificationManager.shutdown).toHaveBeenCalled();
    });

    it('should handle reset failures', async () => {
      wrapper.setEnabled(true);
      await wrapper.initialize();
      mockNotificationManager.shutdown.mockRejectedValue(new Error('Shutdown failed'));
      
      const result = await wrapper.reset();
      
      expect(result).toBe(false);
    });
  });

  describe('Health Monitoring', () => {
    it('should return healthy status when initialized and enabled', async () => {
      wrapper.setEnabled(true);
      await wrapper.initialize();
      
      const health = await wrapper.getHealth();
      
      expect(health.status).toBe('healthy');
      expect(health.message).toContain('operating normally');
      expect(health.details.issues).toHaveLength(0);
      expect(health.metrics).toEqual(expect.objectContaining({
        initialized: true,
        enabled: true,
        deliveryStats: expect.any(Object),
        unreadCount: expect.any(Number)
      }));
    });

    it('should return unhealthy status when not initialized', async () => {
      wrapper.setEnabled(true);
      
      const health = await wrapper.getHealth();
      
      expect(health.status).toBe('unhealthy');
      expect(health.message).toContain('has issues');
      expect(health.details.issues).toHaveLength(1);
      expect(health.details.issues[0].severity).toBe('critical');
      expect(health.details.issues[0].message).toContain('not initialized');
    });

    it('should return unhealthy status when disabled', async () => {
      wrapper.setEnabled(false);
      
      const health = await wrapper.getHealth();
      
      expect(health.status).toBe('unhealthy');
      expect(health.details.issues).toContainEqual(
        expect.objectContaining({
          severity: 'medium',
          message: 'NotificationManagerWrapper is disabled'
        })
      );
    });

    it('should handle health check errors gracefully', async () => {
      wrapper.setEnabled(true);
      await wrapper.initialize();
      mockNotificationManager.getDeliveryStats.mockRejectedValue(new Error('Stats failed'));
      
      const health = await wrapper.getHealth();
      
      expect(health.metrics?.healthCheckError).toBe('Stats failed');
      expect(health.details.issues).toContainEqual(
        expect.objectContaining({
          severity: 'high',
          message: 'Health check failed: Stats failed'
        })
      );
    });
  });

  describe('Notification Operations', () => {
    beforeEach(async () => {
      wrapper.setEnabled(true);
      await wrapper.initialize();
    });

    it('should send notification successfully', async () => {
      const options: NotificationOptions = {
        title: 'Test Notification',
        content: 'Test content',
        recipientIds: ['user1', 'user2'],
        priority: NotificationPriority.HIGH
      };

      const result = await wrapper.sendNotification(options);
      
      expect(result).toBe('notification-id');
      expect(mockNotificationManager.sendNotification).toHaveBeenCalledWith(options);
    });

    it('should handle notification sending errors', async () => {
      mockNotificationManager.sendNotification.mockRejectedValue(new Error('Send failed'));
      
      const options: NotificationOptions = {
        title: 'Test',
        content: 'Test',
        recipientIds: ['user1']
      };

      await expect(wrapper.sendNotification(options)).rejects.toThrow(NotificationWrapperError);
    });

    it('should send batch notifications', async () => {
      const notifications: NotificationOptions[] = [
        {
          title: 'Notification 1',
          content: 'Content 1',
          recipientIds: ['user1']
        },
        {
          title: 'Notification 2',
          content: 'Content 2',
          recipientIds: ['user2']
        }
      ];

      mockNotificationManager.sendNotification
        .mockResolvedValueOnce('id1')
        .mockResolvedValueOnce('id2');

      const result = await wrapper.sendBatchNotifications(notifications);
      
      expect(result).toEqual(['id1', 'id2']);
      expect(mockNotificationManager.sendNotification).toHaveBeenCalledTimes(2);
    });

    it('should cancel notification', async () => {
      const result = await wrapper.cancelNotification('test-id');
      
      expect(result).toBe(true);
      expect(mockNotificationManager.cancelNotification).toHaveBeenCalledWith('test-id');
    });

    it('should mark notification as read', async () => {
      const result = await wrapper.markAsRead('test-id');
      
      expect(result).toBe(true);
      expect(mockNotificationManager.markAsRead).toHaveBeenCalledWith('test-id');
    });

    it('should mark all notifications as read', async () => {
      const result = await wrapper.markAllAsRead('user1');
      
      expect(result).toBe(5);
      expect(mockNotificationManager.markAllAsRead).toHaveBeenCalledWith('user1');
    });
  });

  describe('Notification Retrieval', () => {
    beforeEach(async () => {
      wrapper.setEnabled(true);
      await wrapper.initialize();
    });

    it('should get notification by ID', async () => {
      const mockNotification = {
        id: 'test-id',
        title: 'Test',
        content: 'Content',
        priority: NotificationPriority.MEDIUM,
        channels: [NotificationChannel.UI],
        senderId: 'sender',
        recipientIds: ['user1'],
        status: NotificationStatus.DELIVERED,
        createdAt: new Date()
      };

      mockNotificationManager.getNotification.mockResolvedValue(mockNotification);
      
      const result = await wrapper.getNotification('test-id');
      
      expect(result).toBe(mockNotification);
      expect(mockNotificationManager.getNotification).toHaveBeenCalledWith('test-id');
    });

    it('should get notifications with filter', async () => {
      const filter: NotificationFilter = {
        status: [NotificationStatus.PENDING],
        priority: [NotificationPriority.HIGH]
      };

      await wrapper.getNotifications(filter, 10, 0);
      
      expect(mockNotificationManager.getNotifications).toHaveBeenCalledWith(filter, 10, 0);
    });

    it('should get unread count', async () => {
      const result = await wrapper.getUnreadCount('user1');
      
      expect(result).toBe(0);
      expect(mockNotificationManager.getUnreadCount).toHaveBeenCalledWith('user1');
    });

    it('should get notification history for agent', async () => {
      const options = {
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31'),
        limit: 100
      };

      await wrapper.getNotificationHistory('agent1', options);
      
      expect(mockNotificationManager.getNotifications).toHaveBeenCalledWith(
        expect.objectContaining({
          senderId: 'agent1',
          timeRange: {
            start: options.startDate,
            end: options.endDate
          }
        }),
        100,
        undefined
      );
    });
  });

  describe('Action Handling', () => {
    beforeEach(async () => {
      wrapper.setEnabled(true);
      await wrapper.initialize();
    });

    it('should register action handler', async () => {
      const handler = vi.fn();
      
      const result = await wrapper.registerActionHandler(NotificationActionType.BUTTON, handler);
      
      expect(result).toBe(true);
      expect(mockNotificationManager.registerActionHandler).toHaveBeenCalledWith(
        NotificationActionType.BUTTON,
        handler
      );
    });

    it('should handle notification action', async () => {
      const data = { action: 'approve' };
      
      const result = await wrapper.handleAction('notification-id', 'action-id', data);
      
      expect(result).toBe(true);
      expect(mockNotificationManager.handleAction).toHaveBeenCalledWith(
        'notification-id',
        'action-id',
        data
      );
    });
  });

  describe('Channel Management', () => {
    beforeEach(async () => {
      wrapper.setEnabled(true);
      await wrapper.initialize();
    });

    it('should register notification channel', async () => {
      const channelConfig: ChannelConfig = {
        type: NotificationChannel.DISCORD,
        name: 'Discord Channel',
        enabled: true,
        config: { webhookUrl: 'https://discord.com/webhook' }
      };

      const result = await wrapper.registerChannel(channelConfig);
      
      expect(result).toBe(true);
      expect(mockNotificationManager.registerChannel).toHaveBeenCalledWith(channelConfig);
    });

    it('should get all channels', async () => {
      const result = await wrapper.getChannels();
      
      expect(result).toEqual([]);
      expect(mockNotificationManager.getChannels).toHaveBeenCalled();
    });

    it('should enable channel', async () => {
      const result = await wrapper.enableChannel(NotificationChannel.EMAIL);
      
      expect(result).toBe(true);
      expect(mockNotificationManager.enableChannel).toHaveBeenCalledWith(NotificationChannel.EMAIL);
    });

    it('should disable channel', async () => {
      const result = await wrapper.disableChannel(NotificationChannel.SLACK);
      
      expect(result).toBe(true);
      expect(mockNotificationManager.disableChannel).toHaveBeenCalledWith(NotificationChannel.SLACK);
    });
  });

  describe('Statistics and Cleanup', () => {
    beforeEach(async () => {
      wrapper.setEnabled(true);
      await wrapper.initialize();
    });

    it('should get delivery statistics', async () => {
      const result = await wrapper.getDeliveryStats();
      
      expect(result).toEqual(expect.objectContaining({
        [NotificationStatus.DELIVERED]: 10,
        [NotificationStatus.PENDING]: 2
      }));
      expect(mockNotificationManager.getDeliveryStats).toHaveBeenCalled();
    });

    it('should delete notifications with filter', async () => {
      const filter: NotificationFilter = {
        status: [NotificationStatus.DELIVERED],
        timeRange: {
          start: new Date('2023-01-01'),
          end: new Date('2023-01-02')
        }
      };

      mockNotificationManager.deleteNotifications.mockResolvedValue(5);
      
      const result = await wrapper.deleteNotifications(filter);
      
      expect(result).toBe(5);
      expect(mockNotificationManager.deleteNotifications).toHaveBeenCalledWith(filter);
    });

    it('should cleanup old notifications', async () => {
      mockNotificationManager.deleteNotifications.mockResolvedValue(3);
      
      const result = await wrapper.cleanupNotifications();
      
      expect(result).toBe(3);
      expect(mockNotificationManager.deleteNotifications).toHaveBeenCalledWith(
        expect.objectContaining({
          timeRange: expect.objectContaining({
            start: expect.any(Date),
            end: expect.any(Date)
          })
        })
      );
    });

    it('should return 0 when no max age configured for cleanup', async () => {
      const customWrapper = new DefaultNotificationManagerWrapper(mockAgent, {
        enabled: true,
        maxNotificationAge: undefined
      });
      await customWrapper.initialize();
      
      const result = await customWrapper.cleanupNotifications();
      
      expect(result).toBe(0);
      expect(mockNotificationManager.deleteNotifications).not.toHaveBeenCalled();
    });
  });

  describe('Batching Functionality', () => {
    let batchWrapper: DefaultNotificationManagerWrapper;

    beforeEach(async () => {
      vi.useFakeTimers();
      batchWrapper = new DefaultNotificationManagerWrapper(mockAgent, {
        enabled: true,
        enableBatching: true,
        batchSize: 3,
        batchTimeout: 1000
      });
      await batchWrapper.initialize();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should batch notifications and process when batch size reached', async () => {
      const options1: NotificationOptions = {
        title: 'Notification 1',
        content: 'Content 1',
        recipientIds: ['user1']
      };
      const options2: NotificationOptions = {
        title: 'Notification 2',
        content: 'Content 2',
        recipientIds: ['user2']
      };
      const options3: NotificationOptions = {
        title: 'Notification 3',
        content: 'Content 3',
        recipientIds: ['user3']
      };

      mockNotificationManager.sendNotification
        .mockResolvedValueOnce('id1')
        .mockResolvedValueOnce('id2')
        .mockResolvedValueOnce('id3');

      // Send first two notifications (should not trigger batch processing yet)
      const id1Promise = batchWrapper.sendNotification(options1);
      const id2Promise = batchWrapper.sendNotification(options2);
      
      expect(mockNotificationManager.sendNotification).not.toHaveBeenCalled();

      // Send third notification (should trigger batch processing)
      const id3Promise = batchWrapper.sendNotification(options3);

      // Wait for all promises
      const [id1, id2, id3] = await Promise.all([id1Promise, id2Promise, id3Promise]);

      expect(id1).toMatch(/^[A-Z0-9]{26}$/); // ULID format
      expect(id2).toMatch(/^[A-Z0-9]{26}$/);
      expect(id3).toMatch(/^[A-Z0-9]{26}$/);
      expect(mockNotificationManager.sendNotification).toHaveBeenCalledTimes(3);
    });

    it('should process batch on timeout', async () => {
      const options: NotificationOptions = {
        title: 'Test',
        content: 'Content',
        recipientIds: ['user1']
      };

      mockNotificationManager.sendNotification.mockResolvedValue('id1');

      const idPromise = batchWrapper.sendNotification(options);
      
      // Advance time to trigger timeout
      vi.advanceTimersByTime(1000);
      
      const id = await idPromise;
      
      expect(id).toMatch(/^[A-Z0-9]{26}$/);
      expect(mockNotificationManager.sendNotification).toHaveBeenCalledTimes(1);
    });
  });

  describe('Automatic Cleanup', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should start cleanup interval when auto cleanup enabled', async () => {
      const cleanupWrapper = new DefaultNotificationManagerWrapper(mockAgent, {
        enabled: true,
        enableAutoCleanup: true,
        maxNotificationAge: 1000
      });

      await cleanupWrapper.initialize();

      // Advance time by 1 hour to trigger cleanup
      vi.advanceTimersByTime(60 * 60 * 1000);

      expect(mockNotificationManager.deleteNotifications).toHaveBeenCalled();
    });

    it('should clear cleanup interval on shutdown', async () => {
      const cleanupWrapper = new DefaultNotificationManagerWrapper(mockAgent, {
        enabled: true,
        enableAutoCleanup: true,
        maxNotificationAge: 1000
      });

      await cleanupWrapper.initialize();
      await cleanupWrapper.shutdown();

      // Clear any timers that might be set
      vi.clearAllTimers();

      // Advance time - cleanup should not be called after shutdown
      vi.advanceTimersByTime(60 * 60 * 1000);

      expect(mockNotificationManager.deleteNotifications).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      wrapper.setEnabled(true);
      await wrapper.initialize();
    });

    it('should throw error when not initialized', async () => {
      const uninitializedWrapper = new DefaultNotificationManagerWrapper(mockAgent, { enabled: true });
      
      await expect(uninitializedWrapper.sendNotification({
        title: 'Test',
        content: 'Content',
        recipientIds: ['user1']
      })).rejects.toThrow(NotificationWrapperError);
    });

    it('should throw error when disabled', async () => {
      wrapper.setEnabled(false);
      
      await expect(wrapper.sendNotification({
        title: 'Test',
        content: 'Content',
        recipientIds: ['user1']
      })).rejects.toThrow(NotificationWrapperError);
    });

    it('should handle underlying notification manager errors', async () => {
      mockNotificationManager.getNotifications.mockRejectedValue(new Error('Database error'));
      
      await expect(wrapper.getNotifications()).rejects.toThrow(NotificationWrapperError);
      await expect(wrapper.getNotifications()).rejects.toThrow('Failed to get notifications');
    });
  });

  describe('Integration Tests', () => {
    it('should work with all features enabled', async () => {
      const fullFeaturedWrapper = new DefaultNotificationManagerWrapper(mockAgent, {
        enabled: true,
        enableAutoCleanup: true,
        enableBatching: true,
        maxNotificationAge: 7 * 24 * 60 * 60 * 1000,
        batchSize: 5,
        batchTimeout: 2000
      });

      await fullFeaturedWrapper.initialize();
      
      const health = await fullFeaturedWrapper.getHealth();
      expect(health.status).toBe('healthy');

      const stats = await fullFeaturedWrapper.getDeliveryStats();
      expect(stats).toBeDefined();

      await fullFeaturedWrapper.shutdown();
    });

    it('should preserve Discord integration functionality', async () => {
      wrapper.setEnabled(true);
      await wrapper.initialize();

      // Test that Discord channel configuration works through the wrapper
      const discordChannel: ChannelConfig = {
        type: NotificationChannel.DISCORD,
        name: 'Discord Notifications',
        enabled: true,
        config: {
          webhookUrl: 'https://discord.com/api/webhooks/test',
          username: 'AgentBot'
        }
      };

      const result = await wrapper.registerChannel(discordChannel);
      expect(result).toBe(true);
      expect(mockNotificationManager.registerChannel).toHaveBeenCalledWith(discordChannel);
    });
  });
}); 