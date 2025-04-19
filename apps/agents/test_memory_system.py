"""
Test script for the complete memory and reflection system.
"""
import sys
import os
from pathlib import Path
import json
from datetime import datetime
import random

# Add the current directory to the path
current_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(current_dir))

# Import memory system components
print("Importing memory system components...")

try:
    from shared.memory.episodic_memory import episodic_memory, EpisodicMemory
    print("✓ Imported episodic_memory")
except Exception as e:
    print(f"✗ Failed to import episodic_memory: {e}")
    episodic_memory = None

try:
    from shared.memory.conceptual_memory import concept_memory, ConceptualMemory
    print("✓ Imported concept_memory")
except Exception as e:
    print(f"✗ Failed to import concept_memory: {e}")
    concept_memory = None

try:
    from shared.memory.memory_analyzer import memory_analyzer, MemoryAnalyzer
    print("✓ Imported memory_analyzer")
except Exception as e:
    print(f"✗ Failed to import memory_analyzer: {e}")
    memory_analyzer = None

try:
    from shared.memory.reflection import reflection_system, ReflectionSystem
    print("✓ Imported reflection_system")
except Exception as e:
    print(f"✗ Failed to import reflection_system: {e}")
    reflection_system = None

def create_test_memories():
    """Create test memories for demonstration."""
    if not episodic_memory:
        print("Episodic memory not available")
        return []
    
    print("\nCreating test memories...")
    memories = []
    
    for i in range(5):
        memory = episodic_memory.add_memory(
            memory_type="test",
            content=f"Test memory {i+1}",
            importance=random.random(),
            metadata={"test_id": i+1}
        )
        memories.append(memory)
        
    print(f"Created {len(memories)} test memories")
    return memories

def test_concept_linking(memories):
    """Test linking memories to concepts."""
    if not concept_memory or not memories:
        print("Concept memory or test memories not available")
        return
    
    print("\nLinking memories to concepts...")
    
    # Create a test concept
    concept_memory.add_concept("test_concept", "A concept for testing")
    
    # Link some memories to the concept
    for i, memory in enumerate(memories):
        if i % 2 == 0:  # Link every other memory
            concept_memory.link_memory_to_concept(memory["id"], "test_concept")
            print(f"Linked memory {memory['id']} to concept 'test_concept'")
    
    # Verify links
    linked_memories = concept_memory.get_memories_for_concept("test_concept")
    print(f"Verified {len(linked_memories)} memories linked to concept 'test_concept'")

def test_memory_analysis(memories):
    """Test memory analysis."""
    if not memory_analyzer or not memories:
        print("Memory analyzer or test memories not available")
        return
    
    print("\nAnalyzing memories...")
    
    # Analyze the memories
    analysis = memory_analyzer.analyze_memories(memories)
    
    print(f"Analysis success: {analysis.get('success', False)}")
    if analysis.get('success', False):
        print(f"Found {len(analysis.get('patterns', []))} patterns")
        print(f"Generated {len(analysis.get('insights', []))} insights")
        
        # Generate a summary
        summary = memory_analyzer.generate_summary(memories)
        print(f"Summary: {summary}")

def test_reflection_generation(memories):
    """Test reflection generation."""
    if not reflection_system or not memories:
        print("Reflection system or test memories not available")
        return
    
    print("\nGenerating a test reflection...")
    
    # Create a direct reflection without using memory analysis
    direct_reflection = reflection_system.add_reflection(
        insight="This is a direct test reflection",
        source_memory_ids=[m["id"] for m in memories[:2]],
        related_concepts=["test", "direct"],
        metadata={"test": True}
    )
    
    print(f"Created direct reflection: {direct_reflection['id']}")
    
    # If all memory components are available, try a full memory analysis reflection
    if episodic_memory and concept_memory and memory_analyzer:
        print("\nGenerating an analytical reflection...")
        
        analytical_reflection = reflection_system.analyze_memories(
            memory_limit=10,
            memory_types=["test"],
            reflection_prompt="What can we learn from the test memories?"
        )
        
        print(f"Created analytical reflection: {analytical_reflection['id']}")
        print(f"Content: {analytical_reflection['content'][:100]}...")
        
    # Get all reflections
    all_reflections = reflection_system.get_all_reflections()
    print(f"\nTotal reflections: {len(all_reflections)}")

def main():
    """Run the memory system tests."""
    print("=" * 50)
    print("MEMORY SYSTEM TEST")
    print("=" * 50)
    
    print(f"Current directory: {os.getcwd()}")
    print(f"Python path: {sys.path[:3]}")
    
    # Step 1: Create test memories
    memories = create_test_memories()
    
    # Step 2: Test concept linking
    test_concept_linking(memories)
    
    # Step 3: Test memory analysis
    test_memory_analysis(memories)
    
    # Step 4: Test reflection generation
    test_reflection_generation(memories)
    
    print("\n" + "=" * 50)
    print("TEST COMPLETED")
    print("=" * 50)

if __name__ == "__main__":
    main() 