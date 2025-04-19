"""
Notification Integration Example

This script demonstrates how the notification intent detection system
works in a simulated agent conversation.

This is a simplified, self-contained example that demonstrates the core concepts
without requiring all the dependencies.
"""
import os
import sys
from pathlib import Path
import time
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging
from unittest.mock import MagicMock

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

#--------------------------------------------------------------------------------
# Interaction Logging System
#--------------------------------------------------------------------------------

# Global conversation history (simple in-memory storage)
_recent_interactions = []

def log_user_message(message: str) -> None:
    """Log a user message to the interaction history."""
    _recent_interactions.append({
        "role": "user",
        "content": message,
        "timestamp": datetime.now().isoformat()
    })
    
    # Trim history to keep only the last 10 interactions
    if len(_recent_interactions) > 10:
        _recent_interactions.pop(0)

def log_ai_message(message: str) -> None:
    """Log an AI message to the interaction history."""
    _recent_interactions.append({
        "role": "assistant",
        "content": message,
        "timestamp": datetime.now().isoformat()
    })
    
    # Trim history to keep only the last 10 interactions
    if len(_recent_interactions) > 10:
        _recent_interactions.pop(0)

def get_last_ai_message() -> Optional[str]:
    """Get the most recent message from the AI."""
    for interaction in reversed(_recent_interactions):
        if interaction["role"] == "assistant":
            return interaction["content"]
    return None

def clear_interaction_history() -> None:
    """Clear the interaction history."""
    global _recent_interactions
    _recent_interactions = []

#--------------------------------------------------------------------------------
# Notification Intent Detection
#--------------------------------------------------------------------------------

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

#--------------------------------------------------------------------------------
# Simulated Perception Tools
#--------------------------------------------------------------------------------

# Mock configuration
DEFAULT_DISCORD_WEBHOOK = os.environ.get("DISCORD_WEBHOOK_URL", None)
ENABLE_AUTO_NOTIFICATIONS = os.environ.get("ENABLE_AUTO_NOTIFICATIONS", "1") == "1"

class SimulatedPerceptionTools:
    """A simplified simulation of the PerceptionTools class."""
    
    @staticmethod
    def trigger_data_collection(
        topic: str, 
        keywords: List[str] = None, 
        notify_discord: bool = False,
        response_message: str = None
    ) -> str:
        """Simulated data collection trigger."""
        # Check for notification intent if applicable
        if not notify_discord and ENABLE_AUTO_NOTIFICATIONS and response_message:
            notify_discord = has_notification_intent(response_message)
        
        # Determine if we should notify
        should_notify = notify_discord and DEFAULT_DISCORD_WEBHOOK is not None
        
        # Create response message
        response = f"I've started collecting fresh data about '{topic}'."
        
        if should_notify:
            response += f" I'll notify you on Discord when it's ready."
        else:
            response += f" This will take a few moments to complete."
            
        return response
    
    @staticmethod
    def collect_and_analyze(
        topic: str, 
        keywords: List[str] = None,
        wait_for_completion: bool = True,
        timeout_seconds: int = 60,
        notify_discord: bool = False,
        response_message: str = None
    ) -> str:
        """Simulated collect and analyze."""
        # Check for notification intent if applicable
        if not notify_discord and ENABLE_AUTO_NOTIFICATIONS and response_message:
            notify_discord = has_notification_intent(response_message)
        
        # Determine if we should notify
        should_notify = notify_discord and DEFAULT_DISCORD_WEBHOOK is not None
        
        # Create response message
        response = f"I've collected and analyzed data about '{topic}'."
        
        if should_notify:
            response += f" I've sent the detailed report to you on Discord."
        else:
            response += f" Here's what I found: [Simulated analysis results for {topic}]"
            
        return response

#--------------------------------------------------------------------------------
# Example Agent Integration
#--------------------------------------------------------------------------------

def initialize_interaction_logging():
    """Initialize the interaction logging system."""
    clear_interaction_history()
    logger.info("Interaction logging system initialized")

def log_interaction(is_user: bool, message: str):
    """Log a message to the interaction history."""
    if is_user:
        log_user_message(message)
    else:
        log_ai_message(message)
    logger.debug(f"Logged {'user' if is_user else 'AI'} message")

def collect_new_data(topic: str, keywords: str = ""):
    """Simplified version of collect_new_data for the example."""
    # Parse the keywords string into a list
    keyword_list = [kw.strip() for kw in keywords.split(",")] if keywords else []
    
    # Get the last AI message to check for notification intent
    last_message = get_last_ai_message()
    has_intent = has_notification_intent(last_message)
    
    print(f"[SYSTEM] Checking AI message for notification intent...")
    print(f"[SYSTEM] Message: \"{last_message}\"")
    print(f"[SYSTEM] Has notification intent: {has_intent}")
    
    return SimulatedPerceptionTools.trigger_data_collection(
        topic=topic,
        keywords=keyword_list,
        response_message=last_message
    )

def research_and_analyze(topic: str, keywords: str = ""):
    """Simplified version of research_and_analyze for the example."""
    # Parse the keywords string into a list
    keyword_list = [kw.strip() for kw in keywords.split(",")] if keywords else []
    
    # Get the last AI message to check for notification intent
    last_message = get_last_ai_message()
    has_intent = has_notification_intent(last_message)
    
    print(f"[SYSTEM] Checking AI message for notification intent...")
    print(f"[SYSTEM] Message: \"{last_message}\"")
    print(f"[SYSTEM] Has notification intent: {has_intent}")
    
    return SimulatedPerceptionTools.collect_and_analyze(
        topic=topic,
        keywords=keyword_list,
        wait_for_completion=True,
        timeout_seconds=5,  # Short timeout for the example
        response_message=last_message
    )

def simulate_agent_conversation():
    """
    Simulate a conversation with an agent that uses the notification system.
    """
    print("=== Simulating Agent Conversation ===\n")
    
    # Initialize the interaction logging system
    initialize_interaction_logging()
    
    # Simulate user message
    user_message = "Can you research the latest developments in AI translation technology?"
    print(f"User: {user_message}")
    log_interaction(is_user=True, message=user_message)
    
    # Simulate AI response with notification intent
    ai_response = "I'll research the latest developments in AI translation technology for you. I'll notify you when I have the results."
    print(f"Agent: {ai_response}")
    log_interaction(is_user=False, message=ai_response)
    
    # Now use the data collection tool which will detect the notification intent
    print("\nAgent is now using the collect_new_data tool...")
    result = collect_new_data(
        topic="AI translation technology",
        keywords="neural machine translation, real-time translation, language models"
    )
    print(f"Tool result: {result}")
    
    print("\nWaiting for a moment to simulate time passage...\n")
    time.sleep(2)
    
    # Simulate another user message
    user_message = "Can you also check for voice recognition advancements?"
    print(f"User: {user_message}")
    log_interaction(is_user=True, message=user_message)
    
    # Simulate AI response without notification intent
    ai_response = "I'll check on voice recognition advancements for you right away."
    print(f"Agent: {ai_response}")
    log_interaction(is_user=False, message=ai_response)
    
    # Use the research_and_analyze tool which should not trigger a notification
    print("\nAgent is now using the research_and_analyze tool...")
    result = research_and_analyze(
        topic="voice recognition technology",
        keywords="speech recognition, voice assistants"
    )
    print(f"Tool result: {result}")

def display_setup_instructions():
    """
    Display instructions for setting up the notification system.
    """
    print("\n=== Setup Instructions ===\n")
    print("To enable Discord notifications:")
    print("1. Create a webhook in your Discord server (Server Settings → Integrations → Webhooks → New Webhook)")
    print("2. Add the webhook URL to your `.env` file:")
    print("   DISCORD_WEBHOOK_URL=your_discord_webhook_url")
    print("3. Ensure ENABLE_AUTO_NOTIFICATIONS=1 is set in your `.env` file (this is the default)")
    print("\nOnce configured, the system will automatically detect when an agent mentions")
    print("notifications and send a Discord message when data collection tasks complete.")

if __name__ == "__main__":
    # Display environment information
    print("=== Notification Integration Example ===")
    print(f"DISCORD_WEBHOOK_URL environment variable: {'Set' if os.environ.get('DISCORD_WEBHOOK_URL') else 'Not set'}")
    print(f"ENABLE_AUTO_NOTIFICATIONS: {'1' if os.environ.get('ENABLE_AUTO_NOTIFICATIONS', '1') == '1' else '0'}")
    
    # Run the simulation
    simulate_agent_conversation()
    
    # Display setup instructions
    display_setup_instructions()
    
    print("\nExample completed!") 