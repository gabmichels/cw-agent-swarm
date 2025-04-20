"""
Chloe's Content Planner Tool
--------------------------
Tool for planning and managing marketing content calendars and campaigns.
"""

from typing import Dict, List, Any, Optional
from langchain_core.tools import tool
import datetime
import json
import logging
from ..strategies.content_strategy import (
    ContentStrategy, 
    CONTENT_TYPE_BLOG, CONTENT_TYPE_SOCIAL, CONTENT_TYPE_EMAIL,
    CONTENT_TYPE_VIDEO, CONTENT_TYPE_WHITEPAPER,
    AUDIENCE_SEGMENT_GENERAL, AUDIENCE_SEGMENT_TECHNICAL,
    AUDIENCE_SEGMENT_EXECUTIVE, AUDIENCE_SEGMENT_INFLUENCER
)

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize content strategy
content_strategy = ContentStrategy()

@tool
def create_content_idea(
    topic: str,
    content_type: str,
    audience_segment: str = AUDIENCE_SEGMENT_GENERAL,
    keywords: str = "",
    strategic_goals: str = ""
) -> str:
    """
    Create a new content idea for the marketing calendar.
    
    Args:
        topic: The main topic for the content
        content_type: Type of content (blog, social, email, video, whitepaper)
        audience_segment: Target audience segment (general, technical, executive, influencer)
        keywords: Comma-separated list of keywords to target
        strategic_goals: Comma-separated list of strategic goals this content supports
        
    Returns:
        A string with the content idea details
    """
    # Process keywords and goals from comma-separated strings
    keywords_list = [k.strip() for k in keywords.split(",")] if keywords else []
    goals_list = [g.strip() for g in strategic_goals.split(",")] if strategic_goals else ["brand_awareness"]
    
    # Validate content type
    valid_content_types = [
        CONTENT_TYPE_BLOG, CONTENT_TYPE_SOCIAL, CONTENT_TYPE_EMAIL,
        CONTENT_TYPE_VIDEO, CONTENT_TYPE_WHITEPAPER
    ]
    if content_type not in valid_content_types:
        content_type = CONTENT_TYPE_BLOG
        logger.warning(f"Invalid content type, defaulting to {content_type}")
    
    # Validate audience segment
    valid_segments = [
        AUDIENCE_SEGMENT_GENERAL, AUDIENCE_SEGMENT_TECHNICAL,
        AUDIENCE_SEGMENT_EXECUTIVE, AUDIENCE_SEGMENT_INFLUENCER
    ]
    if audience_segment not in valid_segments:
        audience_segment = AUDIENCE_SEGMENT_GENERAL
        logger.warning(f"Invalid audience segment, defaulting to {audience_segment}")
    
    # Create the content idea
    idea = content_strategy.generate_content_idea(
        topic=topic,
        content_type=content_type,
        audience_segment=audience_segment,
        keywords=keywords_list,
        strategic_goals=goals_list
    )
    
    # Format response
    response = {
        "id": idea["id"],
        "topic": idea["topic"],
        "content_type": idea["content_type"],
        "audience_segment": idea["audience_segment"],
        "keywords": idea["keywords"],
        "strategic_goals": idea["strategic_goals"],
        "created_at": idea["created_at"],
        "status": idea["status"],
        "template": {
            k: v for k, v in idea["template"].items() 
            if k in ["structure", "word_count", "tone"]
        }
    }
    
    return f"Created content idea: {json.dumps(response, indent=2)}"

@tool
def schedule_content_for_publishing(
    content_id: str,
    publish_date: str,
    channels: str = ""
) -> str:
    """
    Schedule a content piece for publication.
    
    Args:
        content_id: ID of the content to schedule
        publish_date: Date to publish (YYYY-MM-DD format)
        channels: Comma-separated list of channels to publish on
        
    Returns:
        A string with the scheduling result
    """
    # Process channels from comma-separated string
    channels_list = [c.strip() for c in channels.split(",")] if channels else None
    
    # Validate date format
    try:
        datetime.datetime.strptime(publish_date, "%Y-%m-%d")
    except ValueError:
        return f"Error: Invalid date format. Please use YYYY-MM-DD format."
    
    # Schedule the content
    result = content_strategy.schedule_content(
        content_id=content_id,
        publish_date=publish_date,
        channels=channels_list
    )
    
    if result is None:
        return f"Error: Content with ID {content_id} not found."
    
    # Format response
    response = {
        "content_id": result["id"],
        "topic": result["topic"],
        "content_type": result["content_type"],
        "publish_date": result["publish_date"],
        "channels": result["channels"],
        "status": result["status"]
    }
    
    return f"Content scheduled: {json.dumps(response, indent=2)}"

@tool
def view_content_calendar(
    start_date: str = None,
    end_date: str = None,
    content_type: str = None
) -> str:
    """
    View the content calendar for a specific date range.
    
    Args:
        start_date: Optional start date (YYYY-MM-DD) to filter from
        end_date: Optional end date (YYYY-MM-DD) to filter to
        content_type: Optional content type to filter by
        
    Returns:
        A string with the filtered content calendar
    """
    # Validate date formats if provided
    if start_date:
        try:
            datetime.datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            return f"Error: Invalid start date format. Please use YYYY-MM-DD format."
    
    if end_date:
        try:
            datetime.datetime.strptime(end_date, "%Y-%m-%d")
        except ValueError:
            return f"Error: Invalid end date format. Please use YYYY-MM-DD format."
    
    # Get calendar entries
    entries = content_strategy.get_content_calendar(
        start_date=start_date,
        end_date=end_date,
        content_type=content_type
    )
    
    if not entries:
        return "No content scheduled for the specified criteria."
    
    # Format response
    return f"Content Calendar:\n{json.dumps(entries, indent=2)}"

@tool
def analyze_content_performance(time_period: str = "last_30_days") -> str:
    """
    Analyze content performance for a specific time period.
    
    Args:
        time_period: The time period to analyze (last_30_days, last_90_days, year_to_date)
        
    Returns:
        A string with the content performance analysis
    """
    # Validate time period
    valid_periods = ["last_30_days", "last_90_days", "year_to_date", "all_time"]
    if time_period not in valid_periods:
        time_period = "last_30_days"
        logger.warning(f"Invalid time period, defaulting to {time_period}")
    
    # Get analysis
    analysis = content_strategy.analyze_content_performance(time_period=time_period)
    
    # Format response
    return f"Content Performance Analysis ({time_period}):\n{json.dumps(analysis, indent=2)}"

@tool
def generate_content_brief(content_id: str) -> str:
    """
    Generate a detailed brief for content creation based on a content idea.
    
    Args:
        content_id: ID of the content idea to generate a brief for
        
    Returns:
        A string with the content brief
    """
    # Find the content idea
    content = None
    for idea in content_strategy.content_ideas:
        if idea["id"] == content_id:
            content = idea
            break
    
    if content is None:
        return f"Error: Content with ID {content_id} not found."
    
    # Get the template for this content type
    template = content.get("template", {})
    structure = template.get("structure", [])
    word_count = template.get("word_count", {})
    tone = template.get("tone", "Professional")
    
    # Generate a brief based on the content idea and template
    brief = {
        "content_id": content["id"],
        "title": f"{content['topic']} - {content['content_type'].capitalize()} Content",
        "target_audience": content["audience_segment"],
        "content_type": content["content_type"],
        "primary_keyword": content["keywords"][0] if content["keywords"] else content["topic"],
        "secondary_keywords": content["keywords"][1:] if len(content["keywords"]) > 1 else [],
        "strategic_goals": content["strategic_goals"],
        "content_structure": structure,
        "recommended_word_count": word_count.get("optimal", 500),
        "tone_and_style": tone,
        "key_points_to_include": [
            f"Address challenges related to {content['topic']}",
            f"Highlight benefits for {content['audience_segment']} audience",
            "Include relevant statistics or case studies",
            f"End with clear call to action aligned with {content['strategic_goals'][0] if content['strategic_goals'] else 'brand awareness'}"
        ],
        "references": []
    }
    
    return f"Content Brief:\n{json.dumps(brief, indent=2)}" 