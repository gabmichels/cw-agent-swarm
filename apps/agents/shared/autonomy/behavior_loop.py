"""
Main Behavior Loop for Chloe's autonomous actions.

This module coordinates the daily rhythm, task prioritization, and idle behaviors
to allow Chloe to act autonomously based on current priorities and context.
"""

from typing import Dict, List, Any, Optional, Tuple
import logging
from datetime import datetime
import json
from pathlib import Path
import time
import sys

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import autonomy components
from apps.agents.shared.autonomy.daily_rhythm import (
    get_todays_behaviors,
    get_behavior_by_name,
    get_full_rhythm_map,
    Behavior
)
from apps.agents.shared.autonomy.prioritizer import (
    prioritize_tasks,
    should_escalate_to_human,
    get_highest_priority_task
)
from apps.agents.shared.autonomy.idle_behavior import (
    choose_idle_activity,
    execute_idle_activity,
    get_idle_activity_history,
    IdleActivity
)

# Import existing tools
from apps.agents.shared.tools.task_planner import (
    get_all_active_tasks,
    get_task_details,
    update_task_status,
    STATUS_PENDING,
    STATUS_IN_PROGRESS,
    STATUS_COMPLETED
)

# Define paths for behavior loop storage
LOOP_DIR = Path("./apps/agents/shared/memory/autonomy")
LOOP_DIR.mkdir(parents=True, exist_ok=True)
BEHAVIOR_LOG_FILE = LOOP_DIR / "behavior_log.json"

class LoopExecutionMode:
    """Execution modes for the behavior loop"""
    AUTOMATIC = "automatic"  # Run everything automatically
    APPROVAL = "approval"    # Ask for human approval before executing actions
    SIMULATION = "simulation"  # Just simulate what would happen, don't execute

def initialize_behavior_log():
    """Initialize the behavior log if it doesn't exist"""
    if not BEHAVIOR_LOG_FILE.exists():
        with open(BEHAVIOR_LOG_FILE, "w") as f:
            json.dump({
                "last_run": None,
                "executions": []
            }, f, indent=2)

def log_behavior_execution(action_type: str, action_name: str, details: Dict[str, Any]):
    """
    Log the execution of a behavior loop action.
    
    Args:
        action_type: Type of action (e.g., "task", "idle", "escalation")
        action_name: Name of the specific action executed
        details: Additional details about the action
    """
    initialize_behavior_log()
    
    # Load current log
    with open(BEHAVIOR_LOG_FILE, "r") as f:
        log = json.load(f)
    
    # Create execution entry
    execution = {
        "timestamp": datetime.now().isoformat(),
        "action_type": action_type,
        "action_name": action_name,
        "details": details
    }
    
    # Add to log
    log["executions"].append(execution)
    log["last_run"] = datetime.now().isoformat()
    
    # Save log
    with open(BEHAVIOR_LOG_FILE, "w") as f:
        json.dump(log, f, indent=2)

def get_recent_behavior_logs(limit: int = 10) -> List[Dict[str, Any]]:
    """
    Get recent behavior loop executions.
    
    Args:
        limit: Maximum number of logs to return
        
    Returns:
        List of execution log entries
    """
    initialize_behavior_log()
    
    # Load current log
    with open(BEHAVIOR_LOG_FILE, "r") as f:
        log = json.load(f)
    
    # Get the most recent executions
    executions = log.get("executions", [])
    return executions[-limit:] if executions else []

def execute_task(task: Dict[str, Any], mode: str = LoopExecutionMode.AUTOMATIC) -> Dict[str, Any]:
    """
    Execute a task using Chloe's capabilities.
    
    Args:
        task: The task dictionary to execute
        mode: Execution mode
        
    Returns:
        Dictionary with execution results
    """
    task_id = task["id"]
    title = task["title"]
    description = task["description"]
    
    # Log the execution
    logger.info(f"Executing task: {title}")
    
    # Update task status to in progress
    if mode != LoopExecutionMode.SIMULATION:
        update_task_status(task_id, STATUS_IN_PROGRESS, 
                        notes="Automatically started by behavior loop")
    
    # Create input for agent
    agent_input = f"I need to work on this task autonomously: {title}\n\n{description}\n\n"
    agent_input += "Please analyze this task, create a plan if needed, and start working on it. "
    agent_input += "When you're done, provide a summary of what you accomplished."
    
    # Execute the agent
    if mode == LoopExecutionMode.SIMULATION:
        result = {
            "task_id": task_id,
            "simulated": True,
            "input": agent_input
        }
    else:
        # Delayed import to avoid circular dependency
        from apps.agents.departments.marketing.cmo_executor import run_agent_loop
        
        # Actually execute the agent
        agent_response = run_agent_loop(agent_input)
        
        result = {
            "task_id": task_id,
            "response": agent_response,
            "execution_time": datetime.now().isoformat()
        }
    
    # Log the execution
    log_behavior_execution("task", title, {
        "task_id": task_id,
        "mode": mode,
        "description": description
    })
    
    return result

def execute_idle_behavior(activity: IdleActivity, mode: str = LoopExecutionMode.AUTOMATIC) -> Dict[str, Any]:
    """
    Execute an idle behavior using Chloe's capabilities.
    
    Args:
        activity: The idle activity to execute
        mode: Execution mode
        
    Returns:
        Dictionary with execution results
    """
    # Log the execution
    logger.info(f"Executing idle behavior: {activity.name}")
    
    # Execute the idle activity to log it
    activity_info = execute_idle_activity(activity)
    
    # Create input for agent
    agent_input = f"I have some idle time, so I'd like to work on: {activity.name}\n\n"
    agent_input += f"Description: {activity.description}\n\n"
    agent_input += "Please help me perform this activity thoroughly, " 
    agent_input += "providing a thoughtful response that delivers value to our marketing efforts."
    
    # Execute the agent
    if mode == LoopExecutionMode.SIMULATION:
        result = {
            "activity": activity.name,
            "simulated": True,
            "input": agent_input
        }
    else:
        # Delayed import to avoid circular dependency
        from apps.agents.departments.marketing.cmo_executor import run_agent_loop
        
        # Actually execute the agent
        agent_response = run_agent_loop(agent_input)
        
        result = {
            "activity": activity.name,
            "response": agent_response,
            "execution_time": datetime.now().isoformat()
        }
    
    # Log the execution
    log_behavior_execution("idle", activity.name, {
        "description": activity.description,
        "function": activity.function_name,
        "mode": mode
    })
    
    return result

def execute_human_escalation(reason: str, tasks: List[Dict[str, Any]], mode: str = LoopExecutionMode.AUTOMATIC) -> Dict[str, Any]:
    """
    Escalate a decision to a human.
    
    Args:
        reason: The reason for escalation
        tasks: Prioritized tasks that need attention
        mode: Execution mode
        
    Returns:
        Dictionary with escalation results
    """
    # Log the escalation
    logger.info(f"Escalating to human: {reason}")
    
    # Create input for agent
    agent_input = f"I need to escalate something to you: {reason}\n\n"
    
    if tasks:
        agent_input += "Here are the tasks I'm considering:\n\n"
        for i, task in enumerate(tasks[:3]):
            agent_input += f"{i+1}. {task.get('title', 'Untitled')} - "
            agent_input += f"Priority: {task.get('priority', 'medium')}, "
            agent_input += f"Score: {task.get('_priority_score', 0):.2f}\n"
            agent_input += f"Description: {task.get('description', 'No description')}\n\n"
    
    agent_input += "\nCould you please provide guidance on what I should prioritize or how to proceed?"
    
    # Execute the agent
    if mode == LoopExecutionMode.SIMULATION:
        result = {
            "reason": reason,
            "simulated": True,
            "input": agent_input
        }
    else:
        # Delayed import to avoid circular dependency
        from apps.agents.departments.marketing.cmo_executor import run_agent_loop
        
        # Actually execute the agent
        agent_response = run_agent_loop(agent_input)
        
        result = {
            "reason": reason,
            "response": agent_response,
            "execution_time": datetime.now().isoformat()
        }
    
    # Log the execution
    log_behavior_execution("escalation", reason, {
        "tasks": [t.get("id") for t in tasks[:3]] if tasks else [],
        "mode": mode
    })
    
    return result

def run_behavior_loop(mode: str = LoopExecutionMode.AUTOMATIC) -> Dict[str, Any]:
    """
    Run the main behavior loop for Chloe's autonomous actions.
    
    Args:
        mode: The execution mode to use
        
    Returns:
        Dictionary with the loop execution results
    """
    logger.info(f"Starting behavior loop in {mode} mode")
    start_time = datetime.now()
    
    # 1. Check current day of week and load daily rhythm
    todays_behaviors = get_todays_behaviors()
    logger.info(f"Today's behaviors: {[b.name for b in todays_behaviors]}")
    
    # 2. Pull task queue and prioritize based on urgency/importance
    prioritized_tasks = prioritize_tasks(limit=5)
    
    # 3. Check if we should escalate to human
    should_escalate, escalation_reason = should_escalate_to_human(prioritized_tasks)
    
    # If escalation is needed and we're not simulating
    if should_escalate and mode != LoopExecutionMode.SIMULATION:
        logger.info(f"Escalating to human: {escalation_reason}")
        escalation_result = execute_human_escalation(escalation_reason, prioritized_tasks, mode)
        
        return {
            "action": "escalation",
            "reason": escalation_reason,
            "tasks": [t.get("id") for t in prioritized_tasks[:3]] if prioritized_tasks else [],
            "result": escalation_result,
            "execution_time": (datetime.now() - start_time).total_seconds()
        }
    
    # 4. If tasks exist → run highest-priority one
    if prioritized_tasks:
        highest_priority_task = prioritized_tasks[0]
        logger.info(f"Executing highest priority task: {highest_priority_task.get('title')}")
        
        task_result = execute_task(highest_priority_task, mode)
        
        return {
            "action": "task",
            "task_id": highest_priority_task.get("id"),
            "task_title": highest_priority_task.get("title"),
            "priority_score": highest_priority_task.get("_priority_score"),
            "result": task_result,
            "execution_time": (datetime.now() - start_time).total_seconds()
        }
    
    # 5. Else → run an idle task
    idle_activity = choose_idle_activity()
    if idle_activity:
        logger.info(f"Executing idle activity: {idle_activity.name}")
        
        idle_result = execute_idle_behavior(idle_activity, mode)
        
        return {
            "action": "idle",
            "activity": idle_activity.name,
            "description": idle_activity.description,
            "result": idle_result,
            "execution_time": (datetime.now() - start_time).total_seconds()
        }
    
    # No actions available
    logger.warning("No tasks or idle activities available")
    return {
        "action": "none",
        "reason": "No tasks or idle activities available",
        "execution_time": (datetime.now() - start_time).total_seconds()
    }

if __name__ == "__main__":
    # If run directly, execute the behavior loop in simulation mode by default
    execution_mode = LoopExecutionMode.SIMULATION
    
    # Check for command line argument
    if len(sys.argv) > 1:
        if sys.argv[1].lower() == "auto":
            execution_mode = LoopExecutionMode.AUTOMATIC
        elif sys.argv[1].lower() == "approval":
            execution_mode = LoopExecutionMode.APPROVAL
    
    print(f"Running behavior loop in {execution_mode} mode...")
    result = run_behavior_loop(execution_mode)
    
    print(f"Executed action: {result['action']}")
    if result['action'] == 'task':
        print(f"Task: {result['task_title']}")
    elif result['action'] == 'idle':
        print(f"Idle activity: {result['activity']}")
    elif result['action'] == 'escalation':
        print(f"Escalation reason: {result['reason']}")
    
    print(f"Execution time: {result['execution_time']:.2f} seconds") 