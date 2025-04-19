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
from pathlib import Path
from typing import Dict, List, Any, Optional, Union
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

# Optional imports for notifications
try:
    import aiohttp
    import requests
    NOTIFICATION_AVAILABLE = True
except ImportError:
    NOTIFICATION_AVAILABLE = False

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
DATA_DIR = Path(__file__).parent / "data"
COLLECTION_LOG_FILE = DATA_DIR / "collection_log.json"

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
    notification_url: str = None
) -> str:
    """
    Asynchronously collect data from various sources.
    
    Args:
        task_id: Unique ID for this collection task
        topic: The topic to collect data about
        sources: List of sources to collect from (defaults to ["rss", "reddit"])
        keywords: Specific keywords to search for (defaults to topic if not provided)
        max_items_per_source: Maximum items to collect per source
        send_notification: Whether to send a notification when complete
        notification_url: URL to send the notification to
        
    Returns:
        Task ID for status tracking
    """
    # Set defaults
    sources = sources or ["rss", "reddit"]
    keywords = keywords or [topic]
    
    # Create the task
    task = DataCollectionTask(task_id, topic, sources, keywords)
    task.start()
    save_task(task)
    
    try:
        # Collect from RSS feeds
        if "rss" in sources:
            logger.info(f"Collecting RSS feeds related to {topic}")
            
            # Get RSS feeds
            rss_articles = fetch_rss_feeds(max_age_days=7)
            
            # Filter by keywords
            filtered_articles = []
            for article in rss_articles:
                content = f"{article.get('title', '')} {article.get('content', '')}".lower()
                if any(keyword.lower() in content for keyword in keywords):
                    filtered_articles.append(article)
            
            # Store results
            task.results["rss"]["count"] = len(filtered_articles)
            task.results["rss"]["items"] = filtered_articles[:max_items_per_source]
            logger.info(f"Collected {len(filtered_articles)} relevant RSS articles")
        
        # Collect from Reddit
        if "reddit" in sources:
            logger.info(f"Collecting Reddit posts related to {topic}")
            
            # Get general Reddit posts
            reddit_posts = fetch_reddit_posts(limit=50)
            
            # Search for specific keywords
            keyword_posts = []
            for keyword in keywords:
                keyword_posts.extend(search_reddit_for_keywords([keyword], limit=10))
            
            # Combine and deduplicate
            all_posts = reddit_posts + [post for post in keyword_posts if post["id"] not in [p["id"] for p in reddit_posts]]
            
            # Filter by keywords
            filtered_posts = []
            for post in all_posts:
                content = f"{post.get('title', '')} {post.get('selftext', '')}".lower()
                if any(keyword.lower() in content for keyword in keywords):
                    filtered_posts.append(post)
            
            # Store results
            task.results["reddit"]["count"] = len(filtered_posts)
            task.results["reddit"]["items"] = filtered_posts[:max_items_per_source]
            logger.info(f"Collected {len(filtered_posts)} relevant Reddit posts")
        
        # Generate summary
        all_items = []
        for source, data in task.results.items():
            all_items.extend(data["items"])
        
        # Get trending topics from the collected data
        trending_topics = get_trending_topics(all_items, top_n=5)
        
        # Create a summary
        summary = f"Data collection for '{topic}' complete.\n\n"
        summary += f"Collected {task.results['rss']['count']} RSS articles and {task.results['reddit']['count']} Reddit posts.\n\n"
        
        if trending_topics:
            summary += "Key topics found:\n"
            for topic_data in trending_topics:
                topic_name = topic_data["topic"]
                percentage = topic_data["percentage"]
                summary += f"- {topic_name.replace('_', ' ').title()} ({percentage:.1f}%)\n"
            summary += "\n"
        
        # Add example items
        if all_items:
            summary += "Sample findings:\n"
            for i, item in enumerate(sorted(all_items, key=lambda x: x.get("published_timestamp", 0), reverse=True)[:5]):
                title = item.get("title", "")
                source = item.get("source", "")
                summary += f"- {title} (from {source})\n"
        
        task.summary = summary
        task.complete()
        save_task(task)
        
        # Store the collection results as a memory
        store_memory(
            content=f"Data collection on '{topic}' found {len(all_items)} relevant items across {len(sources)} sources.",
            context=summary,
            tags=["perception", "data_collection"] + keywords,
            importance=0.6
        )
        
        # Send notification if requested
        if send_notification and notification_url and NOTIFICATION_AVAILABLE:
            try:
                await send_notification_async(
                    notification_url,
                    f"Data collection on '{topic}' complete",
                    summary,
                    task_id
                )
            except Exception as e:
                logger.error(f"Error sending notification: {e}")
        
        return task_id
    
    except Exception as e:
        logger.error(f"Error collecting data: {e}")
        task.fail(str(e))
        save_task(task)
        return task_id

def collect_data(
    topic: str,
    sources: List[str] = None,
    keywords: List[str] = None,
    max_items_per_source: int = 20,
    send_notification: bool = False,
    notification_url: str = None
) -> str:
    """
    Synchronously start a data collection task.
    
    Args:
        topic: The topic to collect data about
        sources: List of sources to collect from
        keywords: Specific keywords to search for
        max_items_per_source: Maximum items to collect per source
        send_notification: Whether to send a notification when complete
        notification_url: URL to send the notification to
        
    Returns:
        Task ID for status tracking
    """
    # Generate a task ID
    task_id = f"collect_{int(time.time())}"
    
    # Run the collection task in the background
    asyncio.create_task(collect_data_async(
        task_id=task_id,
        topic=topic,
        sources=sources,
        keywords=keywords,
        max_items_per_source=max_items_per_source,
        send_notification=send_notification,
        notification_url=notification_url
    ))
    
    return task_id

async def send_notification_async(url: str, title: str, message: str, task_id: str) -> None:
    """
    Send an asynchronous notification.
    
    Args:
        url: The URL to send the notification to
        title: Notification title
        message: Notification message
        task_id: Task ID for reference
    """
    if not NOTIFICATION_AVAILABLE:
        logger.warning("Notification packages not available (aiohttp, requests)")
        return
    
    # Discord webhook format
    if "discord" in url.lower():
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
            async with session.post(url, json=payload) as response:
                if response.status != 204:
                    logger.error(f"Error sending Discord notification: {response.status}")
    
    # Generic webhook
    else:
        payload = {
            "title": title,
            "message": message,
            "task_id": task_id,
            "timestamp": datetime.now().isoformat()
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as response:
                if response.status not in (200, 201, 202, 204):
                    logger.error(f"Error sending notification: {response.status}")

def send_notification(url: str, title: str, message: str, task_id: str) -> None:
    """
    Send a synchronous notification.
    
    Args:
        url: The URL to send the notification to
        title: Notification title
        message: Notification message
        task_id: Task ID for reference
    """
    if not NOTIFICATION_AVAILABLE:
        logger.warning("Notification packages not available (requests)")
        return
    
    # Discord webhook format
    if "discord" in url.lower():
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
        
        response = requests.post(url, json=payload)
        if response.status_code != 204:
            logger.error(f"Error sending Discord notification: {response.status_code}")
    
    # Generic webhook
    else:
        payload = {
            "title": title,
            "message": message,
            "task_id": task_id,
            "timestamp": datetime.now().isoformat()
        }
        
        response = requests.post(url, json=payload)
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