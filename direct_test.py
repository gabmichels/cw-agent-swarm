"""
Simple test script for Discord notifications using direct method
"""

import os
import sys
from pathlib import Path

# Add the project root to the path
sys.path.insert(0, str(Path(__file__).resolve().parent))

# Import the direct notification function
from apps.agents.shared.tools.discord_notify import send_discord_dm

def main():
    """Run a direct Discord notification test"""
    print("=== Direct Discord Notification Test ===")
    
    # Prepare test message
    test_message = "🔔 This is a test message from the direct notification system."
    
    # Send the message
    print("Sending direct notification...")
    result = send_discord_dm(test_message)
    
    # Report results
    if result:
        print("\n✅ SUCCESS: Message sent successfully!")
        print("Check your Discord for the message.")
    else:
        print("\n❌ FAILED: Message could not be sent.")
        print("Check the error messages above for details.")

if __name__ == "__main__":
    main() 