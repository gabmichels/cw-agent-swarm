import json
from pathlib import Path
from datetime import datetime, timedelta
import uuid
from apps.agents.shared.tools.task_planner import (
    get_all_active_tasks, 
    update_task_status,
    STATUS_PENDING,
    STATUS_IN_PROGRESS,
    STATUS_COMPLETED,
    STATUS_BLOCKED,
    get_next_tasks
)

# Define paths for schedule storage
SCHEDULE_DIR = Path("./apps/agents/shared/memory/schedule")
SCHEDULE_DIR.mkdir(parents=True, exist_ok=True)
SCHEDULE_FILE = SCHEDULE_DIR / "agent_schedule.json"

# Time block duration in minutes
TIME_BLOCK_DURATION = 30

def initialize_schedule():
    """Initialize the schedule file if it doesn't exist."""
    if not SCHEDULE_FILE.exists():
        default_schedule = {
            "time_blocks": [],
            "last_updated": datetime.now().isoformat(),
        }
        with open(SCHEDULE_FILE, "w") as f:
            json.dump(default_schedule, f, indent=2)

def get_current_schedule():
    """Get the current schedule data."""
    initialize_schedule()
    with open(SCHEDULE_FILE, "r") as f:
        return json.load(f)

def save_schedule(schedule_data):
    """Save the schedule data."""
    schedule_data["last_updated"] = datetime.now().isoformat()
    with open(SCHEDULE_FILE, "w") as f:
        json.dump(schedule_data, f, indent=2)

def auto_schedule_tasks(days_ahead=3):
    """
    Automatically schedule pending tasks based on priority and estimated effort.
    
    Args:
        days_ahead: Number of days to schedule ahead
        
    Returns:
        Dict with information about the scheduling results
    """
    # Get all active tasks
    tasks = get_all_active_tasks()
    schedule = get_current_schedule()
    
    # Get tasks that need scheduling (pending tasks)
    pending_tasks = [t for t in tasks if t["status"] == STATUS_PENDING]
    
    # Sort tasks by priority (similar to get_next_tasks but with all pending tasks)
    priority_values = {"high": 3, "medium": 2, "low": 1}
    
    def task_sort_key(task):
        priority_value = priority_values.get(task["priority"], 0)
        
        if task.get("deadline"):
            try:
                deadline_date = datetime.fromisoformat(task["deadline"])
                days_left = (deadline_date - datetime.now()).days
                return (-priority_value, days_left)
            except (ValueError, TypeError):
                return (-priority_value, float('inf'))
        
        return (-priority_value, float('inf'))
    
    sorted_tasks = sorted(pending_tasks, key=task_sort_key)
    
    # Generate time blocks for scheduling
    now = datetime.now()
    start_of_day = now.replace(hour=9, minute=0, second=0, microsecond=0)
    
    if now.hour >= 17:  # If it's after work hours, start tomorrow
        start_of_day += timedelta(days=1)
    
    # Create schedule time blocks
    time_blocks = []
    current_time = start_of_day
    end_date = now + timedelta(days=days_ahead)
    
    while current_time < end_date:
        # Skip weekends
        if current_time.weekday() >= 5:  # 5=Saturday, 6=Sunday
            current_time = current_time.replace(hour=9, minute=0, second=0, microsecond=0) + timedelta(days=1)
            continue
        
        # Skip after work hours
        if current_time.hour >= 17:
            current_time = current_time.replace(hour=9, minute=0, second=0, microsecond=0) + timedelta(days=1)
            continue
        
        time_block = {
            "id": str(uuid.uuid4()),
            "start_time": current_time.isoformat(),
            "end_time": (current_time + timedelta(minutes=TIME_BLOCK_DURATION)).isoformat(),
            "task_id": None,
            "status": "available"
        }
        
        time_blocks.append(time_block)
        current_time += timedelta(minutes=TIME_BLOCK_DURATION)
    
    # Get existing scheduled blocks
    existing_blocks = schedule.get("time_blocks", [])
    
    # Filter out past blocks
    current_blocks = [b for b in existing_blocks if datetime.fromisoformat(b["start_time"]) > now]
    
    # Add new blocks
    all_blocks = current_blocks + time_blocks
    
    # Sort blocks by start time
    all_blocks.sort(key=lambda x: x["start_time"])
    
    # Assign tasks to available blocks
    scheduled_task_count = 0
    
    for task in sorted_tasks:
        # Determine how many blocks this task needs (default: 1)
        blocks_needed = task.get("estimated_blocks", 1)
        
        # Find consecutive available blocks
        available_block_indices = [i for i, block in enumerate(all_blocks) if block["task_id"] is None]
        
        # Find blocks_needed consecutive blocks
        for i in range(len(available_block_indices) - blocks_needed + 1):
            consecutive_indices = available_block_indices[i:i+blocks_needed]
            
            # Check if these are actually consecutive
            if consecutive_indices[-1] - consecutive_indices[0] + 1 == blocks_needed:
                # Assign task to these blocks
                for idx in consecutive_indices:
                    all_blocks[idx]["task_id"] = task["id"]
                    all_blocks[idx]["status"] = "scheduled"
                
                scheduled_task_count += 1
                break
    
    # Update the schedule
    schedule["time_blocks"] = all_blocks
    save_schedule(schedule)
    
    return {
        "scheduled_tasks": scheduled_task_count,
        "total_pending_tasks": len(pending_tasks),
        "total_blocks": len(all_blocks)
    }

def get_todays_schedule():
    """
    Get the schedule for today.
    
    Returns:
        List of time blocks with task details for today
    """
    schedule = get_current_schedule()
    
    today = datetime.now().date()
    tomorrow = today + timedelta(days=1)
    
    # Filter blocks for today
    today_blocks = [
        block for block in schedule["time_blocks"]
        if today <= datetime.fromisoformat(block["start_time"]).date() < tomorrow
    ]
    
    # Sort by start time
    today_blocks.sort(key=lambda x: x["start_time"])
    
    # Add task details to blocks
    result = []
    for block in today_blocks:
        block_info = {
            "start_time": datetime.fromisoformat(block["start_time"]).strftime("%H:%M"),
            "end_time": datetime.fromisoformat(block["end_time"]).strftime("%H:%M"),
            "status": block["status"]
        }
        
        if block["task_id"]:
            from apps.agents.shared.tools.task_planner import get_task_details
            task = get_task_details(block["task_id"])
            if task:
                block_info["task_title"] = task["title"]
                block_info["task_status"] = task["status"]
        else:
            block_info["task_title"] = "Unscheduled"
        
        result.append(block_info)
    
    return result

def get_current_task():
    """
    Get the task scheduled for the current time.
    
    Returns:
        Task details or None if no task is scheduled
    """
    now = datetime.now()
    schedule = get_current_schedule()
    
    # Find the current time block
    current_block = None
    for block in schedule["time_blocks"]:
        start_time = datetime.fromisoformat(block["start_time"])
        end_time = datetime.fromisoformat(block["end_time"])
        
        if start_time <= now <= end_time:
            current_block = block
            break
    
    if not current_block or not current_block["task_id"]:
        return None
    
    # Get task details
    from apps.agents.shared.tools.task_planner import get_task_details
    task = get_task_details(current_block["task_id"])
    
    if task:
        # Update task status to in progress if it's pending
        if task["status"] == STATUS_PENDING:
            update_task_status(task["id"], STATUS_IN_PROGRESS, 
                              notes="Automatically started by scheduler")
        
        return {
            "id": task["id"],
            "title": task["title"],
            "description": task["description"],
            "status": task["status"],
            "priority": task["priority"],
            "time_block": {
                "start": datetime.fromisoformat(current_block["start_time"]).strftime("%H:%M"),
                "end": datetime.fromisoformat(current_block["end_time"]).strftime("%H:%M")
            }
        }
    
    return None

def reschedule_task(task_id, date_str, start_hour, start_minute):
    """
    Reschedule a task to a specific date and time.
    
    Args:
        task_id: ID of the task to reschedule
        date_str: Date in YYYY-MM-DD format
        start_hour: Hour to start (24-hour format)
        start_minute: Minute to start
        
    Returns:
        Boolean indicating success
    """
    schedule = get_current_schedule()
    
    # Parse the desired start time
    try:
        year, month, day = map(int, date_str.split('-'))
        target_start = datetime(year, month, day, start_hour, start_minute)
    except ValueError:
        return False
    
    # Remove task from current blocks
    for block in schedule["time_blocks"]:
        if block["task_id"] == task_id:
            block["task_id"] = None
            block["status"] = "available"
    
    # Find a block at or near the requested time
    target_block = None
    best_diff = timedelta(days=365)  # Large initial value
    
    for i, block in enumerate(schedule["time_blocks"]):
        block_start = datetime.fromisoformat(block["start_time"])
        time_diff = abs(block_start - target_start)
        
        if block["task_id"] is None and time_diff < best_diff:
            best_diff = time_diff
            target_block = i
    
    if target_block is not None:
        schedule["time_blocks"][target_block]["task_id"] = task_id
        schedule["time_blocks"][target_block]["status"] = "scheduled"
        save_schedule(schedule)
        return True
    
    return False 
 