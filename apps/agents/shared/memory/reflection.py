import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any

# Import the memory modules using relative imports
try:
    from .episodic_memory import episodic_memory
    from .conceptual_memory import concept_memory
    from .memory_analyzer import memory_analyzer
except ImportError:
    # Fallback for direct imports (when running script directly)
    from apps.agents.shared.memory.episodic_memory import episodic_memory
    from apps.agents.shared.memory.conceptual_memory import concept_memory
    from apps.agents.shared.memory.memory_analyzer import memory_analyzer

class ReflectionSystem:
    """
    Reflection system for analyzing memories and generating insights.
    
    This system:
    1. Periodically analyzes recent memories
    2. Identifies patterns and connections
    3. Generates insights and reflections
    4. Stores reflections as a special type of memory
    """
    
    def __init__(self, reflection_file=None):
        """Initialize the reflection system."""
        if reflection_file is None:
            # Use a more relative path approach
            memory_dir = Path(__file__).parent
            memory_dir.mkdir(exist_ok=True, parents=True)
            self.reflection_file = memory_dir / "reflections.json"
        else:
            self.reflection_file = Path(reflection_file)
        
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
    
    def add_reflection(self, 
                     insight: str, 
                     source_memory_ids: List[str] = None, 
                     related_concepts: List[str] = None,
                     metadata: Dict[str, Any] = None) -> Dict:
        """
        Add a new reflection based on memory analysis.
        
        Args:
            insight: The reflection insight content
            source_memory_ids: List of memory IDs that led to this reflection
            related_concepts: List of concept names related to this reflection
            metadata: Additional metadata for the reflection
            
        Returns:
            The created reflection object
        """
        if source_memory_ids is None:
            source_memory_ids = []
            
        if related_concepts is None:
            related_concepts = []
            
        if metadata is None:
            metadata = {}
            
        timestamp = datetime.now().isoformat()
        
        reflection = {
            "id": f"reflection_{len(self.reflections) + 1}",
            "type": "reflection",
            "content": insight,
            "source_memory_ids": source_memory_ids,
            "related_concepts": related_concepts,
            "created_at": timestamp,
            "metadata": metadata
        }
        
        self.reflections.append(reflection)
        self._save_reflections()
        
        # Add this reflection as a special memory type
        episodic_memory.add_memory(
            memory_type="reflection",
            content=insight,
            importance=0.8,  # Reflections typically have high importance
            metadata={
                "source_memory_ids": source_memory_ids,
                "related_concepts": related_concepts,
                "reflection_id": reflection["id"]
            }
        )
        
        # Link reflection to concepts
        for concept_name in related_concepts:
            concept_memory.add_concept(concept_name)
            concept_memory.link_memory_to_concept(reflection["id"], concept_name)
        
        return reflection
    
    def get_reflection(self, reflection_id: str) -> Optional[Dict]:
        """Get a reflection by ID."""
        for reflection in self.reflections:
            if reflection["id"] == reflection_id:
                return reflection
        return None
    
    def get_all_reflections(self) -> List[Dict]:
        """Get all reflections."""
        return self.reflections
    
    def get_latest_reflections(self, limit: int = 5) -> List[Dict]:
        """Get the most recent reflections."""
        sorted_reflections = sorted(
            self.reflections, 
            key=lambda x: x["created_at"], 
            reverse=True
        )
        return sorted_reflections[:limit]
    
    def analyze_memories(self, 
                       memory_limit: int = 50, 
                       memory_types: List[str] = None, 
                       reflection_prompt: str = None,
                       analysis_type: str = "general") -> Dict:
        """
        Analyze recent memories to generate a reflection.
        
        Args:
            memory_limit: Maximum number of memories to analyze
            memory_types: Types of memories to include
            reflection_prompt: Optional prompt to guide the reflection
            analysis_type: Type of analysis to perform
            
        Returns:
            The generated reflection
        """
        # Get recent memories
        if memory_types is None:
            memory_types = ["conversation", "observation", "action"]
            
        recent_memories = []
        for memory_type in memory_types:
            memories = episodic_memory.get_all_memories_by_type(memory_type)
            recent_memories.extend(memories)
            
        # Sort by recency and limit
        recent_memories = sorted(
            recent_memories,
            key=lambda x: x["created_at"],
            reverse=True
        )[:memory_limit]
        
        if not recent_memories:
            return self.add_reflection(
                insight="No recent memories to analyze",
                related_concepts=["reflection", "empty_analysis"],
                metadata={"auto_generated": True, "success": False}
            )
        
        # Use the memory analyzer to analyze the memories
        analysis_results = memory_analyzer.analyze_memories(
            memories=recent_memories,
            analysis_type=analysis_type,
            focus_query=reflection_prompt
        )
        
        # Generate insights based on analysis
        insights = []
        
        # Add the analysis patterns
        for pattern in analysis_results.get("patterns", []):
            insights.append(f"Pattern: {pattern}")
            
        # Add the analysis insights
        for insight in analysis_results.get("insights", []):
            insights.append(f"Insight: {insight}")
            
        # Create a summary reflection
        memory_summary = memory_analyzer.generate_summary(recent_memories)
        
        # Create a comprehensive insight
        primary_insight = f"Memory Analysis ({analysis_type}): {memory_summary}"
        
        if reflection_prompt:
            primary_insight = f"{primary_insight}\nGuided by prompt: {reflection_prompt}"
            
        if insights:
            primary_insight = f"{primary_insight}\n\nKey findings:\n- " + "\n- ".join(insights)
        
        # Extract source memory IDs
        source_memory_ids = [memory["id"] for memory in recent_memories]
        
        # Get related concepts from the analysis
        related_concepts = analysis_results.get("related_concepts", ["reflection"])
        if "reflection" not in related_concepts:
            related_concepts.append("reflection")
        
        # Add analysis type to concepts
        related_concepts.append(f"{analysis_type}_analysis")
        
        return self.add_reflection(
            insight=primary_insight,
            source_memory_ids=source_memory_ids,
            related_concepts=related_concepts,
            metadata={
                "auto_generated": True,
                "analysis_type": analysis_type,
                "memory_stats": analysis_results.get("memory_stats", {}),
                "reflection_prompt": reflection_prompt
            }
        )
        
    def generate_daily_reflection(self) -> Dict:
        """
        Generate a daily reflection on recent activities.
        
        Returns:
            The generated reflection
        """
        # Focus on the last 24 hours of memories
        one_day_ago = (datetime.now() - timedelta(days=1)).isoformat()
        recent_memories = episodic_memory.get_memories_by_timeframe(start_time=one_day_ago)
        
        if not recent_memories:
            return self.add_reflection(
                insight="No activities found in the last 24 hours.",
                related_concepts=["daily_reflection"],
                metadata={"reflection_type": "daily"}
            )
        
        # Use the memory analyzer
        analysis_results = memory_analyzer.analyze_memories(
            memories=recent_memories,
            analysis_type="temporal",
            focus_query="What happened in the last 24 hours?"
        )
        
        # Extract entities mentioned
        entities = memory_analyzer.extract_key_entities(recent_memories)
        
        # Create the daily summary
        memory_summary = memory_analyzer.generate_summary(recent_memories)
        
        insights = []
        for insight in analysis_results.get("insights", []):
            insights.append(insight)
            
        # Format the daily reflection
        daily_summary = f"Daily Reflection: {memory_summary}"
        
        if insights:
            daily_summary += "\n\nInsights:\n- " + "\n- ".join(insights)
            
        if entities:
            daily_summary += f"\n\nKey topics: {', '.join(entities)}"
        
        # Add some related concepts specific to daily reflections
        related_concepts = ["daily_reflection", "time_management"]
        for entity in entities:
            related_concepts.append(entity)
        
        return self.add_reflection(
            insight=daily_summary,
            source_memory_ids=[m["id"] for m in recent_memories],
            related_concepts=related_concepts,
            metadata={
                "reflection_type": "daily",
                "memory_count": len(recent_memories),
                "entities": entities
            }
        )
    
    def generate_concept_reflection(self, concept_name: str) -> Dict:
        """
        Generate a reflection focused on a specific concept.
        
        Args:
            concept_name: The concept to reflect on
            
        Returns:
            The generated reflection
        """
        # Get memories related to this concept
        memory_ids = concept_memory.get_memories_for_concept(concept_name)
        memories = [episodic_memory.get_memory(mid) for mid in memory_ids if episodic_memory.get_memory(mid)]
        
        if not memories:
            return self.add_reflection(
                insight=f"No memories found related to concept: {concept_name}",
                related_concepts=[concept_name, "concept_reflection"],
                metadata={"reflection_type": "concept", "concept": concept_name}
            )
        
        # Get related concepts
        related_concept_names = concept_memory.get_related_concepts(concept_name)
        
        # Use the memory analyzer
        analysis_results = memory_analyzer.analyze_memories(
            memories=memories,
            analysis_type="conceptual",
            focus_query=f"What insights can be gained about {concept_name}?"
        )
        
        # Create the concept reflection
        concept_summary = f"Concept Reflection - {concept_name}: "
        concept_summary += memory_analyzer.generate_summary(memories)
        
        insights = analysis_results.get("insights", [])
        if insights:
            concept_summary += "\n\nInsights:\n- " + "\n- ".join(insights)
            
        if related_concept_names:
            concept_summary += f"\n\nRelated concepts: {', '.join(related_concept_names)}"
        
        # Add concept-specific related concepts
        related_concepts = [concept_name, "concept_reflection"]
        for rc in related_concept_names[:5]:  # Limit to 5 related concepts
            related_concepts.append(rc)
        
        return self.add_reflection(
            insight=concept_summary,
            source_memory_ids=[m["id"] for m in memories],
            related_concepts=related_concepts,
            metadata={
                "reflection_type": "concept",
                "concept": concept_name,
                "memory_count": len(memories),
                "related_concepts": related_concept_names
            }
        )

# Create a global instance for easy import
reflection_system = ReflectionSystem() 