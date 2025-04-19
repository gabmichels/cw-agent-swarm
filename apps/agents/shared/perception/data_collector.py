"""
Data Collector Module

This module provides functions for on-demand data collection from various sources.
It can be used to refresh perception data when needed, rather than waiting for
scheduled updates.
"""
import json
import logging
import asyncio
import time
import os
import uuid
from pathlib import Path
from typing import Dict, List, Any, Optional, Union, Tuple
from datetime import datetime

# Import perception modules
from .news_monitor import (
    get_combined_news, 
    get_trending_topics,
    generate_daily_digest
)
from .rss_feed import fetch_rss_feeds, filter_articles_by_tags
from .reddit_monitor import fetch_reddit_posts, search_reddit_for_keywords
from ..memory.episodic_memory import store_memory

# Import optional dependencies
try:
    import aiohttp
    import requests
    NOTIFICATION_AVAILABLE = True
except ImportError:
    NOTIFICATION_AVAILABLE = False

# Import the Discord notifier
try:
    from ..notification.discord_bot import DiscordNotifier
    DISCORD_BOT_AVAILABLE = True
except ImportError:
    DISCORD_BOT_AVAILABLE = False

from ..config import (
    DISCORD_BOT_TOKEN, 
    DEFAULT_DISCORD_USER_ID,
    NotificationMethod,
    DEFAULT_NOTIFICATION_METHOD,
    DISCORD_DM_AVAILABLE
)

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
DATA_DIR = Path(__file__).parent / "data"
COLLECTION_LOG_FILE = DATA_DIR / "collection_log.json"

# Source types
DEFAULT_SOURCES = ["news", "web", "research"]

def ensure_data_directory() -> None:
    """Ensure the data directory exists."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

class DataCollectionTask:
    """Represents a data collection task with status tracking."""
    
    def __init__(self, task_id: str, topic: str, sources: List[str], keywords: List[str] = None):
        """
        Initialize a data collection task.
        
        Args:
            task_id: Unique ID for this task
            topic: The main topic for data collection
            sources: List of sources to collect from (e.g., "rss", "reddit")
            keywords: Optional specific keywords to search for
        """
        self.task_id = task_id
        self.topic = topic
        self.sources = sources
        self.keywords = keywords or []
        self.status = "pending"
        self.start_time = None
        self.end_time = None
        self.results = {
            "rss": {
                "count": 0,
                "items": []
            },
            "reddit": {
                "count": 0,
                "items": []
            }
        }
        self.summary = ""
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert task to dictionary for serialization."""
        return {
            "task_id": self.task_id,
            "topic": self.topic,
            "sources": self.sources,
            "keywords": self.keywords,
            "status": self.status,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "results": {
                source: {
                    "count": data["count"]
                } for source, data in self.results.items()
            },
            "summary": self.summary
        }
    
    def start(self) -> None:
        """Mark the task as started."""
        self.status = "in_progress"
        self.start_time = datetime.now().isoformat()
    
    def complete(self) -> None:
        """Mark the task as completed."""
        self.status = "completed"
        self.end_time = datetime.now().isoformat()
    
    def fail(self, error_message: str) -> None:
        """Mark the task as failed."""
        self.status = "failed"
        self.end_time = datetime.now().isoformat()
        self.summary = f"Failed: {error_message}"

def get_task_status(task_id: str) -> Optional[Dict[str, Any]]:
    """
    Get the status of a data collection task.
    
    Args:
        task_id: The ID of the task
        
    Returns:
        Task status dictionary or None if not found
    """
    ensure_data_directory()
    
    if not COLLECTION_LOG_FILE.exists():
        return None
    
    try:
        with open(COLLECTION_LOG_FILE, 'r', encoding='utf-8') as f:
            log = json.load(f)
            tasks = log.get("tasks", [])
            
            for task in tasks:
                if task.get("task_id") == task_id:
                    return task
            
            return None
    except Exception as e:
        logger.error(f"Error getting task status: {e}")
        return None

def save_task(task: DataCollectionTask) -> None:
    """
    Save a task to the collection log.
    
    Args:
        task: The task to save
    """
    ensure_data_directory()
    
    log = {"tasks": []}
    if COLLECTION_LOG_FILE.exists():
        try:
            with open(COLLECTION_LOG_FILE, 'r', encoding='utf-8') as f:
                log = json.load(f)
        except Exception as e:
            logger.error(f"Error reading collection log: {e}")
    
    # Update or add task
    found = False
    for i, existing_task in enumerate(log.get("tasks", [])):
        if existing_task.get("task_id") == task.task_id:
            log["tasks"][i] = task.to_dict()
            found = True
            break
    
    if not found:
        log.setdefault("tasks", []).append(task.to_dict())
    
    # Save the updated log
    try:
        with open(COLLECTION_LOG_FILE, 'w', encoding='utf-8') as f:
            json.dump(log, f, indent=2)
    except Exception as e:
        logger.error(f"Error saving collection log: {e}")

async def collect_data_async(
    task_id: str,
    topic: str,
    sources: List[str] = None,
    keywords: List[str] = None,
    max_items_per_source: int = 20,
    send_notification: bool = False,
    notification_url: str = None,
    notification_user_id: str = None,
    notification_method: str = None
) -> str:
    """
    Collect data on a topic asynchronously.
    
    Args:
        task_id: Unique ID for this task
        topic: The topic to collect data on
        sources: List of sources to collect from (e.g., "news", "web", "research")
        keywords: List of keywords to use for searching
        max_items_per_source: Maximum number of items to collect per source
        send_notification: Whether to send a notification when complete
        notification_url: URL to send the notification to
        notification_user_id: Discord user ID to send notification to
        notification_method: Notification method to use (webhook or bot_dm)
        
    Returns:
        Task ID for tracking
    """
    if not sources:
        sources = DEFAULT_SOURCES
        
    if not keywords:
        keywords = []
        
    # Create and save task
    task = DataCollectionTask(task_id, topic, sources, keywords)
    task.start()
    save_task(task)
    
    logger.info(f"Starting data collection task {task_id} for topic: {topic}")
    
    try:
        # Mock collection mode for testing
        from ..config import MOCK_DATA_COLLECTION
        if MOCK_DATA_COLLECTION:
            # Just for testing, simulate data collection
            await asyncio.sleep(5)  # Simulate work
            
            # Add mock results
            task.results = {
                "news": {"count": 12, "data": {}},
                "web": {"count": 18, "data": {}},
                "research": {"count": 7, "data": {}}
            }
            
            task.summary = f"Collected mock data on topic '{topic}' with {len(keywords)} keywords."
            task.complete()
            save_task(task)
            
            # Mock notification
            if send_notification and (notification_url or notification_user_id):
                target = notification_user_id if notification_method == NotificationMethod.BOT_DM else notification_url
                await send_notification_async(
                    target,
                    f"Data Collection Complete: {topic}",
                    f"Your data collection task on '{topic}' is now complete.\n\n{task.summary}",
                    task_id,
                    notification_method
                )
                
            return task_id
        
        # Actual data collection logic would go here
        # For each source, collect data using source-specific methods
        
        # Import data collectors here to avoid circular imports
        from ..perception.news_monitor import collect_news
        from ..perception.web_search import search_web
        from ..perception.research_tools import find_research
        
        results = {}
        
        # Collect from each source in parallel
        collectors = []
        
        # Add collectors based on requested sources
        if "news" in sources:
            collectors.append(collect_news(topic, keywords, max_items_per_source))
            
        if "web" in sources:
            collectors.append(search_web(topic, keywords, max_items_per_source))
            
        if "research" in sources:
            collectors.append(find_research(topic, keywords, max_items_per_source))
            
        # Run all collectors in parallel
        collected_results = await asyncio.gather(*collectors, return_exceptions=True)
        
        # Process results
        for i, result in enumerate(collected_results):
            if isinstance(result, Exception):
                logger.error(f"Error in collector {i}: {result}")
                continue
                
            source, data = result
            results[source] = data
            
        # Add results to task
        task.results = results
        
        # Generate summary
        total_items = sum(data.get("count", 0) for data in results.values())
        task.summary = f"Collected {total_items} items on topic '{topic}' from {len(results)} sources."
        
        # Complete task
        task.complete()
        save_task(task)
        
        # Send notification if requested
        if send_notification:
            # Determine which notification method to use
            if notification_method is None:
                # Auto-detect based on what's provided
                if notification_user_id:
                    notification_method = NotificationMethod.BOT_DM
                    target = notification_user_id
                elif notification_url:
                    notification_method = NotificationMethod.WEBHOOK
                    target = notification_url
                elif DEFAULT_DISCORD_USER_ID and DISCORD_DM_AVAILABLE:
                    notification_method = NotificationMethod.BOT_DM
                    target = DEFAULT_DISCORD_USER_ID
                else:
                    target = notification_url
            else:
                # Use specified method
                target = notification_user_id if notification_method == NotificationMethod.BOT_DM else notification_url
            
            # Only send if we have a target
            if target:
                try:
                    await send_notification_async(
                        target,
                        f"Data Collection Complete: {topic}",
                        f"Your data collection task on '{topic}' is now complete.\n\n{task.summary}",
                        task_id,
                        notification_method
                    )
                except Exception as e:
                    logger.error(f"Error sending notification: {e}")
        
    except Exception as e:
        logger.error(f"Error in data collection task {task_id}: {e}")
        task.fail(str(e))
        save_task(task)
        
    return task_id

def collect_data(
    topic: str,
    sources: List[str] = None,
    keywords: List[str] = None,
    max_items_per_source: int = 20,
    send_notification: bool = False,
    notification_url: str = None,
    notification_user_id: str = None,
    notification_method: str = None
) -> str:
    """
    Collect data on a topic (synchronous wrapper).
    
    Args:
        topic: The topic to collect data on
        sources: List of sources to collect from (e.g., "news", "web", "research")
        keywords: List of keywords to use for searching
        max_items_per_source: Maximum number of items to collect per source
        send_notification: Whether to send a notification when complete
        notification_url: URL to send the notification to
        notification_user_id: Discord user ID to send notification to
        notification_method: Notification method to use (webhook or bot_dm)
        
    Returns:
        Task ID for tracking
    """
    task_id = str(uuid.uuid4())
    
    async def _run_async():
        return await collect_data_async(
            task_id,
            topic,
            sources,
            keywords,
            max_items_per_source,
            send_notification,
            notification_url,
            notification_user_id,
            notification_method
        )
    
    # Run in an event loop
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Create a new task if we're already in an event loop
            future = asyncio.ensure_future(_run_async())
            asyncio.create_task(future)
        else:
            # Run the coroutine until complete
            loop.run_until_complete(_run_async())
    except RuntimeError:
        # No event loop, create a new one
        asyncio.run(_run_async())
    
    return task_id

async def send_notification_async(
    url_or_user_id: str, 
    title: str, 
    message: str, 
    task_id: str,
    notification_method: str = None
) -> None:
    """
    Send an asynchronous notification.
    
    Args:
        url_or_user_id: The URL to send the notification to or user ID for DM
        title: Notification title
        message: Notification message
        task_id: Task ID for reference
        notification_method: Which notification method to use (webhook or bot_dm)
    """
    if not NOTIFICATION_AVAILABLE and notification_method != NotificationMethod.BOT_DM:
        logger.warning("Webhook notification packages not available (aiohttp, requests)")
        return
        
    # Determine notification method if not specified
    if notification_method is None:
        if "discord.com/api/webhooks" in url_or_user_id:
            notification_method = NotificationMethod.WEBHOOK
        elif DISCORD_DM_AVAILABLE and url_or_user_id.isdigit():
            notification_method = NotificationMethod.BOT_DM
        else:
            notification_method = DEFAULT_NOTIFICATION_METHOD
    
    # Discord direct message via bot
    if notification_method == NotificationMethod.BOT_DM and DISCORD_BOT_AVAILABLE:
        # Use the Discord bot to send a DM
        user_id = url_or_user_id
        
        # If no user ID provided, use the default
        if not user_id and DEFAULT_DISCORD_USER_ID:
            user_id = DEFAULT_DISCORD_USER_ID
            
        if not user_id:
            logger.error("No Discord user ID provided for direct message")
            return
            
        # Get an instance of the Discord notifier
        notifier = DiscordNotifier.get_instance(DISCORD_BOT_TOKEN)
        
        # Send the DM
        success = await notifier.send_dm_async(user_id, title, message, task_id)
        if not success:
            logger.error(f"Failed to send Discord DM to user {user_id}")
    
    # Discord webhook format
    elif notification_method == NotificationMethod.WEBHOOK and "discord" in url_or_user_id.lower():
        payload = {
            "content": None,
            "embeds": [
                {
                    "title": title,
                    "description": message[:2000],  # Discord has a limit
                    "color": 5814783,
                    "footer": {
                        "text": f"Task ID: {task_id}"
                    },
                    "timestamp": datetime.now().isoformat()
                }
            ]
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url_or_user_id, json=payload) as response:
                if response.status != 204:
                    logger.error(f"Error sending Discord webhook notification: {response.status}")
    
    # Generic webhook
    elif notification_method == NotificationMethod.WEBHOOK:
        payload = {
            "title": title,
            "message": message,
            "task_id": task_id,
            "timestamp": datetime.now().isoformat()
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url_or_user_id, json=payload) as response:
                if response.status not in (200, 201, 202, 204):
                    logger.error(f"Error sending notification: {response.status}")

def send_notification(
    url_or_user_id: str, 
    title: str, 
    message: str, 
    task_id: str,
    notification_method: str = None
) -> None:
    """
    Send a synchronous notification.
    
    Args:
        url_or_user_id: The URL to send the notification to or user ID for DM
        title: Notification title
        message: Notification message
        task_id: Task ID for reference
        notification_method: Which notification method to use (webhook or bot_dm)
    """
    if not NOTIFICATION_AVAILABLE and notification_method != NotificationMethod.BOT_DM:
        logger.warning("Webhook notification packages not available (requests)")
        return
    
    # Determine notification method if not specified
    if notification_method is None:
        if "discord.com/api/webhooks" in url_or_user_id:
            notification_method = NotificationMethod.WEBHOOK
        elif DISCORD_DM_AVAILABLE and url_or_user_id.isdigit():
            notification_method = NotificationMethod.BOT_DM
        else:
            notification_method = DEFAULT_NOTIFICATION_METHOD
    
    # Discord direct message via bot
    if notification_method == NotificationMethod.BOT_DM and DISCORD_BOT_AVAILABLE:
        # Use the Discord bot to send a DM
        user_id = url_or_user_id
        
        # If no user ID provided, use the default
        if not user_id and DEFAULT_DISCORD_USER_ID:
            user_id = DEFAULT_DISCORD_USER_ID
            
        if not user_id:
            logger.error("No Discord user ID provided for direct message")
            return
            
        # Get an instance of the Discord notifier
        notifier = DiscordNotifier.get_instance(DISCORD_BOT_TOKEN)
        
        # Send the DM
        success = notifier.send_dm(user_id, title, message, task_id)
        if not success:
            logger.error(f"Failed to send Discord DM to user {user_id}")
    
    # Discord webhook format
    elif notification_method == NotificationMethod.WEBHOOK and "discord" in url_or_user_id.lower():
        payload = {
            "content": None,
            "embeds": [
                {
                    "title": title,
                    "description": message[:2000],  # Discord has a limit
                    "color": 5814783,
                    "footer": {
                        "text": f"Task ID: {task_id}"
                    },
                    "timestamp": datetime.now().isoformat()
                }
            ]
        }
        
        response = requests.post(url_or_user_id, json=payload)
        if response.status_code != 204:
            logger.error(f"Error sending Discord webhook notification: {response.status_code}")
    
    # Generic webhook
    elif notification_method == NotificationMethod.WEBHOOK:
        payload = {
            "title": title,
            "message": message,
            "task_id": task_id,
            "timestamp": datetime.now().isoformat()
        }
        
        response = requests.post(url_or_user_id, json=payload)
        if response.status_code not in (200, 201, 202, 204):
            logger.error(f"Error sending notification: {response.status_code}")

def generate_report_from_task(task_id: str) -> str:
    """
    Generate a detailed report from a data collection task.
    
    Args:
        task_id: The ID of the collection task
        
    Returns:
        Formatted report as a string
    """
    task_data = get_task_status(task_id)
    if not task_data:
        return f"Task {task_id} not found."
    
    if task_data.get("status") == "failed":
        return f"Task {task_id} failed: {task_data.get('summary', 'Unknown error')}"
    
    if task_data.get("status") != "completed":
        return f"Task {task_id} is still {task_data.get('status', 'pending')}. Check back later."
    
    # Load the full task data
    log = {}
    if COLLECTION_LOG_FILE.exists():
        try:
            with open(COLLECTION_LOG_FILE, 'r', encoding='utf-8') as f:
                log = json.load(f)
                for task in log.get("tasks", []):
                    if task.get("task_id") == task_id:
                        task_data = task
                        break
        except Exception as e:
            logger.error(f"Error reading collection log: {e}")
    
    # Format the report
    topic = task_data.get("topic", "")
    start_time = task_data.get("start_time", "")
    end_time = task_data.get("end_time", "")
    
    try:
        # Convert ISO format to human-readable
        start_dt = datetime.fromisoformat(start_time)
        start_time_str = start_dt.strftime("%Y-%m-%d %H:%M:%S")
        
        end_dt = datetime.fromisoformat(end_time)
        end_time_str = end_dt.strftime("%Y-%m-%d %H:%M:%S")
        
        duration = (end_dt - start_dt).total_seconds()
        duration_str = f"{duration:.1f} seconds"
    except (ValueError, TypeError):
        start_time_str = start_time
        end_time_str = end_time
        duration_str = "Unknown"
    
    # Create the basic report
    report = f"# Data Collection Report: {topic}\n\n"
    report += f"Task ID: {task_id}\n"
    report += f"Start Time: {start_time_str}\n"
    report += f"End Time: {end_time_str}\n"
    report += f"Duration: {duration_str}\n"
    report += f"Keywords: {', '.join(task_data.get('keywords', []))}\n\n"
    
    # Add the summary
    report += "## Summary\n\n"
    report += task_data.get("summary", "No summary available.") + "\n\n"
    
    # Add source details
    report += "## Data Sources\n\n"
    for source, count in task_data.get("results", {}).items():
        report += f"- {source.title()}: {count.get('count', 0)} items\n"
    
    return report

if __name__ == "__main__":
    # Test the data collection
    task_id = collect_data(
        topic="language challenges",
        keywords=["language barrier", "translation problems", "communication difficulty"],
        max_items_per_source=10
    )
    
    print(f"Started data collection task: {task_id}")
    print("Waiting for completion...")
    
    # Wait and check for completion
    time.sleep(5)
    for _ in range(12):  # Check for up to 1 minute
        status = get_task_status(task_id)
        if status and status.get("status") == "completed":
            print(f"Task completed! Summary:\n{status.get('summary')}")
            break
        elif status and status.get("status") == "failed":
            print(f"Task failed: {status.get('summary')}")
            break
        print("Still working...")
        time.sleep(5)
    
    # Generate a report
    report = generate_report_from_task(task_id)
    print("\nFinal Report:")
    print(report) 