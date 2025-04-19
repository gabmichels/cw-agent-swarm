"""
A simplified test for the reflection system without any dependencies.
This will create a basic reflection and save it to disk.
"""
import json
import sys
import os
from pathlib import Path
from datetime import datetime

# Add the current directory to the path
current_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(current_dir))

class SimpleReflection:
    """A simplified version of the reflection system for testing."""
    
    def __init__(self):
        """Initialize with a file in the current directory."""
        self.file_path = Path(current_dir) / "test_reflection.json"
        self.reflections = []
        
    def add_reflection(self, content):
        """Add a basic reflection."""
        reflection = {
            "id": f"reflection_{len(self.reflections) + 1}",
            "content": content,
            "created_at": datetime.now().isoformat()
        }
        
        self.reflections.append(reflection)
        
        # Save to disk
        with open(self.file_path, "w") as f:
            json.dump(self.reflections, f, indent=2)
            
        print(f"Saved reflection to {self.file_path}")
        return reflection

def main():
    """Run a simple test of the reflection system."""
    print("=== Simple Reflection Test ===")
    print(f"Current directory: {os.getcwd()}")
    
    # Create a reflection
    reflection_system = SimpleReflection()
    reflection = reflection_system.add_reflection(
        "This is a test reflection to verify file writing capabilities."
    )
    
    print(f"Created reflection: {reflection['id']}")
    print(f"Content: {reflection['content']}")
    
    # Verify file exists
    file_path = reflection_system.file_path
    print(f"File path: {file_path}")
    print(f"File exists: {file_path.exists()}")
    
    if file_path.exists():
        print("Test passed!")
    
if __name__ == "__main__":
    main() 