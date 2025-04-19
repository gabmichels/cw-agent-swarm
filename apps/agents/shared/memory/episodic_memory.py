import json
import os
from datetime import datetime, timedelta
from pathlib import Path
import random
from typing import List, Dict, Any, Optional, Union
import uuid
import numpy as np

# Define memory storage paths
MEMORY_DIR = Path(__file__).parent
MEMORY_DIR.mkdir(parents=True, exist_ok=True)
EPISODIC_MEMORY_FILE = MEMORY_DIR / "episodic_memory.json"

# Importance levels
IMPORTANCE_HIGH = "high"
IMPORTANCE_MEDIUM = "medium"
IMPORTANCE_LOW = "low"

class EpisodicMemory:
    """
    Episodic memory system for storing and retrieving agent memories.
    
    Features:
    - Store memories with timestamps and importance
    - Retrieve memories by type, time range, and relevance
    - Prioritize memories by importance/relevance during retrieval
    """
    
    def __init__(self, memory_file=None):
        """Initialize the episodic memory system."""
        if memory_file is None:
            memory_dir = Path(__file__).parent
            memory_dir.mkdir(exist_ok=True, parents=True)
            self.memory_file = memory_dir / "episodic_memories.json"
        else:
            self.memory_file = Path(memory_file)
        
        self.memories = self._load_memories()
        self.embedding_cache = {}  # Cache for memory embeddings
    
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
    
    def add_memory(self, 
                  memory_type: str, 
                  content: str, 
                  importance: float = 0.5, 
                  metadata: Dict[str, Any] = None) -> Dict:
        """
        Add a new memory.
        
        Args:
            memory_type: Type of memory (conversation, observation, action, etc.)
            content: The memory content
            importance: Memory importance score (0.0 to 1.0)
            metadata: Additional metadata for the memory
            
        Returns:
            The created memory object
        """
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
        
        # Clear the embedding for this memory from cache
        if memory_id in self.embedding_cache:
            del self.embedding_cache[memory_id]
        
        return memory
    
    def update_memory_importance(self, memory_id: str, importance: float) -> Optional[Dict]:
        """
        Update the importance score of a memory.
        
        Args:
            memory_id: ID of the memory to update
            importance: New importance score (0.0 to 1.0)
            
        Returns:
            Updated memory or None if not found
        """
        for memory in self.memories:
            if memory["id"] == memory_id:
                memory["importance"] = max(0.0, min(1.0, importance))
                memory["metadata"]["last_importance_update"] = datetime.now().isoformat()
                self._save_memories()
                return memory
        return None
    
    def get_memory(self, memory_id: str) -> Optional[Dict]:
        """Get a memory by ID."""
        for memory in self.memories:
            if memory["id"] == memory_id:
                return memory
        return None
    
    def get_all_memories(self) -> List[Dict]:
        """Get all memories."""
        return self.memories
    
    def get_all_memories_by_type(self, memory_type: str) -> List[Dict]:
        """Get all memories of a specific type."""
        return [m for m in self.memories if m["type"] == memory_type]
    
    def get_memories_by_timeframe(self, 
                                start_time: Optional[str] = None, 
                                end_time: Optional[str] = None) -> List[Dict]:
        """
        Get memories within a specific timeframe.
        
        Args:
            start_time: ISO format datetime string (inclusive)
            end_time: ISO format datetime string (inclusive)
            
        Returns:
            List of memories within the timeframe
        """
        result = self.memories
        
        if start_time:
            result = [m for m in result if m["created_at"] >= start_time]
            
        if end_time:
            result = [m for m in result if m["created_at"] <= end_time]
            
        return result
    
    def get_important_memories(self, threshold: float = 0.7, limit: int = 10) -> List[Dict]:
        """
        Get the most important memories above a threshold.
        
        Args:
            threshold: Minimum importance score (0.0 to 1.0)
            limit: Maximum number of memories to return
            
        Returns:
            List of important memories
        """
        important_memories = [m for m in self.memories if m["importance"] >= threshold]
        
        # Sort by importance (descending) and then by recency
        sorted_memories = sorted(
            important_memories, 
            key=lambda x: (x["importance"], x["created_at"]), 
            reverse=True
        )
        
        return sorted_memories[:limit]
    
    def search_memories(self, query: str, limit: int = 10) -> List[Dict]:
        """
        Search memories by content (basic substring match).
        
        In a real implementation, this would use semantic search.
        
        Args:
            query: Search query
            limit: Maximum number of results
            
        Returns:
            List of matching memories
        """
        query = query.lower()
        matching_memories = [
            m for m in self.memories 
            if query in m["content"].lower()
        ]
        
        return matching_memories[:limit]
    
    def clear_old_memories(self, days_to_keep: int = 30) -> int:
        """
        Clear memories older than specified days.
        
        Args:
            days_to_keep: Number of days of memories to keep
            
        Returns:
            Number of memories removed
        """
        cutoff_date = (datetime.now() - timedelta(days=days_to_keep)).isoformat()
        
        original_count = len(self.memories)
        self.memories = [m for m in self.memories if m["created_at"] >= cutoff_date]
        
        removed_count = original_count - len(self.memories)
        if removed_count > 0:
            self._save_memories()
            
        return removed_count
    
    def get_embedding(self, text, force_recompute=False):
        """
        Get embedding for text using an embedding model.
        This is a placeholder - in a real implementation, 
        you would use an actual embedding model.
        """
        # TODO: Replace with actual embedding generation when embedding model is available
        # For now, create a simple hash-based placeholder
        hash_val = hash(text) % 100000
        np.random.seed(hash_val)
        return np.random.randn(384).astype(np.float32)  # 384-dim random vector
    
    def get_memory_embedding(self, memory_id, force_recompute=False):
        """Get embedding for a specific memory."""
        # Return cached embedding if available and not forcing recompute
        if not force_recompute and memory_id in self.embedding_cache:
            return self.embedding_cache[memory_id]
        
        memory = self.get_memory(memory_id)
        if not memory:
            return None
        
        embedding = self.get_embedding(memory["content"])
        self.embedding_cache[memory_id] = embedding
        return embedding

# Create a global instance for easy import
episodic_memory = EpisodicMemory()

def initialize_memory_storage():
    """Initialize the memory storage file if it doesn't exist."""
    if not EPISODIC_MEMORY_FILE.exists():
        # Create an empty file
        with open(EPISODIC_MEMORY_FILE, "w") as f:
            pass

def store_memory(
    content: str, 
    context: str = "", 
    outcome: str = "", 
    importance: str = IMPORTANCE_MEDIUM, 
    tags: List[str] = None
) -> Dict[str, Any]:
    """
    Store a new episodic memory entry.
    
    Args:
        content: The main content of the memory
        context: Optional context about the situation
        outcome: What resulted from this interaction/task
        importance: How important this memory is (high, medium, low)
        tags: List of concept tags (without # symbol)
        
    Returns:
        The created memory entry
    """
    initialize_memory_storage()
    
    # Create memory object
    timestamp = datetime.now().isoformat()
    memory_id = f"mem_{timestamp.replace(':', '-')}"
    
    # Format tags (ensure they have # prefix)
    formatted_tags = []
    if tags:
        formatted_tags = [f"#{tag.strip('#')}" for tag in tags]
    
    memory_entry = {
        "id": memory_id,
        "timestamp": timestamp,
        "content": content,
        "context": context,
        "outcome": outcome,
        "importance": importance,
        "tags": formatted_tags
    }
    
    # Append to the JSONL file
    with open(EPISODIC_MEMORY_FILE, "a") as f:
        f.write(json.dumps(memory_entry) + "\n")
    
    return memory_entry

def get_all_memories() -> List[Dict[str, Any]]:
    """Get all stored episodic memories."""
    initialize_memory_storage()
    
    memories = []
    with open(EPISODIC_MEMORY_FILE, "r") as f:
        for line in f:
            if line.strip():
                try:
                    memory = json.loads(line)
                    memories.append(memory)
                except json.JSONDecodeError:
                    continue
    
    return memories

def get_memories_by_tag(tag: str) -> List[Dict[str, Any]]:
    """
    Get memories filtered by a specific tag.
    
    Args:
        tag: Tag to filter by (with or without # prefix)
        
    Returns:
        List of memory entries with the specified tag
    """
    # Ensure tag has # prefix
    search_tag = f"#{tag.strip('#')}"
    
    memories = get_all_memories()
    return [memory for memory in memories if search_tag in memory.get("tags", [])]

def get_memories_by_importance(importance: str = IMPORTANCE_HIGH) -> List[Dict[str, Any]]:
    """
    Get memories filtered by importance level.
    
    Args:
        importance: Importance level to filter by (high, medium, low)
        
    Returns:
        List of memory entries with the specified importance
    """
    memories = get_all_memories()
    return [memory for memory in memories if memory.get("importance") == importance]

def get_memories_by_timeframe(
    start_date: Optional[Union[str, datetime]] = None,
    end_date: Optional[Union[str, datetime]] = None
) -> List[Dict[str, Any]]:
    """
    Get memories within a specific timeframe.
    
    Args:
        start_date: Start date (inclusive) as string (ISO format) or datetime
        end_date: End date (inclusive) as string (ISO format) or datetime
        
    Returns:
        List of memory entries within the timeframe
    """
    # Convert string dates to datetime if provided
    if isinstance(start_date, str):
        start_date = datetime.fromisoformat(start_date)
    
    if isinstance(end_date, str):
        end_date = datetime.fromisoformat(end_date)
    
    # Default to all-time if no dates provided
    if not start_date and not end_date:
        return get_all_memories()
    
    # Default to "beginning of time" if only end_date provided
    if not start_date:
        start_date = datetime.min
    
    # Default to "now" if only start_date provided
    if not end_date:
        end_date = datetime.now()
    
    memories = get_all_memories()
    filtered_memories = []
    
    for memory in memories:
        try:
            memory_date = datetime.fromisoformat(memory.get("timestamp"))
            if start_date <= memory_date <= end_date:
                filtered_memories.append(memory)
        except (ValueError, TypeError):
            # Skip memories with invalid timestamps
            continue
    
    return filtered_memories

def get_important_recent_memories(
    days: int = 30, 
    importance_level: str = IMPORTANCE_HIGH
) -> List[Dict[str, Any]]:
    """
    Get important memories from the recent past.
    
    Args:
        days: Number of days to look back
        importance_level: Minimum importance level to include
        
    Returns:
        List of important recent memories
    """
    start_date = datetime.now() - timedelta(days=days)
    memories = get_memories_by_timeframe(start_date)
    
    # Filter by importance
    importance_values = {
        IMPORTANCE_HIGH: 3,
        IMPORTANCE_MEDIUM: 2,
        IMPORTANCE_LOW: 1
    }
    
    min_importance = importance_values.get(importance_level, 1)
    
    return [
        memory for memory in memories 
        if importance_values.get(memory.get("importance"), 0) >= min_importance
    ]

def format_memory_for_human(memory: Dict[str, Any]) -> str:
    """
    Format a memory entry for human readability.
    
    Args:
        memory: Memory entry to format
        
    Returns:
        Formatted string representation of the memory
    """
    try:
        date = datetime.fromisoformat(memory.get("timestamp")).strftime("%Y-%m-%d %H:%M")
    except (ValueError, TypeError):
        date = "Unknown date"
    
    result = f"📝 Memory from {date} (Importance: {memory.get('importance', 'medium')})\n\n"
    
    if memory.get("context"):
        result += f"Context: {memory['context']}\n\n"
    
    result += f"{memory.get('content', '')}\n"
    
    if memory.get("outcome"):
        result += f"\nOutcome: {memory['outcome']}\n"
    
    if memory.get("tags"):
        result += f"\nTags: {' '.join(memory.get('tags', []))}\n"
    
    return result

def search_memories(query: str) -> List[Dict[str, Any]]:
    """
    Simple text search through memory content.
    
    Args:
        query: Text to search for in memory content
        
    Returns:
        List of matching memory entries
    """
    query = query.lower()
    memories = get_all_memories()
    
    results = []
    for memory in memories:
        content = memory.get("content", "").lower()
        context = memory.get("context", "").lower()
        outcome = memory.get("outcome", "").lower()
        
        if query in content or query in context or query in outcome:
            results.append(memory)
    
    return results

def generate_memory_markdown() -> str:
    """
    Generate a markdown file of all memories for human reading.
    
    Returns:
        Path to the generated markdown file
    """
    memories = get_all_memories()
    output_file = MEMORY_DIR / "memories.md"
    
    with open(output_file, "w") as f:
        f.write("# Chloe's Episodic Memories\n\n")
        
        for memory in memories:
            f.write(format_memory_for_human(memory) + "\n\n---\n\n")
    
    return str(output_file) 
 