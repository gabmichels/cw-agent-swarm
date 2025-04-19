"""
Test file that checks the data directory structure and ensures all required files exist.
"""
import os
import sys
import json
from pathlib import Path

# Add the project root to the path
ROOT_DIR = Path(__file__).parent.parent.parent
sys.path.append(str(ROOT_DIR))
print(f"Added {ROOT_DIR} to path")

# Data directory path
DATA_DIR = Path(__file__).parent / "shared" / "perception" / "data"
print(f"Data directory: {DATA_DIR}")
print(f"Data directory exists: {DATA_DIR.exists()}")

# Create the data directory if it doesn't exist
if not DATA_DIR.exists():
    print("Creating data directory...")
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Data directory created: {DATA_DIR.exists()}")

# Check required cache files
cache_files = {
    "RSS Cache": DATA_DIR / "rss_cache.json",
    "Reddit Cache": DATA_DIR / "reddit_cache.json",
    "Collection Log": DATA_DIR / "collection_log.json"
}

print("\nChecking required cache files:")
for name, file_path in cache_files.items():
    exists = file_path.exists()
    print(f"- {name}: {'✅ Exists' if exists else '❌ Missing'}")
    
    # Create empty cache files if missing
    if not exists:
        print(f"  Creating empty {name} file...")
        
        # Create basic structure for each file type
        if "rss_cache" in str(file_path):
            data = {
                "timestamp": "2023-11-01T00:00:00",
                "articles": []
            }
        elif "reddit_cache" in str(file_path):
            data = {
                "timestamp": "2023-11-01T00:00:00",
                "posts": []
            }
        elif "collection_log" in str(file_path):
            data = {
                "tasks": []
            }
        else:
            data = {}
            
        # Write the file
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
            
        print(f"  ✅ {name} file created.")

print("\nData directory structure check completed.")

if __name__ == "__main__":
    print("Running as main module") 