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
    """Run a reflection on recent memories to extract insights."""
    try:
        from apps.agents.shared.memory.reflection import reflection_system
        
        # Run an analysis reflection
        reflection = reflection_system.analyze_memories(
            memory_limit=20,
            reflection_prompt="What are the key patterns and insights from recent activities?"
        )
        
        return f"✅ Reflection completed! Here's what I learned:\n\n{reflection['content'][:500]}..."
    except Exception as e:
        return f"❌ Unable to run reflection: {str(e)}"

@tool
def get_weekly_reflection():
    """Get the latest weekly reflection."""
    try:
        from apps.agents.shared.memory.reflection import reflection_system
        
        latest_reflections = reflection_system.get_latest_reflections(1)
        if not latest_reflections:
            return "No reflections available yet. Use the run_reflection tool to create one."
            
        reflection = latest_reflections[0]
        return f"📝 Latest reflection ({reflection['created_at']}):\n\n{reflection['content']}"
    except Exception as e:
        return f"❌ Unable to retrieve weekly reflection: {str(e)}"

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