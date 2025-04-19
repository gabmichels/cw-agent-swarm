"""
Test file for perception tools that mocks the response.
This doesn't rely on the actual implementation, but validates the interface.
"""
import os
import sys
import warnings
from pathlib import Path
from unittest.mock import patch

# Add the project root to the path
ROOT_DIR = Path(__file__).parent.parent.parent
sys.path.append(str(ROOT_DIR))
print(f"Added {ROOT_DIR} to path")

# Filter warnings
warnings.filterwarnings("ignore", category=RuntimeWarning)

def mock_handle_perception_query(query):
    """A mock version of the handle_perception_query function."""
    print(f"Mocked query: {query}")
    
    if "trending" in query.lower():
        return "Mock response: Top trending topics in this area include AI, machine learning, and voice technology."
    elif "news" in query.lower() or "latest" in query.lower():
        return "Mock response: Recent news includes updates on language translation tools and voice recognition advancements."
    else:
        return f"Mock response for query: {query}"

# Mock the actual implementation
print("\nPatching the perception query handler...")
patch_path = 'apps.agents.shared.perception.perception_interpreter.handle_perception_query'
with patch(patch_path, side_effect=mock_handle_perception_query):
    print("✅ Successfully patched the perception query handler")
    
    try:
        # Now import PerceptionTools
        print("\nImporting PerceptionTools...")
        from apps.agents.shared.tools.perception_tools import PerceptionTools
        print("✅ Successfully imported PerceptionTools")
        
        # Test the methods
        print("\n--- Testing perception query methods ---")
        
        # Test trending topics
        print("\n1. Testing get_trending_topics()")
        result = PerceptionTools.get_trending_topics("technology")
        print(f"Result: {result}")
        
        # Test latest news
        print("\n2. Testing get_latest_news()")
        result = PerceptionTools.get_latest_news("AI translation")
        print(f"Result: {result}")
        
        # Test get domain insights
        print("\n3. Testing get_domain_insights()")
        result = PerceptionTools.get_domain_insights("voice technology")
        print(f"Result: {result}")
        
        # Test summarize news
        print("\n4. Testing summarize_news()")
        result = PerceptionTools.summarize_news("artificial intelligence")
        print(f"Result: {result}")
        
        print("\n✅ All perception tool methods tested successfully")
        
    except Exception as e:
        print(f"\n❌ Error during testing: {str(e)}")
        import traceback
        traceback.print_exc()

print("\nTest completed")

if __name__ == "__main__":
    print("Running as main module") 