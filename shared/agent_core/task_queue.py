"""
Task Queue
---------
Shared task queue implementation for managing agent tasks and priorities.
Provides a centralized system for task scheduling, prioritization, and execution.
"""

from typing import Dict, List, Any, Optional, Callable
import datetime
import logging
import heapq
import time
import threading
import uuid
import json
import os
from pathlib import Path

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Task priorities
PRIORITY_HIGH = 100
PRIORITY_MEDIUM = 50
PRIORITY_LOW = 10

# Task states
STATE_PENDING = "pending"
STATE_RUNNING = "running"
STATE_COMPLETED = "completed"
STATE_FAILED = "failed"
STATE_CANCELLED = "cancelled"

class Task:
    """Representation of an agent task with priority and scheduling information"""
    
    def __init__(
        self,
        title: str,
        handler: Optional[Callable] = None,
        priority: int = PRIORITY_MEDIUM,
        params: Dict[str, Any] = None,
        agent: str = "generic",
        task_type: str = "generic",
        scheduled_time: Optional[datetime.datetime] = None,
        deadline: Optional[datetime.datetime] = None,
        parent_id: Optional[str] = None
    ):
        """
        Initialize a task.
        
        Args:
            title: Title/description of the task
            handler: Optional function to call when executing the task
            priority: Priority level (higher numbers = higher priority)
            params: Parameters to pass to the handler
            agent: Name of the agent this task belongs to
            task_type: Type of task
            scheduled_time: When the task should be executed
            deadline: Optional deadline by which the task must be completed
            parent_id: Optional ID of a parent task that this is part of
        """
        self.id = str(uuid.uuid4())
        self.title = title
        self.handler = handler
        self.priority = priority
        self.params = params or {}
        self.agent = agent
        self.type = task_type
        self.state = STATE_PENDING
        self.result = None
        self.error = None
        self.created_at = datetime.datetime.now()
        self.scheduled_time = scheduled_time or self.created_at
        self.started_at = None
        self.completed_at = None
        self.deadline = deadline
        self.parent_id = parent_id
        self.subtasks = []
        self.tags = [task_type, agent]
        self.notes = []
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert task to dictionary for serialization"""
        return {
            "id": self.id,
            "title": self.title,
            "priority": self.priority,
            "params": self.params,
            "agent": self.agent,
            "type": self.type,
            "state": self.state,
            "result": self.result,
            "error": self.error,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "scheduled_time": self.scheduled_time.isoformat() if self.scheduled_time else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "deadline": self.deadline.isoformat() if self.deadline else None,
            "parent_id": self.parent_id,
            "subtasks": self.subtasks,
            "tags": self.tags,
            "notes": self.notes
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Task':
        """Create a task from a dictionary"""
        task = cls(
            title=data["title"],
            priority=data.get("priority", PRIORITY_MEDIUM),
            params=data.get("params", {}),
            agent=data.get("agent", "generic"),
            task_type=data.get("type", "generic")
        )
        
        task.id = data["id"]
        task.state = data.get("state", STATE_PENDING)
        task.result = data.get("result")
        task.error = data.get("error")
        
        # Convert ISO format strings to datetime objects
        def parse_datetime(dt_str):
            if dt_str:
                try:
                    return datetime.datetime.fromisoformat(dt_str)
                except ValueError:
                    return None
            return None
        
        task.created_at = parse_datetime(data.get("created_at"))
        task.scheduled_time = parse_datetime(data.get("scheduled_time"))
        task.started_at = parse_datetime(data.get("started_at"))
        task.completed_at = parse_datetime(data.get("completed_at"))
        task.deadline = parse_datetime(data.get("deadline"))
        
        task.parent_id = data.get("parent_id")
        task.subtasks = data.get("subtasks", [])
        task.tags = data.get("tags", [])
        task.notes = data.get("notes", [])
        
        return task
    
    def add_note(self, note: str) -> None:
        """Add a note to the task"""
        self.notes.append({
            "timestamp": datetime.datetime.now().isoformat(),
            "content": note
        })
    
    def add_subtask(self, subtask_id: str) -> None:
        """Add a subtask to this task"""
        if subtask_id not in self.subtasks:
            self.subtasks.append(subtask_id)
    
    def add_tag(self, tag: str) -> None:
        """Add a tag to the task"""
        if tag not in self.tags:
            self.tags.append(tag)
    
    def __lt__(self, other: 'Task') -> bool:
        """Compare tasks for priority queue ordering"""
        # First by scheduled time
        if self.scheduled_time != other.scheduled_time:
            return self.scheduled_time < other.scheduled_time
        
        # Then by priority (higher priority comes first)
        if self.priority != other.priority:
            return self.priority > other.priority
        
        # Then by deadline (earlier deadline comes first)
        if self.deadline is not None and other.deadline is not None:
            return self.deadline < other.deadline
        elif self.deadline is not None:
            return True
        elif other.deadline is not None:
            return False
        
        # Finally by creation time
        return self.created_at < other.created_at

class TaskQueue:
    """Priority queue for agent tasks with persistence"""
    
    def __init__(self, agent_name: str = "generic", storage_dir: str = None):
        """
        Initialize the task queue.
        
        Args:
            agent_name: Name of the agent using this queue
            storage_dir: Optional directory for task persistence
        """
        self.agent_name = agent_name
        self.tasks = {}  # Dictionary of all tasks by ID
        self.queue = []  # Priority queue of pending tasks
        self.running_tasks = []  # List of currently running tasks
        self.completed_tasks = []  # List of completed task IDs
        self.storage_dir = storage_dir or self._get_default_storage_dir()
        self.lock = threading.RLock()  # Reentrant lock for thread safety
        
        # Create storage directory if it doesn't exist
        os.makedirs(self.storage_dir, exist_ok=True)
        
        # Load existing tasks
        self._load_tasks()
    
    def _get_default_storage_dir(self) -> str:
        """Get the default storage directory"""
        script_dir = Path(os.path.dirname(os.path.abspath(__file__)))
        base_dir = script_dir.parent.parent  # Up two levels (to project root)
        storage_dir = os.path.join(base_dir, "shared", "agent_core", "memory", "tasks", self.agent_name)
        return storage_dir
    
    def _save_task(self, task: Task) -> None:
        """Save a task to persistent storage"""
        try:
            task_path = os.path.join(self.storage_dir, f"{task.id}.json")
            with open(task_path, 'w', encoding='utf-8') as f:
                json.dump(task.to_dict(), f, indent=2)
        except Exception as e:
            logger.error(f"Error saving task {task.id}: {str(e)}")
    
    def _load_tasks(self) -> None:
        """Load all tasks from persistent storage"""
        try:
            for filename in os.listdir(self.storage_dir):
                if filename.endswith('.json'):
                    task_path = os.path.join(self.storage_dir, filename)
                    try:
                        with open(task_path, 'r', encoding='utf-8') as f:
                            task_data = json.load(f)
                            task = Task.from_dict(task_data)
                            self.tasks[task.id] = task
                            
                            # Add to appropriate list based on state
                            if task.state == STATE_PENDING:
                                heapq.heappush(self.queue, task)
                            elif task.state == STATE_RUNNING:
                                self.running_tasks.append(task.id)
                            elif task.state in [STATE_COMPLETED, STATE_FAILED, STATE_CANCELLED]:
                                self.completed_tasks.append(task.id)
                    except Exception as e:
                        logger.error(f"Error loading task from {filename}: {str(e)}")
        except Exception as e:
            logger.error(f"Error loading tasks: {str(e)}")
    
    def add_task(self, task: Task) -> str:
        """
        Add a task to the queue.
        
        Args:
            task: The task to add
            
        Returns:
            The ID of the added task
        """
        with self.lock:
            # Set agent name if not already set
            if task.agent == "generic":
                task.agent = self.agent_name
                if self.agent_name not in task.tags:
                    task.tags.append(self.agent_name)
            
            # Store the task
            self.tasks[task.id] = task
            
            # Add to queue if pending
            if task.state == STATE_PENDING:
                heapq.heappush(self.queue, task)
            
            # Save to persistent storage
            self._save_task(task)
            
            logger.info(f"Added task to queue: {task.title} ({task.id})")
            return task.id
    
    def get_task(self, task_id: str) -> Optional[Task]:
        """
        Get a task by ID.
        
        Args:
            task_id: The ID of the task to retrieve
            
        Returns:
            The task or None if not found
        """
        with self.lock:
            return self.tasks.get(task_id)
    
    def get_next_task(self) -> Optional[Task]:
        """
        Get the next highest priority task from the queue without removing it.
        
        Returns:
            The next task or None if the queue is empty
        """
        with self.lock:
            if not self.queue:
                return None
            
            # Get the current time
            now = datetime.datetime.now()
            
            # Find the highest priority task that is scheduled to run now or earlier
            for task in self.queue:
                if task.scheduled_time <= now:
                    return task
            
            # If no task is ready, return None
            return None
    
    def dequeue_task(self) -> Optional[Task]:
        """
        Remove and return the next task from the queue.
        
        Returns:
            The next task or None if the queue is empty
        """
        with self.lock:
            if not self.queue:
                return None
            
            # Get the current time
            now = datetime.datetime.now()
            
            # Find the highest priority task that is scheduled to run now or earlier
            for i, task in enumerate(self.queue):
                if task.scheduled_time <= now:
                    # Remove the task from the queue
                    task = self.queue.pop(i)
                    heapq.heapify(self.queue)  # Reheapify after removal
                    
                    # Update task state
                    task.state = STATE_RUNNING
                    task.started_at = now
                    self.running_tasks.append(task.id)
                    
                    # Save the updated task
                    self._save_task(task)
                    
                    logger.info(f"Dequeued task: {task.title} ({task.id})")
                    return task
            
            # If no task is ready, return None
            return None
    
    def complete_task(
        self, 
        task_id: str, 
        result: Any = None, 
        success: bool = True
    ) -> bool:
        """
        Mark a task as completed.
        
        Args:
            task_id: The ID of the task to complete
            result: Optional result data
            success: Whether the task completed successfully
            
        Returns:
            True if the task was completed, False otherwise
        """
        with self.lock:
            task = self.tasks.get(task_id)
            if not task:
                logger.error(f"Task not found: {task_id}")
                return False
            
            # Update task state and metadata
            task.state = STATE_COMPLETED if success else STATE_FAILED
            task.completed_at = datetime.datetime.now()
            task.result = result
            
            # Move from running to completed
            if task.id in self.running_tasks:
                self.running_tasks.remove(task.id)
            if task.id not in self.completed_tasks:
                self.completed_tasks.append(task.id)
            
            # Save the updated task
            self._save_task(task)
            
            logger.info(f"Completed task: {task.title} ({task.id})")
            return True
    
    def cancel_task(self, task_id: str, reason: str = None) -> bool:
        """
        Cancel a task.
        
        Args:
            task_id: The ID of the task to cancel
            reason: Optional reason for cancellation
            
        Returns:
            True if the task was cancelled, False otherwise
        """
        with self.lock:
            task = self.tasks.get(task_id)
            if not task:
                logger.error(f"Task not found: {task_id}")
                return False
            
            # Update task state and metadata
            task.state = STATE_CANCELLED
            task.completed_at = datetime.datetime.now()
            task.error = reason or "Task cancelled"
            
            # Remove from queue or running list
            if task.state == STATE_PENDING:
                # Find and remove from queue
                for i, queued_task in enumerate(self.queue):
                    if queued_task.id == task_id:
                        self.queue.pop(i)
                        heapq.heapify(self.queue)  # Reheapify after removal
                        break
            elif task.id in self.running_tasks:
                self.running_tasks.remove(task.id)
            
            # Add to completed list
            if task.id not in self.completed_tasks:
                self.completed_tasks.append(task.id)
            
            # Save the updated task
            self._save_task(task)
            
            logger.info(f"Cancelled task: {task.title} ({task.id})")
            return True
    
    def schedule_task(
        self, 
        task: Task, 
        scheduled_time: datetime.datetime
    ) -> str:
        """
        Schedule a task for future execution.
        
        Args:
            task: The task to schedule
            scheduled_time: When the task should be executed
            
        Returns:
            The ID of the scheduled task
        """
        # Set the scheduled time
        task.scheduled_time = scheduled_time
        
        # Add to queue
        return self.add_task(task)
    
    def get_pending_tasks(self) -> List[Task]:
        """
        Get all pending tasks.
        
        Returns:
            List of pending tasks
        """
        with self.lock:
            return sorted(self.queue)
    
    def get_running_tasks(self) -> List[Task]:
        """
        Get all running tasks.
        
        Returns:
            List of running tasks
        """
        with self.lock:
            return [self.tasks[task_id] for task_id in self.running_tasks if task_id in self.tasks]
    
    def get_completed_tasks(self, limit: int = None) -> List[Task]:
        """
        Get completed tasks.
        
        Args:
            limit: Optional limit on number of tasks to return
            
        Returns:
            List of completed tasks
        """
        with self.lock:
            completed = [self.tasks[task_id] for task_id in self.completed_tasks[-limit:] if task_id in self.tasks] if limit else [self.tasks[task_id] for task_id in self.completed_tasks if task_id in self.tasks]
            return sorted(completed, key=lambda t: t.completed_at, reverse=True)
    
    def get_all_tasks(self) -> List[Task]:
        """
        Get all tasks.
        
        Returns:
            List of all tasks
        """
        with self.lock:
            return list(self.tasks.values())
    
    def get_tasks_by_tag(self, tag: str) -> List[Task]:
        """
        Get tasks with a specific tag.
        
        Args:
            tag: The tag to filter by
            
        Returns:
            List of matching tasks
        """
        with self.lock:
            return [task for task in self.tasks.values() if tag in task.tags]
    
    def get_overdue_tasks(self) -> List[Task]:
        """
        Get tasks that have passed their deadline.
        
        Returns:
            List of overdue tasks
        """
        with self.lock:
            now = datetime.datetime.now()
            return [task for task in self.tasks.values() 
                   if task.deadline and now > task.deadline 
                   and task.state not in [STATE_COMPLETED, STATE_FAILED, STATE_CANCELLED]]
    
    def create_subtask(
        self, 
        parent_id: str, 
        title: str, 
        handler: Optional[Callable] = None,
        priority: int = PRIORITY_MEDIUM,
        params: Dict[str, Any] = None,
        task_type: str = "subtask"
    ) -> Optional[str]:
        """
        Create a subtask for an existing task.
        
        Args:
            parent_id: ID of the parent task
            title: Title of the subtask
            handler: Optional function to call when executing the subtask
            priority: Priority level for the subtask
            params: Parameters to pass to the handler
            task_type: Type of task
            
        Returns:
            The ID of the created subtask or None if the parent task doesn't exist
        """
        with self.lock:
            parent_task = self.tasks.get(parent_id)
            if not parent_task:
                logger.error(f"Parent task not found: {parent_id}")
                return None
            
            # Create the subtask
            subtask = Task(
                title=title,
                handler=handler,
                priority=priority,
                params=params,
                agent=parent_task.agent,
                task_type=task_type,
                parent_id=parent_id
            )
            
            # Add task-specific tags
            subtask.add_tag("subtask")
            subtask.add_tag(f"parent_{parent_id}")
            
            # Add to queue
            subtask_id = self.add_task(subtask)
            
            # Update parent task
            parent_task.add_subtask(subtask_id)
            self._save_task(parent_task)
            
            return subtask_id 