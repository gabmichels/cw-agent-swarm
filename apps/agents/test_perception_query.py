"""
Test script for the perception query capabilities.

This script demonstrates how an agent can query the perception layer
to get information about trends, news, and insights.
"""
import os
import sys
from pathlib import Path

# Add the project root to the path
ROOT_DIR = Path(__file__).parent.parent.parent
sys.path.append(str(ROOT_DIR))

# Import the perception tools
from apps.agents.shared.tools.perception_tools import PerceptionTools

def test_perception_queries():
    """Run a series of test queries on the perception system."""
    test_queries = [
        "What's trending in marketing this week?",
        "Latest news about AI translation?",
        "What's happening in travel today?",
        "Insights on voice technology?",
        "Summarize AI news"
    ]
    
    print("\n=== PERCEPTION QUERY TEST ===")
    print("This demonstrates how Chloe can query external data sources for trends and news.\n")
    
    for query in test_queries:
        print(f"\n📊 QUERY: \"{query}\"")
        print("-" * 50)
        
        try:
            response = PerceptionTools.query_perception(query)
            print(f"RESPONSE:\n{response}")
        except Exception as e:
            print(f"Error: {str(e)}")
        
        print("-" * 50)
    
    # Test more specific tool functions
    print("\n\n=== SPECIFIC PERCEPTION TOOLS ===\n")
    
    print("\n📈 TRENDING TOPICS IN MARKETING:")
    print("-" * 50)
    try:
        response = PerceptionTools.get_trending_topics("marketing")
        print(f"{response}")
    except Exception as e:
        print(f"Error: {str(e)}")
    print("-" * 50)
    
    print("\n📰 LATEST NEWS ABOUT VOICE TECHNOLOGY:")
    print("-" * 50)
    try:
        response = PerceptionTools.get_latest_news("voice technology")
        print(f"{response}")
    except Exception as e:
        print(f"Error: {str(e)}")
    print("-" * 50)
    
    print("\n🧠 INSIGHTS ON AI:")
    print("-" * 50)
    try:
        response = PerceptionTools.get_domain_insights("AI")
        print(f"{response}")
    except Exception as e:
        print(f"Error: {str(e)}")
    print("-" * 50)

if __name__ == "__main__":
    test_perception_queries() 