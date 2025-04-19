# Discord Notification System

This module provides functionality for sending notifications to users via Discord, either through channel webhooks or direct messages from a bot.

## Configuration

The notification system uses environment variables defined in your `.env` file in the `apps/hq-ui` directory:

- `DISCORD_WEBHOOK_URL`: URL for a Discord channel webhook
- `DISCORD_BOT_TOKEN`: Token for a Discord bot (for direct messages)
- `DEFAULT_DISCORD_USER_ID`: Default Discord user ID to send direct messages to
- `ENABLE_AUTO_NOTIFICATIONS`: Set to 1 to enable automatic notifications when intent is detected
- `PREFER_DIRECT_MESSAGES`: Set to 1 to prefer direct messages over webhook when both are available
- `DEFAULT_NOTIFICATION_METHOD`: Default method - either `webhook` or `bot_dm`

See `apps/agents/tests/notification/env_example.txt` for an example configuration.

## Notification Methods

The system supports two notification methods:

1. **Webhook Notifications**: Send messages to a Discord channel via webhook
2. **Direct Messages**: Send direct messages to users via a Discord bot

## Usage

### Automatic Notification Intent Detection

When `ENABLE_AUTO_NOTIFICATIONS=1`, the system will automatically check Chloe's responses for phrases indicating an intent to notify the user (like "I'll let you know when I'm done"). If detected, a notification will be sent when the task completes.

### Through PerceptionTools

```python
from apps.agents.shared.tools.perception_tools import PerceptionTools, NotificationMethod

# With webhook notification
task_id, message = PerceptionTools.trigger_data_collection(
    topic="important research",
    keywords=["key", "terms"],
    notify_discord=True  # Will use DEFAULT_DISCORD_WEBHOOK
)

# With direct message notification
task_id, message = PerceptionTools.trigger_data_collection(
    topic="important research",
    keywords=["key", "terms"],
    discord_user_id="your-discord-id",  # Or uses DEFAULT_DISCORD_USER_ID if not specified
    notify_discord=True,
    notification_method=NotificationMethod.BOT_DM
)
```

### Direct Usage

For direct webhook notifications:

```python
from apps.agents.shared.perception.data_collector import send_notification

send_notification(
    webhook_url="https://discord.com/api/webhooks/...",
    title="Notification Title",
    message="Your message here",
    task_id="optional-task-id"
)
```

For direct messages:

```python
from apps.agents.shared.tools.discord_notify import send_discord_dm

send_discord_dm(
    user_id="discord-user-id",
    title="Notification Title",
    message="Your message here",
    task_id="optional-task-id"
)
```

## Testing

Use the test scripts in `apps/agents/tests/notification/` to test different aspects of the notification system:

- `test_notification_intent.py`: Tests detection of notification intent and both notification methods
- `test_discord_dm.py`: Tests direct messaging functionality
- `test_simple.py`: Simple tests for basic notification functionality

## Implementation Details

- The webhook notification uses standard HTTP POST requests to the Discord webhook URL
- Direct messaging uses the Discord.py library to send messages via a bot
- The system includes both synchronous and asynchronous methods for sending notifications
- Error handling ensures that notification failures won't crash the main application 