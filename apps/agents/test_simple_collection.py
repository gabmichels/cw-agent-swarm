"""
Test script to demonstrate automatic notification detection in the Perception Tools.
This script simulates a conversation with Chloe where she promises to notify the user.
"""

import os
import sys
import time
from pathlib import Path

# Add the parent directory to sys.path
current_dir = Path(__file__).parent
parent_dir = current_dir.parent
sys.path.append(str(parent_dir))

from shared.tools.perception_tools import PerceptionTools
from shared.config import DEFAULT_DISCORD_WEBHOOK, ENABLE_AUTO_NOTIFICATIONS

def test_simple_collection():
    """Test the simple data collection functionality"""
    print("Starting simple data collection test...")
    
    # Test topic
    topic = "language challenges"
    keywords = ["language barrier", "translation problems", "communication difficulty"]
    
    print(f"Collecting data on topic: {topic}")
    print(f"Using keywords: {keywords}")
    
    # Check if we have a default webhook configured
    if DEFAULT_DISCORD_WEBHOOK:
        print(f"Default Discord webhook is configured: {DEFAULT_DISCORD_WEBHOOK[:20]}...")
        print(f"Auto notifications enabled: {ENABLE_AUTO_NOTIFICATIONS}")
    else:
        print("No default Discord webhook configured")
    
    # Test with notification intent in message
    response_message = "I'll notify you when I've collected all the data on language challenges."
    
    # Trigger data collection with the response message
    task_id, message = PerceptionTools.trigger_data_collection(
        topic=topic,
        keywords=keywords,
        response_message=response_message
    )
    
    print(f"Task started with ID: {task_id}")
    print(f"Response: {message}")
    
    # Wait for collection to complete
    print("Waiting for collection to complete...")
    max_wait = 30  # Max wait in seconds
    start_time = time.time()
    
    while time.time() - start_time < max_wait:
        status = PerceptionTools.check_collection_status(task_id)
        print(f"Status: {status}")
        
        if "completed" in status.lower():
            # Get the report
            report = PerceptionTools.get_collection_report(task_id)
            print("\nCollection Report:")
            print(report)
            break
            
        time.sleep(5)  # Check every 5 seconds
    else:
        print("Collection did not complete within the timeout period")

if __name__ == "__main__":
    test_simple_collection() 
 