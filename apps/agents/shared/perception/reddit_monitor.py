"""
Reddit Monitor Module

This module handles fetching and processing posts from Reddit.
"""
import json
import os
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from pathlib import Path

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
DATA_DIR = Path(__file__).parent / "data"
REDDIT_CACHE_FILE = DATA_DIR / "reddit_cache.json"
REDDIT_CACHE_DURATION = 12  # Hours

def ensure_data_dir() -> None:
    """Ensure the data directory exists."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

def load_cached_posts() -> List[Dict[str, Any]]:
    """
    Load cached Reddit posts if available and not expired.
    
    Returns:
        List of Reddit post dictionaries, or empty list if cache is invalid
    """
    if not REDDIT_CACHE_FILE.exists():
        return []
    
    try:
        with open(REDDIT_CACHE_FILE, 'r', encoding='utf-8') as f:
            cache_data = json.load(f)
        
        # Check cache timestamp
        cache_time = datetime.fromisoformat(cache_data.get("timestamp", ""))
        cache_age = datetime.now() - cache_time
        
        if cache_age > timedelta(hours=REDDIT_CACHE_DURATION):
            logger.info(f"Reddit cache expired (age: {cache_age.total_seconds() / 3600:.1f} hours)")
            return []
        
        posts = cache_data.get("posts", [])
        logger.info(f"Loaded {len(posts)} Reddit posts from cache")
        return posts
    except Exception as e:
        logger.error(f"Error loading Reddit cache: {e}")
        return []

def fetch_reddit_posts(subreddits: List[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
    """
    Fetch posts from specified subreddits or default marketing-related ones.
    
    Args:
        subreddits: List of subreddit names to fetch from
        limit: Maximum number of posts to fetch
        
    Returns:
        List of dictionaries containing post information
    """
    # Try to load from cache first
    cached_posts = load_cached_posts()
    if cached_posts:
        return cached_posts[:limit]
    
    # Default marketing-related subreddits
    if not subreddits:
        subreddits = [
            "marketing", "digitalmarketing", "socialmedia", "content_marketing",
            "SEO", "analytics", "productivity", "Entrepreneur", "business"
        ]
    
    logger.info(f"Would fetch posts from subreddits: {', '.join(subreddits)}")
    
    # Since we're not actually connecting to Reddit API in this mock version,
    # generate some sample data
    sample_posts = generate_sample_posts(subreddits, limit)
    
    # Cache the results
    save_posts_to_cache(sample_posts)
    
    return sample_posts

def search_reddit_for_keywords(keywords: List[str], subreddits: List[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Search Reddit for posts containing specific keywords.
    
    Args:
        keywords: List of keywords to search for
        subreddits: Optional list of subreddits to search within
        limit: Maximum number of posts to return
        
    Returns:
        List of dictionaries containing post information
    """
    # Get posts (from cache or generated)
    all_posts = fetch_reddit_posts(subreddits, limit=200)  # Get more posts to filter from
    
    # Filter posts by keywords
    filtered_posts = []
    for post in all_posts:
        post_text = f"{post.get('title', '')} {post.get('selftext', '')}".lower()
        if any(keyword.lower() in post_text for keyword in keywords):
            filtered_posts.append(post)
            if len(filtered_posts) >= limit:
                break
    
    logger.info(f"Found {len(filtered_posts)} Reddit posts matching keywords: {', '.join(keywords)}")
    return filtered_posts

def generate_sample_posts(subreddits: List[str], limit: int) -> List[Dict[str, Any]]:
    """
    Generate sample Reddit posts for testing.
    
    Args:
        subreddits: List of subreddit names
        limit: Maximum number of posts to generate
        
    Returns:
        List of dictionaries containing post information
    """
    # Sample content themes by subreddit
    themes = {
        "marketing": [
            "New Marketing Study Shows 63% Increase in ROI from Personalized Campaigns",
            "What's your favorite marketing automation tool?",
            "How to measure marketing campaign success in 2023",
            "Content marketing strategies that actually worked for my small business"
        ],
        "digitalmarketing": [
            "Google's latest algorithm update - what you need to know",
            "The future of digital marketing in the age of AI",
            "LinkedIn ads vs Facebook ads - my experience and results",
            "How to create a digital marketing strategy from scratch"
        ],
        "socialmedia": [
            "TikTok marketing guide for B2B businesses",
            "Instagram's new features for businesses explained",
            "How we grew our social media presence by 400% in 6 months",
            "Social media management tools comparison 2023"
        ],
        "content_marketing": [
            "The ultimate guide to creating evergreen content",
            "Content repurposing strategies that save time and maximize reach",
            "How we increased our blog traffic by 200% with strategic content planning",
            "Case study: Content marketing for SaaS companies"
        ],
        "SEO": [
            "Core Web Vitals: How they affect your rankings in 2023",
            "Local SEO checklist for small businesses",
            "The truth about backlinks in 2023 - what still works",
            "Technical SEO audit: A step-by-step guide"
        ],
        "analytics": [
            "GA4 migration guide - what you need to know before the deadline",
            "How to build custom marketing dashboards that executives love",
            "Attribution models explained: choosing the right one for your business",
            "Using data to optimize your marketing funnel"
        ],
        "productivity": [
            "The 5-hour workday experiment: Results and lessons",
            "Task batching vs time blocking - which works better?",
            "My productivity stack: Tools I use daily to get more done",
            "How to run effective meetings that don't waste time"
        ],
        "Entrepreneur": [
            "How I bootstrapped my company to $1M ARR",
            "The reality of raising venture capital in 2023",
            "From side hustle to full-time: My journey and lessons learned",
            "Building a remote team: Challenges and solutions"
        ],
        "business": [
            "Economic outlook for small businesses in 2023",
            "Customer retention strategies that increased our LTV by 40%",
            "How we cut operational costs without sacrificing quality",
            "B2B sales strategies that actually work in today's market"
        ]
    }
    
    # Generate a mix of posts from different subreddits
    all_posts = []
    post_id = 1000
    
    for _ in range(limit):
        # Cycle through subreddits
        subreddit = subreddits[len(all_posts) % len(subreddits)]
        
        # Get themes for this subreddit, or use generic themes
        subreddit_themes = themes.get(subreddit, themes["marketing"])
        
        # Create a post
        post = {
            "id": f"t3_{post_id}",
            "subreddit": subreddit,
            "title": subreddit_themes[post_id % len(subreddit_themes)],
            "selftext": f"This is sample content for a post in r/{subreddit} about various marketing and business topics. This would contain more detailed information about the topic mentioned in the title.",
            "author": f"user_{post_id % 20}",
            "score": post_id % 100 + 5,
            "created_utc": (datetime.now() - timedelta(hours=post_id % 72)).timestamp(),
            "num_comments": post_id % 50,
            "permalink": f"/r/{subreddit}/comments/{post_id}/sample_post/",
            "url": f"https://reddit.com/r/{subreddit}/comments/{post_id}/sample_post/"
        }
        
        all_posts.append(post)
        post_id += 1
    
    return all_posts

def get_latest_reddit_data(max_age_hours: int = 24) -> List[Dict[str, Any]]:
    """
    Get the latest Reddit data, fetching new data if existing data is too old.
    
    Args:
        max_age_hours: Maximum age in hours before refreshing
        
    Returns:
        List of Reddit posts
    """
    # Check if we have cached posts that are recent enough
    cached_posts = load_cached_posts()
    if cached_posts:
        cache_time = None
        try:
            with open(REDDIT_CACHE_FILE, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
                cache_time = datetime.fromisoformat(cache_data.get("timestamp", ""))
        except Exception:
            pass
        
        # If we have a valid cache time and it's recent, use cached posts
        if cache_time and (datetime.now() - cache_time).total_seconds() / 3600 < max_age_hours:
            logger.info(f"Using {len(cached_posts)} cached Reddit posts (age: {(datetime.now() - cache_time).total_seconds() / 3600:.1f} hours)")
            return cached_posts
    
    # No recent cache, fetch fresh data
    # Get posts from default subreddits related to marketing and business
    posts = fetch_reddit_posts(limit=100)
    
    # Get posts containing specific keywords
    keyword_posts = search_reddit_for_keywords(
        ["marketing strategy", "content marketing", "social media", "analytics"], 
        limit=50
    )
    
    # Combine results and remove duplicates
    all_posts = posts.copy()
    seen_ids = set(post["id"] for post in all_posts)
    
    for post in keyword_posts:
        if post["id"] not in seen_ids:
            all_posts.append(post)
            seen_ids.add(post["id"])
    
    # Update post format for compatibility with perception interpreter
    for post in all_posts:
        # Add tags and source fields that perception interpreter might expect
        post["tags"] = [post["subreddit"]]
        post["source"] = "reddit"
        
        # Standardize fields - convert selftext to text if needed
        if "selftext" in post and "text" not in post:
            post["text"] = post["selftext"]
    
    logger.info(f"Returning {len(all_posts)} Reddit posts")
    return all_posts

def save_posts_to_cache(all_posts: List[Dict[str, Any]]) -> None:
    """
    Save posts to the cache file.
    
    Args:
        all_posts: List of posts to save
    """
    ensure_data_dir()
    try:
        with open(REDDIT_CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump({
                "timestamp": datetime.now().isoformat(),
                "post_count": len(all_posts),
                "posts": all_posts
            }, f, indent=2)
        logger.info(f"Cached {len(all_posts)} Reddit posts")
    except Exception as e:
        logger.error(f"Error saving Reddit cache: {e}")

if __name__ == "__main__":
    # This code runs when the script is executed directly
    print("Reddit Monitor Test")
    posts = fetch_reddit_posts(limit=5)
    print(f"Fetched {len(posts)} posts")
    
    # Test keyword search
    keyword_posts = search_reddit_for_keywords(["marketing", "strategy"], limit=3)
    print(f"Found {len(keyword_posts)} posts matching keywords")
    
    # Print a sample post
    if posts:
        sample = posts[0]
        print("\nSample post:")
        print(f"Title: {sample.get('title')}")
        print(f"Subreddit: r/{sample.get('subreddit')}")
        print(f"Score: {sample.get('score')}")
        print(f"Comments: {sample.get('num_comments')}")
        print(f"URL: {sample.get('url')}") 
 