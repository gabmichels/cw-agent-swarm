"""
Test script to demonstrate notification intent detection and Discord notifications.
"""

import os
import sys
import time
from pathlib import Path

# Add the parent directory to sys.path
current_dir = Path(__file__).parent
parent_dir = current_dir.parent.parent.parent
sys.path.append(str(parent_dir))

from apps.agents.shared.config import (
    has_notification_intent,
    DEFAULT_DISCORD_WEBHOOK,
    DISCORD_BOT_TOKEN,
    DEFAULT_DISCORD_USER_ID,
    NOTIFICATION_PHRASES,
    NotificationMethod
)
from apps.agents.shared.tools.perception_tools import PerceptionTools
from apps.agents.shared.tools.discord_notify import send_discord_dm

def test_notification_intent():
    """Test the notification intent detection functionality"""
    print("Testing notification intent detection...")
    
    # Test with positive examples
    positive_examples = [
        "I'll notify you when I'm done researching.",
        "I will let you know when I have completed the analysis.",
        "Once the data is collected, I'll message you on Discord.",
        "I'll send you a notification when the task is complete.",
        "I will dm you on discord when I have results."
    ]
    
    for i, message in enumerate(positive_examples):
        result = has_notification_intent(message)
        print(f"Example {i+1}: '{message}'")
        print(f"  Intent detected: {result}")
        if not result:
            print("  FAIL: Should have detected intent")
        else:
            print("  PASS")
    
    # Test with negative examples
    negative_examples = [
        "Here's the information you requested.",
        "The data collection is still in progress.",
        "I've completed the analysis of the data.",
        "Discord is a popular messaging platform.",
        "Let me search for that information."
    ]
    
    for i, message in enumerate(negative_examples):
        result = has_notification_intent(message)
        print(f"Example {i+1}: '{message}'")
        print(f"  Intent detected: {result}")
        if result:
            print("  FAIL: Should not have detected intent")
        else:
            print("  PASS")
    
    # Print all notification phrases
    print("\nAll notification phrases:")
    for phrase in NOTIFICATION_PHRASES:
        print(f"  - '{phrase}'")

def test_discord_webhook():
    """Test the Discord webhook notification functionality"""
    print("\nTesting Discord webhook notifications...")
    
    if not DEFAULT_DISCORD_WEBHOOK:
        print("ERROR: No Discord webhook URL configured in .env")
        print("Please add DISCORD_WEBHOOK_URL=your-webhook-url to .env")
        return
    
    print(f"Using webhook URL: {DEFAULT_DISCORD_WEBHOOK[:20]}...")
    
    # Test topic
    topic = "webhook notification test"
    keywords = ["webhook", "discord", "notification"]
    
    # Test with notification intent
    response_message = "I'll notify you when I've gathered the information you requested."
    
    task_id, message = PerceptionTools.trigger_data_collection(
        topic=topic,
        keywords=keywords,
        notify_discord=True,
        response_message=response_message
    )
    
    print(f"Task started: {task_id}")
    print(f"Response: {message}")
    
    # Wait for collection to complete
    wait_and_check_status(task_id)

def test_discord_dm():
    """Test the Discord bot direct messaging functionality"""
    print("\nTesting Discord direct message notifications...")
    
    if not DISCORD_BOT_TOKEN:
        print("ERROR: No Discord bot token configured in .env")
        print("Please add DISCORD_BOT_TOKEN=your-bot-token to .env")
        return
        
    if not DEFAULT_DISCORD_USER_ID:
        print("ERROR: No default Discord user ID configured in .env")
        print("Please add DEFAULT_DISCORD_USER_ID=your-user-id to .env")
        return
    
    print(f"Using bot token: {DISCORD_BOT_TOKEN[:10]}...")
    print(f"Sending message to user ID: {DEFAULT_DISCORD_USER_ID}")
    
    # Test direct function
    print("Testing direct DM function...")
    success = send_discord_dm(
        DEFAULT_DISCORD_USER_ID,
        "Test Direct Message",
        "This is a test message sent directly via the discord_notify module.",
        "test-task-id"
    )
    
    if success:
        print("Direct message sent successfully!")
    else:
        print("Failed to send direct message.")
    
    # Test with PerceptionTools
    print("\nTesting via PerceptionTools...")
    
    # Test topic
    topic = "direct message test"
    keywords = ["dm", "discord", "bot"]
    
    # Test with notification intent
    response_message = "I'll dm you on discord when I'm done with the research."
    
    task_id, message = PerceptionTools.trigger_data_collection(
        topic=topic,
        keywords=keywords,
        discord_user_id=DEFAULT_DISCORD_USER_ID,
        notify_discord=True,
        response_message=response_message,
        notification_method=NotificationMethod.BOT_DM
    )
    
    print(f"Task started: {task_id}")
    print(f"Response: {message}")
    
    # Wait for collection to complete
    wait_and_check_status(task_id)

def wait_and_check_status(task_id, max_wait=30):
    """Helper function to wait for a task to complete"""
    print("Waiting for collection to complete...")
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
    print("=" * 50)
    print("NOTIFICATION INTENT AND DISCORD NOTIFICATIONS TEST")
    print("=" * 50)
    
    # Test notification intent detection
    test_notification_intent()
    
    # Test Discord webhook notifications
    test_discord_webhook()
    
    # Test Discord direct message notifications
    test_discord_dm() 