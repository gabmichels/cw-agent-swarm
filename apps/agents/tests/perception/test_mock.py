"""
Test file that mocks the data collection functionality to demonstrate the interface.
"""
import os
import sys
import uuid
import json
import time
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add the project root to the path
ROOT_DIR = Path(__file__).parent.parent.parent
sys.path.append(str(ROOT_DIR))
print(f"Added {ROOT_DIR} to path")

# Mock data collection functions
def mock_collect_data(topic, keywords=None, sources=None, **kwargs):
    """Mock implementation of collect_data that returns a task ID."""
    print(f"MOCK: Collecting data on '{topic}' with keywords {keywords}")
    task_id = str(uuid.uuid4())
    
    # Create a simulated task in the collection log
    task = {
        "task_id": task_id,
        "topic": topic,
        "keywords": keywords or [],
        "sources": sources or ["rss", "reddit"],
        "status": "in_progress",
        "start_time": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    
    # Ensure data directory exists
    data_dir = Path(__file__).parent / "shared" / "perception" / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    
    # Save to collection log
    log_file = data_dir / "collection_log.json"
    
    if log_file.exists():
        try:
            with open(log_file, 'r', encoding='utf-8') as f:
                log_data = json.load(f)
        except:
            log_data = {"tasks": []}
    else:
        log_data = {"tasks": []}
    
    log_data["tasks"].append(task)
    
    with open(log_file, 'w', encoding='utf-8') as f:
        json.dump(log_data, f, indent=2)
    
    print(f"MOCK: Created task with ID: {task_id}")
    return task_id

def mock_get_task_status(task_id):
    """Mock implementation of get_task_status."""
    print(f"MOCK: Checking status of task {task_id}")
    
    # Simulate task completion after a delay
    # For the mock, we'll just mark it as completed immediately
    data_dir = Path(__file__).parent / "shared" / "perception" / "data"
    log_file = data_dir / "collection_log.json"
    
    if not log_file.exists():
        return None
    
    try:
        with open(log_file, 'r', encoding='utf-8') as f:
            log_data = json.load(f)
            
        for task in log_data.get("tasks", []):
            if task.get("task_id") == task_id:
                # Mark as completed for testing
                task["status"] = "completed"
                task["end_time"] = time.strftime("%Y-%m-%dT%H:%M:%S")
                task["summary"] = f"Successfully collected data about '{task.get('topic')}'"
                
                # Save the updated status
                with open(log_file, 'w', encoding='utf-8') as f:
                    json.dump(log_data, f, indent=2)
                
                return task
                
        return None
    except Exception as e:
        print(f"MOCK: Error checking task status: {e}")
        return None

def mock_generate_report(task_id):
    """Mock implementation of generate_report_from_task."""
    print(f"MOCK: Generating report for task {task_id}")
    
    # Generate a dummy report
    return f"""
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

Task ID: {task_id}
"""

# Set up the mocks
patches = [
    patch('apps.agents.shared.perception.data_collector.collect_data', side_effect=mock_collect_data),
    patch('apps.agents.shared.perception.data_collector.get_task_status', side_effect=mock_get_task_status),
    patch('apps.agents.shared.perception.data_collector.generate_report_from_task', side_effect=mock_generate_report)
]

# Apply all patches
for p in patches:
    p.start()

try:
    print("\nImporting PerceptionTools...")
    from apps.agents.shared.tools.perception_tools import PerceptionTools
    print("✅ Successfully imported PerceptionTools")
    
    # Test the data collection functionality
    print("\n=== TESTING DATA COLLECTION ===")
    
    # Step 1: Trigger data collection
    topic = "language challenges"
    keywords = ["language barriers", "translation problems"]
    
    print(f"\nCollecting data on: {topic}")
    print(f"Keywords: {', '.join(keywords)}")
    
    task_id = PerceptionTools.trigger_data_collection(
        topic=topic,
        keywords=keywords
    )
    
    print(f"\nTask ID: {task_id}")
    
    # Step 2: Check status
    print("\nChecking collection status...")
    status = PerceptionTools.check_collection_status(task_id)
    print(f"Status: {status}")
    
    # Step 3: Get report
    print("\nGetting collection report...")
    report = PerceptionTools.get_collection_report(task_id)
    print(f"\nReport:\n{report}")
    
    # Step 4: Test the all-in-one method
    print("\n=== TESTING ALL-IN-ONE COLLECTION AND ANALYSIS ===")
    result = PerceptionTools.collect_and_analyze(
        topic="voice technology",
        keywords=["speech recognition", "voice assistants"]
    )
    print(f"\nResult:\n{result}")
    
    print("\n✅ Successfully tested data collection functionality")
    
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