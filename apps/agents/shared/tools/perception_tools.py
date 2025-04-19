"""
Perception Tools Module

This module provides agent tools to interact with the perception layer.
These tools allow an agent to query for news, trends, and insights.
"""
import logging
import time
from typing import Dict, List, Any, Optional, Union, Tuple

from ..perception.perception_interpreter import handle_perception_query
from ..perception.data_collector import (
    collect_data, 
    get_task_status, 
    generate_report_from_task
)
from ..config import (
    DEFAULT_DISCORD_WEBHOOK,
    DISCORD_BOT_TOKEN,
    DEFAULT_DISCORD_USER_ID,
    ENABLE_AUTO_NOTIFICATIONS,
    has_notification_intent,
    NotificationMethod,
    DEFAULT_NOTIFICATION_METHOD,
    PREFER_DIRECT_MESSAGES
)

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PerceptionTools:
    """
    Tools for interacting with the perception layer to get news, trends, and insights.
    """
    
    @staticmethod
    def query_perception(query: str) -> str:
        """
        Query the perception layer with a natural language question.
        
        Args:
            query: A natural language query about trends, news, or insights
            
        Returns:
            A formatted response from the perception layer
            
        Examples:
            - "What's trending in marketing this week?"
            - "Latest news about AI translation?"
            - "What's happening in travel today?"
            - "Insights on voice technology?"
            - "Summarize AI news"
        """
        logger.info(f"Perception query: {query}")
        
        try:
            response = handle_perception_query(query)
            return response
        except Exception as e:
            logger.error(f"Error processing perception query: {str(e)}")
            return f"I encountered an error while trying to answer your question about {query}. The perception system may not have enough data or there might be a technical issue."
    
    @staticmethod
    def get_trending_topics(domain: str = "", days: int = 7) -> str:
        """
        Get trending topics in a specific domain.
        
        Args:
            domain: The domain to get trends for (e.g., "marketing", "technology", "travel")
            days: Number of days to consider (default: 7)
            
        Returns:
            A formatted response with trending topics
        """
        domain_str = f" in {domain}" if domain else ""
        query = f"What's trending{domain_str} this week?"
        
        return PerceptionTools.query_perception(query)
    
    @staticmethod
    def get_latest_news(topic: str) -> str:
        """
        Get the latest news about a specific topic.
        
        Args:
            topic: The topic to get news for
            
        Returns:
            A formatted response with the latest news
        """
        query = f"Latest news about {topic}"
        
        return PerceptionTools.query_perception(query)
    
    @staticmethod
    def get_domain_insights(domain: str) -> str:
        """
        Get insights about a specific domain.
        
        Args:
            domain: The domain to get insights for
            
        Returns:
            A formatted response with insights about the domain
        """
        query = f"Insights on {domain}"
        
        return PerceptionTools.query_perception(query)
    
    @staticmethod
    def summarize_news(topic: str) -> str:
        """
        Get a summary of news about a specific topic.
        
        Args:
            topic: The topic to summarize news for
            
        Returns:
            A formatted response with a summary of the news
        """
        query = f"Summarize {topic} news"
        
        return PerceptionTools.query_perception(query)
    
    @staticmethod
    def trigger_data_collection(
        topic: str,
        keywords: List[str] = None,
        sources: List[str] = None,
        discord_webhook_url: str = None,
        discord_user_id: str = None,
        notify_discord: bool = False,
        response_message: str = None,
        notification_method: str = None
    ) -> Tuple[str, str]:
        """
        Trigger proactive data collection on a specific topic.
        
        Args:
            topic: The topic to collect data on
            keywords: List of keywords to focus the collection
            sources: List of sources to collect from
            discord_webhook_url: Optional webhook URL for Discord notifications
            discord_user_id: Optional Discord user ID for direct message notifications
            notify_discord: Whether to send a Discord notification when complete
            response_message: The last response message from the AI to check for notification intent
            notification_method: Which notification method to use (webhook or bot_dm)
            
        Returns:
            Tuple of (task_id, response_message)
        """
        # Parse keywords if provided as comma-separated string
        if isinstance(keywords, str):
            keywords = [k.strip() for k in keywords.split(',') if k.strip()]
        elif keywords is None:
            keywords = []
            
        # Determine notification preferences
        should_notify = False
        webhook_url = None
        user_id = None
        
        # Logic for determining if and how to send notifications:
        # 1. Explicit notify_discord parameter
        if notify_discord:
            should_notify = True
            
        # 2. Check for notification intent in the response
        if not notify_discord and ENABLE_AUTO_NOTIFICATIONS and response_message:
            if has_notification_intent(response_message):
                should_notify = True
                logger.info(f"Detected notification intent in: {response_message[:100]}...")
                
        # 3. Determine method preference
        if notification_method is None:
            # Automatic method selection:
            if discord_user_id or (should_notify and PREFER_DIRECT_MESSAGES and DEFAULT_DISCORD_USER_ID):
                notification_method = NotificationMethod.BOT_DM
            elif discord_webhook_url or DEFAULT_DISCORD_WEBHOOK:
                notification_method = NotificationMethod.WEBHOOK
            else:
                notification_method = DEFAULT_NOTIFICATION_METHOD
                
        # 4. Set the right parameters for the chosen method
        if notification_method == NotificationMethod.BOT_DM:
            user_id = discord_user_id if discord_user_id else DEFAULT_DISCORD_USER_ID
        else:  # WEBHOOK
            webhook_url = discord_webhook_url if discord_webhook_url else DEFAULT_DISCORD_WEBHOOK
        
        # Start the data collection
        logger.info(f"Starting data collection on topic: {topic}")
        task_id = collect_data(
            topic=topic,
            keywords=keywords,
            sources=sources,
            send_notification=should_notify,
            notification_url=webhook_url,
            notification_user_id=user_id,
            notification_method=notification_method
        )
        
        # Build a response message
        response = f"I've started collecting data on '{topic}'"
        if keywords:
            response += f" focusing on keywords: {', '.join(keywords)}"
        
        response += f". Task ID: {task_id}"
        
        if should_notify:
            if notification_method == NotificationMethod.BOT_DM:
                response += f" I'll notify you via Discord direct message when it's ready."
            else:
                response += f" I'll notify you on Discord when it's ready."
        
        return task_id, response
    
    @staticmethod
    def check_collection_status(task_id: str) -> str:
        """
        Check the status of a data collection task.
        
        Args:
            task_id: The ID of the collection task
            
        Returns:
            Status message
        """
        task_data = get_task_status(task_id)
        
        if not task_data:
            return f"No data collection task found with ID {task_id}."
            
        status = task_data.get("status", "unknown")
        topic = task_data.get("topic", "unknown topic")
        
        if status == "completed":
            return f"Data collection task for '{topic}' is completed. You can get the report."
        elif status == "failed":
            return f"Data collection task for '{topic}' failed: {task_data.get('summary', 'Unknown error')}"
        else:
            return f"Data collection task for '{topic}' is {status}."
    
    @staticmethod
    def get_collection_report(task_id: str) -> str:
        """
        Get a report from a completed data collection task.
        
        Args:
            task_id: The ID of the collection task
            
        Returns:
            Formatted report
        """
        return generate_report_from_task(task_id)
    
    @staticmethod
    def collect_and_analyze(
        topic: str,
        keywords: List[str] = None,
        sources: List[str] = None,
        wait_for_completion: bool = True,
        timeout_seconds: int = 60,
        discord_webhook_url: str = None,
        discord_user_id: str = None,
        notify_discord: bool = False,
        response_message: str = None,
        notification_method: str = None
    ) -> Dict[str, Any]:
        """
        Collect and analyze data on a topic, optionally waiting for completion.
        
        Args:
            topic: The topic to collect data on
            keywords: List of keywords to focus the collection
            sources: List of sources to collect from
            wait_for_completion: Whether to wait for the collection to complete
            timeout_seconds: Maximum time to wait for completion
            discord_webhook_url: Optional webhook URL for Discord notifications
            discord_user_id: Optional Discord user ID for direct message notifications
            notify_discord: Whether to send a Discord notification when complete
            response_message: The last response message from the AI to check for notification intent
            notification_method: Which notification method to use (webhook or bot_dm)
            
        Returns:
            Dictionary with task_id, status, and optional report/summary
        """
        # Parse keywords if provided as comma-separated string
        if isinstance(keywords, str):
            keywords = [k.strip() for k in keywords.split(',') if k.strip()]
        elif keywords is None:
            keywords = []
            
        # Determine notification preferences
        should_notify = False
        webhook_url = None
        user_id = None
        
        # Logic for notification similar to trigger_data_collection
        if not notify_discord and ENABLE_AUTO_NOTIFICATIONS and response_message:
            if has_notification_intent(response_message):
                should_notify = True
                logger.info(f"Detected notification intent in: {response_message[:100]}...")
                
        # Determine method preference
        if notification_method is None:
            # Automatic method selection:
            if discord_user_id or (should_notify and PREFER_DIRECT_MESSAGES and DEFAULT_DISCORD_USER_ID):
                notification_method = NotificationMethod.BOT_DM
            elif discord_webhook_url or DEFAULT_DISCORD_WEBHOOK:
                notification_method = NotificationMethod.WEBHOOK
            else:
                notification_method = DEFAULT_NOTIFICATION_METHOD
                
        # Set the right parameters for the chosen method
        if notification_method == NotificationMethod.BOT_DM:
            user_id = discord_user_id if discord_user_id else DEFAULT_DISCORD_USER_ID
        else:  # WEBHOOK
            webhook_url = discord_webhook_url if discord_webhook_url else DEFAULT_DISCORD_WEBHOOK
        
        # Start the data collection
        task_id = collect_data(
            topic=topic,
            keywords=keywords,
            sources=sources,
            send_notification=should_notify,
            notification_url=webhook_url,
            notification_user_id=user_id,
            notification_method=notification_method
        )
        
        result = {
            "task_id": task_id,
            "status": "pending"
        }
        
        # Build a response message
        response = f"I've started collecting and analyzing data on '{topic}'"
        
        if keywords:
            response += f" focusing on keywords: {', '.join(keywords)}"
            
        # Add notification info to response
        if should_notify:
            if notification_method == NotificationMethod.BOT_DM:
                response += f" I'll notify you via Discord direct message when it's ready."
            else:
                response += f" I'll notify you on Discord when it's ready."
                
        result["response"] = response
        
        # Wait for completion if requested
        if wait_for_completion:
            start_time = time.time()
            elapsed = 0
            
            while elapsed < timeout_seconds:
                task_data = get_task_status(task_id)
                
                if task_data and task_data.get("status") == "completed":
                    result["status"] = "completed"
                    result["report"] = generate_report_from_task(task_id)
                    result["summary"] = task_data.get("summary", "No summary available")
                    break
                elif task_data and task_data.get("status") == "failed":
                    result["status"] = "failed"
                    result["error"] = task_data.get("summary", "Unknown error")
                    break
                    
                # Wait before checking again
                time.sleep(min(5, timeout_seconds - elapsed))
                elapsed = time.time() - start_time
                
            # If we timed out
            if result["status"] == "pending":
                result["status"] = "timeout"
                result["response"] += f" The task is still running in the background. Task ID: {task_id}"
                if should_notify:
                    response += " You will be notified when it completes."
                    
        return result

# Export the tools for use in the agent system
perception_tools = {
    "query_perception": PerceptionTools.query_perception,
    "get_trending_topics": PerceptionTools.get_trending_topics,
    "get_latest_news": PerceptionTools.get_latest_news,
    "get_domain_insights": PerceptionTools.get_domain_insights,
    "summarize_news": PerceptionTools.summarize_news,
    "trigger_data_collection": PerceptionTools.trigger_data_collection,
    "check_collection_status": PerceptionTools.check_collection_status,
    "get_collection_report": PerceptionTools.get_collection_report,
    "collect_and_analyze": PerceptionTools.collect_and_analyze
} 
 