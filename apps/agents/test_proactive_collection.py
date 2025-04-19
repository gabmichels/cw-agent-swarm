"""
Test script for proactive data collection capabilities.

This script demonstrates how Chloe can actively collect and analyze data
about specific topics, rather than just relying on existing cached data.
"""
import os
import sys
import time
from pathlib import Path

# Add the project root to the path
ROOT_DIR = Path(__file__).parent.parent.parent
sys.path.append(str(ROOT_DIR))

# Import the perception tools
from apps.agents.shared.tools.perception_tools import PerceptionTools

def test_proactive_collection():
    """Test the proactive data collection capabilities."""
    
    print("\n=== PROACTIVE DATA COLLECTION TEST ===")
    print("This demonstrates how Chloe can actively fetch and analyze fresh data.")
    print("This simulates the capability to 'bring yourself up to speed' on a topic.\n")
    
    # Test topic - as requested by the user
    topic = "language challenges"
    keywords = ["language barrier", "translation problems", "communication difficulty"]
    
    print(f"🔍 COLLECTING DATA ON: {topic}")
    print(f"📋 KEYWORDS: {', '.join(keywords)}")
    print("-" * 50)
    
    # Step 1: Trigger data collection
    try:
        task_id = PerceptionTools.trigger_data_collection(
            topic=topic,
            keywords=keywords,
            notify_discord=False
        )
        
        print(f"✅ Started data collection with task ID: {task_id}")
        print("\nWaiting for data collection to complete...")
        
        # Step 2: Wait for completion
        for i in range(1, 13):  # Check for up to 1 minute
            status = PerceptionTools.check_collection_status(task_id)
            
            if "complete" in status.lower():
                print(f"\n✅ Data collection complete!")
                break
            elif "failed" in status.lower():
                print(f"\n❌ Data collection failed!")
                break
                
            print(f"Still collecting data... ({i*5}s)")
            time.sleep(5)
        
        # Step 3: Get the report
        print("\n📊 FINAL REPORT:")
        print("-" * 50)
        report = PerceptionTools.get_collection_report(task_id)
        print(report)
        
    except Exception as e:
        print(f"Error during proactive data collection: {str(e)}")
    
    # Alternative: Use the all-in-one method
    print("\n\n=== ALL-IN-ONE RESEARCH AND ANALYSIS ===")
    print("This demonstrates the simplified research_and_analyze function.\n")
    
    try:
        result = PerceptionTools.collect_and_analyze(
            topic="voice technology challenges",
            keywords=["speech recognition", "voice assistant problems", "accent detection"],
            timeout_seconds=60
        )
        
        print(result)
        
    except Exception as e:
        print(f"Error during research and analysis: {str(e)}")
    
    print("\n=== TEST COMPLETE ===")

if __name__ == "__main__":
    test_proactive_collection() 