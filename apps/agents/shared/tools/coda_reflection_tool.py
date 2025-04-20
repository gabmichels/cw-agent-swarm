"""
Coda Reflection Tool for Chloe's reflections system.

This module provides tools for publishing reflections to Coda documents
and retrieving reflections from Coda for review.
"""

import os
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
CODA_DOC_ID = os.getenv("CODA_REFLECTION_DOC_ID")
CODA_TABLE_ID = os.getenv("CODA_REFLECTION_TABLE_ID")
CODA_AVAILABLE = bool(os.getenv("CODA_API_TOKEN") and CODA_DOC_ID and CODA_TABLE_ID)

# Import CodaClient only if Coda integration is available
if CODA_AVAILABLE:
    try:
        from apps.agents.shared.tools.coda_client import CodaClient
    except ImportError:
        logger.warning("Failed to import CodaClient. Coda integration will be disabled.")
        CODA_AVAILABLE = False

def get_coda_client() -> Optional["CodaClient"]:
    """
    Get a Coda client instance if available.
    
    Returns:
        CodaClient instance or None if not available
    """
    if not CODA_AVAILABLE:
        logger.warning("Coda integration is not available. Check environment variables.")
        return None
    
    try:
        return CodaClient()
    except Exception as e:
        logger.error(f"Failed to initialize CodaClient: {str(e)}")
        return None

def publish_reflection_to_coda(
    content: str,
    metadata: Optional[Dict[str, Any]] = None,
    doc_id: Optional[str] = None,
    table_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Publish a reflection to Coda.
    
    Args:
        content: The reflection content (markdown text)
        metadata: Additional metadata for the reflection
        doc_id: Optional document ID (defaults to CODA_REFLECTION_DOC_ID)
        table_id: Optional table ID (defaults to CODA_REFLECTION_TABLE_ID)
        
    Returns:
        Dict with status and details about the operation
    """
    client = get_coda_client()
    if not client:
        return {"success": False, "error": "Coda client unavailable"}
    
    doc_id = doc_id or CODA_DOC_ID
    table_id = table_id or CODA_TABLE_ID
    
    if not doc_id or not table_id:
        return {
            "success": False,
            "error": "Missing document or table ID. Check environment variables."
        }
    
    # Prepare metadata
    if metadata is None:
        metadata = {}
    
    # Add timestamp if not provided
    if "timestamp" not in metadata:
        metadata["timestamp"] = datetime.now().isoformat()
    
    # Generate a title for the reflection
    title = get_reflection_title(content, metadata)
    
    # Prepare the data for the row
    row_data = {
        "Title": title,
        "Content": content,
        "Date": datetime.now().strftime("%Y-%m-%d"),
        "Time": datetime.now().strftime("%H:%M:%S"),
        "Metadata": json.dumps(metadata)
    }
    
    # Add any additional fields from metadata
    for key, value in metadata.items():
        if key not in ["timestamp"]:  # Skip keys we've already handled
            row_data[key] = value
    
    try:
        result = client.create_row(doc_id, table_id, row_data)
        return {
            "success": True,
            "message": f"Reflection published: {title}",
            "title": title,
            "result": result
        }
    except Exception as e:
        logger.error(f"Failed to publish reflection: {str(e)}")
        return {
            "success": False,
            "error": f"Failed to publish reflection: {str(e)}"
        }

def get_reflection_title(content: str, metadata: Dict[str, Any]) -> str:
    """
    Generate a title for a reflection based on content and metadata.
    
    Args:
        content: The reflection content
        metadata: Reflection metadata
        
    Returns:
        A title string
    """
    # Use provided title if available
    if "title" in metadata:
        return metadata["title"]
    
    # Extract first line or first sentence
    first_line = content.split("\n")[0].strip()
    if first_line:
        # Remove markdown formatting
        first_line = first_line.replace("#", "").strip()
        # Limit length
        if len(first_line) > 100:
            return first_line[:97] + "..."
        return first_line
    
    # Fallback to generic title with timestamp
    return f"Reflection {datetime.now().strftime('%Y-%m-%d %H:%M')}"

def get_recent_reflections_from_coda(
    limit: int = 5,
    doc_id: Optional[str] = None,
    table_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get recent reflections from Coda.
    
    Args:
        limit: Maximum number of reflections to return
        doc_id: Optional document ID (defaults to CODA_REFLECTION_DOC_ID)
        table_id: Optional table ID (defaults to CODA_REFLECTION_TABLE_ID)
        
    Returns:
        Dict with success status and list of reflections
    """
    client = get_coda_client()
    if not client:
        return {"success": False, "error": "Coda client unavailable", "reflections": []}
    
    doc_id = doc_id or CODA_DOC_ID
    table_id = table_id or CODA_TABLE_ID
    
    if not doc_id or not table_id:
        return {
            "success": False,
            "error": "Missing document or table ID. Check environment variables.",
            "reflections": []
        }
    
    try:
        rows = client.get_table_data(doc_id, table_id, limit=limit, sort_by="Date")
        
        reflections = []
        for row in rows:
            reflection = {
                "title": row.get("Title", "Untitled"),
                "content": row.get("Content", ""),
                "date": row.get("Date", ""),
                "time": row.get("Time", "")
            }
            
            # Extract metadata if available
            metadata_str = row.get("Metadata", "{}")
            try:
                metadata = json.loads(metadata_str)
                reflection["metadata"] = metadata
            except json.JSONDecodeError:
                reflection["metadata"] = {}
            
            reflections.append(reflection)
        
        return {
            "success": True,
            "reflections": reflections,
            "count": len(reflections)
        }
    except Exception as e:
        logger.error(f"Failed to get reflections: {str(e)}")
        return {
            "success": False,
            "error": f"Failed to get reflections: {str(e)}",
            "reflections": []
        }

def search_reflections_in_coda(
    query: str,
    limit: int = 10,
    doc_id: Optional[str] = None,
    table_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Search for reflections in Coda containing the query string.
    
    Args:
        query: The search query
        limit: Maximum number of reflections to return
        doc_id: Optional document ID (defaults to CODA_REFLECTION_DOC_ID)
        table_id: Optional table ID (defaults to CODA_REFLECTION_TABLE_ID)
        
    Returns:
        Dict with success status and list of matching reflections
    """
    client = get_coda_client()
    if not client:
        return {"success": False, "error": "Coda client unavailable", "reflections": []}
    
    doc_id = doc_id or CODA_DOC_ID
    table_id = table_id or CODA_TABLE_ID
    
    if not doc_id or not table_id:
        return {
            "success": False,
            "error": "Missing document or table ID. Check environment variables.",
            "reflections": []
        }
    
    try:
        # Get all rows - will need to implement manual search as Coda API doesn't support content search
        rows = client.get_table_data(doc_id, table_id, limit=100)  # Get more rows to search through
        
        matching_reflections = []
        query_lower = query.lower()
        
        for row in rows:
            title = row.get("Title", "").lower()
            content = row.get("Content", "").lower()
            
            if query_lower in title or query_lower in content:
                reflection = {
                    "title": row.get("Title", "Untitled"),
                    "content": row.get("Content", ""),
                    "date": row.get("Date", ""),
                    "time": row.get("Time", "")
                }
                
                # Extract metadata if available
                metadata_str = row.get("Metadata", "{}")
                try:
                    metadata = json.loads(metadata_str)
                    reflection["metadata"] = metadata
                except json.JSONDecodeError:
                    reflection["metadata"] = {}
                
                matching_reflections.append(reflection)
                
                # Limit results
                if len(matching_reflections) >= limit:
                    break
        
        return {
            "success": True,
            "query": query,
            "reflections": matching_reflections,
            "count": len(matching_reflections)
        }
    except Exception as e:
        logger.error(f"Failed to search reflections: {str(e)}")
        return {
            "success": False,
            "error": f"Failed to search reflections: {str(e)}",
            "reflections": []
        }

# Main function for testing
if __name__ == "__main__":
    # Test the reflection tools
    if CODA_AVAILABLE:
        # Create a test reflection
        test_reflection = "This is a test reflection for Chloe's system. Testing Coda integration."
        metadata = {
            "type": "test",
            "tags": ["test", "integration"],
            "importance": "low"
        }
        
        result = publish_reflection_to_coda(test_reflection, metadata)
        if result["success"]:
            print(f"Successfully published reflection: {result['title']}")
        else:
            print(f"Failed to publish reflection: {result.get('error', 'Unknown error')}")
    else:
        print("Coda integration is not available. Check your environment variables.")
        print("Required: CODA_API_TOKEN, CODA_REFLECTION_DOC_ID, CODA_REFLECTION_TABLE_ID") 