"""
Simple test to debug perception module imports.
This file tests basic imports and checks file paths.
"""
import os
import sys
from pathlib import Path

# Add the project root to the path
ROOT_DIR = Path(__file__).parent.parent.parent
sys.path.append(str(ROOT_DIR))
print(f"Added {ROOT_DIR} to path")

# Print data directory path and check if it exists
DATA_DIR = Path(__file__).parent / "shared" / "perception" / "data"
print(f"Data directory: {DATA_DIR}")
print(f"Data directory exists: {DATA_DIR.exists()}")

try:
    print("\nTrying to import perception modules...")
    # Try importing modules one by one
    print("Importing news_monitor...")
    from apps.agents.shared.perception.news_monitor import get_combined_news
    print("✅ Successfully imported news_monitor")
    
    print("Importing rss_feed...")
    from apps.agents.shared.perception.rss_feed import fetch_rss_feeds
    print("✅ Successfully imported rss_feed")
    
    print("Importing reddit_monitor...")
    from apps.agents.shared.perception.reddit_monitor import fetch_reddit_posts
    print("✅ Successfully imported reddit_monitor")
    
    print("Importing data_collector...")
    from apps.agents.shared.perception.data_collector import collect_data
    print("✅ Successfully imported data_collector")
    
    print("All basic imports successful!")
    
except Exception as e:
    print(f"❌ Import error: {str(e)}")
    import traceback
    traceback.print_exc()

print("\nTest complete")

if __name__ == "__main__":
    print("Running as main module") 