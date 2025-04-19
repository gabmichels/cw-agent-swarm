"""
Test Notification System

This script demonstrates how the interaction logging and notification systems
work together to detect notification intent and trigger appropriate actions.
"""
import os
import sys
from pathlib import Path
import time

# Add the parent directory to sys.path
sys.path.append(str(Path(__file__).parent.parent))

from agents.shared.memory.interaction_log import (
    log_user_message,
    log_ai_message,
    get_last_ai_message,
    clear_interaction_history
)
from agents.shared.tools.perception_tools import PerceptionTools
from agents.shared.config import (
    has_notification_intent,
    DEFAULT_DISCORD_WEBHOOK,
    ENABLE_AUTO_NOTIFICATIONS
)

def test_notification_intent_detection():
    """Test the notification intent detection system."""
    print("\n=== Testing Notification Intent Detection ===")
    
    # Clear any existing interaction history
    clear_interaction_history()
    
    # Test cases for notification intent
    test_messages = [
        "I'll look that up for you and I'll notify you when it's done.",
        "I will collect the data and let you know when it's ready.",
        "The analysis will take some time. I'll ping you when it's complete.",
        "I've started the research. You'll be notified once it's finished.",
        "I'll send you a notification when the data is available.",
        "I'm starting your research now.",  # No notification intent
        "Here are the results of your query.",  # No notification intent
    ]
    
    print("Testing notification intent detection on sample messages:")
    for i, message in enumerate(test_messages):
        # Log the AI message
        log_ai_message(message)
        
        # Get the last message and check for notification intent
        last_message = get_last_ai_message()
        has_intent = has_notification_intent(last_message)
        
        print(f"\nMessage {i+1}: {message}")
        print(f"Has notification intent: {has_intent}")
    
    print("\nNotification intent detection test completed.")

def test_data_collection_with_notification():
    """Test the data collection with notification based on intent."""
    print("\n=== Testing Data Collection with Notification ===")
    
    # Clear any existing interaction history
    clear_interaction_history()
    
    # Configuration information
    print(f"Default Discord Webhook: {'Configured' if DEFAULT_DISCORD_WEBHOOK else 'Not configured'}")
    print(f"Auto Notifications: {'Enabled' if ENABLE_AUTO_NOTIFICATIONS else 'Disabled'}")
    
    # Test cases
    test_cases = [
        {
            "user_message": "Can you research language barriers in customer service?",
            "ai_message": "I'll collect some data on language barriers in customer service and notify you when it's ready.",
            "topic": "language barriers in customer service",
            "keywords": ["communication challenges", "translation issues"]
        },
        {
            "user_message": "What are the latest trends in AI?",
            "ai_message": "I'll check on the latest AI trends for you.",  # No notification intent
            "topic": "AI trends",
            "keywords": ["machine learning", "large language models"]
        }
    ]
    
    for i, case in enumerate(test_cases):
        print(f"\n--- Test Case {i+1} ---")
        print(f"User Message: {case['user_message']}")
        print(f"AI Response: {case['ai_message']}")
        
        # Log the messages
        log_user_message(case['user_message'])
        log_ai_message(case['ai_message'])
        
        # Trigger data collection
        print(f"\nTriggering data collection for: {case['topic']}")
        result = PerceptionTools.trigger_data_collection(
            topic=case['topic'],
            keywords=case['keywords'],
            response_message=get_last_ai_message()
        )
        
        print("\nResult:")
        print(result)
        
        # Wait a moment for next test
        time.sleep(2)
    
    print("\nData collection test completed.")

if __name__ == "__main__":
    # Display environment information
    print("=== Notification System Test ===")
    print(f"DISCORD_WEBHOOK_URL environment variable: {'Set' if os.environ.get('DISCORD_WEBHOOK_URL') else 'Not set'}")
    print(f"ENABLE_AUTO_NOTIFICATIONS: {'1' if os.environ.get('ENABLE_AUTO_NOTIFICATIONS', '1') == '1' else '0'}")
    
    # Run the tests
    test_notification_intent_detection()
    test_data_collection_with_notification()
    
    print("\nAll tests completed!") 