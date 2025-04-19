import json
from pathlib import Path
from datetime import datetime, timedelta
import uuid

# Define paths for task storage
TASK_DIR = Path("./apps/agents/shared/memory/tasks")
TASK_DIR.mkdir(parents=True, exist_ok=True)
ACTIVE_TASKS_FILE = TASK_DIR / "active_tasks.json"
COMPLETED_TASKS_FILE = TASK_DIR / "completed_tasks.json"

# Task statuses
STATUS_PENDING = "pending"
STATUS_IN_PROGRESS = "in_progress"
STATUS_COMPLETED = "completed"
STATUS_BLOCKED = "blocked"

# Priority levels
PRIORITY_HIGH = "high"
PRIORITY_MEDIUM = "medium"
PRIORITY_LOW = "low"

def initialize_task_storage():
    """Initialize the task storage files if they don't exist."""
    if not ACTIVE_TASKS_FILE.exists():
        with open(ACTIVE_TASKS_FILE, "w") as f:
            json.dump([], f)
    
    if not COMPLETED_TASKS_FILE.exists():
        with open(COMPLETED_TASKS_FILE, "w") as f:
            json.dump([], f)

def create_task(title, description, priority=PRIORITY_MEDIUM, deadline=None, parent_id=None):
    """
    Create a new task with automatic ID generation and timestamp.
    
    Args:
        title: Short task title
        description: Detailed task description
        priority: Task priority (high, medium, low)
        deadline: Optional deadline as string (YYYY-MM-DD)
        parent_id: ID of parent task if this is a subtask
        
    Returns:
        The created task object
    """
    initialize_task_storage()
    
    # Create task object
    task_id = str(uuid.uuid4())
    created_at = datetime.now().isoformat()
    
    task = {
        "id": task_id,
        "title": title,
        "description": description,
        "status": STATUS_PENDING,
        "priority": priority,
        "created_at": created_at,
        "updated_at": created_at,
        "deadline": deadline,
        "parent_id": parent_id,
        "subtasks": [],
        "notes": [],
        "dependencies": []
    }
    
    # Load current tasks
    with open(ACTIVE_TASKS_FILE, "r") as f:
        tasks = json.load(f)
    
    # Add new task
    tasks.append(task)
    
    # If it's a subtask, update the parent
    if parent_id:
        for parent_task in tasks:
            if parent_task["id"] == parent_id:
                parent_task["subtasks"].append(task_id)
                break
    
    # Save tasks
    with open(ACTIVE_TASKS_FILE, "w") as f:
        json.dump(tasks, f, indent=2)
    
    return task

def decompose_goal(goal_title, goal_description, subtasks):
    """
    Decompose a high-level goal into subtasks.
    
    Args:
        goal_title: Title of the main goal
        goal_description: Description of the main goal
        subtasks: List of dictionaries with 'title' and 'description' for each subtask
        
    Returns:
        The ID of the parent goal task
    """
    # Create the parent goal
    parent_task = create_task(goal_title, goal_description, priority=PRIORITY_HIGH)
    
    # Create each subtask linked to the parent
    for subtask in subtasks:
        create_task(
            subtask["title"],
            subtask["description"],
            priority=subtask.get("priority", PRIORITY_MEDIUM),
            deadline=subtask.get("deadline"),
            parent_id=parent_task["id"]
        )
    
    return parent_task["id"]

def update_task_status(task_id, new_status, notes=None):
    """
    Update the status of a task.
    
    Args:
        task_id: ID of the task to update
        new_status: New status to set
        notes: Optional notes about the update
        
    Returns:
        Boolean indicating success
    """
    with open(ACTIVE_TASKS_FILE, "r") as f:
        tasks = json.load(f)
    
    # Find and update the task
    task_found = False
    for task in tasks:
        if task["id"] == task_id:
            task["status"] = new_status
            task["updated_at"] = datetime.now().isoformat()
            
            if notes:
                task["notes"].append({
                    "timestamp": datetime.now().isoformat(),
                    "content": notes
                })
            
            task_found = True
            
            # If completed, move to completed tasks
            if new_status == STATUS_COMPLETED:
                with open(COMPLETED_TASKS_FILE, "r") as cf:
                    completed_tasks = json.load(cf)
                
                completed_tasks.append(task)
                
                with open(COMPLETED_TASKS_FILE, "w") as cf:
                    json.dump(completed_tasks, cf, indent=2)
                
                # Remove from active tasks
                tasks.remove(task)
            
            break
    
    # Save changes
    with open(ACTIVE_TASKS_FILE, "w") as f:
        json.dump(tasks, f, indent=2)
    
    return task_found

def get_next_tasks(limit=3):
    """
    Get the next most important tasks to work on based on priority and deadline.
    
    Args:
        limit: Maximum number of tasks to return
        
    Returns:
        List of task objects
    """
    with open(ACTIVE_TASKS_FILE, "r") as f:
        tasks = json.load(f)
    
    # Filter for pending and in-progress tasks
    available_tasks = [t for t in tasks if t["status"] in [STATUS_PENDING, STATUS_IN_PROGRESS]]
    
    # Sort by priority and deadline
    priority_values = {PRIORITY_HIGH: 3, PRIORITY_MEDIUM: 2, PRIORITY_LOW: 1}
    
    def task_sort_key(task):
        priority_value = priority_values.get(task["priority"], 0)
        
        # Use deadline if available
        if task["deadline"]:
            try:
                deadline_date = datetime.fromisoformat(task["deadline"])
                days_left = (deadline_date - datetime.now()).days
                # Lower days means higher priority
                return (-priority_value, days_left)
            except (ValueError, TypeError):
                return (-priority_value, float('inf'))
        
        return (-priority_value, float('inf'))
    
    sorted_tasks = sorted(available_tasks, key=task_sort_key)
    
    return sorted_tasks[:limit]

def add_task_dependency(task_id, dependency_task_id):
    """
    Add a dependency between tasks (task depends on dependency_task).
    
    Args:
        task_id: ID of the dependent task
        dependency_task_id: ID of the task that needs to be completed first
        
    Returns:
        Boolean indicating success
    """
    with open(ACTIVE_TASKS_FILE, "r") as f:
        tasks = json.load(f)
    
    # Find the task
    task_found = False
    for task in tasks:
        if task["id"] == task_id:
            if dependency_task_id not in task["dependencies"]:
                task["dependencies"].append(dependency_task_id)
                task["updated_at"] = datetime.now().isoformat()
            task_found = True
            break
    
    # Save changes
    with open(ACTIVE_TASKS_FILE, "w") as f:
        json.dump(tasks, f, indent=2)
    
    return task_found

def get_task_details(task_id):
    """
    Get detailed information about a specific task.
    
    Args:
        task_id: ID of the task
        
    Returns:
        Task object or None if not found
    """
    # Check active tasks
    with open(ACTIVE_TASKS_FILE, "r") as f:
        tasks = json.load(f)
    
    for task in tasks:
        if task["id"] == task_id:
            return task
    
    # Check completed tasks
    with open(COMPLETED_TASKS_FILE, "r") as f:
        completed_tasks = json.load(f)
    
    for task in completed_tasks:
        if task["id"] == task_id:
            return task
    
    return None

def get_all_active_tasks():
    """Get all active tasks."""
    initialize_task_storage()
    with open(ACTIVE_TASKS_FILE, "r") as f:
        return json.load(f)

def get_tasks_by_status(status):
    """Get tasks filtered by status."""
    with open(ACTIVE_TASKS_FILE, "r") as f:
        tasks = json.load(f)
    
    return [t for t in tasks if t["status"] == status]

def get_blocked_task_details():
    """Get details about blocked tasks and what they're waiting for."""
    blocked_tasks = get_tasks_by_status(STATUS_BLOCKED)
    results = []
    
    for task in blocked_tasks:
        blocking_reasons = []
        
        # Check dependencies
        for dep_id in task["dependencies"]:
            dep_task = get_task_details(dep_id)
            if dep_task and dep_task["status"] != STATUS_COMPLETED:
                blocking_reasons.append(f"Waiting for: {dep_task['title']}")
        
        results.append({
            "id": task["id"],
            "title": task["title"],
            "blocking_reasons": blocking_reasons or ["No specific blocking reason recorded"]
        })
    
    return results 
 