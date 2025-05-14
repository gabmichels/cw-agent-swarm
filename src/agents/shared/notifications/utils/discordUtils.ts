/**
 * Discord notification utilities
 * 
 * This file provides utility functions for sending Discord notifications
 * using the NotificationManager system.
 */

import { DefaultNotificationManager } from '../DefaultNotificationManager';
import { NotificationChannel, NotificationPriority } from '../interfaces/NotificationManager.interface';

// Cached instance of notification manager
let discordNotifier: DefaultNotificationManager | null = null;

/**
 * Get Discord notification manager instance
 * 
 * @param token Discord bot token
 * @param channelId Discord channel ID
 * @returns Promise resolving to notification manager
 */
async function getDiscordNotifier(
  token: string,
  channelId: string
): Promise<DefaultNotificationManager> {
  if (discordNotifier) {
    return discordNotifier;
  }
  
  // Create new instance
  discordNotifier = new DefaultNotificationManager();
  
  // Initialize with Discord channel
  await discordNotifier.initialize({
    defaultSenderId: 'system',
    channels: [
      {
        type: NotificationChannel.DISCORD,
        name: 'Discord Notifications',
        enabled: true,
        config: {
          token,
          channelId
        }
      }
    ]
  });
  
  return discordNotifier;
}

/**
 * Send a notification to Discord
 * 
 * This is a replacement for the old notifyDiscord function
 * 
 * @param message Message to send
 * @param type Message type (will be used as title)
 * @param mention Optional mention string
 * @returns Promise resolving to success
 */
export async function notifyDiscord(
  message: string,
  type: string = 'info',
  mention?: string
): Promise<boolean> {
  try {
    // Get token and channel ID from environment
    const token = process.env.DISCORD_BOT_TOKEN;
    const channelId = process.env.DISCORD_CHANNEL_ID;
    
    if (!token || !channelId) {
      console.error('Discord notification failed: DISCORD_BOT_TOKEN or DISCORD_CHANNEL_ID not set');
      return false;
    }
    
    // Get notifier instance
    const notifier = await getDiscordNotifier(token, channelId);
    
    // Map type to priority
    let priority = NotificationPriority.MEDIUM;
    
    switch (type.toLowerCase()) {
      case 'critical':
      case 'error':
        priority = NotificationPriority.CRITICAL;
        break;
      case 'warning':
        priority = NotificationPriority.HIGH;
        break;
      case 'info':
        priority = NotificationPriority.MEDIUM;
        break;
      case 'debug':
      case 'verbose':
        priority = NotificationPriority.LOW;
        break;
    }
    
    // Send notification
    const notificationId = await notifier.sendNotification({
      title: type.toUpperCase(),
      content: message,
      priority,
      channels: [NotificationChannel.DISCORD],
      recipientIds: ['discord'],
      channelOptions: {
        discord: {
          mention
        }
      }
    });
    
    // Get notification to check status
    const notification = await notifier.getNotification(notificationId);
    
    return notification?.status === 'delivered';
  } catch (error) {
    console.error('Error sending Discord notification:', error);
    return false;
  }
} 