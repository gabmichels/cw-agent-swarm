"""
Test script to demonstrate Discord bot direct messaging functionality.
"""

import os
import sys
import time
from pathlib import Path

# Add the parent directory to sys.path
current_dir = Path(__file__).parent
parent_dir = current_dir.parent
sys.path.append(str(parent_dir))

from agents.shared.notification.discord_bot import DiscordNotifier
from agents.shared.config import DISCORD_BOT_TOKEN, DEFAULT_DISCORD_USER_ID
from agents.shared.tools.perception_tools import PerceptionTools, NotificationMethod

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
    
    # Test using the PerceptionTools
    print("\nTesting via PerceptionTools...")
    
    # Test topic
    topic = "discord bot testing"
    keywords = ["discord", "bot", "direct message"]
    
    print(f"Collecting data on topic: {topic}")
    print(f"Using keywords: {keywords}")
    
    # Test with notification intent in message
    response_message = "I'll send you a direct message when I've collected all the data on discord bot testing."
    
    # Trigger data collection with DM notification
    task_id, message = PerceptionTools.trigger_data_collection(
        topic=topic,
        keywords=keywords,
        discord_user_id=DEFAULT_DISCORD_USER_ID,
        notify_discord=True,
        response_message=response_message,
        notification_method=NotificationMethod.BOT_DM
    )
    
    print(f"Task started with ID: {task_id}")
    print(f"Response: {message}")
    
    # Wait for collection to complete
    print("Waiting for collection to complete...")
    max_wait = 30  # Max wait in seconds
    start_time = time.time()
    
    while time.time() - start_time < max_wait:
        status = PerceptionTools.check_collection_status(task_id)
        print(f"Status: {status}")
        
        if "completed" in status.lower():
            # Get the report
            report = PerceptionTools.get_collection_report(task_id)
            print("\nCollection Report:")
            print(report)
            break
            
        time.sleep(5)  # Check every 5 seconds
    else:
        print("Collection did not complete within the timeout period")

if __name__ == "__main__":
    test_discord_bot() 