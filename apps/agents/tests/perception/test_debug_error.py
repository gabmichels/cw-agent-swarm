"""
Debug test file that catches and prints detailed exception information.
"""
import os
import sys
import traceback
from pathlib import Path

# Add the project root to the path
ROOT_DIR = Path(__file__).parent.parent.parent
sys.path.append(str(ROOT_DIR))
print(f"Added {ROOT_DIR} to path")

def test_import(module_name, import_statement):
    """Test importing a module and print detailed exception info if it fails."""
    print(f"\nTesting import: {module_name}")
    try:
        exec(import_statement)
        print(f"✅ Successfully imported {module_name}")
        return True
    except Exception as e:
        print(f"❌ Error importing {module_name}: {type(e).__name__}: {str(e)}")
        traceback.print_exc()
        return False

# Create testing sequence
test_sequence = [
    ("rss_feed", "from apps.agents.shared.perception.rss_feed import fetch_rss_feeds"),
    ("reddit_monitor", "from apps.agents.shared.perception.reddit_monitor import fetch_reddit_posts"),
    ("news_monitor", "from apps.agents.shared.perception.news_monitor import get_combined_news"),
    ("perception_interpreter", "from apps.agents.shared.perception.perception_interpreter import PerceptionInterpreter"),
    ("data_collector", "from apps.agents.shared.perception.data_collector import collect_data"),
    ("perception_tools", "from apps.agents.shared.tools.perception_tools import PerceptionTools"),
]

# Run the tests
print("Starting import tests...\n")
for name, import_stmt in test_sequence:
    if not test_import(name, import_stmt):
        print(f"🛑 Test sequence stopped at {name}")
        break

print("\nImport tests completed")

# Try to use PerceptionTools if imported successfully
try:
    print("\nAttempting to use PerceptionTools.get_trending_topics()")
    from apps.agents.shared.tools.perception_tools import PerceptionTools
    result = PerceptionTools.get_trending_topics("technology")
    print(f"Result: {result}")
except Exception as e:
    print(f"❌ Error using PerceptionTools: {type(e).__name__}: {str(e)}")
    traceback.print_exc()

if __name__ == "__main__":
    print("Running as main module") 