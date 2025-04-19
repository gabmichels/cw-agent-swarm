"""
A self-contained example of a memory and reflection system.
This does not rely on any external modules and implements everything
directly in this script for demonstration purposes.
"""
import json
import os
from pathlib import Path
import random
from datetime import datetime
import uuid

# File paths
BASE_DIR = Path(__file__).resolve().parent
MEMORY_FILE = BASE_DIR / "example_memories.json"
REFLECTION_FILE = BASE_DIR / "example_reflections.json"

class MemorySystem:
    """A simple memory system for storing experiences."""
    
    def __init__(self, memory_file=MEMORY_FILE):
        """Initialize the memory system."""
        self.memory_file = memory_file
        self.memories = self._load_memories()
    
    def _load_memories(self):
        """Load memories from disk."""
        if not self.memory_file.exists():
            return []
            
        try:
            with open(self.memory_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return []
    
    def _save_memories(self):
        """Save memories to disk."""
        with open(self.memory_file, "w", encoding="utf-8") as f:
            json.dump(self.memories, f, indent=2)
    
    def add_memory(self, content, memory_type="observation", importance=0.5, metadata=None):
        """Add a new memory."""
        if metadata is None:
            metadata = {}
            
        timestamp = datetime.now().isoformat()
        memory_id = f"memory_{uuid.uuid4().hex[:8]}"
        
        memory = {
            "id": memory_id,
            "type": memory_type,
            "content": content,
            "importance": importance,
            "created_at": timestamp,
            "metadata": metadata
        }
        
        self.memories.append(memory)
        self._save_memories()
        
        return memory
    
    def get_memory(self, memory_id):
        """Get a memory by ID."""
        for memory in self.memories:
            if memory["id"] == memory_id:
                return memory
        return None
    
    def get_all_memories(self):
        """Get all memories."""
        return self.memories
    
    def get_memories_by_type(self, memory_type):
        """Get all memories of a specific type."""
        return [m for m in self.memories if m["type"] == memory_type]

class ReflectionSystem:
    """A system for generating reflections based on memories."""
    
    def __init__(self, reflection_file=REFLECTION_FILE, memory_system=None):
        """Initialize the reflection system."""
        self.reflection_file = reflection_file
        self.memory_system = memory_system
        self.reflections = self._load_reflections()
    
    def _load_reflections(self):
        """Load reflections from disk."""
        if not self.reflection_file.exists():
            return []
            
        try:
            with open(self.reflection_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return []
    
    def _save_reflections(self):
        """Save reflections to disk."""
        with open(self.reflection_file, "w", encoding="utf-8") as f:
            json.dump(self.reflections, f, indent=2)
    
    def add_reflection(self, insight, source_memory_ids=None, metadata=None):
        """Add a new reflection."""
        if source_memory_ids is None:
            source_memory_ids = []
            
        if metadata is None:
            metadata = {}
            
        timestamp = datetime.now().isoformat()
        
        reflection = {
            "id": f"reflection_{len(self.reflections) + 1}",
            "content": insight,
            "source_memory_ids": source_memory_ids,
            "created_at": timestamp,
            "metadata": metadata
        }
        
        self.reflections.append(reflection)
        self._save_reflections()
        
        # If a memory system is available, also add as a memory
        if self.memory_system:
            self.memory_system.add_memory(
                content=insight,
                memory_type="reflection",
                importance=0.8,
                metadata={"reflection_id": reflection["id"]}
            )
        
        return reflection
    
    def get_reflection(self, reflection_id):
        """Get a reflection by ID."""
        for reflection in self.reflections:
            if reflection["id"] == reflection_id:
                return reflection
        return None
    
    def get_all_reflections(self):
        """Get all reflections."""
        return self.reflections
    
    def analyze_memories(self, memory_limit=5, memory_type=None, prompt=None):
        """Generate a reflection from memories."""
        if not self.memory_system:
            return self.add_reflection(
                "No memory system available for analysis.",
                metadata={"error": "No memory system"}
            )
        
        # Get memories
        if memory_type:
            memories = self.memory_system.get_memories_by_type(memory_type)
        else:
            memories = self.memory_system.get_all_memories()
        
        # Limit and sort by recency
        memories = sorted(
            memories,
            key=lambda x: x["created_at"],
            reverse=True
        )[:memory_limit]
        
        if not memories:
            return self.add_reflection(
                "No memories available for analysis.",
                metadata={"error": "No memories"}
            )
        
        # Generate a simple analysis
        memory_count = len(memories)
        memory_types = {}
        
        for memory in memories:
            mem_type = memory.get("type", "unknown")
            memory_types[mem_type] = memory_types.get(mem_type, 0) + 1
        
        # Create a simple insight
        insight = f"Analysis of {memory_count} memories"
        
        if prompt:
            insight += f" based on prompt: {prompt}"
            
        if memory_types:
            type_summary = ", ".join([f"{count} {mem_type}" for mem_type, count in memory_types.items()])
            insight += f"\n\nMemory types: {type_summary}"
        
        # Add example insights
        insights = [
            f"Found {memory_count} memories to analyze",
            f"The memories span {len(memory_types)} different types"
        ]
        
        insight += "\n\nInsights:\n- " + "\n- ".join(insights)
        
        # Add as a reflection
        return self.add_reflection(
            insight=insight,
            source_memory_ids=[m["id"] for m in memories],
            metadata={
                "memory_count": memory_count,
                "memory_types": list(memory_types.keys()),
                "prompt": prompt
            }
        )

def run_demonstration():
    """Run a demonstration of the memory and reflection systems."""
    print("=" * 50)
    print("MEMORY & REFLECTION SYSTEM DEMONSTRATION")
    print("=" * 50)
    
    # Create the systems
    memory_system = MemorySystem()
    reflection_system = ReflectionSystem(memory_system=memory_system)
    
    print(f"Memory file: {memory_system.memory_file}")
    print(f"Reflection file: {reflection_system.reflection_file}")
    
    # Step 1: Add some memories
    print("\n1. Adding memories...")
    
    memory_types = ["observation", "conversation", "action"]
    for i in range(5):
        memory_type = random.choice(memory_types)
        memory = memory_system.add_memory(
            content=f"Example {memory_type} memory #{i+1}",
            memory_type=memory_type,
            importance=random.random(),
            metadata={"example_id": i+1}
        )
        print(f"  Added memory: {memory['id']} ({memory['type']})")
    
    # Step 2: Create a direct reflection
    print("\n2. Creating a direct reflection...")
    
    reflection = reflection_system.add_reflection(
        insight="This is a directly created reflection without memory analysis.",
        source_memory_ids=[memory_system.memories[0]["id"]],
        metadata={"method": "direct"}
    )
    
    print(f"  Created reflection: {reflection['id']}")
    print(f"  Content: {reflection['content']}")
    
    # Step 3: Generate an analytical reflection
    print("\n3. Generating an analytical reflection...")
    
    analysis = reflection_system.analyze_memories(
        memory_limit=5,
        memory_type=None,  # Use all memory types
        prompt="What patterns can be found in the memories?"
    )
    
    print(f"  Created analytical reflection: {analysis['id']}")
    print(f"  Content summary: {analysis['content'].split('\n')[0]}")
    
    # Step 4: List all reflections
    print("\n4. All reflections:")
    
    all_reflections = reflection_system.get_all_reflections()
    for i, r in enumerate(all_reflections):
        print(f"  {i+1}. {r['id']}: {r['content'].split('\n')[0]}")
    
    print("\n" + "=" * 50)
    print("DEMONSTRATION COMPLETE")
    print("=" * 50)

if __name__ == "__main__":
    run_demonstration() 