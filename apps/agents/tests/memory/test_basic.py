"""
Script to test the memory system components.
"""
import json
from datetime import datetime
from pathlib import Path
import random

# Import the memory modules
from shared.memory.episodic_memory import episodic_memory
from shared.memory.conceptual_memory import concept_memory
from shared.memory.reflection import reflection_system
from shared.memory.memory_analyzer import memory_analyzer

def test_episodic_memory():
    """Test the episodic memory system."""
    print("\n=== Testing Episodic Memory ===")
    
    # Add a test memory
    memory = episodic_memory.add_memory(
        memory_type="test",
        content="This is a test memory for the memory system",
        importance=0.75,
        metadata={"test": True}
    )
    
    print(f"Added memory: {memory['id']}")
    print(f"Content: {memory['content']}")
    
    # Retrieve the memory
    retrieved = episodic_memory.get_memory(memory['id'])
    print(f"Retrieved: {retrieved is not None}")
    
    # Get all memories
    all_memories = episodic_memory.get_all_memories()
    print(f"Total memories: {len(all_memories)}")

def test_conceptual_memory():
    """Test the conceptual memory system."""
    print("\n=== Testing Conceptual Memory ===")
    
    # Add a concept
    concept_memory.add_concept("test_concept", "A test concept")
    print("Added concept: test_concept")
    
    # Add a memory
    memory = episodic_memory.add_memory(
        memory_type="concept_test",
        content="This memory is related to the test concept",
        importance=0.6
    )
    
    # Link memory to concept
    concept_memory.link_memory_to_concept(memory['id'], "test_concept")
    print(f"Linked memory {memory['id']} to concept 'test_concept'")
    
    # Get memories for concept
    concept_memories = concept_memory.get_memories_for_concept("test_concept")
    print(f"Memories linked to concept: {len(concept_memories)}")

def test_memory_analyzer():
    """Test the memory analyzer."""
    print("\n=== Testing Memory Analyzer ===")
    
    # Create some test memories
    memories = []
    for i in range(5):
        memory = episodic_memory.add_memory(
            memory_type="analyzer_test",
            content=f"Test memory {i+1} for the analyzer",
            importance=random.random()
        )
        memories.append(memory)
    
    print(f"Created {len(memories)} test memories")
    
    # Analyze the memories
    analysis = memory_analyzer.analyze_memories(memories)
    
    print("Analysis results:")
    print(f"- Success: {analysis['success']}")
    print(f"- Patterns found: {len(analysis['patterns'])}")
    print(f"- Insights generated: {len(analysis['insights'])}")
    print(f"- Related concepts: {analysis['related_concepts']}")
    
    # Generate a summary
    summary = memory_analyzer.generate_summary(memories)
    print(f"Summary: {summary}")

def test_reflection_system():
    """Test the reflection system."""
    print("\n=== Testing Reflection System ===")
    
    # Add some memories for reflection
    memory_types = ["observation", "conversation", "task"]
    for i in range(5):
        memory_type = random.choice(memory_types)
        episodic_memory.add_memory(
            memory_type=memory_type,
            content=f"Test {memory_type} memory {i+1} for reflection",
            importance=random.random()
        )
    
    # Generate a reflection
    reflection = reflection_system.analyze_memories(
        memory_limit=10,
        reflection_prompt="What patterns exist in the test memories?"
    )
    
    print(f"Generated reflection: {reflection['id']}")
    print(f"Content: {reflection['content']}")
    print(f"Related concepts: {reflection['related_concepts']}")
    
    # Get latest reflections
    latest = reflection_system.get_latest_reflections(1)
    print(f"Latest reflection ID: {latest[0]['id'] if latest else 'None'}")

def main():
    """Run all tests."""
    print("MEMORY SYSTEM TESTING")
    print("=====================")
    
    # Test each component
    test_episodic_memory()
    test_conceptual_memory()
    test_memory_analyzer()
    test_reflection_system()
    
    print("\nAll tests completed.")

if __name__ == "__main__":
    main() 