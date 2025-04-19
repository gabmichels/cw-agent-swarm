import logging
import json
from typing import List, Dict, Any, Optional, Union
from pathlib import Path
from datetime import datetime

# Import the individual monitoring modules
from .reddit_monitor import fetch_reddit_posts, search_reddit_for_keywords, load_cached_posts, get_latest_reddit_data
from .rss_feed import fetch_rss_feeds, filter_articles_by_tags, load_cached_articles, is_cache_stale

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
DATA_DIR = Path(__file__).parent / "data"
RSS_CACHE_FILE = DATA_DIR / "rss_cache.json"
REDDIT_CACHE_FILE = DATA_DIR / "reddit_cache.json"

def ensure_data_directory() -> None:
    """Ensure the data directory exists."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

def get_combined_news(
    max_count: int = 50, 
    include_reddit: bool = True, 
    include_rss: bool = True,
    tags: Optional[List[str]] = None, 
    match_all_tags: bool = False,
    refresh_cache: bool = False,
    max_age_days: int = 7
) -> List[Dict[str, Any]]:
    """
    Get combined news from multiple sources (Reddit, RSS feeds).
    
    Args:
        max_count: Maximum number of news items to return
        include_reddit: Whether to include Reddit posts
        include_rss: Whether to include RSS feed articles
        tags: Optional list of tags to filter by
        match_all_tags: If True, items must have all tags; if False, any tag is sufficient
        refresh_cache: Force refreshing the cache instead of using cached data
        max_age_days: Maximum age of items to include (in days)
        
    Returns:
        List of news items from all sources
    """
    all_news = []
    
    # Get RSS feed articles
    if include_rss:
        rss_articles = []
        if refresh_cache or not RSS_CACHE_FILE.exists() or is_cache_stale(RSS_CACHE_FILE, hours=12):
            logger.info("Fetching fresh RSS feed articles")
            rss_articles = fetch_rss_feeds(max_age_days=max_age_days)
        else:
            logger.info("Loading cached RSS feed articles")
            rss_articles = load_cached_articles()
        
        # Apply tag filtering if provided
        if tags:
            rss_articles = filter_articles_by_tags(rss_articles, tags, match_all_tags)
        
        all_news.extend(rss_articles)
    
    # Get Reddit posts
    if include_reddit:
        reddit_posts = []
        if refresh_cache or not REDDIT_CACHE_FILE.exists() or is_cache_stale(REDDIT_CACHE_FILE, hours=12):
            logger.info("Fetching fresh Reddit posts")
            reddit_posts = fetch_reddit_posts(limit=50)
            
            # If tags are provided and include specific keywords, also search for those
            if tags and any(tag in ["ai", "language", "travel", "voice"] for tag in tags):
                keywords = []
                if "ai" in tags:
                    keywords.extend(["AI", "artificial intelligence", "machine learning"])
                if "language" in tags:
                    keywords.extend(["language", "translation", "interpreting"])
                if "travel" in tags:
                    keywords.extend(["travel", "tourism", "vacation"])
                if "voice" in tags:
                    keywords.extend(["voice", "speech", "audio"])
                
                keyword_posts = search_reddit_for_keywords(keywords, limit=50)
                # Add posts that aren't already in the list
                existing_ids = {post["id"] for post in reddit_posts}
                reddit_posts.extend([post for post in keyword_posts if post["id"] not in existing_ids])
        else:
            logger.info("Loading cached Reddit posts")
            reddit_posts = load_cached_posts()
        
        # Apply tag filtering if provided
        if tags:
            if match_all_tags:
                # Must match all tags
                reddit_posts = [
                    post for post in reddit_posts 
                    if all(tag in post.get("tags", []) for tag in tags)
                ]
            else:
                # Match any tag
                reddit_posts = [
                    post for post in reddit_posts 
                    if any(tag in post.get("tags", []) for tag in tags)
                ]
        
        all_news.extend(reddit_posts)
    
    # Sort all news by publication date (newest first)
    all_news.sort(key=lambda x: x.get("published_timestamp", 0), reverse=True)
    
    # Limit to max_count
    return all_news[:max_count]

def get_trending_topics(news_items: List[Dict[str, Any]], top_n: int = 5) -> List[Dict[str, Any]]:
    """
    Extract trending topics from a list of news items.
    
    Args:
        news_items: List of news items
        top_n: Number of trending topics to return
        
    Returns:
        List of trending topics with counts
    """
    # Count tags
    tag_counts = {}
    for item in news_items:
        for tag in item.get("tags", []):
            if tag in tag_counts:
                tag_counts[tag] += 1
            else:
                tag_counts[tag] = 1
    
    # Sort tags by count
    trending_topics = [
        {"topic": tag, "count": count, "percentage": (count / len(news_items)) * 100}
        for tag, count in sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)
        if tag not in ["news"]  # Exclude generic tags
    ]
    
    return trending_topics[:top_n]

def generate_daily_digest(max_items: int = 10) -> Dict[str, Any]:
    """
    Generate a daily digest of news from all sources.
    
    Args:
        max_items: Maximum number of items to include in each category
        
    Returns:
        Dictionary with daily digest data
    """
    # Get all recent news
    all_news = get_combined_news(max_count=100, refresh_cache=True, max_age_days=1)
    
    # Extract trending topics
    trending_topics = get_trending_topics(all_news, top_n=5)
    
    # Organize by category
    categories = {
        "ai": [],
        "language": [],
        "travel": [],
        "voice": [],
        "general": []
    }
    
    for item in all_news:
        tags = item.get("tags", [])
        
        # Assign to categories based on tags
        if "ai" in tags:
            categories["ai"].append(item)
        elif "language" in tags:
            categories["language"].append(item)
        elif "travel" in tags:
            categories["travel"].append(item)
        elif "voice" in tags:
            categories["voice"].append(item)
        else:
            categories["general"].append(item)
    
    # Limit each category to max_items
    for category in categories:
        categories[category] = categories[category][:max_items]
    
    # Create digest
    digest = {
        "timestamp": datetime.now().isoformat(),
        "trending_topics": trending_topics,
        "categories": categories,
        "total_items_analyzed": len(all_news)
    }
    
    return digest

def save_digest(digest: Dict[str, Any], filename: Optional[str] = None) -> str:
    """
    Save a digest to a JSON file.
    
    Args:
        digest: The digest data to save
        filename: Optional filename (defaults to a date-based name)
        
    Returns:
        Path to the saved digest file
    """
    ensure_data_directory()
    
    if filename is None:
        today = datetime.now().strftime("%Y-%m-%d")
        filename = f"digest_{today}.json"
    
    file_path = DATA_DIR / filename
    
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(digest, f, indent=2)
        logger.info(f"Saved digest to {file_path}")
        return str(file_path)
    except Exception as e:
        logger.error(f"Error saving digest: {e}")
        return ""

def load_digest(filename: str) -> Dict[str, Any]:
    """
    Load a digest from a JSON file.
    
    Args:
        filename: Name of the digest file
        
    Returns:
        The loaded digest data
    """
    file_path = DATA_DIR / filename
    
    if not file_path.exists():
        logger.warning(f"Digest file not found: {file_path}")
        return {}
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            digest = json.load(f)
        logger.info(f"Loaded digest from {file_path}")
        return digest
    except Exception as e:
        logger.error(f"Error loading digest: {e}")
        return {}

def search_all_news(query: str, max_results: int = 20) -> List[Dict[str, Any]]:
    """
    Search for news items matching a query across all sources.
    
    Args:
        query: Search query
        max_results: Maximum number of results to return
        
    Returns:
        List of matching news items
    """
    # Get all recent news
    all_news = get_combined_news(max_count=200)
    
    # Simple search implementation
    query = query.lower()
    results = []
    
    for item in all_news:
        title = item.get("title", "").lower()
        content = item.get("content", "").lower()
        
        if query in title or query in content:
            # Add a relevance score
            title_match = query in title
            item["relevance"] = 2 if title_match else 1
            results.append(item)
    
    # Sort by relevance (primary) and recency (secondary)
    results.sort(key=lambda x: (x.get("relevance", 0), x.get("published_timestamp", 0)), reverse=True)
    
    return results[:max_results]

def get_sentiment_distribution(news_items: List[Dict[str, Any]]) -> Dict[str, float]:
    """
    Calculate sentiment distribution from news items.
    This is a placeholder - for a real implementation, you'd use a sentiment analysis library.
    
    Args:
        news_items: List of news items
        
    Returns:
        Dictionary with sentiment distribution
    """
    # Placeholder for sentiment analysis
    # In a real implementation, you'd use a library like TextBlob, VADER, or a more advanced ML model
    return {
        "positive": 0.3,
        "neutral": 0.5,
        "negative": 0.2
    }

if __name__ == "__main__":
    # For testing
    all_news = get_combined_news(max_count=20, refresh_cache=True)
    print(f"Retrieved {len(all_news)} news items from all sources")
    
    # Generate and save a daily digest
    digest = generate_daily_digest()
    save_path = save_digest(digest)
    print(f"Saved digest to {save_path}")
    
    # Search for specific topics
    ai_results = search_all_news("artificial intelligence")
    print(f"Found {len(ai_results)} items related to 'artificial intelligence'")
    
    # Get trending topics
    trending = get_trending_topics(all_news)
    print("Trending topics:")
    for topic in trending:
        print(f"  {topic['topic']}: {topic['count']} items ({topic['percentage']:.1f}%)") 
 