"""
Reflection Tools for Chloe.

This module provides tools for creating, storing, and retrieving reflections,
with integration to Coda when available.
"""

import os
import logging
import json
from typing import Dict, List, Any, Optional
from datetime import datetime
from pathlib import Path

from ..config import CODA_AVAILABLE, CODA_API_TOKEN, CODA_REFLECTION_DOC_ID, CODA_REFLECTION_TABLE_ID

# Local imports
if CODA_AVAILABLE:
    try:
        from .coda_reflection_tool import (
            publish_reflection_to_coda,
            get_recent_reflections_from_coda,
            search_reflections_in_coda
        )
    except ImportError:
        logging.warning("Failed to import Coda reflection tools. Coda integration will be disabled.")
        CODA_AVAILABLE = False

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure local storage directory
REFLECTIONS_DIR = Path(__file__).parent.parent.parent / "data" / "reflections"
REFLECTIONS_DIR.mkdir(parents=True, exist_ok=True)

def create_reflection(
    content: str,
    title: Optional[str] = None,
    reflection_type: str = "general",
    tags: Optional[List[str]] = None,
    importance: str = "medium",
    publish_to_coda: bool = True
) -> Dict[str, Any]:
    """
    Create a new reflection and optionally publish it to Coda if available.
    
    Args:
        content: The reflection content (text/markdown)
        title: Optional title for the reflection (if None, will be generated)
        reflection_type: Type of reflection (e.g., "general", "weekly", "project")
        tags: List of tags for categorizing the reflection
        importance: Importance level ("low", "medium", "high")
        publish_to_coda: Whether to publish to Coda if available
        
    Returns:
        Dict with reflection details and publishing status
    """
    # Generate timestamp
    timestamp = datetime.now().isoformat()
    date_str = datetime.now().strftime("%Y-%m-%d")
    time_str = datetime.now().strftime("%H:%M:%S")
    
    # Create metadata
    if tags is None:
        tags = []
        
    metadata = {
        "timestamp": timestamp,
        "date": date_str,
        "time": time_str,
        "type": reflection_type,
        "tags": tags,
        "importance": importance
    }
    
    # Generate a title if not provided
    if title:
        metadata["title"] = title
    else:
        # Extract first line or sentence for title
        first_line = content.split("\n")[0].strip()
        if first_line:
            # Remove markdown formatting
            first_line = first_line.replace("#", "").strip()
            # Limit length
            if len(first_line) > 100:
                title = first_line[:97] + "..."
            else:
                title = first_line
        else:
            title = f"Reflection {date_str} {time_str}"
        
        metadata["title"] = title
    
    # Create reflection object
    reflection = {
        "title": metadata["title"],
        "content": content,
        "metadata": metadata
    }
    
    # Save locally
    reflection_id = f"{date_str}-{int(datetime.now().timestamp())}"
    filename = f"{reflection_id}.json"
    filepath = REFLECTIONS_DIR / filename
    
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(reflection, f, ensure_ascii=False, indent=2)
        
    logger.info(f"Saved reflection locally: {filepath}")
    
    # Publish to Coda if available and requested
    coda_result = {"success": False, "message": "Coda publishing not attempted"}
    if CODA_AVAILABLE and publish_to_coda:
        try:
            coda_result = publish_reflection_to_coda(content, metadata)
            if coda_result["success"]:
                logger.info(f"Published reflection to Coda: {coda_result.get('title')}")
            else:
                logger.warning(f"Failed to publish reflection to Coda: {coda_result.get('error')}")
        except Exception as e:
            logger.error(f"Error publishing to Coda: {str(e)}")
            coda_result = {"success": False, "error": str(e)}
    
    # Return result
    return {
        "success": True,
        "reflection_id": reflection_id,
        "title": metadata["title"],
        "filepath": str(filepath),
        "coda_publishing": coda_result
    }

def get_recent_reflections(limit: int = 5) -> Dict[str, Any]:
    """
    Get recent reflections, trying Coda first and falling back to local storage.
    
    Args:
        limit: Maximum number of reflections to return
        
    Returns:
        Dict with success status and list of reflections
    """
    # Try Coda first if available
    if CODA_AVAILABLE:
        try:
            coda_result = get_recent_reflections_from_coda(limit)
            if coda_result["success"]:
                return coda_result
            logger.warning(f"Failed to get reflections from Coda: {coda_result.get('error')}")
        except Exception as e:
            logger.error(f"Error getting reflections from Coda: {str(e)}")
    
    # Fall back to local storage
    try:
        # Get list of reflection files sorted by modification time (newest first)
        reflection_files = sorted(
            [f for f in REFLECTIONS_DIR.glob("*.json")],
            key=lambda x: x.stat().st_mtime,
            reverse=True
        )
        
        # Limit to requested number
        reflection_files = reflection_files[:limit]
        
        # Load reflection data
        reflections = []
        for file in reflection_files:
            try:
                with open(file, "r", encoding="utf-8") as f:
                    reflection = json.load(f)
                    reflections.append(reflection)
            except Exception as e:
                logger.error(f"Error reading reflection file {file}: {str(e)}")
        
        return {
            "success": True,
            "reflections": reflections,
            "count": len(reflections),
            "source": "local"
        }
    except Exception as e:
        logger.error(f"Error getting reflections from local storage: {str(e)}")
        return {
            "success": False,
            "error": f"Failed to get reflections: {str(e)}",
            "reflections": []
        }

def search_reflections(query: str, limit: int = 10) -> Dict[str, Any]:
    """
    Search for reflections containing the query string.
    
    Args:
        query: The search query
        limit: Maximum number of reflections to return
        
    Returns:
        Dict with success status and list of matching reflections
    """
    # Try Coda first if available
    if CODA_AVAILABLE:
        try:
            coda_result = search_reflections_in_coda(query, limit)
            if coda_result["success"] and coda_result.get("count", 0) > 0:
                return coda_result
            # If no results or error, fall back to local (continue)
            if coda_result.get("error"):
                logger.warning(f"Failed to search reflections in Coda: {coda_result.get('error')}")
        except Exception as e:
            logger.error(f"Error searching reflections in Coda: {str(e)}")
    
    # Search in local storage
    try:
        # Get list of all reflection files
        reflection_files = list(REFLECTIONS_DIR.glob("*.json"))
        
        # Search for query in each file
        matching_reflections = []
        query_lower = query.lower()
        
        for file in reflection_files:
            try:
                with open(file, "r", encoding="utf-8") as f:
                    reflection = json.load(f)
                    
                    # Check if query is in title or content
                    title = reflection.get("title", "").lower()
                    content = reflection.get("content", "").lower()
                    
                    if query_lower in title or query_lower in content:
                        matching_reflections.append(reflection)
                        
                        # Limit results
                        if len(matching_reflections) >= limit:
                            break
            except Exception as e:
                logger.error(f"Error reading reflection file {file}: {str(e)}")
        
        return {
            "success": True,
            "query": query,
            "reflections": matching_reflections,
            "count": len(matching_reflections),
            "source": "local"
        }
    except Exception as e:
        logger.error(f"Error searching reflections in local storage: {str(e)}")
        return {
            "success": False,
            "error": f"Failed to search reflections: {str(e)}",
            "reflections": []
        }

def create_weekly_reflection(
    content: str,
    title: Optional[str] = None,
    tags: Optional[List[str]] = None,
    publish_to_coda: bool = True
) -> Dict[str, Any]:
    """
    Create a weekly reflection with specific formatting and tagging.
    
    Args:
        content: The reflection content (text/markdown)
        title: Optional title for the reflection (if None, will be generated)
        tags: Additional tags beyond the automatic "weekly" tag
        publish_to_coda: Whether to publish to Coda if available
        
    Returns:
        Dict with reflection details and publishing status
    """
    # Ensure tags include "weekly"
    if tags is None:
        tags = []
    
    if "weekly" not in tags:
        tags.append("weekly")
    
    # Generate title if not provided
    if not title:
        week_num = datetime.now().isocalendar()[1]
        year = datetime.now().year
        title = f"Weekly Reflection: Week {week_num}, {year}"
    
    # Create the reflection with specific type and higher importance
    return create_reflection(
        content=content,
        title=title,
        reflection_type="weekly",
        tags=tags,
        importance="high",
        publish_to_coda=publish_to_coda
    )

# Legacy ReflectionTools class for backwards compatibility
class ReflectionTools:
    """Tools for managing agent reflections."""

    @staticmethod
    def publish_reflection(
        topic: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Publish a reflection to the shared knowledge system.

        Args:
            topic: The topic or subject of the reflection
            content: The main content of the reflection
            metadata: Optional metadata to include (tags, references, etc.)

        Returns:
            Dictionary with status information
        """
        # Convert to new format
        metadata = metadata or {}
        
        # Ensure we have a title
        if "title" not in metadata:
            metadata["title"] = topic
            
        # Convert to tags if applicable
        if "tags" not in metadata and "categories" in metadata:
            metadata["tags"] = metadata["categories"]
            
        result = create_reflection(
            content=content,
            title=metadata.get("title"),
            reflection_type=metadata.get("type", "general"),
            tags=metadata.get("tags", []),
            importance=metadata.get("importance", "medium"),
            publish_to_coda=True
        )
        
        # Convert to legacy format
        if result["success"]:
            return {
                "status": "success",
                "message": f"Reflection on '{topic}' successfully published",
                "reflection_id": result.get("reflection_id", "unknown")
            }
        else:
            return {
                "status": "error",
                "message": f"Failed to publish reflection: {result.get('error', 'Unknown error')}",
                "details": result
            }

    @staticmethod
    def get_recent_reflections(limit: int = 5) -> Dict[str, Any]:
        """
        Retrieve recent reflections from the shared knowledge system.

        Args:
            limit: Maximum number of reflections to return

        Returns:
            Dictionary with status and list of reflections
        """
        result = get_recent_reflections(limit)
        
        # Convert to legacy format
        if result["success"]:
            reflections = result.get("reflections", [])
            formatted_reflections = []

            for r in reflections:
                formatted_reflections.append({
                    "id": r.get("reflection_id", ""),
                    "topic": r.get("title", ""),
                    "timestamp": r.get("metadata", {}).get("timestamp", ""),
                    "content": r.get("content", ""),
                    "metadata": r.get("metadata", {})
                })

            return {
                "status": "success",
                "reflections": formatted_reflections,
                "count": len(formatted_reflections)
            }
        else:
            return {
                "status": "error",
                "message": f"Failed to retrieve reflections: {result.get('error', 'Unknown error')}",
                "details": result
            }

    @staticmethod
    def search_reflections(query: str, limit: int = 5) -> Dict[str, Any]:
        """
        Search for reflections matching the given query.

        Args:
            query: Search terms to look for in reflections
            limit: Maximum number of results to return

        Returns:
            Dictionary with status and matching reflections
        """
        result = search_reflections(query, limit)
        
        # Convert to legacy format
        if result["success"]:
            reflections = result.get("reflections", [])
            formatted_reflections = []

            for r in reflections:
                formatted_reflections.append({
                    "id": r.get("reflection_id", ""),
                    "topic": r.get("title", ""),
                    "timestamp": r.get("metadata", {}).get("timestamp", ""),
                    "content": r.get("content", ""),
                    "metadata": r.get("metadata", {})
                })

            return {
                "status": "success",
                "reflections": formatted_reflections,
                "count": len(formatted_reflections),
                "query": query
            }
        else:
            return {
                "status": "error",
                "message": f"Failed to search reflections: {result.get('error', 'Unknown error')}",
                "details": result
            }

# Legacy export for backwards compatibility
reflection_tools = {
    "publish_reflection": ReflectionTools.publish_reflection,
    "get_recent_reflections": ReflectionTools.get_recent_reflections,
    "search_reflections": ReflectionTools.search_reflections
}

if __name__ == "__main__":
    # Test the reflection tools
    test_reflection = """# Testing Reflection System
    
This is a test reflection to verify the local and Coda integration systems are working properly.
    
## Key Points
- Testing local storage
- Testing Coda integration
- Verifying search capabilities
"""
    
    # Create a test reflection
    print("Creating test reflection...")
    result = create_reflection(
        content=test_reflection,
        tags=["test", "system"],
        importance="low"
    )
    print(f"Result: {result['success']}")
    print(f"Title: {result['title']}")
    print(f"Coda publishing: {result['coda_publishing']['success'] if CODA_AVAILABLE else 'not attempted'}")
    
    # Get recent reflections
    print("\nGetting recent reflections...")
    recent = get_recent_reflections(limit=3)
    print(f"Found {recent['count']} reflections")
    
    # Search reflections
    print("\nSearching reflections...")
    search_results = search_reflections("test")
    print(f"Found {search_results['count']} matching reflections") 