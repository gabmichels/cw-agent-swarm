"""
Simple test for the data collection functionality.
This test directly uses the data_collector module to collect and report data.
"""
import os
import sys
import time
from pathlib import Path

# Add the project root to the path
ROOT_DIR = Path(__file__).parent.parent.parent
sys.path.append(str(ROOT_DIR))
print(f"Added {ROOT_DIR} to path")

try:
    print("\nImporting data_collector module...")
    from apps.agents.shared.perception.data_collector import (
        collect_data, 
        get_task_status, 
        generate_report_from_task
    )
    print("✅ Successfully imported data_collector")
    
    # Test topic
    topic = "language challenges"
    keywords = ["language barrier", "translation problems"]
    
    print(f"\n🔍 Starting data collection for topic: {topic}")
    print(f"📋 Keywords: {', '.join(keywords)}")
    
    # Step 1: Start data collection
    try:
        task_id = collect_data(
            topic=topic,
            keywords=keywords,
            sources=["rss", "reddit"]
        )
        
        print(f"✅ Started data collection with task ID: {task_id}")
        
        # Step 2: Check status a few times
        for i in range(1, 7):  # Check status for up to 30 seconds
            print(f"\nChecking status (attempt {i})...")
            status_data = get_task_status(task_id)
            
            if status_data:
                status = status_data.get("status", "unknown")
                print(f"Current status: {status}")
                
                if status == "completed":
                    print("Data collection completed!")
                    break
                elif status == "failed":
                    error = status_data.get("summary", "Unknown error")
                    print(f"Data collection failed: {error}")
                    break
            else:
                print("Could not retrieve status")
            
            print("Waiting 5 seconds...")
            time.sleep(5)
        
        # Step 3: Get and display the report
        print("\nGenerating report...")
        report = generate_report_from_task(task_id)
        print("\n📊 REPORT:")
        print("-" * 50)
        print(report)
        
    except Exception as e:
        print(f"❌ Error during data collection: {str(e)}")
        import traceback
        traceback.print_exc()
    
except Exception as e:
    print(f"❌ Import error: {str(e)}")
    import traceback
    traceback.print_exc()

print("\nTest complete.")

if __name__ == "__main__":
    print("Running as main module") 