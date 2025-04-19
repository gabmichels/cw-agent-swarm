"""
Perception Tools Module

This module provides agent tools to interact with the perception layer.
These tools allow an agent to query for news, trends, and insights.
"""
import logging
from typing import Dict, List, Any, Optional, Union

from ..perception.perception_interpreter import handle_perception_query
from ..perception.data_collector import (
    collect_data, 
    get_task_status, 
    generate_report_from_task
)
from ..config import DEFAULT_DISCORD_WEBHOOK, ENABLE_AUTO_NOTIFICATIONS, has_notification_intent

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
        notify_discord: bool = False,
        discord_webhook_url: str = "",
        response_message: str = None
    ) -> str:
        """
        Trigger active data collection on a specific topic.
        This will actively fetch fresh data from RSS feeds and Reddit.
        
        Args:
            topic: Main topic to collect data about
            keywords: Specific keywords to search for (defaults to [topic])
            sources: Sources to collect from (defaults to ["rss", "reddit"])
            notify_discord: Whether to send a Discord notification when complete
            discord_webhook_url: Discord webhook URL for notifications
            response_message: Optional response message to check for notification intent
            
        Returns:
            Task ID and confirmation message
        """
        logger.info(f"Triggering data collection for topic: {topic}")
        
        # Determine if we should notify based on:
        # 1. Explicit notify_discord parameter
        # 2. Discord webhook URL parameter
        # 3. Default Discord webhook from config
        # 4. Notification intent in the response message
        if not notify_discord and not discord_webhook_url and ENABLE_AUTO_NOTIFICATIONS:
            # Check for notification intent in response_message if provided
            if response_message and has_notification_intent(response_message):
                notify_discord = True
                logger.info("Auto-notification enabled based on notification intent in response")
            
            # Use default webhook if available
            if notify_discord and DEFAULT_DISCORD_WEBHOOK:
                discord_webhook_url = DEFAULT_DISCORD_WEBHOOK
                logger.info("Using default Discord webhook for notification")
        
        # Final decision on whether to notify and which URL to use
        should_notify = notify_discord or bool(discord_webhook_url)
        webhook_url = discord_webhook_url if discord_webhook_url else DEFAULT_DISCORD_WEBHOOK if should_notify else None
        
        try:
            task_id = collect_data(
                topic=topic,
                keywords=keywords,
                sources=sources,
                send_notification=should_notify,
                notification_url=webhook_url
            )
            
            # Customize the response based on notification status
            response = f"I've started collecting fresh data about '{topic}'. This will take a few moments to complete."
            
            if should_notify and webhook_url:
                response += f" I'll notify you on Discord when it's ready."
            else:
                response += f" You can check the status using the task ID: {task_id}"
            
            return response
        except Exception as e:
            logger.error(f"Error triggering data collection: {str(e)}")
            return f"I encountered an error while trying to collect data on {topic}: {str(e)}"
    
    @staticmethod
    def check_collection_status(task_id: str) -> str:
        """
        Check the status of a data collection task.
        
        Args:
            task_id: The ID of the data collection task
            
        Returns:
            Status report
        """
        logger.info(f"Checking collection status for task: {task_id}")
        
        try:
            status = get_task_status(task_id)
            
            if not status:
                return f"I couldn't find a data collection task with ID: {task_id}"
            
            task_status = status.get("status", "unknown")
            
            if task_status == "completed":
                # If the task is complete, provide a brief summary
                summary = status.get("summary", "No summary available.")
                return f"Data collection task {task_id} is complete!\n\n{summary}\n\nFor a full report, use get_collection_report."
            elif task_status == "failed":
                error = status.get("summary", "Unknown error")
                return f"Data collection task {task_id} failed: {error}"
            else:
                return f"Data collection task {task_id} is still {task_status}. Please check back later."
        except Exception as e:
            logger.error(f"Error checking collection status: {str(e)}")
            return f"I encountered an error while checking the collection status: {str(e)}"
    
    @staticmethod
    def get_collection_report(task_id: str) -> str:
        """
        Get a detailed report from a completed data collection task.
        
        Args:
            task_id: The ID of the data collection task
            
        Returns:
            Detailed report
        """
        logger.info(f"Generating report for collection task: {task_id}")
        
        try:
            report = generate_report_from_task(task_id)
            return report
        except Exception as e:
            logger.error(f"Error generating collection report: {str(e)}")
            return f"I encountered an error while generating the collection report: {str(e)}"
    
    @staticmethod
    def collect_and_analyze(
        topic: str, 
        keywords: List[str] = None,
        wait_for_completion: bool = True,
        timeout_seconds: int = 60,
        notify_discord: bool = False,
        discord_webhook_url: str = "",
        response_message: str = None
    ) -> str:
        """
        Collect fresh data, wait for completion, and provide analysis in one step.
        
        Args:
            topic: Topic to collect data about
            keywords: Specific keywords to search for
            wait_for_completion: Whether to wait for collection to complete
            timeout_seconds: Maximum time to wait for completion
            notify_discord: Whether to send a Discord notification when complete
            discord_webhook_url: Discord webhook URL for notifications
            response_message: Optional response message to check for notification intent
            
        Returns:
            Analysis report or status message
        """
        import time
        
        logger.info(f"Collecting and analyzing data for: {topic}")
        
        # Determine if we should notify
        if not notify_discord and not discord_webhook_url and ENABLE_AUTO_NOTIFICATIONS:
            # Check for notification intent in response_message if provided
            if response_message and has_notification_intent(response_message):
                notify_discord = True
                logger.info("Auto-notification enabled based on notification intent in response")
            
            # Use default webhook if available
            if notify_discord and DEFAULT_DISCORD_WEBHOOK:
                discord_webhook_url = DEFAULT_DISCORD_WEBHOOK
                logger.info("Using default Discord webhook for notification")
        
        # Final decision on whether to notify and which URL to use
        should_notify = notify_discord or bool(discord_webhook_url)
        webhook_url = discord_webhook_url if discord_webhook_url else DEFAULT_DISCORD_WEBHOOK if should_notify else None
        
        try:
            # Start the collection
            task_id = collect_data(
                topic=topic,
                keywords=keywords,
                send_notification=should_notify,
                notification_url=webhook_url
            )
            
            if not wait_for_completion:
                response = f"I've started collecting fresh data about '{topic}'."
                if should_notify and webhook_url:
                    response += f" I'll notify you on Discord when it's ready."
                else:
                    response += f" You can check back later with task ID: {task_id}"
                return response
            
            # Wait for completion
            logger.info(f"Waiting for task {task_id} to complete...")
            start_time = time.time()
            
            while time.time() - start_time < timeout_seconds:
                status = get_task_status(task_id)
                
                if not status:
                    return f"Something went wrong. I couldn't find the task with ID: {task_id}"
                
                task_status = status.get("status", "unknown")
                
                if task_status == "completed":
                    # Task completed successfully, get the report
                    report = generate_report_from_task(task_id)
                    return f"I've collected and analyzed data about '{topic}':\n\n{report}"
                elif task_status == "failed":
                    error = status.get("summary", "Unknown error")
                    return f"Data collection for '{topic}' failed: {error}"
                
                # Wait before checking again
                time.sleep(5)
            
            # If we get here, we've timed out
            response = f"The data collection is taking longer than expected."
            if should_notify and webhook_url:
                response += f" I'll notify you on Discord when it's ready."
            else:
                response += f" You can check its status later with task ID: {task_id}"
            return response
            
        except Exception as e:
            logger.error(f"Error in collect and analyze: {str(e)}")
            return f"I encountered an error while collecting and analyzing data on {topic}: {str(e)}"

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