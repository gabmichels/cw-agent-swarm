"""
Chat History
----------
Shared chat history system for all agents. Handles:
- Storing chat messages
- Retrieving recent history
- Formatting for LLM context
"""

from typing import Dict, List, Any, Optional
import datetime
import json
import os
from pathlib import Path
import logging

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_chat_history_path() -> str:
    """
    Get the directory for storing chat history.
    
    Returns:
        Path to the chat history directory
    """
    script_dir = Path(os.path.dirname(os.path.abspath(__file__)))
    base_dir = script_dir.parent.parent.parent  # Up three levels (to project root)
    chat_dir = os.path.join(base_dir, "shared", "agent_core", "memory", "chat_history")
    
    # Create directory if it doesn't exist
    os.makedirs(chat_dir, exist_ok=True)
    
    return chat_dir

def log_chat(role: str, content: str, tags: List[str] = None) -> bool:
    """
    Log a chat message to history.
    
    Args:
        role: The role of the sender ('user' or 'ai')
        content: The message content
        tags: Optional list of tags to categorize the message
        
    Returns:
        True if successful, False otherwise
    """
    if not tags:
        tags = []
    
    timestamp = datetime.datetime.now().isoformat()
    message = {
        "role": role,
        "content": content,
        "timestamp": timestamp,
        "tags": tags
    }
    
    try:
        chat_dir = get_chat_history_path()
        chat_file = os.path.join(chat_dir, "chat_history.jsonl")
        
        # Append to the jsonl file
        with open(chat_file, 'a', encoding='utf-8') as f:
            f.write(json.dumps(message) + "\n")
        
        return True
    except Exception as e:
        logger.error(f"Error logging chat: {str(e)}")
        return False

def get_recent_history(n: int = 10) -> List[Dict[str, Any]]:
    """
    Get the most recent chat history entries.
    
    Args:
        n: Number of entries to retrieve
        
    Returns:
        List of chat history entries
    """
    try:
        chat_dir = get_chat_history_path()
        chat_file = os.path.join(chat_dir, "chat_history.jsonl")
        
        if not os.path.exists(chat_file):
            return []
        
        # Read all lines and get the last n
        with open(chat_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        # Parse the most recent n entries
        recent_entries = []
        for line in lines[-n:]:
            try:
                entry = json.loads(line.strip())
                recent_entries.append(entry)
            except json.JSONDecodeError:
                logger.error(f"Error parsing chat history entry: {line}")
        
        return recent_entries
    except Exception as e:
        logger.error(f"Error retrieving chat history: {str(e)}")
        return []

def get_chat_by_tag(tag: str, limit: int = None) -> List[Dict[str, Any]]:
    """
    Get chat messages with a specific tag.
    
    Args:
        tag: Tag to filter by
        limit: Optional maximum number of messages to return
        
    Returns:
        List of matching chat messages
    """
    try:
        chat_dir = get_chat_history_path()
        chat_file = os.path.join(chat_dir, "chat_history.jsonl")
        
        if not os.path.exists(chat_file):
            return []
        
        # Read all lines and filter by tag
        matching_entries = []
        with open(chat_file, 'r', encoding='utf-8') as f:
            for line in f:
                try:
                    entry = json.loads(line.strip())
                    if "tags" in entry and tag in entry["tags"]:
                        matching_entries.append(entry)
                except json.JSONDecodeError:
                    logger.error(f"Error parsing chat history entry: {line}")
        
        # Limit the results if needed
        if limit is not None:
            matching_entries = matching_entries[-limit:]
        
        return matching_entries
    except Exception as e:
        logger.error(f"Error retrieving chat history by tag: {str(e)}")
        return []

def clear_chat_history() -> bool:
    """
    Clear the chat history.
    
    Returns:
        True if successful, False otherwise
    """
    try:
        chat_dir = get_chat_history_path()
        chat_file = os.path.join(chat_dir, "chat_history.jsonl")
        
        if os.path.exists(chat_file):
            # Backup the current file
            timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
            backup_file = os.path.join(chat_dir, f"chat_history_{timestamp}.jsonl.bak")
            os.rename(chat_file, backup_file)
        
        # Create a fresh file
        with open(chat_file, 'w', encoding='utf-8') as f:
            pass
        
        return True
    except Exception as e:
        logger.error(f"Error clearing chat history: {str(e)}")
        return False

def format_for_langchain(entries: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    """
    Format chat history entries for LangChain.
    
    Args:
        entries: List of chat history entries
        
    Returns:
        Formatted list for LangChain chat history
    """
    formatted = []
    
    for entry in entries:
        role = entry["role"]
        content = entry["content"]
        
        # Convert to LangChain format
        if role == "user":
            formatted.append({"role": "human", "content": content})
        elif role == "ai":
            formatted.append({"role": "ai", "content": content})
        # Skip other roles
    
    return formatted 