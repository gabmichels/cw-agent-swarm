"""
Minimal test that ignores NumPy warnings and tests basic functionality.
"""
import os
import sys
import warnings
from pathlib import Path

# Add the project root to the path
ROOT_DIR = Path(__file__).parent.parent.parent
sys.path.append(str(ROOT_DIR))
print(f"Added {ROOT_DIR} to path")

# Filter out NumPy runtime warnings
warnings.filterwarnings("ignore", category=RuntimeWarning)
print("⚠️ NumPy runtime warnings are now being filtered")

try:
    print("\nImporting required modules...")
    
    # Import the perception tools directly
    from apps.agents.shared.tools.perception_tools import PerceptionTools
    print("✅ Successfully imported PerceptionTools")
    
    # Simple test - query trending topics
    print("\nTesting basic query functionality...")
    
    # Call the trending topics function
    topic = "technology"
    print(f"Querying trending topics in {topic}...")
    
    try:
        response = PerceptionTools.get_trending_topics(topic)
        print(f"Response: {response}")
        print("✅ Query successful!")
    except Exception as e:
        print(f"❌ Error during query: {str(e)}")
        import traceback
        traceback.print_exc()
    
except Exception as e:
    print(f"❌ Import error: {str(e)}")
    import traceback
    traceback.print_exc()

print("\nTest completed")

if __name__ == "__main__":
    print("Running as main module") 