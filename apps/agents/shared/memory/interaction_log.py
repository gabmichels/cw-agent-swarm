"""
Interaction Log Module

This module provides functions to track and retrieve recent messages
from the conversation history.
"""
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global conversation history
# This is a simple in-memory storage for recent interactions
_recent_interactions = []

def log_user_message(message: str) -> None:
    """
    Log a user message to the interaction history.
    
    Args:
        message: The user's message text
    """
    _recent_interactions.append({
        "role": "user",
        "content": message,
        "timestamp": datetime.now().isoformat()
    })
    
    # Trim history to keep only the last 20 interactions
    if len(_recent_interactions) > 20:
        _recent_interactions.pop(0)

def log_ai_message(message: str) -> None:
    """
    Log an AI message to the interaction history.
    
    Args:
        message: The AI's message text
    """
    _recent_interactions.append({
        "role": "assistant",
        "content": message,
        "timestamp": datetime.now().isoformat()
    })
    
    # Trim history to keep only the last 20 interactions
    if len(_recent_interactions) > 20:
        _recent_interactions.pop(0)

def get_recent_interactions(limit: int = 5) -> List[Dict[str, Any]]:
    """
    Get the most recent interactions from the history.
    
    Args:
        limit: Maximum number of interactions to retrieve
        
    Returns:
        List of recent interactions
    """
    return _recent_interactions[-limit:] if _recent_interactions else []

def get_last_user_message() -> Optional[str]:
    """
    Get the most recent message from the user.
    
    Returns:
        The most recent user message, or None if no user messages exist
    """
    for interaction in reversed(_recent_interactions):
        if interaction["role"] == "user":
            return interaction["content"]
    return None

def get_last_ai_message() -> Optional[str]:
    """
    Get the most recent message from the AI.
    
    Returns:
        The most recent AI message, or None if no AI messages exist
    """
    for interaction in reversed(_recent_interactions):
        if interaction["role"] == "assistant":
            return interaction["content"]
    return None

def clear_interaction_history() -> None:
    """
    Clear the interaction history.
    """
    global _recent_interactions
    _recent_interactions = []

# Export conversation tracking functionality
interaction_tracking = {
    "log_user_message": log_user_message,
    "log_ai_message": log_ai_message,
    "get_recent_interactions": get_recent_interactions,
    "get_last_user_message": get_last_user_message,
    "get_last_ai_message": get_last_ai_message,
    "clear_interaction_history": clear_interaction_history
} 
 