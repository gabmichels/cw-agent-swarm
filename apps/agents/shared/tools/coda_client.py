"""
Coda API client for interacting with Coda documents.

This module provides a simple client for the Coda API, with methods for
reading and writing to Coda documents, tables, and blocks.
"""

import os
import logging
from typing import Dict, List, Any, Optional, Union

import requests
from dotenv import load_dotenv

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

class CodaClient:
    """
    Client for interacting with the Coda API.
    """
    
    def __init__(self, api_token: Optional[str] = None):
        """
        Initialize the Coda client.
        
        Args:
            api_token: Coda API token. If None, will try to load from CODA_API_TOKEN env var.
        """
        self.api_token = api_token or os.getenv("CODA_API_TOKEN")
        if not self.api_token:
            logger.warning("No API token provided. Set CODA_API_TOKEN environment variable.")
        
        self.base_url = "https://coda.io/apis/v1"
        self.headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }
    
    def get_doc(self, doc_id: str) -> Dict[str, Any]:
        """
        Get information about a Coda document.
        
        Args:
            doc_id: The ID of the document
            
        Returns:
            Document information
        """
        url = f"{self.base_url}/docs/{doc_id}"
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        return response.json()
    
    def get_table(self, doc_id: str, table_id_or_name: str) -> Dict[str, Any]:
        """
        Get information about a table in a document.
        
        Args:
            doc_id: The ID of the document
            table_id_or_name: The ID or name of the table
            
        Returns:
            Table information
        """
        url = f"{self.base_url}/docs/{doc_id}/tables/{table_id_or_name}"
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        return response.json()
    
    def get_table_data(self, doc_id: str, table_id_or_name: str, 
                      limit: int = 10, page_token: Optional[str] = None, 
                      sort_by: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get rows from a table.
        
        Args:
            doc_id: The ID of the document
            table_id_or_name: The ID or name of the table
            limit: Maximum number of rows to return
            page_token: Token for pagination
            sort_by: Column to sort by
            
        Returns:
            List of rows from the table
        """
        url = f"{self.base_url}/docs/{doc_id}/tables/{table_id_or_name}/rows"
        params = {
            "limit": limit
        }
        if page_token:
            params["pageToken"] = page_token
        if sort_by:
            params["sortBy"] = sort_by
            
        response = requests.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        data = response.json()
        
        # Extract row data
        rows = []
        for row in data.get("items", []):
            row_data = {}
            for key, value in row.get("values", {}).items():
                row_data[key] = value
            rows.append(row_data)
            
        return rows
    
    def create_row(self, doc_id: str, table_id_or_name: str, 
                  row_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new row in a table.
        
        Args:
            doc_id: The ID of the document
            table_id_or_name: The ID or name of the table
            row_data: Dictionary of column values
            
        Returns:
            Created row information
        """
        url = f"{self.base_url}/docs/{doc_id}/tables/{table_id_or_name}/rows"
        payload = {
            "rows": [
                {
                    "cells": [
                        {
                            "column": col_name,
                            "value": value
                        } for col_name, value in row_data.items()
                    ]
                }
            ]
        }
        
        response = requests.post(url, headers=self.headers, json=payload)
        response.raise_for_status()
        return response.json()
    
    def get_block(self, doc_id: str, block_id: str) -> Dict[str, Any]:
        """
        Get information about a block in a document.
        
        Args:
            doc_id: The ID of the document
            block_id: The ID of the block
            
        Returns:
            Block information
        """
        url = f"{self.base_url}/docs/{doc_id}/blocks/{block_id}"
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        return response.json()
    
    def update_block(self, doc_id: str, block_id: str, content: str) -> Dict[str, Any]:
        """
        Update the content of a block.
        
        Args:
            doc_id: The ID of the document
            block_id: The ID of the block
            content: New content for the block
            
        Returns:
            Updated block information
        """
        url = f"{self.base_url}/docs/{doc_id}/blocks/{block_id}"
        payload = {
            "value": content
        }
        
        response = requests.put(url, headers=self.headers, json=payload)
        response.raise_for_status()
        return response.json()
        
    def create_document(self, title: str, folder_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Create a new Coda document.
        
        Args:
            title: The title of the new document
            folder_id: Optional folder ID to create the document in
            
        Returns:
            New document information including ID and URL
        """
        url = f"{self.base_url}/docs"
        payload = {
            "title": title
        }
        
        if folder_id:
            payload["folderId"] = folder_id
            
        response = requests.post(url, headers=self.headers, json=payload)
        response.raise_for_status()
        return response.json()
        
    def list_documents(self, limit: int = 25) -> List[Dict[str, Any]]:
        """
        List available documents.
        
        Args:
            limit: Maximum number of documents to return
            
        Returns:
            List of document information
        """
        url = f"{self.base_url}/docs"
        params = {
            "limit": limit
        }
        
        response = requests.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        return response.json().get("items", [])
        
    def find_document_by_title(self, title: str) -> Optional[Dict[str, Any]]:
        """
        Find a document by its title.
        
        Args:
            title: The title to search for
            
        Returns:
            Document information or None if not found
        """
        # Get all documents and filter by title
        docs = self.list_documents(limit=100)
        for doc in docs:
            if doc.get("name", "").lower() == title.lower():
                return doc
        return None
        
    def create_table(self, doc_id: str, name: str, columns: List[str]) -> Dict[str, Any]:
        """
        Create a new table in a document.
        
        Args:
            doc_id: The ID of the document
            name: The name of the table
            columns: List of column names
            
        Returns:
            Created table information
        """
        url = f"{self.base_url}/docs/{doc_id}/tables"
        
        # Convert column names to column specs
        column_specs = []
        for column in columns:
            column_specs.append({
                "name": column,
                "display": True
            })
        
        payload = {
            "name": name,
            "columns": column_specs
        }
        
        response = requests.post(url, headers=self.headers, json=payload)
        response.raise_for_status()
        return response.json()
        
    def add_text_block(self, doc_id: str, content: str, position: Optional[str] = None) -> Dict[str, Any]:
        """
        Add a new text block to a document.
        
        Args:
            doc_id: The ID of the document
            content: The content of the text block (markdown supported)
            position: Optional position for insertion (e.g., "after:BLOCK_ID")
            
        Returns:
            Created block information
        """
        url = f"{self.base_url}/docs/{doc_id}/pages/content"
        
        payload = {
            "content": content
        }
        
        if position:
            payload["position"] = position
            
        response = requests.post(url, headers=self.headers, json=payload)
        response.raise_for_status()
        return response.json()
    
    def get_document_content(self, doc_id: str) -> Dict[str, Any]:
        """
        Get all content blocks in a document.
        
        Args:
            doc_id: The ID of the document
            
        Returns:
            Dictionary containing document content
        """
        url = f"{self.base_url}/docs/{doc_id}/content"
        
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        return response.json()
        
    def search_document(self, doc_id: str, query: str) -> Dict[str, Any]:
        """
        Search for content within a document.
        
        Args:
            doc_id: The ID of the document
            query: Search query string
            
        Returns:
            Search results
        """
        url = f"{self.base_url}/docs/{doc_id}/content/search"
        params = {
            "query": query
        }
        
        response = requests.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        return response.json()

# Helper functions for common operations

def write_reflection(doc_id: str, table_id: str, reflection_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Write a reflection to a table in Coda.
    
    Args:
        doc_id: The ID of the document
        table_id: The ID or name of the table
        reflection_data: Dictionary with reflection data
        
    Returns:
        Created row information
    """
    client = CodaClient()
    return client.create_row(doc_id, table_id, reflection_data)

def update_strategy_doc(doc_id: str, block_id: str, content: str, append: bool = True) -> Dict[str, Any]:
    """
    Update a strategy document block in Coda.
    
    Args:
        doc_id: The ID of the document
        block_id: The ID of the block
        content: New content to add
        append: Whether to append to existing content (True) or replace it (False)
        
    Returns:
        Updated block information
    """
    client = CodaClient()
    
    if append:
        # Get current content
        block_info = client.get_block(doc_id, block_id)
        current_content = block_info.get("value", "")
        
        # Append new content
        new_content = f"{current_content}\n\n{content}"
    else:
        new_content = content
    
    # Update the block
    return client.update_block(doc_id, block_id, new_content)

def create_new_document(title: str, initial_content: str = "") -> Dict[str, Any]:
    """
    Create a new document with optional initial content.
    
    Args:
        title: The title of the document
        initial_content: Optional initial content for the document
        
    Returns:
        Dictionary with document ID and URL
    """
    client = CodaClient()
    
    # Create the document
    doc_result = client.create_document(title)
    doc_id = doc_result.get("id")
    
    # Add initial content if provided
    if initial_content and doc_id:
        client.add_text_block(doc_id, initial_content)
    
    return {
        "success": True,
        "doc_id": doc_id,
        "title": title,
        "url": doc_result.get("href", ""),
        "browser_link": doc_result.get("browserLink", "")
    }

# Main function for testing
if __name__ == "__main__":
    # Test the client
    doc_id = os.getenv("CODA_DOC_ID")
    table_id = os.getenv("CODA_REFLECTION_TABLE_ID")
    
    if doc_id and table_id:
        client = CodaClient()
        try:
            # Get document info
            doc_info = client.get_doc(doc_id)
            print(f"Found document: {doc_info.get('name')}")
            
            # Get table info
            table_info = client.get_table(doc_id, table_id)
            print(f"Found table: {table_info.get('name')}")
            
            # Get rows
            rows = client.get_table_data(doc_id, table_id, limit=3)
            print(f"Found {len(rows)} rows in table")
            
            print("Test completed successfully!")
        except Exception as e:
            print(f"Error testing Coda client: {str(e)}")
    else:
        print("Set CODA_DOC_ID and CODA_REFLECTION_TABLE_ID environment variables to test the client.") 