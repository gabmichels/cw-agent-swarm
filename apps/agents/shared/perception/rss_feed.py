import os
import json
import logging
import time
import feedparser
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from pathlib import Path

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
DATA_DIR = Path(__file__).parent / "data"
RSS_FEEDS_FILE = DATA_DIR / "rss_feeds.json"
RSS_CACHE_FILE = DATA_DIR / "rss_cache.json"

# Default RSS feeds focused on industry news, language tech, travel, and voice AI
DEFAULT_RSS_FEEDS = [
    {
        "url": "https://techcrunch.com/tag/ai/feed/",
        "name": "TechCrunch AI",
        "tags": ["ai", "technology", "news"]
    },
    {
        "url": "https://www.slator.com/feed/",
        "name": "Slator - Translation Industry News",
        "tags": ["translation", "language_industry", "news"]
    },
    {
        "url": "https://feeds.feedburner.com/skift",
        "name": "Skift - Travel Industry News",
        "tags": ["travel", "tourism", "industry_news"]
    },
    {
        "url": "https://voicebot.ai/feed/",
        "name": "Voicebot.ai",
        "tags": ["voice_tech", "ai", "voice_assistant"]
    },
    {
        "url": "https://www.gadgetsnow.com/rssfeeds/76654464.cms",
        "name": "Gadgets Now - AI & ML",
        "tags": ["ai", "ml", "gadgets", "technology"]
    },
    {
        "url": "https://www.languagemagazine.com/feed/",
        "name": "Language Magazine",
        "tags": ["language", "education", "linguistics"] 
    },
    {
        "url": "https://feed.traveldragonfly.com/",
        "name": "Travel Dragonfly",
        "tags": ["travel", "tourism", "international"]
    },
    {
        "url": "https://www.lonelyplanet.com/blog/feed",
        "name": "Lonely Planet Blog",
        "tags": ["travel", "tourism", "guides"]
    },
    {
        "url": "https://www.artificialintelligence-news.com/feed/",
        "name": "AI News",
        "tags": ["ai", "news", "technology"]
    }
]

def ensure_data_directory() -> None:
    """Ensure the data directory exists."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

def load_rss_feeds() -> List[Dict[str, Any]]:
    """
    Load RSS feed configuration from file or use defaults.
    
    Returns:
        List of RSS feed configurations
    """
    ensure_data_directory()
    
    # Check if custom feeds file exists
    if RSS_FEEDS_FILE.exists():
        try:
            with open(RSS_FEEDS_FILE, 'r', encoding='utf-8') as f:
                feeds = json.load(f)
                logger.info(f"Loaded {len(feeds)} RSS feeds from configuration file")
                return feeds
        except Exception as e:
            logger.error(f"Error loading RSS feeds configuration: {e}")
    
    # If no file or error, use defaults
    logger.info(f"Using {len(DEFAULT_RSS_FEEDS)} default RSS feeds")
    
    # Save default feeds to file for future customization
    try:
        with open(RSS_FEEDS_FILE, 'w', encoding='utf-8') as f:
            json.dump(DEFAULT_RSS_FEEDS, f, indent=2)
    except Exception as e:
        logger.error(f"Error saving default RSS feeds configuration: {e}")
    
    return DEFAULT_RSS_FEEDS

def fetch_rss_feeds(feeds: Optional[List[Dict[str, Any]]] = None, max_age_days: int = 7) -> List[Dict[str, Any]]:
    """
    Fetch articles from RSS feeds.
    
    Args:
        feeds: List of feed dictionaries with url, name, and tags
        max_age_days: Maximum age of articles to include (in days)
        
    Returns:
        List of processed articles from RSS feeds
    """
    if feeds is None:
        feeds = load_rss_feeds()
    
    articles = []
    now = datetime.now()
    cutoff_date = now - timedelta(days=max_age_days)
    
    for feed_info in feeds:
        feed_url = feed_info["url"]
        feed_name = feed_info["name"]
        feed_tags = feed_info.get("tags", [])
        
        try:
            logger.info(f"Fetching RSS feed: {feed_name} ({feed_url})")
            parsed_feed = feedparser.parse(feed_url)
            
            for entry in parsed_feed.entries:
                # Get publication date
                if hasattr(entry, 'published_parsed') and entry.published_parsed:
                    pub_date = datetime.fromtimestamp(time.mktime(entry.published_parsed))
                elif hasattr(entry, 'updated_parsed') and entry.updated_parsed:
                    pub_date = datetime.fromtimestamp(time.mktime(entry.updated_parsed))
                else:
                    # If no date available, assume it's recent
                    pub_date = now
                
                # Skip if too old
                if pub_date < cutoff_date:
                    continue
                
                # Extract article content
                content = ""
                if hasattr(entry, 'content') and entry.content:
                    # Some feeds use content
                    content = entry.content[0].value
                elif hasattr(entry, 'summary'):
                    # Others use summary
                    content = entry.summary
                elif hasattr(entry, 'description'):
                    # Others use description
                    content = entry.description
                
                # Create article object
                article = {
                    "id": entry.get('id', entry.link),
                    "title": entry.title,
                    "link": entry.link,
                    "published": pub_date.isoformat(),
                    "published_timestamp": pub_date.timestamp(),
                    "source": feed_name,
                    "source_url": feed_url,
                    "content": content[:1000] + "..." if len(content) > 1000 else content,
                    "tags": feed_tags.copy(),  # Copy to avoid modifying the original
                    "retrieved": now.isoformat()
                }
                
                # Add additional tags based on content
                title_and_content = (article["title"] + " " + article["content"]).lower()
                
                # Travel-related tags
                if any(keyword in title_and_content for keyword in ["travel", "tourism", "vacation", "destination"]):
                    if "travel" not in article["tags"]:
                        article["tags"].append("travel")
                
                # Language-related tags
                if any(keyword in title_and_content for keyword in ["language", "translation", "translator", "interpreting"]):
                    if "language" not in article["tags"]:
                        article["tags"].append("language")
                
                # AI-related tags
                if any(keyword in title_and_content for keyword in ["ai", "artificial intelligence", "machine learning", "neural"]):
                    if "ai" not in article["tags"]:
                        article["tags"].append("ai")
                
                # Voice-related tags
                if any(keyword in title_and_content for keyword in ["voice", "speech", "audio", "speaking"]):
                    if "voice" not in article["tags"]:
                        article["tags"].append("voice")
                
                articles.append(article)
            
            logger.info(f"Processed {len(parsed_feed.entries)} entries from {feed_name}")
            
        except Exception as e:
            logger.error(f"Error fetching RSS feed {feed_name}: {e}")
    
    # Sort articles by publication date (newest first)
    articles.sort(key=lambda x: x.get("published_timestamp", 0), reverse=True)
    
    # Cache the articles
    cache_articles(articles)
    
    return articles

def cache_articles(articles: List[Dict[str, Any]]) -> None:
    """Cache RSS articles to avoid re-fetching."""
    ensure_data_directory()
    
    # Load existing cache if it exists
    existing_articles = []
    if RSS_CACHE_FILE.exists():
        try:
            with open(RSS_CACHE_FILE, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
                existing_articles = cache_data.get("articles", [])
        except Exception as e:
            logger.error(f"Error loading RSS cache: {e}")
    
    # Combine existing and new articles, removing duplicates by ID
    existing_ids = {article["id"] for article in existing_articles}
    unique_new_articles = [article for article in articles if article["id"] not in existing_ids]
    
    combined_articles = existing_articles + unique_new_articles
    
    # Keep only the most recent 1000 articles
    if len(combined_articles) > 1000:
        combined_articles = sorted(combined_articles, key=lambda x: x.get("published_timestamp", 0), reverse=True)[:1000]
    
    # Save to cache file
    cache_data = {
        "timestamp": datetime.now().isoformat(),
        "article_count": len(combined_articles),
        "articles": combined_articles
    }
    
    try:
        with open(RSS_CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, indent=2)
        logger.info(f"Cached {len(unique_new_articles)} new RSS articles, total: {len(combined_articles)}")
    except Exception as e:
        logger.error(f"Error saving RSS cache: {e}")

def load_cached_articles() -> List[Dict[str, Any]]:
    """Load cached RSS articles."""
    if not RSS_CACHE_FILE.exists():
        logger.warning(f"RSS cache file not found: {RSS_CACHE_FILE}")
        return []
    
    try:
        with open(RSS_CACHE_FILE, 'r', encoding='utf-8') as f:
            cache_data = json.load(f)
            return cache_data.get("articles", [])
    except Exception as e:
        logger.error(f"Error loading RSS cache: {e}")
        return []

def filter_articles_by_tags(articles: List[Dict[str, Any]], tags: List[str], match_all: bool = False) -> List[Dict[str, Any]]:
    """
    Filter articles by tags.
    
    Args:
        articles: List of articles
        tags: List of tags to filter by
        match_all: If True, articles must have all tags; if False, any tag is sufficient
        
    Returns:
        Filtered list of articles
    """
    if not tags:
        return articles
    
    if match_all:
        # Must match all tags
        return [
            article for article in articles 
            if all(tag in article.get("tags", []) for tag in tags)
        ]
    else:
        # Match any tag
        return [
            article for article in articles 
            if any(tag in article.get("tags", []) for tag in tags)
        ]

def get_latest_articles(max_count: int = 50, tags: Optional[List[str]] = None, match_all_tags: bool = False) -> List[Dict[str, Any]]:
    """
    Get the latest articles, optionally filtered by tags.
    
    Args:
        max_count: Maximum number of articles to return
        tags: Optional list of tags to filter by
        match_all_tags: If True, articles must have all tags; if False, any tag is sufficient
        
    Returns:
        List of the latest articles
    """
    # First check if we have cached articles
    articles = load_cached_articles()
    
    # If cache is empty or older than 12 hours, fetch fresh data
    if not articles or is_cache_stale(RSS_CACHE_FILE, hours=12):
        articles = fetch_rss_feeds()
    
    # Apply tag filtering if provided
    if tags:
        articles = filter_articles_by_tags(articles, tags, match_all_tags)
    
    # Sort by published date and limit to max_count
    articles.sort(key=lambda x: x.get("published_timestamp", 0), reverse=True)
    return articles[:max_count]

def is_cache_stale(cache_file: Path, hours: int = 24) -> bool:
    """
    Check if a cache file is older than the specified number of hours.
    
    Args:
        cache_file: Path to the cache file
        hours: Number of hours after which the cache is considered stale
        
    Returns:
        True if the cache is stale or doesn't exist, False otherwise
    """
    if not cache_file.exists():
        return True
    
    try:
        # Get file modification time
        mtime = datetime.fromtimestamp(cache_file.stat().st_mtime)
        age = datetime.now() - mtime
        
        # Check if file is older than specified hours
        return age > timedelta(hours=hours)
    except Exception as e:
        logger.error(f"Error checking cache age: {e}")
        return True  # If there's an error, assume it's stale

if __name__ == "__main__":
    # For testing
    articles = fetch_rss_feeds(max_age_days=3)
    print(f"Fetched {len(articles)} articles from RSS feeds")
    
    # Filter for AI-related articles
    ai_articles = filter_articles_by_tags(articles, ["ai"])
    print(f"Found {len(ai_articles)} AI-related articles")
    
    # Filter for articles related to both AI and language
    ai_language_articles = filter_articles_by_tags(articles, ["ai", "language"], match_all=True)
    print(f"Found {len(ai_language_articles)} articles related to both AI and language") 
 