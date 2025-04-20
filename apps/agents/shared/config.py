"""
Configuration module for the agents system.

This file contains global configuration settings and environment variables.
"""
import os
from pathlib import Path
from typing import List, Optional
from dotenv import load_dotenv

# Load environment variables from .env file
env_path = Path(__file__).parent.parent.parent / "hq-ui" / ".env"
load_dotenv(dotenv_path=env_path)

# Discord notification settings
DEFAULT_DISCORD_WEBHOOK = os.getenv("DISCORD_WEBHOOK_URL")
DISCORD_BOT_TOKEN = os.getenv("DISCORD_BOT_TOKEN")
DEFAULT_DISCORD_USER_ID = os.getenv("DEFAULT_DISCORD_USER_ID")

# Whether to automatically enable notifications when intent is detected
ENABLE_AUTO_NOTIFICATIONS = bool(int(os.getenv("ENABLE_AUTO_NOTIFICATIONS", "0")))

# Development mode settings
DEV_MODE = bool(int(os.getenv("DEV_MODE", "0")))
MOCK_DATA_COLLECTION = bool(int(os.getenv("MOCK_DATA_COLLECTION", "0")))

# Coda Integration settings
CODA_API_TOKEN = os.getenv("CODA_API_KEY")
CODA_REFLECTION_DOC_ID = os.getenv("CODA_DOC_ID")
CODA_REFLECTION_TABLE_ID = os.getenv("CODA_REFLECTION_TABLE_ID")
CODA_WEEKLY_REFLECTION_BLOCK_ID = os.getenv("CODA_WEEKLY_REFLECTION_BLOCK_ID")
CODA_AVAILABLE = bool(CODA_API_TOKEN and CODA_REFLECTION_DOC_ID and CODA_REFLECTION_TABLE_ID)

# Notification phrases that indicate intent to notify
NOTIFICATION_PHRASES: List[str] = [
    "i'll notify you",
    "i will notify you",
    "i'll let you know",
    "i will let you know",
    "i'll send you a notification",
    "i will send you a notification",
    "i'll update you",
    "i will update you",
    "i'll ping you",
    "i will ping you",
    "i'll message you",
    "i will message you",
    "i'll dm you",
    "i will dm you",
    "send a notification",
    "send you a notification",
    "notify you when",
    "let you know when",
    "update you when",
    "ping you when",
    "message you when",
    "dm you when",
    "notify you via discord",
    "notify you through discord",
    "message you on discord",
    "dm you on discord",
]

def has_notification_intent(message: str) -> bool:
    """
    Check if a message contains phrases indicating an intent to notify the user.
    
    Args:
        message: The message to check for notification intent
        
    Returns:
        True if notification intent is detected, False otherwise
    """
    if not message:
        return False
        
    message = message.lower()
    for phrase in NOTIFICATION_PHRASES:
        if phrase in message:
            return True
            
    return False

# Notification method preferences
class NotificationMethod:
    """Enumeration of notification methods."""
    WEBHOOK = "webhook"  # Discord channel webhook
    BOT_DM = "bot_dm"    # Discord bot direct message
    
# Default notification method to use
DEFAULT_NOTIFICATION_METHOD = os.getenv("DEFAULT_NOTIFICATION_METHOD", NotificationMethod.WEBHOOK)

# Whether direct message notifications are available (requires bot token and default user ID)
DISCORD_DM_AVAILABLE = bool(DISCORD_BOT_TOKEN and DEFAULT_DISCORD_USER_ID)

# Whether to prefer direct messages when available
PREFER_DIRECT_MESSAGES = bool(int(os.getenv("PREFER_DIRECT_MESSAGES", "1"))) 
 