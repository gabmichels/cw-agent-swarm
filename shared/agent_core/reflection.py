"""
Agent Core Reflection
-------------------
Shared reflection system that enables agents to analyze patterns, draw insights
from past experiences, and improve performance over time.
"""

from typing import Dict, List, Any, Optional
import datetime
import logging
import os
import json
from pathlib import Path

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Reflection types
REFLECTION_TYPE_DAILY = "daily"
REFLECTION_TYPE_WEEKLY = "weekly"  
REFLECTION_TYPE_TASK = "task"
REFLECTION_TYPE_USER = "user_interaction"
REFLECTION_TYPE_CUSTOM = "custom"

# Importance levels
IMPORTANCE_HIGH = "high"
IMPORTANCE_MEDIUM = "medium"
IMPORTANCE_LOW = "low"

def generate_reflection(
    content: str,
    reflection_type: str = REFLECTION_TYPE_CUSTOM,
    title: str = "",
    tags: List[str] = None,
    importance: str = IMPORTANCE_MEDIUM,
    agent_name: str = "generic",
    metadata: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    Generate and store a reflection.
    
    Args:
        content: The reflection content
        reflection_type: Type of reflection (daily, weekly, task, etc.)
        title: Optional title for the reflection
        tags: Optional list of tags to categorize the reflection
        importance: Importance level (high, medium, low)
        agent_name: Name of the agent creating the reflection
        metadata: Additional metadata for the reflection
        
    Returns:
        The created reflection as a dictionary
    """
    # Validate importance
    if importance not in [IMPORTANCE_HIGH, IMPORTANCE_MEDIUM, IMPORTANCE_LOW]:
        importance = IMPORTANCE_MEDIUM
    
    # Initialize tags if None
    if tags is None:
        tags = []
    
    # Ensure reflection type is included in tags
    if reflection_type not in tags:
        tags.append(reflection_type)
    
    # Set default title if not provided
    if not title:
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d")
        title = f"{reflection_type.capitalize()} Reflection - {timestamp}"
    
    # Create reflection ID
    timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
    reflection_id = f"reflection_{timestamp}"
    
    # Initialize metadata if None
    if metadata is None:
        metadata = {}
    
    # Add agent name to metadata
    metadata["agent_name"] = agent_name
    
    # Create the reflection
    reflection = {
        "id": reflection_id,
        "title": title,
        "content": content,
        "type": reflection_type,
        "tags": tags,
        "importance": importance,
        "created_at": datetime.datetime.now().isoformat(),
        "metadata": metadata
    }
    
    # Save the reflection
    save_reflection(reflection)
    
    return reflection

def save_reflection(reflection: Dict[str, Any]) -> bool:
    """
    Save a reflection to storage.
    
    Args:
        reflection: The reflection to save
        
    Returns:
        True if saved successfully, False otherwise
    """
    try:
        reflections_dir = get_reflections_directory()
        filename = f"{reflection['id']}.json"
        filepath = os.path.join(reflections_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(reflection, f, indent=2)
        
        logger.info(f"Saved reflection: {reflection['title']} ({reflection['id']})")
        return True
    except Exception as e:
        logger.error(f"Error saving reflection: {str(e)}")
        return False

def get_reflections_directory() -> str:
    """
    Get the directory for storing reflections, creating it if it doesn't exist.
    
    Returns:
        Path to the reflections directory
    """
    # Get base path from script location
    script_dir = Path(os.path.dirname(os.path.abspath(__file__)))
    base_dir = script_dir.parent.parent  # Up two levels (to project root)
    reflections_dir = os.path.join(base_dir, "shared", "agent_core", "memory", "reflections")
    
    # Create directory if it doesn't exist
    os.makedirs(reflections_dir, exist_ok=True)
    
    return reflections_dir

def get_reflection(reflection_id: str) -> Optional[Dict[str, Any]]:
    """
    Get a reflection by ID.
    
    Args:
        reflection_id: The ID of the reflection to retrieve
        
    Returns:
        The reflection dictionary, or None if not found
    """
    try:
        reflections_dir = get_reflections_directory()
        filepath = os.path.join(reflections_dir, f"{reflection_id}.json")
        
        if not os.path.exists(filepath):
            return None
        
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error getting reflection {reflection_id}: {str(e)}")
        return None

def get_all_reflections() -> List[Dict[str, Any]]:
    """
    Get all reflections.
    
    Returns:
        List of all reflection dictionaries
    """
    reflections = []
    
    try:
        reflections_dir = get_reflections_directory()
        
        for filename in os.listdir(reflections_dir):
            if filename.endswith('.json'):
                filepath = os.path.join(reflections_dir, filename)
                
                with open(filepath, 'r', encoding='utf-8') as f:
                    reflection = json.load(f)
                    reflections.append(reflection)
    except Exception as e:
        logger.error(f"Error getting reflections: {str(e)}")
    
    # Sort by creation time (newest first)
    reflections.sort(key=lambda x: x["created_at"], reverse=True)
    
    return reflections

def get_reflections_by_type(
    reflection_type: str, 
    limit: int = None
) -> List[Dict[str, Any]]:
    """
    Get reflections of a specific type.
    
    Args:
        reflection_type: Type of reflection to retrieve
        limit: Optional limit on number of reflections to return
        
    Returns:
        List of matching reflection dictionaries
    """
    all_reflections = get_all_reflections()
    matching_reflections = [r for r in all_reflections if r["type"] == reflection_type]
    
    if limit is not None:
        matching_reflections = matching_reflections[:limit]
    
    return matching_reflections

def get_reflections_by_tag(
    tag: str, 
    limit: int = None
) -> List[Dict[str, Any]]:
    """
    Get reflections with a specific tag.
    
    Args:
        tag: Tag to search for
        limit: Optional limit on number of reflections to return
        
    Returns:
        List of matching reflection dictionaries
    """
    all_reflections = get_all_reflections()
    matching_reflections = [r for r in all_reflections if tag in r["tags"]]
    
    if limit is not None:
        matching_reflections = matching_reflections[:limit]
    
    return matching_reflections

def get_reflections_by_importance(
    importance: str,
    limit: int = None
) -> List[Dict[str, Any]]:
    """
    Get reflections with a specific importance level.
    
    Args:
        importance: Importance level to filter by
        limit: Optional limit on number of reflections to return
        
    Returns:
        List of matching reflection dictionaries
    """
    all_reflections = get_all_reflections()
    matching_reflections = [r for r in all_reflections if r["importance"] == importance]
    
    if limit is not None:
        matching_reflections = matching_reflections[:limit]
    
    return matching_reflections

def get_reflections_by_agent(
    agent_name: str,
    limit: int = None
) -> List[Dict[str, Any]]:
    """
    Get reflections created by a specific agent.
    
    Args:
        agent_name: Name of the agent
        limit: Optional limit on number of reflections to return
        
    Returns:
        List of matching reflection dictionaries
    """
    all_reflections = get_all_reflections()
    matching_reflections = [
        r for r in all_reflections 
        if r.get("metadata", {}).get("agent_name") == agent_name
    ]
    
    if limit is not None:
        matching_reflections = matching_reflections[:limit]
    
    return matching_reflections

def run_weekly_reflection(
    agent_name: str,
    reflection_data: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    Run a weekly reflection process for an agent.
    
    Args:
        agent_name: Name of the agent
        reflection_data: Optional data to include in the reflection
        
    Returns:
        The generated weekly reflection
    """
    # This would normally involve:
    # 1. Analyzing recent agent activity
    # 2. Identifying patterns and insights
    # 3. Generating a reflection with appropriate tags, importance, etc.
    
    # For now we'll just create a placeholder
    if reflection_data is None:
        reflection_data = {}
    
    content = reflection_data.get("content", "Weekly reflection placeholder.")
    title = reflection_data.get("title", f"{agent_name} Weekly Reflection")
    tags = reflection_data.get("tags", ["weekly", agent_name])
    
    return generate_reflection(
        content=content,
        reflection_type=REFLECTION_TYPE_WEEKLY,
        title=title,
        tags=tags,
        importance=IMPORTANCE_HIGH,
        agent_name=agent_name
    )

def search_reflections(
    query: str,
    limit: int = 10
) -> List[Dict[str, Any]]:
    """
    Search reflections by content.
    
    Args:
        query: Search query
        limit: Maximum number of results to return
        
    Returns:
        List of matching reflection dictionaries
    """
    # Simple keyword search for now, would be replaced with vector search
    all_reflections = get_all_reflections()
    query = query.lower()
    
    # Check title and content for the query
    matching_reflections = [
        r for r in all_reflections
        if query in r["title"].lower() or query in r["content"].lower()
    ]
    
    # Sort by relevance (simple count of query occurrences)
    def relevance_score(reflection):
        title_count = reflection["title"].lower().count(query)
        content_count = reflection["content"].lower().count(query)
        return title_count * 3 + content_count  # Title matches weighted more heavily
    
    matching_reflections.sort(key=relevance_score, reverse=True)
    
    if limit is not None:
        matching_reflections = matching_reflections[:limit]
    
    return matching_reflections 