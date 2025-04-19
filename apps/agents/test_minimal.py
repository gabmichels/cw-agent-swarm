"""
Minimal test that only imports and uses PerceptionTools.
"""
import os
import sys
from pathlib import Path

# Add the project root to the path
ROOT_DIR = Path(__file__).parent.parent.parent
sys.path.append(str(ROOT_DIR))
print(f"Added {ROOT_DIR} to path")

# Simple test that only imports and runs one method
try:
    print("Importing PerceptionTools...")
    from apps.agents.shared.tools.perception_tools import PerceptionTools
    print("✅ Successfully imported PerceptionTools")
    
    # Try one simple method
    print("\nTrying PerceptionTools.get_trending_topics()...")
    result = PerceptionTools.get_trending_topics("technology")
    print(f"Result: {result}")
    
except Exception as e:
    print(f"❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()

print("\nTest complete")

if __name__ == "__main__":
    print("Running as main module") 