"""
Social Media Monitor Module

This module monitors social media platforms (primarily Twitter/X) for mentions of relevant
marketing topics, competitor information, and brand mentions.
Uses snscrape to get data without requiring authentication.
"""
import json
import os
import subprocess
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional

# Import memory modules to store insights
try:
    from apps.agents.shared.memory.episodic_memory import store_memory
except ImportError:
    print("Warning: Could not import episodic_memory module. Using mock implementation.")
    def store_memory(content, context=None, tags=None, importance=0.5):
        print(f"[MOCK] Storing memory: {content[:50]}... with tags {tags}")
        return {"id": "mock_memory_id", "content": content}

# Path to store the latest social media data
DATA_DIR = Path("apps/agents/shared/perception/data")
SOCIAL_DATA_FILE = DATA_DIR / "latest_social_data.json"

# Default topics to monitor
DEFAULT_TOPICS = [
    {"query": "AI marketing", "tags": ["ai", "marketing", "technology"]},
    {"query": "content marketing trends", "tags": ["content_marketing", "trends"]},
    {"query": "social media strategy", "tags": ["social_media", "strategy"]},
    {"query": "email marketing", "tags": ["email_marketing"]},
    {"query": "marketing analytics", "tags": ["analytics", "data_driven"]}
]

def ensure_data_dir():
    """Ensure the data directory exists."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

def run_snscrape(topic: str, limit: int = 10, days_back: int = 3) -> List[Dict[str, Any]]:
    """
    Run snscrape to get recent tweets on a topic.
    
    Args:
        topic: The search query
        limit: Maximum number of tweets to return
        days_back: How many days back to search
    
    Returns:
        List of tweet data dictionaries
    """
    since_date = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d")
    
    # Craft the snscrape command
    cmd = [
        "snscrape",
        "--jsonl",
        f"--since={since_date}",
        f"--max-results={limit}",
        "twitter-search",
        f"{topic}"
    ]
    
    results = []
    try:
        # Execute the command and capture output
        process = subprocess.run(
            cmd, 
            capture_output=True, 
            text=True, 
            check=False
        )
        
        if process.returncode != 0:
            print(f"Warning: snscrape exited with code {process.returncode}")
            print(f"Error: {process.stderr}")
            # Try a graceful fallback - sometimes snscrape returns data even with errors
            if not process.stdout:
                return results
        
        # Process each line of the output
        for line in process.stdout.strip().split('\n'):
            if line:
                try:
                    tweet_data = json.loads(line)
                    # Extract just the fields we need
                    tweet = {
                        "id": tweet_data.get("id", ""),
                        "date": tweet_data.get("date", ""),
                        "content": tweet_data.get("content", ""),
                        "username": tweet_data.get("user", {}).get("username", ""),
                        "user_verified": tweet_data.get("user", {}).get("verified", False),
                        "retweet_count": tweet_data.get("retweetCount", 0),
                        "like_count": tweet_data.get("likeCount", 0),
                        "url": tweet_data.get("url", ""),
                        "topic": topic
                    }
                    results.append(tweet)
                except json.JSONDecodeError:
                    continue
    except Exception as e:
        print(f"Error running snscrape: {str(e)}")
        # If snscrape fails, provide mock data for testing
        if os.environ.get("CHLOE_DEV_MODE") == "1":
            print("Using mock social data for development")
            return generate_mock_tweets(topic, limit)
    
    return results

def generate_mock_tweets(topic: str, count: int = 5) -> List[Dict[str, Any]]:
    """
    Generate mock tweet data for development/testing.
    
    Args:
        topic: Topic to generate tweets about
        count: Number of mock tweets to generate
    
    Returns:
        List of mock tweet dictionaries
    """
    mock_tweets = []
    
    # Sample usernames for mock data
    usernames = ["marketingpro", "digitaltrends", "techmarketers", "contentcreator", "brandfocus"]
    
    # Sample tweet templates
    templates = [
        "Just saw a great article on {topic}. This is going to change everything!",
        "Has anyone implemented {topic} strategies in their business? Looking for advice.",
        "Our latest blog post on {topic} got amazing engagement. Check it out!",
        "Interesting debate on {topic} happening right now. What's your take?",
        "New research shows {topic} effectiveness up by 23% this quarter. #MarketingInsights",
        "Just attended a webinar on {topic}. Here are my key takeaways: 1) Start small 2) Measure everything",
        "The future of {topic} looks promising. Early adopters will win big in 2023."
    ]
    
    # Generate mock tweets
    for i in range(count):
        tweet_text = templates[i % len(templates)].format(topic=topic)
        
        # Create mock tweet data
        mock_tweet = {
            "id": f"mock_{int(time.time())}_{i}",
            "date": (datetime.now() - timedelta(hours=i*3)).isoformat(),
            "content": tweet_text,
            "username": usernames[i % len(usernames)],
            "user_verified": i % 3 == 0,  # Every third user is verified
            "retweet_count": i * 5,
            "like_count": i * 12,
            "url": f"https://twitter.com/{usernames[i % len(usernames)]}/status/mock_{i}",
            "topic": topic
        }
        
        mock_tweets.append(mock_tweet)
    
    return mock_tweets

def fetch_topics(topics: List[Dict[str, Any]] = None, limit_per_topic: int = 5) -> Dict[str, List[Dict[str, Any]]]:
    """
    Fetch social media data for specified topics.
    
    Args:
        topics: List of topic dictionaries with query and tags keys
        limit_per_topic: Maximum number of tweets per topic
    
    Returns:
        Dictionary mapping topics to lists of tweet data
    """
    if topics is None:
        topics = DEFAULT_TOPICS
    
    results = {}
    
    for topic_info in topics:
        query = topic_info["query"]
        print(f"Fetching social data for: {query}")
        
        try:
            tweets = run_snscrape(query, limit=limit_per_topic)
            
            # Add tags from the topic definition to each tweet
            for tweet in tweets:
                tweet["tags"] = topic_info.get("tags", [])
            
            results[query] = tweets
        except Exception as e:
            print(f"Error fetching social data for {query}: {str(e)}")
            results[query] = []
    
    return results

def store_social_data(data: Dict[str, List[Dict[str, Any]]]) -> None:
    """
    Store social media data in a JSON file.
    
    Args:
        data: Dictionary of social media data by topic
    """
    ensure_data_dir()
    
    # Flatten topics into a single list of tweets
    all_tweets = []
    for topic, tweets in data.items():
        all_tweets.extend(tweets)
    
    # Sort by date (newest first)
    all_tweets.sort(key=lambda x: x.get("date", ""), reverse=True)
    
    # Prepare data structure
    output_data = {
        "last_updated": datetime.now().isoformat(),
        "count": len(all_tweets),
        "entries": all_tweets
    }
    
    # Save to file
    with open(SOCIAL_DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2)

def get_latest_social_data(max_age_hours: int = 24) -> List[Dict[str, Any]]:
    """
    Get latest social media data, fetching new data if existing data is too old.
    
    Args:
        max_age_hours: Maximum age in hours before refreshing
    
    Returns:
        List of social media entries
    """
    ensure_data_dir()
    
    # Check if we have recent data
    if SOCIAL_DATA_FILE.exists():
        try:
            with open(SOCIAL_DATA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            last_updated = datetime.fromisoformat(data["last_updated"])
            age_hours = (datetime.now() - last_updated).total_seconds() / 3600
            
            if age_hours < max_age_hours:
                return data["entries"]
        except (json.JSONDecodeError, KeyError, ValueError):
            # If file is corrupted or format changed, we'll fetch new data
            pass
    
    # Fetch fresh data
    topic_data = fetch_topics()
    store_social_data(topic_data)
    
    # Flatten the topics into a single list
    all_tweets = []
    for topic, tweets in topic_data.items():
        all_tweets.extend(tweets)
    
    return all_tweets

def calculate_tweet_importance(tweet: Dict[str, Any]) -> float:
    """
    Calculate the importance of a tweet based on various factors.
    
    Args:
        tweet: Tweet data dictionary
        
    Returns:
        Importance score (0.0 to 1.0)
    """
    # Start with base importance
    importance = 0.5
    
    # Adjust based on engagement metrics
    engagement = tweet.get("retweet_count", 0) + tweet.get("like_count", 0)
    if engagement > 1000:
        importance += 0.3
    elif engagement > 500:
        importance += 0.2
    elif engagement > 100:
        importance += 0.1
    
    # Verified users are slightly more important
    if tweet.get("user_verified", False):
        importance += 0.05
    
    # Cap at 0.95
    return min(importance, 0.95)

def tweet_to_memory(tweet: Dict[str, Any], store: bool = True) -> Dict[str, Any]:
    """
    Convert a tweet to a memory and optionally store it.
    
    Args:
        tweet: Tweet data dictionary
        store: Whether to store in memory
        
    Returns:
        Memory entry dictionary
    """
    # Format content for memory
    content = f"Tweet from @{tweet['username']}: {tweet['content']}"
    
    # Create context with additional information
    context = (
        f"Topic: {tweet['topic']}\n"
        f"Date: {tweet['date']}\n"
        f"Engagement: {tweet.get('retweet_count', 0)} retweets, {tweet.get('like_count', 0)} likes\n"
        f"URL: {tweet['url']}"
    )
    
    # Use tweet tags plus social_mention tag
    tags = tweet.get('tags', []) + ["social_mention", "twitter"]
    
    # Calculate importance
    importance = calculate_tweet_importance(tweet)
    
    if store:
        memory = store_memory(
            content=content,
            context=context,
            tags=tags,
            importance=importance
        )
        return memory
    else:
        # Mock memory object if not storing
        return {
            "id": f"mock_{int(time.time())}",
            "content": content,
            "context": context,
            "tags": tags,
            "importance": importance,
            "created_at": datetime.now().isoformat()
        }

def store_social_mentions_as_memories(max_entries: int = 5) -> List[Dict[str, Any]]:
    """
    Store the most relevant social mentions as memories.
    
    Args:
        max_entries: Maximum number of mentions to store
        
    Returns:
        List of created memory entries
    """
    # Get latest social data
    social_data = get_latest_social_data()
    
    # Sort by calculated importance (highest first)
    social_data.sort(key=calculate_tweet_importance, reverse=True)
    
    # Limit to max_entries
    social_data = social_data[:max_entries]
    
    # Store as memories
    memories = []
    for tweet in social_data:
        memory = tweet_to_memory(tweet)
        memories.append(memory)
    
    return memories

def get_social_insights() -> str:
    """
    Generate a human-readable summary of social media insights.
    
    Returns:
        Formatted string summarizing social media trends
    """
    social_data = get_latest_social_data()
    
    if not social_data:
        return "No recent social media data available."
    
    # Group by topic
    topics = {}
    for tweet in social_data:
        topic = tweet.get("topic", "Other")
        if topic not in topics:
            topics[topic] = []
        topics[topic].append(tweet)
    
    # Format the summary
    summary = "# Recent Social Media Insights\n\n"
    summary += f"*Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M')}*\n\n"
    
    for topic, tweets in topics.items():
        # Sort by engagement
        tweets.sort(key=lambda x: x.get("retweet_count", 0) + x.get("like_count", 0), reverse=True)
        
        summary += f"## Topic: {topic}\n\n"
        
        # Show top 3 tweets by engagement
        for tweet in tweets[:3]:
            engagement = tweet.get("retweet_count", 0) + tweet.get("like_count", 0)
            summary += f"- **@{tweet['username']}** ({engagement} engagements):\n"
            summary += f"  \"{tweet['content']}\"\n"
            summary += f"  [View Tweet]({tweet['url']})\n\n"
        
        # Add simple analysis
        if len(tweets) > 0:
            avg_engagement = sum(t.get("retweet_count", 0) + t.get("like_count", 0) for t in tweets) / len(tweets)
            summary += f"*Average engagement: {avg_engagement:.1f} per tweet*\n\n"
    
    return summary

def load_custom_topics(file_path: str) -> List[Dict[str, Any]]:
    """
    Load custom topic configurations from a JSON file.
    
    Args:
        file_path: Path to the JSON file
        
    Returns:
        List of topic configurations
    """
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError) as e:
        print(f"Error loading custom topics: {str(e)}")
        return DEFAULT_TOPICS

if __name__ == "__main__":
    # Run a simple test when executed directly
    print("Social Monitor Test")
    print("==================")
    
    # Set dev mode for testing (uses mock data if snscrape fails)
    os.environ["CHLOE_DEV_MODE"] = "1"
    
    print("Fetching social data...")
    social_data = get_latest_social_data()
    print(f"Retrieved {len(social_data)} social media mentions")
    
    print("\nSample mentions:")
    for i, tweet in enumerate(social_data[:3]):
        print(f"\n{i+1}. @{tweet['username']}: {tweet['content']}")
        print(f"   Topic: {tweet['topic']}")
        print(f"   Engagement: {tweet.get('retweet_count', 0)} retweets, {tweet.get('like_count', 0)} likes")
    
    print("\nConverting mentions to memories...")
    memories = store_social_mentions_as_memories(max_entries=3)
    print(f"Created {len(memories)} memories")
    
    print("\nSocial insights summary:")
    insights = get_social_insights()
    print(insights[:500] + "..." if len(insights) > 500 else insights) 