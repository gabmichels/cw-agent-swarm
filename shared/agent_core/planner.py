"""
Agent Core Planner
-----------------
Shared planning logic for all agents to break down high-level goals into executable tasks.
This module is responsible for:
- Creating tasks from goals
- Breaking down complex goals into manageable tasks
- Establishing dependencies between tasks
- Managing task status and priority
"""

from typing import Dict, List, Any, Optional
import datetime
import os
import json
from pathlib import Path
import logging

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Task status constants
STATUS_PENDING = "pending"
STATUS_IN_PROGRESS = "in_progress"
STATUS_COMPLETED = "completed"
STATUS_BLOCKED = "blocked"

def create_task(
    title: str, 
    description: str, 
    priority: str = "medium", 
    deadline: str = None,
    task_type: str = "general",
    tags: List[str] = None
) -> Dict[str, Any]:
    """
    Create a new task to be tracked and executed.
    
    Args:
        title: Short descriptive title of the task
        description: Detailed description of what needs to be done
        priority: Task priority (high, medium, low)
        deadline: Optional deadline in YYYY-MM-DD format
        task_type: Type of task (e.g., "marketing", "research", "writing")
        tags: Optional list of tags to categorize the task
        
    Returns:
        The newly created task as a dictionary
    """
    # Validate priority
    if priority not in ["high", "medium", "low"]:
        priority = "medium"
        
    # Create a unique task ID
    timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
    task_id = f"task_{timestamp}"
    
    # Initialize tags if None
    if tags is None:
        tags = []
    
    # Ensure task type is included in tags
    if task_type not in tags:
        tags.append(task_type)
    
    # Create the task structure
    task = {
        "id": task_id,
        "title": title,
        "description": description,
        "status": STATUS_PENDING,
        "priority": priority,
        "created_at": datetime.datetime.now().isoformat(),
        "deadline": deadline,
        "type": task_type,
        "tags": tags,
        "dependencies": [],
        "notes": [],
        "progress": 0  # 0-100 percentage
    }
    
    # Save the task to storage
    save_task(task)
    
    return task

def decompose_goal(
    goal_title: str, 
    goal_description: str, 
    subtasks: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Break down a high-level goal into component subtasks with dependencies.
    
    Args:
        goal_title: Title of the overall goal
        goal_description: Description of the overall goal
        subtasks: List of subtask dictionaries, each with:
            - title: Subtask title
            - description: Subtask description
            - order: Sequence number for dependency (optional)
            - depends_on: List of subtask indices this depends on (optional)
            
    Returns:
        The parent goal task with its subtasks
    """
    # Create the parent goal task
    parent_task = create_task(
        title=goal_title,
        description=goal_description,
        priority="high",
        task_type="goal"
    )
    
    # Create all subtasks and track their IDs
    subtask_ids = []
    
    for i, subtask in enumerate(subtasks):
        # Create the subtask
        new_subtask = create_task(
            title=subtask["title"],
            description=subtask["description"],
            priority=subtask.get("priority", "medium"),
            deadline=subtask.get("deadline", None),
            task_type=subtask.get("type", "subtask"),
            tags=subtask.get("tags", ["subtask", f"goal_{parent_task['id']}"])
        )
        
        # Add parent goal as a tag and reference
        if f"goal_{parent_task['id']}" not in new_subtask["tags"]:
            new_subtask["tags"].append(f"goal_{parent_task['id']}")
        
        new_subtask["parent_goal"] = parent_task["id"]
        subtask_ids.append(new_subtask["id"])
        
        # Update and save the subtask
        save_task(new_subtask)
    
    # Handle dependencies based on order or explicit dependencies
    for i, subtask in enumerate(subtasks):
        if "depends_on" in subtask and subtask["depends_on"]:
            # Handle explicit dependencies
            for dep_idx in subtask["depends_on"]:
                if 0 <= dep_idx < len(subtask_ids):
                    add_task_dependency(subtask_ids[i], subtask_ids[dep_idx])
        elif "order" in subtask and i > 0:
            # Handle implicit dependencies based on order
            # If tasks have an order, each one depends on the previous one
            prev_idx = i - 1
            add_task_dependency(subtask_ids[i], subtask_ids[prev_idx])
    
    # Update parent task with subtask references
    parent_task["subtasks"] = subtask_ids
    save_task(parent_task)
    
    return parent_task

def update_task_status(
    task_id: str, 
    new_status: str, 
    notes: str = None,
    progress: int = None
) -> Dict[str, Any]:
    """
    Update a task's status and add optional notes.
    
    Args:
        task_id: The ID of the task to update
        new_status: The new status (pending, in_progress, completed, blocked)
        notes: Optional notes to add to the task
        progress: Optional progress percentage (0-100)
        
    Returns:
        The updated task
    """
    # Validate status
    if new_status not in [STATUS_PENDING, STATUS_IN_PROGRESS, STATUS_COMPLETED, STATUS_BLOCKED]:
        raise ValueError(f"Invalid status: {new_status}")
    
    # Load the task
    task = get_task(task_id)
    if not task:
        raise ValueError(f"Task not found: {task_id}")
    
    # Update status
    task["status"] = new_status
    task["updated_at"] = datetime.datetime.now().isoformat()
    
    # Add notes if provided
    if notes:
        timestamp = datetime.datetime.now().isoformat()
        task["notes"].append({
            "timestamp": timestamp,
            "content": notes,
            "status_change": new_status
        })
    
    # Update progress if provided
    if progress is not None:
        task["progress"] = max(0, min(100, progress))  # Ensure progress is between 0-100
    elif new_status == STATUS_COMPLETED:
        task["progress"] = 100
    
    # Save the updated task
    save_task(task)
    
    # If the task was completed, check if any dependent tasks can be unblocked
    if new_status == STATUS_COMPLETED:
        unblock_dependent_tasks(task_id)
    
    return task

def get_task(task_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve a task by ID.
    
    Args:
        task_id: The ID of the task to retrieve
        
    Returns:
        The task dictionary or None if not found
    """
    try:
        tasks_dir = get_tasks_directory()
        task_file = os.path.join(tasks_dir, f"{task_id}.json")
        
        if not os.path.exists(task_file):
            return None
            
        with open(task_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error getting task {task_id}: {str(e)}")
        return None

def save_task(task: Dict[str, Any]) -> bool:
    """
    Save a task to persistent storage.
    
    Args:
        task: The task dictionary to save
        
    Returns:
        True if successful, False otherwise
    """
    try:
        tasks_dir = get_tasks_directory()
        task_file = os.path.join(tasks_dir, f"{task['id']}.json")
        
        with open(task_file, 'w', encoding='utf-8') as f:
            json.dump(task, f, indent=2)
        
        return True
    except Exception as e:
        logger.error(f"Error saving task {task['id']}: {str(e)}")
        return False

def get_tasks_directory() -> str:
    """
    Get the directory for storing tasks, creating it if it doesn't exist.
    
    Returns:
        Path to the tasks directory
    """
    # Get base path from script location - shared/agent_core/planner.py
    script_dir = Path(os.path.dirname(os.path.abspath(__file__)))
    base_dir = script_dir.parent.parent  # Up two levels (to project root)
    tasks_dir = os.path.join(base_dir, "shared", "agent_core", "memory", "tasks")
    
    # Create directory if it doesn't exist
    os.makedirs(tasks_dir, exist_ok=True)
    
    return tasks_dir

def get_all_tasks() -> List[Dict[str, Any]]:
    """
    Get all tasks from storage.
    
    Returns:
        List of all task dictionaries
    """
    tasks = []
    tasks_dir = get_tasks_directory()
    
    try:
        for filename in os.listdir(tasks_dir):
            if filename.endswith('.json'):
                task_file = os.path.join(tasks_dir, filename)
                with open(task_file, 'r', encoding='utf-8') as f:
                    task = json.load(f)
                    tasks.append(task)
    except Exception as e:
        logger.error(f"Error retrieving tasks: {str(e)}")
    
    return tasks

def get_tasks_by_status(status: str, limit: int = None) -> List[Dict[str, Any]]:
    """
    Get tasks with a specific status.
    
    Args:
        status: The status to filter by
        limit: Optional limit on the number of tasks to return
        
    Returns:
        List of matching task dictionaries
    """
    all_tasks = get_all_tasks()
    matching_tasks = [task for task in all_tasks if task["status"] == status]
    
    # Sort by priority (high > medium > low)
    priority_order = {"high": 0, "medium": 1, "low": 2}
    matching_tasks.sort(key=lambda x: priority_order.get(x["priority"], 3))
    
    if limit is not None:
        matching_tasks = matching_tasks[:limit]
    
    return matching_tasks

def get_prioritized_tasks(limit: int = 5) -> List[Dict[str, Any]]:
    """
    Get a prioritized list of active tasks.
    
    Args:
        limit: Maximum number of tasks to return
        
    Returns:
        List of prioritized task dictionaries
    """
    # First get in-progress tasks
    in_progress = get_tasks_by_status(STATUS_IN_PROGRESS)
    
    # Then get pending tasks
    pending = get_tasks_by_status(STATUS_PENDING)
    
    # Combine and limit the total
    prioritized = in_progress + pending
    
    if limit is not None:
        prioritized = prioritized[:limit]
    
    return prioritized

def add_task_dependency(task_id: str, depends_on_id: str) -> bool:
    """
    Add a dependency between tasks.
    
    Args:
        task_id: ID of the task that depends on another
        depends_on_id: ID of the task that is depended upon
        
    Returns:
        True if successful, False otherwise
    """
    # Load the dependent task
    task = get_task(task_id)
    if not task:
        logger.error(f"Dependent task not found: {task_id}")
        return False
    
    # Load the dependency task
    dependency = get_task(depends_on_id)
    if not dependency:
        logger.error(f"Dependency task not found: {depends_on_id}")
        return False
    
    # Add dependency if not already present
    if depends_on_id not in task["dependencies"]:
        task["dependencies"].append(depends_on_id)
        
        # If the dependency is not completed, mark this task as blocked
        if dependency["status"] != STATUS_COMPLETED:
            task["status"] = STATUS_BLOCKED
            
        # Save the updated task
        save_task(task)
        
    return True

def unblock_dependent_tasks(completed_task_id: str) -> None:
    """
    Unblock tasks that were waiting on a now-completed task.
    
    Args:
        completed_task_id: ID of the task that was just completed
    """
    all_tasks = get_all_tasks()
    
    for task in all_tasks:
        # If task is blocked and depends on the completed task
        if (task["status"] == STATUS_BLOCKED and 
            completed_task_id in task["dependencies"]):
            
            # Check if all dependencies are now completed
            all_deps_completed = True
            for dep_id in task["dependencies"]:
                dep_task = get_task(dep_id)
                if dep_task and dep_task["status"] != STATUS_COMPLETED:
                    all_deps_completed = False
                    break
            
            # If all dependencies are completed, unblock this task
            if all_deps_completed:
                task["status"] = STATUS_PENDING
                task["updated_at"] = datetime.datetime.now().isoformat()
                save_task(task)
                logger.info(f"Unblocked task {task['id']}: {task['title']}") 