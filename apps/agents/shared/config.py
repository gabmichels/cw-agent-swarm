"""
Configuration module for the agents system.

This file contains global configuration settings and environment variables.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from the main .env file
env_path = Path(__file__).parent.parent.parent / "hq-ui" / ".env"
if env_path.exists():
    load_dotenv(env_path)

# Discord settings
# Use environment variable if set, otherwise default to None
DEFAULT_DISCORD_WEBHOOK = os.environ.get("DISCORD_WEBHOOK_URL", None)

# Development mode flags
DEV_MODE = os.environ.get("CHLOE_DEV_MODE", "0") == "1"

# Notification settings
ENABLE_AUTO_NOTIFICATIONS = os.environ.get("ENABLE_AUTO_NOTIFICATIONS", "1") == "1"

# Function to determine if a message indicates intent to notify
def has_notification_intent(message: str) -> bool:
    """
    Check if a message indicates an intent to notify the user.
    
    Args:
        message: The message to check
        
    Returns:
        True if the message indicates an intent to notify, False otherwise
    """
    if not message:
        return False
        
    notification_phrases = [
        "i'll notify you",
        "i will notify you",
        "i'll send you a notification",
        "i will send you a notification",
        "i'll let you know",
        "i will let you know",
        "notification will be sent",
        "you'll be notified",
        "you will be notified",
        "i'll ping you",
        "i will ping you",
        # Additional phrases
        "notify you when",
        "let you know when",
        "i'll inform you",
        "i will inform you",
        "send you an alert",
        "send a notification",
        "notify you once",
        "let you know once",
        "inform you when",
        "ping you when",
        "i'll alert you",
        "i will alert you",
        "notify you via discord",
        "alert you via discord",
        "message you when",
        "i'll message you",
        "i will message you"
    ]
    
    # Check if any notification phrase is in the message
    message_lower = message.lower()
    return any(phrase in message_lower for phrase in notification_phrases) 