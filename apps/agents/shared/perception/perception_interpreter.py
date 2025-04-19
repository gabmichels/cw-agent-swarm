"""
Perception Interpreter Module

This module provides an interface between natural language queries and the perception 
layer. It interprets user queries about trends, news, and insights, and calls the 
appropriate perception functions to provide answers.
"""
import logging
import re
from typing import Dict, List, Any, Optional, Tuple, Union
from datetime import datetime, timedelta

# Import perception modules
from .news_monitor import (
    get_combined_news, 
    get_trending_topics, 
    search_all_news,
    generate_daily_digest
)
from .rss_feed import get_latest_articles, filter_articles_by_tags
from .reddit_monitor import get_latest_reddit_data

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PerceptionInterpreter:
    """
    Interprets natural language queries and retrieves relevant perception data.
    """
    
    def __init__(self):
        """Initialize the perception interpreter."""
        # Define query patterns and their corresponding handlers
        self.query_patterns = [
            (r'trending in (.*?)( this week| today| recently| right now)?', self._handle_trending_query),
            (r'latest (news|headlines|articles)( about| on| in)? (.*?)(\?)?$', self._handle_news_query),
            (r'what( is|\'s) happening in (.*?)( today| this week| recently)?', self._handle_happening_query),
            (r'insights( about| on| for) (.*?)(\?)?$', self._handle_insights_query),
            (r'summarize (.*?) news', self._handle_summary_query),
        ]
    
    def interpret_query(self, query: str) -> Dict[str, Any]:
        """
        Interpret a natural language query and return relevant perception data.
        
        Args:
            query: The natural language query to interpret
            
        Returns:
            Dictionary with the response data and metadata
        """
        # Normalize query to lowercase
        normalized_query = query.lower().strip()
        
        # Try to match against known patterns
        for pattern, handler in self.query_patterns:
            match = re.search(pattern, normalized_query)
            if match:
                try:
                    return handler(match, normalized_query)
                except Exception as e:
                    logger.error(f"Error handling query '{normalized_query}': {e}")
                    return {
                        "success": False,
                        "error": f"Error processing query: {str(e)}",
                        "query": normalized_query
                    }
        
        # If no patterns match, try free-form search
        if any(keyword in normalized_query for keyword in ["news", "article", "trend", "marketing", "tech", "ai", "travel", "language"]):
            try:
                return self._handle_free_form_query(normalized_query)
            except Exception as e:
                logger.error(f"Error handling free-form query '{normalized_query}': {e}")
        
        # No handler found
        return {
            "success": False,
            "error": "I don't understand that query about trends or news. Try asking about trending topics in a specific area, latest news, or insights on a topic.",
            "query": normalized_query
        }
    
    def _handle_trending_query(self, match, query: str) -> Dict[str, Any]:
        """
        Handle queries about trending topics.
        
        Example: "What's trending in marketing this week?"
        """
        topic = match.group(1).strip()
        time_frame = match.group(2).strip() if match.group(2) else "recently"
        
        # Determine date range based on time frame
        if "week" in time_frame:
            days = 7
            time_description = "this week"
        elif "today" in time_frame:
            days = 1
            time_description = "today"
        else:
            days = 3
            time_description = "recently"
        
        # Map general topics to specific tags
        tags = []
        if topic in ["marketing", "advertising", "ads", "promotion"]:
            tags = ["marketing", "advertising", "content_marketing", "strategy"]
        elif topic in ["tech", "technology", "it"]:
            tags = ["technology", "tech_news"]
        elif topic in ["ai", "artificial intelligence", "machine learning"]:
            tags = ["ai", "machine_learning"]
        elif topic in ["travel", "tourism", "vacation"]:
            tags = ["travel", "tourism"]
        elif topic in ["language", "translation", "linguistics"]:
            tags = ["language", "translation", "language_learning"]
        elif topic in ["voice", "speech", "audio"]:
            tags = ["voice", "speech_to_text", "voice_assistant"]
        
        # Get news items filtered by tags if applicable
        if tags:
            news_items = get_combined_news(
                max_count=100, 
                tags=tags, 
                max_age_days=days
            )
        else:
            # If no specific tags, get all news
            news_items = get_combined_news(max_count=100, max_age_days=days)
        
        # Get trending topics from these news items
        trending_topics = get_trending_topics(news_items, top_n=5)
        
        # Format the response
        formatted_topics = []
        for topic_data in trending_topics:
            topic_name = topic_data["topic"]
            count = topic_data["count"]
            percentage = topic_data["percentage"]
            
            # Find a representative article for this topic
            examples = [
                item for item in news_items 
                if topic_name in item.get("tags", [])
            ][:2]
            
            topic_info = {
                "name": topic_name,
                "count": count,
                "percentage": percentage,
                "examples": [
                    {
                        "title": ex.get("title", ""),
                        "source": ex.get("source", ""),
                        "link": ex.get("link", "")
                    } for ex in examples
                ]
            }
            
            formatted_topics.append(topic_info)
        
        return {
            "success": True,
            "query_type": "trending",
            "topic": topic,
            "time_frame": time_description,
            "trending_topics": formatted_topics,
            "total_items_analyzed": len(news_items),
            "timestamp": datetime.now().isoformat()
        }
    
    def _handle_news_query(self, match, query: str) -> Dict[str, Any]:
        """
        Handle queries about latest news on a specific topic.
        
        Example: "Latest news about AI translation?"
        """
        content_type = match.group(1).strip()
        topic = match.group(3).strip()
        
        # Map topics to tags and search terms
        tags = []
        search_term = None
        
        if "marketing" in topic.lower():
            tags = ["marketing", "advertising", "content_marketing"]
        elif "tech" in topic.lower() or "technology" in topic.lower():
            tags = ["technology", "tech_news"]
        elif "ai" in topic.lower() or "artificial intelligence" in topic.lower():
            tags = ["ai", "machine_learning"]
            if "translation" in topic.lower():
                tags.append("translation")
                search_term = "ai translation"
        elif "travel" in topic.lower() or "tourism" in topic.lower():
            tags = ["travel", "tourism"]
        elif "language" in topic.lower() or "translation" in topic.lower():
            tags = ["language", "translation", "language_learning"]
        elif "voice" in topic.lower() or "speech" in topic.lower():
            tags = ["voice", "speech_to_text", "voice_assistant"]
        
        # Get news based on tags and/or search term
        if search_term:
            # If we have a specific search term, use search
            news_items = search_all_news(search_term, max_results=10)
        elif tags:
            # Otherwise filter by tags
            news_items = get_combined_news(
                max_count=10, 
                tags=tags,
                max_age_days=7
            )
        else:
            # If no specific tags or search term, just search by the topic
            news_items = search_all_news(topic, max_results=10)
        
        # Format the response
        formatted_news = []
        for item in news_items:
            formatted_item = {
                "title": item.get("title", ""),
                "summary": item.get("content", "")[:200] + "..." if len(item.get("content", "")) > 200 else item.get("content", ""),
                "source": item.get("source", ""),
                "published": item.get("published", ""),
                "link": item.get("link", ""),
                "tags": item.get("tags", [])
            }
            formatted_news.append(formatted_item)
        
        return {
            "success": True,
            "query_type": "latest_news",
            "topic": topic,
            "news_items": formatted_news,
            "item_count": len(formatted_news),
            "timestamp": datetime.now().isoformat()
        }
    
    def _handle_happening_query(self, match, query: str) -> Dict[str, Any]:
        """
        Handle queries about what's happening in a specific domain.
        
        Example: "What's happening in travel today?"
        """
        domain = match.group(2).strip()
        time_frame = match.group(3).strip() if match.group(3) else "recently"
        
        # Map domains to tags
        tags = []
        if domain in ["marketing", "advertising", "promotion"]:
            tags = ["marketing", "advertising", "content_marketing"]
        elif domain in ["tech", "technology", "it"]:
            tags = ["technology", "tech_news"]
        elif domain in ["ai", "artificial intelligence", "ml", "machine learning"]:
            tags = ["ai", "machine_learning"]
        elif domain in ["travel", "tourism", "vacation"]:
            tags = ["travel", "tourism"]
        elif domain in ["language", "translation", "linguistics"]:
            tags = ["language", "translation", "language_learning"]
        elif domain in ["voice", "speech", "audio"]:
            tags = ["voice", "speech_to_text", "voice_assistant"]
        
        # Determine time range
        if "today" in time_frame:
            days = 1
        elif "week" in time_frame:
            days = 7
        else:
            days = 3
        
        # Get relevant news items
        news_items = get_combined_news(
            max_count=15, 
            tags=tags, 
            max_age_days=days
        )
        
        # Get trending topics for this domain
        trending_topics = get_trending_topics(news_items, top_n=3)
        
        # Format top headlines and trending topics
        top_headlines = []
        for item in news_items[:5]:
            headline = {
                "title": item.get("title", ""),
                "source": item.get("source", ""),
                "link": item.get("link", ""),
                "published": item.get("published", "")
            }
            top_headlines.append(headline)
        
        formatted_topics = []
        for topic in trending_topics:
            formatted_topics.append({
                "name": topic["topic"],
                "count": topic["count"],
                "percentage": topic["percentage"]
            })
        
        return {
            "success": True,
            "query_type": "happening",
            "domain": domain,
            "time_frame": time_frame,
            "top_headlines": top_headlines,
            "trending_topics": formatted_topics,
            "total_items": len(news_items),
            "timestamp": datetime.now().isoformat()
        }
    
    def _handle_insights_query(self, match, query: str) -> Dict[str, Any]:
        """
        Handle queries about insights on a specific topic.
        
        Example: "Insights on AI in travel?"
        """
        topic = match.group(2).strip()
        
        # Generate a daily digest
        digest = generate_daily_digest(max_items=20)
        
        # Find relevant categories and items
        relevant_categories = []
        if "ai" in topic.lower():
            relevant_categories.append("ai")
        if "language" in topic.lower() or "translation" in topic.lower():
            relevant_categories.append("language")
        if "travel" in topic.lower() or "tourism" in topic.lower():
            relevant_categories.append("travel")
        if "voice" in topic.lower() or "speech" in topic.lower():
            relevant_categories.append("voice")
        
        # If no specific categories match, use "general" and search
        if not relevant_categories:
            relevant_categories.append("general")
            # Also search for the topic
            search_results = search_all_news(topic, max_results=10)
        else:
            search_results = []
        
        # Extract relevant items from the digest
        relevant_items = []
        for category in relevant_categories:
            if category in digest["categories"]:
                relevant_items.extend(digest["categories"][category])
        
        # Combine with search results if any
        if search_results:
            # Add search results that aren't already in relevant_items
            existing_ids = {item.get("id") for item in relevant_items}
            for item in search_results:
                if item.get("id") not in existing_ids:
                    relevant_items.append(item)
                    existing_ids.add(item.get("id"))
        
        # Format the insights
        formatted_insights = []
        for item in relevant_items[:10]:  # Limit to top 10
            insight = {
                "title": item.get("title", ""),
                "summary": item.get("content", "")[:200] + "..." if len(item.get("content", "")) > 200 else item.get("content", ""),
                "source": item.get("source", ""),
                "link": item.get("link", ""),
                "tags": item.get("tags", [])
            }
            formatted_insights.append(insight)
        
        # Get trending topics related to these insights
        trending_topics = get_trending_topics(relevant_items, top_n=3)
        
        return {
            "success": True,
            "query_type": "insights",
            "topic": topic,
            "insights": formatted_insights,
            "trending_topics": trending_topics,
            "total_relevant_items": len(relevant_items),
            "timestamp": datetime.now().isoformat()
        }
    
    def _handle_summary_query(self, match, query: str) -> Dict[str, Any]:
        """
        Handle queries for summaries of news in a specific area.
        
        Example: "Summarize marketing news"
        """
        topic = match.group(1).strip()
        
        # Map topic to tags
        tags = []
        if topic in ["marketing", "advertising", "promotion"]:
            tags = ["marketing", "advertising", "content_marketing"]
        elif topic in ["tech", "technology", "it"]:
            tags = ["technology", "tech_news"]
        elif topic in ["ai", "artificial intelligence", "ml", "machine learning"]:
            tags = ["ai", "machine_learning"]
        elif topic in ["travel", "tourism", "vacation"]:
            tags = ["travel", "tourism"]
        elif topic in ["language", "translation", "linguistics"]:
            tags = ["language", "translation", "language_learning"]
        elif topic in ["voice", "speech", "audio"]:
            tags = ["voice", "speech_to_text", "voice_assistant"]
        
        # Get relevant news
        news_items = get_combined_news(
            max_count=50,
            tags=tags,
            max_age_days=7
        )
        
        # Get trending topics
        trending_topics = get_trending_topics(news_items, top_n=5)
        
        # Format top headlines
        top_headlines = []
        for item in news_items[:7]:
            headline = {
                "title": item.get("title", ""),
                "source": item.get("source", ""),
                "link": item.get("link", ""),
                "published": item.get("published", "")
            }
            top_headlines.append(headline)
        
        # Create a summary of key points
        key_points = [
            f"There are {len(news_items)} recent articles related to {topic}",
            f"The top trending subtopic is {trending_topics[0]['topic'] if trending_topics else 'N/A'}",
            f"Content is coming from {len(set(item.get('source', '') for item in news_items))} different sources"
        ]
        
        return {
            "success": True,
            "query_type": "summary",
            "topic": topic,
            "top_headlines": top_headlines,
            "trending_topics": trending_topics,
            "key_points": key_points,
            "total_items": len(news_items),
            "timestamp": datetime.now().isoformat()
        }
    
    def _handle_free_form_query(self, query: str) -> Dict[str, Any]:
        """
        Handle free-form queries by searching content.
        
        Example: "Tell me about the latest developments in AI translation"
        """
        # Extract potential keywords from the query
        potential_keywords = [
            "marketing", "advertising", "tech", "technology", "ai", 
            "artificial intelligence", "machine learning", "travel", "tourism",
            "language", "translation", "voice", "speech", "trends", "trending"
        ]
        
        found_keywords = [kw for kw in potential_keywords if kw in query.lower()]
        
        search_term = query
        if "trending" in query.lower() or "trends" in query.lower():
            # This is likely a trending query
            topic = " ".join(found_keywords) if found_keywords else query
            return self._handle_trending_query(
                re.search(r'trending in (.*)', topic) or re.search(r'(.*)', topic),
                query
            )
        
        # This is a general search query
        search_results = search_all_news(search_term, max_results=10)
        
        # Format the results
        formatted_results = []
        for item in search_results:
            result = {
                "title": item.get("title", ""),
                "summary": item.get("content", "")[:200] + "..." if len(item.get("content", "")) > 200 else item.get("content", ""),
                "source": item.get("source", ""),
                "link": item.get("link", ""),
                "tags": item.get("tags", [])
            }
            formatted_results.append(result)
        
        return {
            "success": True,
            "query_type": "free_form",
            "search_term": search_term,
            "results": formatted_results,
            "result_count": len(formatted_results),
            "timestamp": datetime.now().isoformat()
        }

# Create a formatter function to convert the perception data to natural language
def format_perception_response(response_data: Dict[str, Any]) -> str:
    """
    Format perception data into a natural language response.
    
    Args:
        response_data: The response data from the perception interpreter
        
    Returns:
        A natural language response
    """
    if not response_data.get("success", False):
        return response_data.get("error", "I couldn't find any information on that topic.")
    
    query_type = response_data.get("query_type", "")
    
    if query_type == "trending":
        topic = response_data.get("topic", "")
        time_frame = response_data.get("time_frame", "recently")
        trending_topics = response_data.get("trending_topics", [])
        
        if not trending_topics:
            return f"I don't have any trending information about {topic} {time_frame}."
        
        response = f"Here's what's trending in {topic} {time_frame}:\n\n"
        
        for i, topic_data in enumerate(trending_topics, 1):
            topic_name = topic_data.get("name", "").replace("_", " ")
            percentage = topic_data.get("percentage", 0)
            
            response += f"{i}. **{topic_name.title()}** ({percentage:.1f}% of content)\n"
            
            examples = topic_data.get("examples", [])
            if examples:
                for example in examples:
                    response += f"   - {example.get('title', '')} ({example.get('source', '')})\n"
            
            response += "\n"
        
        return response
    
    elif query_type == "latest_news":
        topic = response_data.get("topic", "")
        news_items = response_data.get("news_items", [])
        
        if not news_items:
            return f"I don't have any recent news about {topic}."
        
        response = f"Here's the latest news about {topic}:\n\n"
        
        for i, item in enumerate(news_items[:5], 1):
            title = item.get("title", "")
            source = item.get("source", "")
            link = item.get("link", "")
            
            response += f"{i}. **{title}**\n"
            response += f"   Source: {source}\n"
            
            if "summary" in item and item["summary"]:
                summary = item["summary"]
                response += f"   {summary}\n"
            
            response += f"   [Read more]({link})\n\n"
        
        if len(news_items) > 5:
            response += f"*Plus {len(news_items) - 5} more articles about {topic}.*"
        
        return response
    
    elif query_type == "happening":
        domain = response_data.get("domain", "")
        top_headlines = response_data.get("top_headlines", [])
        trending_topics = response_data.get("trending_topics", [])
        
        if not top_headlines and not trending_topics:
            return f"I don't have any information about what's happening in {domain} right now."
        
        response = f"Here's what's happening in {domain}:\n\n"
        
        if trending_topics:
            response += "**Trending Topics:**\n"
            for i, topic in enumerate(trending_topics, 1):
                topic_name = topic.get("name", "").replace("_", " ")
                percentage = topic.get("percentage", 0)
                response += f"{i}. {topic_name.title()} ({percentage:.1f}% of content)\n"
            response += "\n"
        
        if top_headlines:
            response += "**Top Headlines:**\n"
            for i, headline in enumerate(top_headlines, 1):
                title = headline.get("title", "")
                source = headline.get("source", "")
                link = headline.get("link", "")
                
                response += f"{i}. **{title}** ({source})\n"
                response += f"   [Read more]({link})\n\n"
        
        return response
    
    elif query_type == "insights":
        topic = response_data.get("topic", "")
        insights = response_data.get("insights", [])
        trending_topics = response_data.get("trending_topics", [])
        
        if not insights:
            return f"I don't have any insights about {topic} at the moment."
        
        response = f"Here are some insights about {topic}:\n\n"
        
        if trending_topics:
            response += "**Key Trends:**\n"
            for i, topic in enumerate(trending_topics, 1):
                topic_name = topic.get("topic", "").replace("_", " ")
                percentage = topic.get("percentage", 0)
                response += f"{i}. {topic_name.title()} ({percentage:.1f}% of content)\n"
            response += "\n"
        
        response += "**Recent Developments:**\n"
        for i, insight in enumerate(insights[:5], 1):
            title = insight.get("title", "")
            source = insight.get("source", "")
            link = insight.get("link", "")
            
            response += f"{i}. **{title}**\n"
            response += f"   Source: {source}\n"
            
            if "summary" in insight and insight["summary"]:
                summary = insight["summary"]
                response += f"   {summary}\n"
            
            response += f"   [Read more]({link})\n\n"
        
        return response
    
    elif query_type == "summary":
        topic = response_data.get("topic", "")
        top_headlines = response_data.get("top_headlines", [])
        trending_topics = response_data.get("trending_topics", [])
        key_points = response_data.get("key_points", [])
        
        if not top_headlines and not trending_topics:
            return f"I don't have enough information to summarize {topic} news."
        
        response = f"**Summary of {topic.title()} News:**\n\n"
        
        if key_points:
            response += "**Key Points:**\n"
            for point in key_points:
                response += f"- {point}\n"
            response += "\n"
        
        if trending_topics:
            response += "**Trending Topics:**\n"
            for i, topic in enumerate(trending_topics[:3], 1):
                topic_name = topic.get("topic", "").replace("_", " ")
                percentage = topic.get("percentage", 0)
                response += f"{i}. {topic_name.title()} ({percentage:.1f}% of content)\n"
            response += "\n"
        
        if top_headlines:
            response += "**Notable Headlines:**\n"
            for i, headline in enumerate(top_headlines[:3], 1):
                title = headline.get("title", "")
                source = headline.get("source", "")
                
                response += f"{i}. {title} ({source})\n"
            
        return response
    
    elif query_type == "free_form":
        search_term = response_data.get("search_term", "")
        results = response_data.get("results", [])
        
        if not results:
            return f"I couldn't find any information about '{search_term}'."
        
        response = f"Here's what I found about '{search_term}':\n\n"
        
        for i, result in enumerate(results[:5], 1):
            title = result.get("title", "")
            source = result.get("source", "")
            link = result.get("link", "")
            
            response += f"{i}. **{title}**\n"
            response += f"   Source: {source}\n"
            
            if "summary" in result and result["summary"]:
                summary = result["summary"]
                response += f"   {summary}\n"
            
            response += f"   [Read more]({link})\n\n"
        
        return response
    
    # Default case if query type is not recognized
    return "I found some information, but I'm not sure how to present it. Try asking in a different way."

# Main function to handle perception queries
def handle_perception_query(query: str) -> str:
    """
    Process a natural language query about perception data and return a formatted response.
    
    Args:
        query: The natural language query
        
    Returns:
        A formatted text response
    """
    interpreter = PerceptionInterpreter()
    response_data = interpreter.interpret_query(query)
    return format_perception_response(response_data)

if __name__ == "__main__":
    # For testing
    test_queries = [
        "What's trending in marketing this week?",
        "Latest news about AI translation?",
        "What's happening in travel today?",
        "Insights on voice technology?",
        "Summarize AI news"
    ]
    
    for query in test_queries:
        print(f"\nQuery: {query}")
        response = handle_perception_query(query)
        print(f"Response:\n{response}") 