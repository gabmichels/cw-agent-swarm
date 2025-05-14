# Discord Notifications

This document explains how to use Discord notifications with the NotificationManager system.

## Setup

To use Discord notifications, you'll need:

1. A Discord bot token
2. A Discord channel ID

### Creating a Discord Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Navigate to the "Bot" tab and click "Add Bot"
4. Under the TOKEN section, click "Copy" to copy your bot token
5. Set permissions for your bot (at minimum, it needs "Send Messages" permission)
6. Invite the bot to your server using the OAuth2 URL Generator in the OAuth2 tab

### Getting Channel ID

1. Enable Developer Mode in Discord (User Settings > Advanced > Developer Mode)
2. Right-click on the channel you want to send messages to
3. Click "Copy ID" to get the channel ID

## Configuration

Set the following environment variables:

```
DISCORD_BOT_TOKEN=your-bot-token
DISCORD_CHANNEL_ID=your-channel-id
```

## Usage

### Using the NotificationManager

```typescript
import { DefaultNotificationManager } from '../notifications/DefaultNotificationManager';
import { NotificationChannel } from '../notifications/interfaces/NotificationManager.interface';

// Create notification manager
const notificationManager = new DefaultNotificationManager();

// Initialize with Discord channel
await notificationManager.initialize({
  defaultSenderId: 'agent-id',
  channels: [
    {
      type: NotificationChannel.DISCORD,
      name: 'Discord Notifications',
      enabled: true,
      config: {
        token: process.env.DISCORD_BOT_TOKEN,
        channelId: process.env.DISCORD_CHANNEL_ID,
        username: 'Agent Bot', // Optional
        avatarUrl: 'https://example.com/avatar.png' // Optional
      }
    }
  ]
});

// Send a notification
await notificationManager.sendNotification({
  title: 'Task Completed',
  content: 'The automated task has been completed successfully!',
  channels: [NotificationChannel.DISCORD],
  recipientIds: ['discord-user'],
  channelOptions: {
    discord: {
      mention: '@everyone', // Optional mention
    }
  }
});
```

### Using the Utility Function

```typescript
import { notifyDiscord } from '../notifications/utils';

// Send a simple notification
await notifyDiscord('Task completed successfully!');

// Send with type (changes title and priority)
await notifyDiscord('Critical system error detected!', 'error');

// Send with mention
await notifyDiscord('Attention needed!', 'warning', '@here');
```

## Supported Features

- Basic text messages
- Message formatting (bold, italics, etc. using Discord's markdown)
- Mentions (@everyone, @here, or specific users)
- Custom message title
- Priority-based notifications

## Integration with AgentBase

Discord notifications are fully integrated with the AgentBase architecture. 
Any agent can register the NotificationManager and use it to send Discord notifications.

```typescript
class MyAgent extends AbstractAgentBase {
  private notificationManager: NotificationManager;
  
  async initialize(): Promise<boolean> {
    await super.initialize();
    
    // Create and initialize notification manager
    this.notificationManager = new DefaultNotificationManager();
    await this.notificationManager.initialize({
      defaultSenderId: this.getAgentId(),
      channels: [
        {
          type: NotificationChannel.DISCORD,
          name: 'Discord Notifications',
          enabled: true,
          config: {
            token: process.env.DISCORD_BOT_TOKEN,
            channelId: process.env.DISCORD_CHANNEL_ID
          }
        }
      ]
    });
    
    return true;
  }
  
  async notifyDiscord(message: string): Promise<void> {
    await this.notificationManager.sendNotification({
      title: 'Agent Notification',
      content: message,
      channels: [NotificationChannel.DISCORD],
      recipientIds: ['discord']
    });
  }
} 