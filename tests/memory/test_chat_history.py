"""
Test script for the chat history module.
"""
import os
import sys
import unittest
from pathlib import Path
from datetime import datetime

# Set up proper imports
project_root = Path(__file__).parent.parent.parent
sys.path.append(str(project_root))

# Import the chat history module after path setup
from shared.agent_core.memory.chat_history import (
    log_chat,
    get_recent_history,
    filter_by_tag,
    clear_history,
    format_for_langchain
)

class TestChatHistory(unittest.TestCase):
    """Test cases for the chat history module"""
    
    def setUp(self):
        """Set up test environment"""
        # Clear history before each test
        clear_history("test_agent")
        
    def test_log_and_retrieve(self):
        """Test logging and retrieving chat messages"""
        # Log some test messages
        log_chat("test_agent", "user", "Hello there", tags=["greeting"])
        log_chat("test_agent", "assistant", "Hi! How can I help you?", tags=["greeting", "help"])
        log_chat("test_agent", "user", "I need help with marketing", tags=["help", "marketing"])
        
        # Retrieve recent history
        history = get_recent_history("test_agent", limit=10)
        
        # Check that we have the expected number of messages
        self.assertEqual(len(history), 3)
        
        # Check the content of the messages
        self.assertEqual(history[0]["content"], "Hello there")
        self.assertEqual(history[1]["content"], "Hi! How can I help you?")
        self.assertEqual(history[2]["content"], "I need help with marketing")
        
    def test_filter_by_tag(self):
        """Test filtering chat messages by tag"""
        # Log some test messages with different tags
        log_chat("test_agent", "user", "Hello there", tags=["greeting"])
        log_chat("test_agent", "assistant", "Hi! How can I help you?", tags=["greeting", "help"])
        log_chat("test_agent", "user", "I need help with marketing", tags=["help", "marketing"])
        log_chat("test_agent", "assistant", "Sure, I can help with marketing", tags=["marketing"])
        
        # Filter by "greeting" tag
        greeting_messages = filter_by_tag("test_agent", "greeting")
        self.assertEqual(len(greeting_messages), 2)
        
        # Filter by "marketing" tag
        marketing_messages = filter_by_tag("test_agent", "marketing")
        self.assertEqual(len(marketing_messages), 2)
        
        # Filter by "help" tag
        help_messages = filter_by_tag("test_agent", "help")
        self.assertEqual(len(help_messages), 2)
        
    def test_format_for_langchain(self):
        """Test formatting chat history for LangChain"""
        # Log some test messages
        log_chat("test_agent", "user", "Hello there")
        log_chat("test_agent", "assistant", "Hi! How can I help you?")
        
        # Get formatted history
        formatted = format_for_langchain("test_agent")
        
        # Check the format
        self.assertEqual(len(formatted), 2)
        self.assertEqual(formatted[0].type, "human")
        self.assertEqual(formatted[0].content, "Hello there")
        self.assertEqual(formatted[1].type, "ai")
        self.assertEqual(formatted[1].content, "Hi! How can I help you?")
        
    def tearDown(self):
        """Clean up after each test"""
        clear_history("test_agent")

if __name__ == "__main__":
    unittest.main() 