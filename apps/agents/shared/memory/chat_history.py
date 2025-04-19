"""
Chat History Memory Module

This module manages conversation history for Chloe, allowing her to maintain
context across interactions. It stores all conversation turns with timestamps
and optionally tags for contextual filtering.

Each chat entry includes:
- role: "user" or "assistant"
- content: the message text
- timestamp: ISO format datetime
- tags: optional list of context tags
"""
import json
import os
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Any, Union
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage

# Constants
MEMORY_DIR = Path("apps/agents/shared/memory")
DEFAULT_CHAT_HISTORY_FILE = MEMORY_DIR / "chat_history.jsonl"

def _ensure_directory_exists() -> None:
    """Ensure the memory directory exists."""
    MEMORY_DIR.mkdir(parents=True, exist_ok=True)

def log_chat(
    role: str, 
    content: str, 
    tags: Optional[List[str]] = None,
    file_path: Optional[Union[str, Path]] = None
) -> Dict[str, Any]:
    """
    Log a chat message to the chat history file.
    
    Args:
        role: Either "user" or "assistant"
        content: The message content
        tags: Optional list of context tags for filtering later
        file_path: Optional custom file path for the history
    
    Returns:
        The chat entry that was logged
    """
    _ensure_directory_exists()
    
    # Validate role
    if role not in ["user", "assistant"]:
        raise ValueError(f"Invalid role: {role}. Must be 'user' or 'assistant'")
    
    # Create chat entry
    entry = {
        "role": role,
        "content": content,
        "timestamp": datetime.now().isoformat()
    }
    
    # Add tags if provided
    if tags:
        entry["tags"] = tags
    
    # Determine file path
    history_file = Path(file_path) if file_path else DEFAULT_CHAT_HISTORY_FILE
    
    # Append to JSONL file
    with open(history_file, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")
        
    return entry

def get_recent_history(
    n: int = 10, 
    tag: Optional[str] = None,
    file_path: Optional[Union[str, Path]] = None
) -> List[Dict[str, Any]]:
    """
    Retrieve the most recent chat history entries.
    
    Args:
        n: Number of most recent entries to retrieve
        tag: Optional tag to filter by
        file_path: Optional custom file path for the history
    
    Returns:
        List of chat entries, ordered from oldest to newest
    """
    history_file = Path(file_path) if file_path else DEFAULT_CHAT_HISTORY_FILE
    
    # If file doesn't exist, return empty list
    if not history_file.exists():
        return []
    
    # Read all entries
    entries = []
    with open(history_file, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():  # Skip empty lines
                try:
                    entry = json.loads(line)
                    # Filter by tag if specified
                    if tag is None or (
                        "tags" in entry and tag in entry["tags"]
                    ):
                        entries.append(entry)
                except json.JSONDecodeError:
                    # Skip invalid lines
                    continue
    
    # Return the most recent n entries
    return entries[-n:] if entries else []

def format_for_langchain(
    entries: List[Dict[str, Any]]
) -> List[BaseMessage]:
    """
    Format chat history entries as LangChain messages.
    
    Args:
        entries: List of chat history entries
    
    Returns:
        List of LangChain message objects
    """
    messages = []
    for entry in entries:
        if entry["role"] == "user":
            messages.append(HumanMessage(content=entry["content"]))
        elif entry["role"] == "assistant":
            messages.append(AIMessage(content=entry["content"]))
    return messages

def clear_history(file_path: Optional[Union[str, Path]] = None) -> None:
    """
    Clear the chat history file.
    
    Args:
        file_path: Optional custom file path for the history
    """
    history_file = Path(file_path) if file_path else DEFAULT_CHAT_HISTORY_FILE
    
    if history_file.exists():
        # Clear the file by opening it in write mode
        with open(history_file, "w", encoding="utf-8") as f:
            pass  # Just open and close to clear

def get_context_history(
    context_name: str,
    n: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    Get chat history from a context-specific file.
    
    Args:
        context_name: The context/topic name
        n: Optional number of entries to retrieve (default: all)
    
    Returns:
        List of chat entries for the context
    """
    context_file = MEMORY_DIR / f"chat_history_{context_name}.jsonl"
    
    if n is None:
        # Get all entries if n is not specified
        return get_recent_history(n=999999, file_path=context_file)
    else:
        return get_recent_history(n=n, file_path=context_file)

def log_to_context(
    context_name: str,
    role: str,
    content: str,
    tags: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Log a chat message to a context-specific history file.
    
    Args:
        context_name: The context/topic name
        role: Either "user" or "assistant"
        content: The message content
        tags: Optional list of context tags
    
    Returns:
        The chat entry that was logged
    """
    context_file = MEMORY_DIR / f"chat_history_{context_name}.jsonl"
    return log_chat(role, content, tags, file_path=context_file) 
 