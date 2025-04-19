"""
Test script demonstrating how to use the CMO tools for perception queries and data collection.
This test showcases how agents can use these tools to query trends and collect data.
"""
import os
import sys
import time
import warnings
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add the project root to the path
ROOT_DIR = Path(__file__).parent.parent.parent
sys.path.append(str(ROOT_DIR))
print(f"Added {ROOT_DIR} to path")

# Filter NumPy warnings
warnings.filterwarnings("ignore", category=RuntimeWarning)
warnings.filterwarnings("ignore", category=DeprecationWarning)

# Mock the episodic_memory to avoid NumPy issues
sys.modules['apps.agents.shared.memory.episodic_memory'] = MagicMock()
sys.modules['apps.agents.shared.memory.episodic_memory'].store_memory = lambda *args, **kwargs: True

# Create mock implementations for perception functions
def mock_handle_perception_query(query):
    """Mock handler for perception queries."""
    print(f"MOCK: Handling perception query: {query}")
    
    if "trending" in query.lower():
        return """
## Trending Topics in Technology

Based on the latest data, here are the top trends in technology:

1. **AI-assisted coding** (35% of news coverage)
   - GitHub Copilot expands to new languages
   - Google DeepMind announces new developer tools

2. **Voice technology** (22% of news coverage)
   - Advances in natural language processing
   - Multilingual voice assistants gaining traction

3. **Quantum computing** (18% of news coverage)
   - IBM announces new quantum processor
   - Google achieves quantum supremacy milestone

4. **Augmented reality** (15% of news coverage)
   - New AR headsets for enterprise applications
   - Mobile AR applications grow in popularity

5. **Sustainable tech** (10% of news coverage)
   - Green data centers reduce carbon footprint
   - Eco-friendly electronics manufacturing
"""
    elif "news" in query.lower() or "latest" in query.lower():
        return """
## Latest News on Voice Technology

Recent developments in voice technology:

1. **Google Enhances Multilingual Voice Recognition**
   - Support for 25 new languages added
   - Improved accuracy for non-native speakers

2. **Amazon Alexa Gets Major Upgrade**
   - New natural conversation capabilities
   - Better handling of complex queries

3. **Stanford Research on Voice Biometrics**
   - Voice patterns used for secure authentication
   - 99.8% accuracy in identifying unique speakers

4. **Voice Search Optimization Trends**
   - Companies adapting SEO for voice queries
   - Voice commerce expected to grow 40% next year
"""
    else:
        return f"Here is the information you requested about {query}"

def mock_collect_data(topic, keywords=None, sources=None, **kwargs):
    """Mock data collection function."""
    print(f"MOCK: Collecting data on '{topic}' with keywords {keywords}")
    return f"task_{int(time.time())}"

def mock_get_task_status(task_id):
    """Mock function to get task status."""
    print(f"MOCK: Checking status of task {task_id}")
    return {
        "task_id": task_id,
        "status": "completed",
        "summary": "Successfully collected and analyzed data."
    }

def mock_generate_report(task_id):
    """Mock function to generate report."""
    print(f"MOCK: Generating report for task {task_id}")
    return """
## Data Collection Report

### Summary
Successfully collected information about language challenges from multiple sources.

### Sources
- RSS Feeds: 12 relevant articles found
- Reddit: 8 relevant posts found

### Key Insights
1. Language barriers remain a significant challenge in global business
2. Machine translation tools are improving but still have limitations
3. Cultural context is often lost in automated translation
4. Voice-based translation is becoming more popular for tourism

### Sample Data
- "New Study Shows 42% of International Teams Struggle with Language Barriers"
- "Google Translator Adds Support for 5 New Languages"
- "Cultural Misunderstandings Cost Companies Millions, Survey Finds"
"""

# Apply mocks
patches = [
    patch('apps.agents.shared.perception.perception_interpreter.handle_perception_query', 
          side_effect=mock_handle_perception_query),
    patch('apps.agents.shared.perception.data_collector.collect_data', 
          side_effect=mock_collect_data),
    patch('apps.agents.shared.perception.data_collector.get_task_status', 
          side_effect=mock_get_task_status),
    patch('apps.agents.shared.perception.data_collector.generate_report_from_task', 
          side_effect=mock_generate_report)
]

# Start all patches
for p in patches:
    p.start()

try:
    # Import the tools module - just grabbing the functions, not the decorated LangChain tools
    print("\nImporting perception and data collection functions...")
    from apps.agents.shared.tools.perception_tools import PerceptionTools
    print("✅ Successfully imported PerceptionTools")
    
    # Test functions directly
    print("\n=== TESTING PERCEPTION TOOLS DIRECTLY ===")
    
    # Test trend querying
    print("\n1. Querying trending topics in technology...")
    result = PerceptionTools.query_perception("What's trending in technology this week?")
    print(f"\nRESULT:\n{result}")
    
    # Test data collection
    print("\n2. Collecting new data on language challenges...")
    keywords_list = ["language barriers", "translation problems"]
    task_id = PerceptionTools.trigger_data_collection(
        topic="language challenges", 
        keywords=keywords_list
    )
    print(f"Task ID: {task_id}")
    
    # Check status
    print("\n3. Checking data collection status...")
    status = PerceptionTools.check_collection_status(task_id)
    print(f"Status: {status}")
    
    # Get report
    print("\n4. Getting data collection report...")
    report = PerceptionTools.get_collection_report(task_id)
    print(f"\nReport:\n{report}")
    
    # Test all-in-one research
    print("\n5. Testing research and analysis...")
    analysis = PerceptionTools.collect_and_analyze(
        topic="voice technology",
        keywords=["speech recognition", "voice assistants"]
    )
    print(f"\nAnalysis:\n{analysis}")
    
    print("\n✅ All perception tools tested successfully")
    
except Exception as e:
    print(f"\n❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()

# Stop all patches
for p in patches:
    p.stop()

print("\nTest completed")

if __name__ == "__main__":
    print("Running as main module") 