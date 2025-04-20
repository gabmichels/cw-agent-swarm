"""
Test script for the reflection system.

This script tests the functionality of the reflection system,
including local storage and Coda integration.
"""

import sys
import os
import json
from pathlib import Path
from datetime import datetime

# Add the root directory to the Python path
root_dir = str(Path(__file__).parent.parent.parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

try:
    from apps.agents.shared.tools.reflection_tools import (
        create_reflection,
        create_weekly_reflection,
        get_recent_reflections,
        search_reflections
    )
    from apps.agents.shared.config import CODA_AVAILABLE
except ImportError as e:
    print(f"Import error: {e}")
    print(f"Current sys.path: {sys.path}")
    sys.exit(1)

def test_create_reflection():
    """Test creating a basic reflection."""
    print("Testing basic reflection creation...")
    
    content = """# Test Reflection
    
This is a test reflection created by the test script.

## Key Points
- Testing local storage
- Testing structure
- Verifying metadata
"""
    
    result = create_reflection(
        content=content,
        title="Test Reflection",
        tags=["test", "automation"],
        importance="low"
    )
    
    print(f"Creation success: {result['success']}")
    print(f"Title: {result['title']}")
    print(f"Saved at: {result['filepath']}")
    print(f"Coda publishing: {result['coda_publishing']['success'] if CODA_AVAILABLE else 'not available'}")
    
    return result

def test_create_weekly_reflection():
    """Test creating a weekly reflection."""
    print("\nTesting weekly reflection creation...")
    
    week_num = datetime.now().isocalendar()[1]
    
    content = f"""# Weekly Reflection - Week {week_num}
    
This is a test weekly reflection for week {week_num}.

## Achievements
- Created reflection system
- Implemented local storage
- Added Coda integration

## Plans for Next Week
- Add more features
- Improve testing
- Document the system
"""
    
    result = create_weekly_reflection(
        content=content,
        tags=["test", "automation"]
    )
    
    print(f"Creation success: {result['success']}")
    print(f"Title: {result['title']}")
    print(f"Saved at: {result['filepath']}")
    print(f"Coda publishing: {result['coda_publishing']['success'] if CODA_AVAILABLE else 'not available'}")
    
    return result

def test_get_recent_reflections():
    """Test retrieving recent reflections."""
    print("\nTesting retrieval of recent reflections...")
    
    result = get_recent_reflections(limit=3)
    
    print(f"Retrieval success: {result['success']}")
    print(f"Number of reflections: {result['count']}")
    print(f"Source: {result.get('source', 'unknown')}")
    
    if result['count'] > 0:
        print("\nReflection titles:")
        for reflection in result['reflections']:
            print(f"- {reflection.get('title', 'Untitled')}")
    
    return result

def test_search_reflections():
    """Test searching for reflections."""
    print("\nTesting search functionality...")
    
    queries = ["test", "weekly", "achievements"]
    
    for query in queries:
        print(f"\nSearching for '{query}'...")
        result = search_reflections(query, limit=5)
        
        print(f"Search success: {result['success']}")
        print(f"Number of matches: {result['count']}")
        print(f"Source: {result.get('source', 'unknown')}")
        
        if result['count'] > 0:
            print("\nMatching reflection titles:")
            for reflection in result['reflections']:
                print(f"- {reflection.get('title', 'Untitled')}")
    
    # Return result from last query
    return result

def examine_reflection_storage():
    """Examine the local reflection storage."""
    print("\nExamining local reflection storage...")
    
    # Get the reflection directory
    reflection_dir = Path(__file__).parent.parent / "data" / "reflections"
    if not reflection_dir.exists():
        print(f"Reflection directory not found at {reflection_dir}")
        return
    
    # Count files
    reflection_files = list(reflection_dir.glob("*.json"))
    print(f"Found {len(reflection_files)} reflection files")
    
    # Read a sample
    if reflection_files:
        sample_file = reflection_files[0]
        print(f"\nSample reflection file: {sample_file.name}")
        
        try:
            with open(sample_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                print(f"Title: {data.get('title', 'Untitled')}")
                print(f"Type: {data.get('metadata', {}).get('type', 'unknown')}")
                tags = data.get('metadata', {}).get('tags', [])
                if tags:
                    print(f"Tags: {', '.join(tags)}")
                content_preview = data.get('content', '').split('\n')[0][:50] + "..."
                print(f"Content preview: {content_preview}")
        except Exception as e:
            print(f"Error reading file: {e}")

def run_all_tests():
    """Run all tests in sequence."""
    print("=== REFLECTION SYSTEM TESTS ===")
    print(f"Coda integration available: {CODA_AVAILABLE}")
    print("==============================\n")
    
    # Create reflections
    test_create_reflection()
    test_create_weekly_reflection()
    
    # Retrieve and search
    test_get_recent_reflections()
    test_search_reflections()
    
    # Examine storage
    examine_reflection_storage()
    
    print("\n=== TESTS COMPLETED ===")

if __name__ == "__main__":
    run_all_tests() 