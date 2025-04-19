"""
Simple test script for the reflection system.
"""
import sys
import os
from pathlib import Path
import json
from datetime import datetime

# Ensure the current directory is in the path
current_dir = Path(__file__).resolve().parent
if str(current_dir) not in sys.path:
    sys.path.insert(0, str(current_dir))

# Import our modules without using the apps prefix
try:
    from shared.memory.reflection import ReflectionSystem, reflection_system
    print("Successfully imported reflection_system.")
except ImportError as e:
    print(f"Error importing reflection_system: {e}")
    sys.exit(1)

def test_reflection():
    """Test the reflection system's basic features."""
    print("\n=== Testing Reflection System ===")
    
    # Create a reflection directly
    reflection = reflection_system.add_reflection(
        insight="This is a test reflection created directly.",
        source_memory_ids=["test_memory_1", "test_memory_2"],
        related_concepts=["test", "reflection"],
        metadata={"test": True}
    )
    
    print(f"Created reflection with ID: {reflection['id']}")
    print(f"Content: {reflection['content']}")
    print(f"Related concepts: {reflection['related_concepts']}")
    
    # Get all reflections
    all_reflections = reflection_system.get_all_reflections()
    print(f"Total reflections: {len(all_reflections)}")
    
    # Get the latest reflection
    latest = reflection_system.get_latest_reflections(1)
    if latest:
        print(f"Latest reflection ID: {latest[0]['id']}")
    else:
        print("No reflections found.")
    
    # Check that our reflection was saved
    reflection_path = reflection_system.reflection_file
    print(f"\nReflection file path: {reflection_path}")
    print(f"File exists: {reflection_path.exists()}")
    
    if reflection_path.exists():
        try:
            with open(reflection_path, "r") as f:
                data = json.load(f)
                print(f"Loaded {len(data)} reflections from file.")
        except Exception as e:
            print(f"Error loading reflections: {e}")

def main():
    """Run the test."""
    print("REFLECTION SYSTEM TEST")
    print("=====================")
    
    print(f"Current directory: {os.getcwd()}")
    
    # Test the reflection system
    test_reflection()
    
    print("\nTest completed.")

if __name__ == "__main__":
    main() 