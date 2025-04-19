"""
Enhanced test script for the chat history module.

This test file extends the original test_chat_history.py with additional
tests for advanced features and edge cases of the chat history implementation.
"""
import sys
import os
import json
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Any

# Add the workspace to the path so we can import modules
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

# Import chat history functions
from apps.agents.shared.memory.chat_history import (
    log_chat, 
    get_recent_history, 
    format_for_langchain,
    clear_history,
    log_to_context,
    get_context_history,
    DEFAULT_CHAT_HISTORY_FILE,
    MEMORY_DIR
)

# Import LangChain message types for validation
from langchain_core.messages import HumanMessage, AIMessage

def test_empty_history():
    """Test behavior with empty chat history."""
    print("\n=== Testing Empty Chat History ===")
    
    # Create a test-specific file path
    test_file = MEMORY_DIR / "test_empty_history.jsonl"
    
    # Ensure the file doesn't exist
    if test_file.exists():
        os.remove(test_file)
    
    # Try to retrieve history from non-existent file
    history = get_recent_history(file_path=test_file)
    print(f"Retrieved {len(history)} entries from non-existent file (expected 0)")
    
    # Create an empty file
    test_file.touch()
    
    # Try to retrieve history from empty file
    history = get_recent_history(file_path=test_file)
    print(f"Retrieved {len(history)} entries from empty file (expected 0)")
    
    # Clean up
    if test_file.exists():
        os.remove(test_file)

def test_malformed_entries():
    """Test handling of malformed JSON entries in chat history file."""
    print("\n=== Testing Malformed Entries ===")
    
    # Create a test file with some malformed entries
    test_file = MEMORY_DIR / "test_malformed.jsonl"
    
    with open(test_file, "w", encoding="utf-8") as f:
        # Valid entry
        f.write(json.dumps({"role": "user", "content": "Valid message", "timestamp": datetime.now().isoformat()}) + "\n")
        # Invalid JSON
        f.write("This is not valid JSON\n")
        # Valid entry
        f.write(json.dumps({"role": "assistant", "content": "Another valid", "timestamp": datetime.now().isoformat()}) + "\n")
        # Missing required field
        f.write(json.dumps({"content": "Missing role field", "timestamp": datetime.now().isoformat()}) + "\n")
    
    # Get history and verify only valid entries are returned
    history = get_recent_history(file_path=test_file)
    print(f"Retrieved {len(history)} valid entries from file with malformed content")
    for i, entry in enumerate(history):
        role = entry.get('role', 'MISSING_ROLE')
        content = entry.get('content', 'MISSING_CONTENT')
        print(f"{i+1}. {role}: {content}")
    
    # Clean up
    os.remove(test_file)

def test_multi_context_operations():
    """Test operations across multiple contexts."""
    print("\n=== Testing Multi-Context Operations ===")
    
    # Clear existing context files
    for context in ["context_a", "context_b", "context_c"]:
        context_file = MEMORY_DIR / f"chat_history_{context}.jsonl"
        if context_file.exists():
            os.remove(context_file)
    
    # Log messages to multiple contexts
    print("Logging to multiple contexts...")
    contexts = ["context_a", "context_b", "context_c"]
    
    for i, context in enumerate(contexts):
        for j in range(3):  # 3 message pairs per context
            log_to_context(context, "user", f"User message {j+1} in {context}")
            log_to_context(context, "assistant", f"Assistant response {j+1} in {context}")
    
    # Verify each context has the right messages
    for context in contexts:
        history = get_context_history(context)
        print(f"\nContext '{context}' has {len(history)} messages:")
        for i, entry in enumerate(history[:2]):  # Show first two for brevity
            print(f"{i+1}. {entry['role']}: {entry['content']}")
        if len(history) > 2:
            print(f"... and {len(history)-2} more")
    
    # Clean up
    for context in contexts:
        context_file = MEMORY_DIR / f"chat_history_{context}.jsonl"
        if context_file.exists():
            os.remove(context_file)

def test_langchain_format_validation():
    """Test that LangChain formatting produces valid message objects."""
    print("\n=== Testing LangChain Format Validation ===")
    
    # Create test data
    test_entries = [
        {"role": "user", "content": "Hello AI!", "timestamp": datetime.now().isoformat()},
        {"role": "assistant", "content": "Hello human!", "timestamp": datetime.now().isoformat()},
        {"role": "user", "content": "What can you help me with?", "timestamp": datetime.now().isoformat()},
        {"role": "assistant", "content": "I can assist with many tasks!", "timestamp": datetime.now().isoformat()}
    ]
    
    # Convert to LangChain format
    lc_messages = format_for_langchain(test_entries)
    
    # Validate types
    print("Validating LangChain message types:")
    type_counts = {"HumanMessage": 0, "AIMessage": 0, "Other": 0}
    
    for i, msg in enumerate(lc_messages):
        if isinstance(msg, HumanMessage):
            type_counts["HumanMessage"] += 1
            correct_type = "user" == test_entries[i]["role"]
        elif isinstance(msg, AIMessage):
            type_counts["AIMessage"] += 1
            correct_type = "assistant" == test_entries[i]["role"]
        else:
            type_counts["Other"] += 1
            correct_type = False
        
        print(f"{i+1}. Entry type: {test_entries[i]['role']}, LC type: {type(msg).__name__}, Correct: {correct_type}")
    
    print(f"\nType counts: {type_counts}")
    print(f"All correct: {type_counts['HumanMessage'] == 2 and type_counts['AIMessage'] == 2 and type_counts['Other'] == 0}")

def test_filtering_by_multiple_tags():
    """Test filtering chat history by multiple tags."""
    print("\n=== Testing Multi-Tag Filtering ===")
    
    # Create a test file
    test_file = MEMORY_DIR / "test_multi_tag.jsonl"
    if test_file.exists():
        os.remove(test_file)
    
    # Log messages with various tag combinations
    log_chat("user", "Message with tag A", tags=["tag_a"], file_path=test_file)
    log_chat("assistant", "Response with tag A", tags=["tag_a"], file_path=test_file)
    log_chat("user", "Message with tag B", tags=["tag_b"], file_path=test_file)
    log_chat("assistant", "Response with tag B", tags=["tag_b"], file_path=test_file)
    log_chat("user", "Message with tags A and B", tags=["tag_a", "tag_b"], file_path=test_file)
    log_chat("assistant", "Response with tags A and B", tags=["tag_a", "tag_b"], file_path=test_file)
    log_chat("user", "Message with tag C", tags=["tag_c"], file_path=test_file)
    log_chat("assistant", "Response with no tags", file_path=test_file)
    
    # Test filtering with each tag
    for tag in ["tag_a", "tag_b", "tag_c"]:
        history = get_recent_history(tag=tag, file_path=test_file)
        print(f"\nEntries with tag '{tag}': {len(history)}")
        for i, entry in enumerate(history):
            print(f"{i+1}. {entry['role']}: {entry['content']} (tags: {entry.get('tags', [])})")
    
    # Clean up
    os.remove(test_file)

if __name__ == "__main__":
    print("\n=== ENHANCED CHAT HISTORY MODULE TEST ===")
    print(f"Running tests at {datetime.now().isoformat()}")
    
    # Run all tests
    test_empty_history()
    test_malformed_entries()
    test_multi_context_operations()
    test_langchain_format_validation()
    test_filtering_by_multiple_tags()
    
    print("\n=== ALL ENHANCED TESTS COMPLETED ===\n") 
 