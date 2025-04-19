# Perception Layer

The Perception Layer allows agents to query trends, news, and insights from the real world, and to proactively collect fresh data when needed.

## Overview

The perception layer consists of several components:

1. **RSS Feed Monitoring** - Collects data from configurable RSS feeds
2. **Reddit Monitoring** - Collects posts from Reddit
3. **Perception Interpreter** - Parses natural language queries about trends and news
4. **Data Collector** - Handles on-demand data collection from various sources
5. **Perception Tools** - Provides an API for agents to query the perception layer

## Agent Tools

Agents can use the following tools to interact with the perception layer:

### Query Tools

These tools allow agents to query existing perception data:

- `query_perception(query: str)` - Process natural language queries about trends and news
- `get_trending_topics(domain: str = "")` - Get trending topics in a specific domain
- `get_latest_news(topic: str)` - Get the latest news about a specific topic
- `get_domain_insights(domain: str)` - Get insights about a specific domain
- `summarize_news(topic: str)` - Get a summary of news about a specific topic

### Data Collection Tools

These tools allow agents to actively collect fresh data:

- `collect_new_data(topic: str, keywords: str = "", discord_webhook: str = "")` - Proactively collect fresh data
- `check_data_collection(task_id: str)` - Check the status of a data collection task
- `get_data_collection_report(task_id: str)` - Get a detailed report from a completed task
- `research_and_analyze(topic: str, keywords: str = "")` - Collect, wait for, and analyze data in one step

## Usage Examples

### Querying Perception Data

```python
from apps.agents.shared.tools.cmo_tools import query_perception

# Query for trending topics
result = query_perception("What's trending in marketing this week?")
print(result)

# Query for latest news
result = query_perception("Latest news about AI translation?")
print(result)
```

### Collecting Fresh Data

```python
from apps.agents.shared.tools.cmo_tools import collect_new_data, check_data_collection, get_data_collection_report

# Start data collection
task_id = collect_new_data(
    topic="language challenges",
    keywords="language barriers, translation issues, communication problems"
)
print(f"Task ID: {task_id}")

# Check status
status = check_data_collection(task_id)
print(f"Status: {status}")

# Get report
report = get_data_collection_report(task_id)
print(f"Report: {report}")
```

### All-in-One Research

```python
from apps.agents.shared.tools.cmo_tools import research_and_analyze

# Collect and analyze in one step
result = research_and_analyze(
    topic="voice technology",
    keywords="speech recognition, voice assistants, natural language"
)
print(result)
```

## Testing

To test the perception layer, you can use the provided test scripts:

- `test_perception_query.py` - Tests the query functionality
- `test_proactive_collection.py` - Tests proactive data collection
- `test_cmo_tools_perception.py` - Tests the CMO tools integration

### Handling NumPy Issues on Windows

On Windows with Python 3.13+, you might encounter NumPy warnings or issues due to the NumPy dependency in the episodic_memory module. To handle this:

1. Filter NumPy warnings:

```python
import warnings
warnings.filterwarnings("ignore", category=RuntimeWarning)
```

2. For testing, you can mock the episodic_memory module:

```python
from unittest.mock import MagicMock
import sys

# Mock the episodic_memory module to avoid NumPy dependency
sys.modules['apps.agents.shared.memory.episodic_memory'] = MagicMock()
sys.modules['apps.agents.shared.memory.episodic_memory'].store_memory = lambda *args, **kwargs: True
```

3. When running in production, ensure NumPy is correctly installed for your Python version.

## Data Collection Process

When a data collection task is started:

1. A unique task ID is generated and returned to the caller
2. The system starts collecting data from configured sources in the background
3. The task status can be checked using the task ID
4. Once completed, a report can be generated from the collected data

The data collection process is designed to be asynchronous, allowing the agent to perform other tasks while data is being collected.

## Notification System

The perception layer includes a notification system that can alert you when data collection tasks are completed. This is particularly useful for long-running tasks.

### Discord Notifications

To enable Discord notifications:

1. Create a webhook in your Discord server (Server Settings → Integrations → Webhooks → New Webhook)
2. Add the webhook URL to your `.env` file:
   ```
   DISCORD_WEBHOOK_URL=your_discord_webhook_url
   ```
3. Ensure `ENABLE_AUTO_NOTIFICATIONS=1` is set in your `.env` file (this is the default)

### Automatic Notification Intent Detection

The system includes automatic notification intent detection that works as follows:

1. When an agent responds with phrases like "I'll notify you" or "I'll let you know", the system automatically detects this as notification intent
2. If notification intent is detected, a Discord notification will be sent when the task completes (if a webhook URL is configured)
3. No additional configuration is needed - the agent's message is automatically analyzed

Example messages that trigger notification intent:
- "I'll notify you when it's complete"
- "I will let you know when the data is ready"
- "You'll be notified once the task is finished"
- "I'll ping you when it's done"

### Manual Notification Configuration

You can also manually configure notifications when calling the data collection tools:

```python
from apps.agents.shared.tools.cmo_tools import collect_new_data

# With manual Discord notification
result = collect_new_data(
    topic="language barriers",
    keywords="translation issues, communication problems",
    discord_webhook="https://discord.com/api/webhooks/your-webhook-url"
)
```

## Configuration

The perception layer can be configured by modifying the following files:

- `apps/agents/shared/perception/data/rss_feeds.json` - RSS feed configuration
- `apps/agents/shared/perception/data/reddit_config.json` - Reddit API configuration
- `.env` - Environment variables including notification settings 
 