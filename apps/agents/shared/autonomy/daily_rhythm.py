"""
Daily Rhythm Map for Chloe's autonomous behavior.

This module defines the daily routines and priorities for Chloe,
allowing her to behave more like an executive with a natural work rhythm.
"""

from enum import Enum
from typing import Dict, List, Optional, Tuple
from datetime import datetime, date
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class BehaviorPriority(Enum):
    """Priority levels for behaviors"""
    HIGH = 3
    MEDIUM = 2
    LOW = 1

class Behavior:
    """Represents a specific behavior Chloe can perform"""
    
    def __init__(self, name: str, description: str, function_name: str, 
                 priority: BehaviorPriority = BehaviorPriority.MEDIUM):
        self.name = name
        self.description = description
        self.function_name = function_name
        self.priority = priority
        
    def __str__(self) -> str:
        return f"{self.name} ({self.priority.name})"
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for serialization"""
        return {
            "name": self.name,
            "description": self.description,
            "function_name": self.function_name,
            "priority": self.priority.name
        }

# Define all possible behaviors
BEHAVIORS = {
    # Analysis behaviors
    "analyze_analytics": Behavior(
        "Analyze Analytics", 
        "Review marketing analytics and extract insights", 
        "analyze_analytics",
        BehaviorPriority.HIGH
    ),
    "plan_strategy": Behavior(
        "Plan Strategy", 
        "Develop or refine marketing strategy", 
        "plan_strategy",
        BehaviorPriority.HIGH
    ),
    "adjust_campaigns": Behavior(
        "Adjust Campaigns", 
        "Make data-driven adjustments to active campaigns", 
        "adjust_campaigns",
        BehaviorPriority.HIGH
    ),
    "competitor_analysis": Behavior(
        "Competitor Analysis", 
        "Research and analyze competitor activities", 
        "competitor_analysis",
        BehaviorPriority.MEDIUM
    ),
    
    # Content and communication behaviors
    "create_content_ideas": Behavior(
        "Create Content Ideas", 
        "Generate new content marketing ideas", 
        "create_content_ideas",
        BehaviorPriority.MEDIUM
    ),
    "draft_communication": Behavior(
        "Draft Communication", 
        "Create drafts of key communications", 
        "draft_communication",
        BehaviorPriority.MEDIUM
    ),
    
    # Reflection and planning behaviors
    "weekly_reflection": Behavior(
        "Weekly Reflection", 
        "Reflect on the week's activities and learnings", 
        "weekly_reflection",
        BehaviorPriority.MEDIUM
    ),
    "midweek_reflection": Behavior(
        "Midweek Reflection", 
        "Check in on weekly progress and adjust plans", 
        "midweek_reflection",
        BehaviorPriority.MEDIUM
    ),
    "summarize_results": Behavior(
        "Summarize Results", 
        "Compile and summarize key results and metrics", 
        "summarize_results",
        BehaviorPriority.HIGH
    ),
    
    # Maintenance behaviors
    "clean_task_queue": Behavior(
        "Clean Task Queue", 
        "Organize and prioritize pending tasks", 
        "clean_task_queue",
        BehaviorPriority.LOW
    ),
    "organize_insights": Behavior(
        "Organize Insights", 
        "Review and organize collected insights", 
        "organize_insights",
        BehaviorPriority.LOW
    ),
    
    # Market awareness behaviors
    "trend_analysis": Behavior(
        "Trend Analysis", 
        "Research emerging trends in the market", 
        "trend_analysis",
        BehaviorPriority.MEDIUM
    ),
    "proactive_research": Behavior(
        "Proactive Research", 
        "Conduct research on topics that might impact marketing", 
        "proactive_research",
        BehaviorPriority.MEDIUM
    ),
    
    # Communication behaviors
    "stakeholder_updates": Behavior(
        "Stakeholder Updates", 
        "Prepare updates for key stakeholders", 
        "stakeholder_updates",
        BehaviorPriority.MEDIUM
    ),
    "ask_clarifying_questions": Behavior(
        "Ask Clarifying Questions", 
        "Identify areas where human input is needed and ask questions", 
        "ask_clarifying_questions",
        BehaviorPriority.LOW
    )
}

# Define the daily rhythm map
# Maps each day of the week (0=Monday, 6=Sunday) to a list of behavior names
DEFAULT_RHYTHM_MAP = {
    0: ["analyze_analytics", "plan_strategy", "clean_task_queue"],          # Monday
    1: ["proactive_research", "create_content_ideas", "adjust_campaigns"],  # Tuesday
    2: ["competitor_analysis", "midweek_reflection", "stakeholder_updates"],  # Wednesday
    3: ["trend_analysis", "adjust_campaigns", "organize_insights"],         # Thursday
    4: ["summarize_results", "weekly_reflection", "ask_clarifying_questions"],  # Friday
    5: ["proactive_research", "organize_insights"],                         # Saturday
    6: ["plan_strategy", "clean_task_queue"]                                # Sunday
}

def get_todays_behaviors() -> List[Behavior]:
    """
    Get the behaviors scheduled for today based on the rhythm map.
    
    Returns:
        List of Behavior objects for today
    """
    # Get today's weekday (0=Monday, 6=Sunday)
    today_weekday = datetime.now().weekday()
    
    # Get behavior names for today
    behavior_names = DEFAULT_RHYTHM_MAP.get(today_weekday, [])
    
    # Convert to Behavior objects
    behaviors = [BEHAVIORS[name] for name in behavior_names if name in BEHAVIORS]
    
    logger.info(f"Today's behaviors ({datetime.now().strftime('%A')}): {[b.name for b in behaviors]}")
    
    return behaviors

def get_behavior_by_name(name: str) -> Optional[Behavior]:
    """
    Get a behavior by its name.
    
    Args:
        name: Name of the behavior to retrieve
        
    Returns:
        Behavior object or None if not found
    """
    return BEHAVIORS.get(name)

def get_day_name(day_number: int) -> str:
    """
    Get the name of a day based on its number (0=Monday, 6=Sunday).
    
    Args:
        day_number: The day number (0-6)
        
    Returns:
        The day name as a string
    """
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    return days[day_number] if 0 <= day_number < 7 else "Unknown"

def get_full_rhythm_map() -> Dict[str, List[Dict]]:
    """
    Get the full rhythm map with day names and behavior details.
    
    Returns:
        Dictionary mapping day names to lists of behavior dictionaries
    """
    result = {}
    
    for day_num, behavior_names in DEFAULT_RHYTHM_MAP.items():
        day_name = get_day_name(day_num)
        behaviors = []
        
        for name in behavior_names:
            if name in BEHAVIORS:
                behaviors.append(BEHAVIORS[name].to_dict())
        
        result[day_name] = behaviors
    
    return result 