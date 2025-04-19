import json
from pathlib import Path
from typing import Dict, List, Set, Optional, Union

class ConceptualMemory:
    """
    Conceptual Memory system for organizing knowledge around concepts/tags.
    
    This provides:
    1. Hierarchical concept organization
    2. Linking episodic memories to relevant concepts
    3. Retrieving related concepts and memories
    """
    
    def __init__(self, memory_file=None):
        """Initialize the conceptual memory system."""
        if memory_file is None:
            memory_dir = Path(__file__).parent
            memory_dir.mkdir(exist_ok=True, parents=True)
            self.memory_file = memory_dir / "conceptual_memory.json"
        else:
            self.memory_file = Path(memory_file)
        
        self.concepts = self._load_concepts()
    
    def _load_concepts(self):
        """Load concepts from disk."""
        if not self.memory_file.exists():
            return {
                "concepts": {},
                "relationships": {}
            }
            
        try:
            with open(self.memory_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return {
                "concepts": {},
                "relationships": {}
            }
    
    def _save_concepts(self):
        """Save concepts to disk."""
        with open(self.memory_file, "w", encoding="utf-8") as f:
            json.dump(self.concepts, f, indent=2)
    
    def add_concept(self, concept_name: str, description: str = "", parent_concepts: List[str] = None):
        """
        Add a new concept to the conceptual memory.
        
        Args:
            concept_name: Name of the concept
            description: Description of the concept
            parent_concepts: List of parent concept names
            
        Returns:
            bool: Success status
        """
        if parent_concepts is None:
            parent_concepts = []
            
        # Create concept if it doesn't exist
        if concept_name not in self.concepts["concepts"]:
            self.concepts["concepts"][concept_name] = {
                "name": concept_name,
                "description": description,
                "memory_ids": [],
                "created_at": "",
                "updated_at": ""
            }
        else:
            # Update existing concept description if provided
            if description:
                self.concepts["concepts"][concept_name]["description"] = description
                
        # Add relationships to parent concepts
        for parent in parent_concepts:
            if parent not in self.concepts["concepts"]:
                # Create parent concept if it doesn't exist
                self.add_concept(parent)
                
            # Add relationship
            if "is_a" not in self.concepts["relationships"]:
                self.concepts["relationships"]["is_a"] = {}
                
            if concept_name not in self.concepts["relationships"]["is_a"]:
                self.concepts["relationships"]["is_a"][concept_name] = []
                
            if parent not in self.concepts["relationships"]["is_a"][concept_name]:
                self.concepts["relationships"]["is_a"][concept_name].append(parent)
        
        self._save_concepts()
        return True
    
    def link_memory_to_concept(self, memory_id: str, concept_name: str):
        """
        Link a memory to a concept.
        
        Args:
            memory_id: ID of the memory to link
            concept_name: Name of the concept to link to
            
        Returns:
            bool: Success status
        """
        # Create concept if it doesn't exist
        if concept_name not in self.concepts["concepts"]:
            self.add_concept(concept_name)
            
        # Add memory ID to the concept
        if memory_id not in self.concepts["concepts"][concept_name]["memory_ids"]:
            self.concepts["concepts"][concept_name]["memory_ids"].append(memory_id)
            self._save_concepts()
            
        return True
    
    def get_concept(self, concept_name: str):
        """Get a concept by name."""
        return self.concepts["concepts"].get(concept_name)
    
    def get_memories_for_concept(self, concept_name: str) -> List[str]:
        """Get memory IDs associated with a concept."""
        concept = self.get_concept(concept_name)
        if not concept:
            return []
            
        return concept["memory_ids"]
    
    def get_child_concepts(self, concept_name: str) -> List[str]:
        """Get concepts that are children of the given concept."""
        child_concepts = []
        
        if "is_a" not in self.concepts["relationships"]:
            return []
            
        for child, parents in self.concepts["relationships"]["is_a"].items():
            if concept_name in parents:
                child_concepts.append(child)
                
        return child_concepts
    
    def get_parent_concepts(self, concept_name: str) -> List[str]:
        """Get concepts that are parents of the given concept."""
        if "is_a" not in self.concepts["relationships"]:
            return []
            
        if concept_name not in self.concepts["relationships"]["is_a"]:
            return []
            
        return self.concepts["relationships"]["is_a"][concept_name]
    
    def get_related_concepts(self, concept_name: str, max_depth: int = 2) -> List[str]:
        """
        Get concepts related to the given concept within a specified depth.
        
        Args:
            concept_name: Name of the concept
            max_depth: Maximum depth to traverse in the concept hierarchy
            
        Returns:
            List of related concept names
        """
        if concept_name not in self.concepts["concepts"]:
            return []
            
        related = set()
        visited = set()
        
        def traverse_hierarchy(current_concept, current_depth, direction):
            if current_concept in visited or current_depth > max_depth:
                return
                
            visited.add(current_concept)
            
            if current_concept != concept_name:
                related.add(current_concept)
                
            if direction in ["up", "both"]:
                # Traverse up to parents
                parents = self.get_parent_concepts(current_concept)
                for parent in parents:
                    traverse_hierarchy(parent, current_depth + 1, "up")
                    
            if direction in ["down", "both"]:
                # Traverse down to children
                children = self.get_child_concepts(current_concept)
                for child in children:
                    traverse_hierarchy(child, current_depth + 1, "down")
        
        # Traverse both up and down
        traverse_hierarchy(concept_name, 0, "both")
        
        return list(related)
    
    def get_all_concepts(self):
        """Get all concepts."""
        return list(self.concepts["concepts"].keys())

# Create a global instance for easy import
concept_memory = ConceptualMemory() 