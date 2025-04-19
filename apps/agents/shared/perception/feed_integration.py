import json
import os
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

# Import local modules
from .rss_monitor import fetch_rss_feeds, process_feed_items
from .reddit_monitor import fetch_reddit_posts, search_reddit_for_keywords

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
DATA_DIR = Path(__file__).parent / "data"
RSS_FEEDS_FILE = DATA_DIR / "rss_feeds.json"
AGGREGATED_DATA_FILE = DATA_DIR / "aggregated_perception_data.json"

def ensure_data_directory() -> None:
    """Ensure the data directory exists."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

def load_rss_feeds() -> List[Dict[str, Any]]:
    """Load RSS feeds from the JSON file."""
    if not RSS_FEEDS_FILE.exists():
        logger.warning(f"RSS feeds file not found: {RSS_FEEDS_FILE}")
        return []
    
    try:
        with open(RSS_FEEDS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data.get('feeds', [])
    except json.JSONDecodeError:
        logger.error(f"Error parsing RSS feeds file: {RSS_FEEDS_FILE}")
        return []
    except Exception as e:
        logger.error(f"Error loading RSS feeds: {e}")
        return []

def aggregate_perception_data(max_items_per_source: int = 50) -> Dict[str, Any]:
    """
    Aggregate data from all perception sources (RSS, Reddit, etc.)
    
    Args:
        max_items_per_source: Maximum number of items to include from each source
        
    Returns:
        Dictionary containing aggregated data from all sources
    """
    ensure_data_directory()
    
    # Timestamp for this aggregation
    timestamp = datetime.now().isoformat()
    
    # Initialize the aggregated data structure
    aggregated_data = {
        "timestamp": timestamp,
        "sources": {
            "rss": [],
            "reddit": []
        },
        "stats": {
            "total_items": 0,
            "sources_count": 0,
            "topics": {}
        }
    }
    
    # Load and process RSS feeds
    rss_feeds = load_rss_feeds()
    if rss_feeds:
        logger.info(f"Processing {len(rss_feeds)} RSS feeds")
        feed_items = fetch_rss_feeds(rss_feeds)
        processed_items = process_feed_items(feed_items, max_items=max_items_per_source)
        
        aggregated_data["sources"]["rss"] = processed_items
        aggregated_data["stats"]["total_items"] += len(processed_items)
        aggregated_data["stats"]["sources_count"] += len(rss_feeds)
        
        # Count topics from RSS feeds
        for item in processed_items:
            for tag in item.get("tags", []):
                if tag in aggregated_data["stats"]["topics"]:
                    aggregated_data["stats"]["topics"][tag] += 1
                else:
                    aggregated_data["stats"]["topics"][tag] = 1
    
    # Load and process Reddit data
    try:
        reddit_posts = fetch_reddit_posts()
        keyword_posts = search_reddit_for_keywords()
        
        # Combine and deduplicate Reddit posts
        all_reddit_posts = reddit_posts + [post for post in keyword_posts if post["id"] not in [p["id"] for p in reddit_posts]]
        
        # Limit the number of posts
        limited_posts = all_reddit_posts[:max_items_per_source]
        
        aggregated_data["sources"]["reddit"] = limited_posts
        aggregated_data["stats"]["total_items"] += len(limited_posts)
        aggregated_data["stats"]["sources_count"] += 1
        
        # Count topics from Reddit posts
        for post in limited_posts:
            for tag in post.get("tags", []):
                if tag in aggregated_data["stats"]["topics"]:
                    aggregated_data["stats"]["topics"][tag] += 1
                else:
                    aggregated_data["stats"]["topics"][tag] = 1
    
    except Exception as e:
        logger.error(f"Error processing Reddit data: {e}")
    
    # Save the aggregated data
    try:
        with open(AGGREGATED_DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(aggregated_data, f, indent=2)
        logger.info(f"Aggregated perception data saved to {AGGREGATED_DATA_FILE}")
    except Exception as e:
        logger.error(f"Error saving aggregated data: {e}")
    
    return aggregated_data

def get_latest_perception_data() -> Dict[str, Any]:
    """Get the latest aggregated perception data."""
    if not AGGREGATED_DATA_FILE.exists():
        logger.warning(f"Aggregated data file not found: {AGGREGATED_DATA_FILE}")
        return aggregate_perception_data()  # Generate new data
    
    try:
        with open(AGGREGATED_DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
            # Check if data is too old (more than 24 hours)
            timestamp = datetime.fromisoformat(data["timestamp"])
            now = datetime.now()
            if (now - timestamp).total_seconds() > 86400:  # 24 hours
                logger.info("Aggregated data is more than 24 hours old, regenerating")
                return aggregate_perception_data()
            
            return data
    except Exception as e:
        logger.error(f"Error loading aggregated data: {e}")
        return aggregate_perception_data()  # Generate new data

def extract_insights(data: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """
    Extract key insights from the aggregated perception data.
    
    Args:
        data: Aggregated perception data, or None to load the latest data
        
    Returns:
        List of insight dictionaries with title, description, and source
    """
    if data is None:
        data = get_latest_perception_data()
    
    insights = []
    
    # Add insights based on most common topics
    topics = data.get("stats", {}).get("topics", {})
    if topics:
        top_topics = sorted(topics.items(), key=lambda x: x[1], reverse=True)[:5]
        insights.append({
            "title": "Top Trending Topics",
            "description": f"The most discussed topics are: {', '.join([t[0] for t in top_topics])}",
            "source": "topic_analysis"
        })
    
    # Add insights from RSS feeds
    rss_items = data.get("sources", {}).get("rss", [])
    if rss_items:
        # Find most recent items
        recent_items = sorted(rss_items, key=lambda x: x.get("published_date", ""), reverse=True)[:5]
        
        insights.append({
            "title": "Recent Industry News",
            "description": f"Latest news: {recent_items[0]['title']} from {recent_items[0]['source_name']}",
            "source": "rss_feeds"
        })
    
    # Add insights from Reddit
    reddit_posts = data.get("sources", {}).get("reddit", [])
    if reddit_posts:
        # Find most engaging posts
        engaging_posts = sorted(reddit_posts, key=lambda x: x.get("score", 0) + x.get("num_comments", 0), reverse=True)[:5]
        
        if engaging_posts:
            insights.append({
                "title": "Community Discussions",
                "description": f"Hot topic on Reddit: {engaging_posts[0]['title']} with {engaging_posts[0].get('num_comments', 0)} comments",
                "source": "reddit"
            })
    
    return insights

if __name__ == "__main__":
    # For testing
    data = aggregate_perception_data()
    insights = extract_insights(data)
    print(f"Generated {len(insights)} insights from perception data")
    for insight in insights:
        print(f"- {insight['title']}: {insight['description']}") 
 