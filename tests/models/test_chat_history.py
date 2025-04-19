"""
Test script for the chat history module.
"""
import sys
from pathlib import Path
from datetime import datetime

# Add the workspace to the path so we can import modules
sys.path.append(str(Path(__file__).resolve().parent))

# Import chat history functions
from apps.agents.shared.memory.chat_history import (
    log_chat, 
    get_recent_history, 
    format_for_langchain,
    clear_history,
    log_to_context,
    get_context_history
)

def test_basic_chat_history():
    """Test basic chat history logging and retrieval."""
    print("\n=== Testing Basic Chat History ===")
    
    # Clear any existing history for clean test
    clear_history()
    print("Cleared existing chat history")
    
    # Log some test messages
    print("Logging test messages...")
    log_chat("user", "Hello, how are you?")
    log_chat("assistant", "I'm doing well, thank you! How can I help you today?")
    log_chat("user", "Tell me about marketing strategies for startups")
    log_chat("assistant", "For startups, I recommend focusing on low-cost, high-impact strategies like content marketing and social media.", tags=["marketing"])
    
    # Retrieve recent history
    print("\nRetrieving recent history...")
    history = get_recent_history(n=10)
    
    print(f"Found {len(history)} entries:")
    for i, entry in enumerate(history):
        print(f"{i+1}. {entry['role']}: {entry['content'][:50]}... ({entry.get('timestamp')})")
    
    # Convert to LangChain format
    print("\nConverting to LangChain format...")
    langchain_messages = format_for_langchain(history)
    print(f"LangChain messages: {len(langchain_messages)} entries")
    for i, msg in enumerate(langchain_messages):
        print(f"{i+1}. Type: {type(msg).__name__}, Content: {msg.content[:50]}...")

def test_tagged_history():
    """Test chat history with tags."""
    print("\n=== Testing Tagged Chat History ===")
    
    # Log messages with different tags
    print("Logging messages with tags...")
    log_chat("user", "Let's discuss our social media strategy", tags=["marketing", "social"])
    log_chat("assistant", "Social media is crucial for brand awareness. Let's focus on Instagram and Twitter.", tags=["marketing", "social"])
    log_chat("user", "What about our budget for Q3?", tags=["finance"])
    log_chat("assistant", "For Q3, I recommend allocating 40% to digital ads, 30% to content creation, and 30% to analytics tools.", tags=["finance", "budget"])
    
    # Get recent history with specific tag
    print("\nRetrieving history with 'social' tag...")
    social_history = get_recent_history(n=10, tag="social")
    print(f"Found {len(social_history)} entries with 'social' tag:")
    for i, entry in enumerate(social_history):
        print(f"{i+1}. {entry['role']}: {entry['content'][:50]}...")
        
    # Get recent history with finance tag
    print("\nRetrieving history with 'finance' tag...")
    finance_history = get_recent_history(n=10, tag="finance")
    print(f"Found {len(finance_history)} entries with 'finance' tag:")
    for i, entry in enumerate(finance_history):
        print(f"{i+1}. {entry['role']}: {entry['content'][:50]}...")

def test_context_specific_history():
    """Test context-specific chat history."""
    print("\n=== Testing Context-Specific Chat History ===")
    
    # Log to specific contexts
    print("Logging messages to specific contexts...")
    log_to_context("campaign_planning", "user", "Let's plan our summer campaign")
    log_to_context("campaign_planning", "assistant", "Great! For summer, I suggest a beach-themed campaign focusing on refreshment and outdoor activities.")
    log_to_context("campaign_planning", "user", "What's our target audience?")
    log_to_context("campaign_planning", "assistant", "For this summer campaign, let's target 18-34 year olds who are active on Instagram and TikTok.")
    
    log_to_context("website_redesign", "user", "We need to update our website")
    log_to_context("website_redesign", "assistant", "I recommend a mobile-first approach with improved UX and faster loading times.")
    
    # Get campaign planning context
    print("\nRetrieving 'campaign_planning' context history...")
    campaign_history = get_context_history("campaign_planning")
    print(f"Found {len(campaign_history)} entries in campaign_planning context:")
    for i, entry in enumerate(campaign_history):
        print(f"{i+1}. {entry['role']}: {entry['content'][:50]}...")
    
    # Get website redesign context
    print("\nRetrieving 'website_redesign' context history...")
    website_history = get_context_history("website_redesign")
    print(f"Found {len(website_history)} entries in website_redesign context:")
    for i, entry in enumerate(website_history):
        print(f"{i+1}. {entry['role']}: {entry['content'][:50]}...")

if __name__ == "__main__":
    print("\n=== CHAT HISTORY MODULE TEST ===")
    print(f"Running tests at {datetime.now().isoformat()}")
    
    test_basic_chat_history()
    test_tagged_history()
    test_context_specific_history()
    
    print("\n=== ALL TESTS COMPLETED ===\n") 