"""
Test script for the intent preprocessing system.

This script demonstrates how the Gemini-based intent preprocessing
can understand the meaning behind different phrasings of similar requests.
"""
import os
import sys
import json
from pathlib import Path

# Add the project root to the path
ROOT_DIR = Path(__file__).parent.parent.parent
sys.path.append(str(ROOT_DIR))

# Import the intent preprocessing
from apps.agents.shared.intent import preprocess_message, route_intent, get_intent_statistics

def test_intent_preprocessing():
    """Test the intent preprocessing system."""
    
    print("\n=== INTENT PREPROCESSING TEST ===")
    print("This demonstrates how Chloe can understand the intent behind different phrasings.")
    print("We'll test various ways to request research, information, and tasks.\n")
    
    # Test a variety of research request phrasings
    research_phrases = [
        "Can you look into the latest trends in AI translation?",
        "Bring yourself up to speed on language barriers in customer service",
        "Is there anything on social media about voice recognition problems?",
        "I need you to research marketing automation tools",
        "Inform yourself about recent developments in chatbot technology",
        "Could you gather some information on competitor pricing strategies?",
        "I'd like you to find out what's happening with TikTok marketing trends"
    ]
    
    print("=== RESEARCH REQUEST VARIATIONS ===")
    for phrase in research_phrases:
        result = route_intent(phrase)
        print(f"\nUser: {phrase}")
        print(f"Detected Intent: {result.get('intent')} (Confidence: {result.get('confidence', 0):.2f})")
        print(f"Action: {result.get('action', 'unknown')}")
        if "tool_chain" in result:
            print("Suggested Tools:", ", ".join(result.get("tool_chain", {}).get("primary_tools", [])))
        
        # Print extracted parameters
        parameters = result.get("preprocessing_result", {}).get("parameters", {})
        if parameters:
            print("Parameters:", json.dumps(parameters, indent=2))
        print("-" * 50)
    
    # Test information queries
    info_phrases = [
        "What do you know about our marketing campaign performance?",
        "Tell me about our Twitter engagement",
        "Any insights on voice assistants?",
        "Have we done anything related to Instagram marketing?",
        "I'd like to know what we've learned about Gen Z consumers"
    ]
    
    print("\n\n=== INFORMATION QUERY VARIATIONS ===")
    for phrase in info_phrases:
        result = route_intent(phrase)
        print(f"\nUser: {phrase}")
        print(f"Detected Intent: {result.get('intent')} (Confidence: {result.get('confidence', 0):.2f})")
        print(f"Action: {result.get('action', 'unknown')}")
        if "tool_chain" in result:
            print("Suggested Tools:", ", ".join(result.get("tool_chain", {}).get("primary_tools", [])))
        
        # Print extracted parameters
        parameters = result.get("preprocessing_result", {}).get("parameters", {})
        if parameters:
            print("Parameters:", json.dumps(parameters, indent=2))
        print("-" * 50)
    
    # Test task requests
    task_phrases = [
        "Create a blog post about AI ethics",
        "I need you to draft a newsletter about our new product",
        "Schedule a meeting with the marketing team for tomorrow",
        "Can you make a social media calendar for next month?",
        "Please prepare a competitive analysis report"
    ]
    
    print("\n\n=== TASK REQUEST VARIATIONS ===")
    for phrase in task_phrases:
        result = route_intent(phrase)
        print(f"\nUser: {phrase}")
        print(f"Detected Intent: {result.get('intent')} (Confidence: {result.get('confidence', 0):.2f})")
        print(f"Action: {result.get('action', 'unknown')}")
        if "tool_chain" in result:
            print("Suggested Tools:", ", ".join(result.get("tool_chain", {}).get("primary_tools", [])))
        
        # Print extracted parameters
        parameters = result.get("preprocessing_result", {}).get("parameters", {})
        if parameters:
            print("Parameters:", json.dumps(parameters, indent=2))
        print("-" * 50)
    
    # Print overall statistics
    print("\n\n=== KNOWN INTENTS STATISTICS ===")
    stats = get_intent_statistics()
    for intent, data in stats.items():
        print(f"Intent: {intent}")
        print(f"  Description: {data.get('description', 'No description')}")
        print(f"  Count: {data.get('count', 0)}")
        print(f"  Last seen: {data.get('last_seen', 'Never')}")
        print()

if __name__ == "__main__":
    test_intent_preprocessing() 