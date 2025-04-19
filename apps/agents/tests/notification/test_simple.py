"""
Simple Notification Test

This test demonstrates the notification intent detection system
without relying on NumPy or other complex dependencies.
"""
import os
import sys
from pathlib import Path

# Add the parent directory to sys.path
sys.path.append(str(Path(__file__).parent.parent))

# Mock the episodic_memory module to avoid NumPy dependency issues
import sys
from unittest.mock import MagicMock
sys.modules['apps.agents.shared.memory.episodic_memory'] = MagicMock()

# Now import our modules
from agents.shared.memory.interaction_log import (
    log_user_message,
    log_ai_message,
    get_last_ai_message,
    clear_interaction_history
)
from agents.shared.config import has_notification_intent

def test_notification_intent():
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

def test_interaction_logging():
    """Test the interaction logging system."""
    print("\n=== Testing Interaction Logging ===")
    
    # Clear any existing interaction history
    clear_interaction_history()
    
    # Add some messages
    log_user_message("Can you research language barriers in customer service?")
    log_ai_message("I'll collect some data on language barriers in customer service and notify you when it's ready.")
    
    # Get the last AI message
    last_message = get_last_ai_message()
    print(f"Last AI message: {last_message}")
    
    # Check for notification intent
    has_intent = has_notification_intent(last_message)
    print(f"Has notification intent: {has_intent}")
    
    print("\nInteraction logging test completed.")

if __name__ == "__main__":
    # Display environment information
    print("=== Simple Notification Test ===")
    print(f"DISCORD_WEBHOOK_URL environment variable: {'Set' if os.environ.get('DISCORD_WEBHOOK_URL') else 'Not set'}")
    print(f"ENABLE_AUTO_NOTIFICATIONS: {'1' if os.environ.get('ENABLE_AUTO_NOTIFICATIONS', '1') == '1' else '0'}")
    
    # Run the tests
    test_notification_intent()
    test_interaction_logging()
    
    print("\nAll tests completed!") 