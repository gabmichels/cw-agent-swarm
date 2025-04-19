"""
Example script demonstrating how to use the reflection system.

This script:
1. Creates some sample memories
2. Generates reflections of different types
3. Shows how to retrieve and use reflections
"""
import json
from datetime import datetime, timedelta
import random
import os
import sys
from pathlib import Path

# Use relative imports since we're in the same package
from . import episodic_memory
from . import conceptual_memory
from . import reflection
from . import memory_analyzer

# Get the instances
episodic_memory = episodic_memory.episodic_memory
concept_memory = conceptual_memory.concept_memory
reflection_system = reflection.reflection_system
memory_analyzer = memory_analyzer.memory_analyzer

def create_sample_memories():
    """Create some sample memories to demonstrate reflection."""
    print("Creating sample memories...")
    
    # Add conversation memories
    conversation_contents = [
        "Discussed the new marketing campaign with Sarah",
        "Team meeting about Q3 targets and resource allocation",
        "Client call with Acme Corp about their upcoming product launch",
        "Coffee chat with the new intern, discussing their background and interests",
        "Performance review with my manager, received positive feedback"
    ]
    
    for content in conversation_contents:
        episodic_memory.add_memory(
            memory_type="conversation",
            content=content,
            importance=random.uniform(0.4, 0.9),
            metadata={"participants": ["user", "other"]}
        )
    
    # Add observation memories
    observation_contents = [
        "Noticed the website has a 3-second delay when loading product pages",
        "Our competitor launched a similar feature to what we're developing",
        "The marketing team seems stressed about the upcoming campaign deadline",
        "The latest analytics show a 15% increase in user engagement after our UI update",
        "Customer support tickets increased by 20% this week"
    ]
    
    for content in observation_contents:
        episodic_memory.add_memory(
            memory_type="observation",
            content=content,
            importance=random.uniform(0.5, 0.8)
        )
    
    # Add task memories
    task_contents = [
        "Created wireframes for the new product page",
        "Wrote documentation for the API integration",
        "Fixed the bug in the checkout flow",
        "Analyzed user feedback from the beta test",
        "Scheduled meetings with stakeholders for project review"
    ]
    
    for content in task_contents:
        episodic_memory.add_memory(
            memory_type="task",
            content=content,
            importance=random.uniform(0.6, 0.9),
            metadata={"status": "completed"}
        )
    
    print(f"Created {len(conversation_contents + observation_contents + task_contents)} memories")

def link_memories_to_concepts():
    """Link memories to concepts for concept-based reflection."""
    print("Linking memories to concepts...")
    
    # Get all memories
    memories = episodic_memory.get_all_memories()
    
    # Link to concepts based on content
    for memory in memories:
        content = memory["content"].lower()
        
        if "marketing" in content or "campaign" in content:
            concept_memory.link_memory_to_concept(memory["id"], "marketing")
            
        if "meeting" in content or "call" in content or "discussion" in content:
            concept_memory.link_memory_to_concept(memory["id"], "meetings")
            
        if "bug" in content or "fix" in content or "issue" in content:
            concept_memory.link_memory_to_concept(memory["id"], "engineering")
            
        if "user" in content or "customer" in content or "client" in content:
            concept_memory.link_memory_to_concept(memory["id"], "customers")
    
    # Create concept relationships
    concept_memory.add_concept("work", "Professional activities")
    concept_memory.add_concept("marketing", "Marketing activities", ["work"])
    concept_memory.add_concept("engineering", "Engineering and development tasks", ["work"])
    concept_memory.add_concept("meetings", "Discussions and meetings", ["work"])

def generate_reflections():
    """Generate various types of reflections to demonstrate the system."""
    print("\nGenerating reflections...")
    
    # General reflection on all recent memories
    print("\n1. General reflection:")
    general_reflection = reflection_system.analyze_memories(
        memory_limit=15,
        memory_types=["conversation", "observation", "task"],
        reflection_prompt="What are the key themes and patterns in recent activities?"
    )
    print(f"- Content: {general_reflection['content']}")
    print(f"- Related concepts: {general_reflection['related_concepts']}")
    
    # Daily reflection
    print("\n2. Daily reflection:")
    daily_reflection = reflection_system.generate_daily_reflection()
    print(f"- Content: {daily_reflection['content']}")
    print(f"- Related concepts: {daily_reflection['related_concepts']}")
    
    # Concept-specific reflection
    print("\n3. Concept reflection (marketing):")
    concept_reflection = reflection_system.generate_concept_reflection("marketing")
    print(f"- Content: {concept_reflection['content']}")
    print(f"- Related concepts: {concept_reflection['related_concepts']}")
    
    # Temporal analysis
    print("\n4. Temporal analysis reflection:")
    temporal_reflection = reflection_system.analyze_memories(
        analysis_type="temporal",
        reflection_prompt="How have activities evolved over time?"
    )
    print(f"- Content: {temporal_reflection['content']}")

def retrieve_and_use_reflections():
    """Demonstrate how to retrieve and use reflections."""
    print("\nRetrieving and using reflections...")
    
    # Get the most recent reflections
    recent_reflections = reflection_system.get_latest_reflections(limit=3)
    print(f"\nFound {len(recent_reflections)} recent reflections")
    
    for i, reflection in enumerate(recent_reflections):
        print(f"\nReflection {i+1}:")
        print(f"- ID: {reflection['id']}")
        print(f"- Created: {reflection['created_at']}")
        print(f"- Type: {reflection['metadata'].get('reflection_type', 'general')}")
        print(f"- Content snippet: {reflection['content'][:100]}...")
    
    # Demonstrate retrieving a specific reflection
    if recent_reflections:
        reflection_id = recent_reflections[0]["id"]
        print(f"\nRetrieving specific reflection by ID: {reflection_id}")
        
        specific_reflection = reflection_system.get_reflection(reflection_id)
        if specific_reflection:
            print(f"- Content: {specific_reflection['content'][:150]}...")
            
            # Show source memories
            print("\nSource memories that led to this reflection:")
            for i, memory_id in enumerate(specific_reflection["source_memory_ids"][:3]):
                memory = episodic_memory.get_memory(memory_id)
                if memory:
                    print(f"  {i+1}. {memory['type']}: {memory['content'][:50]}...")

def main():
    """Main demonstration function."""
    print("=" * 50)
    print("REFLECTION SYSTEM DEMONSTRATION")
    print("=" * 50)
    
    # Step 1: Create sample data
    create_sample_memories()
    
    # Step 2: Link memories to concepts
    link_memories_to_concepts()
    
    # Step 3: Generate reflections
    generate_reflections()
    
    # Step 4: Retrieve and use reflections
    retrieve_and_use_reflections()
    
    print("\n" + "=" * 50)
    print("DEMONSTRATION COMPLETE")
    print("=" * 50)

if __name__ == "__main__":
    main() 