"""
RSS Monitor Module

This module monitors relevant RSS feeds for marketing, technology, and industry news.
It retrieves headlines and summaries, tags content, and stores insights into Chloe's memory system.
"""
import feedparser
import json
import time
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
import re

# Import memory modules to store insights
try:
    from apps.agents.shared.memory.episodic_memory import store_memory
except ImportError:
    print("Warning: Could not import episodic_memory module. Using mock implementation.")
    def store_memory(content, context=None, tags=None, importance=0.5):
        print(f"[MOCK] Storing memory: {content[:50]}... with tags {tags}")
        return {"id": "mock_memory_id", "content": content}

# Default RSS feeds to monitor - marketing and technology focused
DEFAULT_FEEDS = [
    {
        "name": "Marketing Land",
        "url": "https://marketingland.com/feed",
        "tags": ["marketing_news", "industry"]
    },
    {
        "name": "TechCrunch",
        "url": "https://techcrunch.com/feed/",
        "tags": ["tech_news", "industry", "startup"]
    },
    {
        "name": "AdWeek",
        "url": "https://www.adweek.com/feed/",
        "tags": ["advertising", "marketing_news"]
    },
    {
        "name": "HubSpot Marketing Blog",
        "url": "https://blog.hubspot.com/marketing/rss.xml",
        "tags": ["marketing_strategies", "inbound"]
    },
    {
        "name": "Content Marketing Institute",
        "url": "https://contentmarketinginstitute.com/feed/",
        "tags": ["content_marketing", "strategy"]
    }
]

# Path to store the latest retrieved headlines
DATA_DIR = Path("apps/agents/shared/perception/data")
HEADLINES_FILE = DATA_DIR / "latest_headlines.json"

def ensure_data_dir():
    """Ensure the data directory exists."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

def extract_keywords(text: str) -> List[str]:
    """
    Extract potential keywords from article title or description.
    
    Args:
        text: The text to extract keywords from
    
    Returns:
        List of extracted keywords
    """
    # Common marketing terms to detect
    marketing_terms = [
        "ai", "artificial intelligence", "marketing", "social media", "analytics",
        "seo", "content", "email", "campaign", "brand", "digital", "advertising",
        "strategy", "conversion", "customer", "engagement", "metrics", "roi",
        "data", "trend", "growth", "audience", "platform", "revenue", "traffic"
    ]
    
    # Lowercase the text for matching
    lower_text = text.lower()
    
    # Find all matches
    matches = []
    for term in marketing_terms:
        if term in lower_text:
            # Convert multi-word terms to snake_case for tags
            tag_term = term.replace(" ", "_")
            matches.append(tag_term)
    
    return matches

def fetch_feeds(feeds: List[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """
    Fetch items from the specified RSS feeds.
    
    Args:
        feeds: List of feed dictionaries with name, url, and tags keys
              If None, uses DEFAULT_FEEDS
    
    Returns:
        List of processed feed entries with additional metadata
    """
    if feeds is None:
        feeds = DEFAULT_FEEDS
    
    all_entries = []
    
    for feed_info in feeds:
        try:
            feed_data = feedparser.parse(feed_info["url"])
            source_name = feed_info["name"]
            base_tags = feed_info.get("tags", [])
            
            for entry in feed_data.entries[:10]:  # Limit to 10 most recent entries
                # Extract basic info
                title = entry.get("title", "No title")
                summary = entry.get("summary", entry.get("description", "No description"))
                link = entry.get("link", "")
                
                # Get publication date
                published = entry.get("published", entry.get("pubDate", ""))
                if not published:
                    published = datetime.now().isoformat()
                
                # Clean up summary (remove HTML)
                summary = re.sub(r'<[^>]+>', '', summary)
                
                # Extract additional keywords from title and summary
                content_text = f"{title} {summary}"
                keywords = extract_keywords(content_text)
                
                # Combine base tags with extracted keywords
                all_tags = base_tags + keywords
                
                # Create processed entry
                processed_entry = {
                    "title": title,
                    "summary": summary[:200] + "..." if len(summary) > 200 else summary,
                    "link": link,
                    "source": source_name,
                    "published": published,
                    "retrieved": datetime.now().isoformat(),
                    "tags": list(set(all_tags))  # Remove duplicates
                }
                
                all_entries.append(processed_entry)
                
        except Exception as e:
            print(f"Error fetching feed {feed_info['name']}: {str(e)}")
    
    return all_entries

def store_headlines(entries: List[Dict[str, Any]]) -> None:
    """
    Store the latest headlines in a JSON file.
    
    Args:
        entries: List of processed feed entries
    """
    ensure_data_dir()
    
    data = {
        "last_updated": datetime.now().isoformat(),
        "count": len(entries),
        "entries": entries
    }
    
    with open(HEADLINES_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

def get_latest_headlines(max_age_hours: int = 24) -> List[Dict[str, Any]]:
    """
    Get the latest headlines, fetching new ones if the existing data is too old.
    
    Args:
        max_age_hours: Maximum age in hours before refreshing
        
    Returns:
        List of headline entries
    """
    ensure_data_dir()
    
    # Check if we have recent data
    if HEADLINES_FILE.exists():
        try:
            with open(HEADLINES_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            last_updated = datetime.fromisoformat(data["last_updated"])
            age_hours = (datetime.now() - last_updated).total_seconds() / 3600
            
            if age_hours < max_age_hours:
                return data["entries"]
        except (json.JSONDecodeError, KeyError, ValueError):
            # If file is corrupted or format changed, we'll fetch new data
            pass
    
    # Fetch fresh data
    entries = fetch_feeds()
    store_headlines(entries)
    return entries

def load_custom_feeds(file_path: str) -> List[Dict[str, Any]]:
    """
    Load custom feed configurations from a JSON file.
    
    Args:
        file_path: Path to JSON file with feed configurations
        
    Returns:
        List of feed configurations
    """
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError) as e:
        print(f"Error loading custom feeds: {str(e)}")
        return DEFAULT_FEEDS

def headline_to_memory(entry: Dict[str, Any], store: bool = True) -> Dict[str, Any]:
    """
    Convert a headline entry to a memory and optionally store it.
    
    Args:
        entry: The headline entry to convert
        store: Whether to store the memory
        
    Returns:
        The created memory entry
    """
    # Format content for memory
    content = f"News from {entry['source']}: {entry['title']}"
    context = f"Summary: {entry['summary']}\nLink: {entry['link']}\nPublished: {entry['published']}"
    
    # Use headline tags plus news_item tag
    tags = entry['tags'] + ["news_item"]
    
    # Calculate importance based on matching keywords (more matches = higher importance)
    importance = min(0.5 + (len(entry['tags']) * 0.05), 0.9)
    
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

def store_all_headlines_as_memories(max_entries: int = 5) -> List[Dict[str, Any]]:
    """
    Store the most recent headlines as memories.
    
    Args:
        max_entries: Maximum number of entries to store
        
    Returns:
        List of created memory entries
    """
    headlines = get_latest_headlines()
    
    # Sort by date if available (newest first)
    try:
        headlines.sort(key=lambda x: x.get('published', ''), reverse=True)
    except:
        pass
    
    # Limit to max_entries
    headlines = headlines[:max_entries]
    
    memories = []
    for entry in headlines:
        memory = headline_to_memory(entry)
        memories.append(memory)
    
    return memories

def get_headlines_summary() -> str:
    """
    Generate a human-readable summary of recent headlines.
    
    Returns:
        Formatted string summarizing recent headlines
    """
    headlines = get_latest_headlines()
    
    if not headlines:
        return "No recent headlines available."
    
    # Group by source
    sources = {}
    for entry in headlines:
        source = entry['source']
        if source not in sources:
            sources[source] = []
        sources[source].append(entry)
    
    # Format the summary
    summary = "# Recent Marketing & Tech Headlines\n\n"
    summary += f"*Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M')}*\n\n"
    
    for source, entries in sources.items():
        summary += f"## {source}\n\n"
        for entry in entries[:3]:  # Top 3 from each source
            summary += f"- **{entry['title']}**\n"
            summary += f"  {entry['summary']}\n"
            summary += f"  [Read more]({entry['link']})\n\n"
    
    return summary

if __name__ == "__main__":
    # Run a simple test when executed directly
    print("RSS Monitor Test")
    print("===============")
    
    print("Fetching headlines...")
    headlines = get_latest_headlines()
    print(f"Retrieved {len(headlines)} headlines")
    
    print("\nSample headlines:")
    for i, headline in enumerate(headlines[:3]):
        print(f"\n{i+1}. {headline['title']} ({headline['source']})")
        print(f"   Tags: {', '.join(headline['tags'])}")
        print(f"   {headline['summary']}")
    
    print("\nConverting headlines to memories...")
    memories = store_all_headlines_as_memories(max_entries=3)
    print(f"Created {len(memories)} memories")
    
    print("\nSummary of headlines:")
    summary = get_headlines_summary()
    print(summary[:500] + "..." if len(summary) > 500 else summary) 
 