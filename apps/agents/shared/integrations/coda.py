"""
Integration with Coda API for reading and writing to shared documents.
"""
import os
import logging
import time
from typing import Dict, List, Any, Optional, Union
from datetime import datetime
import requests
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Check if Coda API token is available in environment
CODA_API_TOKEN = os.environ.get("CODA_API_TOKEN")
CODA_DOC_ID = os.environ.get("CODA_REFLECTION_DOC_ID")
CODA_TABLE_ID = os.environ.get("CODA_REFLECTION_TABLE_ID")

class CodaReflection(BaseModel):
    """Model representing a reflection stored in Coda."""
    id: str
    timestamp: datetime
    topic: str
    content: str
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)

def is_coda_available() -> bool:
    """Check if Coda integration is properly configured."""
    return bool(CODA_API_TOKEN and CODA_DOC_ID and CODA_TABLE_ID)

def get_coda_headers() -> Dict[str, str]:
    """Get headers for Coda API requests."""
    return {
        "Authorization": f"Bearer {CODA_API_TOKEN}",
        "Content-Type": "application/json"
    }

def publish_reflection_to_coda(
    topic: str, 
    content: str, 
    metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Publish a reflection to Coda document.
    
    Args:
        topic: The topic or title of the reflection
        content: The content of the reflection
        metadata: Optional metadata to store with the reflection
        
    Returns:
        Dictionary with status and message/data
    """
    if not is_coda_available():
        logger.warning("Coda integration not available. Cannot publish reflection.")
        return {
            "success": False,
            "message": "Coda integration not available. Check environment variables."
        }
    
    metadata = metadata or {}
    current_time = datetime.now().isoformat()
    
    try:
        url = f"https://coda.io/apis/v1/docs/{CODA_DOC_ID}/tables/{CODA_TABLE_ID}/rows"
        
        # Prepare row data
        row_data = {
            "cells": [
                {"column": "Topic", "value": topic},
                {"column": "Timestamp", "value": current_time},
                {"column": "Content", "value": content},
                {"column": "Metadata", "value": str(metadata)}
            ]
        }
        
        response = requests.post(
            url,
            headers=get_coda_headers(),
            json=row_data
        )
        
        if response.status_code in (200, 201, 202):
            row_id = response.json().get("id", "unknown")
            logger.info(f"Successfully published reflection to Coda with ID: {row_id}")
            return {
                "success": True,
                "reflection_id": row_id,
                "timestamp": current_time
            }
        else:
            logger.error(f"Failed to publish to Coda: {response.status_code} - {response.text}")
            return {
                "success": False,
                "message": f"API error: {response.status_code}",
                "details": response.text
            }
            
    except Exception as e:
        logger.exception(f"Error publishing reflection to Coda: {str(e)}")
        return {
            "success": False,
            "message": f"Error: {str(e)}"
        }

def get_reflections_from_coda(limit: int = 10) -> Dict[str, Any]:
    """
    Retrieve recent reflections from Coda.
    
    Args:
        limit: Maximum number of reflections to return
        
    Returns:
        Dictionary with status and list of reflections
    """
    if not is_coda_available():
        logger.warning("Coda integration not available. Cannot retrieve reflections.")
        return {
            "success": False,
            "message": "Coda integration not available. Check environment variables."
        }
    
    try:
        url = f"https://coda.io/apis/v1/docs/{CODA_DOC_ID}/tables/{CODA_TABLE_ID}/rows?limit={limit}&sortBy=natural"
        
        response = requests.get(
            url,
            headers=get_coda_headers()
        )
        
        if response.status_code == 200:
            data = response.json()
            reflections = []
            
            for row in data.get("items", []):
                # Extract values from cells
                cells = row.get("values", {})
                
                reflection = {
                    "id": row.get("id", ""),
                    "topic": cells.get("Topic", ""),
                    "timestamp": cells.get("Timestamp", ""),
                    "content": cells.get("Content", ""),
                    "metadata": cells.get("Metadata", "{}")
                }
                
                reflections.append(reflection)
                
            logger.info(f"Retrieved {len(reflections)} reflections from Coda")
            return {
                "success": True,
                "reflections": reflections
            }
        else:
            logger.error(f"Failed to retrieve reflections from Coda: {response.status_code} - {response.text}")
            return {
                "success": False,
                "message": f"API error: {response.status_code}",
                "details": response.text
            }
            
    except Exception as e:
        logger.exception(f"Error retrieving reflections from Coda: {str(e)}")
        return {
            "success": False,
            "message": f"Error: {str(e)}"
        }

def search_reflections_in_coda(query: str, limit: int = 10) -> Dict[str, Any]:
    """
    Search for reflections in Coda based on query string.
    
    Args:
        query: Search query string
        limit: Maximum number of results to return
        
    Returns:
        Dictionary with status and matching reflections
    """
    if not is_coda_available():
        logger.warning("Coda integration not available. Cannot search reflections.")
        return {
            "success": False,
            "message": "Coda integration not available. Check environment variables."
        }
    
    try:
        # First get reflections
        result = get_reflections_from_coda(limit=100)  # Get a larger set to search through
        
        if not result["success"]:
            return result
            
        # Perform client-side filtering (Coda API doesn't support robust searching)
        query = query.lower()
        matching_reflections = []
        
        for reflection in result["reflections"]:
            if (query in reflection["topic"].lower() or 
                query in reflection["content"].lower()):
                matching_reflections.append(reflection)
                
            if len(matching_reflections) >= limit:
                break
                
        logger.info(f"Found {len(matching_reflections)} reflections matching '{query}'")
        return {
            "success": True,
            "reflections": matching_reflections[:limit]
        }
            
    except Exception as e:
        logger.exception(f"Error searching reflections in Coda: {str(e)}")
        return {
            "success": False,
            "message": f"Error: {str(e)}"
        } 