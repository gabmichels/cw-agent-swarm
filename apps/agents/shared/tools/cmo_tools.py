from langchain_core.tools import tool
from pathlib import Path
import datetime
import os
import json
import logging
from typing import Dict, List, Any, Optional
import time

# Get the absolute path to the memory directory
script_dir = Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE_PATH = script_dir / "memory"

# Import the new task planning and decision making modules
from apps.agents.shared.tools.task_planner import (
    create_task, decompose_goal, update_task_status, 
    get_next_tasks, get_task_details, get_all_active_tasks,
    get_blocked_task_details, add_task_dependency,
    STATUS_PENDING, STATUS_IN_PROGRESS, STATUS_COMPLETED, STATUS_BLOCKED
)

from apps.agents.shared.tools.task_scheduler import (
    auto_schedule_tasks, get_todays_schedule, get_current_task
)

from apps.agents.shared.tools.decision_tree import (
    list_decision_trees, load_decision_tree, create_marketing_initiative_tree,
    create_content_creation_tree
)

# Import the perception tools
from apps.agents.shared.tools.perception_tools import (
    PerceptionTools
)

# Import the new memory and reflection modules
from apps.agents.shared.memory.episodic_memory import (
    store_memory, get_all_memories, get_memories_by_tag,
    get_memories_by_importance, get_memories_by_timeframe,
    get_important_recent_memories, search_memories,
    IMPORTANCE_HIGH, IMPORTANCE_MEDIUM, IMPORTANCE_LOW
)

from apps.agents.shared.memory.reflect import (
    generate_reflection, get_latest_reflection, 
    get_all_reflections, run_weekly_reflection
)

from ..perception.perception_interpreter import handle_perception_query
from ..perception.news_monitor import get_combined_news, get_trending_topics
from ..tools.perception_tools import PerceptionTools
from ..memory.interaction_log import get_last_ai_message, log_ai_message, log_user_message

# Import the autonomy package
from apps.agents.shared.autonomy import (
    run_behavior_loop,
    LoopExecutionMode,
    get_recent_behavior_logs,
    get_todays_behaviors,
    get_full_rhythm_map,
    prioritize_tasks,
    get_highest_priority_task,
    choose_idle_activity,
    get_idle_activity_history
)

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize the interaction logging system
def initialize_interaction_logging():
    """
    Initialize the interaction logging system.
    This should be called at the start of any agent session.
    """
    from ..memory.interaction_log import clear_interaction_history
    clear_interaction_history()
    logger.info("Interaction logging system initialized")

# Add a function to log interactions
def log_interaction(is_user: bool, message: str):
    """
    Log a message in the interaction history.
    
    Args:
        is_user: True if the message is from the user, False if from AI
        message: The message content
    """
    if is_user:
        log_user_message(message)
    else:
        log_ai_message(message)
    logger.debug(f"Logged {'user' if is_user else 'AI'} message of length {len(message)}")

@tool
def read_background(_: str = "") -> str:
    """Read Chloe's background document.
    
    Returns the content of the Chloe's background file.
    """
    try:
        return (BASE_PATH / "chloe_background.md").read_text(encoding="utf-8")
    except Exception as e:
        return f"Error reading background: {str(e)}"

@tool
def read_manifesto(_: str = "") -> str:
    """Read the CMO manifesto document.
    
    Returns the content of the CMO manifesto file.
    """
    try:
        return (BASE_PATH / "cmo_manifesto.md").read_text(encoding="utf-8")
    except Exception as e:
        return f"Error reading manifesto: {str(e)}"

@tool
def read_goals(_: str = "") -> str:
    """Read the marketing goals document.
    
    Returns the content of the marketing goals file.
    """
    try:
        return (BASE_PATH / "marketing_goals.md").read_text(encoding="utf-8")
    except Exception as e:
        return f"Error reading goals: {str(e)}"

@tool
def read_task_log(_: str = "") -> str:
    """Read the task log document.
    
    Returns the content of the task log file.
    """
    try:
        return (BASE_PATH / "task_log.md").read_text(encoding="utf-8")
    except Exception as e:
        return f"Error reading task log: {str(e)}"

@tool
def log_task(note: str = "") -> str:
    """Log a new task entry to the task log.
    
    Args:
        note: The text content to add to the task log.
        
    Returns:
        A confirmation message that the task was logged.
    """
    if not note:
        return "Error: No task content provided to log."
        
    try:
        today = datetime.datetime.now().strftime("%Y-%m-%d")
        entry = f"\n### {today} – Task Entry\n{note}\n"
        with open(BASE_PATH / "task_log.md", "a", encoding="utf-8") as f:
            f.write(entry)
        return "Task logged successfully."
    except Exception as e:
        return f"Error logging task: {str(e)}"

@tool
def search_chat_memory(query: str) -> str:
    """Search past chat messages for relevant memories."""
    from apps.agents.shared.tools.memory_loader import retrieve_similar_chats
    return retrieve_similar_chats(query)

@tool
def store_memory_entry(text: str) -> str:
    """Store something Chloe should remember later."""
    from apps.agents.shared.tools.memory_loader import save_chat_to_memory
    save_chat_to_memory(text)
    return "✅ Memory stored!"

@tool
def mark_important_insight(text: str, source: str = "unspecified", insight_type: str = "general") -> str:
    """Store an insight marked as high importance with metadata.
    
    Args:
        text: The insight text to store
        source: Where the insight came from (e.g., "gab", "team_meeting", "customer_feedback")
        insight_type: The type of insight (e.g., "campaign_feedback", "market_trend", "competitive_analysis")
        
    Returns:
        A confirmation message that the insight was stored.
    """
    from apps.agents.shared.tools.memory_loader import mark_important_insight as save_insight
    return save_insight(text, source, insight_type) 

# == New Task Planning and Execution Tools ==

@tool
def create_new_task(title: str, description: str, priority: str = "medium", deadline: str = None):
    """
    Create a new task to be tracked and executed.
    
    Args:
        title: Short descriptive title of the task
        description: Detailed description of what needs to be done
        priority: Task priority (high, medium, low)
        deadline: Optional deadline in YYYY-MM-DD format
    """
    try:
        task = create_task(title, description, priority, deadline)
        return f"Task created with ID: {task['id']} - {title} (Priority: {priority})"
    except Exception as e:
        return f"Error creating task: {str(e)}"

@tool
def break_down_goal(goal_title: str, goal_description: str, subtasks_json: str):
    """
    Break down a high-level goal into actionable subtasks.
    
    Args:
        goal_title: Title of the main goal
        goal_description: Description of the main goal
        subtasks_json: JSON string of subtasks, format: [{"title": "Subtask 1", "description": "Description", "priority": "high/medium/low", "deadline": "YYYY-MM-DD"}]
    """
    try:
        subtasks = json.loads(subtasks_json)
        goal_id = decompose_goal(goal_title, goal_description, subtasks)
        return f"Goal decomposed into {len(subtasks)} subtasks with parent goal ID: {goal_id}"
    except Exception as e:
        return f"Error breaking down goal: {str(e)}"

@tool
def update_task(task_id: str, new_status: str, notes: str = None):
    """
    Update the status of a task.
    
    Args:
        task_id: ID of the task to update
        new_status: New status (pending, in_progress, completed, blocked)
        notes: Optional notes about the status update
    """
    try:
        status_map = {
            "pending": STATUS_PENDING,
            "in progress": STATUS_IN_PROGRESS,
            "completed": STATUS_COMPLETED,
            "blocked": STATUS_BLOCKED
        }
        
        status_code = status_map.get(new_status.lower(), STATUS_PENDING)
        success = update_task_status(task_id, status_code, notes)
        
        if success:
            return f"Task {task_id} updated to status: {new_status}"
        else:
            return f"Task {task_id} not found"
    except Exception as e:
        return f"Error updating task: {str(e)}"

@tool
def get_priority_tasks(limit: int = 3):
    """
    Get the highest priority tasks to work on next.
    
    Args:
        limit: Maximum number of tasks to return
    """
    try:
        tasks = get_next_tasks(limit)
        if not tasks:
            return "No pending tasks found."
        
        result = "Priority tasks to work on:\n\n"
        for i, task in enumerate(tasks):
            result += f"{i+1}. {task['title']} (ID: {task['id']})\n"
            result += f"   Priority: {task['priority']}, Status: {task['status']}\n"
            result += f"   Description: {task['description'][:100]}...\n\n"
        
        return result
    except Exception as e:
        return f"Error retrieving priority tasks: {str(e)}"

@tool
def get_detailed_task_info(task_id: str):
    """
    Get detailed information about a specific task.
    
    Args:
        task_id: ID of the task
    """
    try:
        task = get_task_details(task_id)
        if not task:
            return f"Task {task_id} not found."
        
        result = f"Task: {task['title']} (ID: {task['id']})\n"
        result += f"Status: {task['status']}\n"
        result += f"Priority: {task['priority']}\n"
        if task.get('deadline'):
            result += f"Deadline: {task['deadline']}\n"
        result += f"Created: {task['created_at']}\n"
        result += f"Last updated: {task['updated_at']}\n\n"
        result += f"Description: {task['description']}\n\n"
        
        if task['notes']:
            result += "Notes:\n"
            for note in task['notes']:
                result += f"- {note['timestamp']}: {note['content']}\n"
        
        if task['subtasks']:
            result += "\nSubtasks:\n"
            for subtask_id in task['subtasks']:
                subtask = get_task_details(subtask_id)
                if subtask:
                    result += f"- {subtask['title']} (Status: {subtask['status']})\n"
        
        return result
    except Exception as e:
        return f"Error retrieving task details: {str(e)}"

@tool
def schedule_tasks_automatically(days_ahead: int = 3):
    """
    Automatically schedule pending tasks based on priority and deadlines.
    
    Args:
        days_ahead: Number of days to schedule ahead
    """
    try:
        result = auto_schedule_tasks(days_ahead)
        return f"Scheduled {result['scheduled_tasks']} out of {result['total_pending_tasks']} pending tasks across {result['total_blocks']} time blocks."
    except Exception as e:
        return f"Error scheduling tasks: {str(e)}"

@tool
def view_todays_schedule():
    """View the schedule for today with all planned tasks."""
    try:
        schedule = get_todays_schedule()
        if not schedule:
            return "No tasks scheduled for today."
        
        result = "Today's schedule:\n\n"
        for block in schedule:
            result += f"{block['start_time']} - {block['end_time']}: "
            result += f"{block['task_title']}"
            if 'task_status' in block:
                result += f" ({block['task_status']})"
            result += "\n"
        
        return result
    except Exception as e:
        return f"Error retrieving today's schedule: {str(e)}"

@tool
def get_current_scheduled_task():
    """Get information about the task scheduled for the current time."""
    try:
        task = get_current_task()
        if not task:
            return "No task scheduled for the current time."
        
        result = f"Current task: {task['title']} (ID: {task['id']})\n"
        result += f"Status: {task['status']}\n"
        result += f"Priority: {task['priority']}\n"
        result += f"Scheduled time: {task['time_block']['start']} - {task['time_block']['end']}\n\n"
        result += f"Description: {task['description']}\n"
        
        return result
    except Exception as e:
        return f"Error retrieving current task: {str(e)}"

@tool
def execute_decision_tree(tree_name: str, context_json: str = "{}"):
    """
    Execute a decision tree to make an autonomous decision.
    
    Args:
        tree_name: Name or ID of the decision tree to execute
        context_json: JSON string of context information for decision making
    """
    try:
        # Find the decision tree by name or ID
        trees = list_decision_trees()
        target_tree = None
        
        for tree in trees:
            if tree_name.lower() in tree['name'].lower() or tree_name == tree['id']:
                target_tree = load_decision_tree(tree['id'])
                break
        
        if not target_tree:
            return f"Decision tree '{tree_name}' not found."
        
        # Parse context
        context = json.loads(context_json)
        
        # Execute the tree
        result = target_tree.execute(context)
        
        if 'error' in result:
            return f"Error executing decision tree: {result['error']}"
        
        # Format the execution path
        path_info = "Decision path:\n"
        for step in result['path']:
            if step['question']:
                path_info += f"- Question: {step['question']}\n"
            if step['action']:
                path_info += f"- Action: {step['action']}\n"
        
        final_result = f"Executed decision tree: {target_tree.name}\n\n"
        final_result += path_info + "\n"
        
        if result['final_action']:
            final_result += f"Final decision: {result['final_action']}"
        else:
            final_result += "No final action determined."
        
        # Save the updated tree with execution history
        save_decision_tree(target_tree)
        
        return final_result
    except Exception as e:
        return f"Error executing decision tree: {str(e)}"

@tool
def list_available_decision_trees():
    """List all available decision trees that can be used for autonomous decision making."""
    try:
        trees = list_decision_trees()
        if not trees:
            return "No decision trees available."
        
        result = "Available decision trees:\n\n"
        for i, tree in enumerate(trees):
            result += f"{i+1}. {tree['name']} (ID: {tree['id']})\n"
            result += f"   Description: {tree['description']}\n\n"
        
        return result
    except Exception as e:
        return f"Error listing decision trees: {str(e)}"

# == New Memory and Reflection Tools ==

@tool
def store_episodic_memory(content: str, context: str = "", outcome: str = "", importance: str = "medium", tags: str = ""):
    """
    Store a new memory entry in episodic memory.
    
    Args:
        content: The main content/observation to remember
        context: Context around when this observation occurred
        outcome: What resulted from this situation
        importance: How important this memory is (high, medium, low)
        tags: Comma-separated list of concept tags (e.g., "marketing,twitter,brand")
    """
    try:
        # Parse tags from comma-separated string
        tag_list = [tag.strip() for tag in tags.split(",")] if tags else []
        
        memory = store_memory(
            content=content,
            context=context,
            outcome=outcome,
            importance=importance,
            tags=tag_list
        )
        
        return f"Memory stored with ID: {memory['id']}"
    except Exception as e:
        return f"Error storing memory: {str(e)}"

@tool
def search_episodic_memory(query: str):
    """
    Search through episodic memory for relevant entries.
    
    Args:
        query: Text to search for in memories
    """
    try:
        memories = search_memories(query)
        
        if not memories:
            return "No matching memories found."
        
        result = f"Found {len(memories)} relevant memories:\n\n"
        
        # Show the 5 most recent matching memories
        for memory in memories[:5]:
            try:
                date = datetime.datetime.fromisoformat(memory.get("timestamp")).strftime("%Y-%m-%d")
            except (ValueError, TypeError):
                date = "Unknown date"
                
            result += f"Memory from {date} (Importance: {memory.get('importance', 'medium')}):\n"
            result += f"{memory.get('content', '')}\n"
            
            if memory.get("tags"):
                result += f"Tags: {' '.join(memory.get('tags', []))}\n"
                
            result += "\n---\n\n"
        
        if len(memories) > 5:
            result += f"...and {len(memories) - 5} more memories."
        
        return result
    except Exception as e:
        return f"Error searching memories: {str(e)}"

@tool
def get_memories_by_concept(tag: str):
    """
    Get memories tagged with a specific concept.
    
    Args:
        tag: Concept tag to search for (e.g., "twitter", "brand")
    """
    try:
        memories = get_memories_by_tag(tag)
        
        if not memories:
            return f"No memories found with tag '{tag}'."
        
        result = f"Found {len(memories)} memories tagged with '{tag}':\n\n"
        
        # Show the 5 most recent memories with this tag
        sorted_memories = sorted(
            memories, 
            key=lambda m: m.get("timestamp", ""), 
            reverse=True
        )
        
        for memory in sorted_memories[:5]:
            try:
                date = datetime.datetime.fromisoformat(memory.get("timestamp")).strftime("%Y-%m-%d")
            except (ValueError, TypeError):
                date = "Unknown date"
                
            result += f"Memory from {date} (Importance: {memory.get('importance', 'medium')}):\n"
            result += f"{memory.get('content', '')}\n\n"
        
        if len(memories) > 5:
            result += f"...and {len(memories) - 5} more memories with this tag."
        
        return result
    except Exception as e:
        return f"Error retrieving memories by tag: {str(e)}"

@tool
def get_recent_important_memories(days: int = 30):
    """
    Get important memories from the recent past.
    
    Args:
        days: Number of days to look back
    """
    try:
        memories = get_important_recent_memories(days)
        
        if not memories:
            return f"No important memories found from the past {days} days."
        
        result = f"Found {len(memories)} important memories from the past {days} days:\n\n"
        
        for memory in memories:
            try:
                date = datetime.datetime.fromisoformat(memory.get("timestamp")).strftime("%Y-%m-%d")
            except (ValueError, TypeError):
                date = "Unknown date"
                
            result += f"Memory from {date}:\n"
            result += f"{memory.get('content', '')}\n"
            
            if memory.get("tags"):
                result += f"Tags: {' '.join(memory.get('tags', []))}\n"
                
            result += "\n---\n\n"
        
        return result
    except Exception as e:
        return f"Error retrieving important recent memories: {str(e)}"

@tool
def run_reflection():
    """
    Run an end-of-day reflection process, thinking about what you learned and achieved.
    
    This is useful when you want to gather your thoughts at the end of a day or work session.
    It helps consolidate lessons learned and insights gained.
    
    Returns:
        String confirming that reflection was initiated
    """
    return "Please share your reflections on what you've learned, what went well, and what could be improved. I'll help organize your thoughts and record them."

@tool
def get_weekly_reflection():
    """
    Get the latest weekly reflection to review progress and plan ahead.
    
    This is useful for understanding recent achievements and planning for the coming week.
    
    Returns:
        String with the latest weekly reflection or instructions to create one
    """
    try:
        from apps.agents.shared.tools.reflection_tool import search_reflections
        
        result = search_reflections("weekly", limit=1)
        if result["success"] and result.get("count", 0) > 0:
            reflection = result["reflections"][0]
            return f"# {reflection.get('title', 'Weekly Reflection')}\n\n{reflection.get('content', 'No content available.')}"
        else:
            return "No weekly reflection found. You can create one with create_weekly_reflection()."
    except ImportError:
        return "Reflection tools not available. Please check your installation."

# == Perception Tools for External Data Awareness ==

@tool
def query_perception(query: str) -> str:
    """
    Query the perception layer with a natural language question about trends, news, or insights.
    
    Args:
        query: A natural language query about what's happening in the world
        
    Examples:
        - "What's trending in marketing this week?"
        - "Latest news about AI translation?"
        - "What's happening in travel today?"
        - "Insights on voice technology?"
        - "Summarize AI news"
    """
    return PerceptionTools.query_perception(query)

@tool
def get_trending_topics(domain: str = "") -> str:
    """
    Get trending topics in a specific domain.
    
    Args:
        domain: The domain to get trends for (e.g., "marketing", "technology", "travel")
            If empty, will return general trending topics.
    """
    return PerceptionTools.get_trending_topics(domain)

@tool
def get_latest_news(topic: str) -> str:
    """
    Get the latest news about a specific topic.
    
    Args:
        topic: The topic to get news for (e.g., "AI in marketing", "voice technology")
    """
    return PerceptionTools.get_latest_news(topic)

@tool
def get_domain_insights(domain: str) -> str:
    """
    Get insights about a specific domain.
    
    Args:
        domain: The domain to get insights for (e.g., "marketing", "AI", "travel industry")
    """
    return PerceptionTools.get_domain_insights(domain)

@tool
def summarize_news(topic: str) -> str:
    """
    Get a summary of news about a specific topic.
    
    Args:
        topic: The topic to summarize news for (e.g., "marketing", "AI", "voice tech")
    """
    return PerceptionTools.summarize_news(topic)

@tool
def collect_new_data(
    topic: str,
    keywords: str = "",
    discord_webhook: str = "",
    discord_user_id: str = "",
    notification_method: str = None,
    response_message: str = None
) -> Dict[str, Any]:
    """
    Proactively collect fresh data on a specified topic.
    
    Args:
        topic: The main topic to collect data about
        keywords: Optional comma-separated keywords to focus the collection
        discord_webhook: Optional Discord webhook URL to send notification when complete
        discord_user_id: Optional Discord user ID to send direct message notification
        notification_method: Notification method to use (webhook or bot_dm)
        response_message: The most recent AI message to check for notification intent
        
    Returns:
        Dictionary with task_id and response message
    """
    # Parse keywords
    keyword_list = [kw.strip() for kw in keywords.split(",") if kw.strip()] if keywords else []
    
    # Check if we should notify Discord
    notify_discord = bool(discord_webhook) or bool(discord_user_id)
    
    # Get the last AI message from the interaction log to check for notification intent
    if response_message is None:
        try:
            from ..memory.interaction_log import get_recent_interactions
            interactions = get_recent_interactions(1)
            if interactions and interactions[0]["role"] == "assistant":
                response_message = interactions[0]["content"]
        except Exception as e:
            logger.error(f"Error getting recent interactions: {e}")
    
    # Start data collection
    task_id, response = PerceptionTools.trigger_data_collection(
        topic=topic,
        keywords=keyword_list,
        discord_webhook_url=discord_webhook,
        discord_user_id=discord_user_id,
        notify_discord=notify_discord,
        response_message=response_message,
        notification_method=notification_method
    )
    
    return {
        "task_id": task_id,
        "message": response
    }

@tool
def check_data_collection(task_id: str) -> str:
    """
    Check the status of a previously initiated data collection task.
    
    Args:
        task_id: The task ID returned from collect_new_data
        
    Returns:
        Status report
    """
    return PerceptionTools.check_collection_status(task_id)

@tool
def get_data_collection_report(task_id: str) -> str:
    """
    Get a report from a completed data collection task.
    
    Args:
        task_id: The task ID returned from collect_new_data
        
    Returns:
        Detailed report with findings and analysis
    """
    return PerceptionTools.get_collection_report(task_id)

@tool
def research_and_analyze(
    topic: str,
    keywords: str = "",
    wait_for_completion: bool = True,
    timeout_seconds: int = 60,
    discord_webhook: str = "",
    discord_user_id: str = "",
    notification_method: str = None,
    response_message: str = None
) -> Dict[str, Any]:
    """
    Comprehensive tool that collects, waits for, and analyzes data about a topic.
    
    Args:
        topic: The main topic to research
        keywords: Optional comma-separated keywords to guide the research
        wait_for_completion: Whether to wait for collection to complete before returning
        timeout_seconds: Maximum time to wait for completion (if waiting)
        discord_webhook: Optional Discord webhook URL for notifications
        discord_user_id: Optional Discord user ID for direct message notification
        notification_method: Notification method to use (webhook or bot_dm)
        response_message: The most recent AI message to check for notification intent
        
    Returns:
        Dictionary with task_id, status information, and potentially the report
    """
    # Parse keywords
    keyword_list = [kw.strip() for kw in keywords.split(",") if kw.strip()] if keywords else []
    
    # Check if we should notify Discord
    notify_discord = bool(discord_webhook) or bool(discord_user_id)
    
    # Get the last AI message from the interaction log to check for notification intent
    if response_message is None:
        try:
            from ..memory.interaction_log import get_recent_interactions
            interactions = get_recent_interactions(1)
            if interactions and interactions[0]["role"] == "assistant":
                response_message = interactions[0]["content"]
        except Exception as e:
            logger.error(f"Error getting recent interactions: {e}")
    
    # Start research
    result = PerceptionTools.collect_and_analyze(
        topic=topic,
        keywords=keyword_list,
        wait_for_completion=wait_for_completion,
        timeout_seconds=timeout_seconds,
        discord_webhook_url=discord_webhook,
        discord_user_id=discord_user_id,
        notify_discord=notify_discord,
        response_message=response_message,
        notification_method=notification_method
    )
    
    return result 

# == New Autonomy Tools ==

@tool
def run_daily_routine(mode: str = "simulation"):
    """
    Run Chloe's daily autonomous behavior routine.
    
    Args:
        mode: Execution mode - "simulation" (default, just shows what would happen), 
              "automatic" (runs actions automatically), or "approval" (asks for approval)
    
    Returns:
        Results of the behavior loop execution
    """
    execution_mode = {
        "simulation": LoopExecutionMode.SIMULATION,
        "automatic": LoopExecutionMode.AUTOMATIC,
        "approval": LoopExecutionMode.APPROVAL
    }.get(mode.lower(), LoopExecutionMode.SIMULATION)
    
    result = run_behavior_loop(execution_mode)
    
    # Format the result for display
    action_type = result["action"]
    
    if action_type == "task":
        return (f"I executed task: {result.get('task_title')}\n"
                f"Priority score: {result.get('priority_score', 0):.2f}\n"
                f"Execution time: {result.get('execution_time', 0):.2f} seconds")
    
    elif action_type == "idle":
        return (f"I performed idle activity: {result.get('activity')}\n"
                f"Description: {result.get('description')}\n"
                f"Execution time: {result.get('execution_time', 0):.2f} seconds")
    
    elif action_type == "escalation":
        return (f"I escalated to human: {result.get('reason')}\n" 
                f"Execution time: {result.get('execution_time', 0):.2f} seconds")
    
    else:
        return f"No action taken: {result.get('reason')}"

@tool
def get_daily_rhythm():
    """
    Get Chloe's daily rhythm map showing planned behaviors for each day of the week.
    
    Returns:
        Formatted daily rhythm information
    """
    rhythm_map = get_full_rhythm_map()
    
    result = "## Chloe's Daily Rhythm Map\n\n"
    
    for day, behaviors in rhythm_map.items():
        result += f"### {day}\n"
        
        for behavior in behaviors:
            result += f"- **{behavior['name']}** ({behavior['priority']}): {behavior['description']}\n"
        
        result += "\n"
    
    # Add today's behaviors
    today = datetime.datetime.now().strftime("%A")
    today_behaviors = get_todays_behaviors()
    
    result += f"## Today's Behaviors ({today})\n\n"
    
    for behavior in today_behaviors:
        result += f"- **{behavior.name}** ({behavior.priority.name}): {behavior.description}\n"
    
    return result

@tool
def get_prioritized_tasks(limit: int = 5):
    """
    Get a list of Chloe's prioritized tasks based on urgency, importance, and daily rhythm.
    
    Args:
        limit: Maximum number of tasks to return
        
    Returns:
        Formatted list of prioritized tasks
    """
    tasks = prioritize_tasks(limit=limit)
    
    if not tasks:
        return "No tasks available to prioritize."
    
    result = "## Prioritized Tasks\n\n"
    
    for i, task in enumerate(tasks):
        result += f"### {i+1}. {task.get('title', 'Untitled')}\n"
        result += f"- **Priority**: {task.get('priority', 'medium')}\n"
        result += f"- **Score**: {task.get('_priority_score', 0):.2f}\n"
        result += f"- **Status**: {task.get('status', 'unknown')}\n"
        
        if task.get('deadline'):
            result += f"- **Deadline**: {task.get('deadline')}\n"
        
        result += f"\n{task.get('description', 'No description')}\n\n"
    
    return result

@tool
def get_autonomous_activity_history(limit: int = 10):
    """
    Get the history of Chloe's autonomous activities.
    
    Args:
        limit: Maximum number of activities to return
        
    Returns:
        Formatted history of autonomous activities
    """
    logs = get_recent_behavior_logs(limit=limit)
    
    if not logs:
        return "No autonomous activity history available."
    
    result = "## Autonomous Activity History\n\n"
    
    for log in logs:
        timestamp = log.get("timestamp", "")
        
        try:
            dt = datetime.datetime.fromisoformat(timestamp)
            formatted_time = dt.strftime("%Y-%m-%d %H:%M:%S")
        except (ValueError, TypeError):
            formatted_time = timestamp
            
        action_type = log.get("action_type", "unknown")
        action_name = log.get("action_name", "unnamed")
        
        result += f"### {formatted_time} - {action_type.title()}: {action_name}\n"
        
        details = log.get("details", {})
        for key, value in details.items():
            if key != "mode":  # Skip mode for cleaner output
                result += f"- **{key}**: {value}\n"
        
        result += "\n"
    
    return result

@tool
def suggest_idle_activity():
    """
    Suggest an idle activity for Chloe to perform during downtime.
    
    Returns:
        Information about a suggested idle activity
    """
    activity = choose_idle_activity()
    
    if not activity:
        return "No idle activities available at this time."
    
    result = f"## Suggested Activity: {activity.name}\n\n"
    result += f"{activity.description}\n\n"
    result += f"Function: {activity.function_name}\n"
    result += f"Cooldown: {activity.cooldown_hours} hours\n\n"
    
    # Show history
    history = get_idle_activity_history()
    last_execution = history.get(activity.function_name, "Never")
    
    result += f"Last performed: {last_execution}"
    
    return result 

def publish_reflection(topic: str, reflection_content: str, metadata: dict = None) -> dict:
    """
    Publish a reflection to Coda. This is a low-level function that expects pre-formatted content.
    
    Args:
        topic: The topic of reflection
        reflection_content: The content of the reflection in markdown format
        metadata: Additional metadata for the reflection
    
    Returns:
        Dictionary with success status and message
    """
    if metadata is None:
        metadata = {}
    
    # Set title in metadata
    if "title" not in metadata:
        metadata["title"] = topic
    
    try:
        from apps.agents.shared.tools.reflection_tool import create_reflection
        
        result = create_reflection(
            content=reflection_content,
            title=metadata.get("title"),
            reflection_type=metadata.get("type", "general"),
            tags=metadata.get("tags", []),
            importance=metadata.get("importance", "medium"),
            publish_to_coda=True
        )
        
        return {
            "success": result["success"],
            "message": f"Reflection published: {result['title']}",
            "details": result
        }
    except ImportError:
        try:
            # Fallback to old method
            from apps.agents.shared.tools.coda_reflection_tool import publish_reflection_to_coda, CODA_AVAILABLE
            
            if not CODA_AVAILABLE:
                return {
                    "success": False,
                    "message": "Coda integration is not available. Please check environment variables for CODA_API_TOKEN, CODA_REFLECTION_DOC_ID, and CODA_REFLECTION_TABLE_ID."
                }
            
            result = publish_reflection_to_coda(reflection_content, metadata)
            
            return {
                "success": result["success"],
                "message": result.get("message", "Error publishing reflection"),
                "details": result
            }
        except ImportError:
            return {
                "success": False,
                "message": "Failed to import reflection tools. Please check your installation."
            }

def get_recent_reflections(limit: int = 5) -> dict:
    """
    Retrieve recent reflections from Coda or local storage.
    
    Args:
        limit: Maximum number of reflections to return
    
    Returns:
        Dictionary with reflections data
    """
    try:
        from apps.agents.shared.tools.reflection_tool import get_recent_reflections as get_reflections
        
        return get_reflections(limit)
    except ImportError:
        try:
            # Fallback to old method
            from apps.agents.shared.tools.coda_reflection_tool import get_recent_reflections_from_coda, CODA_AVAILABLE
            
            if not CODA_AVAILABLE:
                return {
                    "success": False,
                    "message": "Coda integration is not available. Please check environment variables for CODA_API_TOKEN, CODA_REFLECTION_DOC_ID, and CODA_REFLECTION_TABLE_ID.",
                    "reflections": []
                }
            
            return get_recent_reflections_from_coda(limit)
        except ImportError:
            return {
                "success": False,
                "message": "Failed to import reflection tools. Please check your installation.",
                "reflections": []
            }

def search_reflections(query: str, limit: int = 10) -> dict:
    """
    Search for reflections in Coda or local storage containing the query string.
    
    Args:
        query: The search query
        limit: Maximum number of reflections to return
    
    Returns:
        Dictionary with matching reflections
    """
    try:
        from apps.agents.shared.tools.reflection_tool import search_reflections as search
        
        return search(query, limit)
    except ImportError:
        try:
            # Fallback to old method
            from apps.agents.shared.tools.coda_reflection_tool import search_reflections_in_coda, CODA_AVAILABLE
            
            if not CODA_AVAILABLE:
                return {
                    "success": False,
                    "message": "Coda integration is not available. Please check environment variables for CODA_API_TOKEN, CODA_REFLECTION_DOC_ID, and CODA_REFLECTION_TABLE_ID.",
                    "reflections": []
                }
            
            return search_reflections_in_coda(query, limit)
        except ImportError:
            return {
                "success": False,
                "message": "Failed to import reflection tools. Please check your installation.",
                "reflections": []
            } 

@tool
def create_reflection(content: str, title: str = "", tags: str = "", importance: str = "medium") -> dict:
    """
    Create and store a new reflection with optional publishing to Coda.
    
    This tool helps you document your thoughts, insights, and learnings in a structured way.
    Reflections are stored locally and optionally published to Coda if configured.
    
    Args:
        content: The reflection content (markdown text)
        title: Optional title for the reflection (if empty, will be generated from content)
        tags: Comma-separated list of tags for categorizing the reflection
        importance: Importance level ("low", "medium", "high")
    
    Returns:
        Dictionary with reflection details and publishing status
    """
    try:
        from apps.agents.shared.tools.reflection_tool import create_reflection as create
        
        # Parse tags
        tag_list = []
        if tags:
            tag_list = [tag.strip() for tag in tags.split(",") if tag.strip()]
        
        result = create(
            content=content,
            title=title if title else None,
            reflection_type="general",
            tags=tag_list,
            importance=importance,
            publish_to_coda=True
        )
        
        return {
            "success": result["success"],
            "title": result["title"],
            "message": f"Reflection created: {result['title']}",
            "details": {
                "reflection_id": result.get("reflection_id", ""),
                "filepath": result.get("filepath", ""),
                "coda_published": result.get("coda_publishing", {}).get("success", False)
            }
        }
    except ImportError:
        return {
            "success": False,
            "message": "Reflection tools not available. Please check your installation."
        }

@tool
def create_weekly_reflection(content: str, title: str = "", additional_tags: str = "") -> dict:
    """
    Create a weekly reflection summarizing progress, insights, and plans.
    
    Weekly reflections are a special type of reflection with higher importance and
    specific formatting. They help track progress over time and plan for the future.
    
    Args:
        content: The reflection content (markdown text)
        title: Optional title for the reflection (if empty, a standard weekly title will be generated)
        additional_tags: Comma-separated list of additional tags beyond the automatic "weekly" tag
    
    Returns:
        Dictionary with reflection details and publishing status
    """
    try:
        from apps.agents.shared.tools.reflection_tool import create_weekly_reflection as create_weekly
        
        # Parse additional tags
        tag_list = []
        if additional_tags:
            tag_list = [tag.strip() for tag in additional_tags.split(",") if tag.strip()]
        
        result = create_weekly(
            content=content,
            title=title if title else None,
            tags=tag_list,
            publish_to_coda=True
        )
        
        return {
            "success": result["success"],
            "title": result["title"],
            "message": f"Weekly reflection created: {result['title']}",
            "details": {
                "reflection_id": result.get("reflection_id", ""),
                "filepath": result.get("filepath", ""),
                "coda_published": result.get("coda_publishing", {}).get("success", False)
            }
        }
    except ImportError:
        return {
            "success": False,
            "message": "Reflection tools not available. Please check your installation."
        } 

@tool
def create_document(title: str, content: str, doc_type: str = "general") -> Dict[str, Any]:
    """
    Create a new document in Coda with structured content.
    
    This tool creates a new document with the specified title and content.
    The document can be a general document or a specific type like marketing goals.
    
    Args:
        title: The title of the document
        content: The content to include in the document (markdown supported)
        doc_type: The type of document (e.g., "general", "marketing_goals", "roadmap")
        
    Returns:
        Dictionary with document creation status and URL
    """
    try:
        from apps.agents.shared.tools.document_generation import (
            create_general_document,
            create_marketing_goals_document,
            parse_document_sections,
            parse_marketing_content
        )
        from apps.agents.shared.config import CODA_AVAILABLE
        
        if not CODA_AVAILABLE:
            return {
                "success": False,
                "message": "Coda integration is not available. Please check environment variables."
            }
            
        # Process based on document type
        if doc_type.lower() == "marketing_goals":
            # Parse marketing content
            year = datetime.now().year
            goals, strategies, metrics, timeline = parse_marketing_content(content)
            
            # Create marketing goals document
            result = create_marketing_goals_document(
                title,
                year,
                goals,
                strategies,
                metrics,
                timeline
            )
        else:
            # Create general document
            sections = parse_document_sections(content)
            result = create_general_document(title, sections)
            
        if result["success"]:
            return {
                "success": True,
                "message": f"Document '{title}' created successfully",
                "url": result.get("browser_link") or result.get("url", ""),
                "doc_id": result.get("doc_id", "")
            }
        else:
            return {
                "success": False,
                "message": result.get("error", "Failed to create document")
            }
    except Exception as e:
        return {
            "success": False,
            "message": f"Error creating document: {str(e)}"
        }

@tool
def update_document(doc_id: str, content: str, section: str = "", append: bool = True) -> Dict[str, Any]:
    """
    Update an existing document in Coda.
    
    This tool updates a specific section of an existing document or adds new content.
    The document is identified by its document ID.
    
    Args:
        doc_id: The ID of the document to update (e.g., "doc-abc123")
        content: The content to add or update (markdown supported)
        section: The section to update (leave empty to add at the end)
        append: Whether to append to existing content (True) or replace it (False)
        
    Returns:
        Dictionary with update status
    """
    try:
        from apps.agents.shared.tools.document_generation import update_document_section
        from apps.agents.shared.config import CODA_AVAILABLE
        
        if not CODA_AVAILABLE:
            return {
                "success": False,
                "message": "Coda integration is not available. Please check environment variables."
            }
            
        # Default section name if not provided
        if not section:
            section = "Updates"
            
        # Update the document
        result = update_document_section(doc_id, section, content, append)
        
        if result["success"]:
            return {
                "success": True,
                "message": f"Document {doc_id} updated successfully in section '{section}'",
                "action": result.get("action", "updated")
            }
        else:
            return {
                "success": False,
                "message": result.get("error", "Failed to update document")
            }
    except Exception as e:
        return {
            "success": False,
            "message": f"Error updating document: {str(e)}"
        }

@tool
def process_document_request(user_message: str, generated_content: str) -> Dict[str, Any]:
    """
    Process a document request from the user, creating or updating a document as appropriate.
    
    This tool analyzes the user's message to determine whether to create a new document
    or update an existing one, and handles the request accordingly.
    
    Args:
        user_message: The user's original message requesting document creation/update
        generated_content: The content you've generated for the document
        
    Returns:
        Dictionary with operation status and details
    """
    try:
        from apps.agents.shared.tools.document_generation import (
            process_document_request as process_request,
            extract_coda_doc_id
        )
        from apps.agents.shared.config import CODA_AVAILABLE
        
        if not CODA_AVAILABLE:
            return {
                "success": False,
                "message": "Coda integration is not available. Please check environment variables."
            }
            
        # Process the document request
        result = process_request(user_message, generated_content)
        
        if result["success"]:
            # Check what action was performed
            if result.get("action") == "updated":
                return {
                    "success": True,
                    "message": f"Updated document {result['doc_id']} in section '{result['section']}'",
                    "doc_id": result.get("doc_id", ""),
                    "action": "updated"
                }
            else:
                return {
                    "success": True,
                    "message": f"Created new document: {result.get('title', '')}",
                    "url": result.get("browser_link") or result.get("url", ""),
                    "doc_id": result.get("doc_id", ""),
                    "action": "created"
                }
        else:
            return {
                "success": False,
                "message": result.get("error", "Failed to process document request")
            }
    except Exception as e:
        return {
            "success": False,
            "message": f"Error processing document request: {str(e)}"
        }

@tool
def list_coda_documents(limit: int = 10) -> Dict[str, Any]:
    """
    List available Coda documents.
    
    This tool retrieves a list of documents available in the Coda workspace.
    
    Args:
        limit: Maximum number of documents to return
        
    Returns:
        Dictionary with list of documents
    """
    try:
        from apps.agents.shared.tools.coda_client import CodaClient
        from apps.agents.shared.config import CODA_AVAILABLE
        
        if not CODA_AVAILABLE:
            return {
                "success": False,
                "message": "Coda integration is not available. Please check environment variables."
            }
            
        # List documents
        client = CodaClient()
        documents = client.list_documents(limit=limit)
        
        if documents:
            doc_list = []
            for doc in documents:
                doc_list.append({
                    "title": doc.get("name", "Untitled"),
                    "id": doc.get("id", ""),
                    "url": doc.get("browserLink", ""),
                    "last_modified": doc.get("modifiedAt", "")
                })
                
            return {
                "success": True,
                "documents": doc_list,
                "count": len(doc_list),
                "message": f"Found {len(doc_list)} documents"
            }
        else:
            return {
                "success": True,
                "documents": [],
                "count": 0,
                "message": "No documents found"
            }
    except Exception as e:
        return {
            "success": False,
            "message": f"Error listing documents: {str(e)}"
        } 
