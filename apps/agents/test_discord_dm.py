"""
Test script to demonstrate Discord bot direct messaging functionality.
"""

import os
import sys
import time
from pathlib import Path

# Add the parent directory to sys.path to ensure proper imports
current_dir = Path(__file__).resolve().parent
parent_dir = current_dir.parent
sys.path.insert(0, str(parent_dir))

from apps.agents.shared.notification.discord_bot import DiscordNotifier
from apps.agents.shared.config import (
    DISCORD_BOT_TOKEN, 
    DEFAULT_DISCORD_USER_ID,
    NotificationMethod
)

def test_discord_bot():
    """Test the Discord bot direct messaging functionality"""
    print("Starting Discord bot direct messaging test...")
    
    # Check if we have the required credentials
    if not DISCORD_BOT_TOKEN:
        print("ERROR: No Discord bot token configured in .env")
        print("Please add DISCORD_BOT_TOKEN=your-bot-token to .env")
        return
        
    if not DEFAULT_DISCORD_USER_ID:
        print("ERROR: No default Discord user ID configured in .env")
        print("Please add DEFAULT_DISCORD_USER_ID=your-user-id to .env")
        return
    
    print(f"Using Discord bot token: {DISCORD_BOT_TOKEN[:10]}...")
    print(f"Sending message to user ID: {DEFAULT_DISCORD_USER_ID}")
    
    # Initialize the Discord bot
    notifier = DiscordNotifier.get_instance(DISCORD_BOT_TOKEN)
    
    # Send a direct test message
    print("Sending direct test message...")
    success = notifier.send_dm(
        DEFAULT_DISCORD_USER_ID,
        "Test Notification",
        "This is a test message from the Discord notifier bot.",
        "test-task-id"
    )
    
    if success:
        print("Direct message sent or queued successfully!")
    else:
        print("Failed to send direct message.")

if __name__ == "__main__":
    test_discord_bot() 