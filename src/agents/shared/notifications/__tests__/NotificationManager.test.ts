/**
 * NotificationManager Tests
 * 
 * Tests to verify the NotificationManager interface and DefaultNotificationManager implementation.
 */

import { DefaultNotificationManager } from '../DefaultNotificationManager';
import {
  NotificationManager,
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  NotificationActionType
} from '../interfaces/NotificationManager.interface';

describe('NotificationManager Interface', () => {
  let notificationManager: NotificationManager;
  
  beforeEach(async () => {
    notificationManager = new DefaultNotificationManager();
    await notificationManager.initialize({
      defaultSenderId: 'test-system'
    });
  });
  
  afterEach(async () => {
    await notificationManager.shutdown();
  });
  
  test('should initialize with default configuration', async () => {
    const channels = await notificationManager.getChannels();
    
    expect(channels).toBeDefined();
    expect(channels.length).toBeGreaterThan(0);
    expect(channels[0].type).toBe(NotificationChannel.UI);
    expect(channels[0].enabled).toBe(true);
  });
  
  test('should send a notification', async () => {
    const notificationId = await notificationManager.sendNotification({
      title: 'Test Notification',
      content: 'This is a test notification',
      recipientIds: ['user1']
    });
    
    expect(notificationId).toBeDefined();
    
    const notification = await notificationManager.getNotification(notificationId);
    expect(notification).toBeDefined();
    expect(notification?.title).toBe('Test Notification');
    expect(notification?.content).toBe('This is a test notification');
    expect(notification?.recipientIds).toContain('user1');
    expect(notification?.priority).toBe(NotificationPriority.MEDIUM); // Default priority
    
    // Wait for the simulated delivery to complete
    await new Promise((resolve) => setTimeout(resolve, 200));
    
    const deliveredNotification = await notificationManager.getNotification(notificationId);
    expect(deliveredNotification?.status).toBe(NotificationStatus.DELIVERED);
  });
  
  test('should mark notification as read', async () => {
    const notificationId = await notificationManager.sendNotification({
      title: 'Test Notification',
      content: 'This is a test notification',
      recipientIds: ['user1']
    });
    
    // Wait for delivery
    await new Promise((resolve) => setTimeout(resolve, 200));
    
    const success = await notificationManager.markAsRead(notificationId);
    expect(success).toBe(true);
    
    const notification = await notificationManager.getNotification(notificationId);
    expect(notification?.status).toBe(NotificationStatus.READ);
    expect(notification?.readAt).toBeDefined();
  });
  
  test('should get notifications with filters', async () => {
    // Create multiple notifications
    await notificationManager.sendNotification({
      title: 'High Priority',
      content: 'This is important',
      priority: NotificationPriority.HIGH,
      recipientIds: ['user1'],
      tags: ['important']
    });
    
    await notificationManager.sendNotification({
      title: 'Low Priority',
      content: 'This is not important',
      priority: NotificationPriority.LOW,
      recipientIds: ['user2'],
      tags: ['not-important']
    });
    
    await notificationManager.sendNotification({
      title: 'Medium Priority for User1',
      content: 'This is for user1',
      priority: NotificationPriority.MEDIUM,
      recipientIds: ['user1'],
      tags: ['user1-specific']
    });
    
    // Wait for delivery
    await new Promise((resolve) => setTimeout(resolve, 200));
    
    // Filter by priority
    const highPriorityNotifications = await notificationManager.getNotifications({
      priority: [NotificationPriority.HIGH]
    });
    
    expect(highPriorityNotifications.length).toBe(1);
    expect(highPriorityNotifications[0].title).toBe('High Priority');
    
    // Filter by recipient
    const user1Notifications = await notificationManager.getNotifications({
      recipientId: 'user1'
    });
    
    expect(user1Notifications.length).toBe(2);
    
    // Filter by tags
    const importantNotifications = await notificationManager.getNotifications({
      tags: ['important']
    });
    
    expect(importantNotifications.length).toBe(1);
    expect(importantNotifications[0].title).toBe('High Priority');
  });
  
  test('should get unread notification count', async () => {
    // Create multiple notifications
    await notificationManager.sendNotification({
      title: 'For User 1',
      content: 'This is for user1',
      recipientIds: ['user1']
    });
    
    await notificationManager.sendNotification({
      title: 'For User 2',
      content: 'This is for user2',
      recipientIds: ['user2']
    });
    
    await notificationManager.sendNotification({
      title: 'Also For User 1',
      content: 'This is also for user1',
      recipientIds: ['user1']
    });
    
    // Wait for delivery
    await new Promise((resolve) => setTimeout(resolve, 200));
    
    // Get unread count for user1
    const user1Count = await notificationManager.getUnreadCount('user1');
    expect(user1Count).toBe(2);
    
    // Get unread count for user2
    const user2Count = await notificationManager.getUnreadCount('user2');
    expect(user2Count).toBe(1);
    
    // Get total unread count
    const totalCount = await notificationManager.getUnreadCount();
    expect(totalCount).toBe(3);
  });
  
  test('should register and handle notification actions', async () => {
    let actionHandled = false;
    let receivedData: Record<string, unknown> = {};
    
    // Register action handler
    await notificationManager.registerActionHandler(
      NotificationActionType.BUTTON,
      async (_notificationId, _actionId, data) => {
        actionHandled = true;
        receivedData = data;
      }
    );
    
    // Send notification with action
    const notificationId = await notificationManager.sendNotification({
      title: 'Interactive Notification',
      content: 'This notification has an action',
      recipientIds: ['user1'],
      actions: [{
        name: 'Accept',
        type: NotificationActionType.BUTTON,
        data: {
          handler: 'acceptHandler'
        }
      }]
    });
    
    // Wait for delivery
    await new Promise((resolve) => setTimeout(resolve, 200));
    
    // Get the notification
    const notification = await notificationManager.getNotification(notificationId);
    expect(notification).toBeDefined();
    expect(notification?.actions).toBeDefined();
    expect(notification?.actions?.length).toBe(1);
    
    // Get the action ID
    const actionId = notification!.actions![0].id;
    
    // Handle the action
    const result = await notificationManager.handleAction(
      notificationId,
      actionId,
      { user: 'user1', approved: true }
    );
    
    expect(result).toBe(true);
    expect(actionHandled).toBe(true);
    expect(receivedData).toBeDefined();
    expect(receivedData.user).toBe('user1');
    expect(receivedData.approved).toBe(true);
  });
  
  test('should mark all notifications as read', async () => {
    // Create notifications for different users
    await notificationManager.sendNotification({
      title: 'For User 1',
      content: 'This is for user1',
      recipientIds: ['user1']
    });
    
    await notificationManager.sendNotification({
      title: 'For User 2',
      content: 'This is for user2',
      recipientIds: ['user2']
    });
    
    await notificationManager.sendNotification({
      title: 'Also For User 1',
      content: 'This is also for user1',
      recipientIds: ['user1']
    });
    
    // Wait for delivery
    await new Promise((resolve) => setTimeout(resolve, 200));
    
    // Mark all notifications for user1 as read
    const markedCount = await notificationManager.markAllAsRead('user1');
    expect(markedCount).toBe(2);
    
    // Check unread counts
    const user1Count = await notificationManager.getUnreadCount('user1');
    expect(user1Count).toBe(0);
    
    const user2Count = await notificationManager.getUnreadCount('user2');
    expect(user2Count).toBe(1);
  });
  
  test('should delete notifications by filter', async () => {
    // Create notifications with different priorities
    await notificationManager.sendNotification({
      title: 'High Priority',
      content: 'This is important',
      priority: NotificationPriority.HIGH,
      recipientIds: ['user1']
    });
    
    await notificationManager.sendNotification({
      title: 'Low Priority',
      content: 'This is not important',
      priority: NotificationPriority.LOW,
      recipientIds: ['user1']
    });
    
    // Wait for delivery
    await new Promise((resolve) => setTimeout(resolve, 200));
    
    // Check total count
    const allNotifications = await notificationManager.getNotifications();
    expect(allNotifications.length).toBe(2);
    
    // Delete low priority notifications
    const deletedCount = await notificationManager.deleteNotifications({
      priority: [NotificationPriority.LOW]
    });
    
    expect(deletedCount).toBe(1);
    
    // Check remaining notifications
    const remainingNotifications = await notificationManager.getNotifications();
    expect(remainingNotifications.length).toBe(1);
    expect(remainingNotifications[0].priority).toBe(NotificationPriority.HIGH);
  });
  
  test('should get delivery statistics', async () => {
    // Create a notification
    const notificationId = await notificationManager.sendNotification({
      title: 'Test Statistics',
      content: 'Testing delivery statistics',
      recipientIds: ['user1']
    });
    
    // Wait for delivery
    await new Promise((resolve) => setTimeout(resolve, 200));
    
    // Mark it as read
    await notificationManager.markAsRead(notificationId);
    
    // Get statistics
    const stats = await notificationManager.getDeliveryStats();
    
    expect(stats).toBeDefined();
    expect(stats[NotificationStatus.READ]).toBe(1);
    expect(stats[NotificationStatus.PENDING]).toBe(0);
    expect(stats[NotificationStatus.DELIVERED]).toBe(0);
  });
  
  test('should register, enable, and disable channels', async () => {
    // Register a new channel
    await notificationManager.registerChannel({
      type: NotificationChannel.EMAIL,
      name: 'Email Notifications',
      enabled: false,
      config: {
        server: 'smtp.example.com'
      }
    });
    
    // Get all channels
    const channels = await notificationManager.getChannels();
    expect(channels.length).toBe(2); // UI (default) + EMAIL
    
    const emailChannel = channels.find(c => c.type === NotificationChannel.EMAIL);
    expect(emailChannel).toBeDefined();
    expect(emailChannel?.enabled).toBe(false);
    
    // Enable the channel
    await notificationManager.enableChannel(NotificationChannel.EMAIL);
    
    // Get updated channels
    const updatedChannels = await notificationManager.getChannels();
    const updatedEmailChannel = updatedChannels.find(c => c.type === NotificationChannel.EMAIL);
    expect(updatedEmailChannel?.enabled).toBe(true);
    
    // Disable the channel
    await notificationManager.disableChannel(NotificationChannel.EMAIL);
    
    // Get updated channels again
    const finalChannels = await notificationManager.getChannels();
    const finalEmailChannel = finalChannels.find(c => c.type === NotificationChannel.EMAIL);
    expect(finalEmailChannel?.enabled).toBe(false);
  });
}); 