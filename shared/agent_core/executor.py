"""
Agent Core Executor
-----------------
Shared task execution logic for all agents. This module handles the execution
of individual tasks, including:
- Task selection based on priority
- Task execution and tracking
- Handling task dependencies
- Reporting task status and results
"""

from typing import Dict, List, Any, Optional, Callable
import datetime
import logging
from . import planner

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TaskExecutor:
    """Task execution engine for agents"""
    
    def __init__(self, agent_name: str = "generic"):
        """
        Initialize the task executor.
        
        Args:
            agent_name: The name of the agent using this executor
        """
        self.agent_name = agent_name
        self.current_task_id = None
        self.execution_history = []
        self.tool_registry = {}
    
    def register_tool(self, tool_name: str, tool_fn: Callable) -> None:
        """
        Register a tool for task execution.
        
        Args:
            tool_name: The name of the tool
            tool_fn: The function implementing the tool
        """
        self.tool_registry[tool_name] = tool_fn
        logger.info(f"Registered tool: {tool_name}")
    
    def get_next_task(self) -> Optional[Dict[str, Any]]:
        """
        Get the next highest priority task to execute.
        
        Returns:
            The next task or None if no tasks are available
        """
        # Get prioritized tasks
        tasks = planner.get_prioritized_tasks(limit=1)
        
        if not tasks:
            logger.info("No tasks available for execution")
            return None
        
        # Return the highest priority task
        return tasks[0]
    
    def start_task(self, task_id: str) -> bool:
        """
        Start execution of a task.
        
        Args:
            task_id: The ID of the task to start
            
        Returns:
            True if the task was started successfully, False otherwise
        """
        # Get the task
        task = planner.get_task(task_id)
        if not task:
            logger.error(f"Task not found: {task_id}")
            return False
        
        # Check if task is blocked by dependencies
        if task["status"] == planner.STATUS_BLOCKED:
            logger.warning(f"Cannot start blocked task: {task_id}")
            return False
        
        # Update task status to in progress
        updated_task = planner.update_task_status(
            task_id=task_id,
            new_status=planner.STATUS_IN_PROGRESS,
            notes=f"Task started by {self.agent_name}"
        )
        
        # Set as current task
        self.current_task_id = task_id
        
        # Add to execution history
        self.execution_history.append({
            "task_id": task_id,
            "action": "start",
            "timestamp": datetime.datetime.now().isoformat()
        })
        
        logger.info(f"Started task: {task['title']} ({task_id})")
        return True
    
    def complete_task(self, task_id: str, result: str = None, success: bool = True) -> bool:
        """
        Mark a task as completed.
        
        Args:
            task_id: The ID of the task to complete
            result: Optional result description
            success: Whether the task was completed successfully
            
        Returns:
            True if the task was completed successfully, False otherwise
        """
        # Get the task
        task = planner.get_task(task_id)
        if not task:
            logger.error(f"Task not found: {task_id}")
            return False
        
        # Prepare completion notes
        completion_notes = f"Task {'completed successfully' if success else 'failed'}"
        if result:
            completion_notes += f": {result}"
        
        # Update task status
        status = planner.STATUS_COMPLETED if success else planner.STATUS_PENDING
        updated_task = planner.update_task_status(
            task_id=task_id,
            new_status=status,
            notes=completion_notes,
            progress=100 if success else task.get("progress", 0)
        )
        
        # If this was the current task, clear it
        if self.current_task_id == task_id:
            self.current_task_id = None
        
        # Add to execution history
        self.execution_history.append({
            "task_id": task_id,
            "action": "complete" if success else "fail",
            "timestamp": datetime.datetime.now().isoformat(),
            "result": result
        })
        
        logger.info(f"{'Completed' if success else 'Failed'} task: {task['title']} ({task_id})")
        return True
    
    def execute_task_with_tools(self, task_id: str, 
                              tool_sequence: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Execute a task using a sequence of tools.
        
        Args:
            task_id: The ID of the task to execute
            tool_sequence: List of tool execution steps, each with:
                - tool_name: Name of the tool to execute
                - parameters: Parameters to pass to the tool
            
        Returns:
            Dictionary with execution results
        """
        # Get the task
        task = planner.get_task(task_id)
        if not task:
            logger.error(f"Task not found: {task_id}")
            return {"success": False, "error": "Task not found"}
        
        # Start the task
        if not self.start_task(task_id):
            return {"success": False, "error": "Failed to start task"}
        
        # Execute each tool in the sequence
        results = []
        success = True
        
        for step in tool_sequence:
            tool_name = step.get("tool_name")
            parameters = step.get("parameters", {})
            
            # Check if tool exists
            if tool_name not in self.tool_registry:
                logger.error(f"Tool not found: {tool_name}")
                results.append({
                    "tool": tool_name,
                    "success": False,
                    "error": "Tool not found"
                })
                success = False
                break
            
            # Execute the tool
            try:
                logger.info(f"Executing tool: {tool_name}")
                tool_result = self.tool_registry[tool_name](**parameters)
                
                # Add result
                results.append({
                    "tool": tool_name,
                    "success": True,
                    "result": tool_result
                })
                
                logger.info(f"Tool {tool_name} executed successfully")
            except Exception as e:
                logger.error(f"Error executing tool {tool_name}: {str(e)}")
                results.append({
                    "tool": tool_name,
                    "success": False,
                    "error": str(e)
                })
                success = False
                break
        
        # Complete the task
        result_summary = f"Executed {len(results)} tools. Overall {'success' if success else 'failure'}."
        self.complete_task(task_id, result=result_summary, success=success)
        
        return {
            "task_id": task_id,
            "success": success,
            "steps": results
        }
    
    def get_execution_history(self, limit: int = None) -> List[Dict[str, Any]]:
        """
        Get the execution history.
        
        Args:
            limit: Optional limit on number of history entries to return
            
        Returns:
            List of execution history entries
        """
        if limit is not None:
            return self.execution_history[-limit:]
        return self.execution_history 