"""
Task Prioritizer Module

This module provides functions to prioritize tasks based on:
- Urgency (due or deadline approaching)
- Impact or importance
- When it was last attempted or repeated

It helps Chloe decide what to do next or escalate to humans when needed.
"""

from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple, Optional
import logging
from apps.agents.shared.tools.task_planner import (
    get_all_active_tasks,
    STATUS_PENDING,
    STATUS_IN_PROGRESS,
    STATUS_BLOCKED,
    PRIORITY_HIGH,
    PRIORITY_MEDIUM,
    PRIORITY_LOW
)

from apps.agents.shared.autonomy.daily_rhythm import (
    get_todays_behaviors,
    Behavior,
    BehaviorPriority
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Priority score weights
WEIGHTS = {
    "deadline": 0.4,      # Deadline proximity
    "priority": 0.3,      # Explicit priority setting
    "rhythm": 0.2,        # Match with daily rhythm
    "recency": 0.1,       # Time since last attempt
}

# Maximum days to consider for deadline urgency
MAX_DEADLINE_DAYS = 14

def calculate_deadline_score(task: Dict[str, Any]) -> float:
    """
    Calculate a score based on how close the deadline is.
    
    Args:
        task: Task dictionary
        
    Returns:
        A score between 0-1, higher for more urgent deadlines
    """
    if not task.get("deadline"):
        return 0.3  # Default middle score for tasks without deadlines
        
    try:
        # Parse the deadline
        deadline = datetime.fromisoformat(task["deadline"])
        
        # Calculate days until deadline
        days_left = (deadline - datetime.now()).days
        
        if days_left < 0:
            # Past deadline
            return 1.0
        elif days_left == 0:
            # Due today
            return 0.9
        elif days_left <= MAX_DEADLINE_DAYS:
            # Scale inversely with days left (more days = lower score)
            return 0.8 * (1 - (days_left / MAX_DEADLINE_DAYS))
        else:
            # Far future deadline
            return 0.1
    except (ValueError, TypeError):
        logger.warning(f"Invalid deadline format in task: {task.get('id')}")
        return 0.3  # Default middle score for invalid dates

def calculate_priority_score(task: Dict[str, Any]) -> float:
    """
    Calculate a score based on the task's explicit priority.
    
    Args:
        task: Task dictionary
        
    Returns:
        A score between 0-1, higher for higher priority
    """
    priority = task.get("priority", PRIORITY_MEDIUM).lower()
    
    if priority == PRIORITY_HIGH:
        return 1.0
    elif priority == PRIORITY_MEDIUM:
        return 0.6
    elif priority == PRIORITY_LOW:
        return 0.3
    else:
        return 0.5  # Default for unknown priority

def calculate_recency_score(task: Dict[str, Any]) -> float:
    """
    Calculate a score based on how recently the task was updated.
    Prioritizes tasks that haven't been touched in a while.
    
    Args:
        task: Task dictionary
        
    Returns:
        A score between 0-1, higher for tasks not updated recently
    """
    # Get the last update time
    updated_at = task.get("updated_at")
    
    if not updated_at:
        return 0.5  # Default for tasks without update info
    
    try:
        # Parse the update time
        update_time = datetime.fromisoformat(updated_at)
        
        # Calculate days since last update
        days_since_update = (datetime.now() - update_time).days
        
        if days_since_update <= 1:
            # Recently updated
            return 0.2
        elif days_since_update <= 3:
            # Updated within a few days
            return 0.4
        elif days_since_update <= 7:
            # Not updated for about a week
            return 0.7
        else:
            # Not updated for more than a week
            return 0.9
    except (ValueError, TypeError):
        logger.warning(f"Invalid updated_at format in task: {task.get('id')}")
        return 0.5  # Default for invalid dates

def calculate_rhythm_score(task: Dict[str, Any]) -> float:
    """
    Calculate a score based on whether the task aligns with today's rhythm.
    
    Args:
        task: Task dictionary
        
    Returns:
        A score between 0-1, higher for tasks that match today's rhythm
    """
    # Get today's behaviors
    todays_behaviors = get_todays_behaviors()
    
    # Check if task title or description contains any behavior keywords
    task_text = f"{task.get('title', '')} {task.get('description', '')}".lower()
    
    # Check for exact matches in behavior names and descriptions
    for behavior in todays_behaviors:
        if (behavior.name.lower() in task_text or 
            behavior.description.lower() in task_text or
            behavior.function_name.lower() in task_text):
            
            # Adjust score based on behavior priority
            if behavior.priority == BehaviorPriority.HIGH:
                return 1.0
            elif behavior.priority == BehaviorPriority.MEDIUM:
                return 0.8
            else:
                return 0.6
    
    # No strong match with today's behaviors
    return 0.3

def calculate_total_score(task: Dict[str, Any]) -> float:
    """
    Calculate a total priority score for a task.
    
    Args:
        task: Task dictionary
        
    Returns:
        A score between 0-1, higher for higher priority
    """
    deadline_score = calculate_deadline_score(task)
    priority_score = calculate_priority_score(task)
    recency_score = calculate_recency_score(task)
    rhythm_score = calculate_rhythm_score(task)
    
    # Calculate weighted total
    total_score = (
        WEIGHTS["deadline"] * deadline_score +
        WEIGHTS["priority"] * priority_score +
        WEIGHTS["recency"] * recency_score +
        WEIGHTS["rhythm"] * rhythm_score
    )
    
    logger.debug(f"Task {task.get('id')} - {task.get('title')}: Score {total_score:.2f}")
    logger.debug(f"  Deadline: {deadline_score:.2f}, Priority: {priority_score:.2f}, " +
                f"Recency: {recency_score:.2f}, Rhythm: {rhythm_score:.2f}")
    
    return total_score

def prioritize_tasks(limit: int = 5) -> List[Dict[str, Any]]:
    """
    Get a prioritized list of tasks for Chloe to work on.
    
    Args:
        limit: Maximum number of tasks to return
        
    Returns:
        List of task dictionaries with score information, sorted by priority
    """
    # Get all active tasks
    all_tasks = get_all_active_tasks()
    
    # Only consider pending and in-progress tasks
    available_tasks = [t for t in all_tasks if t["status"] in [STATUS_PENDING, STATUS_IN_PROGRESS]]
    
    if not available_tasks:
        logger.info("No available tasks to prioritize")
        return []
    
    # Calculate scores for each task
    for task in available_tasks:
        task["_priority_score"] = calculate_total_score(task)
        
    # Sort by priority score (descending)
    sorted_tasks = sorted(available_tasks, key=lambda t: t["_priority_score"], reverse=True)
    
    # Log all prioritized tasks
    logger.info(f"Prioritized {len(sorted_tasks)} tasks")
    for i, task in enumerate(sorted_tasks[:limit]):
        logger.info(f"  {i+1}. [{task.get('priority', '?')}] {task.get('title', 'Untitled')} " +
                   f"(Score: {task.get('_priority_score', 0):.2f})")
    
    # Return the top tasks
    return sorted_tasks[:limit]

def should_escalate_to_human(tasks: List[Dict[str, Any]]) -> Tuple[bool, str]:
    """
    Determine if Chloe should escalate decisions to a human.
    
    Args:
        tasks: List of prioritized tasks
        
    Returns:
        Tuple of (should_escalate, reason)
    """
    # Check if there are any tasks
    if not tasks:
        return False, ""
    
    # Check for blocked high-priority tasks
    blocked_high_priority = [t for t in tasks if t["status"] == STATUS_BLOCKED and 
                            t.get("priority", "").lower() == PRIORITY_HIGH]
    
    if blocked_high_priority:
        return True, f"High priority task '{blocked_high_priority[0].get('title')}' is blocked"
    
    # Check for multiple high-priority tasks with similar scores
    high_priority_tasks = [t for t in tasks if t.get("priority", "").lower() == PRIORITY_HIGH]
    
    if len(high_priority_tasks) >= 2:
        # Check if their scores are within 0.1 of each other
        scores = [t.get("_priority_score", 0) for t in high_priority_tasks[:2]]
        if abs(scores[0] - scores[1]) < 0.1:
            return True, f"Multiple high priority tasks with similar urgency: '{high_priority_tasks[0].get('title')}' and '{high_priority_tasks[1].get('title')}'"
    
    # Check for imminent deadlines (today or tomorrow)
    for task in tasks:
        if task.get("deadline"):
            try:
                deadline = datetime.fromisoformat(task["deadline"])
                days_left = (deadline - datetime.now()).days
                
                if days_left <= 1:
                    return True, f"Task '{task.get('title')}' has a deadline within 24 hours"
            except (ValueError, TypeError):
                pass
    
    return False, ""

def get_highest_priority_task() -> Optional[Dict[str, Any]]:
    """
    Get the single highest priority task for Chloe to work on.
    
    Returns:
        The highest priority task or None if no tasks are available
    """
    prioritized_tasks = prioritize_tasks(limit=1)
    
    if prioritized_tasks:
        return prioritized_tasks[0]
    
    return None 