"""
Document Generation Tools for Chloe.

This module provides tools for creating and updating structured documents in Coda.
"""

import os
import re
import logging
from typing import Dict, List, Any, Optional, Union, Tuple
from datetime import datetime
from pathlib import Path

from ..config import CODA_AVAILABLE, CODA_API_TOKEN

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import Coda client if available
if CODA_AVAILABLE:
    try:
        from .coda_client import CodaClient, create_new_document
    except ImportError:
        logger.warning("Failed to import CodaClient. Document generation will be limited.")
        CODA_AVAILABLE = False

def extract_coda_doc_id(message: str) -> Optional[str]:
    """
    Extract a Coda document ID from a message.
    
    Looks for patterns like [CODA_DOC_ID] or [doc-id:XXX] in the message.
    
    Args:
        message: The message to search in
        
    Returns:
        The document ID if found, None otherwise
    """
    # Check for [CODA_DOC_ID:something] format first
    pattern1 = r'\[CODA_DOC_ID:([^\]]+)\]'
    match = re.search(pattern1, message)
    if match:
        return match.group(1).strip()
    
    # Check for [CODA_DOC_ID] format where we need to find the doc ID elsewhere
    if '[CODA_DOC_ID]' in message:
        # Try to extract a document ID from a URL pattern
        url_pattern = r'coda\.io/d/([^/\s]+)'
        url_match = re.search(url_pattern, message)
        if url_match:
            return url_match.group(1).strip()
    
    # Check for any document ID format (e.g., doc-xxxx)
    doc_pattern = r'\b(doc-[a-zA-Z0-9_-]+)\b'
    doc_match = re.search(doc_pattern, message)
    if doc_match:
        return doc_match.group(1).strip()
    
    return None

def identify_document_section(doc_id: str, section_name: str) -> Optional[str]:
    """
    Identify a section in a document by name.
    
    Args:
        doc_id: The document ID
        section_name: The name of the section to find
        
    Returns:
        The block ID of the section if found, None otherwise
    """
    if not CODA_AVAILABLE:
        logger.warning("Coda integration not available. Cannot identify document section.")
        return None
    
    try:
        client = CodaClient()
        
        # Get document content
        content = client.get_document_content(doc_id)
        
        # Look for a section with the given name
        for item in content.get("items", []):
            if item.get("type") == "section" and section_name.lower() in item.get("name", "").lower():
                return item.get("id")
            
            # Also check text blocks for headings that match
            if item.get("type") == "text" and section_name.lower() in item.get("name", "").lower():
                return item.get("id")
        
        return None
    except Exception as e:
        logger.error(f"Error identifying document section: {str(e)}")
        return None

def update_document_section(doc_id: str, section_identifier: str, content: str, 
                           append: bool = True) -> Dict[str, Any]:
    """
    Update a section in a document.
    
    Args:
        doc_id: The document ID
        section_identifier: The section identifier (name or ID)
        content: The content to add
        append: Whether to append to existing content (True) or replace it (False)
        
    Returns:
        Dictionary with update status
    """
    if not CODA_AVAILABLE:
        logger.warning("Coda integration not available. Cannot update document section.")
        return {"success": False, "error": "Coda integration not available"}
    
    try:
        client = CodaClient()
        
        # First check if section_identifier is an ID
        block_id = section_identifier
        
        # If not, try to find the section by name
        if not section_identifier.startswith("block-"):
            found_id = identify_document_section(doc_id, section_identifier)
            if found_id:
                block_id = found_id
            else:
                # If section not found, create it
                result = client.add_text_block(doc_id, f"# {section_identifier}\n\n{content}")
                return {
                    "success": True,
                    "message": f"Created new section '{section_identifier}'",
                    "block_id": result.get("id", ""),
                    "action": "created"
                }
        
        # Update existing block
        if append:
            # Get current content
            try:
                block_info = client.get_block(doc_id, block_id)
                current_content = block_info.get("value", "")
                
                # Append new content
                full_content = f"{current_content}\n\n{content}"
            except Exception:
                # Block not found, create new content
                full_content = f"# {section_identifier}\n\n{content}"
        else:
            # Replace content entirely
            full_content = content
        
        # Update the block
        result = client.update_block(doc_id, block_id, full_content)
        
        return {
            "success": True,
            "message": f"Updated section '{section_identifier}'",
            "block_id": block_id,
            "action": "updated"
        }
    except Exception as e:
        logger.error(f"Error updating document section: {str(e)}")
        return {
            "success": False, 
            "error": f"Failed to update document section: {str(e)}"
        }

def create_marketing_goals_document(
    title: str, 
    year: int, 
    goals: List[str], 
    strategies: Dict[str, List[str]],
    metrics: List[Dict[str, Any]],
    timeline: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Create a marketing goals document with structured sections.
    
    Args:
        title: Document title
        year: Year for the marketing goals
        goals: List of marketing goals
        strategies: Dictionary mapping goal categories to strategies
        metrics: List of metrics with targets
        timeline: Dictionary with timeline information
        
    Returns:
        Dictionary with document information
    """
    if not CODA_AVAILABLE:
        logger.warning("Coda integration not available. Cannot create marketing document.")
        return {"success": False, "error": "Coda integration not available"}
    
    try:
        # Format document content
        introduction = f"""# {title}: {year}

## Executive Summary

This document outlines our marketing strategy and goals for {year}. It includes our key objectives, 
strategies for achieving them, metrics for measuring success, and a timeline for implementation.

Created by Chloe on {datetime.now().strftime('%Y-%m-%d')}.
"""

        # Format goals section
        goals_section = "## Key Goals\n\n"
        for i, goal in enumerate(goals, 1):
            goals_section += f"{i}. {goal}\n"
        
        # Format strategies section
        strategies_section = "## Strategies\n\n"
        for category, strategy_list in strategies.items():
            strategies_section += f"### {category}\n\n"
            for strategy in strategy_list:
                strategies_section += f"- {strategy}\n"
            strategies_section += "\n"
        
        # Format metrics section
        metrics_section = "## Key Metrics\n\n"
        metrics_section += "| Metric | Target | Timeline |\n"
        metrics_section += "|--------|--------|----------|\n"
        for metric in metrics:
            metrics_section += f"| {metric.get('name', '')} | {metric.get('target', '')} | {metric.get('timeline', '')} |\n"
        
        # Format timeline section
        timeline_section = "## Timeline\n\n"
        timeline_section += "### Key Milestones\n\n"
        for quarter, milestones in timeline.items():
            timeline_section += f"**{quarter}**\n\n"
            for milestone in milestones:
                timeline_section += f"- {milestone}\n"
            timeline_section += "\n"
        
        # Assemble full document
        full_content = f"{introduction}\n\n{goals_section}\n\n{strategies_section}\n\n{metrics_section}\n\n{timeline_section}"
        
        # Create the document
        client = CodaClient()
        doc_result = client.create_document(f"{title}: {year}")
        doc_id = doc_result.get("id")
        
        # Add the content
        client.add_text_block(doc_id, full_content)
        
        # Create metrics table
        table_columns = ["Metric", "Target", "Timeline", "Current Status", "Owner"]
        client.create_table(doc_id, "Metrics Tracking", table_columns)
        
        # Add rows to the metrics table
        for metric in metrics:
            row_data = {
                "Metric": metric.get("name", ""),
                "Target": metric.get("target", ""),
                "Timeline": metric.get("timeline", ""),
                "Current Status": "Not started",
                "Owner": metric.get("owner", "TBD")
            }
            client.create_row(doc_id, "Metrics Tracking", row_data)
        
        return {
            "success": True,
            "doc_id": doc_id,
            "title": doc_result.get("name", title),
            "url": doc_result.get("href", ""),
            "browser_link": doc_result.get("browserLink", ""),
            "message": f"Created marketing goals document: {title}: {year}"
        }
    except Exception as e:
        logger.error(f"Error creating marketing goals document: {str(e)}")
        return {
            "success": False,
            "error": f"Failed to create document: {str(e)}"
        }

def create_general_document(
    title: str,
    sections: Dict[str, str]
) -> Dict[str, Any]:
    """
    Create a general document with customizable sections.
    
    Args:
        title: Document title
        sections: Dictionary mapping section names to content
        
    Returns:
        Dictionary with document information
    """
    if not CODA_AVAILABLE:
        logger.warning("Coda integration not available. Cannot create document.")
        return {"success": False, "error": "Coda integration not available"}
    
    try:
        # Create the document
        client = CodaClient()
        doc_result = client.create_document(title)
        doc_id = doc_result.get("id")
        
        # Add the sections
        for section_name, content in sections.items():
            # Format the section
            section_content = f"# {section_name}\n\n{content}"
            client.add_text_block(doc_id, section_content)
        
        return {
            "success": True,
            "doc_id": doc_id,
            "title": doc_result.get("name", title),
            "url": doc_result.get("href", ""),
            "browser_link": doc_result.get("browserLink", ""),
            "message": f"Created document: {title}"
        }
    except Exception as e:
        logger.error(f"Error creating document: {str(e)}")
        return {
            "success": False,
            "error": f"Failed to create document: {str(e)}"
        }

def process_document_request(message: str, content: str) -> Dict[str, Any]:
    """
    Process a document request, creating or updating a document as needed.
    
    Args:
        message: User message containing document request
        content: Content to add to the document
        
    Returns:
        Dictionary with operation results
    """
    if not CODA_AVAILABLE:
        logger.warning("Coda integration not available. Cannot process document request.")
        return {"success": False, "error": "Coda integration not available"}
    
    try:
        # Check if the message contains a document ID
        doc_id = extract_coda_doc_id(message)
        
        if doc_id:
            # Update existing document
            # Try to determine the section to update
            section_names = ["summary", "goals", "strategies", "metrics", 
                           "timeline", "recommendations", "thoughts", "updates"]
            
            # Find potential section name in message
            section_to_update = None
            for section in section_names:
                if section.lower() in message.lower():
                    section_to_update = section
                    break
            
            # If no specific section found, use a default
            if not section_to_update:
                section_to_update = "Updates"
            
            # Update the document
            result = update_document_section(
                doc_id, 
                section_to_update,
                content,
                append=True
            )
            
            if result.get("success"):
                return {
                    "success": True,
                    "doc_id": doc_id,
                    "section": section_to_update,
                    "action": "updated",
                    "message": f"Updated section '{section_to_update}' in document {doc_id}"
                }
            else:
                return result
        else:
            # Create a new document
            # Try to determine document type from message
            if "market" in message.lower() and "goal" in message.lower():
                # Parse as marketing goals document
                year = datetime.now().year
                # Extract year if mentioned
                year_match = re.search(r'\b(20\d{2})\b', message)
                if year_match:
                    year = int(year_match.group(1))
                
                # Extract title
                title_match = re.search(r'create a document (called|named|titled) ["\']?([^"\']+)["\']?', message, re.IGNORECASE)
                if title_match:
                    title = title_match.group(2).strip()
                else:
                    title = f"Marketing Goals and Strategy"
                
                # Parse content for goals, strategies, etc.
                goals, strategies, metrics, timeline = parse_marketing_content(content)
                
                # Create the document
                return create_marketing_goals_document(
                    title,
                    year,
                    goals,
                    strategies,
                    metrics,
                    timeline
                )
            else:
                # Create a general document
                # Extract title
                title_match = re.search(r'create a document (called|named|titled) ["\']?([^"\']+)["\']?', message, re.IGNORECASE)
                if title_match:
                    title = title_match.group(2).strip()
                else:
                    title = f"Document: {datetime.now().strftime('%Y-%m-%d')}"
                
                # Parse sections from content
                sections = parse_document_sections(content)
                
                # Create the document
                return create_general_document(title, sections)
    except Exception as e:
        logger.error(f"Error processing document request: {str(e)}")
        return {
            "success": False,
            "error": f"Failed to process document request: {str(e)}"
        }

def parse_marketing_content(content: str) -> Tuple[List[str], Dict[str, List[str]], List[Dict[str, Any]], Dict[str, List[str]]]:
    """
    Parse marketing content into structured data.
    
    Args:
        content: The content to parse
        
    Returns:
        Tuple of (goals, strategies, metrics, timeline)
    """
    # Extract goals (look for bullet points or numbered lists after "goals" heading)
    goals = []
    goals_section = re.search(r'(?:^|\n)#+\s*Goals?\s*\n(.*?)(?:\n#+|$)', content, re.DOTALL | re.IGNORECASE)
    if goals_section:
        goals_text = goals_section.group(1)
        # Extract bullet points
        bullet_matches = re.findall(r'(?:^|\n)[*\-•]\s*(.*?)(?:\n|$)', goals_text)
        goals.extend([m.strip() for m in bullet_matches if m.strip()])
        # Extract numbered points
        numbered_matches = re.findall(r'(?:^|\n)\d+\.\s*(.*?)(?:\n|$)', goals_text)
        goals.extend([m.strip() for m in numbered_matches if m.strip()])
    
    # If no goals found, try to extract them from content
    if not goals:
        # Look for keywords like "goal is to" or "goals include"
        goal_phrases = re.findall(r'(?:goal is to|goals? include|aim to|objective is to|plan to) (.*?)(?:\.|$)', content, re.IGNORECASE)
        goals.extend([g.strip() for g in goal_phrases if g.strip()])
    
    # If still no goals, create a generic one
    if not goals:
        goals = ["Increase market visibility and brand awareness"]
    
    # Extract strategies
    strategies = {}
    
    # Look for strategy sections
    strategy_section = re.search(r'(?:^|\n)#+\s*Strategies?\s*\n(.*?)(?:\n#+|$)', content, re.DOTALL | re.IGNORECASE)
    if strategy_section:
        strategy_text = strategy_section.group(1)
        
        # Look for subsections
        subsections = re.findall(r'(?:^|\n)#+\s*(.*?)\s*\n(.*?)(?:\n#+|$)', strategy_text, re.DOTALL)
        
        if subsections:
            for subsection in subsections:
                category = subsection[0].strip()
                subtext = subsection[1]
                
                # Extract bullet points
                strategies_list = []
                bullet_matches = re.findall(r'(?:^|\n)[*\-•]\s*(.*?)(?:\n|$)', subtext)
                strategies_list.extend([m.strip() for m in bullet_matches if m.strip()])
                
                if strategies_list:
                    strategies[category] = strategies_list
        
        # If no subsections, extract all bullet points as general strategies
        if not strategies:
            general_strategies = []
            bullet_matches = re.findall(r'(?:^|\n)[*\-•]\s*(.*?)(?:\n|$)', strategy_text)
            general_strategies.extend([m.strip() for m in bullet_matches if m.strip()])
            
            if general_strategies:
                strategies["General Strategies"] = general_strategies
    
    # If no strategies found, create some based on goals
    if not strategies:
        general_strategies = []
        for goal in goals:
            if "awareness" in goal.lower():
                general_strategies.append("Increase social media presence and engagement")
            if "lead" in goal.lower() or "conversion" in goal.lower():
                general_strategies.append("Implement targeted lead generation campaigns")
            if "retention" in goal.lower() or "customer" in goal.lower():
                general_strategies.append("Develop customer loyalty program")
        
        # Add some generic strategies if needed
        if not general_strategies:
            general_strategies = [
                "Enhance digital marketing presence",
                "Develop content marketing strategy",
                "Optimize customer journey"
            ]
        
        strategies["General Strategies"] = general_strategies
    
    # Extract metrics
    metrics = []
    metrics_section = re.search(r'(?:^|\n)#+\s*Metrics\s*\n(.*?)(?:\n#+|$)', content, re.DOTALL | re.IGNORECASE)
    if metrics_section:
        metrics_text = metrics_section.group(1)
        
        # Extract bullet points with potential metrics
        bullet_matches = re.findall(r'(?:^|\n)[*\-•]\s*(.*?)(?:\n|$)', metrics_text)
        
        for match in bullet_matches:
            # Try to parse metric, target, and timeline
            metric_name = match.strip()
            target = ""
            timeline = ""
            
            # Look for specific formats
            target_match = re.search(r'(.*?)(?::|-)?\s*(?:target|goal|aim)?\s*(?:is|of|:)?\s*(\d+%|\d+|\w+\s+\d+%)', match, re.IGNORECASE)
            if target_match:
                metric_name = target_match.group(1).strip()
                target = target_match.group(2).strip()
            
            # Look for timeline
            timeline_match = re.search(r'by\s+(Q\d|quarter\s+\d|end\s+of\s+\w+|\w+\s+\d{4})', match, re.IGNORECASE)
            if timeline_match:
                timeline = timeline_match.group(1).strip()
            
            metrics.append({
                "name": metric_name,
                "target": target,
                "timeline": timeline
            })
    
    # If no metrics found, create generic ones based on goals
    if not metrics:
        if any("awareness" in goal.lower() for goal in goals):
            metrics.append({"name": "Brand Awareness", "target": "30% increase", "timeline": "Q4"})
        if any("lead" in goal.lower() for goal in goals):
            metrics.append({"name": "Lead Generation", "target": "500 new leads", "timeline": "Q3"})
        if any("conversion" in goal.lower() for goal in goals):
            metrics.append({"name": "Conversion Rate", "target": "15%", "timeline": "Year-end"})
        
        # Add some generic metrics if needed
        if not metrics:
            metrics = [
                {"name": "Website Traffic", "target": "50% increase", "timeline": "Q4"},
                {"name": "Engagement Rate", "target": "25% increase", "timeline": "Q3"},
                {"name": "ROI", "target": "20%", "timeline": "Year-end"}
            ]
    
    # Extract timeline information
    timeline = {}
    timeline_section = re.search(r'(?:^|\n)#+\s*Timeline\s*\n(.*?)(?:\n#+|$)', content, re.DOTALL | re.IGNORECASE)
    if timeline_section:
        timeline_text = timeline_section.group(1)
        
        # Look for quarter sections
        quarter_sections = re.findall(r'(?:^|\n)#+\s*(Q\d|Quarter\s+\d)\s*\n(.*?)(?:\n#+|$)', timeline_text, re.DOTALL | re.IGNORECASE)
        
        if quarter_sections:
            for quarter_section in quarter_sections:
                quarter = quarter_section[0].strip()
                quarter_text = quarter_section[1]
                
                # Extract bullet points
                milestones = []
                bullet_matches = re.findall(r'(?:^|\n)[*\-•]\s*(.*?)(?:\n|$)', quarter_text)
                milestones.extend([m.strip() for m in bullet_matches if m.strip()])
                
                if milestones:
                    timeline[quarter] = milestones
    
    # If no timeline found, create a generic one
    if not timeline:
        timeline = {
            "Q1": ["Strategy development", "Team alignment", "Initial campaign planning"],
            "Q2": ["Launch first campaigns", "Collect baseline metrics", "Initial results analysis"],
            "Q3": ["Campaign optimization", "Mid-year review", "Adjust strategies based on results"],
            "Q4": ["Final push for annual goals", "Results consolidation", "Planning for next year"]
        }
    
    return goals, strategies, metrics, timeline

def parse_document_sections(content: str) -> Dict[str, str]:
    """
    Parse document content into sections.
    
    Args:
        content: The content to parse
        
    Returns:
        Dictionary mapping section names to content
    """
    sections = {}
    
    # Look for markdown headings
    heading_matches = re.findall(r'(?:^|\n)(#+)\s*(.*?)\s*\n(.*?)(?=\n#+|$)', content, re.DOTALL)
    
    if heading_matches:
        for match in heading_matches:
            heading_level = len(match[0])
            heading_name = match[1].strip()
            section_content = match[2].strip()
            
            # Only use level 1 and 2 headings as main sections
            if heading_level <= 2:
                sections[heading_name] = section_content
    
    # If no sections found, create a single section
    if not sections:
        sections = {"Overview": content}
    
    return sections

if __name__ == "__main__":
    # Test document extraction
    test_messages = [
        "Please update the marketing plan in [CODA_DOC_ID:doc-abc123]",
        "Can you add your thoughts on this topic to this document [CODA_DOC_ID]? Here's the URL: https://coda.io/d/doc-xyz789",
        "Please write some content about our new strategy in doc-def456",
    ]
    
    for message in test_messages:
        doc_id = extract_coda_doc_id(message)
        print(f"Message: {message}")
        print(f"Extracted doc ID: {doc_id}")
        print("---") 