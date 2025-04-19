import json
from datetime import datetime, timedelta
from pathlib import Path

# Import the memory modules using relative imports
try:
    from .episodic_memory import episodic_memory
except ImportError:
    # Fallback for direct imports (when running script directly)
    from apps.agents.shared.memory.episodic_memory import episodic_memory

class TemporalMemory:
    """
    Tracks temporal sequences of memories and importance weighting over time.
    
    This class helps:
    1. Track when memories were created
    2. Implement importance decay over time
    3. Handle recency biasing in memory retrieval
    """
    
    def __init__(self, memory_file=None):
        """Initialize the temporal memory system."""
        if memory_file is None:
            memory_dir = Path(__file__).parent
            memory_dir.mkdir(exist_ok=True, parents=True)
            self.memory_file = memory_dir / "temporal_memory.json"
        else:
            self.memory_file = Path(memory_file)
        
        self.memory_timeline = self._load_timeline()
    
    def _load_timeline(self):
        """Load the temporal memory timeline from disk."""
        if not self.memory_file.exists():
            return []
            
        try:
            with open(self.memory_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return []
    
    def _save_timeline(self):
        """Save the temporal memory timeline to disk."""
        with open(self.memory_file, "w", encoding="utf-8") as f:
            json.dump(self.memory_timeline, f, indent=2)
    
    def add_temporal_memory(self, memory_id, timestamp=None, importance=5, context=None):
        """
        Add a temporal memory entry.
        
        Args:
            memory_id: ID or reference to the episodic memory
            timestamp: When this memory occurred (defaults to now)
            importance: Initial importance score (0-10)
            context: Additional context for this temporal entry
        """
        if timestamp is None:
            timestamp = datetime.now().isoformat()
            
        if context is None:
            context = {}
            
        entry = {
            "memory_id": memory_id,
            "timestamp": timestamp,
            "importance": importance,
            "last_accessed": timestamp,
            "access_count": 0,
            "context": context
        }
        
        self.memory_timeline.append(entry)
        self._save_timeline()
        return entry
    
    def update_importance(self, memory_id, new_importance):
        """Update the importance score of a memory."""
        for entry in self.memory_timeline:
            if entry["memory_id"] == memory_id:
                entry["importance"] = new_importance
                self._save_timeline()
                return True
        return False
    
    def record_access(self, memory_id):
        """Record that a memory was accessed, updating its recency and access count."""
        for entry in self.memory_timeline:
            if entry["memory_id"] == memory_id:
                entry["last_accessed"] = datetime.now().isoformat()
                entry["access_count"] += 1
                self._save_timeline()
                return True
        return False
    
    def get_recent_memories(self, hours=24, limit=10):
        """Get memories from the recent time period."""
        cutoff = (datetime.now() - timedelta(hours=hours)).isoformat()
        
        recent = [
            entry for entry in self.memory_timeline 
            if entry["timestamp"] > cutoff
        ]
        
        # Sort by recency
        recent.sort(key=lambda x: x["timestamp"], reverse=True)
        
        return recent[:limit]
    
    def get_frequently_accessed_memories(self, limit=5):
        """Get the most frequently accessed memories."""
        frequent = sorted(
            self.memory_timeline, 
            key=lambda x: x["access_count"], 
            reverse=True
        )
        return frequent[:limit]
    
    def get_important_memories(self, limit=5, min_importance=7):
        """Get the most important memories."""
        important = [
            entry for entry in self.memory_timeline 
            if entry["importance"] >= min_importance
        ]
        
        important.sort(key=lambda x: x["importance"], reverse=True)
        
        return important[:limit]
    
    def decay_importance(self, decay_factor=0.9, older_than_days=7):
        """
        Apply time-based decay to memory importance.
        
        Args:
            decay_factor: Multiplier to apply to importance (0-1)
            older_than_days: Apply decay to memories older than this many days
        """
        cutoff = (datetime.now() - timedelta(days=older_than_days)).isoformat()
        
        for entry in self.memory_timeline:
            if entry["timestamp"] < cutoff:
                entry["importance"] = max(1, entry["importance"] * decay_factor)
        
        self._save_timeline()
    
    def get_memory_context(self, memory_id):
        """Get the temporal context for a specific memory."""
        for entry in self.memory_timeline:
            if entry["memory_id"] == memory_id:
                return entry["context"]
        return None

# Create a global instance for easy import
temporal_memory = TemporalMemory() 
 