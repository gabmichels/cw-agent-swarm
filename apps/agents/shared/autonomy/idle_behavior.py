"""
Idle Behavior Module

This module provides idle behaviors for Chloe when there are no urgent tasks to work on.
These behaviors simulate the proactive work of a real executive during downtime,
keeping Chloe useful and productive even when not working on specific tasks.
"""

from typing import Dict, List, Any, Optional, Tuple
import random
import logging
from datetime import datetime, timedelta
import os
import json
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Path for idle activity history
IDLE_ACTIVITY_PATH = Path("./apps/agents/shared/memory/idle_activity.json")
IDLE_ACTIVITY_PATH.parent.mkdir(parents=True, exist_ok=True)

class IdleActivity:
    """Base class for idle activities Chloe can perform"""
    
    def __init__(self, name: str, description: str, function_name: str, cooldown_hours: int = 24):
        self.name = name
        self.description = description
        self.function_name = function_name
        self.cooldown_hours = cooldown_hours
    
    def __str__(self) -> str:
        return f"{self.name}: {self.description}"
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert activity to dictionary for serialization"""
        return {
            "name": self.name,
            "description": self.description,
            "function_name": self.function_name,
            "cooldown_hours": self.cooldown_hours
        }
    
    def is_available(self) -> bool:
        """
        Check if this activity is available (not on cooldown).
        
        Returns:
            True if the activity is available, False otherwise
        """
        last_executed = get_last_executed_time(self.function_name)
        if not last_executed:
            return True
            
        time_since_last = datetime.now() - last_executed
        return time_since_last.total_seconds() / 3600 >= self.cooldown_hours

# Define all idle activities
IDLE_ACTIVITIES = [
    # Market awareness activities
    IdleActivity(
        "Market Trends Research",
        "Look at industry trends and summarize key insights",
        "research_market_trends",
        cooldown_hours=48
    ),
    IdleActivity(
        "Competitor Analysis",
        "Analyze recent activities of key competitors",
        "analyze_competitors",
        cooldown_hours=72
    ),
    IdleActivity(
        "Industry News Summary",
        "Create a brief summary of recent industry news",
        "summarize_industry_news",
        cooldown_hours=24
    ),
    
    # Content and brainstorming activities
    IdleActivity(
        "Content Ideas Generation",
        "Brainstorm new content ideas for upcoming campaigns",
        "generate_content_ideas",
        cooldown_hours=48
    ),
    IdleActivity(
        "Campaign Improvement Suggestions",
        "Review recent campaigns and suggest improvements",
        "suggest_campaign_improvements",
        cooldown_hours=72
    ),
    IdleActivity(
        "Social Media Trend Analysis",
        "Review trending topics on social media and suggest ways to leverage them",
        "analyze_social_trends",
        cooldown_hours=24
    ),
    
    # Analytics and reflection activities
    IdleActivity(
        "Performance Metrics Review",
        "Review key marketing metrics and extract insights",
        "review_metrics",
        cooldown_hours=48
    ),
    IdleActivity(
        "Team Productivity Assessment",
        "Assess team productivity and suggest improvements",
        "assess_productivity",
        cooldown_hours=96
    ),
    IdleActivity(
        "Goal Progress Reflection",
        "Reflect on progress toward quarterly goals",
        "reflect_on_goals",
        cooldown_hours=72
    ),
    
    # Communication and stakeholder activities
    IdleActivity(
        "Stakeholder Update Draft",
        "Draft an update for key stakeholders",
        "draft_stakeholder_update",
        cooldown_hours=120
    ),
    IdleActivity(
        "Customer Feedback Analysis",
        "Analyze recent customer feedback and extract insights",
        "analyze_customer_feedback",
        cooldown_hours=72
    ),
    IdleActivity(
        "Team Recognition Note",
        "Write a note recognizing team accomplishments",
        "write_recognition_note",
        cooldown_hours=96
    ),
    
    # Clarification and proactive questions
    IdleActivity(
        "Clarifying Questions",
        "Identify areas needing clarification and ask Gab",
        "ask_clarifying_questions",
        cooldown_hours=48
    ),
    IdleActivity(
        "Proactive Ideas for Gab",
        "Generate proactive ideas to share with Gab",
        "generate_proactive_ideas",
        cooldown_hours=72
    ),
    IdleActivity(
        "Decision Request",
        "Identify a pending decision and request Gab's input",
        "request_decision",
        cooldown_hours=72
    ),
    
    # Maintenance activities
    IdleActivity(
        "File Organization",
        "Review and organize marketing assets",
        "organize_files",
        cooldown_hours=120
    ),
    IdleActivity(
        "Memory Indexing",
        "Organize and index collected insights",
        "index_memories",
        cooldown_hours=96
    ),
    IdleActivity(
        "Task Queue Cleanup",
        "Review and clean up the task queue",
        "cleanup_task_queue",
        cooldown_hours=72
    )
]

def initialize_activity_log():
    """Initialize the idle activity log if it doesn't exist"""
    if not IDLE_ACTIVITY_PATH.exists():
        with open(IDLE_ACTIVITY_PATH, "w") as f:
            json.dump({
                "last_updated": datetime.now().isoformat(),
                "activities": {}
            }, f, indent=2)

def log_activity_execution(activity_name: str):
    """
    Log the execution of an idle activity.
    
    Args:
        activity_name: Name of the function executed
    """
    initialize_activity_log()
    
    # Load current log
    with open(IDLE_ACTIVITY_PATH, "r") as f:
        log = json.load(f)
    
    # Update activity timestamp
    log["activities"][activity_name] = datetime.now().isoformat()
    log["last_updated"] = datetime.now().isoformat()
    
    # Save log
    with open(IDLE_ACTIVITY_PATH, "w") as f:
        json.dump(log, f, indent=2)
    
    logger.info(f"Logged execution of idle activity: {activity_name}")

def get_last_executed_time(activity_name: str) -> Optional[datetime]:
    """
    Get the last time an activity was executed.
    
    Args:
        activity_name: Name of the activity function
        
    Returns:
        Datetime of last execution or None if never executed
    """
    initialize_activity_log()
    
    # Load current log
    with open(IDLE_ACTIVITY_PATH, "r") as f:
        log = json.load(f)
    
    # Get activity timestamp
    timestamp = log["activities"].get(activity_name)
    
    if timestamp:
        try:
            return datetime.fromisoformat(timestamp)
        except (ValueError, TypeError):
            return None
    
    return None

def get_available_activities() -> List[IdleActivity]:
    """
    Get a list of idle activities that are currently available.
    
    Returns:
        List of available idle activities
    """
    return [activity for activity in IDLE_ACTIVITIES if activity.is_available()]

def get_activity_by_name(name: str) -> Optional[IdleActivity]:
    """
    Get an activity by its function name.
    
    Args:
        name: Function name of the activity
        
    Returns:
        IdleActivity object or None if not found
    """
    for activity in IDLE_ACTIVITIES:
        if activity.function_name == name:
            return activity
    return None

def choose_idle_activity() -> Optional[IdleActivity]:
    """
    Choose an idle activity for Chloe to perform.
    
    Returns:
        An IdleActivity object or None if no activities are available
    """
    available_activities = get_available_activities()
    
    if not available_activities:
        logger.warning("No idle activities available - all on cooldown")
        
        # In case all activities are on cooldown, choose one with the shortest remaining cooldown
        min_cooldown_activity = None
        min_remaining_time = timedelta(days=999)
        
        for activity in IDLE_ACTIVITIES:
            last_executed = get_last_executed_time(activity.function_name)
            if last_executed:
                cooldown_duration = timedelta(hours=activity.cooldown_hours)
                elapsed = datetime.now() - last_executed
                remaining = cooldown_duration - elapsed
                
                if remaining < min_remaining_time:
                    min_cooldown_activity = activity
                    min_remaining_time = remaining
        
        # If we found an activity with the shortest cooldown, return it
        if min_cooldown_activity:
            logger.info(f"All activities on cooldown, choosing {min_cooldown_activity.name} " + 
                        f"(cooldown remaining: {min_remaining_time})")
            return min_cooldown_activity
        
        return None
    
    # Randomly choose from available activities
    return random.choice(available_activities)

def execute_idle_activity(activity: IdleActivity) -> Dict[str, Any]:
    """
    Execute an idle activity.
    
    Args:
        activity: The IdleActivity to execute
        
    Returns:
        Dictionary with information about the execution
    """
    logger.info(f"Executing idle activity: {activity.name}")
    
    # Log activity execution
    log_activity_execution(activity.function_name)
    
    # Return details about the activity for the agent to use
    return {
        "name": activity.name,
        "description": activity.description,
        "function": activity.function_name
    }

def get_idle_activity_history() -> Dict[str, Any]:
    """
    Get the history of executed idle activities.
    
    Returns:
        Dictionary mapping activity names to last execution times
    """
    initialize_activity_log()
    
    # Load current log
    with open(IDLE_ACTIVITY_PATH, "r") as f:
        log = json.load(f)
    
    result = {}
    
    # Format timestamps as human-readable
    for activity_name, timestamp in log["activities"].items():
        try:
            dt = datetime.fromisoformat(timestamp)
            result[activity_name] = dt.strftime("%Y-%m-%d %H:%M:%S")
        except (ValueError, TypeError):
            result[activity_name] = timestamp
    
    return result 