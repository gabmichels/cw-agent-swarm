# NotificationManager Usage Examples

The NotificationManager provides a standardized interface for sending, receiving, and managing notifications across different channels. This document demonstrates how to integrate and use the NotificationManager in your agent implementations.

## Basic Setup

First, you need to register the NotificationManager with your agent:

```typescript
import { DefaultNotificationManager } from '../notifications/DefaultNotificationManager';
import { NotificationManager, NotificationChannel } from '../notifications/interfaces';

class MyAgent extends AbstractAgentBase {
  private notificationManager: NotificationManager;
  
  constructor(options) {
    super(options);
    
    // Create notification manager
    this.notificationManager = new DefaultNotificationManager();
  }
  
  async initialize() {
    await super.initialize();
    
    // Initialize the notification manager
    await this.notificationManager.initialize({
      defaultSenderId: this.getAgentId(),
      channels: [
        {
          type: NotificationChannel.UI,
          name: 'UI Notifications',
          enabled: true,
          config: {}
        },
        {
          type: NotificationChannel.EMAIL,
          name: 'Email Notifications',
          enabled: false,
          config: {
            smtpServer: 'smtp.example.com',
            defaultFrom: 'agent@example.com'
          }
        }
      ]
    });
  }
  
  async shutdown() {
    await this.notificationManager.shutdown();
    await super.shutdown();
  }
}
```

## Sending Notifications

### Basic Notification

To send a simple notification to a user:

```typescript
await notificationManager.sendNotification({
  title: 'Task Completed',
  content: 'The data analysis task has been completed successfully.',
  recipientIds: ['user123']
});
```

### Notification with Priority

Set the priority to differentiate between notifications:

```typescript
import { NotificationPriority } from '../notifications/interfaces';

await notificationManager.sendNotification({
  title: 'Critical System Alert',
  content: 'The system is running low on disk space. Please take action immediately.',
  priority: NotificationPriority.CRITICAL,
  recipientIds: ['admin']
});
```

### Specifying Channels

Direct a notification to specific channels:

```typescript
import { NotificationChannel } from '../notifications/interfaces';

await notificationManager.sendNotification({
  title: 'Weekly Report',
  content: 'Your weekly performance report is ready.',
  recipientIds: ['user123'],
  channels: [NotificationChannel.EMAIL, NotificationChannel.UI],
  channelOptions: {
    email: {
      subject: 'Weekly Performance Report',
      attachments: [
        {
          filename: 'report.pdf',
          content: reportPdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    }
  }
});
```

### Adding Actions

Create interactive notifications with actions:

```typescript
import { NotificationActionType } from '../notifications/interfaces';

await notificationManager.sendNotification({
  title: 'Approval Request',
  content: 'User "john" is requesting access to the financial data.',
  recipientIds: ['manager'],
  actions: [
    {
      name: 'Approve',
      type: NotificationActionType.BUTTON,
      data: {
        handler: 'approveAccess',
        userId: 'john',
        resource: 'financial-data'
      }
    },
    {
      name: 'Deny',
      type: NotificationActionType.BUTTON,
      data: {
        handler: 'denyAccess',
        userId: 'john',
        resource: 'financial-data'
      }
    }
  ]
});
```

## Handling Notification Actions

Register handlers for notification actions:

```typescript
// Register action handlers during initialization
await notificationManager.registerActionHandler(
  NotificationActionType.BUTTON,
  async (notificationId, actionId, data) => {
    // Get the handler name from the action data
    const handlerName = data.handler as string;
    
    switch (handlerName) {
      case 'approveAccess':
        await this.approveAccess(data.userId as string, data.resource as string);
        // Mark notification as read after handling
        await notificationManager.markAsRead(notificationId);
        break;
        
      case 'denyAccess':
        await this.denyAccess(data.userId as string, data.resource as string);
        // Mark notification as read after handling
        await notificationManager.markAsRead(notificationId);
        break;
        
      default:
        console.warn(`Unknown handler: ${handlerName}`);
    }
  }
);
```

## Querying Notifications

Retrieve notifications using various filters:

```typescript
// Get all unread notifications for a specific user
const unreadNotifications = await notificationManager.getNotifications(
  {
    recipientId: 'user123',
    unreadOnly: true
  },
  10, // Limit to 10 notifications
  0   // Start from the first notification
);

// Get notifications by priority
const criticalNotifications = await notificationManager.getNotifications({
  priority: [NotificationPriority.CRITICAL]
});

// Get notifications by category
const securityNotifications = await notificationManager.getNotifications({
  category: 'security'
});

// Get notifications by time range
const recentNotifications = await notificationManager.getNotifications({
  timeRange: {
    start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    end: new Date()
  }
});
```

## Managing Notification Status

Update notification status:

```typescript
// Mark a specific notification as read
await notificationManager.markAsRead('notification-123');

// Mark all notifications for a user as read
const count = await notificationManager.markAllAsRead('user123');
console.log(`Marked ${count} notifications as read`);

// Get the unread count
const unreadCount = await notificationManager.getUnreadCount('user123');
console.log(`User has ${unreadCount} unread notifications`);
```

## Cleaning Up

Delete old or irrelevant notifications:

```typescript
// Delete all notifications for a user
await notificationManager.deleteNotifications({
  recipientId: 'user123'
});

// Delete notifications by status
await notificationManager.deleteNotifications({
  status: [NotificationStatus.READ]
});

// Delete old notifications
await notificationManager.deleteNotifications({
  timeRange: {
    start: new Date(0),
    end: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Older than 30 days
  }
});
```

## Statistics and Monitoring

Get notification delivery statistics:

```typescript
const stats = await notificationManager.getDeliveryStats();
console.log(`Pending notifications: ${stats[NotificationStatus.PENDING]}`);
console.log(`Delivered notifications: ${stats[NotificationStatus.DELIVERED]}`);
console.log(`Read notifications: ${stats[NotificationStatus.READ]}`);
console.log(`Failed notifications: ${stats[NotificationStatus.FAILED]}`);
```

## Channel Management

Configure notification channels:

```typescript
// Register a new channel
await notificationManager.registerChannel({
  type: NotificationChannel.SLACK,
  name: 'Slack Notifications',
  enabled: true,
  config: {
    webhook: 'https://hooks.slack.com/services/xxx/yyy/zzz',
    defaultChannel: '#notifications'
  }
});

// Enable/disable channels as needed
await notificationManager.disableChannel(NotificationChannel.EMAIL);
await notificationManager.enableChannel(NotificationChannel.SLACK);

// Check available channels
const channels = await notificationManager.getChannels();
console.log('Enabled channels:', channels.filter(c => c.enabled).map(c => c.name));
```

## Best Practices

1. **Prioritize appropriately**: Reserve critical priority for truly important notifications to avoid alert fatigue.

2. **Use categories and tags**: Categorize notifications consistently to help users filter and manage them.

3. **Respect user preferences**: Allow users to configure which notification channels they prefer.

4. **Clean up old notifications**: Implement a retention policy to delete old notifications automatically.

5. **Monitor delivery rates**: Regularly check the delivery statistics to ensure notifications are being delivered properly.

6. **Provide meaningful actions**: When using interactive notifications, make the actions clear and meaningful.

7. **Localize notification content**: Support multiple languages for global users.

## Integration with UI

To display notifications in a UI, you can implement a notification listener that polls for new notifications:

```typescript
class NotificationUIController {
  private lastChecked: Date = new Date(0);
  
  constructor(private notificationManager: NotificationManager) {
    this.startPolling();
  }
  
  private startPolling() {
    setInterval(() => this.checkForNewNotifications(), 5000); // Check every 5 seconds
  }
  
  private async checkForNewNotifications() {
    const now = new Date();
    
    const newNotifications = await this.notificationManager.getNotifications({
      status: [NotificationStatus.DELIVERED],
      timeRange: {
        start: this.lastChecked,
        end: now
      }
    });
    
    this.lastChecked = now;
    
    if (newNotifications.length > 0) {
      this.displayNotifications(newNotifications);
    }
  }
  
  private displayNotifications(notifications: Notification[]) {
    // This would integrate with your UI framework
    // For example, using a toast notification system
    notifications.forEach(notification => {
      this.showToast(notification);
    });
  }
  
  private showToast(notification: Notification) {
    // Integration with UI toast system
    console.log(`Showing toast: ${notification.title}`);
  }
}
```

## Conclusion

The NotificationManager provides a flexible and powerful way to handle notifications in your agent ecosystem. By leveraging its various features, you can create a rich notification experience that keeps users informed and engaged. 